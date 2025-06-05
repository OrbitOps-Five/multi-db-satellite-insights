import pandas as pd
from neo4j_driver import get_session

UCS_CSV_PATH = "./data/ucs-satellites.csv"

def import_ucs():
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

                session.run(
                    """
                    MERGE (s:Satellite {name: $name})
                    SET s.country = $country,
                        s.purpose = $purpose,
                        s.contractor = $contractor,
                        s.orbit_class = $orbit,
                        s.source = "UCS"
                    """,
                    {
                        "name": str(name).strip(),
                        "country": str(row.get("Country of Operator/Owner", "")).strip(),
                        "purpose": str(row.get("Users", "")).strip(),
                        "contractor": str(row.get("Contractor", "")).strip(),
                        "orbit": str(row.get("Class of Orbit", "")).strip()
                    }
                )
                count += 1
            except Exception as e:
                print(f"⚠️ Skipped row: {e}")

        print(f"✅ Done importing {count} UCS satellites")
