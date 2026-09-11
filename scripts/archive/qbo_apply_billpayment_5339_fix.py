#!/usr/bin/env python3
"""Fix BillPayment 5339's TotalAmt: it shows $66.80 but its single line (applied
to Bill 5331) is $62.50, and the real First Merchants bank statement confirms
check #4375 cleared for exactly $62.50 on 2026-02-05. TotalAmt is the error.
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

    r = session.get(f"{base}/billpayment/5339", timeout=30)
    if r.status_code != 200:
        print("GET failed:", r.status_code, r.text[:300])
        return
    cur = r.json()["BillPayment"]
    print("Current TotalAmt:", cur.get("TotalAmt"), "SyncToken:", cur["SyncToken"])
    line_sum = sum(l.get("Amount", 0) for l in cur.get("Line", []))
    print("Line sum:", line_sum)
    if cur.get("TotalAmt") != 66.8:
        print("State has changed since audit pull -- STOPPING, re-verify before proceeding.")
        return

    payload = {
        "Id": "5339", "SyncToken": cur["SyncToken"], "sparse": True,
        "TotalAmt": 62.5, "PayType": cur["PayType"],
    }
    print(f"{'[DRY RUN] ' if dry_run else ''}Proposed: TotalAmt 66.80 -> 62.50")
    if dry_run:
        return

    pr = session.post(f"{base}/billpayment", json=payload, timeout=30)
    if pr.status_code != 200:
        print("WRITE FAILED:", pr.status_code, pr.text[:500])
        return
    updated = pr.json()["BillPayment"]
    print("Result TotalAmt:", updated.get("TotalAmt"))
    print("OK" if updated.get("TotalAmt") == 62.5 else "MISMATCH -- investigate")


if __name__ == "__main__":
    main()
