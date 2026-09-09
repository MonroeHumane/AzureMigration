"""Multi-year QBO P&L category pattern scan. Never print oauth tokens."""
from __future__ import annotations

import json
import os
import re
import sqlite3
from collections import defaultdict

DB = os.environ.get("QBO_MIRROR_DB", r"E:\qbbackup\qbo_mirror.db")
OUT = r"C:\Users\Jeff\Documents\AzureMigration\scratch\qbo_all_years_category_audit.json"

def blob(*parts):
    return re.sub(r"\s+", " ", " ".join(str(p or "") for p in parts)).strip()

def lower(*parts):
    return blob(*parts).lower()

def acct_of(line, accounts_by_id):
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
    name = ref.get("name") or ""
    raw = accounts_by_id.get(aid) or {}
    fq = raw.get("FullyQualifiedName") or raw.get("Name") or name
    atype = raw.get("AccountType") or ""
    entity = (det.get("Entity") or {})
    return {
        "id": aid,
        "name": fq,
        "type": atype,
        "entity": (entity.get("name") or "").strip(),
        "entityType": (entity.get("type") or "").strip(),
        "check": (det.get("CheckNum") or "").strip(),
        "pay": ((det.get("PaymentMethodRef") or {}).get("name") or "").strip(),
    }

conn = sqlite3.connect(DB)
conn.row_factory = sqlite3.Row
c = conn.cursor()

accounts_by_id = {}
for r in c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'"):
    accounts_by_id[str(r["id"])] = json.loads(r["raw_json"] or "{}")

year_min = c.execute("SELECT MIN(txn_date), MAX(txn_date) FROM qbo_record WHERE txn_date IS NOT NULL AND txn_date != ''").fetchone()
print("txn_date range", year_min[0], year_min[1])

rows = []
c.execute(
    """
    SELECT r.id, r.entity_type, r.txn_date, r.total_amt, r.name, r.raw_json AS header_json,
           l.amount, l.description, l.line_id, l.raw_json AS line_json
    FROM qbo_record r
    JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type=r.entity_type
    WHERE r.txn_date IS NOT NULL AND r.txn_date != ''
    """
)
for r in c.fetchall():
    header = json.loads(r["header_json"] or "{}")
    line = json.loads(r["line_json"] or "{}")
    acc = acct_of(line, accounts_by_id)
    vendor = ((header.get("VendorRef") or {}).get("name") or "")
    customer = ((header.get("CustomerRef") or {}).get("name") or "")
    note = header.get("PrivateNote") or ""
    desc = r["description"] or ""
    rec = {
        "id": r["id"],
        "lineId": r["line_id"],
        "txnType": r["entity_type"],
        "date": r["txn_date"],
        "year": (r["txn_date"] or "")[:4],
        "amount": round(float(r["amount"] or 0), 2),
        "headerName": r["name"] or "",
        "desc": desc,
        "note": note,
        "vendor": vendor,
        "customer": customer,
        "account": acc["name"],
        "accountType": acc["type"],
        "entity": acc["entity"],
        "check": acc["check"],
        "text": lower(desc, note, r["name"], vendor, customer, acc["entity"], acc["name"]),
        "acctL": (acc["name"] or "").lower(),
    }
    rows.append(rec)

print("lines", len(rows))

def is_county(t):
    return bool(re.search(r"county (of )?monroe|county quarterly|county payment|balance of 20k", t))

def is_thrivent(t, entity, desc):
    return "thrivent" in t or entity.lower() == "thrivent"

def is_kroger_rewards(t, entity, desc, acct):
    if "kroger" not in t and "meijer" not in entity.lower() and "kroger" not in entity.lower():
        return False
    # grocery spend is not a rebate
    if rec_is_expense_like(acct) and re.search(r"family dollar|grocery|supplies|food|fuel", t):
        return False
    return "kroger" in entity.lower() or "kroger" in t

def rec_is_expense_like(acct):
    a = (acct or "").lower()
    return "expense" in a or a.startswith("veterinary") or a.startswith("shelter") or a.startswith("office") or a.startswith("personnel")

def is_unv(t):
    return "unv" in t and "laundry" in t

def is_canva(t):
    return "canva" in t

def is_godaddy(t):
    return "godaddy" in t

def is_authnet(t):
    return "authnet" in t or "authorize.net" in t

def is_cincinnati(t):
    return "cincinnati" in t and "insur" in t

findings = []

def add(rule, rec, why, expected):
    findings.append({
        "rule": rule,
        "why": why,
        "expected": expected,
        "id": rec["id"],
        "lineId": rec["lineId"],
        "txnType": rec["txnType"],
        "date": rec["date"],
        "year": rec["year"],
        "amount": rec["amount"],
        "account": rec["account"] or "(blank)",
        "entity": rec["entity"] or rec["headerName"] or rec["vendor"] or "",
        "memo": (rec["desc"] or rec["note"] or "")[:140],
    })

for rec in rows:
    t = rec["text"]
    a = rec["acctL"]
    amt = rec["amount"]
    if amt == 0:
        continue

    # County contract parked in endowment / other income
    if is_county(t) and amt > 1000 and rec["txnType"] in {"Deposit", "JournalEntry", "SalesReceipt"}:
        if "endowment" in a or "quarterly endowment" in a:
            add("county_endowment", rec, "County contract on endowment account", "Government grants & contracts")
        elif "individual" in a or "donation directed" in a:
            add("county_individual", rec, "County contract on individual donations", "Government grants & contracts")

    # Thrivent not on Foundation Grants
    if is_thrivent(t, rec["entity"], rec["desc"]) and amt > 0 and rec["txnType"] == "Deposit":
        if "foundation" not in a:
            add("thrivent_not_foundation", rec, "Thrivent Choice/grant not on Foundation Grants", "Foundation Grants")

    # Kroger/Meijer Community Rewards on corporate/individual
    if rec["txnType"] == "Deposit" and amt > 50:
        ent = rec["entity"].lower()
        if "kroger" in ent or ( "kroger" in t and "deposit" == rec["txnType"].lower()):
            if "rebate" not in a and "corporate" in a:
                add("kroger_corporate", rec, "Kroger check on Corporate Donations", "Retail Partner Rebates")
            elif "rebate" not in a and "individual" in a:
                add("kroger_individual", rec, "Kroger check on individual donations", "Retail Partner Rebates")

    # UNV laundry not on laundry
    if is_unv(t) and rec["txnType"] in {"Purchase", "Bill", "Expense"}:
        if "laundry" not in a:
            add("unv_not_laundry", rec, "UNV Laundry on a non-laundry account", "Laundry & Sanitation")

    # Canva / GoDaddy in Memberships
    if rec["txnType"] == "Purchase" and amt > 0:
        if is_canva(t) and "membership" in a:
            add("canva_membership", rec, "Canva in Memberships & Subscriptions", "Software & Apps")
        if is_godaddy(t) and "membership" in a:
            add("godaddy_membership", rec, "GoDaddy in Memberships", "Software & Apps")
        if is_canva(t) and "software" not in a and "membership" not in a:
            add("canva_other", rec, "Canva not on Software & Apps", "Software & Apps")

    # Auth.net not merchant fees
    if is_authnet(t) and rec["txnType"] == "Purchase":
        if "merchant" not in a and "bank" not in a and "fee" not in a:
            add("authnet_wrong", rec, "Authorize.Net not on merchant/bank fees", "Merchant Account Fees")

    # Cincinnati insurance not on insurance
    if is_cincinnati(t) and rec["txnType"] == "Purchase":
        if "insurance" not in a:
            add("cincinnati_wrong", rec, "Cincinnati Insurance not on Insurance", "Insurance / Liability insurance")

    # PET RETURN on income
    if "pet return" in a or re.search(r"pet return|adoption refund", t):
        if rec["accountType"] in {"Income", "Other Income"}:
            add("refund_as_income", rec, "Adoption refund coded as income", "PET RETURN (expense)")

print("raw findings", len(findings))

# Dedup exact line
seen = set()
uniq = []
for f in findings:
    k = (f["rule"], f["id"], f["lineId"], f["amount"], f["account"])
    if k in seen:
        continue
    seen.add(k)
    uniq.append(f)
findings = uniq
print("unique findings", len(findings))

# Duplicate Thrivent same deposit same amount
thrivent_pairs = defaultdict(list)
for rec in rows:
    if rec["txnType"] != "Deposit":
        continue
    if "thrivent" not in rec["text"]:
        continue
    thrivent_pairs[(rec["id"], rec["amount"], rec["account"])].append(rec)
dup_thrivent = []
for k, lst in thrivent_pairs.items():
    if len(lst) >= 2 and k[1] > 0:
        dup_thrivent.append({
            "id": k[0],
            "amountEach": k[1],
            "count": len(lst),
            "account": k[2],
            "date": lst[0]["date"],
            "total": round(k[1] * len(lst), 2),
        })

# COA structural
coa = []
for aid, raw in accounts_by_id.items():
    fq = raw.get("FullyQualifiedName") or raw.get("Name") or ""
    atype = raw.get("AccountType") or ""
    active = raw.get("Active", True)
    if not active:
        continue
    fl = fq.lower()
    if fl.endswith(":gas") or fl == "gas":
        if atype == "Other Expense":
            coa.append({"id": aid, "name": fq, "issue": "Gas typed Other Expense", "type": atype})
    if "bottle refund" == fl or fl.endswith("bottle refund"):
        coa.append({"id": aid, "name": fq, "issue": "BOTTLE REFUND split from Bottle & Can Recycling Revenue", "type": atype})
    if fq in {"FOUNDATION", "Contributed income:FOUNDATION MONEY"} or "foundation money" in fl:
        coa.append({"id": aid, "name": fq, "issue": "Extra foundation income leaf besides Foundation Grants", "type": atype})

# Year rollup
by_year_rule = defaultdict(lambda: defaultdict(lambda: {"count": 0, "amount": 0.0}))
by_rule = defaultdict(lambda: {"count": 0, "amount": 0.0, "years": set(), "samples": []})
for f in findings:
    by_year_rule[f["year"]][f["rule"]]["count"] += 1
    by_year_rule[f["year"]][f["rule"]]["amount"] += abs(f["amount"])
    b = by_rule[f["rule"]]
    b["count"] += 1
    b["amount"] += abs(f["amount"])
    b["years"].add(f["year"])
    if len(b["samples"]) < 12:
        b["samples"].append(f)

# All-year totals for key patterns even when correctly coded (for context)
context = {
    "thrivent_all": [],
    "kroger_deposit_all": [],
    "unv_all": [],
    "county_all": [],
    "canva_all": [],
}
for rec in rows:
    if rec["amount"] == 0:
        continue
    if is_thrivent(rec["text"], rec["entity"], rec["desc"]) and rec["txnType"] == "Deposit" and rec["amount"] > 0:
        context["thrivent_all"].append(rec)
    if rec["txnType"] == "Deposit" and rec["entity"].lower() == "kroger" and rec["amount"] > 50:
        context["kroger_deposit_all"].append(rec)
    if is_unv(rec["text"]) and rec["txnType"] in {"Purchase", "Bill", "Expense"}:
        context["unv_all"].append(rec)
    if is_county(rec["text"]) and rec["amount"] > 1000 and rec["txnType"] in {"Deposit", "JournalEntry"}:
        context["county_all"].append(rec)
    if is_canva(rec["text"]) and rec["txnType"] == "Purchase":
        context["canva_all"].append(rec)

def slim(rec):
    return {
        "id": rec["id"],
        "date": rec["date"],
        "amount": rec["amount"],
        "account": rec["account"],
        "entity": rec["entity"] or rec["headerName"],
        "memo": (rec["desc"] or rec["note"] or "")[:100],
    }

payload = {
    "dateRange": [year_min[0], year_min[1]],
    "lineCount": len(rows),
    "findingCount": len(findings),
    "rules": [],
    "byYear": [],
    "findings": sorted(findings, key=lambda x: (x["date"], x["rule"], -abs(x["amount"]))),
    "duplicateThrivent": dup_thrivent,
    "coa": coa,
    "context": {
        "thrivent": [slim(x) for x in sorted(context["thrivent_all"], key=lambda x: x["date"])],
        "kroger": [slim(x) for x in sorted(context["kroger_deposit_all"], key=lambda x: x["date"])],
        "unv": [slim(x) for x in sorted(context["unv_all"], key=lambda x: x["date"])],
        "county": [slim(x) for x in sorted(context["county_all"], key=lambda x: x["date"])],
        "canva": [slim(x) for x in sorted(context["canva_all"], key=lambda x: x["date"])],
    },
}

for rid, b in sorted(by_rule.items(), key=lambda kv: -kv[1]["amount"]):
    payload["rules"].append({
        "id": rid,
        "count": b["count"],
        "amount": round(b["amount"], 2),
        "years": sorted(b["years"]),
        "samples": b["samples"],
    })

for year in sorted(by_year_rule):
    rules = []
    tot_n = tot_a = 0
    for rid, v in sorted(by_year_rule[year].items(), key=lambda kv: -kv[1]["amount"]):
        rules.append({"id": rid, "count": v["count"], "amount": round(v["amount"], 2)})
        tot_n += v["count"]
        tot_a += v["amount"]
    payload["byYear"].append({"year": year, "count": tot_n, "amount": round(tot_a, 2), "rules": rules})

# correctness: county/thrivent/kroger/unv correctly coded counts
def summarize(label, recs, ok_fn):
    ok = [r for r in recs if ok_fn(r)]
    bad = [r for r in recs if not ok_fn(r)]
    return {
        "label": label,
        "total": len(recs),
        "ok": len(ok),
        "bad": len(bad),
        "okAmount": round(sum(r["amount"] for r in ok), 2),
        "badAmount": round(sum(abs(r["amount"]) for r in bad), 2),
    }

payload["correctness"] = [
    summarize("County deposits >$1k", context["county_all"], lambda r: "government" in r["acctL"] or "municipal" in r["acctL"] or "grant" in r["acctL"] and "endowment" not in r["acctL"] and "individual" not in r["acctL"]),
    summarize("Thrivent deposits", context["thrivent_all"], lambda r: "foundation" in r["acctL"]),
    summarize("Kroger deposit lines", context["kroger_deposit_all"], lambda r: "rebate" in r["acctL"]),
    summarize("UNV Laundry purchases", context["unv_all"], lambda r: "laundry" in r["acctL"]),
    summarize("Canva purchases", context["canva_all"], lambda r: "software" in r["acctL"]),
]

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(payload, f, indent=2)

print("Wrote", OUT)
print("\n=== correctness ===")
for s in payload["correctness"]:
    print(f"  {s['label']}: {s['ok']}/{s['total']} ok  bad ${s['badAmount']:,.2f}")
print("\n=== findings by rule ===")
for r in payload["rules"]:
    print(f"  {r['count']:3d} ${r['amount']:10,.2f}  {r['id']}  years={','.join(r['years'])}")
print("\n=== by year ===")
for y in payload["byYear"]:
    print(f"  {y['year']}  n={y['count']}  ${y['amount']:,.2f}  {y['rules']}")
print("\n=== dup thrivent ===")
for d in dup_thrivent:
    print(d)
print("\n=== coa ===")
for x in coa:
    print(x)
