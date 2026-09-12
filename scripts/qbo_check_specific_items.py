#!/usr/bin/env python3
"""Read-only live QBO lookup for a handful of specific unresolved reconciliation
lines. Never performs a write. Reuses the same OAuth pattern as
qbo_full_audit_ingest.py."""
from __future__ import annotations

import os
import sqlite3
import urllib.parse

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


def qbo_query(session, realm, entity, where):
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/query"
    q = f"SELECT * FROM {entity}"
    if where:
        q += f" WHERE {where}"
    q += " MAXRESULTS 1000"
    params = {"query": q}
    url = f"{base}?{urllib.parse.urlencode(params)}"
    r = session.get(url, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GET {entity} -> {r.status_code} {r.text[:400]}")
    return r.json().get("QueryResponse", {}).get(entity, [])


def summarize(entity, rows):
    print(f"--- {entity}: {len(rows)} rows ---")
    for row in rows:
        acct = (row.get("AccountRef") or {}).get("name") or (row.get("DepositToAccountRef") or {}).get("name") or (row.get("BankAccountRef") or {}).get("name")
        payee = (row.get("EntityRef") or {}).get("name") or (row.get("PayeeRef") or {}).get("name")
        print(f"  id={row.get('Id')} date={row.get('TxnDate')} total={row.get('TotalAmt')} "
              f"docnum={row.get('DocNumber')!r} paytype={row.get('PaymentType')} "
              f"payee={payee!r} account={acct!r} privatenote={row.get('PrivateNote')!r}")


def main():
    access, realm = get_access_token()
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {access}", "Accept": "application/json"})

    print("\n### Check #4419 search: Purchase/BillPayment/Bill near 2026-05-25 to 2026-06-15 ###")
    for entity in ["Purchase", "BillPayment", "Bill"]:
        rows = qbo_query(s, realm, entity, "TxnDate >= '2026-05-25' AND TxnDate <= '2026-06-15'")
        summarize(entity, rows)

    print("\n### Intuit/QBO $320 search: Purchase near 2026-05-25 to 2026-06-15 (already pulled above, re-list Purchase only) ###")

    print("\n### AuthNet/Bankcard Feb-Mar 2025: Purchase Jan 25 - Apr 10 2025 ###")
    rows = qbo_query(s, realm, "Purchase", "TxnDate >= '2025-01-25' AND TxnDate <= '2025-04-10'")
    for row in rows:
        payee = (row.get("EntityRef") or {}).get("name", "")
        if "AUTHNET" in (payee or "").upper() or "BANKCARD" in (payee or "").upper() or "BANK CARD" in (payee or "").upper():
            print(f"  id={row.get('Id')} date={row.get('TxnDate')} total={row.get('TotalAmt')} payee={payee!r}")

    print("\n### Check #4188 real bank clear -- look for ANY QBO record with TotalAmt=100.00 near 2025-02-18 (checking account only) ###")
    rows = qbo_query(s, realm, "Purchase", "TxnDate >= '2025-02-10' AND TxnDate <= '2025-02-25'")
    for row in rows:
        if abs(float(row.get("TotalAmt", 0)) - 100.00) < 0.02:
            acct = (row.get("AccountRef") or {}).get("name")
            print(f"  Purchase id={row.get('Id')} date={row.get('TxnDate')} total={row.get('TotalAmt')} docnum={row.get('DocNumber')!r} account={acct!r}")
    rows2 = qbo_query(s, realm, "BillPayment", "TxnDate >= '2025-02-10' AND TxnDate <= '2025-02-25'")
    for row in rows2:
        if abs(float(row.get("TotalAmt", 0)) - 100.00) < 0.02:
            print(f"  BillPayment id={row.get('Id')} date={row.get('TxnDate')} total={row.get('TotalAmt')} docnum={row.get('DocNumber')!r}")

    print("\n### Chargebacks: Purchase/RefundReceipt/CreditMemo near 2025-02-05 to 2025-02-16 and 2025-07-15 to 2025-07-30 ###")
    for window in [("2025-02-05", "2025-02-16"), ("2025-07-15", "2025-07-30")]:
        for entity in ["Purchase", "RefundReceipt", "CreditMemo"]:
            rows = qbo_query(s, realm, entity, f"TxnDate >= '{window[0]}' AND TxnDate <= '{window[1]}'")
            summarize(f"{entity} {window}", rows)


if __name__ == "__main__":
    main()
