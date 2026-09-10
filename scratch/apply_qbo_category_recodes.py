"""Apply line-level QBO category recodes from scripts/data/qbo_category_recodes.json.

Uses the existing Monroeapp OAuth + mirror token store. Never prints tokens.
Idempotent: skips a line already on the target account.
Does not delete transactions (Thrivent duplicate $375.14 is recoded, not removed).
"""
from __future__ import annotations

import json
import os
import sqlite3
import time

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
MIRROR = r"E:\qbbackup\qbo_mirror.db"
MAP_PATH = os.path.join(os.path.dirname(__file__), "..", "scripts", "data", "qbo_category_recodes.json")
OUT_PATH = os.path.join(os.path.dirname(__file__), "qbo_category_recode_results.json")


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
        raise RuntimeError(f"GET {url} -> {r.status_code} {r.text[:400]}")
    return r.json()


def qbo_post(url, headers, payload):
    return requests.post(url, headers=headers, json=payload, timeout=45)


def target_ref(targets, key):
    t = targets[key]
    return {"value": str(t["id"]), "name": t["name"]}


def line_amount(line):
    try:
        return round(float(line.get("Amount") or 0), 2)
    except (TypeError, ValueError):
        return 0.0


def find_deposit_line(lines, spec):
    want_id = str(spec["lineId"])
    want_amt = round(float(spec["amount"]), 2)
    for line in lines:
        if str(line.get("Id") or "") == want_id and abs(line_amount(line) - want_amt) < 0.02:
            return line
    for line in lines:
        if abs(line_amount(line) - want_amt) < 0.02 and line.get("DepositLineDetail"):
            return line
    return None


def account_id(line, detail_key):
    det = line.get(detail_key) or {}
    return str((det.get("AccountRef") or {}).get("value") or "")


def patch_deposit(base, headers, spec, targets):
    data = qbo_get(f"{base}deposit/{spec['id']}", headers)
    deposit = data["Deposit"]
    lines = deposit.get("Line") or []
    changed = 0
    skipped = 0
    for line_spec in spec["lines"]:
        line = find_deposit_line(lines, line_spec)
        if not line or not line.get("DepositLineDetail"):
            return {"ok": False, "note": spec["reason"], "error": f"line {line_spec} not found"}
        dest = target_ref(targets, line_spec["target"])
        current = account_id(line, "DepositLineDetail")
        if current == dest["value"]:
            skipped += 1
            continue
        line["DepositLineDetail"]["AccountRef"] = dest
        changed += 1
    if changed == 0:
        return {"ok": True, "skipped": True, "note": spec["reason"], "id": spec["id"], "changed": 0, "already": skipped}
    payload = {
        "Id": deposit["Id"],
        "SyncToken": deposit["SyncToken"],
        "TxnDate": deposit.get("TxnDate"),
        "PrivateNote": deposit.get("PrivateNote") or "",
        "DepositToAccountRef": deposit.get("DepositToAccountRef"),
        "Line": lines,
    }
    if deposit.get("CurrencyRef"):
        payload["CurrencyRef"] = deposit["CurrencyRef"]
    r = qbo_post(f"{base}deposit", headers, payload)
    if r.status_code >= 400:
        return {"ok": False, "note": spec["reason"], "id": spec["id"], "error": f"{r.status_code} {r.text[:400]}"}
    created = r.json().get("Deposit") or {}
    return {
        "ok": True,
        "note": spec["reason"],
        "id": spec["id"],
        "changed": changed,
        "already": skipped,
        "syncToken": created.get("SyncToken"),
        "total": created.get("TotalAmt"),
    }


def clean_purchase_lines(lines, dest=None, amount=None):
    cleaned = []
    matched = False
    want = round(float(amount), 2) if amount is not None else None
    for line in lines:
        detail = line.get("AccountBasedExpenseLineDetail")
        if not detail:
            continue
        new_detail = {
            "AccountRef": detail.get("AccountRef"),
        }
        if detail.get("CustomerRef"):
            new_detail["CustomerRef"] = detail["CustomerRef"]
        if detail.get("ClassRef"):
            new_detail["ClassRef"] = detail["ClassRef"]
        if detail.get("TaxCodeRef"):
            new_detail["TaxCodeRef"] = detail["TaxCodeRef"]
        if dest and want is not None and abs(line_amount(line) - want) < 0.02 and not matched:
            new_detail["AccountRef"] = dest
            matched = True
        cleaned.append(
            {
                "Id": line.get("Id"),
                "Amount": line.get("Amount"),
                "DetailType": line.get("DetailType") or "AccountBasedExpenseLineDetail",
                "Description": line.get("Description") or "",
                "AccountBasedExpenseLineDetail": new_detail,
            }
        )
    return cleaned, matched


def patch_purchase(base, headers, spec, targets):
    data = qbo_get(f"{base}purchase/{spec['id']}", headers)
    purchase = data["Purchase"]
    dest = target_ref(targets, spec["target"])
    lines = purchase.get("Line") or []
    already = False
    for line in lines:
        if abs(line_amount(line) - round(float(spec["amount"]), 2)) < 0.02:
            if account_id(line, "AccountBasedExpenseLineDetail") == dest["value"]:
                already = True
    if already:
        return {"ok": True, "skipped": True, "note": spec["reason"], "id": spec["id"], "changed": 0}
    cleaned, matched = clean_purchase_lines(lines, dest, spec["amount"])
    if not matched:
        return {"ok": False, "note": spec["reason"], "id": spec["id"], "error": "matching expense line not found"}
    payload = {
        "Id": purchase["Id"],
        "SyncToken": purchase["SyncToken"],
        "TxnDate": purchase.get("TxnDate"),
        "PaymentType": purchase.get("PaymentType") or "Cash",
        "AccountRef": purchase.get("AccountRef"),
        "PrivateNote": purchase.get("PrivateNote") or "",
        "Line": cleaned,
    }
    if purchase.get("EntityRef"):
        payload["EntityRef"] = purchase["EntityRef"]
    if purchase.get("CurrencyRef"):
        payload["CurrencyRef"] = purchase["CurrencyRef"]
    r = qbo_post(f"{base}purchase", headers, payload)
    if r.status_code >= 400:
        return {"ok": False, "note": spec["reason"], "id": spec["id"], "error": f"{r.status_code} {r.text[:400]}"}
    created = r.json().get("Purchase") or {}
    return {
        "ok": True,
        "note": spec["reason"],
        "id": spec["id"],
        "changed": 1,
        "syncToken": created.get("SyncToken"),
        "total": created.get("TotalAmt"),
    }


def patch_bill(base, headers, spec, targets):
    data = qbo_get(f"{base}bill/{spec['id']}", headers)
    bill = data["Bill"]
    lines = bill.get("Line") or []
    changed = 0
    skipped = 0
    for line_spec in spec["lines"]:
        dest = target_ref(targets, line_spec["target"])
        want_id = str(line_spec["lineId"])
        want_amt = round(float(line_spec["amount"]), 2)
        line = None
        for ln in lines:
            if str(ln.get("Id") or "") == want_id and abs(line_amount(ln) - want_amt) < 0.02:
                line = ln
                break
        if line is None:
            for ln in lines:
                desc = (ln.get("Description") or "").lower()
                if abs(line_amount(ln) - want_amt) < 0.02 and "woof lodge" in desc:
                    line = ln
                    break
        if line is None or not line.get("AccountBasedExpenseLineDetail"):
            return {"ok": False, "note": spec["reason"], "id": spec["id"], "error": f"line {line_spec} not found"}
        current = account_id(line, "AccountBasedExpenseLineDetail")
        if current == dest["value"]:
            skipped += 1
            continue
        line["AccountBasedExpenseLineDetail"]["AccountRef"] = dest
        changed += 1
    if changed == 0:
        return {"ok": True, "skipped": True, "note": spec["reason"], "id": spec["id"], "changed": 0, "already": skipped}

    cleaned = []
    for line in lines:
        detail = line.get("AccountBasedExpenseLineDetail")
        if not detail:
            continue
        new_detail = {"AccountRef": detail.get("AccountRef")}
        if detail.get("CustomerRef"):
            new_detail["CustomerRef"] = detail["CustomerRef"]
        if detail.get("ClassRef"):
            new_detail["ClassRef"] = detail["ClassRef"]
        if detail.get("TaxCodeRef"):
            new_detail["TaxCodeRef"] = detail["TaxCodeRef"]
        cleaned.append(
            {
                "Id": line.get("Id"),
                "Amount": line.get("Amount"),
                "DetailType": line.get("DetailType") or "AccountBasedExpenseLineDetail",
                "Description": line.get("Description") or "",
                "AccountBasedExpenseLineDetail": new_detail,
            }
        )
    payload = {
        "Id": bill["Id"],
        "SyncToken": bill["SyncToken"],
        "TxnDate": bill.get("TxnDate"),
        "VendorRef": bill.get("VendorRef"),
        "PrivateNote": bill.get("PrivateNote") or "",
        "Line": cleaned,
    }
    if bill.get("CurrencyRef"):
        payload["CurrencyRef"] = bill["CurrencyRef"]
    if bill.get("APAccountRef"):
        payload["APAccountRef"] = bill["APAccountRef"]
    r = qbo_post(f"{base}bill?operation=update", headers, payload)
    if r.status_code >= 400:
        r = qbo_post(f"{base}bill", headers, payload)
    if r.status_code >= 400:
        return {"ok": False, "note": spec["reason"], "id": spec["id"], "error": f"{r.status_code} {r.text[:400]}"}
    created = r.json().get("Bill") or {}
    return {
        "ok": True,
        "note": spec["reason"],
        "id": spec["id"],
        "changed": changed,
        "already": skipped,
        "syncToken": created.get("SyncToken"),
        "total": created.get("TotalAmt"),
    }


def main():
    import sys

    only = None
    for arg in sys.argv[1:]:
        if arg.startswith("--only="):
            only = arg.split("=", 1)[1].strip()

    mapping = json.load(open(os.path.abspath(MAP_PATH), encoding="utf-8"))
    targets = mapping["targets"]
    headers, realm = auth_headers()
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/"
    print(f"Company realm ends with ...{str(realm)[-4:]}")
    results = []

    if only in (None, "deposits"):
        for spec in mapping.get("deposits") or []:
            try:
                res = patch_deposit(base, headers, spec, targets)
            except Exception as e:
                res = {"ok": False, "id": spec["id"], "note": spec["reason"], "error": str(e)[:400]}
            results.append({"kind": "Deposit", **res})
            status = "SKIP" if res.get("skipped") else ("OK" if res.get("ok") else "FAIL")
            print(f"  {status} Deposit {spec['id']} {spec['date']} {spec['reason']}" + (f" :: {res.get('error')}" if not res.get("ok") else ""))
            time.sleep(0.25)

    if only in (None, "purchases"):
        for spec in mapping.get("purchases") or []:
            try:
                res = patch_purchase(base, headers, spec, targets)
            except Exception as e:
                res = {"ok": False, "id": spec["id"], "note": spec["reason"], "error": str(e)[:400]}
            results.append({"kind": "Purchase", **res})
            status = "SKIP" if res.get("skipped") else ("OK" if res.get("ok") else "FAIL")
            print(f"  {status} Purchase {spec['id']} {spec['date']} {spec['reason']}" + (f" :: {res.get('error')}" if not res.get("ok") else ""))
            time.sleep(0.25)

    if only in (None, "bills"):
        for spec in mapping.get("bills") or []:
            try:
                res = patch_bill(base, headers, spec, targets)
            except Exception as e:
                res = {"ok": False, "id": spec["id"], "note": spec["reason"], "error": str(e)[:400]}
            results.append({"kind": "Bill", **res})
            status = "SKIP" if res.get("skipped") else ("OK" if res.get("ok") else "FAIL")
            print(f"  {status} Bill {spec['id']} {spec['date']} {spec['reason']}" + (f" :: {res.get('error')}" if not res.get("ok") else ""))
            time.sleep(0.25)

    ok = sum(1 for r in results if r.get("ok"))
    fail = sum(1 for r in results if not r.get("ok"))
    skipped = sum(1 for r in results if r.get("skipped"))
    changed = sum(int(r.get("changed") or 0) for r in results)
    summary = {"ok": ok, "fail": fail, "skipped": skipped, "linesChanged": changed, "results": results}
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"Done ok={ok} fail={fail} skipped={skipped} linesChanged={changed}")
    print("Wrote", OUT_PATH)
    if fail:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
