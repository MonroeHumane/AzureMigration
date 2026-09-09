"""Verify live QBO Deposit 7952. Never print tokens."""
import os
import sqlite3
import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
MIRROR = r"E:\qbbackup\qbo_mirror.db"
DEPOSIT_ID = "7952"

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

url = f"https://quickbooks.api.intuit.com/v3/company/{realm}/deposit/{DEPOSIT_ID}"
r = requests.get(
    url,
    headers={"Authorization": f"Bearer {client.access_token}", "Accept": "application/json"},
    timeout=45,
)
r.raise_for_status()
d = r.json()["Deposit"]
print("Id", d["Id"], "Date", d.get("TxnDate"), "Total", d.get("TotalAmt"), "Bank", (d.get("DepositToAccountRef") or {}).get("name"))
print("Note", (d.get("PrivateNote") or "")[:180])
total = 0
for ln in d.get("Line") or []:
    det = ln.get("DepositLineDetail") or {}
    amt = float(ln.get("Amount") or 0)
    total += amt
    ent = det.get("Entity") or {}
    print(
        f"  {ln.get('Id')} {amt:>8.2f} #{det.get('CheckNum') or '-'} "
        f"{ent.get('type')} {ent.get('name')} | {(det.get('AccountRef') or {}).get('name')} | "
        f"{(det.get('PaymentMethodRef') or {}).get('name')} | {ln.get('Description') or ''}"
    )
print("line sum", round(total, 2), "n", len(d.get("Line") or []))
