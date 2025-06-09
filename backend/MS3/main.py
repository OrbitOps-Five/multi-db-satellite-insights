from fastapi import FastAPI
from routers import satellites
from fastapi.middleware.cors import CORSMiddleware
from data import import_ucs, import_celestrak, import_spacetrack

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
    print("🚀 Running data imports...")
    try:
        import_ucs.import_ucs()
        import_celestrak.import_celestrak()
        import_spacetrack.import_spacetrack()
        print("✅ All import scripts completed.")
    except Exception as e:
        print(f"❌ Error during import startup: {e}")
