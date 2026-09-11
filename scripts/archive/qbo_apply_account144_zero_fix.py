#!/usr/bin/env python3
"""Zero out account 144 ('First Merchant Bank', a QuickBooks Workforce
payroll-clearing artifact, not a real bank account) by reclassing its
-$6,373.40 balance against the real operating account 111 ('First Merchants
Bank'), instead of writing it off to Opening Balance Equity like the prior
cleanup (JournalEntry 6972) did.

Root cause: 3 real payroll/tax transactions (checks 4473/4474, one IRS tax
withdrawal, pay period 08/23-09/05/2026) posted only to account 144 --
confirmed absent from account 111 for the same dates via a direct GL pull.
Since 144 isn't a real bank account, the actual cash left account 111; QBO
just never recorded it there. This entry corrects both sides at once: zeroes
144, and brings 111's book balance down to match the real cash outflow that
already happened.
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

DUP_ACCOUNT = "144"   # First Merchant Bank (payroll-clearing artifact)
REAL_ACCOUNT = "111"  # First Merchants Bank (real operating account)
AMOUNT = 6373.40

MEMO = (
    "Zero out account 144 ('First Merchant Bank', a QuickBooks Workforce "
    "payroll-clearing duplicate, not a real bank account), 2026-09-11. Three "
    "real payroll/tax transactions for pay period 08/23-09/05/2026 (checks "
    "4473 and 4474, one IRS tax withdrawal) posted only to this account -- "
    "confirmed absent from the real operating account 111 for the same dates. "
    "Since 144 has no real-world bank equivalent, this reclass corrects both "
    "sides: zeroes 144, and reduces 111's book balance by the same amount to "
    "reflect the real cash outflow that already happened but was never "
    "recorded against the real account. Does not write to Opening Balance "
    "Equity -- the prior cleanup (JournalEntry 6972) did that and just wrote "
    "off the drift instead of fixing where it landed. The underlying "
    "QuickBooks Workforce funding-account setting still needs to be re-"
    "checked separately; this entry only cleans up the past."
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

    for acct_id, label in [(DUP_ACCOUNT, "144 (dup)"), (REAL_ACCOUNT, "111 (real)")]:
        r = session.get(f"{base}/account/{acct_id}", timeout=30)
        a = r.json()["Account"]
        print(f"  Current: account {label} balance = {a.get('CurrentBalance')}")

    payload = {
        "TxnDate": "2026-09-11",
        "PrivateNote": MEMO,
        "Line": [
            {
                "Amount": AMOUNT,
                "DetailType": "JournalEntryLineDetail",
                "JournalEntryLineDetail": {"PostingType": "Debit", "AccountRef": {"value": DUP_ACCOUNT}},
                "Description": "Zero out payroll-clearing duplicate account -- see PrivateNote",
            },
            {
                "Amount": AMOUNT,
                "DetailType": "JournalEntryLineDetail",
                "JournalEntryLineDetail": {"PostingType": "Credit", "AccountRef": {"value": REAL_ACCOUNT}},
                "Description": "Reflect real payroll/tax cash outflow never recorded here -- see PrivateNote",
            },
        ],
    }

    print(f"\n{'[DRY RUN] ' if dry_run else ''}New JournalEntry: Debit 'First Merchant Bank' (144) ${AMOUNT:,.2f}, "
          f"Credit 'First Merchants Bank' (111) ${AMOUNT:,.2f}")
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

    print("\nVerifying resulting balances...")
    for acct_id, label in [(DUP_ACCOUNT, "144 (dup)"), (REAL_ACCOUNT, "111 (real)")]:
        r = session.get(f"{base}/account/{acct_id}", timeout=30)
        a = r.json()["Account"]
        print(f"  New: account {label} balance = {a.get('CurrentBalance')}")


if __name__ == "__main__":
    main()
