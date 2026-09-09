import sqlite3
import json
from collections import Counter

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT entity_type, COUNT(*) n FROM qbo_record GROUP BY entity_type ORDER BY n DESC")
print("=== entity types ===")
for r in c.fetchall():
    print(f"  {r['entity_type']}: {r['n']}")

c.execute("SELECT parent_type, COUNT(*) n FROM qbo_line GROUP BY parent_type ORDER BY n DESC")
print("\n=== line parent types ===")
for r in c.fetchall():
    print(f"  {r['parent_type']}: {r['n']}")

print("\n=== Deposit records 2026 ===")
c.execute("""
SELECT id, txn_date, total_amt, name, customer_id
FROM qbo_record
WHERE entity_type='Deposit' AND txn_date LIKE '2026%'
ORDER BY txn_date
""")
deposits = list(c.fetchall())
print("count", len(deposits))

# Line quality for deposits
c.execute("""
SELECT
  SUM(CASE WHEN description IS NULL OR trim(description)='' THEN 1 ELSE 0 END) empty_desc,
  SUM(CASE WHEN description IS NOT NULL AND trim(description)!='' THEN 1 ELSE 0 END) with_desc,
  COUNT(*) n
FROM qbo_line
WHERE parent_type='Deposit'
""")
print("deposit lines", dict(c.fetchone()))

print("\n=== sample 2026 deposit lines with descriptions ===")
c.execute("""
SELECT r.txn_date, r.total_amt, r.name AS header_name, l.amount, l.description, l.account_id, l.detail_type
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.txn_date LIKE '2026%'
ORDER BY r.txn_date, l.line_num
LIMIT 40
""")
for r in c.fetchall():
    print(f"{r['txn_date']} hdr={r['header_name']!r} line=${r['amount']} acct={r['account_id']} desc={r['description']!r}")

print("\n=== unlabeled GL-like amounts: 22605, 8368, 4000, 7429.1, 12555.48 ===")
targets = (22605, 8368, 4000, 7429.1, 12555.48, 8479.38, 10000, 17620)
c.execute("""
SELECT r.id, r.txn_date, r.total_amt, r.name, r.raw_json
FROM qbo_record r
WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
""")
rows = c.fetchall()
for r in rows:
    amt = float(r["total_amt"] or 0)
    if any(abs(amt - t) < 0.05 for t in targets):
        raw = json.loads(r["raw_json"] or "{}")
        private = raw.get("PrivateNote") or raw.get("DocNumber") or ""
        lines = raw.get("Line") or []
        print(f"\nDeposit {r['id']} {r['txn_date']} total={amt} name={r['name']!r} private={private!r} nlines={len(lines)}")
        for ln in lines:
            det = ln.get("DepositLineDetail") or {}
            ent = (det.get("Entity") or {}).get("name") or (det.get("EntityRef") or {}).get("name")
            acct = (det.get("AccountRef") or {}).get("name")
            print(f"  ${ln.get('Amount')} desc={ln.get('Description')!r} entity={ent!r} acct={acct!r} class={(det.get('ClassRef') or {}).get('name')!r}")

print("\n=== 2026 deposit line description uniqueness ===")
c.execute("""
SELECT COALESCE(NULLIF(trim(l.description),''), '[BLANK]') desc, COUNT(*) n, SUM(l.amount) tot
FROM qbo_line l
JOIN qbo_record r ON r.id=l.parent_id AND r.entity_type='Deposit'
WHERE r.txn_date LIKE '2026%'
GROUP BY 1
ORDER BY tot DESC
LIMIT 30
""")
for r in c.fetchall():
    print(f"  {r['n']:4}  ${r['tot']:>10.2f}  {r['desc']}")

print("\n=== Deposit raw keys sample ===")
c.execute("SELECT raw_json FROM qbo_record WHERE entity_type='Deposit' AND txn_date LIKE '2026%' LIMIT 1")
raw = json.loads(c.fetchone()[0])
print(sorted(raw.keys()))
line0 = (raw.get("Line") or [{}])[0]
print("line0 keys", sorted(line0.keys()))
print("DepositLineDetail keys", sorted((line0.get("DepositLineDetail") or {}).keys()))
