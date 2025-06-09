import httpx
from neo4j_driver import get_session
import os
from dotenv import load_dotenv
from data.utils import wait_for_neo4j

load_dotenv()

url = os.getenv("CELESTRAK_URL")
constellation = os.getenv("CELESTRAK_CONSTELLATION", "All")

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

def import_celestrak():
    wait_for_neo4j()

    print(f"🌐 Fetching TLEs from Celestrak: {url}")
    try:
        response = httpx.get(url, follow_redirects=True)
        response.raise_for_status()
    except Exception as e:
        print(f"❌ Failed to fetch data: {e}")
        return

    satellites = parse_tle(response.text)
    print(f"📦 Parsed {len(satellites)} satellites from TLE")

    with get_session() as session:
        count = 0
        for sat in satellites:
            try:
                session.run(
                    """
                    MERGE (s:Satellite {name: $name})
                    SET s.tle1 = $tle1,
                        s.tle2 = $tle2,
                        s.source = "Celestrak",
                        s.constellation = $constellation,
                        s.manufacturer = "Unknown",
                        s.country_of_operator = "Unknown",
                        s.orbit_class = "Unknown"
                    """,
                    {
                        "name": sat["name"],
                        "tle1": sat["tle1"],
                        "tle2": sat["tle2"],
                        "constellation": constellation
                    }
                )
                count += 1
                if count % 500 == 0:
                    print(f"... Imported {count}")
            except Exception as e:
                print(f"⚠️ Skipped {sat['name']}: {e}")

        print(f"✅ Done importing {count} satellites from Celestrak")
