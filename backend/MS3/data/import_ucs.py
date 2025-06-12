import csv
from neo4j_driver import get_session
from data.utils import wait_for_neo4j

def import_ucs():
    wait_for_neo4j()
    print("Reading UCS CSV: ./data/ucs-satellites.csv")

    with open("./data/ucs-satellites.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"CSV Columns: {reader.fieldnames}")
    print(f"Parsed {len(rows)} UCS satellites")

    with get_session() as session:
        count = 0
        for row in rows:
            name         = row["Name of Satellite"]
            country      = row.get("Country of Operator/Owner", "")
            orbit        = row.get("Class of Orbit", "")
            manufacturer = row.get("Contractor", "")
            constellation = row.get("Purpose", "")
            lat = float(row.get("Latitude", 0) or 0)
            lon = float(row.get("Longitude", 0) or 0)
            alt = float(row.get("Altitude", 0) or 0)

            session.run(
                """
                MERGE (s:Satellite {name: $name})
                ON CREATE SET s.source = "UCS"
                SET
                  s.country_of_operator = $country,
                  s.orbit_class         = $orbit,
                  s.manufacturer        = $manufacturer,
                  s.constellation       = $constellation,
                  s.latitude            = $lat,
                  s.longitude           = $lon,
                  s.altitude            = $alt
                """,
                {
                    "name":         name,
                    "country":      country,
                    "orbit":        orbit,
                    "manufacturer": manufacturer,
                    "constellation": constellation,
                    "lat":          lat,
                    "lon":          lon,
                    "alt":          alt,
                }
            )

            count += 1
            if count % 100 == 0:
                print(f"... imported {count} UCS sats")

        print(f"Done importing {count} UCS satellites")
