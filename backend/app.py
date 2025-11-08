import os
import json
# import ee  <-- Komentarkan
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- Inisialisasi Google Earth Engine ---
# try:
#     creds_json = os.getenv("GEE_CREDENTIALS")
#     if not creds_json:
#         raise Exception("Environment variable 'GEE_CREDENTIALS' tidak ditemukan.")
# 
#     creds = json.loads(creds_json)
#     service_account = creds["client_email"]
# 
#     credentials = ee.ServiceAccountCredentials(service_account, key_data=creds_json)
#     ee.Initialize(credentials)
#     print("✅ Earth Engine berhasil diinisialisasi.")
# except Exception as e:
#     print(f"⚠️ Gagal inisialisasi Earth Engine: {e}")

@app.route("/")
def index():
    return jsonify({"message": "Flask + Earth Engine di Vercel siap!"})

# Fungsi helper GEE (ambil dari app-backup.py)
# def get_ndvi_image(year):
#   ... (Komentarkan seluruh isi fungsi ini)
#   pass

# Rute API yang akan dipanggil JavaScript
@app.route("/api/get-ndvi-layer") 
def get_ndvi_comparison_layer(): 
    # Kirim data palsu untuk sementara
    return jsonify({
        'status': 'error',
        'message': 'GEE sedang dinonaktifkan untuk debug.'
    })