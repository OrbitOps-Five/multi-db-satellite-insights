from flask import Flask, request, jsonify
from services.alerts import schedule_alert
from services.congestion import get_congestion_data
from services.reentry import get_decay_data
from services.launch_history import get_combined_launch_history
from services.satellite_filter import get_satellites_by_type  # ✅ Added
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Route for satellite visibility alert
@app.route("/api/alerts/register", methods=["POST"])
def register():
    data = request.json
    user_id = data.get("user_id", "default_user")
    lat = float(data["lat"])
    lon = float(data["lon"])
    result = schedule_alert(user_id, lat, lon)
    return jsonify(result)

# Route for orbital congestion heatmap data
@app.route("/api/orbit-heatmap", methods=["GET"])
def orbit_heatmap():
    result = get_congestion_data()
    return jsonify(result)

# Route for satellite re-entry and decay data
@app.route("/api/satellite-decay", methods=["GET"])
def satellite_decay():
    result = get_decay_data()
    return jsonify(result)

# Route for satellite launch history
@app.route("/api/launch-history", methods=["GET"])
def launch_history():
    result = get_combined_launch_history()
    return jsonify(result)

# ✅ Route for satellite filtering by type
@app.route("/api/satellites", methods=["GET"])
def satellite_filter():
    satellite_type = request.args.get("type", "").lower()
    result = get_satellites_by_type(satellite_type)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
