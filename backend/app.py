import os
import json
import ee
from flask import Flask, jsonify, request
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

# Jangan jalankan app.run() di bawah ini — Vercel akan handle otomatis
