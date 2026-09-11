#!/usr/bin/env python3
"""Move the $1,110.00 CashBack effect off 'Cash 1 (deleted)' onto the real
petty-cash account ('Cash', id 1150040020) via a new correcting JournalEntry,
since QBO refuses any edit to Deposit 5820 itself (its CashBack currently
references a deleted account, and QBO blocks edits to transactions touching
deleted accounts, same limitation hit earlier with Purchase 4428/4429).
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

DELETED_ACCOUNT = "1150040035"  # Cash 1 (deleted)
REAL_CASH_ACCOUNT = "1150040020"  # Cash (petty cash)
AMOUNT = 1110.00

MEMO = (
    "Reclassification of Deposit 5820's CashBack effect from the deleted 'Cash 1' "
    "account to the real petty-cash account, 2026-09-11. Deposit 5820 (2026-04-22 "
    "charity auction proceeds) has a $1,110.00 CashBack routed to 'Cash 1 (deleted)'; "
    "QBO refuses to edit that field directly since the deposit references a deleted "
    "account (same limitation as the Purchase 4428/4429 OBE fix). This entry moves "
    "the $1,110.00 to where it actually belongs without touching the original deposit."
)


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

    payload = {
        "TxnDate": "2026-09-11",
        "PrivateNote": MEMO,
        "Line": [
            {
                "Amount": AMOUNT,
                "DetailType": "JournalEntryLineDetail",
                "JournalEntryLineDetail": {"PostingType": "Credit", "AccountRef": {"value": DELETED_ACCOUNT}},
                "Description": "Remove phantom CashBack balance from deleted account",
            },
            {
                "Amount": AMOUNT,
                "DetailType": "JournalEntryLineDetail",
                "JournalEntryLineDetail": {"PostingType": "Debit", "AccountRef": {"value": REAL_CASH_ACCOUNT}},
                "Description": "Move to real petty-cash account",
            },
        ],
    }

    print(f"{'[DRY RUN] ' if dry_run else ''}New JournalEntry: Credit 'Cash 1 (deleted)' ${AMOUNT:,.2f}, "
          f"Debit 'Cash' ${AMOUNT:,.2f}")
    if dry_run:
        return

    r = session.post(f"{base}/journalentry", json=payload, timeout=30)
    if r.status_code != 200:
        print("WRITE FAILED:", r.status_code, r.text[:600])
        return
    created = r.json()["JournalEntry"]
    print(f"CREATED JournalEntry id={created['Id']}")
    for line in created.get("Line", []):
        det = line.get("JournalEntryLineDetail", {})
        print(" ", det.get("PostingType"), line.get("Amount"), det.get("AccountRef", {}).get("name"))


if __name__ == "__main__":
    main()
