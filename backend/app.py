import json, os, ee
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Inisialisasi Earth Engine via Environment Variable
try:
    service_account_info = os.getenv("GEE_CREDENTIALS")
    if not service_account_info:
        raise Exception("Environment variable GEE_CREDENTIALS tidak ditemukan.")

    credentials_dict = json.loads(service_account_info)
    service_account_email = credentials_dict["client_email"]

    credentials = ee.ServiceAccountCredentials(service_account_email, key_data=service_account_info)
    ee.Initialize(credentials)
    print("✅ Earth Engine berhasil diinisialisasi.")
except Exception as e:
    print(f"⚠️ Gagal inisialisasi Earth Engine: {e}")


# --- Fungsi Helper GEE ---
def get_ndvi_image(year):
    try:
        start_date = f'{year}-01-01'
        end_date = f'{year}-07-01'
        collection = ee.ImageCollection('MODIS/061/MOD13A1') \
            .filter(ee.Filter.date(start_date, end_date))
        mean_image = collection.mean()
        return mean_image.select('NDVI')
    except Exception as e:
        print(f"Gagal mendapatkan gambar {year}: {e}")
        return None

# --- Routes ---
@app.route('/')
def hello():
    return jsonify({"message": "Flask + Earth Engine berjalan di Vercel!"})

@app.route('/api/get-ndvi-layer')
def get_ndvi_layer():
    try:
        img_2019 = get_ndvi_image(2019)
        img_2024 = get_ndvi_image(2024)
        vis = {'min': 0, 'max': 9000, 'palette': ['#e7eff6', '#00a600']}

        if img_2019 is None or img_2024 is None:
            raise Exception("NDVI image tidak ditemukan")

        url_2019 = img_2019.getMapId(vis)['tile_fetcher'].url_format
        url_2024 = img_2024.getMapId(vis)['tile_fetcher'].url_format
        return jsonify({"status": "success", "url_2019": url_2019, "url_2024": url_2024})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/get-mce-layer')
def get_mce_layer():
    try:
        weight = float(request.args.get('degradasi', 50))
        image = ee.Image('CGIAR/SRTM90_V4').select('elevation')
        vis = {'min': 0, 'max': weight * 10, 'palette': ['#000000', '#FFFFFF']}
        url = image.getMapId(vis)['tile_fetcher'].url_format
        return jsonify({"status": "success", "url": url})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ⚠️ Hapus bagian ini agar tidak crash di serverless
# if __name__ == '__main__':
#     app.run(debug=True, port=5000)
