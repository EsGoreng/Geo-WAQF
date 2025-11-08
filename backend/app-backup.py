import ee
from flask import Flask, jsonify, request # <-- TAMBAHKAN 'request'
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
    print("Koneksi GEE (via Akun Layanan) berhasil.")
except Exception as e:
    print(f"Autentikasi GEE gagal: {e}")
    # ... (kode error) ...
    exit()

# --- Fungsi Helper GEE ---

def get_ndvi_image(year):
    # ... (Fungsi ini tidak berubah) ...
    try:
        start_date = f'{year}-01-01'
        end_date = f'{year}-07-01' # Ambil 6 bulan pertama
        collection = ee.ImageCollection('MODIS/061/MOD13A1') \
                       .filter(ee.Filter.date(start_date, end_date))
        mean_image = collection.mean()
        if mean_image.bandNames().size().getInfo() == 0:
             raise Exception(f"Tidak ada citra ditemukan untuk tahun {year}.")
        return mean_image.select('NDVI')
    except Exception as e:
        print(f"Gagal mendapatkan gambar untuk tahun {year}: {e}")
        return None

# --- API Endpoints ---

@app.route("/")
def hello():
    return "Halo! Server Geo-WAQF (Flask) sedang berjalan."

@app.route("/api/get-ndvi-layer") 
def get_ndvi_comparison_layer(): 
    # ... (Endpoint ini tidak berubah) ...
    try:
        image_2019 = get_ndvi_image(2019)
        image_2024 = get_ndvi_image(2024)
        
        if image_2019 is None or image_2024 is None:
            raise Exception("Gagal menghitung salah satu atau kedua gambar NDVI.")

        ndvi_vis_params = {
            'min': 0.0,
            'max': 9000.0,
            'palette': ['#e7eff6', '#00a600'] 
        }

        map_id_2019 = image_2019.getMapId(ndvi_vis_params)
        map_id_2024 = image_2024.getMapId(ndvi_vis_params)
        
        url_2019 = map_id_2019['tile_fetcher'].url_format
        url_2024 = map_id_2024['tile_fetcher'].url_format

        return jsonify({
            'status': 'success',
            'url_2019': url_2019,
            'url_2024': url_2024
        })

    except Exception as e:
        print(f"Error di GEE: {e}") 
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# =================================
# ENDPOINT BARU (LANGKAH 7.1)
# =================================
@app.route("/api/get-mce-layer")
def get_mce_layer():
    """
    Endpoint API untuk simulasi Analisis Multi-Kriteria (MCE).
    Menerima 'weight' sebagai parameter query dari front-end.
    """
    try:
        # 1. Ambil 'weight' dari parameter URL.
        #    Front-end akan memanggil: /api/get-mce-layer?degradasi=80
        #    Kita ambil nilai '80' itu. Jika tidak ada, default-nya 50.
        weight_str = request.args.get('degradasi', default='50')
        
        # Konversi ke angka
        try:
            weight = float(weight_str)
        except ValueError:
            weight = 50.0 # Default jika inputnya bukan angka

        print(f"Menerima permintaan MCE dengan 'degradasi' = {weight}")

        # 2. SIMULASI MCE:
        #    Kita gunakan data Ketinggian (Elevation) global sebagai ganti data "Degradasi".
        #    (Ini hanya untuk membuktikan slider-nya terhubung ke GEE).
        image = ee.Image('CGIAR/SRTM90_V4').select('elevation')

        # 3. Gunakan 'weight' untuk mengubah visualisasi
        #    Slider 0 = min 0, Slider 100 = min 100
        #    Ini akan secara visual mengubah peta saat slider digerakkan.
        vis_params = {
            'min': 0.0,       # Tetap 0
            'max': weight * 10, # Max 1000 (jika slider 100)
            'palette': ['#000000', '#FFFFFF'] # Hitam ke Putih
        }

        # 4. Dapatkan URL Peta dari GEE
        map_id = image.getMapId(vis_params)
        url = map_id['tile_fetcher'].url_format

        # 5. Kirim URL kembali ke front-end
        return jsonify({
            'status': 'success',
            'url': url
        })

    except Exception as e:
        print(f"Error di GEE (MCE): {e}") 
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500
# =================================
# AKHIR ENDPOINT BARU
# =================================


# --- Menjalankan Server ---

if __name__ == '__main__':
    app.run(debug=True, port=5000)