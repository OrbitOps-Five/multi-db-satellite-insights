import httpx
from neo4j_driver import get_session
import os
from dotenv import load_dotenv
from data.utils import wait_for_neo4j
from skyfield.api import EarthSatellite, load

load_dotenv()

USERNAME = os.getenv("SPACETRACK_USERNAME")
PASSWORD = os.getenv("SPACETRACK_PASSWORD")
CONSTELLATION = os.getenv("SPACETRACK_CONSTELLATION", "Space-Track")
LOGIN_URL = "https://www.space-track.org/ajaxauth/login"
TLE_URL = "https://www.space-track.org/basicspacedata/query/class/tle_latest/format/tle/limit/100"

def parse_tle(text):
    lines = text.strip().split("\n")
    sats = []
    for i in range(0, len(lines), 3):
        if i + 2 < len(lines):
            sats.append({
                "name": lines[i].strip(),
                "tle1": lines[i + 1].strip(),
                "tle2": lines[i + 2].strip()
            })
    return sats

def import_spacetrack():
    wait_for_neo4j()
    print(f"Logging in to Space-Track as {USERNAME}")
    with httpx.Client(follow_redirects=True, timeout=30.0) as client:
        client.post(LOGIN_URL, data={"identity": USERNAME, "password": PASSWORD})
        resp = client.get(TLE_URL)
        resp.raise_for_status()
        satellites = parse_tle(resp.text)

    print(f"Parsed {len(satellites)} TLEs for {CONSTELLATION}")

    ts  = load.timescale()
    now = ts.now()

    with get_session() as session:
        count = 0
        for sat in satellites:
            try:
                sf_sat = EarthSatellite(sat["tle1"], sat["tle2"], sat["name"], ts)
                geo    = sf_sat.at(now).subpoint()
                lat, lon, alt = geo.latitude.degrees, geo.longitude.degrees, geo.elevation.m

                session.run(
                    """
                    MERGE (s:Satellite {name: $name})
                    ON CREATE SET s.source = "Space-Track"
                    SET
                      s.constellation = $constellation,
                      s.tle1          = $tle1,
                      s.tle2          = $tle2,
                      s.latitude      = $lat,
                      s.longitude     = $lon,
                      s.altitude      = $alt
                    """,
                    {
                        "name":          sat["name"],
                        "tle1":          sat["tle1"],
                        "tle2":          sat["tle2"],
                        "lat":           lat,
                        "lon":           lon,
                        "alt":           alt,
                        "constellation": CONSTELLATION,
                    }
                )

                count += 1
                if count % 50 == 0:
                    print(f"... imported {count} {CONSTELLATION} sats")

            except Exception as e:
                print(f"Skipped {sat['name']}: {e}")

        print(f"Done importing {count} {CONSTELLATION} satellites")

# def import_spacetrack():
#     wait_for_neo4j()
#     tle_data = fetch_latest_spacetrack_tles()
#     sats = parse_tle(tle_data)
#     print(f"Parsed {len(sats)} satellites from Space-Track")

#     session = get_session()
#     count = 0
#     for sat in sats:
#         name, tle1, tle2 = sat["name"], sat["tle1"], sat["tle2"]
#         try:
#             ts = load.timescale()
#             satrec = EarthSatellite(tle1, tle2, name, ts)
#             t = ts.now()
#             geocentric = satrec.at(t)
#             lat, lon = geocentric.subpoint().latitude.degrees, geocentric.subpoint().longitude.degrees
#             alt = geocentric.subpoint().elevation.m
#         except Exception as e:
#             print(f"Position calc failed for {name}: {e}")
#             continue

        # session.run(
        #     """
        #     MERGE (s:Satellite {name: $name})
        #     SET s.tle1               = $tle1,
        #         s.tle2               = $tle2,
        #         s.source             = "Space-Track",
        #         s.latitude           = $lat,
        #         s.longitude          = $lon,
        #         s.altitude           = $alt,
        #         s.country_of_operator= "Unknown"  // ensure the key exists
        #     """,
        #     {
        #         "name": name,
        #         "tle1": tle1,
        #         "tle2": tle2,
        #         "lat": lat,
        #         "lon": lon,
        #         "alt": alt
        #     }
        # )

    #     session.run(
    #             """
    #             MERGE (s:Satellite {name: $name})
    #             ON CREATE SET s.source = "Celestrak"
    #             SET
    #               s.tle1               = $tle1,
    #               s.tle2               = $tle2,
    #               s.latitude           = $lat,
    #               s.longitude          = $lon,
    #               s.altitude           = $alt,
    #               s.constellation      = $constellation,
    #               s.manufacturer       = coalesce(s.manufacturer, ""),
    #               s.country_of_operator = coalesce(s.country_of_operator, ""),
    #               s.orbit_class = "Unknown"
    #             """,
    #             {
    #                 "name": sat["name"],
    #                 "tle1": sat["tle1"],
    #                 "tle2": sat["tle2"],
    #                 "lat": lat,
    #                 "lon": lon,
    #                 "alt": alt,
    #                 "constellation": CONSTELLATION
    #             }
    #         )

    #     count += 1
    #     if count % 50 == 0:
    #         print(f"... Imported {count}")

    # print(f"Done importing {count} satellites from Space-Track")
