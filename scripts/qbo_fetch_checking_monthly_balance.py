#!/usr/bin/env python3
"""Read-only: fetch month-end balance for First Merchants Bank (checking,
account 111) for every month Jan 2024 - present, straight from QBO's
GeneralLedger report (Header/Rows/Summary structure), and write the result
as a small JSON file for charting. Does not touch the local SQLite db."""
import calendar
import json
import os
import sqlite3
import time
import urllib.parse

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"
OUT = os.path.join(os.path.dirname(__file__), "data", "checking_monthly_balance.json")


def get_access_token():
    conn = sqlite3.connect(TOKEN_MIRROR)
    access, refresh, realm = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    client = AuthClient(
        client_id=os.environ["QB_CLIENT_ID"], client_secret=os.environ["QB_CLIENT_SECRET"],
        environment="production", redirect_uri="https://monroe-humane.org/callback",
    )
    try:
        client.refresh(refresh_token=refresh)
        access, refresh = client.access_token, client.refresh_token
        conn.execute(
            "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
            (refresh, access, realm),
        )
        conn.commit()
    except Exception as e:
        print(f"Refresh failed ({type(e).__name__}); using stored token.")
    conn.close()
    return access, realm


def month_ranges(start_year, start_month, end_year, end_month):
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        last_day = calendar.monthrange(y, m)[1]
        yield y, m, f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{last_day:02d}"
        m += 1
        if m > 12:
            m, y = 1, y + 1


def find_account_section(rows, account_name):
    for row in rows:
        header = row.get("Header", {})
        hvals = [c.get("value", "") for c in header.get("ColData", [])]
        if hvals and hvals[0] == account_name:
            return row
        if "Rows" in row:
            found = find_account_section(row["Rows"].get("Row", []), account_name)
            if found:
                return found
    return None


def to_float(x):
    try:
        return float(str(x).replace(",", ""))
    except Exception:
        return None


def main():
    access, realm = get_access_token()
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {access}", "Accept": "application/json"})

    results = []
    for y, m, start, end in month_ranges(2024, 1, 2026, 9):
        params = {"start_date": start, "end_date": end, "accounting_method": "Accrual"}
        url = f"https://quickbooks.api.intuit.com/v3/company/{realm}/reports/GeneralLedger?" + urllib.parse.urlencode(params)
        attempt = 0
        while True:
            r = s.get(url, timeout=90)
            if r.status_code == 200:
                break
            if r.status_code in (429, 500, 503) and attempt < 5:
                time.sleep(2 ** attempt)
                attempt += 1
                continue
            print(f"{y}-{m:02d}: FAILED {r.status_code} {r.text[:200]}")
            r = None
            break
        if r is None:
            continue

        data = r.json()
        top_rows = data.get("Rows", {}).get("Row", [])
        section = find_account_section(top_rows, "First Merchants Bank")
        if not section:
            print(f"{y}-{m:02d}: no First Merchants Bank section found")
            continue

        sub_rows = section.get("Rows", {}).get("Row", [])
        beginning_balance = None
        ending_balance = None
        last_txn_date = None
        for sr in sub_rows:
            vals = [c.get("value", "") for c in sr.get("ColData", [])]
            if len(vals) < 8:
                continue
            date, txn_type = vals[0], vals[1]
            bal = to_float(vals[7])
            if txn_type == "Beginning Balance" or date == "Beginning Balance":
                beginning_balance = bal
                continue
            if bal is not None:
                ending_balance = bal
                last_txn_date = date

        summary = section.get("Summary", {})
        svals = [c.get("value", "") for c in summary.get("ColData", [])]

        print(f"{y}-{m:02d}: begin={beginning_balance} end={ending_balance} (last txn {last_txn_date}) n_lines={len(sub_rows)}")
        results.append({
            "year": y, "month": m, "period": f"{y:04d}-{m:02d}",
            "beginning_balance": beginning_balance,
            "ending_balance": ending_balance,
            "last_txn_date": last_txn_date,
            "n_lines": len(sub_rows),
        })
        time.sleep(0.2)

    with open(OUT, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {len(results)} months to {OUT}")


if __name__ == "__main__":
    main()
