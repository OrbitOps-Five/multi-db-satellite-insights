# services/launch_history.py

import requests
from datetime import datetime

def fetch_launch_library_data():
    url = "https://ll.thespacedevs.com/2.2.0/launch/?limit=50&ordering=-net"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json().get("results", [])
    except Exception as e:
        print(f"[LaunchLibrary2] Error: {e}")
        return []

def fetch_spacex_data():
    url = "https://api.spacexdata.com/v4/launches"
    try:
        response = requests.get(url)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[SpaceX] Error: {e}")
        return []

def normalize_launch_library_data(data):
    normalized = []
    for launch in data:
        normalized.append({
            "provider": launch.get("launch_service_provider", {}).get("name", "Unknown"),
            "mission": launch.get("name", "N/A"),
            "rocket": launch.get("rocket", {}).get("configuration", {}).get("name", "Unknown"),
            "date": launch.get("net", "N/A"),
            "success": launch.get("status", {}).get("name", "").lower() == "launch successful"
        })
    return normalized

def normalize_spacex_data(data):
    normalized = []
    for launch in data:
        normalized.append({
            "provider": "SpaceX",
            "mission": launch.get("name", "N/A"),
            "rocket": launch.get("rocket", "Unknown"),  # Can resolve ID via another endpoint
            "date": launch.get("date_utc", "N/A"),
            "success": launch.get("success", False)
        })
    return normalized

# ✅ Alias for consistency with app.py
def get_combined_launch_history():
    ll_data = normalize_launch_library_data(fetch_launch_library_data())
    spacex_data = normalize_spacex_data(fetch_spacex_data())
    all_data = ll_data + spacex_data
    all_data.sort(key=lambda x: x.get("date", ""), reverse=True)
    return all_data
