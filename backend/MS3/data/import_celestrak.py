import os
import httpx
from skyfield.api import EarthSatellite, load
from neo4j_driver import get_session
from data.utils import wait_for_neo4j

# Prepare Skyfield
ts  = load.timescale()
now = ts.now()

def parse_tle(text: str):
    """
    Split raw TLE text into 3-line records.
    Returns a list of dicts or raises ValueError if the split is invalid.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    if len(lines) % 3 != 0:
        raise ValueError(f"TLE count ({len(lines)}) not multiple of 3")
    sats = []
    for i in range(0, len(lines), 3):
        sats.append({"name": lines[i], "tle1": lines[i+1], "tle2": lines[i+2]})
    return sats

def import_celestrak():
    # Wait for Neo4j
    wait_for_neo4j()

    # Read and normalize constellation names
    raw_consts = os.getenv("CELESTRAK_CONSTELLATIONS", "")
    constellations = []
    for c in raw_consts.split(","):
        c = c.strip().upper()
        if not c:
            continue
        # map common alias → actual group name
        if c == "GPS":
            c = "GPS-OPS"
        constellations.append(c)

    # Build URLs
    urls = [
        f"https://celestrak.org/NORAD/elements/gp.php?GROUP={c}&FORMAT=TLE"
        for c in constellations
    ]

    for constellation, url in zip(constellations, urls):
        print(f"Fetching TLEs for {constellation}: {url}")
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=30.0)
            resp.raise_for_status()
        except Exception as e:
            print(f"  → HTTP error for {constellation}: {e}")
            continue

        try:
            sats = parse_tle(resp.text)
        except ValueError as e:
            print(f"  → TLE parse error for {constellation}: {e}")
            continue

        print(f"  → Parsed {len(sats)} {constellation} sats")
        # Import into Neo4j
        with get_session() as session:
            count = 0
            for sat in sats:
                try:
                    manuf = 'SpaceX' if constellation.upper() == 'STARLINK' else None
                    sf_sat = EarthSatellite(sat["tle1"], sat["tle2"], sat["name"], ts)
                    geo    = sf_sat.at(now).subpoint()
                    lat, lon, alt = geo.latitude.degrees, geo.longitude.degrees, geo.elevation.m

                    session.run(
                        """
                        MERGE (s:Satellite {name: $name})
                        ON CREATE SET s.source = "Celestrak"
                        SET
                          s.constellation      = $constellation,
                          s.tle1               = $tle1,
                          s.tle2               = $tle2,
                          s.manufacturer       = $manuf,
                          s.latitude           = $lat,
                          s.longitude          = $lon,
                          s.altitude           = $alt
                        """,
                        {
                            "name":         sat["name"],
                            "tle1":         sat["tle1"],
                            "tle2":         sat["tle2"],
                            "lat":          lat,
                            "lon":          lon,
                            "alt":          alt,
                            "constellation": constellation,
                            "manuf":         manuf
                        }
                    )
                    count += 1
                    if count % 500 == 0:
                        print(f"    … imported {count} sats")
                except Exception as e:
                    print(f"    ✗ skipped {sat['name']}: {e}")
            print(f"Done importing {count} {constellation} sats\n")
