import os
import json
import ee
from flask import Flask, jsonify, request # Pastikan request ada
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- Inisialisasi Google Earth Engine ---
try:
    creds_json = os.getenv("GEE_CREDENTIALS")
    if not creds_json:
        raise Exception("Environment variable 'GEE_CREDENTIALS' tidak ditemukan.")

    creds = json.loads(creds_json)
    service_account = creds["client_email"]

    credentials = ee.ServiceAccountCredentials(service_account, key_data=creds_json)
    ee.Initialize(credentials)
    print("✅ Earth Engine berhasil diinisialisasi.")
except Exception as e:
    print(f"⚠️ Gagal inisialisasi Earth Engine: {e}")

@app.route("/")
def index():
    return jsonify({"message": "Flask + Earth Engine di Vercel siap!"})

# --- TAMBAHKAN BLOK INI DARI BACKUP ANDA ---

# Fungsi helper GEE (ambil dari app-backup.py)
def get_ndvi_image(year):
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

# Rute API yang akan dipanggil JavaScript
@app.route("/api/get-ndvi-layer") 
def get_ndvi_comparison_layer(): 
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
# --- AKHIR BLOK TAMBAHAN ---