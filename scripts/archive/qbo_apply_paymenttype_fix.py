#!/usr/bin/env python3
"""Fix PaymentType from 'Check' to 'Cash' on 4 Purchases that were actually
paid by debit card / ACH, not a physical check -- confirmed by matching the
real bank statement text directly (POS PURCHASE / electronic debit, not a
'Check #NNNN' line). No dollar amount changes; this only corrects the
payment-method label, which is why these never matched any check-number
search.
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

TARGETS = [
    {"id": "7621", "amount": 664.43, "vendor": "Wall Control", "bank_desc": "POS PURCHASE NON PIN BT *WALL CONTROL S"},
    {"id": "7622", "amount": 1068.80, "vendor": "Step Screen Printing", "bank_desc": "STEP.SCREEN PRIN/... JACQUELINEMONTEER"},
    {"id": "7623", "amount": 66.80, "vendor": "Wall Control", "bank_desc": "POS PURCHASE NON PIN BT *WALL CONTROL S"},
    {"id": "7624", "amount": 648.16, "vendor": "Step Screen Printing", "bank_desc": "STEP.SCREEN PRIN/... JACQUELINEMONTEER"},
]

MEMO_SUFFIX = (
    " -- PaymentType corrected from Check to Cash, 2026-09-11: confirmed against the real bank "
    "statement this was paid by debit card / electronic ACH debit ('{desc}'), not a physical check -- "
    "there never was a check number to record."
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
        if cur.get("PaymentType") != "Check":
            print(f"  SKIP {t['id']}: PaymentType already changed to {cur.get('PaymentType')!r}")
            continue

        note = (cur.get("PrivateNote") or "") + MEMO_SUFFIX.format(desc=t["bank_desc"])
        payload = {
            "Id": t["id"], "SyncToken": cur["SyncToken"], "sparse": True,
            "PaymentType": "Cash", "PrivateNote": note,
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}Purchase {t['id']} ({t['vendor']} ${t['amount']:.2f}): Check -> Cash")
        if dry_run:
            continue

        pr = session.post(f"{base}/purchase", json=payload, timeout=30)
        if pr.status_code != 200:
            print("  WRITE FAILED:", pr.status_code, pr.text[:400])
            continue
        updated = pr.json()["Purchase"]
        print(f"  OK: PaymentType now {updated.get('PaymentType')!r}")


if __name__ == "__main__":
    main()
