#!/usr/bin/env python3
"""Reclassify the OBE-hitting line on Purchase 4428 ($322,255.85) and 4429
($146,549.56) -- QBO's own auto-generated 'adjust balance for deletion'
entries from 2025-09-21, for the now-deleted 'Business Checking 1' and
'Cash 1' accounts -- from Opening Balance Equity to Net Assets Without
Donor Restrictions.

This mirrors the EXACT treatment the organization already used successfully
for a related pair of legacy accounts: JournalEntry 2436/2437 (2025-02-01,
memo 'Prior-period duplicate payroll adjustment reclassified to Net Assets
Without Donor Restrictions per FASB ASC 250'). Does NOT touch JournalEntry
4282 (the original 2024 entry that inflated these accounts) -- that one
touches income-statement accounts and stays gated behind CPA review.

This does not reopen or edit any 2024 transaction -- it corrects two
2025-dated entries in place.
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

TARGET_ACCOUNT_ID = "1150040031"  # Net Assets Without Donor Restrictions
TARGET_ACCOUNT_NAME = "Net Assets Without Donor Restrictions"

TARGETS = [
    {"id": "4428", "amount": 322255.85, "source_account": "Business Checking 1 (deleted)"},
    {"id": "4429", "amount": 146549.56, "source_account": "Cash 1 (deleted)"},
]

MEMO_SUFFIX = (
    " -- Reclassified from Opening Balance Equity to Net Assets Without Donor "
    "Restrictions per FASB ASC 250, 2026-09-11, mirroring the treatment already "
    "used for JournalEntry 2436/2437 (2025-02-01) on a related pair of legacy accounts. "
    "JournalEntry 4282 (the original 2024 entry) is unchanged pending CPA review."
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

    for t in TARGETS:
        r = session.get(f"{base}/purchase/{t['id']}", timeout=30)
        if r.status_code != 200:
            print(f"  SKIP {t['id']}: GET failed {r.status_code} {r.text[:200]}")
            continue
        cur = r.json()["Purchase"]
        line = cur["Line"][0]
        current_acct = line["AccountBasedExpenseLineDetail"]["AccountRef"]["value"]
        if current_acct != "30":
            print(f"  SKIP {t['id']}: line already changed since audit pull (now account {current_acct})")
            continue

        note = (cur.get("PrivateNote") or "") + MEMO_SUFFIX
        payload = {
            "Id": t["id"], "SyncToken": cur["SyncToken"], "sparse": True,
            "PaymentType": cur["PaymentType"],
            "PrivateNote": note,
            "Line": [{
                "Id": line["Id"], "Amount": t["amount"], "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {"AccountRef": {"value": TARGET_ACCOUNT_ID}},
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}Purchase {t['id']} (${t['amount']:,.2f}, from {t['source_account']}): "
              f"Opening balance equity -> {TARGET_ACCOUNT_NAME}")
        if dry_run:
            continue

        pr = session.post(f"{base}/purchase", json=payload, timeout=30)
        if pr.status_code != 200:
            print("  WRITE FAILED:", pr.status_code, pr.text[:500])
            continue
        updated = pr.json()["Purchase"]
        new_acct = updated["Line"][0]["AccountBasedExpenseLineDetail"]["AccountRef"]
        print(f"  RESULT: line now posts to {new_acct}")


if __name__ == "__main__":
    main()
