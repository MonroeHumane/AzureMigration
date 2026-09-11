#!/usr/bin/env python3
"""Apply the 20 high-confidence check-number backfills to live QBO.

Each of these Purchase records is marked PaymentType=Check with a real payee
and amount but a blank DocNumber. Every one here was matched against exactly
one real First Merchants bank statement "Check #NNNN" line at that amount,
within a date window, with that check number not already used by any other
Purchase in QBO. Read-only verification happened separately (see the audit
db) -- this script performs the actual write, one at a time, with a fresh
GET-then-sparse-update-then-verify cycle per transaction so a stale
SyncToken never causes a silent conflict.
"""
import os
import sqlite3
import sys
import time

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"

BACKFILL = [
    ("2260", "4176"), ("7625", "4386"), ("7626", "4394"), ("7627", "4409"),
    ("7628", "4412"), ("7629", "4413"), ("7630", "4416"), ("7631", "4415"),
    ("7632", "4422"), ("7633", "4424"), ("7634", "4427"), ("7635", "4426"),
    ("7636", "4425"), ("7638", "4432"), ("7639", "4431"), ("7640", "4433"),
    ("7641", "4436"), ("7642", "4437"), ("7645", "4435"), ("7646", "4446"),
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
        "Authorization": f"Bearer {access}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}"

    results = []
    for purchase_id, check_num in BACKFILL:
        r = session.get(f"{base}/purchase/{purchase_id}", timeout=30)
        if r.status_code != 200:
            print(f"  SKIP {purchase_id}: GET failed {r.status_code} {r.text[:200]}")
            results.append((purchase_id, check_num, "GET_FAILED"))
            continue
        cur = r.json()["Purchase"]
        current_doc = cur.get("DocNumber")
        sync_token = cur["SyncToken"]
        if current_doc:
            print(f"  SKIP {purchase_id}: already has DocNumber={current_doc!r} (changed since audit pull)")
            results.append((purchase_id, check_num, f"ALREADY_SET:{current_doc}"))
            continue

        payload = {
            "Id": purchase_id, "SyncToken": sync_token, "sparse": True,
            "DocNumber": check_num, "PaymentType": cur["PaymentType"],
        }
        print(f"  {'[DRY RUN] ' if dry_run else ''}Purchase {purchase_id}: set DocNumber -> {check_num!r} (SyncToken {sync_token})")
        if dry_run:
            results.append((purchase_id, check_num, "DRY_RUN"))
            continue

        pr = session.post(f"{base}/purchase", json=payload, timeout=30)
        if pr.status_code != 200:
            print(f"    WRITE FAILED: {pr.status_code} {pr.text[:300]}")
            results.append((purchase_id, check_num, f"WRITE_FAILED:{pr.status_code}"))
            continue
        updated = pr.json()["Purchase"]
        ok = updated.get("DocNumber") == check_num
        print(f"    {'OK' if ok else 'MISMATCH'}: DocNumber now {updated.get('DocNumber')!r}")
        results.append((purchase_id, check_num, "APPLIED" if ok else "MISMATCH"))
        time.sleep(0.3)

    print("\n--- Summary ---")
    for purchase_id, check_num, status in results:
        print(f"  {purchase_id} -> {check_num}: {status}")
    n_applied = sum(1 for _, _, s in results if s == "APPLIED")
    print(f"\n{n_applied} / {len(BACKFILL)} applied successfully.")


if __name__ == "__main__":
    main()
