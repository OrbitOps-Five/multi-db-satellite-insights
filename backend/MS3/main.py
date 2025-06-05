from fastapi import FastAPI
from routers import satellites

from data import import_ucs, import_celestrak, import_spacetrack

app = FastAPI()
app.include_router(satellites.router)

@app.get("/")
def root():
    return {"message": "Satellite Backend Running"}

@app.on_event("startup")
async def startup_event():
    print("🚀 Running data imports...")
    try:
        import_ucs.import_ucs()
        import_celestrak.import_celestrak()
        import_spacetrack.import_spacetrack()
        print("✅ All import scripts completed.")
    except Exception as e:
        print(f"❌ Error during import startup: {e}")
