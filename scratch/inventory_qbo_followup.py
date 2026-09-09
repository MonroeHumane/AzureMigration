"""Follow-up: class names, unlabeled deposit $ , bank match, customer join keys."""
import collections
import json
import sqlite3

conn = sqlite3.connect(r"E:\qbbackup\qbo_mirror.db")
conn.row_factory = sqlite3.Row
c = conn.cursor()

out = {}

# Deposit line Entity structure + ClassRef names 2026
c.execute("""
SELECT r.txn_date, l.amount, l.description, l.raw_json, r.raw_json as header_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
""")
classes = collections.Counter()
entity_types = collections.Counter()
entity_has_value = 0
pay_methods = collections.Counter()
unlabeled_amt = 0.0
unlabeled_n = 0
platform_amt = 0.0
named_nonplatform_n = 0
named_nonplatform_amt = 0.0
PLATFORM = ("better unite", "betterunite", "paypal", "square", "intuit")

def useful(s):
    t = (s or "").strip()
    return bool(t) and t.upper() != "DEPOSIT"

for r in c.fetchall():
    line = json.loads(r["raw_json"] or "{}")
    det = line.get("DepositLineDetail") or {}
    klass = ((det.get("ClassRef") or {}).get("name") or "(none)")
    classes[klass] += 1
    ent = det.get("Entity") or {}
    if ent.get("type"):
        entity_types[ent.get("type")] += 1
    if ent.get("value"):
        entity_has_value += 1
    pm = ((det.get("PaymentMethodRef") or {}).get("name") or "(none)")
    pay_methods[pm] += 1
    name = (ent.get("name") or "").strip()
    amt = float(r["amount"] or 0)
    low = name.lower()
    is_plat = any(p in low for p in PLATFORM)
    if not name and not useful(r["description"]):
        unlabeled_n += 1
        unlabeled_amt += amt
    elif is_plat:
        platform_amt += amt
    else:
        named_nonplatform_n += 1
        named_nonplatform_amt += amt

out["deposit_2026_classes"] = classes.most_common()
out["deposit_2026_entity_types"] = entity_types.most_common()
out["deposit_2026_entity_id"] = entity_has_value
out["deposit_2026_payment_methods"] = pay_methods.most_common()
out["deposit_2026_unlabeled"] = {"n": unlabeled_n, "amount": round(unlabeled_amt, 2)}
out["deposit_2026_platform_amt"] = round(platform_amt, 2)
out["deposit_2026_named_people"] = {"n": named_nonplatform_n, "amount": round(named_nonplatform_amt, 2)}

# Historical deposits with entity by year
c.execute("""
SELECT r.txn_date, l.amount, l.description, l.raw_json
FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.entity_type='Deposit'
""")
by_year = collections.defaultdict(lambda: {"lines": 0, "entity": 0, "useful_desc": 0, "amt_entity": 0.0})
for r in c.fetchall():
    y = (r["txn_date"] or "")[:4] or "?"
    det = json.loads(r["raw_json"] or "{}").get("DepositLineDetail") or {}
    name = ((det.get("Entity") or {}).get("name") or "").strip()
    by_year[y]["lines"] += 1
    if name:
        by_year[y]["entity"] += 1
        by_year[y]["amt_entity"] += float(r["amount"] or 0)
    if useful(r["description"]):
        by_year[y]["useful_desc"] += 1
out["deposits_by_year"] = {y: {**v, "amt_entity": round(v["amt_entity"], 2)} for y, v in sorted(by_year.items())}

# Sales receipts by year
c.execute("""
SELECT substr(txn_date,1,4) y, COUNT(*) n,
  SUM(CASE WHEN name IS NOT NULL AND trim(name)!='' THEN 1 ELSE 0 END) named
FROM qbo_record WHERE entity_type='SalesReceipt' GROUP BY y ORDER BY y
""")
# name column was 0 - use json
c.execute("SELECT txn_date, name, raw_json FROM qbo_record WHERE entity_type='SalesReceipt'")
sr_year = collections.defaultdict(lambda: {"n": 0, "customer": 0, "email": 0, "addr": 0, "desc_lines": 0})
c2 = conn.cursor()
c2.execute("""
SELECT r.txn_date, r.raw_json, l.description
FROM qbo_record r JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
WHERE r.entity_type='SalesReceipt'
""")
# unique receipts
c.execute("SELECT txn_date, raw_json FROM qbo_record WHERE entity_type='SalesReceipt'")
for r in c.fetchall():
    y = (r["txn_date"] or "")[:4]
    raw = json.loads(r["raw_json"] or "{}")
    sr_year[y]["n"] += 1
    if (raw.get("CustomerRef") or {}).get("name"):
        sr_year[y]["customer"] += 1
    if (raw.get("BillEmail") or {}).get("Address"):
        sr_year[y]["email"] += 1
    addr = raw.get("BillAddr") or {}
    if addr.get("Line1") or addr.get("City"):
        sr_year[y]["addr"] += 1
out["sales_receipts_by_year"] = dict(sr_year)

# Bank
c.execute("SELECT COUNT(*) n, SUM(CASE WHEN is_reconciled=1 THEN 1 ELSE 0 END) rec, SUM(CASE WHEN matched_qbo_id IS NOT NULL AND matched_qbo_id!='' THEN 1 ELSE 0 END) matched FROM bank_statement")
out["bank"] = dict(c.fetchone())
c.execute("SELECT substr(txn_date,1,4) y, COUNT(*) n FROM bank_statement GROUP BY y ORDER BY y")
out["bank_by_year"] = [dict(r) for r in c.fetchall()]
c.execute("""
SELECT COUNT(*) n FROM bank_statement
WHERE txn_date LIKE '2026%' AND (matched_qbo_id IS NULL OR matched_qbo_id='')
""")
out["bank_2026_unmatched"] = c.fetchone()["n"]
c.execute("SELECT COUNT(*) n FROM bank_statement WHERE txn_date LIKE '2026%'")
out["bank_2026"] = c.fetchone()["n"]
# sample unmatched memos 2026 (no PII dump of all)
c.execute("""
SELECT txn_date, amount, memo FROM bank_statement
WHERE txn_date LIKE '2026%' AND (matched_qbo_id IS NULL OR matched_qbo_id='')
ORDER BY abs(amount) DESC LIMIT 15
""")
out["bank_2026_unmatched_top"] = [dict(r) for r in c.fetchall()]

# Purchase vendor names from json 2026
c.execute("SELECT raw_json FROM qbo_record WHERE entity_type='Purchase' AND txn_date LIKE '2026%'")
vend = 0
priv = 0
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    if (raw.get("EntityRef") or {}).get("name") or (raw.get("VendorRef") or {}).get("name"):
        vend += 1
    note = (raw.get("PrivateNote") or "").strip()
    if note and note.upper() != "DEPOSIT":
        priv += 1
out["purchase_2026_vendorref"] = vend
out["purchase_2026_privatenote"] = priv

# Customer notes length / join: DisplayName vs deposit entities
c.execute("SELECT name, raw_json FROM qbo_record WHERE entity_type='Customer'")
cust_names = {}
note_n = 0
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    n = (raw.get("DisplayName") or r["name"] or "").strip()
    cid = raw.get("Id") or r["name"]
    cust_names[n.lower()] = {
        "id": raw.get("Id"),
        "email": (raw.get("PrimaryEmailAddr") or {}).get("Address") or "",
        "phone": (raw.get("PrimaryPhone") or {}).get("FreeFormNumber") or "",
        "notes": (raw.get("Notes") or "").strip(),
    }
    if (raw.get("Notes") or "").strip():
        note_n += 1
out["customer_with_notes"] = note_n

# How many 2026 named deposit entities match a Customer
c.execute("""
SELECT l.raw_json FROM qbo_record r
JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
WHERE r.entity_type='Deposit' AND r.txn_date LIKE '2026%'
""")
match = 0
nomatch = 0
match_email = 0
seen = set()
unmatched_names = collections.Counter()
for r in c.fetchall():
    name = (((json.loads(r["raw_json"] or "{}").get("DepositLineDetail") or {}).get("Entity") or {}).get("name") or "").strip()
    if not name:
        continue
    key = name.lower()
    if key in seen:
        continue
    seen.add(key)
    cinfo = cust_names.get(key)
    if cinfo:
        match += 1
        if cinfo["email"]:
            match_email += 1
    else:
        nomatch += 1
        unmatched_names[name] += 1
out["deposit_entity_vs_customer"] = {
    "unique_deposit_names_2026": len(seen),
    "exact_match_customer": match,
    "with_email": match_email,
    "no_customer": nomatch,
    "unmatched_examples": unmatched_names.most_common(15),
}

# Department / Class lists
c.execute("SELECT name, raw_json FROM qbo_record WHERE entity_type='Class'")
out["classes"] = []
for r in c.fetchall():
    raw = json.loads(r["raw_json"] or "{}")
    out["classes"].append({"name": r["name"], "active": raw.get("Active")})
c.execute("SELECT COUNT(*) n FROM qbo_record WHERE entity_type='Department'")
out["department_count"] = c.fetchone()["n"]

# Invoice/Payment really empty?
c.execute("SELECT entity_type, COUNT(*) n FROM qbo_record WHERE entity_type IN ('Payment','Invoice','Estimate','CreditMemo','Item') GROUP BY entity_type")
out["empty_types"] = [dict(r) for r in c.fetchall()]

print(json.dumps(out, indent=2, default=str))
