from skyfield.api import load, wgs84, utc
from datetime import datetime, timedelta
from db.redis_client import r


def compute_iss_pass(lat, lon):
    tle_url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle'
    satellites = load.tle_file(tle_url)
    print(f"[DEBUG] Loaded {len(satellites)} satellites")

    satellite = next((sat for sat in satellites if 'ISS' in sat.name or sat.model.satnum == 25544), None)
    print(f"[DEBUG] satellite type: {type(satellite)}")
    if satellite is None:
        raise ValueError("ISS not found in TLE data")

    ts = load.timescale()
    observer = wgs84.latlon(latitude_degrees=lat, longitude_degrees=lon)
    t0 = ts.now()
    t1 = ts.utc((datetime.utcnow() + timedelta(hours=24)).replace(tzinfo=utc))

    times, events, altitudes = satellite.find_events(observer, t0, t1, altitude_degrees=30.0)

    for ti, event, alt in zip(times, events, altitudes):
        print(f"[DEBUG] Event: type={event}, time={ti.utc_datetime()}, alt={alt}")
        if event == 0:  # Rise
            return ti.utc_datetime()

    return None

def schedule_alert(user_id, lat, lon):
    alert_time = compute_iss_pass(lat, lon)
    if alert_time:
        ttl = int((alert_time - datetime.utcnow()).total_seconds())
        if ttl > 0:
            alert_msg = f"ISS visible at {alert_time.strftime('%H:%M')} from your location"
            r.setex(f"alert:{user_id}", ttl, alert_msg)
            return {"msg": "Alert set", "at": alert_time.strftime('%Y-%m-%d %H:%M')}
    return {"msg": "No pass in next 24h"}
