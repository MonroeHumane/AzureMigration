#!/usr/bin/env python3
"""FINAL corrected fix. Full picture, reconstructed:
- Deposit 5820 (2026-04-22 charity auction, $18,480 raised) has a $1,110
  CashBack routed to the legacy 'Cash 1 (deleted)' account -- QBO refuses to
  edit the deposit itself since it references a deleted account.
- Purchase 7829 (2025-08-30... actually 2026-08-30) ALREADY zeroed that
  account out via QBO's own auto-deletion-cleanup, expensing the $1,110 to
  Opening Balance Equity. Confirmed: 'Cash 1 (deleted)' currently shows
  $0.00 -- it's already clean, touching it again would push it negative.
- What's actually still wrong: the $1,110 of real petty cash from the
  auction has never landed in the org's real 'Cash' account (currently
  $200.00) -- it's sitting in Opening Balance Equity instead.

This JE moves it to where it belongs: Debit 'Cash' $1,110 (petty cash
genuinely exists), Credit Opening Balance Equity $1,110 (cleans up more of
that catch-all account). Does not touch any deleted account.
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

OBE_ACCOUNT = "30"
REAL_CASH_ACCOUNT = "1150040020"  # Cash (petty cash)
AMOUNT = 1110.00

MEMO = (
    "Reclassification of $1,110.00 from Opening Balance Equity to the real petty-cash "
    "account, 2026-09-11. Traces to Deposit 5820 (2026-04-22 charity auction, $18,480 "
    "raised): $1,110 of that was taken as CashBack, routed to the legacy 'Cash 1 "
    "(deleted)' account, which QBO's own auto-cleanup (Purchase 7829) already zeroed "
    "out by expensing it to Opening Balance Equity. This entry moves that $1,110 from "
    "OBE to the org's real petty-cash account, where the money actually is."
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
                "JournalEntryLineDetail": {"PostingType": "Debit", "AccountRef": {"value": REAL_CASH_ACCOUNT}},
                "Description": "Real petty cash from 2026 auction CashBack -- see PrivateNote",
            },
            {
                "Amount": AMOUNT,
                "DetailType": "JournalEntryLineDetail",
                "JournalEntryLineDetail": {"PostingType": "Credit", "AccountRef": {"value": OBE_ACCOUNT}},
                "Description": "Reclass off Opening Balance Equity -- see PrivateNote",
            },
        ],
    }

    print(f"{'[DRY RUN] ' if dry_run else ''}New JournalEntry: Debit Cash (petty cash) ${AMOUNT:,.2f}, "
          f"Credit Opening Balance Equity ${AMOUNT:,.2f}")
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
