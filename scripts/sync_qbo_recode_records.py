#!/usr/bin/env python3
"""Pull recoded live QBO objects into the local mirror and inspect 5100 / unnamed lumps.

Never prints tokens. Line-level GET only. Upserts qbo_record + qbo_line so donor compile
sees the live accounts. Dry-runs remaining pattern matches on the fetched objects.
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
MIRROR = os.environ.get("QBO_MIRROR_DB", r"E:\qbbackup\qbo_mirror.db")
MAP_PATH = os.path.join(os.path.dirname(__file__), "data", "qbo_category_recodes.json")
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "scratch", "qbo_alignment_inspect.json")


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


def summarize_deposit(obj):
    lines = []
    for ln in obj.get("Line") or []:
        det = ln.get("DepositLineDetail") or {}
        ref = det.get("AccountRef") or {}
        ent = det.get("Entity") or {}
        lines.append({
            "lineId": str(ln.get("Id") or ""),
            "amount": ln.get("Amount"),
            "accountId": str(ref.get("value") or ""),
            "account": ref.get("name") or "",
            "entity": ent.get("name") or "",
            "entityId": str(ent.get("value") or ""),
            "description": ln.get("Description") or "",
            "checkNum": det.get("CheckNum") or "",
        })
    return {
        "id": str(obj.get("Id")),
        "date": obj.get("TxnDate"),
        "total": obj.get("TotalAmt"),
        "privateNote": obj.get("PrivateNote") or "",
        "lineCount": len(lines),
        "lineSum": round(sum(float(x["amount"] or 0) for x in lines), 2),
        "lines": lines,
    }


def summarize_purchase(obj):
    lines = []
    for ln in obj.get("Line") or []:
        det = ln.get("AccountBasedExpenseLineDetail") or {}
        ref = det.get("AccountRef") or {}
        lines.append({
            "lineId": str(ln.get("Id") or ""),
            "amount": ln.get("Amount"),
            "accountId": str(ref.get("value") or ""),
            "account": ref.get("name") or "",
            "description": ln.get("Description") or "",
        })
    vendor = (obj.get("EntityRef") or {})
    return {
        "id": str(obj.get("Id")),
        "date": obj.get("TxnDate"),
        "total": obj.get("TotalAmt"),
        "vendor": vendor.get("name") or "",
        "privateNote": obj.get("PrivateNote") or "",
        "lines": lines,
    }


def upsert(conn, entity_name, data):
    obj_id = str(data.get("Id"))
    meta = data.get("MetaData") or {}
    last_updated = meta.get("LastUpdatedTime", "")
    name = data.get("Name", data.get("FullyQualifiedName", data.get("DisplayName", "")))
    cursor = conn.cursor()
    cursor.execute("DELETE FROM qbo_line WHERE parent_id=? AND parent_type=?", (obj_id, entity_name))
    cursor.execute("DELETE FROM qbo_record WHERE id=? AND entity_type=?", (obj_id, entity_name))
    cursor.execute(
        """
        INSERT INTO qbo_record (
            id, entity_type, name, vendor_id, customer_id, txn_date, total_amt, balance,
            account_type, sync_token, is_deleted, deleted_at, active, last_updated_time, raw_json, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, 1, ?, ?, datetime('now'))
        """,
        (
            obj_id,
            entity_name,
            name,
            str((data.get("EntityRef") or {}).get("value") or (data.get("VendorRef") or {}).get("value") or ""),
            str((data.get("CustomerRef") or {}).get("value") or ""),
            data.get("TxnDate"),
            data.get("TotalAmt"),
            data.get("Balance"),
            data.get("AccountType"),
            data.get("SyncToken"),
            last_updated,
            json.dumps(data),
        ),
    )
    for line in data.get("Line") or []:
        detail_type = line.get("DetailType") or ""
        detail_node = line.get(detail_type) or {}
        account_ref = detail_node.get("AccountRef") or {}
        cursor.execute(
            """
            INSERT INTO qbo_line (
                parent_id, parent_type, line_id, line_num, detail_type, amount, item_id, account_id, description, raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                obj_id,
                entity_name,
                str(line.get("Id") or "0"),
                line.get("LineNum") or 0,
                detail_type,
                line.get("Amount") or 0,
                str((detail_node.get("ItemRef") or {}).get("value") or "") or None,
                str(account_ref.get("value") or "") or None,
                line.get("Description") or "",
                json.dumps(line),
            ),
        )


def expected_account(mapping, target_key):
    return str(mapping["targets"][target_key]["id"])


def verify_line(summary_lines, amount, account_id):
    hits = [ln for ln in summary_lines if abs(float(ln.get("amount") or 0) - float(amount)) < 0.02]
    return any(ln.get("accountId") == str(account_id) for ln in hits), hits


def main():
    mapping = json.load(open(MAP_PATH, encoding="utf-8"))
    headers, realm = auth_headers()
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}/"
    conn = sqlite3.connect(MIRROR)

    report = {"deposits": [], "purchases": [], "unnamed": [], "verify": [], "keep5100": None}
    ids_seen = set()

    for spec in mapping["deposits"]:
        data = qbo_get(f"{base}deposit/{spec['id']}", headers)
        obj = data["Deposit"]
        summary = summarize_deposit(obj)
        summary["reason"] = spec["reason"]
        report["deposits"].append(summary)
        with conn:
            upsert(conn, "Deposit", obj)
        ids_seen.add(("Deposit", spec["id"]))
        for line in spec["lines"]:
            ok, hits = verify_line(summary["lines"], line["amount"], expected_account(mapping, line["target"]))
            report["verify"].append({
                "kind": "Deposit",
                "id": spec["id"],
                "amount": line["amount"],
                "ok": ok,
                "hits": hits,
            })
            print(("OK  " if ok else "BAD "), "Deposit", spec["id"], line["amount"], hits)
        time.sleep(0.2)

    for spec in mapping["purchases"]:
        data = qbo_get(f"{base}purchase/{spec['id']}", headers)
        obj = data["Purchase"]
        summary = summarize_purchase(obj)
        summary["reason"] = spec["reason"]
        report["purchases"].append(summary)
        with conn:
            upsert(conn, "Purchase", obj)
        ok, hits = verify_line(summary["lines"], spec["amount"], expected_account(mapping, spec["target"]))
        report["verify"].append({
            "kind": "Purchase",
            "id": spec["id"],
            "amount": spec["amount"],
            "ok": ok,
            "hits": hits,
        })
        print(("OK  " if ok else "BAD "), "Purchase", spec["id"], spec["amount"], hits)
        time.sleep(0.2)

    extra = [("deposit", "7952"), ("deposit", "6757")]
    for kind, pid in extra:
        try:
            data = qbo_get(f"{base}{kind}/{pid}", headers)
            key = "Deposit" if kind == "deposit" else "Purchase"
            obj = data[key]
            with conn:
                upsert(conn, key, obj)
            print("SYNC", key, pid, obj.get("TxnDate"), obj.get("TotalAmt"))
        except Exception as e:
            print("SKIP", kind, pid, type(e).__name__)
        time.sleep(0.2)

    for spec in mapping.get("unnamedWatchlist") or []:
        data = qbo_get(f"{base}deposit/{spec['id']}", headers)
        obj = data["Deposit"]
        summary = summarize_deposit(obj)
        summary["watchNote"] = spec.get("note")
        named = [ln for ln in summary["lines"] if ln.get("entity")]
        summary["namedLineCount"] = len(named)
        report["unnamed"].append(summary)
        with conn:
            upsert(conn, "Deposit", obj)
        print(
            "UNNAMED",
            spec["id"],
            summary["date"],
            summary["total"],
            f"named={len(named)}/{summary['lineCount']}",
        )
        time.sleep(0.2)

    d5100 = next((d for d in report["deposits"] if d["id"] == "5100"), None)
    if d5100:
        twins = [ln for ln in d5100["lines"] if abs(float(ln["amount"] or 0) - 375.14) < 0.02]
        keep = abs(float(d5100["total"] or 0) - float(d5100["lineSum"] or 0)) <= 0.02 and len(twins) == 2
        report["keep5100"] = {
            "id": "5100",
            "date": d5100["date"],
            "total": d5100["total"],
            "lineSum": d5100["lineSum"],
            "twinCount": len(twins),
            "twins": twins,
            "keepBoth": keep,
            "reason": "Bank/QBO deposit total includes both $375.14 lines" if keep else "Investigate clone vs two payments",
        }
        print("5100 keepBoth=", keep, "total", d5100["total"], "lineSum", d5100["lineSum"], "twins", len(twins))

    ok_n = sum(1 for v in report["verify"] if v["ok"])
    report["summary"] = {"verified": ok_n, "checked": len(report["verify"])}
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    conn.close()
    print(f"Verified {ok_n}/{len(report['verify'])}")
    print("Wrote", OUT_PATH)
    if ok_n != len(report["verify"]):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
