#!/usr/bin/env python3
"""Create the 4 real credit-card charges confirmed missing from QBO (verified
against the actual First Merchants/Elan statement, zero match at any
reconciliation tier). Category for each is evidence-based, not guessed --
derived from how QBO has categorized every other charge from the same real
vendor:
  Huff Veterinary Services   -> Primary Care & Wellness  (41/41 historical)
  Heritage Animal Hospital   -> Primary Care & Wellness  (41/41 historical)
  Step Screen Printing       -> Promotional Items        (2/2 historical)
  Amazon                     -> Animal Care Supplies     (208/209 historical)
Funding account: First Merchants Creditcard (141), PaymentType=CreditCard,
matching how every other 2026 card charge to these vendors is recorded.
"""
import os
import sqlite3
import sys

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"
CC_ACCOUNT_ID = "141"

CHARGES = [
    {
        "vendor_id": "2115", "vendor_name": "Huff Veterinary Services",
        "txn_date": "2026-07-22", "amount": 445.50, "category_id": "148", "category_name": "Primary Care & Wellness",
        "description": "HUFF VETERINARY SERVIC BOWLING GREEN OH (ref 3313, posted 2026-07-23)",
    },
    {
        "vendor_id": "2175", "vendor_name": "Step Screen Printing",
        "txn_date": "2026-05-29", "amount": 445.32, "category_id": "110", "category_name": "Promotional Items",
        "description": "PY *STEP.SCREEN PRINTI MONROE MI (ref 2615, posted 2026-06-01)",
    },
    {
        "vendor_id": "475", "vendor_name": "Amazon",
        "txn_date": "2026-07-16", "amount": 219.52, "category_id": "153", "category_name": "Animal Care Supplies",
        "description": "AMAZON MKTPL*9W1DO9E83 SEATTLE WA (ref 9658, posted 2026-07-17)",
    },
    {
        "vendor_id": "21", "vendor_name": "Heritage Animal Hospital",
        "txn_date": "2026-07-29", "amount": 110.40, "category_id": "148", "category_name": "Primary Care & Wellness",
        "description": "HERITAGE ANIMAL HOSPIT DUNDEE MI (ref 7944, posted 2026-07-31)",
    },
]


def get_access_token():
    conn = sqlite3.connect(TOKEN_MIRROR)
    row = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    access, refresh, realm = row
    client = AuthClient(
        client_id=os.environ["QB_CLIENT_ID"], client_secret=os.environ["QB_CLIENT_SECRET"],
        environment="production", redirect_uri=REDIRECT,
    )
    client.refresh(refresh_token=refresh)
    access, refresh = client.access_token, client.refresh_token
    conn.execute(
        "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
        (refresh, access, realm),
    )
    conn.commit()
    conn.close()
    return access, realm


def main():
    dry_run = "--live" not in sys.argv
    access, realm = get_access_token()
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {access}", "Accept": "application/json", "Content-Type": "application/json",
    })
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}"

    for c in CHARGES:
        payload = {
            "TxnDate": c["txn_date"],
            "AccountRef": {"value": CC_ACCOUNT_ID},
            "PaymentType": "CreditCard",
            "EntityRef": {"value": c["vendor_id"], "type": "Vendor"},
            "PrivateNote": f"Entered by audit recovery 2026-09-11: real card charge confirmed missing from QBO via statement reconciliation. {c['description']}",
            "Line": [
                {
                    "Amount": c["amount"],
                    "DetailType": "AccountBasedExpenseLineDetail",
                    "AccountBasedExpenseLineDetail": {"AccountRef": {"value": c["category_id"]}},
                    "Description": c["description"],
                }
            ],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}{c['vendor_name']} ${c['amount']:.2f} on {c['txn_date']} -> {c['category_name']}")
        if dry_run:
            continue
        r = session.post(f"{base}/purchase", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400])
            continue
        created = r.json()["Purchase"]
        print(f"  CREATED Purchase id={created['Id']} TotalAmt={created.get('TotalAmt')}")


if __name__ == "__main__":
    main()
