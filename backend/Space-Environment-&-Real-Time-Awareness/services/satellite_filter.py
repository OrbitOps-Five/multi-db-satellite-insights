from skyfield.api import load
from pymongo import MongoClient
import os
from collections import defaultdict

SATELLITE_TYPE_KEYWORDS = {
    "communication": ["STARLINK", "IRIDIUM", "TELSTAR", "INTELSAT", "SATCOM"],
    "earth_observation": ["SENTINEL", "LANDSAT", "RESURS", "EROS"],
    "navigation": ["GPS", "GLONASS", "GALILEO", "BEIDOU"],
    "scientific": ["HUBBLE", "EXPLORER", "OBSERVATORY", "TIANHE", "TIANZHOU", "CSS"],
    "military": ["USA", "COSMOS", "NROL", "KH"],
    "crew_vehicle": ["CREW DRAGON", "SOYUZ", "TIANZHOU", "PROGRESS"],
    "space_station": ["ISS", "CSS", "TIANHE", "NAUKA", "WENTIAN", "MENGTIAN"],
}

def get_satellite_type(name):
    name_upper = name.upper()
    for sat_type, keywords in SATELLITE_TYPE_KEYWORDS.items():
        if any(keyword in name_upper for keyword in keywords):
            return sat_type
    return "unknown"

def filter_satellites_by_type(target_type):
    url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
    satellites = load.tle_file(url)
    print(f"[DEBUG] Loaded {len(satellites)} satellites from TLE")

    ts = load.timescale()
    now = ts.now()

    filtered = []

    for sat in satellites:
        try:
            sat_type = get_satellite_type(sat.name)
            if target_type == "" or sat_type == target_type:
                geocentric = sat.at(now)
                subpoint = geocentric.subpoint()
                filtered.append({
                    "name": sat.name,
                    "latitude": round(subpoint.latitude.degrees, 2),
                    "longitude": round(subpoint.longitude.degrees, 2),
                    "altitude_km": round(subpoint.elevation.km, 2),
                    "type": sat_type
                })
        except Exception as e:
            print(f"[DEBUG] Error processing {sat.name}: {e}")

    print(f"[DEBUG] Found {len(filtered)} satellites of type '{target_type or 'ALL'}'")
    return filtered

def get_satellites_by_type(target_type):
    results = filter_satellites_by_type(target_type)

    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri)
        db = client["satellite_db"]
        collection = db["filtered_satellites"]

        # optional: remove existing entries for this type
        collection.delete_many({"type": target_type}) if target_type else None

        if results:
            collection.insert_many(results)
            print(f"[MongoDB] Inserted {len(results)} satellites of type '{target_type}'")
    except Exception as e:
        print(f"[MongoDB] Error inserting filtered satellites: {e}")

    return results
