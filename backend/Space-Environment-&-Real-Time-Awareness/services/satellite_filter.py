from skyfield.api import load, EarthSatellite
from pymongo import MongoClient
import os

# Satellite type mappings based on keywords
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
    ts = load.timescale()
    now = ts.now()
    filtered = []

    try:
        with load.open(url) as f:
            lines = [line.decode('utf-8').strip() for line in f.readlines()]
    except Exception as e:
        print(f"[DEBUG] Error loading TLE data: {e}")
        return []

    for i in range(0, len(lines) - 2, 3):
        try:
            name = lines[i]
            line1 = lines[i + 1]
            line2 = lines[i + 2]

            sat = EarthSatellite(line1, line2, name, ts)
            sat_type = get_satellite_type(name)

            if target_type == "" or sat_type == target_type:
                geocentric = sat.at(now)
                subpoint = geocentric.subpoint()
                filtered.append({
                    "name": name,
                    "latitude": round(subpoint.latitude.degrees, 2),
                    "longitude": round(subpoint.longitude.degrees, 2),
                    "altitude_km": round(subpoint.elevation.km, 2),
                    "tle_line1": line1,
                    "tle_line2": line2,
                    "type": sat_type
                })
        except Exception as e:
            print(f"[DEBUG] Skipping malformed TLE for '{name}': {e}")

    print(f"[DEBUG] Found {len(filtered)} satellites of type '{target_type or 'ALL'}'")
    return filtered

def get_satellites_by_type(target_type):
    results = filter_satellites_by_type(target_type)

    try:
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        client = MongoClient(mongo_uri)
        db = client["satellite_db"]
        collection = db["filtered_satellites"]

        if target_type:
            collection.delete_many({"type": target_type})
        else:
            collection.delete_many({})  # remove all

        if results:
            collection.insert_many(results)
            print(f"[MongoDB] Inserted {len(results)} satellites of type '{target_type}'")
    except Exception as e:
        print(f"[MongoDB] Error inserting filtered satellites: {e}")

    return results
