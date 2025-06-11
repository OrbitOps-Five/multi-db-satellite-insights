from pymongo import MongoClient

# Connect to the same Mongo URI your app uses
client = MongoClient("mongodb://localhost:27017/")
db = client["satellite_db"]

# Print info to verify
print("✅ Connected to DB:", db.name)
print("📦 Collections found:", db.list_collection_names())

# Check if decay_data exists and has documents
if "decay_data" in db.list_collection_names():
    count = db["decay_data"].count_documents({})
    print(f"📊 'decay_data' contains {count} documents.")
    for doc in db["decay_data"].find().limit(3):
        print("🛰️", doc)
else:
    print("❌ 'decay_data' collection not found.")
