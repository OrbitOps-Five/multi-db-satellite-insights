# services/reentry.py

import requests
import os
from datetime import datetime, timedelta
from requests.exceptions import RequestException

def fetch_recent_reentries(limit=10):
    base_url = "https://www.space-track.org"
    login_url = f"{base_url}/ajaxauth/login"
    data_url = f"{base_url}/basicspacedata/query/class/decay/orderby/DECAY%20desc/limit/{limit}/format/json"

    username = os.getenv("SPACETRACK_USER")
    password = os.getenv("SPACETRACK_PASS")

    if not username or not password:
        raise EnvironmentError("SPACETRACK_USER or SPACETRACK_PASS not set in environment variables.")

    try:
        session = requests.Session()
        login_resp = session.post(login_url, data={"identity": username, "password": password})

        if login_resp.status_code != 200:
            raise ConnectionError(f"Login failed: {login_resp.status_code} - {login_resp.text}")

        reentry_resp = session.get(data_url)
        reentry_resp.raise_for_status()
        data = reentry_resp.json()

        formatted = [
            {
                "name": item.get("OBJECT_NAME"),
                "id": item.get("NORAD_CAT_ID"),
                "decay_date": item.get("DECAY"),
                "launch_date": item.get("LAUNCH"),
                "site": item.get("SITE"),
                "decayed": True
            }
            for item in data
        ]
        return formatted

    except RequestException as e:
        print(f"[ERROR] Request failed: {e}")
        return []
    except Exception as ex:
        print(f"[ERROR] Unexpected error: {ex}")
        return []

# ✅ Wrapper function for app.py import
def get_decay_data():
    return fetch_recent_reentries()
