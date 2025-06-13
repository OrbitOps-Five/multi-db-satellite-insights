# services/satellite_filter.py

from skyfield.api import load, EarthSatellite
from pymongo import MongoClient
import os

# Map of human types → name-fragments to look for
SATELLITE_TYPE_KEYWORDS = {
    "communication":    ["STARLINK", "IRIDIUM", "TELSTAR", "INTELSAT", "SATCOM"],
    "earth_observation":["SENTINEL", "LANDSAT", "RESURS", "EROS"],
    "navigation":       ["GPS", "GLONASS", "GALILEO", "BEIDOU"],
    "scientific":       ["HUBBLE", "EXPLORER", "OBSERVATORY", "TIANHE", "TIANZHOU", "CSS"],
    "military":         ["USA", "COSMOS", "NROL", "KH"],
    "crew_vehicle":     ["CREW DRAGON", "SOYUZ", "PROGRESS"],
    "space_station":    ["ISS", "NAUKA", "WENTIAN", "MENGTIAN"],
}

def get_satellite_type(name: str) -> str:
    u = name.upper()
    for kind, keywords in SATELLITE_TYPE_KEYWORDS.items():
        if any(kw in u for kw in keywords):
            return kind
    return "unknown"

def filter_satellites_by_type(target_type: str):
    """
    Download the 'active' TLE list, filter by name-keywords,
    compute subpoint for each sat at current time, and return a list of dicts.
    """
    tle_url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
    ts      = load.timescale()
    now     = ts.now()
    sats    = []

    # read raw TLE lines (name / l1 / l2)
    with load.open(tle_url) as f:
        lines = [ln.decode("utf-8").strip() for ln in f.readlines()]

    for i in range(0, len(lines) - 2, 3):
        name, l1, l2 = lines[i], lines[i+1], lines[i+2]
        kind = get_satellite_type(name)
        if target_type and kind != target_type:
            continue

        try:
            sat = EarthSatellite(l1, l2, name, ts)
            sub = sat.at(now).subpoint()
            sats.append({
                "name":        name,
                "latitude":    round(sub.latitude.degrees,  2),
                "longitude":   round(sub.longitude.degrees, 2),
                "altitude_km": round(sub.elevation.km,      2),
                "tle_line1":   l1,
                "tle_line2":   l2,
                "type":        kind,
            })
        except Exception:
            # skip malformed entries
            continue

    print(f"[DEBUG][sat_filter] filter → {len(sats)} sats for type='{target_type or 'ALL'}'")
    return sats

def get_satellites_by_type(target_type: str):
    """
    Endpoint logic: refetch & refilter from CelesTrak, write into Mongo,
    then return the fresh list.
    """
    # 1) fetch & filter
    results = filter_satellites_by_type(target_type)

    # 2) open Mongo
    mongo_uri  = os.getenv("MONGO_URI",         "mongodb://localhost:27017/")
    mongo_db   = os.getenv("MONGO_DB",          "satellite_db")
    mongo_coll = os.getenv("MONGO_COLLECTION",  "filtered_satellites")
    client     = MongoClient(mongo_uri)
    coll       = client[mongo_db][mongo_coll]

    # 3) delete old docs of that type
    if target_type:
        coll.delete_many({"type": target_type})
    else:
        coll.delete_many({})

    # 4) insert fresh
    if results:
        coll.insert_many(results)
        print(f"[DEBUG][sat_filter] wrote {len(results)} docs to '{mongo_coll}'")

    return results

# Optional helper: populate ALL types in one go
if __name__ == "__main__":
    for t in list(SATELLITE_TYPE_KEYWORDS) + [""]:
        count = len(get_satellites_by_type(t))
        print(f"→ Populated '{t or 'ALL'}' → {count} docs")
