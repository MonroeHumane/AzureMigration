#!/usr/bin/env python3
"""Fix Deposit 5820's TotalAmt: it shows $17,370.00 but its 27 lines sum to
$18,480.00 exactly, independently confirmed by a fully-itemized donor-level
export (HSMC_2026_Fully_Itemized_Check_Donors_In_QBO.csv) of the same 2026
charity auction deposit, with real donor names, matching amounts, and
matching auction line items. TotalAmt is the error, not the lines.
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

CORRECT_TOTAL = 18480.00


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

    r = session.get(f"{base}/deposit/5820", timeout=30)
    if r.status_code != 200:
        print("GET failed:", r.status_code, r.text[:300])
        return
    cur = r.json()["Deposit"]
    line_sum = round(sum(l.get("Amount", 0) for l in cur.get("Line", [])), 2)
    print("Current TotalAmt:", cur.get("TotalAmt"), "Line sum:", line_sum, "SyncToken:", cur["SyncToken"])
    if abs(line_sum - CORRECT_TOTAL) > 0.02:
        print("Line sum no longer matches expected -- state changed, STOPPING for re-verification.")
        return
    if cur.get("TotalAmt") == CORRECT_TOTAL:
        print("Already correct -- nothing to do.")
        return

    note = (cur.get("PrivateNote") or "") + (
        f" -- TotalAmt corrected from $17,370.00 to $18,480.00, 2026-09-11: matches this deposit's own "
        f"27 line items exactly, independently confirmed against the 2026 charity auction itemized "
        f"donor export. The stated total, not the lines, was the error."
    )
    payload = {
        "Id": "5820", "SyncToken": cur["SyncToken"], "sparse": True, "TotalAmt": CORRECT_TOTAL, "PrivateNote": note,
        "DepositToAccountRef": cur["DepositToAccountRef"],
    }
    print(f"{'[DRY RUN] ' if dry_run else ''}Proposed: TotalAmt $17,370.00 -> $18,480.00")
    if dry_run:
        return

    pr = session.post(f"{base}/deposit", json=payload, timeout=30)
    if pr.status_code != 200:
        print("WRITE FAILED:", pr.status_code, pr.text[:600])
        return
    updated = pr.json()["Deposit"]
    print("Result TotalAmt:", updated.get("TotalAmt"))
    print("OK" if updated.get("TotalAmt") == CORRECT_TOTAL else "MISMATCH -- investigate")


if __name__ == "__main__":
    main()
