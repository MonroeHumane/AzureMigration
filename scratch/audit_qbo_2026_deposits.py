import json, sqlite3
conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

def dump_deposit(pid):
    r = c.execute("SELECT txn_date, total_amt, raw_json FROM qbo_record WHERE entity_type='Deposit' AND id=?", (pid,)).fetchone()
    if not r:
        print("missing", pid); return
    h = json.loads(r["raw_json"] or "{}")
    print(f"\n=== Deposit {pid} {r['txn_date']} total={r['total_amt']} ===")
    print("note:", (h.get("PrivateNote") or "")[:120])
    for ln in h.get("Line") or []:
        det = ln.get("DepositLineDetail") or {}
        print(f"  {ln.get('Amount')} {(det.get('Entity') or {}).get('name')} | {(det.get('AccountRef') or {}).get('name')} | {ln.get('Description')}")

for pid in ["5100", "5497", "6146", "5846", "5085", "5817", "6100"]:
    dump_deposit(pid)

print("\n=== FOUNDATION / grants 2026 ===")
for r in c.execute("SELECT id, name FROM qbo_record WHERE entity_type='Account'"):
    n = (r["name"] or "")
    if "FOUNDATION" in n.upper() or "grant" in n.lower() or "Endowment" in n:
        print(r["id"], n)

print("\n=== Gas account type ===")
for r in c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'"):
    raw = json.loads(r["raw_json"] or "{}")
    fq = raw.get("FullyQualifiedName") or r["name"] or ""
    if fq.lower().endswith(":gas") or fq.lower() == "gas":
        print(r["id"], fq, raw.get("AccountType"), raw.get("Classification"))

print("\n=== Laundry accounts ===")
for r in c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'"):
    raw = json.loads(r["raw_json"] or "{}")
    fq = raw.get("FullyQualifiedName") or r["name"] or ""
    if "laundry" in fq.lower():
        print(r["id"], fq, raw.get("AccountType"))
