import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
import logging
import os

def fetch_recent_reentries():
    url = "https://celestrak.org/satcat/decayed-with-last.php"
    response = requests.get(url)
    html = response.text

    # Save for debug
    with open("debug_celestrak.html", "w", encoding="utf-8") as f:
        f.write(html)

    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("table", {"id": "tableID"})

    if not table:
        logging.debug("Decay table not found.")
        return []

    rows = table.find("tbody").find_all("tr")
    satellites = []

    for row in rows:
        cols = row.find_all("td")
        if len(cols) < 8:
            continue  # Skip malformed row

        satellite = {
            "intl_designator": cols[0].text.strip(),
            "norad_cat_id": cols[1].text.strip(),
            "name": cols[2].text.strip(),
            "source": cols[3].text.strip(),
            "launch_date": cols[4].text.strip(),
            "launch_site": cols[5].text.strip(),
            "decay_date": cols[6].text.strip(),
            "last_data": cols[7].text.strip().split(" ")[0]  # Strip any extra icon text
        }

        satellites.append(satellite)

    logging.debug(f"Parsed {len(satellites)} decayed satellites.")
    return satellites

def get_decay_data():
    logging.basicConfig(level=logging.DEBUG)
    data = fetch_recent_reentries()
    
    if not data:
        logging.debug("[MongoDB] No data to insert.")
        return []

    client = MongoClient(os.getenv("MONGO_URI", "mongodb://mongo:27017/"))
    db = client["satellite_db"]
    collection = db["decay_data"]

    collection.delete_many({})
    collection.insert_many(data)
    logging.debug(f"[MongoDB] Inserted {len(data)} entries.")
    return data
