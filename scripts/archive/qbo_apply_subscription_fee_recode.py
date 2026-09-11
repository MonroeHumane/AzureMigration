#!/usr/bin/env python3
"""Recode QuickBooks' own monthly subscription fee off the donation-income
account (54, Donations directed by individuals) onto the correct expense
account (72, Software & Apps). 9 occurrences, $2,598.52 total, Dec 2024-Jan
2026, all funded from the real checking account (111) -- confirmed active,
no deleted-account obstacle.
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

TARGET_ACCOUNT_ID = "72"  # Software & Apps
SOURCE_ACCOUNT_ID = "54"  # Donations directed by individuals

TARGETS = [
    {"id": "1585", "amount": 14.52, "date": "2024-12-26"},
    {"id": "2819", "amount": 391.00, "date": "2025-03-03"},
    {"id": "2968", "amount": 295.00, "date": "2025-04-03"},
    {"id": "3124", "amount": 313.00, "date": "2025-05-05"},
    {"id": "3459", "amount": 359.50, "date": "2025-07-03"},
    {"id": "4752", "amount": 321.00, "date": "2025-10-03"},
    {"id": "4753", "amount": 301.50, "date": "2025-11-03"},
    {"id": "5053", "amount": 321.00, "date": "2025-12-03"},
    {"id": "5148", "amount": 282.00, "date": "2026-01-05"},
]

MEMO_SUFFIX = (
    " -- Recoded from Contributed income:Donations directed by individuals to "
    "Software & Apps, 2026-09-11. This is QuickBooks' own monthly subscription "
    "fee (INTUIT */QBooks Pay|Liv), confirmed miscoded to a donation-income "
    "account; should always have been a software expense."
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

    results = []
    for t in TARGETS:
        r = session.get(f"{base}/purchase/{t['id']}", timeout=30)
        if r.status_code != 200:
            print(f"  SKIP {t['id']}: GET failed {r.status_code} {r.text[:200]}")
            results.append((t["id"], "GET_FAILED"))
            continue
        cur = r.json()["Purchase"]
        line = cur["Line"][0]
        current_acct = line["AccountBasedExpenseLineDetail"]["AccountRef"]["value"]
        if current_acct != SOURCE_ACCOUNT_ID:
            print(f"  SKIP {t['id']}: already changed since audit pull (now account {current_acct})")
            results.append((t["id"], "ALREADY_CHANGED"))
            continue
        if abs(line["Amount"] - t["amount"]) > 0.02:
            print(f"  SKIP {t['id']}: amount mismatch, expected {t['amount']} got {line['Amount']}")
            results.append((t["id"], "AMOUNT_MISMATCH"))
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
        print(f"{'[DRY RUN] ' if dry_run else ''}Purchase {t['id']} (${t['amount']:.2f}, {t['date']}): "
              f"Donations directed by individuals -> Software & Apps")
        if dry_run:
            results.append((t["id"], "DRY_RUN"))
            continue

        pr = session.post(f"{base}/purchase", json=payload, timeout=30)
        if pr.status_code != 200:
            print("  WRITE FAILED:", pr.status_code, pr.text[:400])
            results.append((t["id"], f"WRITE_FAILED:{pr.status_code}"))
            continue
        updated = pr.json()["Purchase"]
        new_acct = updated["Line"][0]["AccountBasedExpenseLineDetail"]["AccountRef"]
        ok = new_acct["value"] == TARGET_ACCOUNT_ID
        print(f"  {'OK' if ok else 'MISMATCH'}: now posts to {new_acct}")
        results.append((t["id"], "APPLIED" if ok else "MISMATCH"))

    print("\n--- Summary ---")
    for tid, status in results:
        print(f"  {tid}: {status}")
    n_applied = sum(1 for _, s in results if s == "APPLIED")
    print(f"\n{n_applied} / {len(TARGETS)} applied.")


if __name__ == "__main__":
    main()
