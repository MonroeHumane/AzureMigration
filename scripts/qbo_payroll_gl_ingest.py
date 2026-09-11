#!/usr/bin/env python3
"""Read-only ingestion of QBO's GeneralLedger report, month by month, to recover
payroll/paycheck transaction detail that the standard Accounting Query API cannot
return (the `Paycheck` entity does not support SELECT queries in QBO's API).

Never performs a write/update/delete call against QBO. Never prints token values.
"""
from __future__ import annotations

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
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"
DB = os.path.join(os.path.dirname(__file__), "data", "qbo_audit_2024_2026.db")

PAYROLL_MARKERS = ("payroll", "paycheck", "salar", "wage", "direct deposit")


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
    try:
        client.refresh(refresh_token=refresh)
        access, refresh = client.access_token, client.refresh_token
        conn.execute(
            "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
            (refresh, access, realm),
        )
        conn.commit()
        print("Refreshed OAuth token.")
    except Exception as e:
        print(f"Refresh failed ({type(e).__name__}); using stored access token.")
    conn.close()
    return access, realm


def month_ranges(start_year, start_month, end_year, end_month):
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        last_day = calendar.monthrange(y, m)[1]
        yield f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{last_day:02d}"
        m += 1
        if m > 12:
            m = 1
            y += 1


def flatten_gl_rows(rows_node, out):
    for row in rows_node.get("Row", []):
        if "ColData" in row:
            vals = [c.get("value", "") for c in row["ColData"]]
            if len(vals) >= 8:
                out.append(vals)
        if "Rows" in row:
            flatten_gl_rows(row["Rows"], out)


SCHEMA_ADDENDUM = """
CREATE TABLE IF NOT EXISTS gl_lines (
    period TEXT, txn_date TEXT, txn_type TEXT, doc_num TEXT, name TEXT,
    memo TEXT, split_account TEXT, amount REAL, balance REAL, is_payroll INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gl_period ON gl_lines(period);
CREATE INDEX IF NOT EXISTS idx_gl_payroll ON gl_lines(is_payroll);
"""


def main():
    access_token, realm = get_access_token()
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA_ADDENDUM)
    conn.execute("DELETE FROM gl_lines")
    conn.commit()

    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {access_token}", "Accept": "application/json"})

    total_rows = 0
    total_payroll_rows = 0
    for start, end in month_ranges(2024, 1, 2026, 8):
        period = start[:7]
        params = {"start_date": start, "end_date": end, "accounting_method": "Accrual"}
        url = f"https://quickbooks.api.intuit.com/v3/company/{realm}/reports/GeneralLedger?" + urllib.parse.urlencode(params)
        attempt = 0
        while True:
            r = session.get(url, timeout=90)
            if r.status_code == 200:
                break
            if r.status_code in (429, 500, 503) and attempt < 5:
                time.sleep(2 ** attempt)
                attempt += 1
                continue
            print(f"  {period}: FAILED {r.status_code} {r.text[:200]}")
            r = None
            break
        if r is None:
            continue

        data = r.json()
        conn.execute(
            "INSERT OR REPLACE INTO reports VALUES (?,?,?,datetime('now'),?)",
            (f"GeneralLedgerMonthly:{period}", start, end, json.dumps(data)),
        )

        rows = []
        flatten_gl_rows(data.get("Rows", {}), rows)
        cur = conn.cursor()
        payroll_count = 0
        for vals in rows:
            date, txn_type, doc_num, name, memo, split_acc, amount, balance = vals[:8]
            blob = f"{txn_type} {memo} {split_acc}".lower()
            is_payroll = 1 if any(m in blob for m in PAYROLL_MARKERS) else 0
            if is_payroll:
                payroll_count += 1

            def to_float(x):
                try:
                    return float(str(x).replace(",", ""))
                except Exception:
                    return None

            cur.execute(
                "INSERT INTO gl_lines VALUES (?,?,?,?,?,?,?,?,?,?)",
                (period, date, txn_type, doc_num, name, memo, split_acc, to_float(amount), to_float(balance), is_payroll),
            )
        conn.commit()
        total_rows += len(rows)
        total_payroll_rows += payroll_count
        print(f"  {period}: {len(rows)} GL lines ({payroll_count} payroll-marked)")
        time.sleep(0.2)

    conn.execute(
        "INSERT OR REPLACE INTO ingest_log (entity_type, row_count, fetched_at) VALUES ('GeneralLedger_payroll_lines', ?, datetime('now'))",
        (total_payroll_rows,),
    )
    conn.commit()
    conn.close()
    print(f"\nTotal GL lines: {total_rows}, payroll-marked: {total_payroll_rows}")


if __name__ == "__main__":
    main()
