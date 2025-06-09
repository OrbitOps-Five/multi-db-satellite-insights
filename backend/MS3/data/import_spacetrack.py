import httpx
from neo4j_driver import get_session
import os
from dotenv import load_dotenv
from data.utils import wait_for_neo4j

load_dotenv()

USERNAME = os.getenv("SPACETRACK_USERNAME")
PASSWORD = os.getenv("SPACETRACK_PASSWORD")

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

    print("🔐 Logging into Space-Track...")
    with httpx.Client() as client:
        try:
            login = client.post(LOGIN_URL, data={"identity": USERNAME, "password": PASSWORD})
            login.raise_for_status()
        except Exception as e:
            print(f"❌ Login failed: {e}")
            return

        print("🌐 Fetching latest TLEs from Space-Track...")
        try:
            response = client.get(TLE_URL)
            response.raise_for_status()
        except Exception as e:
            print(f"❌ Failed to fetch TLE data: {e}")
            return

        satellites = parse_tle(response.text)
        print(f"📦 Parsed {len(satellites)} satellites")

        with get_session() as session:
            count = 0
            for sat in satellites:
                try:
                    session.run(
                        """
                        MERGE (s:Satellite {name: $name})
                        SET s.tle1 = $tle1,
                            s.tle2 = $tle2,
                            s.source = "SpaceTrack",
                            s.constellation = "Unknown",
                            s.manufacturer = "Unknown",
                            s.country_of_operator = "Unknown",
                            s.orbit_class = "Unknown"
                        """,
                        {
                            "name": sat["name"],
                            "tle1": sat["tle1"],
                            "tle2": sat["tle2"]
                        }
                    )
                    count += 1
                    if count % 50 == 0:
                        print(f"... Imported {count}")
                except Exception as e:
                    print(f"⚠️ Skipped {sat['name']}: {e}")

            print(f"✅ Done importing {count} satellites from Space-Track")
