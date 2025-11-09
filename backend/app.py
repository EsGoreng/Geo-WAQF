import ee
from flask import Flask, jsonify, request 
from flask_cors import CORS
import json 

# --- Inisialisasi Aplikasi ---

app = Flask(__name__)
CORS(app) 

try:
    key_file = 'service-account.json' 
    with open(key_file) as f:
        service_account_email = json.load(f)['client_email']
    credentials = ee.ServiceAccountCredentials(
        service_account_email, 
        key_file
    )
    ee.Initialize(credentials=credentials)
    app.logger.info("Koneksi GEE (via Akun Layanan) berhasil.")
except Exception as e:
    app.logger.error(f"Autentikasi GEE gagal: {e}")
    exit()

# --- Definisi AOI ---
try:
    admin_level2 = ee.FeatureCollection('FAO/GAUL/2015/level2')
    AOI_BENGKALIS_FEATURE = admin_level2.filter(ee.Filter.eq('ADM2_NAME', 'Bengkalis')).first()
    AOI_BENGKALIS = AOI_BENGKALIS_FEATURE.geometry()
    AOI_KABUPATEN_RIAU = admin_level2.filter(ee.Filter.eq('ADM1_NAME', 'Riau'))
    app.logger.info("Berhasil mengambil AOI Bengkalis (Level 2) & Riau (Level 2).")
except Exception as e:
    app.logger.error(f"GAGAL mengambil AOI: {e}. Analisis mungkin gagal.")
    AOI_BENGKALIS = None
    AOI_KABUPATEN_RIAU = None

# =================================
# REFACTOR: FUNGSI HELPER GEE
# =================================

def maskS2clouds(image):
    """Cloud masking untuk Sentinel-2 HARMONIZED (menggunakan QA60)"""
    qa = image.select('QA60')
    cloudBitMask = 1 << 10
    cirrusBitMask = 1 << 11
    mask = qa.bitwiseAnd(cloudBitMask).eq(0) \
             .And(qa.bitwiseAnd(cirrusBitMask).eq(0))
    mask = mask.updateMask(mask).focal_min(radius=3, units='pixels')
    return image.updateMask(mask).divide(10000) # Normalisasi ke 0-1

def get_processed_s2_composite(start_date, end_date):
    """Mendapatkan komposit median Sentinel-2 (Bebas Awan, Terekspos, Dihitung NBR/NDWI)"""
    s2_collection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED") \
                      .filterDate(start_date, end_date) \
                      .filterBounds(AOI_BENGKALIS) \
                      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 50))
    
    s2_masked = s2_collection.map(maskS2clouds)
    median_image = s2_masked.median()
    
    if median_image.bandNames().size().getInfo() == 0:
        raise Exception(f"Tidak ada citra bebas awan ditemukan untuk {start_date} - {end_date}")

    nbr_image = median_image.normalizedDifference(['B8', 'B12']).rename('NBR')
    ndwi_image = median_image.normalizedDifference(['B3', 'B8']).rename('NDWI')
    return nbr_image.addBands(ndwi_image).clip(AOI_BENGKALIS)

# --- Fungsi Helper Kriteria MCE ---

# =================================
# PERBAIKAN DATASET #1 (Gambut)
# =================================
def get_kriteria_gambut():
    """Kriteria 1: Kedalaman Gambut (Dataset Spesifik Indonesia). Skor 1 = Gambut Sangat Dalam."""
    # LAMA:
    # peat_image = ee.Image('projects/sat-io/open-datasets/GLOBAL-PEATLAND-DATABASE').select('b1')
    # kriteria_gambut = peat_image.gt(0).rename('score_gambut') # Skor 1 jika gambut
    
    # BARU (Dataset Kedalaman Gambut Indonesia [cm]):
    peat_collection = ee.ImageCollection('projects/sat-io/open-datasets/MOHSIN/Monthly_Peat_Depth_Indonesia_2017_2022/v1')
    
    # Ambil rata-rata kedalaman dari seluruh koleksi
    peat_depth = peat_collection.mean().select('b1') # b1 adalah kedalaman dalam cm
    
    # Normalisasi (skala 0-1). Asumsikan kedalaman maks 1500cm (15m)
    # Semakin dalam, semakin tinggi skornya (semakin prioritas)
    return peat_depth.unitScale(0, 1500).rename('score_gambut')
# =================================
# AKHIR PERBAIKAN #1
# =================================

def get_kriteria_degradasi():
    """Kriteria 2: Degradasi Lahan (Tutupan Lahan). Skor 1 = Lahan Terdegradasi."""
    worldcover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map')
    # Remap: 10(Pohon)=0, 80(Air)=0. Lainnya=1
    return worldcover.remap(
        [10, 20, 30, 40, 50, 60, 80], 
        [0,  1,  1,  1,  1,  1,  0]
    ).rename('score_degradasi')

def get_kriteria_akses():
    """Kriteria 3: Aksesibilitas (Proksi: Kekasaran Medan). Skor 1 = Datar (Akses Mudah)."""
    ruggedness = ee.Image("CSP/ERGo/1_0/Global/SRTM_mTPI")
    # Balikkan skor: 1 - (skor normalisasi)
    return ruggedness.unitScale(0, 200).subtract(1).abs().rename('score_akses')

def get_kriteria_hidrologi():
    """Kriteria 4: Jaringan Drainase. Skor 1 = Dekat Sungai/Kanal."""
    hydro_rivers = ee.FeatureCollection("WWF/HydroSHEDS/v1/FreeFlowingRivers") \
                     .filterBounds(AOI_BENGKALIS)
    distance_to_rivers = hydro_rivers.distance(searchRadius=10000)
    # Balikkan skor: 1 - (skor normalisasi)
    return distance_to_rivers.unitScale(0, 10000).subtract(1).abs().rename('score_hidrologi')

# =================================
# AKHIR FUNGSI HELPER
# =================================

# --- API Endpoints ---

@app.route("/")
def hello():
    return "Halo! Server Geo-WAQF (Flask) sedang berjalan."

@app.route("/api/get-analysis-layers") 
def get_analysis_layers(): 
    # ... (Endpoint ini tidak berubah) ...
    try:
        image_2019 = get_processed_s2_composite('2019-07-01', '2019-10-30')
        image_2024 = get_processed_s2_composite('2024-07-01', '2024-10-30')
            
        nbr_2019 = image_2019.select('NBR')
        nbr_2024 = image_2024.select('NBR')
        dnbr = nbr_2019.subtract(nbr_2024)
        ndwi_2019 = image_2019.select('NDWI')
        ndwi_2024 = image_2024.select('NDWI')
        
        dnbr_vis = { 'min': 0.5, 'max': -0.5, 'palette': ['#d7191c', '#fdae61', '#ffffbf', '#a6d96a', '#1a9641'] }
        ndwi_vis = { 'min': -0.5, 'max': 0.5, 'palette': ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'] }

        map_id_dnbr = dnbr.getMapId(dnbr_vis)
        map_id_ndwi_2019 = ndwi_2019.getMapId(ndwi_vis)
        map_id_ndwi_2024 = ndwi_2024.getMapId(ndwi_vis)
        
        return jsonify({
            'status': 'success',
            'url_dnbr': map_id_dnbr['tile_fetcher'].url_format,
            'url_ndwi_2019': map_id_ndwi_2019['tile_fetcher'].url_format,
            'url_ndwi_2024': map_id_ndwi_2024['tile_fetcher'].url_format
        })
    except Exception as e:
        app.logger.error(f"Error di GEE (Analisis): {e}") 
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


@app.route("/api/get-mce-layer")
def get_mce_layer():
    """Endpoint API untuk Analisis MCE (Pilar 1)"""
    try:
        # 1. Ambil 4 bobot
        w_gambut = float(request.args.get('gambut', '50')) / 100.0 
        w_degradasi = float(request.args.get('degradasi', '50')) / 100.0
        w_akses = float(request.args.get('akses', '50')) / 100.0
        w_hidrologi = float(request.args.get('hidrologi', '50')) / 100.0

        app.logger.info(f"Menerima bobot MCE: G={w_gambut}, D={w_degradasi}, A={w_akses}, H={w_hidrologi}")

        # 2. Panggil fungsi helper (JAUH LEBIH RAPIH)
        kriteria_gambut = get_kriteria_gambut()
        kriteria_degradasi = get_kriteria_degradasi()
        kriteria_akses = get_kriteria_akses()
        kriteria_hidrologi = get_kriteria_hidrologi()

        # 3. Jalankan "Weighted Overlay"
        final_score = kriteria_gambut.multiply(w_gambut) \
                      .add(kriteria_degradasi.multiply(w_degradasi)) \
                      .add(kriteria_akses.multiply(w_akses)) \
                      .add(kriteria_hidrologi.multiply(w_hidrologi))

        if AOI_BENGKALIS:
            final_score = final_score.clip(AOI_BENGKALIS)

        # Palet MCE (Biru -> Kuning -> Merah)
        mce_vis_params = {
            'min': 0.0, 'max': 1.0, 
            'palette': ['#4575b4', '#abd9e9', '#ffffbf', '#fdae61', '#d73027']
        }

        map_id = final_score.getMapId(mce_vis_params)
        url = map_id['tile_fetcher'].url_format

        return jsonify({ 'status': 'success', 'url': url })
    except Exception as e:
        app.logger.error(f"Error di GEE (MCE): {e}") 
        return jsonify({ 'status': 'error', 'message': str(e) }), 500


@app.route("/api/get-desa-bengkalis")
def get_desa_bengkalis():
    try:
        # Menggunakan data kabupaten Riau yang kita tahu valid
        if AOI_KABUPATEN_RIAU is None: 
            raise Exception("Data Kabupaten Riau (Level 2) tidak berhasil dimuat.")
        
        app.logger.info("Mengambil data GeoJSON untuk batas kabupaten...")
        geojson_data = AOI_KABUPATEN_RIAU.getInfo() 
        app.logger.info("Data GeoJSON berhasil diambil.")
        
        return jsonify({ 'status': 'success', 'geojson': geojson_data })
    except Exception as e:
        app.logger.error(f"Error di GEE (GeoJSON): {e}") 
        return jsonify({ 'status': 'error', 'message': str(e) }), 500

# --- Menjalankan Server ---

if __name__ == '__main__':
    app.run(debug=False, port=5000)