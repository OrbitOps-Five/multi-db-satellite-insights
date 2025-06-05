import time
from neo4j.exceptions import ServiceUnavailable
from neo4j_driver import get_session

MAX_RETRIES = 10

def wait_for_neo4j():
    for attempt in range(MAX_RETRIES):
        try:
            with get_session() as session:
                session.run("RETURN 1")
                print("✅ Connected to Neo4j")
                return
        except ServiceUnavailable as e:
            print(f"🔁 Waiting for Neo4j... attempt {attempt + 1}")
            time.sleep(2)
    raise RuntimeError("❌ Neo4j not available after retries")
