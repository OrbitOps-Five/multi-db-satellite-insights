# services/congestion.py

from skyfield.api import EarthSatellite, load
from collections import defaultdict
from pymongo import MongoClient
import os
from bson import ObjectId
import requests


def fetch_tle_data():
    url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
    response = requests.get(url)
    lines = response.text.strip().splitlines()

    satellites = []

    for i in range(0, len(lines) - 2, 3):
        name = lines[i].strip()
        line1 = lines[i + 1].strip()
        line2 = lines[i + 2].strip()

        try:
            sat = EarthSatellite(line1, line2, name)
            sat.line1 = line1  # Attach for frontend use
            sat.line2 = line2
            satellites.append(sat)
        except Exception as e:
            print(f"[DEBUG] Skipping invalid TLE for {name}: {e}")

    print(f"[DEBUG] Loaded {len(satellites)} valid TLE satellites")
    return satellites


def classify_congestion(count):
    if count < 100:
        return "Low"
    elif count < 300:
        return "Medium"
    else:
        return "High"


def cluster_by_altitude(satellites, bins=None):
    if bins is None:
        bins = {
            "LEO (160-600 km)": (160, 600),
            "LEO (600-1200 km)": (600, 1200),
            "LEO (1200-2000 km)": (1200, 2000),
            "MEO": (2000, 35786),
            "GEO": (35786, 36000),
            "HEO": (36000, 100000)
        }

    ts = load.timescale()
    now = ts.now()

    clustered = defaultdict(list)

    for sat in satellites:
        try:
            geocentric = sat.at(now)
            subpoint = geocentric.subpoint()
            alt_km = subpoint.elevation.km

            for zone, (low, high) in bins.items():
                if low <= alt_km < high:
                    clustered[zone].append({
                        "name": sat.name,
                        "altitude": round(alt_km, 2),
                        "tle_line1": sat.line1,
                        "tle_line2": sat.line2,
                        "type": "LEO" if "LEO" in zone else zone
                    })
        except Exception as e:
            print(f"[DEBUG] Error processing {sat.name}: {e}")

    output = {}
    for zone, sats in clustered.items():
        output[zone] = {
            "count": len(sats),
            "congestion": classify_congestion(len(sats)),
            "satellites": sats
        }

    return output


def sanitize_mongo_doc(doc):
    return {k: str(v) if isinstance(v, ObjectId) else v for k, v in doc.items()}


def get_congestion_data():
    satellites = fetch_tle_data()
    result = cluster_by_altitude(satellites)

    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri)
        db = client["satellite_db"]
        collection = db["congestion_data"]

        collection.delete_many({})
        inserted = collection.insert_one(result)
        print("[MongoDB] Congestion data stored successfully.")
        result["_id"] = str(inserted.inserted_id)

    except Exception as e:
        print(f"[MongoDB] Error storing data: {e}")

    return result
