from flask import Flask, request, jsonify
from flask_cors import CORS
from services.alerts import schedule_alert
from services.congestion import get_congestion_data
from services.reentry import get_decay_data
from services.launch_history import get_combined_launch_history
from services.satellite_filter import get_satellites_by_type
from bson import ObjectId
import os

app = Flask(__name__)
CORS(app)

# Load env vars (for local dev as fallback, optional)
os.environ.setdefault("MONGO_URI", "mongodb://localhost:27017/")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

# Satellite visibility alert registration
@app.route("/api/alerts/register", methods=["POST"])
def register():
    data = request.json
    user_id = data.get("user_id", "default_user")
    lat = float(data["lat"])
    lon = float(data["lon"])
    result = schedule_alert(user_id, lat, lon)
    return jsonify(result)

# Orbital congestion heatmap
@app.route("/api/orbit-heatmap", methods=["GET"])
def orbit_heatmap():
    result = get_congestion_data()
    return jsonify(result)

# Satellite re-entry and decay data
@app.route("/api/satellite-decay", methods=["GET"])
def satellite_decay():
    result = get_decay_data()

    for doc in result:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])

    return jsonify({
        "count": len(result),
        "results": result
    })

# Combined satellite launch history
@app.route("/api/launch-history", methods=["GET"])
def launch_history():
    result = get_combined_launch_history()

    for doc in result:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])

    return jsonify({
        "count": len(result),
        "results": result
    })

# Filter satellites by type
@app.route("/api/satellites", methods=["GET"])
def satellite_filter():
    satellite_type = request.args.get("type", "").lower()
    result = get_satellites_by_type(satellite_type)

    for doc in result:
        if "_id" in doc:
            doc["_id"] = str(doc["_id"])

    return jsonify(result)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
