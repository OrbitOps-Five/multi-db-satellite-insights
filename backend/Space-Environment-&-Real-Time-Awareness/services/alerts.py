from skyfield.api import load, wgs84, utc
from datetime import datetime, timedelta, timezone
from db.redis_client import r
import numpy as np

# how many seconds between samples
STEP_SEC = 5 * 60        # 5 min steps for a quick test
# fallback test alert delay when nothing real shows up
FALLBACK_DELAY_SEC = 60  # 1 min test alert
# demo horizon
HORIZON_HOURS = 1        # only look 1 hour ahead
# max sats to scan
MAX_SATS = 50            # only check first 50 TLEs

def find_closest_pass(satrec, observer_latlon, ts, radius_km=500):
    """
    Return the first datetime over the next HORIZON_HOURS when the satellite
    is within radius_km of observer_latlon, or None.
    """
    now = datetime.utcnow().replace(tzinfo=utc)
    total_steps = int((HORIZON_HOURS * 3600) / STEP_SEC)
    for i in range(total_steps + 1):
        t = ts.utc(
            now.year, now.month, now.day,
            now.hour, now.minute, now.second + i * STEP_SEC
        )
        sat_pos = satrec.at(t).position.km
        obs_pos = wgs84.latlon(
            observer_latlon.latitude.degrees,
            observer_latlon.longitude.degrees,
            elevation_m=0
        ).at(t).position.km
        dist = np.linalg.norm(sat_pos - obs_pos)
        if dist <= radius_km:
            print(f"[DEBUG] PASS: {satrec.name} at {t.utc_datetime()} (dist {dist:.1f} km)")
            return t.utc_datetime()
    return None

def schedule_alert(user_id, lat, lon):
    tle_url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle'
    print(f"[DEBUG] Loading TLE data from {tle_url}")
    try:
        sats = load.tle_file(tle_url)
    except Exception as e:
        print(f"[ERROR] TLE load failed: {e}")
        return {"msg": "Failed to load TLE data"}

    # demo: only scan the first MAX_SATS satellites
    sats = sats[:MAX_SATS]
    print(f"[DEBUG] Scanning {len(sats)} satellites (limited to {MAX_SATS})")

    ts = load.timescale()
    observer = wgs84.latlon(latitude_degrees=lat,
                             longitude_degrees=lon,
                             elevation_m=0)

    soonest = None
    name = None
    for sat in sats:
        try:
            t_pass = find_closest_pass(sat, observer, ts)
            if t_pass and (soonest is None or t_pass < soonest):
                soonest, name = t_pass, sat.name
        except Exception as e:
            print(f"[WARN] {sat.name} skipped: {e}")

    if soonest:
        now_utc = datetime.utcnow().replace(tzinfo=timezone.utc)
        ttl = int((soonest - now_utc).total_seconds())
        if ttl > 0:
            msg = f"Sat '{name}' within 500 km at {soonest.strftime('%H:%M')}"
            r.setex(f"alert:{user_id}", ttl, msg)
            return {"msg": "Alert set", "at": soonest.strftime('%Y-%m-%d %H:%M')}

    # fallback test alert
    test_time = datetime.utcnow().replace(tzinfo=timezone.utc) + timedelta(seconds=FALLBACK_DELAY_SEC)
    r.setex(f"alert:{user_id}", FALLBACK_DELAY_SEC, "Test alert: sat passing now")
    print("[DEBUG] No real pass → test alert in 1 min")
    return {"msg": "Test alert set", "at": test_time.strftime('%Y-%m-%d %H:%M')}

def check_alert(user_id):
    key = f"alert:{user_id}"
    val = r.get(key)
    if val:
        text = val.decode() if isinstance(val, (bytes, bytearray)) else val
        print(f"[DEBUG] Alert for {user_id}: {text}")
        return {"msg": text}
    print(f"[DEBUG] No active alert for {user_id}")
    return {"msg": "No active alert"}
