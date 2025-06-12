from fastapi import FastAPI
from routers import satellites
from fastapi.middleware.cors import CORSMiddleware
from data import import_ucs, import_celestrak, import_spacetrack
from neo4j_driver import get_session

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(satellites.router)

@app.get("/")
def root():
    return {"message": "Satellite Backend Running"}

@app.on_event("startup")
async def startup_event():
    print("Running data imports...")
    for fn in (
        import_ucs.import_ucs,
        import_celestrak.import_celestrak,
        import_spacetrack.import_spacetrack,
    ):
        try:
            fn()
            print(f"{fn.__name__} completed.")
        except Exception as e:
            print(f"{fn.__name__} failed: {e}")
    print("Data import phase done.")

    print("Creating Constellation hub nodes and HAS_SATELLITE edges...")
    with get_session() as session:
        session.run(
            """
            MATCH (s:Satellite)
            WHERE s.constellation IS NOT NULL AND s.constellation <> ""
            MERGE (c:Constellation {name: s.constellation})
            MERGE (c)-[:HAS_SATELLITE]->(s)
            """
        )
    print("Constellation hubs created.")