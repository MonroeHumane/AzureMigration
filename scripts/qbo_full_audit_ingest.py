#!/usr/bin/env python3
"""Read-only full ingestion of live QBO into a fresh local audit database.

Pulls every transaction entity type for a date range plus the full chart of
accounts / vendors / customers / classes / items, and QBO's own P&L and
Balance Sheet reports (summarized by month) for cross-validation. Never
performs a write, update, or delete call against QBO. Never prints token
values.

Credentials and the OAuth token mirror are outside this repo (see
memory/qbo_connection.md): the Monroeapp .env supplies QB_CLIENT_ID/SECRET,
and E:\\qbbackup\\qbo_mirror.db holds the current access/refresh token pair.
This script refreshes that token once at startup and reuses it for the run.
"""
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import time
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"
DEFAULT_DB = os.path.join(os.path.dirname(__file__), "data", "qbo_audit_2024_2026.db")

DATED_ENTITIES = [
    "Purchase", "Bill", "BillPayment", "VendorCredit", "JournalEntry",
    "Deposit", "Invoice", "Payment", "CreditMemo", "SalesReceipt",
    "CreditCardCredit", "Transfer", "RefundReceipt",
]
REFERENCE_ENTITIES = ["Account", "Vendor", "Customer", "Class", "Item", "Department"]

MAX_RESULTS = 1000
MAX_RETRIES = 5


def get_access_token() -> tuple[str, str]:
    conn = sqlite3.connect(TOKEN_MIRROR)
    row = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        raise SystemExit("No oauth_tokens row in mirror DB.")
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


def make_session(access_token: str) -> requests.Session:
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    })
    return s


def qbo_query(session: requests.Session, realm: str, entity: str, where: str | None) -> list[dict]:
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/query"
    results: list[dict] = []
    start = 1
    while True:
        q = f"SELECT * FROM {entity}"
        if where:
            q += f" WHERE {where}"
        q += f" ORDERBY Id STARTPOSITION {start} MAXRESULTS {MAX_RESULTS}"
        params = {"query": q}
        url = f"{base}?{urllib.parse.urlencode(params)}"

        attempt = 0
        while True:
            r = session.get(url, timeout=60)
            if r.status_code == 200:
                break
            if r.status_code in (429, 500, 503) and attempt < MAX_RETRIES:
                wait = 2 ** attempt
                time.sleep(wait)
                attempt += 1
                continue
            raise RuntimeError(f"GET {entity} start={start} -> {r.status_code} {r.text[:400]}")

        data = r.json()
        qr = data.get("QueryResponse", {})
        batch = qr.get(entity, [])
        results.extend(batch)
        if len(batch) < MAX_RESULTS:
            break
        start += MAX_RESULTS
        time.sleep(0.15)
    return results


def qbo_report(session: requests.Session, realm: str, report: str, start_date: str, end_date: str) -> dict:
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/reports/{report}"
    params = {
        "start_date": start_date,
        "end_date": end_date,
        "summarize_column_by": "Month",
        "accounting_method": "Accrual",
    }
    url = f"{base}?{urllib.parse.urlencode(params)}"
    attempt = 0
    while True:
        r = session.get(url, timeout=90)
        if r.status_code == 200:
            return r.json()
        if r.status_code in (429, 500, 503) and attempt < MAX_RETRIES:
            time.sleep(2 ** attempt)
            attempt += 1
            continue
        raise RuntimeError(f"GET report {report} -> {r.status_code} {r.text[:400]}")


SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, name TEXT, fully_qualified_name TEXT, account_type TEXT,
    account_sub_type TEXT, classification TEXT, active INTEGER, current_balance REAL,
    parent_id TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY, display_name TEXT, active INTEGER, balance REAL, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY, display_name TEXT, active INTEGER, balance REAL, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY, name TEXT, active INTEGER, parent_id TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY, name TEXT, type TEXT, income_account_id TEXT, expense_account_id TEXT, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS departments (
    id TEXT PRIMARY KEY, name TEXT, active INTEGER, raw_json TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
    entity_type TEXT, id TEXT, txn_date TEXT, total_amt REAL, doc_number TEXT,
    private_note TEXT, payee_name TEXT, payee_id TEXT, payment_type TEXT,
    sync_token TEXT, created_time TEXT, last_updated_time TEXT, raw_json TEXT,
    PRIMARY KEY (entity_type, id)
);
CREATE TABLE IF NOT EXISTS transaction_lines (
    entity_type TEXT, parent_id TEXT, line_id TEXT, line_num INTEGER, detail_type TEXT,
    amount REAL, account_id TEXT, class_id TEXT, customer_id TEXT, item_id TEXT,
    description TEXT, billable_status TEXT, raw_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(entity_type, txn_date);
CREATE INDEX IF NOT EXISTS idx_lines_parent ON transaction_lines(entity_type, parent_id);
CREATE INDEX IF NOT EXISTS idx_lines_account ON transaction_lines(account_id);
CREATE TABLE IF NOT EXISTS reports (
    report_name TEXT, start_date TEXT, end_date TEXT, fetched_at TEXT, raw_json TEXT,
    PRIMARY KEY (report_name, start_date, end_date)
);
CREATE TABLE IF NOT EXISTS audit_findings (
    finding_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT, severity TEXT, entity_type TEXT, entity_id TEXT,
    txn_date TEXT, amount REAL, description TEXT, evidence_json TEXT,
    source_agent TEXT, created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ingest_log (
    entity_type TEXT PRIMARY KEY, row_count INTEGER, fetched_at TEXT
);
"""


def payee_from(obj: dict) -> tuple[str, str]:
    for key in ("EntityRef", "VendorRef", "CustomerRef"):
        ref = obj.get(key)
        if ref:
            return ref.get("name", "") or "", str(ref.get("value") or "")
    return "", ""


def store_transactions(conn: sqlite3.Connection, entity: str, objs: list[dict]):
    cur = conn.cursor()
    for obj in objs:
        obj_id = str(obj.get("Id"))
        meta = obj.get("MetaData") or {}
        payee_name, payee_id = payee_from(obj)
        payment_type = obj.get("PaymentType", "")
        cur.execute(
            """INSERT OR REPLACE INTO transactions
            (entity_type, id, txn_date, total_amt, doc_number, private_note, payee_name,
             payee_id, payment_type, sync_token, created_time, last_updated_time, raw_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                entity, obj_id, obj.get("TxnDate"), obj.get("TotalAmt"), obj.get("DocNumber"),
                obj.get("PrivateNote"), payee_name, payee_id, payment_type,
                obj.get("SyncToken"), meta.get("CreateTime"), meta.get("LastUpdatedTime"),
                json.dumps(obj),
            ),
        )
        cur.execute("DELETE FROM transaction_lines WHERE entity_type=? AND parent_id=?", (entity, obj_id))
        for line in obj.get("Line") or []:
            detail_type = line.get("DetailType") or ""
            detail = line.get(detail_type) or {}
            account_ref = detail.get("AccountRef") or {}
            class_ref = detail.get("ClassRef") or {}
            customer_ref = detail.get("CustomerRef") or (detail.get("Entity") or {}).get("EntityRef") or {}
            item_ref = detail.get("ItemRef") or {}
            cur.execute(
                """INSERT INTO transaction_lines
                (entity_type, parent_id, line_id, line_num, detail_type, amount, account_id,
                 class_id, customer_id, item_id, description, billable_status, raw_json)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    entity, obj_id, str(line.get("Id") or ""), line.get("LineNum") or 0, detail_type,
                    line.get("Amount") or 0, str(account_ref.get("value") or "") or None,
                    str(class_ref.get("value") or "") or None, str(customer_ref.get("value") or "") or None,
                    str(item_ref.get("value") or "") or None, line.get("Description") or "",
                    detail.get("BillableStatus") or "", json.dumps(line),
                ),
            )
    conn.commit()


def store_accounts(conn, objs):
    cur = conn.cursor()
    for a in objs:
        cur.execute(
            """INSERT OR REPLACE INTO accounts VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                str(a.get("Id")), a.get("Name"), a.get("FullyQualifiedName"), a.get("AccountType"),
                a.get("AccountSubType"), a.get("Classification"), int(bool(a.get("Active"))),
                a.get("CurrentBalance"), str((a.get("ParentRef") or {}).get("value") or "") or None,
                json.dumps(a),
            ),
        )
    conn.commit()


def store_simple(conn, table, objs, cols_fn):
    cur = conn.cursor()
    placeholders = ",".join(["?"] * (len(cols_fn(objs[0])) if objs else 1))
    for o in objs:
        vals = cols_fn(o)
        cur.execute(f"INSERT OR REPLACE INTO {table} VALUES ({placeholders})", vals)
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start-date", default="2024-01-01")
    ap.add_argument("--end-date", default="2026-08-31")
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.db), exist_ok=True)
    access_token, realm = get_access_token()
    print(f"Realm: {realm}  DB: {args.db}")

    conn = sqlite3.connect(args.db)
    conn.executescript(SCHEMA)
    conn.commit()

    session = make_session(access_token)

    def fetch_dated(entity):
        where = f"TxnDate >= '{args.start_date}' AND TxnDate <= '{args.end_date}'"
        objs = qbo_query(session, realm, entity, where)
        return entity, objs

    def fetch_ref(entity):
        objs = qbo_query(session, realm, entity, None)
        return entity, objs

    all_results = {}
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(fetch_ref, e): e for e in REFERENCE_ENTITIES}
        futures.update({pool.submit(fetch_dated, e): e for e in DATED_ENTITIES})
        for fut in as_completed(futures):
            entity = futures[fut]
            try:
                ent, objs = fut.result()
                all_results[ent] = objs
                print(f"  fetched {ent}: {len(objs)} rows")
            except Exception as e:
                print(f"  FAILED {entity}: {type(e).__name__}: {e}")
                all_results[entity] = None

    cur = conn.cursor()
    for entity, objs in all_results.items():
        if objs is None:
            continue
        if entity == "Account":
            store_accounts(conn, objs)
        elif entity == "Vendor":
            store_simple(conn, "vendors", objs, lambda o: (
                str(o.get("Id")), o.get("DisplayName"), int(bool(o.get("Active"))), o.get("Balance"), json.dumps(o)))
        elif entity == "Customer":
            store_simple(conn, "customers", objs, lambda o: (
                str(o.get("Id")), o.get("DisplayName"), int(bool(o.get("Active"))), o.get("Balance"), json.dumps(o)))
        elif entity == "Class":
            store_simple(conn, "classes", objs, lambda o: (
                str(o.get("Id")), o.get("Name"), int(bool(o.get("Active"))),
                str((o.get("ParentRef") or {}).get("value") or "") or None, json.dumps(o)))
        elif entity == "Item":
            store_simple(conn, "items", objs, lambda o: (
                str(o.get("Id")), o.get("Name"), o.get("Type"),
                str((o.get("IncomeAccountRef") or {}).get("value") or "") or None,
                str((o.get("ExpenseAccountRef") or {}).get("value") or "") or None, json.dumps(o)))
        elif entity == "Department":
            store_simple(conn, "departments", objs, lambda o: (
                str(o.get("Id")), o.get("Name"), int(bool(o.get("Active"))), json.dumps(o)))
        else:
            store_transactions(conn, entity, objs)
        cur.execute(
            "INSERT OR REPLACE INTO ingest_log (entity_type, row_count, fetched_at) VALUES (?,?,datetime('now'))",
            (entity, len(objs)),
        )
        conn.commit()

    print("Fetching P&L and Balance Sheet reports (monthly)...")
    try:
        pl = qbo_report(session, realm, "ProfitAndLoss", args.start_date, args.end_date)
        conn.execute(
            "INSERT OR REPLACE INTO reports VALUES (?,?,?,datetime('now'),?)",
            ("ProfitAndLoss", args.start_date, args.end_date, json.dumps(pl)),
        )
        conn.commit()
        print("  P&L report stored.")
    except Exception as e:
        print(f"  P&L report FAILED: {e}")

    try:
        bs = qbo_report(session, realm, "BalanceSheet", args.start_date, args.end_date)
        conn.execute(
            "INSERT OR REPLACE INTO reports VALUES (?,?,?,datetime('now'),?)",
            ("BalanceSheet", args.start_date, args.end_date, json.dumps(bs)),
        )
        conn.commit()
        print("  Balance Sheet report stored.")
    except Exception as e:
        print(f"  Balance Sheet report FAILED: {e}")

    print("\n--- Ingest summary ---")
    for row in conn.execute("SELECT entity_type, row_count FROM ingest_log ORDER BY entity_type"):
        print(f"  {row[0]}: {row[1]}")
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
