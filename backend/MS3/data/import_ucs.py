import pandas as pd
from neo4j_driver import get_session
from data.utils import wait_for_neo4j

UCS_CSV_PATH = "./data/ucs-satellites.csv"

def import_ucs():
    wait_for_neo4j()

    print(f"📄 Reading UCS CSV: {UCS_CSV_PATH}")
    df = pd.read_csv(UCS_CSV_PATH)
    df.columns = df.columns.str.strip()

    print("📋 CSV Columns:", df.columns.tolist())

    with get_session() as session:
        count = 0
        for _, row in df.iterrows():
            try:
                name = row.get("Name of Satellite")
                if pd.isna(name) or not str(name).strip():
                    continue

                constellation = row.get("Purpose", "").strip() or "Unknown"
                manufacturer = row.get("Contractor", "").strip() or "Unknown"
                country = row.get("Country of Operator/Owner", "").strip() or "Unknown"
                orbit = row.get("Class of Orbit", "").strip() or "Unknown"

                session.run(
                    """
                    MERGE (s:Satellite {name: $name})
                    SET s.constellation = $constellation,
                        s.manufacturer = $manufacturer,
                        s.country_of_operator = $country,
                        s.orbit_class = $orbit,
                        s.source = "UCS"
                    """,
                    {
                        "name": str(name).strip(),
                        "country": country,
                        "manufacturer": manufacturer,
                        "orbit": orbit,
                        "constellation": constellation
                    }
                )
                count += 1
            except Exception as e:
                print(f"⚠️ Skipped row: {e}")

        print(f"✅ Done importing {count} UCS satellites")
