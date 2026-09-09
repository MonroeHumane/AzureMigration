import json
import sqlite3

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT raw_json FROM qbo_record WHERE entity_type='Vendor'")
n = email = phone = addr = notes = 0
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    n += 1
    if (raw.get("PrimaryEmailAddr") or {}).get("Address"):
        email += 1
    if (raw.get("PrimaryPhone") or {}).get("FreeFormNumber"):
        phone += 1
    a = raw.get("BillAddr") or {}
    if a.get("Line1") or a.get("City"):
        addr += 1
    if raw.get("AcctNum") or raw.get("Notes"):
        notes += 1
print(json.dumps({"vendors": n, "email": email, "phone": phone, "addr": addr, "notes": notes}))

c.execute("""
SELECT l.raw_json FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
""")
named = checks = 0
for r in c.fetchall():
    det = json.loads(r["raw_json"] or "{}").get("DepositLineDetail") or {}
    name = ((det.get("Entity") or {}).get("name") or "").strip()
    if not name:
        continue
    if any(p in name.lower() for p in ("better", "paypal", "square", "intuit")):
        continue
    named += 1
    if det.get("CheckNum"):
        checks += 1
print(json.dumps({"named_nonplatform_lines": named, "with_checknum": checks}))
