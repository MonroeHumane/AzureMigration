"""Resolve live QBO ids needed to post the 9/7/26 slip deposit. Never print tokens."""
from __future__ import annotations

import json
import sqlite3

DB = r"E:\qbbackup\qbo_mirror.db"

ACCOUNT_NEEDLES = [
    "first merchants",
    "memorial donations",
    "corporate donations",
    "donations directed by individuals",
    "retail partner rebates",
]
CUSTOMER_NEEDLES = [
    "cathy a. campbell",
    "cathy campbell",
    "spurlock",
    "zorn",
    "promedica",
    "kroger",
    "durchman",
    "swy",
    "jenkins",
    "haupricht",
    "cothren",
    "catherine a. miller",
    "catherine miller",
    "branch cash",
    "cash drawer",
]

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

print("=== Accounts ===")
c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'")
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    fq = (raw.get("FullyQualifiedName") or r["name"] or "")
    active = raw.get("Active", True)
    acct_type = raw.get("AccountType") or ""
    blob = fq.lower()
    if any(n in blob for n in ACCOUNT_NEEDLES) or r["id"] == "111":
        print(
            f"  id={r['id']} type={acct_type} active={active} name={fq!r} "
            f"class={raw.get('Classification')}"
        )

print("\n=== Payment methods ===")
c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='PaymentMethod'")
rows = list(c.fetchall())
if not rows:
    print("  (no PaymentMethod rows in mirror)")
else:
    for r in rows:
        raw = json.loads(r["raw_json"] or "{}")
        print(f"  id={r['id']} name={raw.get('Name') or r['name']!r} type={raw.get('Type')}")

print("\n=== Classes ===")
c.execute("SELECT id, name FROM qbo_record WHERE entity_type='Class'")
for r in c.fetchall():
    print(f"  id={r['id']} name={r['name']}")

print("\n=== Matching customers / vendors ===")
c.execute("SELECT id, entity_type, name, raw_json FROM qbo_record WHERE entity_type IN ('Customer','Vendor')")
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    display = (raw.get("DisplayName") or r["name"] or "")
    if any(n in display.lower() for n in CUSTOMER_NEEDLES):
        print(
            f"  {r['entity_type']} id={r['id']} active={raw.get('Active', True)} "
            f"name={display!r}"
        )

print("\n=== Sample 2026 split deposit (first with 3+ named lines) ===")
c.execute(
    """
    SELECT r.id, r.txn_date, r.total_amt, r.raw_json
    FROM qbo_record r
    WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
    ORDER BY r.txn_date DESC
    """
)
shown = False
for r in c.fetchall():
    header = json.loads(r["raw_json"] or "{}")
    lines = header.get("Line") or []
    named = 0
    for ln in lines:
        det = ln.get("DepositLineDetail") or {}
        ent = det.get("Entity") or {}
        if ent.get("name"):
            named += 1
    if named < 3:
        continue
    print(
        f"  Deposit {r['id']} date={r['txn_date']} total={r['total_amt']} "
        f"to={(header.get('DepositToAccountRef') or {}).get('name')} "
        f"note={(header.get('PrivateNote') or '')[:80]!r}"
    )
    for ln in lines[:4]:
        det = ln.get("DepositLineDetail") or {}
        print(
            "   ",
            {
                "amt": ln.get("Amount"),
                "desc": ln.get("Description"),
                "entity": det.get("Entity"),
                "acct": (det.get("AccountRef") or {}).get("name"),
                "acctId": (det.get("AccountRef") or {}).get("value"),
                "check": det.get("CheckNum"),
                "pay": (det.get("PaymentMethodRef") or {}).get("name"),
                "payId": (det.get("PaymentMethodRef") or {}).get("value"),
                "class": (det.get("ClassRef") or {}).get("name"),
            },
        )
    shown = True
    break
if not shown:
    print("  none found")

print("\n=== Existing deposits on/near 2026-09-07 or total 3517.17 ===")
c.execute(
    """
    SELECT id, txn_date, total_amt, name
    FROM qbo_record
    WHERE entity_type='Deposit'
      AND (txn_date BETWEEN '2026-09-01' AND '2026-09-30' OR total_amt IN (3517.17, 3494.17, 3492.17, 3517.17))
    ORDER BY txn_date
    """
)
rows = list(c.fetchall())
if not rows:
    print("  none in mirror")
else:
    for r in rows:
        print(f"  id={r['id']} date={r['txn_date']} total={r['total_amt']} name={r['name']}")

conn.close()
