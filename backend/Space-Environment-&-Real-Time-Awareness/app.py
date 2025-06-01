from flask import Flask, request, jsonify
from services.alerts import schedule_alert

app = Flask(__name__)

@app.route("/api/alerts/register", methods=["POST"])
def register():
    data = request.json
    user_id = data.get("user_id", "default_user")
    lat = float(data["lat"])
    lon = float(data["lon"])
    result = schedule_alert(user_id, lat, lon)
    return jsonify(result)

if __name__ == "__main__":
    app.run(debug=True)
