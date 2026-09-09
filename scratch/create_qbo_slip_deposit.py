"""Create the 9/7/26 First Merchants split deposit in live QBO.

Uses the existing Monroeapp OAuth + mirror token store. Never prints tokens.
Idempotent: aborts if a 2026-09-07 deposit already totals 3517.17.

Usage (Monroeapp venv):
  C:\\Users\\Jeff\\Documents\\Monroeapp\\qbonline\\.venv\\Scripts\\python.exe scratch/create_qbo_slip_deposit.py
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
import urllib.parse

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
MIRROR = r"E:\qbbackup\qbo_mirror.db"
SLIP_PATH = os.path.join(os.path.dirname(__file__), "..", "scripts", "data", "manual_deposit_splits.json")

BANK_ID = "111"
ACCOUNT_IDS = {
    "Contributed income:Memorial Donations": "118",
    "Corporate Donations": "55",
    "Contributed income:Donations directed by individuals": "54",
    "Retail Partner Rebates": "1150040043",
}
CLASS_FUNDRAISING = "1356416"
VENDOR_BY_NAME = {
    "kroger": ("559", "KROGER"),
    "promedica health system": ("2070", "PROMEDICA"),
}
CUSTOMER_ALIASES = {
    "dave durchman": "Dave Durchman",
}


def auth_headers():
    conn = sqlite3.connect(MIRROR)
    row = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    if not row:
        raise SystemExit("No oauth_tokens row.")
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
        print("Refreshed OAuth tokens.")
    except Exception as e:
        print(f"Refresh failed ({type(e).__name__}); trying stored access token.")
    conn.close()
    return {
        "Authorization": f"Bearer {access}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }, realm


def qbo_get(url, headers):
    r = requests.get(url, headers=headers, timeout=45)
    if r.status_code >= 400:
        raise SystemExit(f"GET failed {r.status_code}: {r.text[:400]}")
    return r.json()


def qbo_post(url, headers, payload):
    return requests.post(url, headers=headers, json=payload, timeout=45)


def query(base, headers, sql, entity):
    url = f"{base}query?query={urllib.parse.quote(sql)}"
    data = qbo_get(url, headers)
    items = data.get("QueryResponse", {}).get(entity, [])
    if isinstance(items, dict):
        return [items]
    return items or []


def esc(s: str) -> str:
    return s.replace("'", r"\'")


def find_payment_methods(base, headers):
    methods = query(base, headers, "SELECT * FROM PaymentMethod MAXRESULTS 1000", "PaymentMethod")
    by_name = {}
    for m in methods:
        name = (m.get("Name") or "").strip()
        print(f"  PaymentMethod id={m.get('Id')} name={name!r} type={m.get('Type')}")
        by_name[name.lower()] = m
    return by_name


def find_or_create_customer(base, headers, cache, display_name):
    key = display_name.strip().lower()
    alias = CUSTOMER_ALIASES.get(key, display_name)
    alias_key = alias.strip().lower()
    if alias_key in cache:
        return cache[alias_key]
    rows = query(
        base,
        headers,
        f"SELECT * FROM Customer WHERE DisplayName = '{esc(alias)}'",
        "Customer",
    )
    if not rows:
        rows = query(
            base,
            headers,
            f"SELECT * FROM Customer WHERE DisplayName = '{esc(display_name)}'",
            "Customer",
        )
    if rows:
        cust = rows[0]
        cache[alias_key] = ("CUSTOMER", cust["Id"], cust.get("DisplayName") or alias)
        print(f"  reuse Customer id={cust['Id']} name={cust.get('DisplayName')!r}")
        return cache[alias_key]
    r = qbo_post(f"{base}customer", headers, {"DisplayName": alias})
    if r.status_code >= 400:
        raise SystemExit(f"Create customer {alias!r} failed {r.status_code}: {r.text[:400]}")
    cust = r.json()["Customer"]
    cache[alias_key] = ("CUSTOMER", cust["Id"], cust.get("DisplayName") or alias)
    print(f"  created Customer id={cust['Id']} name={cust.get('DisplayName')!r}")
    return cache[alias_key]


def entity_for_line(base, headers, cache, donor_name):
    key = donor_name.strip().lower()
    if key in VENDOR_BY_NAME:
        vid, vname = VENDOR_BY_NAME[key]
        print(f"  reuse Vendor id={vid} name={vname!r}")
        return {"value": vid, "name": vname, "type": "VENDOR"}
    etype, eid, ename = find_or_create_customer(base, headers, cache, donor_name)
    return {"value": eid, "name": ename, "type": etype}


def main():
    slip = json.load(open(os.path.abspath(SLIP_PATH), encoding="utf-8"))
    dep = slip["deposits"][0]
    lines = dep["lines"]
    check_total = round(sum(l["amount"] for l in lines if l["paymentMethod"] == "Check"), 2)
    cash_total = round(sum(l["amount"] for l in lines if l["paymentMethod"] == "Cash"), 2)
    grand = round(check_total + cash_total, 2)
    if grand != 3517.17:
        raise SystemExit(f"Local slip total {grand} != bank 3517.17")

    headers, realm = auth_headers()
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/"
    print(f"Company realm ends with ...{str(realm)[-4:]}")

    print("Payment methods:")
    methods = find_payment_methods(base, headers)
    check_pm = methods.get("check")
    cash_pm = methods.get("cash")
    if not check_pm:
        raise SystemExit("PaymentMethod Check not found")
    if not cash_pm:
        print("WARNING: PaymentMethod Cash not found; cash lines will omit method")

    existing = query(base, headers, "SELECT * FROM Deposit WHERE TxnDate = '2026-09-07'", "Deposit")
    for d in existing:
        amt = float(d.get("TotalAmt") or 0)
        print(f"  existing 9/7 deposit id={d.get('Id')} total={amt} to={(d.get('DepositToAccountRef') or {}).get('name')}")
        if abs(amt - 3517.17) < 0.02:
            print("ABORT: a $3,517.17 deposit already exists on 2026-09-07.")
            print(f"QBO Deposit Id={d.get('Id')}")
            return
    if not existing:
        print("  no deposits on 2026-09-07 yet")

    cache = {}
    payload_lines = []
    for i, line in enumerate(lines, start=1):
        acct_id = ACCOUNT_IDS.get(line["account"])
        if not acct_id:
            raise SystemExit(f"Unknown income account {line['account']!r}")
        method = (line.get("paymentMethod") or "").lower()
        pm = check_pm if method == "check" else cash_pm
        detail = {
            "Entity": entity_for_line(base, headers, cache, line["donorName"]),
            "AccountRef": {"value": acct_id},
            "ClassRef": {"value": CLASS_FUNDRAISING},
        }
        if pm:
            detail["PaymentMethodRef"] = {"value": pm["Id"]}
        if line.get("checkNum"):
            detail["CheckNum"] = str(line["checkNum"])
        payload_lines.append(
            {
                "LineNum": i,
                "Amount": round(float(line["amount"]), 2),
                "DetailType": "DepositLineDetail",
                "DepositLineDetail": detail,
                **({"Description": line["description"]} if line.get("description") else {}),
            }
        )

    payload = {
        "DepositToAccountRef": {"value": BANK_ID},
        "TxnDate": dep["date"],
        "PrivateNote": dep["privateNote"],
        "Line": payload_lines,
    }
    print(f"Posting Deposit {dep['date']} lines={len(payload_lines)} checks={check_total} cash={cash_total} total={grand}")
    r = qbo_post(f"{base}deposit", headers, payload)
    if r.status_code >= 400:
        raise SystemExit(f"Create deposit failed {r.status_code}: {r.text[:800]}")
    created = r.json()["Deposit"]
    qbo_id = created["Id"]
    total = created.get("TotalAmt")
    print(f"CREATED QBO Deposit Id={qbo_id} TotalAmt={total} TxnDate={created.get('TxnDate')} SyncToken={created.get('SyncToken')}")
    if abs(float(total) - 3517.17) > 0.02:
        print("WARNING: QBO total does not match bank $3,517.17")

    dep["qboDepositId"] = str(qbo_id)
    with open(os.path.abspath(SLIP_PATH), "w", encoding="utf-8") as f:
        json.dump(slip, f, indent=2)
        f.write("\n")
    print("Wrote QBO Deposit Id back to scripts/data/manual_deposit_splits.json")


if __name__ == "__main__":
    main()
