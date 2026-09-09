"""Heuristic 2026 QBO P&L category review from the local mirror. No secrets."""
from __future__ import annotations

import json
import os
import re
import sqlite3
from collections import defaultdict

DB = os.environ.get("QBO_MIRROR_DB", r"E:\qbbackup\qbo_mirror.db")
OUT = r"C:\Users\Jeff\Documents\AzureMigration\scratch\qbo_2026_category_audit.json"

PL_TYPES = {"Income", "Other Income", "Expense", "Other Expense", "Cost of Goods Sold"}
SKIP_ENTITY = {"Deposit", "Transfer", "BillPayment", "Payment"}  # header types still used via lines

RULES = [
    ("county_as_endowment", "County contract sitting in endowment / quarterly",
     lambda b, a: bool(re.search(r"county|quarterly payment|balance of 20k", b)) and bool(re.search(r"endowment|quarterly endowment", a)) and not bool(re.search(r"government|municipal|contract", a))),
    ("grant_not_grants", "Grant/Thrivent/Blackbaud not in a grant account",
     lambda b, a: bool(re.search(r"thrivent|blackbaud|foundation grant|\bgrant\b", b)) and not bool(re.search(r"grant|foundation|endowment|memorial", a)) and bool(re.search(r"income|donation|contributed", a))),
    ("laundry_misc", "UNV / laundry not in Laundry & Sanitation",
     lambda b, a: bool(re.search(r"unv\s*laundry|\blaundry\b", b)) and "laundry" not in a and "expense" in a),
    ("fuel_wrong", "Fuel/gas not in Gas / vehicle fuel",
     lambda b, a: bool(re.search(r"\bgas\b|fuel|speedway|sunoco|marathon|shell oil|bp#|circle k", b)) and "gas" not in a and not bool(re.search(r"vehicle", a)) and "expense" in a),
    ("software_as_membership", "Software (GoDaddy/Canva/MS/Adobe) in Memberships",
     lambda b, a: bool(re.search(r"godaddy|canva|microsoft|adobe|zoom\.us|dropbox|openai|github|google\*?\s*gsuite|google workspace", b)) and "membership" in a),
    ("spay_as_primary", "Paws Clinic / spay-neuter in Primary Care",
     lambda b, a: bool(re.search(r"paws clinic|spay|neuter", b)) and "primary" in a),
    ("insurance_office", "Insurance carrier in Office / Admin",
     lambda b, a: bool(re.search(r"cincinnati|nationwide|hartford|farmers ins|liability ins", b)) and bool(re.search(r"office|admin|supplies", a)) and "insurance" not in a),
    ("merchant_fee_income", "Square/PayPal/Auth.net fee sitting in income",
     lambda b, a: bool(re.search(r"authnet|merchant fee|square inc/sq", b)) and bool(re.search(r"income|donation|adoption", a))),
    ("fee_as_supplies", "Gateway/bank fee in supplies or meals",
     lambda b, a: bool(re.search(r"authnet|merchant account|bank fee|nsf|overdraft", b)) and bool(re.search(r"suppl|meal|food|office expenses$", a))),
    ("ask_my_accountant", "Uncategorized / Ask My Accountant / Unapplied",
     lambda b, a: bool(re.search(r"ask my accountant|uncategorized|unapplied|suspense|undeposited", a))),
    ("refund_as_revenue", "PET RETURN / adoption refund coded as revenue",
     lambda b, a: bool(re.search(r"pet return|adoption refund|fee refund", b + " " + a)) and bool(re.search(r"income|adoption fee(?! refund)", a))),
    ("trust_as_individual", "Trust fund / estate in individual donations",
     lambda b, a: bool(re.search(r"trust fund|estate of", b)) and "individual" in a),
    ("kroger_not_rebate", "Kroger/Meijer rebate not in Retail Partner Rebates",
     lambda b, a: bool(re.search(r"kroger|meijer", b)) and "rebate" not in a and bool(re.search(r"donation|individual|corporate", a)) and not bool(re.search(r"family dollar|grocery|supplies|food", a))),
    ("payroll_wrong", "Payroll/ADP/Gusto/IRS tax in supplies or other",
     lambda b, a: bool(re.search(r"\badp\b|gusto|paychex|payroll|irs\s*usa|eftps", b)) and bool(re.search(r"suppl|office expenses|other expense", a))),
    ("event_in_office", "Event/gala/car show spend in Office",
     lambda b, a: bool(re.search(r"gala|car show|auction|raffle", b)) and "office" in a and "event" not in a),
    ("vet_in_supplies", "Clinic/vet spend in Animal Care Supplies",
     lambda b, a: bool(re.search(r"veterinary|vet clinic|animal hospital|paws clinic|emergency vet", b)) and "supplies" in a and "veterinary" not in a),
    ("other_expense_ops", "Operating spend parked in Other Expense",
     lambda b, a: a.startswith("other expense") and not bool(re.search(r"interest|gain|loss|depreciation", a + " " + b))),
    ("other_income_ops", "Operating revenue parked in Other Income",
     lambda b, a: a.startswith("other income") and not bool(re.search(r"interest|gain|dividend|endowment|rebate|recycling|restitution", a + " " + b))),
]


def blob(*parts):
    return re.sub(r"\s+", " ", " ".join(str(p or "") for p in parts)).strip().lower()


def acct_name(raw_line, accounts_by_id):
    det = (
        raw_line.get("DepositLineDetail")
        or raw_line.get("SalesItemLineDetail")
        or raw_line.get("AccountBasedExpenseLineDetail")
        or raw_line.get("JournalEntryLineDetail")
        or raw_line.get("ItemBasedExpenseLineDetail")
        or {}
    )
    ref = det.get("AccountRef") or det.get("ItemAccountRef") or {}
    aid = str(ref.get("value") or "")
    name = ref.get("name") or ""
    if aid and aid in accounts_by_id:
        a = accounts_by_id[aid]
        return aid, a.get("FullyQualifiedName") or a.get("Name") or name, a.get("AccountType") or ""
    return aid, name, ""


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    accounts_by_id = {}
    c.execute("SELECT id, name, raw_json FROM qbo_record WHERE entity_type='Account'")
    for r in c.fetchall():
        raw = json.loads(r["raw_json"] or "{}")
        accounts_by_id[str(r["id"])] = raw

    findings = []
    by_rule = defaultdict(lambda: {"count": 0, "amount": 0.0, "samples": []})
    uncat = []
    blank_income = []
    county_rows = []
    large = []
    month_pl = defaultdict(lambda: {"rev": 0.0, "exp": 0.0})
    acct_totals = defaultdict(lambda: {"n": 0, "amt": 0.0, "type": ""})

    c.execute(
        """
        SELECT r.id, r.entity_type, r.txn_date, r.total_amt, r.name, r.raw_json AS header_json,
               l.amount, l.description, l.raw_json AS line_json
        FROM qbo_record r
        JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type=r.entity_type
        WHERE substr(r.txn_date,1,4)='2026' AND r.is_deleted=0
        """
    )
    for r in c.fetchall():
        header = json.loads(r["header_json"] or "{}")
        line = json.loads(r["line_json"] or "{}")
        aid, aname, atype = acct_name(line, accounts_by_id)
        if atype not in PL_TYPES:
            continue
        amt = float(r["amount"] or 0)
        if amt == 0:
            continue
        month = (r["txn_date"] or "")[:7]
        is_rev = atype in {"Income", "Other Income"}
        signed = amt if is_rev else abs(amt)
        if is_rev:
            month_pl[month]["rev"] += amt
        else:
            month_pl[month]["exp"] += abs(amt)
        acct_totals[aname or "(blank)"]["n"] += 1
        acct_totals[aname or "(blank)"]["amt"] += signed if is_rev else abs(amt)
        acct_totals[aname or "(blank)"]["type"] = atype

        memo = " ".join(
            [
                r["description"] or "",
                header.get("PrivateNote") or "",
                header.get("DocNumber") or "",
                r["name"] or "",
                ((header.get("VendorRef") or {}).get("name") or ""),
                ((header.get("CustomerRef") or {}).get("name") or ""),
                (((line.get("DepositLineDetail") or {}).get("Entity") or {}).get("name") or ""),
            ]
        )
        b = blob(memo, aname)
        a = (aname or "").lower()

        if not aname.strip():
            uncat.append(
                {
                    "id": r["id"],
                    "type": r["entity_type"],
                    "date": r["txn_date"],
                    "amount": round(amt, 2),
                    "memo": (r["description"] or r["name"] or "")[:80],
                }
            )
        if is_rev and not (r["description"] or "").strip() and not (((line.get("DepositLineDetail") or {}).get("Entity") or {}).get("name")):
            if abs(amt) >= 100:
                blank_income.append(
                    {
                        "id": r["id"],
                        "type": r["entity_type"],
                        "date": r["txn_date"],
                        "amount": round(amt, 2),
                        "account": aname,
                    }
                )
        if re.search(r"county of monroe|county payment|county quarterly", b):
            county_rows.append(
                {
                    "id": r["id"],
                    "date": r["txn_date"],
                    "amount": round(amt, 2),
                    "account": aname,
                    "type": r["entity_type"],
                    "memo": (r["description"] or header.get("PrivateNote") or "")[:80],
                }
            )
        if abs(amt) >= 2500:
            large.append(
                {
                    "id": r["id"],
                    "type": r["entity_type"],
                    "date": r["txn_date"],
                    "amount": round(amt, 2),
                    "account": aname,
                    "name": r["name"] or "",
                    "memo": (r["description"] or header.get("PrivateNote") or "")[:100],
                    "pl": atype,
                }
            )

        for rule_id, title, fn in RULES:
            try:
                hit = fn(b, a)
            except Exception:
                hit = False
            if hit:
                rec = {
                    "rule": rule_id,
                    "title": title,
                    "id": r["id"],
                    "txnType": r["entity_type"],
                    "date": r["txn_date"],
                    "amount": round(amt, 2),
                    "account": aname,
                    "accountType": atype,
                    "name": r["name"] or "",
                    "memo": (r["description"] or header.get("PrivateNote") or "")[:120],
                }
                findings.append(rec)
                bucket = by_rule[rule_id]
                bucket["title"] = title
                bucket["count"] += 1
                bucket["amount"] += abs(amt)
                if len(bucket["samples"]) < 8:
                    bucket["samples"].append(rec)

    conn.close()

    # Dedup findings by (rule, id, amount, account)
    seen = set()
    uniq = []
    for f in findings:
        k = (f["rule"], f["id"], f["amount"], f["account"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(f)
    findings = uniq

    months = []
    for m in sorted(month_pl):
        months.append(
            {
                "month": m,
                "revenue": round(month_pl[m]["rev"], 2),
                "expense": round(month_pl[m]["exp"], 2),
                "net": round(month_pl[m]["rev"] - month_pl[m]["exp"], 2),
            }
        )

    top_accts = sorted(acct_totals.items(), key=lambda kv: kv[1]["amt"], reverse=True)[:20]
    rules_out = []
    for rid, _, title in ((r[0], None, r[1]) for r in RULES):
        b = by_rule.get(rid)
        if not b:
            continue
        rules_out.append(
            {
                "id": rid,
                "title": title,
                "count": b["count"],
                "amount": round(b["amount"], 2),
                "samples": b["samples"],
            }
        )
    rules_out.sort(key=lambda x: -x["amount"])

    payload = {
        "source": "E:\\qbbackup\\qbo_mirror.db qbo_line × Account (P&L types only)",
        "period": "2026-01-01 through latest mirrored 2026 txn",
        "findingCount": len(findings),
        "ruleHits": rules_out,
        "months": months,
        "topAccounts": [
            {"name": n, "n": v["n"], "amount": round(v["amt"], 2), "type": v["type"]}
            for n, v in top_accts
        ],
        "countyRows": county_rows,
        "blankNamedIncomeOver100": sorted(blank_income, key=lambda x: -abs(x["amount"]))[:25],
        "blankAccountLines": uncat[:25],
        "largePlLines": sorted(large, key=lambda x: -abs(x["amount"]))[:30],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print("Wrote", OUT)
    print("findings", len(findings), "rules", len(rules_out))
    for r in rules_out:
        print(f"  {r['count']:3d} {r['amount']:10.2f}  {r['id']}  {r['title']}")
    print("county rows", len(county_rows))
    for row in county_rows:
        print(" ", row)
    print("blank income >=$100", len(blank_income), "blank acct", len(uncat))


if __name__ == "__main__":
    main()
