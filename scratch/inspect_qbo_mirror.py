import sqlite3
import os
import json

p = r"E:\qbbackup\qbo_mirror.db"
print("exists", os.path.exists(p), "size", os.path.getsize(p) if os.path.exists(p) else None)
if not os.path.exists(p):
    raise SystemExit(0)

conn = sqlite3.connect(p)
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in c.fetchall()]
print("tables", len(tables))
for t in tables:
    c.execute(f'SELECT COUNT(*) FROM "{t}"')
    n = c.fetchone()[0]
    c.execute(f'PRAGMA table_info("{t}")')
    cols = [r[1] for r in c.fetchall()]
    print(f"  {t}: {n} rows | {cols[:24]}")

# Hunt deposit-like tables
for t in tables:
    low = t.lower()
    if any(k in low for k in ("deposit", "sales", "journal", "invoice", "payment", "line", "txn", "transact")):
        print("\n=== sample", t, "===")
        c.execute(f'SELECT * FROM "{t}" LIMIT 1')
        row = c.fetchone()
        if row:
            d = dict(row)
            for k, v in d.items():
                s = str(v)
                if len(s) > 240:
                    s = s[:240] + "..."
                print(f"  {k}: {s}")
