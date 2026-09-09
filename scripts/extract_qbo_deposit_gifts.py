"""Pull named 2024–2026 Deposit / SalesReceipt gifts from the local QBO mirror.

The General Ledger report often blanks Name/Memo on deposit splits
('Branch Deposit Batch'). The Deposit entity API still has
DepositLineDetail.Entity.name, Line.Description, PrivateNote,
CheckNum, PaymentMethodRef, and ClassRef.

Also dumps a Customer/Vendor contact directory in the same JSON
(server-side compile only — never write into frontend/src/data).

Usage:
  python scripts/extract_qbo_deposit_gifts.py [outfile.json]
Env:
  QBO_MIRROR_DB  default E:\\qbbackup\\qbo_mirror.db
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import sys

DB_PATH = os.environ.get("QBO_MIRROR_DB", r"E:\qbbackup\qbo_mirror.db")
YEARS = ("2024", "2025", "2026")

SKIP_ENTITY_RE = re.compile(
    r"better\s*unite|paypal|square(\s+inc)?$|^intuit\b|branch deposit batch|"
    r"^deposit$|public\s*/\s*shelter adopters|quickbooks journal|\bzeffy\b",
    re.I,
)
SKIP_ACCT_RE = re.compile(
    r"adoption|merchandise|swag|cremation|recycling proceeds",
    re.I,
)
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z.'-]*$")
FILLER_RE = re.compile(r"^(AND|&|OF|THE|SON|FOR)$", re.I)


def skip_entity(name: str) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    return bool(SKIP_ENTITY_RE.search(n))


def skip_account(acct: str) -> bool:
    return bool(SKIP_ACCT_RE.search(acct or ""))


def looks_like_named_donor(raw: str) -> bool:
    t = re.sub(r"\s+", " ", raw or "").strip()
    if len(t) < 5 or len(t) > 80:
        return False
    words = t.split(" ")
    if len(words) < 2:
        return False
    return all(WORD_RE.match(w) or FILLER_RE.match(w) for w in words)


def useful_text(*parts: str) -> str:
    for p in parts:
        t = (p or "").strip()
        if t and t.upper() != "DEPOSIT":
            return t
    return ""


def ref_name(obj) -> str:
    if not isinstance(obj, dict):
        return ""
    return str(obj.get("name") or "").strip()


def ref_value(obj) -> str:
    if not isinstance(obj, dict):
        return ""
    return str(obj.get("value") or "").strip()


def format_address(addr) -> str:
    if not isinstance(addr, dict):
        return ""
    city_line = " ".join(
        p for p in (
            str(addr.get("City") or "").strip(),
            str(addr.get("CountrySubDivisionCode") or "").strip(),
            str(addr.get("PostalCode") or "").strip(),
        ) if p
    )
    parts = [
        str(addr.get("Line1") or "").strip(),
        str(addr.get("Line2") or "").strip(),
        city_line,
    ]
    joined = ", ".join(p for p in parts if p)
    joined = ", ".join(bit.strip() for bit in joined.split(",") if bit.strip())
    if not joined or joined.upper() in {"MI"} or len(joined) <= 3:
        return ""
    return joined


def gift_from_line(
    txn_date,
    amount,
    entity,
    desc,
    acct,
    qbo_type,
    private_note,
    parent_id,
    line_id,
    doc,
    *,
    check_num="",
    payment_method="",
    qbo_class="",
    entity_type="",
    entity_id="",
):
    name = (entity or "").strip()
    desc = (desc or "").strip()
    note = (private_note or "").strip()
    if skip_entity(name):
        # Description sometimes carries the donor when Entity is blank.
        if looks_like_named_donor(desc) and not skip_entity(desc):
            name = desc
        else:
            return None
    if skip_account(acct):
        return None
    try:
        amt = float(amount or 0)
    except (TypeError, ValueError):
        return None
    if amt <= 0:
        return None
    memo = useful_text(desc, note)
    check = str(check_num or "").strip() or str(doc or "").strip()
    return {
        "date": txn_date,
        "amount": round(amt, 2),
        "donorName": name,
        "memo": memo,
        "description": desc,
        "account": acct or "",
        "qboType": qbo_type,
        "reference": check or str(parent_id),
        "checkNum": check,
        "paymentMethod": (payment_method or "").strip(),
        "qboClass": (qbo_class or "").strip(),
        "entityType": str(entity_type or "").strip().upper(),
        "entityId": str(entity_id or "").strip(),
        "source": "QuickBooks Online",
        "parentId": str(parent_id),
        "lineId": str(line_id or ""),
        "privateNote": note,
    }


def year_clause(alias: str = "r") -> tuple[str, tuple[str, ...]]:
    placeholders = ",".join("?" * len(YEARS))
    return f"substr({alias}.txn_date,1,4) IN ({placeholders})", YEARS


def extract_directory(c: sqlite3.Cursor) -> dict:
    customers = []
    c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Customer'")
    for r in c.fetchall():
        raw = json.loads(r["raw_json"] or "{}")
        display = (raw.get("DisplayName") or r["name"] or "").strip()
        if not display:
            continue
        email = ((raw.get("PrimaryEmailAddr") or {}).get("Address") or "").strip()
        phone = (
            ((raw.get("PrimaryPhone") or {}).get("FreeFormNumber") or "")
            or ((raw.get("Mobile") or {}).get("FreeFormNumber") or "")
            or ((raw.get("AlternatePhone") or {}).get("FreeFormNumber") or "")
        ).strip()
        customers.append({
            "id": str(raw.get("Id") or r["id"] or "").strip(),
            "displayName": display,
            "email": email,
            "phone": phone,
            "address": format_address(raw.get("BillAddr") or {}),
            "notes": str(raw.get("Notes") or "").strip(),
        })

    vendors = []
    c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Vendor'")
    for r in c.fetchall():
        raw = json.loads(r["raw_json"] or "{}")
        display = (raw.get("DisplayName") or r["name"] or "").strip()
        if not display:
            continue
        email = ((raw.get("PrimaryEmailAddr") or {}).get("Address") or "").strip()
        phone = (
            ((raw.get("PrimaryPhone") or {}).get("FreeFormNumber") or "")
            or ((raw.get("Mobile") or {}).get("FreeFormNumber") or "")
            or ((raw.get("AlternatePhone") or {}).get("FreeFormNumber") or "")
        ).strip()
        vendors.append({
            "id": str(raw.get("Id") or r["id"] or "").strip(),
            "displayName": display,
            "email": email,
            "phone": phone,
            "address": format_address(raw.get("BillAddr") or {}),
            "notes": str(raw.get("Notes") or raw.get("AcctNum") or "").strip(),
        })

    return {"customers": customers, "vendors": vendors}


def extract(years: tuple[str, ...] = YEARS) -> dict:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    gifts = []
    year_sql, year_params = year_clause("r")

    c.execute(
        f"""
        SELECT r.id, r.txn_date, r.total_amt, r.raw_json AS header_json,
               l.amount, l.description, l.line_id, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
        WHERE r.entity_type='Deposit' AND {year_sql}
        """,
        year_params,
    )
    for r in c.fetchall():
        header = json.loads(r["header_json"] or "{}")
        line = json.loads(r["line_json"] or "{}")
        det = line.get("DepositLineDetail") or {}
        entity_obj = det.get("Entity") or {}
        entity = entity_obj.get("name") or ""
        acct = ref_name(det.get("AccountRef"))
        g = gift_from_line(
            r["txn_date"], r["amount"], entity, r["description"], acct,
            "Deposit", header.get("PrivateNote") or "", r["id"], r["line_id"],
            header.get("DocNumber"),
            check_num=det.get("CheckNum") or "",
            payment_method=ref_name(det.get("PaymentMethodRef")) or ref_name(header.get("PaymentMethodRef")),
            qbo_class=ref_name(det.get("ClassRef")) or ref_name(header.get("ClassRef")),
            entity_type=entity_obj.get("type") or "",
            entity_id=entity_obj.get("value") or "",
        )
        if g:
            gifts.append(g)

    c.execute(
        f"""
        SELECT r.id, r.txn_date, r.name, r.raw_json AS header_json,
               l.amount, l.description, l.line_id, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
        WHERE r.entity_type='SalesReceipt' AND {year_sql}
        """,
        year_params,
    )
    for r in c.fetchall():
        header = json.loads(r["header_json"] or "{}")
        line = json.loads(r["line_json"] or "{}")
        det = line.get("SalesItemLineDetail") or line.get("SalesReceiptLineDetail") or {}
        acct = ref_name(det.get("ItemAccountRef") or det.get("AccountRef"))
        cust = header.get("CustomerRef") or {}
        entity = (r["name"] or "").strip() or (cust.get("name") or "")
        g = gift_from_line(
            r["txn_date"], r["amount"], entity, r["description"], acct,
            "Sales Receipt", header.get("PrivateNote") or "", r["id"], r["line_id"],
            header.get("DocNumber"),
            check_num=header.get("DocNumber") or det.get("CheckNum") or "",
            payment_method=ref_name(header.get("PaymentMethodRef")),
            qbo_class=ref_name(det.get("ClassRef")) or ref_name(header.get("ClassRef")),
            entity_type="CUSTOMER" if (cust.get("value") or cust.get("name")) else "",
            entity_id=cust.get("value") or "",
        )
        if g:
            gifts.append(g)

    directory = extract_directory(c)
    conn.close()
    return {
        "years": list(years),
        "count": len(gifts),
        "namedBlankMemo": sum(
            1 for g in gifts if not g["description"] or g["description"].upper() == "DEPOSIT"
        ),
        "directory": directory,
        "gifts": gifts,
    }


def main() -> None:
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "scratch", "qbo_named_gifts_2024_2026.json"
    )
    payload = extract(YEARS)
    os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    dirn = payload.get("directory") or {}
    print(
        f"wrote {out} gifts={payload['count']} namedBlankMemo={payload['namedBlankMemo']} "
        f"customers={len(dirn.get('customers') or [])} vendors={len(dirn.get('vendors') or [])}"
    )


if __name__ == "__main__":
    main()
