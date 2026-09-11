#!/usr/bin/env python3
"""CORRECTED fix for Deposit 5820. The earlier attempt (qbo_apply_deposit_5820_fix.py)
was based on a wrong premise: I thought TotalAmt ($17,370) was the error because I
never checked for a CashBack object. In fact TotalAmt is exactly correct:
Line sum ($18,480.00) - CashBack.Amount ($1,110.00) = TotalAmt ($17,370.00).

The REAL problem: CashBack.AccountRef points to '1150040035' (Cash 1 (deleted)),
a dead legacy account, instead of the org's real petty-cash account
('Cash', id 1150040020, current balance $200). This script fixes only that,
and also replaces the PrivateNote left by the earlier incorrect attempt.
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

CORRECT_CASHBACK_ACCOUNT = "1150040020"  # Cash (real petty-cash account)

CORRECT_NOTE = (
    "2026-09-11: CashBack destination corrected from 'Cash 1 (deleted)' to 'Cash' "
    "(the org's real petty-cash account). TotalAmt ($17,370.00) was never wrong -- "
    "it correctly equals the 27 line items ($18,480.00) minus this $1,110.00 cash-back "
    "amount, independently confirmed against the 2026 charity auction itemized donor "
    "export. An earlier attempt this session incorrectly tried to change TotalAmt "
    "itself before this CashBack field was discovered; that attempt did not take "
    "(QBO's own math held), and this note replaces the incorrect memo it left."
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

    r = session.get(f"{base}/deposit/5820", timeout=30)
    if r.status_code != 200:
        print("GET failed:", r.status_code, r.text[:300])
        return
    cur = r.json()["Deposit"]
    cb = cur.get("CashBack", {})
    print("Current CashBack:", cb, "SyncToken:", cur["SyncToken"])
    if cb.get("AccountRef", {}).get("value") != "1150040035":
        print("CashBack account already changed since last check -- STOPPING for re-verification.")
        return

    payload = {
        "Id": "5820", "SyncToken": cur["SyncToken"], "sparse": True,
        "DepositToAccountRef": cur["DepositToAccountRef"],
        "TotalAmt": cur["TotalAmt"],
        "CashBack": {"AccountRef": {"value": CORRECT_CASHBACK_ACCOUNT}, "Amount": cb["Amount"]},
        "PrivateNote": CORRECT_NOTE,
    }
    print(f"{'[DRY RUN] ' if dry_run else ''}Proposed: CashBack.AccountRef 'Cash 1 (deleted)' -> 'Cash' (id {CORRECT_CASHBACK_ACCOUNT})")
    if dry_run:
        return

    pr = session.post(f"{base}/deposit", json=payload, timeout=30)
    if pr.status_code != 200:
        print("WRITE FAILED:", pr.status_code, pr.text[:600])
        return
    updated = pr.json()["Deposit"]
    new_cb = updated.get("CashBack", {})
    print("Result CashBack:", new_cb)
    ok = new_cb.get("AccountRef", {}).get("value") == CORRECT_CASHBACK_ACCOUNT
    print("OK" if ok else "MISMATCH -- investigate further, do not assume success")


if __name__ == "__main__":
    main()
