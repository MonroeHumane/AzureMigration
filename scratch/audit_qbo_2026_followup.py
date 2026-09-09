"""Follow-up: leftover 2026 category oddities the first pass missed."""
from __future__ import annotations

import json
import sqlite3
from collections import defaultdict

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

accounts = {}
for r in c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'"):
    raw = json.loads(r["raw_json"] or "{}")
    accounts[str(r["id"])] = raw.get("FullyQualifiedName") or raw.get("Name") or r["name"]


def acct_of(line):
    det = (
        line.get("DepositLineDetail")
        or line.get("SalesItemLineDetail")
        or line.get("AccountBasedExpenseLineDetail")
        or line.get("JournalEntryLineDetail")
        or line.get("ItemBasedExpenseLineDetail")
        or {}
    )
    ref = det.get("AccountRef") or det.get("ItemAccountRef") or {}
    aid = str(ref.get("value") or "")
    return aid, ref.get("name") or accounts.get(aid) or ""


needles = [
    "unv",
    "thrivent",
    "laundry",
    "godaddy",
    "canva",
    "authnet",
    "square inc",
    "kroger",
    "meijer",
    "gas",
    "speedway",
    "ask my accountant",
    "uncategorized",
    "pet return",
    "family dollar",
    "ebay",
    "cincinnati",
    "paws clinic",
    "blackbaud",
    "zeffy",
    "paypal *",
    "dog bank",
    "recycling",
    "interest",
]
print("=== keyword hits 2026 (P&L-ish) ===")
c.execute(
    """
    SELECT r.id, r.entity_type, r.txn_date, r.name, r.total_amt, l.amount, l.description, l.raw_json, r.raw_json as header
    FROM qbo_record r
    JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type=r.entity_type
    WHERE substr(r.txn_date,1,4)='2026'
    """
)
hits = []
other_exp = []
for r in c.fetchall():
    header = json.loads(r["header"] or "{}")
    line = json.loads(r["raw_json"] or "{}")
    aid, aname = acct_of(line)
    blob = " ".join(
        [
            r["description"] or "",
            r["name"] or "",
            aname,
            header.get("PrivateNote") or "",
            str((header.get("VendorRef") or {}).get("name") or ""),
            str(((line.get("DepositLineDetail") or {}).get("Entity") or {}).get("name") or ""),
        ]
    ).lower()
    if "other expense" in (aname or "").lower():
        other_exp.append((r["txn_date"], r["id"], r["amount"], aname, r["name"], r["description"]))
    for n in needles:
        if n in blob:
            hits.append((n, r["txn_date"], r["entity_type"], r["id"], float(r["amount"] or 0), aname, (r["description"] or r["name"] or "")[:70]))
            break

from collections import Counter
print("needle counts", Counter(h[0] for h in hits))
print("\n-- other expense lines --")
for row in other_exp[:40]:
    print(" ", row)

print("\n-- notable keyword rows --")
for n in ["thrivent", "unv", "laundry", "kroger", "authnet", "godaddy", "canva", "cincinnati", "paws clinic", "blackbaud", "zeffy", "pet return", "ebay", "family dollar"]:
    rows = [h for h in hits if h[0] == n]
    if not rows:
        continue
    print(f"\n{n} ({len(rows)})")
    for h in rows[:12]:
        print(f"  {h[1]} {h[2]} {h[3]} ${h[4]:.2f} | {h[5]} | {h[6]}")

print("\n=== 2026 income accounts with unnamed lines >= $200 ===")
c.execute(
    """
    SELECT r.id, r.entity_type, r.txn_date, l.amount, l.description, l.raw_json, r.raw_json as header
    FROM qbo_record r
    JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type=r.entity_type
    WHERE substr(r.txn_date,1,4)='2026'
    """
)
unnamed = []
for r in c.fetchall():
    header = json.loads(r["header"] or "{}")
    line = json.loads(r["raw_json"] or "{}")
    aid, aname = acct_of(line)
    atype = (accounts.get(aid) and "")  # skip
    det = line.get("DepositLineDetail") or {}
    ent = (det.get("Entity") or {}).get("name") or ""
    desc = (r["description"] or "").strip()
    note = (header.get("PrivateNote") or "").strip()
    amt = float(r["amount"] or 0)
    if amt < 200:
        continue
    if "donation" in (aname or "").lower() or "contributed" in (aname or "").lower():
        if not ent and (not desc or desc.upper() == "DEPOSIT") and not note:
            unnamed.append((r["txn_date"], r["id"], amt, aname, r["entity_type"]))
print("unnamed donation lines", len(unnamed))
for u in sorted(unnamed, key=lambda x: -x[2])[:20]:
    print(" ", u)

print("\n=== Account 54 vs 118 vs 55 vs 79 vs 1150040043 2026 totals ===")
want = {"54": "individuals", "118": "memorial", "55": "corporate", "79": "??", "1150040043": "kroger rebate"}
# find foundation grants id
for r in c.execute("SELECT id, name FROM qbo_record WHERE entity_type='Account'"):
    n = (r["name"] or "").lower()
    if "foundation" in n or "government" in n or "endowment" in n or "grant" in n:
        print(" acct", r["id"], r["name"])
