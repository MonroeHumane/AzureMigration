import json
import sqlite3

c = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
c.row_factory = sqlite3.Row
print("=== target accounts ===")
needles = (
    "merchant",
    "software",
    "laundry",
    "government grant",
    "foundation grant",
    "retail partner",
    "uncategorized income",
    "foundation grants",
)
for r in c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'"):
    raw = json.loads(r["raw_json"] or "{}")
    fq = raw.get("FullyQualifiedName") or r["name"] or ""
    if any(x in fq.lower() for x in needles):
        print(r["id"], fq, raw.get("AccountType"), "active", raw.get("Active"))

print("\n=== deposit 3026 ===")
raw = c.execute("SELECT raw_json FROM qbo_record WHERE entity_type='Deposit' AND id='3026'").fetchone()
h = json.loads(raw[0])
for ln in h.get("Line") or []:
    det = ln.get("DepositLineDetail") or {}
    print(
        ln.get("Id"),
        ln.get("Amount"),
        (det.get("Entity") or {}).get("name"),
        (det.get("AccountRef") or {}).get("value"),
        (det.get("AccountRef") or {}).get("name"),
        ln.get("Description"),
    )
