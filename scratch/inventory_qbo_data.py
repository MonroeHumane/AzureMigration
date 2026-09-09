"""Inventory every usable field in the local QBO mirror. Never print oauth_tokens."""
from __future__ import annotations

import collections
import json
import os
import sqlite3
from datetime import datetime

DB = os.environ.get("QBO_MIRROR_DB", r"E:\qbbackup\qbo_mirror.db")
OUT = r"C:\Users\Jeff\Documents\AzureMigration\scratch\qbo_data_inventory.json"

SKIP_TABLES = {"oauth_tokens"}
TXN_TYPES = (
    "Deposit", "SalesReceipt", "Payment", "Invoice", "JournalEntry",
    "Purchase", "Bill", "Transfer", "RefundReceipt", "CreditMemo",
    "VendorCredit", "BillPayment", "Estimate",
)


def pct(n, d):
    return round(100.0 * n / d, 1) if d else 0.0


def walk_keys(obj, prefix="", acc=None, max_depth=4):
    if acc is None:
        acc = collections.Counter()
    if max_depth < 0 or obj is None:
        return acc
    if isinstance(obj, dict):
        for k, v in obj.items():
            path = f"{prefix}.{k}" if prefix else k
            acc[path] += 1
            if isinstance(v, (dict, list)) and k not in ("Line",):
                walk_keys(v, path, acc, max_depth - 1)
            elif k == "Line" and isinstance(v, list) and v:
                walk_keys(v[0], path + "[]", acc, max_depth - 1)
    elif isinstance(obj, list) and obj and isinstance(obj[0], dict):
        walk_keys(obj[0], prefix + "[]", acc, max_depth - 1)
    return acc


def useful(s):
    t = (s or "").strip()
    return bool(t) and t.upper() != "DEPOSIT"


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    report = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "db_path": DB,
        "db_bytes": os.path.getsize(DB),
        "tables": [],
        "entity_types": [],
        "line_types": [],
        "record_column_fill": {},
        "txn_json_fields": {},
        "deposit_2026": {},
        "sales_receipt_2026": {},
        "payment_2026": {},
        "journal_2026": {},
        "purchase_2026": {},
        "customer_directory": {},
        "unused_for_donors": [],
        "still_unattributed_2026_deposits": {},
    }

    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [r[0] for r in c.fetchall()]
    for t in tables:
        if t in SKIP_TABLES:
            c.execute(f'SELECT COUNT(*) n FROM "{t}"')
            report["tables"].append({"name": t, "rows": c.fetchone()["n"], "note": "skipped (secrets)"})
            continue
        c.execute(f'SELECT COUNT(*) n FROM "{t}"')
        n = c.fetchone()["n"]
        c.execute(f'PRAGMA table_info("{t}")')
        cols = [r[1] for r in c.fetchall()]
        sample = {}
        if t == "sync_state":
            c.execute(f'SELECT * FROM "{t}"')
            sample = {r["key"] if "key" in r.keys() else str(dict(r)): True for r in c.fetchall()[:20]}
            # better: dump rows without secrets
            c.execute(f'SELECT * FROM "{t}"')
            sample = []
            for r in c.fetchall():
                d = dict(r)
                sample.append({k: v for k, v in d.items() if "token" not in k.lower() and "secret" not in k.lower()})
        report["tables"].append({"name": t, "rows": n, "columns": cols, "sample": sample})

    # qbo_record columns
    c.execute("PRAGMA table_info(qbo_record)")
    rec_cols = [r[1] for r in c.fetchall()]
    c.execute("SELECT COUNT(*) n FROM qbo_record")
    rec_n = c.fetchone()["n"]
    fill = {}
    for col in rec_cols:
        if col == "raw_json":
            continue
        c.execute(f"SELECT SUM(CASE WHEN {col} IS NOT NULL AND trim(CAST({col} AS TEXT)) != '' THEN 1 ELSE 0 END) n FROM qbo_record")
        fill[col] = {"filled": c.fetchone()["n"] or 0, "pct": pct(c.fetchone()["n"] if False else fill.get(col, {}).get("filled", 0), rec_n)}
        filled = fill[col]["filled"]
        fill[col] = {"filled": filled, "pct": pct(filled, rec_n)}
    # fix fill query - I messed it up. redo properly
    fill = {}
    for col in rec_cols:
        if col == "raw_json":
            continue
        c.execute(
            f"SELECT SUM(CASE WHEN {col} IS NOT NULL AND trim(CAST({col} AS TEXT)) != '' THEN 1 ELSE 0 END) n FROM qbo_record"
        )
        filled = c.fetchone()["n"] or 0
        fill[col] = {"filled": filled, "pct": pct(filled, rec_n), "total": rec_n}
    report["record_column_fill"] = fill

    c.execute(
        """
        SELECT entity_type, COUNT(*) n,
               MIN(txn_date) min_date, MAX(txn_date) max_date,
               SUM(CASE WHEN txn_date LIKE '2026%' THEN 1 ELSE 0 END) n_2026,
               SUM(CASE WHEN name IS NOT NULL AND trim(name) != '' THEN 1 ELSE 0 END) named
        FROM qbo_record
        GROUP BY entity_type
        ORDER BY n DESC
        """
    )
    report["entity_types"] = [dict(r) for r in c.fetchall()]

    c.execute(
        """
        SELECT parent_type, COUNT(*) n,
               SUM(CASE WHEN description IS NOT NULL AND trim(description) != '' THEN 1 ELSE 0 END) with_desc,
               SUM(CASE WHEN description IS NOT NULL AND trim(description) != '' AND upper(trim(description)) != 'DEPOSIT' THEN 1 ELSE 0 END) useful_desc
        FROM qbo_line
        GROUP BY parent_type
        ORDER BY n DESC
        """
    )
    report["line_types"] = [dict(r) for r in c.fetchall()]

    # JSON key inventory per txn type (sample up to 200 headers)
    for etype in TXN_TYPES:
        c.execute("SELECT raw_json FROM qbo_record WHERE entity_type=? LIMIT 250", (etype,))
        keys = collections.Counter()
        n = 0
        header_priv = 0
        header_cust = 0
        header_doc = 0
        header_class = 0
        header_dept = 0
        for r in c.fetchall():
            raw = json.loads(r["raw_json"] or "{}")
            n += 1
            walk_keys(raw, acc=keys, max_depth=3)
            if useful(raw.get("PrivateNote")):
                header_priv += 1
            if (raw.get("CustomerRef") or {}).get("name") or raw.get("EntityRef"):
                header_cust += 1
            if raw.get("DocNumber"):
                header_doc += 1
            if raw.get("ClassRef"):
                header_class += 1
            if raw.get("DepartmentRef"):
                header_dept += 1
        top = keys.most_common(80)
        report["txn_json_fields"][etype] = {
            "sampled": n,
            "private_note_useful": header_priv,
            "customer_or_entity_ref": header_cust,
            "doc_number": header_doc,
            "class_ref": header_class,
            "department_ref": header_dept,
            "keys": [{"path": k, "in_sample": v} for k, v in top],
        }

    # Deposit 2026 deep
    c.execute(
        """
        SELECT r.id, r.txn_date, r.total_amt, r.name, r.raw_json AS header_json,
               l.amount, l.description, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
        WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
        """
    )
    dep = {
        "lines": 0,
        "entity_name": 0,
        "useful_desc": 0,
        "private_note": 0,
        "account": 0,
        "check_num": 0,
        "payment_method": 0,
        "class_ref": 0,
        "entity_or_desc": 0,
        "neither": 0,
        "platform_entity": 0,
        "donation_acct": 0,
        "neither_examples": [],
        "desc_no_entity": 0,
        "entity_no_desc": 0,
        "both": 0,
        "accounts": collections.Counter(),
        "line_detail_keys": collections.Counter(),
    }
    PLATFORM = ("better unite", "betterunite", "paypal", "square", "intuit")
    for r in c.fetchall():
        dep["lines"] += 1
        header = json.loads(r["header_json"] or "{}")
        line = json.loads(r["line_json"] or "{}")
        det = line.get("DepositLineDetail") or {}
        for k in det.keys():
            dep["line_detail_keys"][k] += 1
        ent = ((det.get("Entity") or {}).get("name") or "").strip()
        acct = ((det.get("AccountRef") or {}).get("name") or "").strip()
        desc = (r["description"] or "").strip()
        note = (header.get("PrivateNote") or "").strip()
        check = str(det.get("CheckNum") or header.get("DocNumber") or "").strip()
        pm = ((det.get("PaymentMethodRef") or {}).get("name") or "").strip()
        klass = ((det.get("ClassRef") or header.get("ClassRef") or {}).get("name") or "").strip()
        if ent:
            dep["entity_name"] += 1
        if useful(desc):
            dep["useful_desc"] += 1
        if useful(note):
            dep["private_note"] += 1
        if acct:
            dep["account"] += 1
            dep["accounts"][acct] += 1
        if check:
            dep["check_num"] += 1
        if pm:
            dep["payment_method"] += 1
        if klass:
            dep["class_ref"] += 1
        has_name = bool(ent) or useful(desc)
        if has_name:
            dep["entity_or_desc"] += 1
        else:
            dep["neither"] += 1
            if len(dep["neither_examples"]) < 25:
                dep["neither_examples"].append({
                    "date": r["txn_date"],
                    "amount": r["amount"],
                    "account": acct,
                    "header_name": r["name"],
                    "private_note": note[:80],
                    "desc": desc[:80],
                    "check": check,
                    "payment_method": pm,
                })
        if ent and useful(desc):
            dep["both"] += 1
        elif ent:
            dep["entity_no_desc"] += 1
        elif useful(desc):
            dep["desc_no_entity"] += 1
        low = ent.lower()
        if any(p in low for p in PLATFORM):
            dep["platform_entity"] += 1
        if any(k in acct.lower() for k in ("donation", "grant", "endowment", "memorial", "event")):
            dep["donation_acct"] += 1
    dep["accounts"] = dep["accounts"].most_common(30)
    dep["line_detail_keys"] = dep["line_detail_keys"].most_common()
    report["deposit_2026"] = dep

    # Sales receipts 2026
    c.execute(
        """
        SELECT r.id, r.txn_date, r.name, r.raw_json AS header_json,
               l.amount, l.description, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
        WHERE r.entity_type='SalesReceipt' AND r.txn_date LIKE '2026%'
        """
    )
    sr = {
        "lines": 0, "header_name": 0, "customer_ref": 0, "useful_desc": 0,
        "private_note": 0, "bill_email": 0, "bill_addr": 0, "phone": 0,
        "item": 0, "neither": 0, "neither_examples": [],
    }
    for r in c.fetchall():
        sr["lines"] += 1
        header = json.loads(r["header_json"] or "{}")
        line = json.loads(r["line_json"] or "{}")
        det = line.get("SalesItemLineDetail") or line.get("SalesReceiptLineDetail") or {}
        if (r["name"] or "").strip():
            sr["header_name"] += 1
        if (header.get("CustomerRef") or {}).get("name"):
            sr["customer_ref"] += 1
        if useful(r["description"]):
            sr["useful_desc"] += 1
        if useful(header.get("PrivateNote")):
            sr["private_note"] += 1
        if (header.get("BillEmail") or {}).get("Address") or header.get("BillEmail"):
            sr["bill_email"] += 1
        addr = header.get("BillAddr") or {}
        if addr.get("Line1") or addr.get("City"):
            sr["bill_addr"] += 1
        if header.get("BillAddr") and (header.get("PrimaryPhone") or {}).get("FreeFormNumber"):
            sr["phone"] += 1
        if (header.get("BillAddr") is not None) and ((header.get("PrimaryPhone") or {}).get("FreeFormNumber")):
            pass
        phone = ((header.get("BillAddr") and None) or (header.get("PrimaryPhone") or {}).get("FreeFormNumber")
                 or (header.get("CustomerMemo") or {}).get("value"))
        # PrimaryPhone
        if ((header.get("PrimaryPhone") or {}).get("FreeFormNumber")):
            sr["phone"] += 1
        item = (det.get("ItemRef") or {}).get("name")
        if item:
            sr["item"] += 1
        name = (r["name"] or "").strip() or ((header.get("CustomerRef") or {}).get("name") or "")
        if not name and not useful(r["description"]):
            sr["neither"] += 1
            if len(sr["neither_examples"]) < 10:
                sr["neither_examples"].append({"date": r["txn_date"], "amount": r["amount"], "item": item})
    report["sales_receipt_2026"] = sr

    # Payment 2026
    c.execute("SELECT COUNT(*) n FROM qbo_record WHERE entity_type='Payment' AND txn_date LIKE '2026%'")
    pay_n = c.fetchone()["n"]
    c.execute(
        """
        SELECT txn_date, name, total_amt, raw_json
        FROM qbo_record WHERE entity_type='Payment' AND txn_date LIKE '2026%'
        """
    )
    pay = {"records": pay_n, "named": 0, "private_note": 0, "customer_ref": 0, "examples": []}
    for r in c.fetchall():
        raw = json.loads(r["raw_json"] or "{}")
        if (r["name"] or "").strip():
            pay["named"] += 1
        if useful(raw.get("PrivateNote")):
            pay["private_note"] += 1
        if (raw.get("CustomerRef") or {}).get("name"):
            pay["customer_ref"] += 1
        if len(pay["examples"]) < 8:
            pay["examples"].append({
                "date": r["txn_date"], "name": r["name"], "amount": r["total_amt"],
                "note": (raw.get("PrivateNote") or "")[:60],
                "customer": (raw.get("CustomerRef") or {}).get("name"),
            })
    report["payment_2026"] = pay

    # Journal 2026
    c.execute(
        """
        SELECT r.txn_date, r.total_amt, r.raw_json AS header_json, l.amount, l.description, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='JournalEntry'
        WHERE r.entity_type='JournalEntry' AND r.txn_date LIKE '2026%'
        """
    )
    je = {"lines": 0, "useful_desc": 0, "entity_on_line": 0, "examples": []}
    for r in c.fetchall():
        je["lines"] += 1
        line = json.loads(r["line_json"] or "{}")
        det = line.get("JournalEntryLineDetail") or {}
        ent = ((det.get("Entity") or {}).get("name") or "")
        if useful(r["description"]):
            je["useful_desc"] += 1
        if ent:
            je["entity_on_line"] += 1
            if len(je["examples"]) < 12:
                je["examples"].append({
                    "date": r["txn_date"], "amount": r["amount"],
                    "entity": ent, "desc": (r["description"] or "")[:80],
                    "account": ((det.get("AccountRef") or {}).get("name") or ""),
                })
    report["journal_2026"] = je

    # Purchase (checks written / expenses) 2026 — not donor income but names exist
    c.execute(
        """
        SELECT COUNT(*) n,
               SUM(CASE WHEN name IS NOT NULL AND trim(name) != '' THEN 1 ELSE 0 END) named
        FROM qbo_record WHERE entity_type='Purchase' AND txn_date LIKE '2026%'
        """
    )
    report["purchase_2026"] = dict(c.fetchone())

    # Customer directory
    c.execute("SELECT raw_json FROM qbo_record WHERE entity_type='Customer'")
    cust = {
        "n": 0, "display_name": 0, "email": 0, "phone": 0, "mobile": 0,
        "bill_addr": 0, "notes": 0, "company": 0, "parent": 0,
        "balance": 0, "active": 0,
    }
    for r in c.fetchall():
        raw = json.loads(r["raw_json"] or "{}")
        cust["n"] += 1
        if useful(raw.get("DisplayName") or raw.get("FullyQualifiedName")):
            cust["display_name"] += 1
        if (raw.get("PrimaryEmailAddr") or {}).get("Address"):
            cust["email"] += 1
        if (raw.get("PrimaryPhone") or {}).get("FreeFormNumber"):
            cust["phone"] += 1
        if (raw.get("Mobile") or {}).get("FreeFormNumber"):
            cust["mobile"] += 1
        addr = raw.get("BillAddr") or {}
        if addr.get("Line1") or addr.get("City"):
            cust["bill_addr"] += 1
        if useful(raw.get("Notes")):
            cust["notes"] += 1
        if useful(raw.get("CompanyName")):
            cust["company"] += 1
        if raw.get("ParentRef"):
            cust["parent"] += 1
        if raw.get("Balance"):
            cust["balance"] += 1
        if raw.get("Active") is True or raw.get("Active") == "true":
            cust["active"] += 1
    report["customer_directory"] = cust

    # Vendor similarly brief
    c.execute("SELECT COUNT(*) n FROM qbo_record WHERE entity_type='Vendor'")
    report["vendor_count"] = c.fetchone()["n"]
    c.execute("SELECT COUNT(*) n FROM qbo_record WHERE entity_type='Item'")
    report["item_count"] = c.fetchone()["n"]
    c.execute("SELECT COUNT(*) n FROM qbo_record WHERE entity_type='Account'")
    report["account_count"] = c.fetchone()["n"]

    # Date span overall
    c.execute("SELECT MIN(txn_date) min_d, MAX(txn_date) max_d FROM qbo_record WHERE txn_date IS NOT NULL AND txn_date != ''")
    report["txn_date_span"] = dict(c.fetchone())

    # Years
    c.execute(
        """
        SELECT substr(txn_date,1,4) year, COUNT(*) n
        FROM qbo_record
        WHERE txn_date IS NOT NULL AND txn_date != ''
        GROUP BY year ORDER BY year
        """
    )
    report["records_by_year"] = [dict(r) for r in c.fetchall()]

    # bank_statement
    try:
        c.execute("PRAGMA table_info(bank_statement)")
        bcols = [r[1] for r in c.fetchall()]
        c.execute("SELECT COUNT(*) n, MIN(posted_date) min_d, MAX(posted_date) max_d FROM bank_statement")
        brow = dict(c.fetchone())
        report["bank_statement"] = {"columns": bcols, **brow}
    except Exception as e:
        report["bank_statement"] = {"error": str(e)}
        # try other date col
        try:
            c.execute("SELECT * FROM bank_statement LIMIT 1")
            row = c.fetchone()
            report["bank_statement"] = {"columns": list(row.keys()) if row else bcols, "sample_keys": list(dict(row).keys()) if row else []}
        except Exception as e2:
            report["bank_statement"] = {"error": str(e), "error2": str(e2)}

    conn.close()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
