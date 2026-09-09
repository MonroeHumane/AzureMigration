import json
import sqlite3

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row

SKIP_ENTITIES = {
    "BETTER UNITE", "BetterUnite", "Paypal", "PayPal", "SQUARE", "Square Inc",
    "INTUIT *", "Branch Deposit Batch",
}

SKIP_ACCT = (
    "animal adoptions",
    "adoption",
    "merchandise",
    "swag",
)

def skip_account(acct: str) -> bool:
    a = (acct or "").lower()
    return any(k in a for k in SKIP_ACCT)


def gift_from_line(txn_date, amount, entity, desc, acct, qbo_type, private_note, parent_id, line_id, doc):
    name = (entity or "").strip()
    if not name or name in SKIP_ENTITIES:
        return None
    if skip_account(acct):
        return None
    amt = float(amount or 0)
    if amt <= 0:
        return None
    memo = (desc or "").strip()
    if not memo or memo.upper() == "DEPOSIT":
        memo = (private_note or "").strip() or memo
    return {
        "date": txn_date,
        "amount": round(amt, 2),
        "donorName": name,
        "memo": memo,
        "description": (desc or "").strip(),
        "account": acct or "",
        "qboType": qbo_type,
        "reference": str(doc or "") or str(parent_id),
        "source": "QuickBooks Online",
        "parentId": str(parent_id),
        "lineId": str(line_id or ""),
        "privateNote": (private_note or "").strip(),
    }


c = conn.cursor()
gifts = []

# Deposits
c.execute("""
SELECT r.id, r.txn_date, r.total_amt, r.raw_json AS header_json, l.amount, l.description, l.line_id, l.raw_json AS line_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
""")
for r in c.fetchall():
    header = json.loads(r["header_json"] or "{}")
    line = json.loads(r["line_json"] or "{}")
    det = line.get("DepositLineDetail") or {}
    entity = (det.get("Entity") or {}).get("name") or ""
    acct = (det.get("AccountRef") or {}).get("name") or ""
    g = gift_from_line(
        r["txn_date"], r["amount"], entity, r["description"], acct,
        "Deposit", header.get("PrivateNote") or "", r["id"], r["line_id"], header.get("DocNumber"),
    )
    if g:
        gifts.append(g)

# Sales receipts (customer on header)
c.execute("""
SELECT r.id, r.txn_date, r.name, r.raw_json AS header_json, l.amount, l.description, l.line_id, l.raw_json AS line_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
WHERE r.entity_type='SalesReceipt' AND r.txn_date LIKE '2026%'
""")
for r in c.fetchall():
    header = json.loads(r["header_json"] or "{}")
    line = json.loads(r["line_json"] or "{}")
    det = line.get("SalesItemLineDetail") or line.get("SalesReceiptLineDetail") or {}
    acct = ((det.get("ItemAccountRef") or det.get("AccountRef") or {}).get("name")) or ""
    entity = (r["name"] or "").strip() or ((header.get("CustomerRef") or {}).get("name") or "")
    g = gift_from_line(
        r["txn_date"], r["amount"], entity, r["description"], acct,
        "Sales Receipt", header.get("PrivateNote") or "", r["id"], r["line_id"], header.get("DocNumber"),
    )
    if g:
        gifts.append(g)

payload = {
    "count": len(gifts),
    "namedBlankMemo": sum(1 for g in gifts if not g["description"] or g["description"].upper() == "DEPOSIT"),
    "gifts": gifts,
}
out = r"C:\Users\Jeff\Documents\AzureMigration\scratch\qbo_named_gifts_2026.json"
with open(out, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)
print(f"wrote {out} gifts={len(gifts)} namedBlankMemo={payload['namedBlankMemo']}")
