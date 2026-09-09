import sqlite3
import json

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== Entity on 2026 deposit lines with blank/DEPOSIT description ===")
c.execute("""
SELECT r.id, r.txn_date, r.total_amt, l.amount, l.description, l.raw_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.txn_date LIKE '2026%'
  AND (l.description IS NULL OR trim(l.description)='' OR upper(trim(l.description))='DEPOSIT')
ORDER BY l.amount DESC
""")
rows = list(c.fetchall())
print("lines", len(rows))
with_entity = 0
named = []
for r in rows:
    raw = json.loads(r["raw_json"] or "{}")
    det = raw.get("DepositLineDetail") or {}
    ent = det.get("Entity") or {}
    name = ent.get("name") or ""
    acct = (det.get("AccountRef") or {}).get("name") or ""
    if name:
        with_entity += 1
        named.append((r["txn_date"], r["amount"], name, acct, r["description"]))
print("blank/DEPOSIT lines WITH entity name", with_entity)
for item in named[:40]:
    print(" ", item)

print("\n=== June 2 22605 and Jan 8 8368 and Apr 22 4000 full dumps ===")
c.execute("""
SELECT id, txn_date, total_amt, name, raw_json
FROM qbo_record
WHERE entity_type='Deposit' AND txn_date LIKE '2026%'
""")
want = {
    ("2026-06-02", 22605.0),
    ("2026-01-08", 8368.0),
    ("2026-04-22", 4000.0),
    ("2026-02-03", 3000.0),
    ("2026-06-02", 2960.0),
}
for r in c.fetchall():
    amt = float(r["total_amt"] or 0)
    key = (r["txn_date"], round(amt, 2))
    if any(r["txn_date"] == d and abs(amt - a) < 0.05 for d, a in want):
        raw = json.loads(r["raw_json"] or "{}")
        print(f"\nDeposit {r['id']} {r['txn_date']} ${amt} PrivateNote={raw.get('PrivateNote')!r}")
        for ln in raw.get("Line") or []:
            det = ln.get("DepositLineDetail") or {}
            ent = (det.get("Entity") or {}).get("name")
            acct = (det.get("AccountRef") or {}).get("name")
            print(f"  ${ln.get('Amount')} desc={ln.get('Description')!r} entity={ent!r} acct={acct!r}")

print("\n=== Search customers/deposits for CLARK, VERMEER, COLUMBUS, GOINGE, CHRISTINE BOTTLE ===")
needles = ("CLARK", "VERMEER", "COLUMBUS", "GOINGE", "BOTTLE", "ROSEMARIE", "WALKER", "THRIVENT")
c.execute("SELECT id, entity_type, name, txn_date, total_amt FROM qbo_record WHERE name IS NOT NULL")
for r in c.fetchall():
    n = (r["name"] or "")
    if any(x.lower() in n.lower() for x in needles):
        if r["entity_type"] in ("Customer", "Deposit", "SalesReceipt", "Purchase"):
            print(f"  {r['entity_type']:14} {r['txn_date'] or '':12} ${r['total_amt'] or 0:>10}  {n}")

print("\n=== 2026 deposit lines whose entity name is set ===")
c.execute("""
SELECT r.txn_date, l.amount, l.description, l.raw_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.txn_date LIKE '2026%'
""")
ent_count = 0
examples = []
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    name = ((raw.get("DepositLineDetail") or {}).get("Entity") or {}).get("name") or ""
    if name:
        ent_count += 1
        if len(examples) < 25:
            examples.append((r["txn_date"], r["amount"], name, r["description"]))
print("lines with Entity.name", ent_count)
for e in examples:
    print(" ", e)

print("\n=== SalesReceipt 2026 descriptions ===")
c.execute("""
SELECT r.txn_date, r.total_amt, r.name, l.amount, l.description
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
WHERE r.txn_date LIKE '2026%'
ORDER BY r.txn_date
LIMIT 20
""")
for r in c.fetchall():
    print(f"  {r['txn_date']} hdr={r['name']!r} ${r['amount']} desc={r['description']!r}")
c.execute("""
SELECT COUNT(*) n,
  SUM(CASE WHEN description IS NULL OR trim(description)='' THEN 1 ELSE 0 END) blank
FROM qbo_line WHERE parent_type='SalesReceipt'
""")
print("salesreceipt lines", dict(c.fetchone()))
