#!/usr/bin/env python3
"""Create 3 real, physically-evidenced checks that were missing from QBO:
- Check #4174, Rachael Sutton, $50.00, 12/31/2024 -- animal adoption refund
- Check #4198, Holly Roder, $200.00, 2/21/2025 -- animal adoption refund
- Check #4419, OBM, $197.27, 5/23/2026 -- office equipment lease/maintenance vendor

Evidence: physical check images provided by Jeff (payee, date, amount, check
number all confirmed from the printed check itself). Categories: the two
refunds use the same "Adoption Fee Refunds & Returns" account already used for
the two prior chargeback corrections (Purchase 7974/7975); OBM uses
"Office expenses:Equipment Lease & Maintenance" (account 67), OBM's most
common historical category (18+ of its ~28 Bill lines).

Dry-run by default; pass --live to actually POST.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import urllib.parse

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"

CHECKING_ACCT = "111"          # First Merchants Bank
ADOPTION_REFUND_ACCT = "1150040012"  # Adoption Fee Refunds & Returns
OBM_EQUIPMENT_ACCT = "67"      # Office expenses:Equipment Lease & Maintenance
OBM_VENDOR_ID = "11"

CHECKS = [
    {
        "doc_number": "4174",
        "txn_date": "2024-12-31",
        "amount": 50.00,
        "payee_note": "Rachael Sutton, 924 Calgary, Monroe MI 48162",
        "account_id": ADOPTION_REFUND_ACCT,
        "entity_ref": None,
        "note": "Real check #4174 to Rachael Sutton, $50.00, dated 12/31/2024 -- "
                "confirmed missing from QBO via full audit (Sep 2026), physical "
                "check image provided by Jeff confirming payee/date/amount. "
                "Animal adoption refund, coded to match the established "
                "Adoption Fee Refunds & Returns precedent (Purchase 7974/7975).",
    },
    {
        "doc_number": "4198",
        "txn_date": "2025-02-21",
        "amount": 200.00,
        "payee_note": "Holly Roder, 488 Pine Cone Trail, Monroe MI 48161",
        "account_id": ADOPTION_REFUND_ACCT,
        "entity_ref": None,
        "note": "Real check #4198 to Holly Roder, $200.00, dated 2/21/2025 -- "
                "confirmed missing from QBO via full audit (Sep 2026), physical "
                "check image provided by Jeff confirming payee/date/amount. "
                "Animal adoption refund, coded to match the established "
                "Adoption Fee Refunds & Returns precedent (Purchase 7974/7975).",
    },
    {
        "doc_number": "4419",
        "txn_date": "2026-05-23",
        "amount": 197.27,
        "payee_note": None,
        "account_id": OBM_EQUIPMENT_ACCT,
        "entity_ref": OBM_VENDOR_ID,
        "note": "Real check #4419 to OBM, $197.27, dated 5/23/2026 -- confirmed "
                "missing from QBO (gap in check sequence between #4416 and "
                "#4422), physical check image provided by Jeff confirming "
                "payee/date/amount. Coded to Office expenses:Equipment Lease & "
                "Maintenance, OBM's most common historical category (18+ of ~28 "
                "prior Bill lines).",
    },
]


def get_access_token():
    conn = sqlite3.connect(TOKEN_MIRROR)
    row = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    access, refresh, realm = row
    client = AuthClient(
        client_id=os.environ["QB_CLIENT_ID"],
        client_secret=os.environ["QB_CLIENT_SECRET"],
        environment="production",
        redirect_uri=REDIRECT,
    )
    try:
        client.refresh(refresh_token=refresh)
        access = client.access_token
        refresh = client.refresh_token
        conn.execute(
            "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
            (refresh, access, realm),
        )
        conn.commit()
        print("Refreshed OAuth token (mirror updated).")
    except Exception as e:
        print(f"Refresh failed ({type(e).__name__}); using stored access token.")
    conn.close()
    return access, realm


def build_payload(chk: dict) -> dict:
    payload = {
        "PaymentType": "Check",
        "AccountRef": {"value": CHECKING_ACCT},
        "TxnDate": chk["txn_date"],
        "DocNumber": chk["doc_number"],
        "PrivateNote": chk["note"] + (f" Payee: {chk['payee_note']}" if chk["payee_note"] else ""),
        "Line": [
            {
                "Amount": chk["amount"],
                "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {"AccountRef": {"value": chk["account_id"]}},
            }
        ],
    }
    if chk["entity_ref"]:
        payload["EntityRef"] = {"value": chk["entity_ref"], "type": "Vendor"}
    return payload


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live", action="store_true", help="Actually POST to QBO (default: dry run)")
    args = ap.parse_args()

    access, realm = get_access_token()
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {access}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    })
    url = f"https://quickbooks.api.intuit.com/v3/company/{realm}/purchase"

    for chk in CHECKS:
        payload = build_payload(chk)
        print(f"\n=== Check #{chk['doc_number']} (${chk['amount']:.2f}, {chk['txn_date']}) ===")
        print(json.dumps(payload, indent=2))
        if not args.live:
            print("(dry run -- not sent)")
            continue
        r = s.post(url, data=json.dumps(payload), timeout=60)
        if r.status_code in (200, 201):
            new_id = r.json().get("Purchase", {}).get("Id")
            print(f"CREATED: Purchase id={new_id}")
        else:
            print(f"FAILED: {r.status_code} {r.text[:500]}")


if __name__ == "__main__":
    main()
