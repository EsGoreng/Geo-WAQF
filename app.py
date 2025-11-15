import ee
from flask import Flask, jsonify, request 
from flask_cors import CORS
import json 
import os       # <-- Ditambahkan
import base64   # <-- Ditambahkan

# --- Inisialisasi Aplikasi ---

app = Flask(__name__)
CORS(app) 

# ==========================================================
# --- Inisialisasi GEE (VERSI BARU UNTUK VERCELL) ---
# ==========================================================
try:
    # 1. Ambil JSON string dari Environment Variable (Base64)
    # Nama 'GEE_SERVICE_ACCOUNT_JSON_BASE64' harus sama dengan di Vercel
    env_key_base64 = os.environ.get('GEE_SERVICE_ACCOUNT_JSON_BASE64')
    
    if not env_key_base64:
        raise Exception("Variabel GEE_SERVICE_ACCOUNT_JSON_BASE64 tidak ditemukan.")

    # 2. Decode Base64 menjadi string JSON biasa
    key_content_str = base64.b64decode(env_key_base64).decode('utf-8')
    key_content_json = json.loads(key_content_str)
    service_account_email = key_content_json['client_email']

    # 3. Tulis string JSON ke file temporer
    # Di Vercel, HANYA folder /tmp yang bisa ditulis
    key_file_path = '/tmp/service-account.json'
    with open(key_file_path, 'w') as f:
        f.write(key_content_str)
    
    app.logger.info("Berhasil menulis key GEE ke /tmp/service-account.json")

    # 4. Gunakan file temporer tersebut untuk autentikasi GEE
    credentials = ee.ServiceAccountCredentials(
        service_account_email, 
        key_file_path  # <-- Gunakan path file temporer
    )
    ee.Initialize(credentials=credentials)
    app.logger.info("Koneksi GEE (via Akun Layanan /tmp) berhasil.")

except Exception as e:
    app.logger.error(f"Autentikasi GEE gagal: {e}")
    # Biarkan error ini terjadi agar endpoint gagal jika auth tidak berhasil
# ==========================================================
# --- AKHIR BLOK Inisialisasi GEE BARU ---
# ==========================================================


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

# --- Fungsi Helper GEE (Analisis) ---

def maskS2clouds(image):
    qa = image.select('QA60')
    cloudBitMask = 1 << 10
    cirrusBitMask = 1 << 11
    mask = qa.bitwiseAnd(cloudBitMask).eq(0) \
             .And(qa.bitwiseAnd(cirrusBitMask).eq(0))
    mask = mask.updateMask(mask).focal_min(radius=3, units='pixels')
    return image.updateMask(mask).divide(10000)

def get_processed_s2_composite(start_date, end_date):
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
        nbr_2019 = image_2019.select('NBR'); nbr_2024 = image_2024.select('NBR')
        dnbr = nbr_2019.subtract(nbr_2024)
        ndwi_2019 = image_2019.select('NDWI'); ndwi_2024 = image_2024.select('NDWI')
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

# =================================
# ENDPOINT MCE
# =================================
@app.route("/api/get-mce-layer")
def get_mce_layer():
    """
    Endpoint API untuk Analisis MCE (Pilar 1)
    Menerapkan logika RECLASSIFY (Skor 1-5) dan bobot DINAMIS dari slider.
    """
    try:
        # 1. Ambil 4 bobot DINAMIS dari slider (nilai 0.0 - 1.0)
        w_gambut = float(request.args.get('gambut', '50')) / 100.0 
        w_degradasi = float(request.args.get('degradasi', '50')) / 100.0
        w_akses = float(request.args.get('akses', '50')) / 100.0
        w_hidrologi = float(request.args.get('hidrologi', '50')) / 100.0

        app.logger.info(f"Menerima bobot MCE: G={w_gambut}, D={w_degradasi}, A={w_akses}, H={w_hidrologi}")

        # 2. Siapkan 4 Layer Skor (LOGIKA RECLASSIFY 1-5 BARU)
        
        # Kriteria 1: Kedalaman Gambut (Dataset: GLOBAL-PEATLAND-DATABASE)
        peat_image = ee.Image('projects/sat-io/open-datasets/GLOBAL-PEATLAND-DATABASE').select('b1')
        k1_Gambut_Score = peat_image.gt(0).remap(
            [0, 1],  # Nilai Asli (0=Bukan Gambut, 1=Gambut)
            [1, 5]   # Nilai Baru (1=Aman, 5=Sangat Rentan)
        ).rename('score_gambut')

        # Kriteria 2: Degradasi (Dataset: ESA/WorldCover/v200)
        worldcover = ee.ImageCollection('ESA/WorldCover/v200').first().select('Map')
        k2_Degradasi_Score = worldcover.remap(
            [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100], # Nilai Asli
            [1,  3,  3,  4,  5,  5,  1,  1,  3,  1,  1]    # Nilai Baru (Skor 1-5)
        ).rename('score_degradasi')

        # Kriteria 3: Aksesibilitas (Dataset: CSP/ERGo/1_0/Global/SRTM_mTPI)
        ruggedness = ee.Image("CSP/ERGo/1_0/Global/SRTM_mTPI")
        k3_Akses_Score = ruggedness.remap(
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], # Nilai Asli (Kekasaran)
            [5, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 1]     # Nilai Baru (Skor 1-5)
        ).rename('score_akses')

        # Kriteria 4: Jaringan Drainase (Dataset: WWF/HydroSHEDS/v1/FreeFlowingRivers)
        hydro_rivers = ee.FeatureCollection("WWF/HydroSHEDS/v1/FreeFlowingRivers") \
                         .filterBounds(AOI_BENGKALIS)
        distance_to_rivers = hydro_rivers.distance(searchRadius=10000) # Jarak maks 10km
        k4_Drainase_Score = distance_to_rivers.remap(
             [0, 1000, 2000, 5000, 10000],  # Jarak (0-1km, 1-2km, 2-5km, 5-10km, 10km+)
             [5, 4,    3,    2,    1]      # Skor (Sangat Rentan -> Aman)
        ).rename('score_hidrologi')

        # 3. Jalankan "Weighted Overlay" (Tumpang Susun Berbobot)
        final_score = k2_Degradasi_Score.multiply(w_degradasi) \
                      .add(k1_Gambut_Score.multiply(w_gambut)) \
                      .add(k4_Drainase_Score.multiply(w_hidrologi)) \
                      .add(k3_Akses_Score.multiply(w_akses))
        
        # 4. Normalisasi hasil akhir agar tetap 1-5
        total_weight = w_degradasi + w_gambut + w_hidrologi + w_akses
        final_score_normalized = ee.Algorithms.If(
            ee.Number(total_weight).gt(0),
            final_score.divide(total_weight),
            1 # Jika semua 0, skor = 1 (Aman)
        )

        # 5. Potong (clip) hasil akhir ke AOI Bengkalis
        if AOI_BENGKALIS:
            final_score_normalized = ee.Image(final_score_normalized).clip(AOI_BENGKALIS)

        # 6. Siapkan palet visualisasi
        mce_vis_params = {
            'min': 1.0, 'max': 5.0,
            'palette': ['#008000', '#FFFF00', '#FF0000'] # Hijau - Kuning - Merah
        }

        # 7. Dapatkan URL Peta dari GEE
        map_id = ee.Image(final_score_normalized).getMapId(mce_vis_params)
        url = map_id['tile_fetcher'].url_format

        # 8. Kirim URL kembali ke front-end
        return jsonify({ 'status': 'success', 'url': url })
    except Exception as e:
        app.logger.error(f"Error di GEE (MCE): {e}") 
        return jsonify({ 'status': 'error', 'message': str(e) }), 500
# =================================
# AKHIR ENDPOINT MCE
# =================================


@app.route("/api/get-desa-bengkalis")
def get_desa_bengkalis():
    try:
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

# if __name__ == '__main__':
#     app.run(debug=False, port=5000)
    
# Catatan: Baris di atas sengaja dinonaktifkan.
# Vercel akan menjalankan aplikasi menggunakan 'gunicorn' (WSGI server).