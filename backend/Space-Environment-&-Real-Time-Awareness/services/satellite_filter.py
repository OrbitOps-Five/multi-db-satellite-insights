# services/satellite_filter.py

from skyfield.api import load
from collections import defaultdict

# Basic keyword-based mapping (can be improved with NORAD metadata later)
SATELLITE_TYPE_KEYWORDS = {
    "communication": ["COM", "SATCOM", "TEL", "INTELSAT"],
    "earth_observation": ["LANDSAT", "EOS", "RESURS", "EROS"],
    "navigation": ["GPS", "GLONASS", "GALILEO", "BEIDOU"],
    "scientific": ["SCI", "EXPLORER", "OBSERVATORY", "ASTRO"],
    "military": ["MIL", "USA", "NROL", "KH"],
    "cubesat": ["CUBESAT", "1U", "2U", "3U", "NANOSAT"],
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
            if sat_type == target_type:
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

    return filtered

def get_satellites_by_type():
    # Your code here
    return result
