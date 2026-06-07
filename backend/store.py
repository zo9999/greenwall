import os
import requests

BASE = os.environ["INSFORGE_URL"].rstrip("/")
KEY = os.environ["INSFORGE_API_KEY"]
TABLE = f"{BASE}/api/database/records/games"
HEADERS = {"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}
WRITE = {**HEADERS, "Prefer": "return=representation"}
TIMEOUT = 10


def get_current():
    r = requests.get(f"{TABLE}?order=created_at.desc&limit=1", headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def save_state(game_id, state):
    r = requests.patch(f"{TABLE}?id=eq.{game_id}", headers=WRITE, json={"state": state}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()[0]


def new_game(state):
    requests.delete(f"{TABLE}?id=neq.00000000-0000-0000-0000-000000000000", headers=HEADERS, timeout=TIMEOUT)
    r = requests.post(TABLE, headers=WRITE, json=[{"state": state}], timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()[0]
