"""Verify recoded live QBO lines. Never print tokens."""
import json
import os
import sqlite3

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
MIRROR = r"E:\qbbackup\qbo_mirror.db"

conn = sqlite3.connect(MIRROR)
access, refresh, realm = conn.execute(
    "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
).fetchone()
client = AuthClient(
    client_id=os.environ["QB_CLIENT_ID"],
    client_secret=os.environ["QB_CLIENT_SECRET"],
    environment="production",
    redirect_uri="https://monroe-humane.org/callback",
)
client.refresh(refresh_token=refresh)
conn.execute(
    "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
    (client.refresh_token, client.access_token, realm),
)
conn.commit()
conn.close()
headers = {"Authorization": f"Bearer {client.access_token}", "Accept": "application/json"}
base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/"

checks = [
    ("deposit", "3026", 7981.0, "56"),
    ("deposit", "3524", 11102.96, "56"),
    ("deposit", "5319", 12555.48, "56"),
    ("deposit", "5920", 7429.1, "56"),
    ("deposit", "6513", 8479.38, "56"),
    ("deposit", "4274", 948.61, "1150040043"),
    ("deposit", "5497", 901.99, "1150040043"),
    ("deposit", "5846", 3245.0, "143"),
    ("deposit", "5100", 375.14, "143"),
    ("deposit", "6757", 2929.0, "143"),
    ("purchase", "3455", 482.0, "1150040018"),
    ("purchase", "6742", 482.0, "1150040018"),
    ("purchase", "6019", 72.98, "72"),
    ("purchase", "1435", 30.0, "68"),
]

ok = 0
for kind, pid, amt, expect in checks:
    r = requests.get(f"{base}{kind}/{pid}", headers=headers, timeout=45)
    r.raise_for_status()
    obj = r.json()[kind.capitalize() if kind != "deposit" else "Deposit"]
    if kind == "purchase":
        obj = r.json()["Purchase"]
    hits = []
    for ln in obj.get("Line") or []:
        if abs(float(ln.get("Amount") or 0) - amt) > 0.02:
            continue
        det = ln.get("DepositLineDetail") or ln.get("AccountBasedExpenseLineDetail") or {}
        ref = det.get("AccountRef") or {}
        hits.append((ln.get("Id"), ref.get("value"), ref.get("name")))
    good = any(h[1] == expect for h in hits)
    print(("OK  " if good else "BAD "), kind, pid, amt, hits)
    if good:
        ok += 1
print(f"{ok}/{len(checks)} verified")
