#!/usr/bin/env python3
"""Read-only: build a 2024/2025 equivalent of api/data/monthly_drilldown_2026.json
(category -> payee -> transaction) plus the matching monthly_statements rows
from api/data/published_2026_ytd.json's shape, straight from QBO's
GeneralLedger report -- the same source the original 2026 files came from
(their own meta says so), whose generation script no longer exists in this
repo.

Report structure (confirmed by direct inspection, 2026-09-13):
  Top-level Rows are one Section per QBO account, in chart-of-accounts
  order -- Assets, Liabilities, Equity, then Income, then Expense. There is
  no type/classification on the row itself, so each top-level account name
  is looked up in the local audit DB's `accounts` table (a real, populated
  151-row chart of accounts) to bucket it as revenue / cogs / operating_exp
  / other_exp, or skipped (Asset/Liability/Equity).
  Below each top-level account, one Row per LEAF sub-account (e.g.
  "Contributed income" -> "Corporate Donations"), whose own Rows are the
  actual `type: "Data"` transaction lines (an 8-value ColData array:
  [date, txn_type, doc_num, name, memo, split_account, amount,
  running_balance] -- same shape used elsewhere in this repo) plus a
  "Beginning Balance" row to skip. A leaf with only a Beginning Balance
  (no activity that month) is dropped entirely. Deeper nesting is walked
  generically in case any account has sub-sub-accounts.
  Some top-level rows are QBO's own subtotal-of-children rows (empty
  Header, only a "... with sub-accounts" Summary) -- skipped.
  Account names can carry a literal trailing "(deleted)" for later-deactivated
  accounts that still have historical activity -- stripped for display,
  same as the donor pipeline already does for donor names.

The friendly display name/group for each leaf category (e.g. leaf "Staff
wages" displays under group "Staff", not the raw top-level QBO account name
"Personnel & Staffing") is NOT derivable from the report -- it's a display
layer already encoded in the existing 2026 files. This script derives a
lookup from every name/group pair already used there and applies it here;
anything not already seen prints as "unmapped" using the raw name as a
fallback, for a manual naming decision rather than a silent guess.

Usage:
  python scripts/qbo_fetch_monthly_gl_drilldown.py [--start 2024-01] [--end 2025-12]
"""
from __future__ import annotations

import argparse
import calendar
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
from collections import defaultdict
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"
MIRROR_DB = TOKEN_MIRROR
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUDIT_DB = os.path.join(ROOT, "scripts", "data", "qbo_audit_2024_2026.db")
OUT_DIR = os.path.join(ROOT, "scripts", "data")

DELETED_SUFFIX_RE = re.compile(r"\s*\(deleted\)\s*$", re.I)


def clean_name(name: str) -> str:
    return DELETED_SUFFIX_RE.sub("", name or "").strip()


def load_entity_enrichment_index(start_date: str, end_date: str) -> dict:
    """{(date, amount rounded to cents): [entity name, ...]} built from the
    live-synced mirror's Deposit/SalesReceipt line detail.

    Confirmed by direct inspection: the GeneralLedger report's own Name
    column is frequently blank even when the underlying Deposit line has a
    real named Entity (e.g. a 2024-01-22 $50 deposit shows name="" in the
    report's ColData, but the same Deposit's DepositLineDetail.Entity.name
    is "Linda Gagne"). extract_qbo_deposit_gifts.py already proved this
    richer source works for the donor pipeline; this reuses the same query
    shape to backfill names the flatter report left blank. Matching is by
    (date, amount) since the report doesn't carry a line-level id to join
    on directly -- ambiguous same-day/same-amount duplicates are resolved
    in encounter order (list.pop(0)) rather than left unmatched, which is
    right far more often than leaving every one of them as "Unknown".
    """
    conn = sqlite3.connect(MIRROR_DB)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    index: dict = defaultdict(list)

    cur.execute(
        """
        SELECT r.txn_date, l.amount, l.raw_json
        FROM qbo_record r JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='Deposit'
        WHERE r.entity_type='Deposit' AND r.txn_date BETWEEN ? AND ?
        """,
        (start_date, end_date),
    )
    for row in cur.fetchall():
        try:
            line = json.loads(row["raw_json"] or "{}")
        except json.JSONDecodeError:
            continue
        det = line.get("DepositLineDetail") or {}
        entity = (det.get("Entity") or {}).get("name")
        if entity and row["amount"]:
            key = (row["txn_date"], round(float(row["amount"]), 2))
            index[key].append(clean_name(entity))

    cur.execute(
        """
        SELECT r.txn_date, r.name, l.amount
        FROM qbo_record r JOIN qbo_line l ON l.parent_id=r.id AND l.parent_type='SalesReceipt'
        WHERE r.entity_type='SalesReceipt' AND r.txn_date BETWEEN ? AND ?
        """,
        (start_date, end_date),
    )
    for row in cur.fetchall():
        if row["name"] and row["amount"]:
            key = (row["txn_date"], round(float(row["amount"]), 2))
            index[key].append(clean_name(row["name"]))

    conn.close()
    return index


def get_access_token():
    conn = sqlite3.connect(TOKEN_MIRROR)
    access, refresh, realm = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    client = AuthClient(
        client_id=os.environ["QB_CLIENT_ID"], client_secret=os.environ["QB_CLIENT_SECRET"],
        environment="production", redirect_uri="https://monroe-humane.org/callback",
    )
    try:
        client.refresh(refresh_token=refresh)
        access, refresh = client.access_token, client.refresh_token
        conn.execute(
            "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
            (refresh, access, realm),
        )
        conn.commit()
    except Exception as e:
        print(f"Refresh failed ({type(e).__name__}); using stored token.")
    conn.close()
    return access, realm


def month_ranges(start_year, start_month, end_year, end_month):
    y, m = start_year, start_month
    while (y, m) <= (end_year, end_month):
        last_day = calendar.monthrange(y, m)[1]
        yield y, m, f"{y:04d}-{m:02d}-01", f"{y:04d}-{m:02d}-{last_day:02d}"
        m += 1
        if m > 12:
            m, y = 1, y + 1


def load_account_buckets() -> dict:
    """{clean account name (upper): 'revenue'|'cogs'|'operating_exp'|'other_exp'|None}"""
    conn = sqlite3.connect(AUDIT_DB)
    cur = conn.cursor()
    cur.execute("SELECT name, classification, account_type FROM accounts")
    buckets = {}
    for name, classification, account_type in cur.fetchall():
        if not name:
            continue
        key = clean_name(name).upper()
        if classification == "Revenue":
            buckets[key] = "revenue"
        elif classification == "Expense":
            if account_type == "Cost of Goods Sold":
                buckets[key] = "cogs"
            elif account_type == "Other Expense":
                buckets[key] = "other_exp"
            else:
                buckets[key] = "operating_exp"
        else:
            buckets[key] = None
    conn.close()
    return buckets


def load_name_group_map() -> dict:
    """{clean leaf category name (upper): {"name": display, "group": display}}"""
    lookup: dict = {}

    def add(name, group):
        if not name:
            return
        key = clean_name(name).upper()
        lookup.setdefault(key, {"name": name, "group": group or name})

    pub_path = os.path.join(ROOT, "api", "data", "published_2026_ytd.json")
    if os.path.isfile(pub_path):
        with open(pub_path, encoding="utf-8") as f:
            pub = json.load(f)
        for m in pub.get("monthly_statements", []):
            for item in m.get("rev_items", []) + m.get("exp_items", []):
                add(item.get("name"), item.get("group"))

    drill_path = os.path.join(ROOT, "api", "data", "monthly_drilldown_2026.json")
    if os.path.isfile(drill_path):
        with open(drill_path, encoding="utf-8") as f:
            drill = json.load(f)
        for month in drill.get("months", {}).values():
            for cat in month.get("revenueCategories", []) + month.get("expenseCategories", []):
                add(cat.get("name"), cat.get("group"))

    return lookup


# Leaf names that don't appear anywhere in the 2026 files (so the automatic
# lookup can't find them) but have a clear, evidenced correspondence --
# confirmed against this session's own QBO account classification and
# account-name findings, not guessed. Everything else stays as the raw QBO
# name (the safe fallback), rather than inventing a display name.
MANUAL_NAME_OVERRIDES = {
    "DONATIONS DIRECTED BY INDIVIDUALS": ("Individual Donor Contributions", "Contributed income"),
    "DONATION CANISTERS (DOG BANKS)": ("Donation Canisters (Dog Banks)", "Contributed income"),
    "SALARIES & WAGES": ("Staff wages", "Staff"),
    # QBO has two separate accounts for this, "Salaries & Wages" and
    # "Salaries & Wages-1" (confirmed live in the chart of accounts) -- a
    # leftover duplicate from an earlier rename/merge, not two distinct kinds
    # of pay. "-1" is actually the larger of the two in 2025 ($357,528.64 vs
    # $37,279.38), so leaving it unmapped would show board members "Staff
    # wages" as a small line and hide the real majority of payroll under a
    # confusing raw account name. merge_duplicate_categories() below combines
    # both into one "Staff wages" card once they share this display name.
    "SALARIES & WAGES-1": ("Staff wages", "Staff"),
    "ACCOUNTING FEES": ("Accounting fees", "Contract & professional fees"),
    "LEGAL FEES": ("Legal fees", "Contract & professional fees"),
    "DOG MICROCHIP": ("Dog Microchip", "Veterinary & Medical Care"),
    "DOG VACCINATIONS": ("Dog Vaccinations", "Veterinary & Medical Care"),
    "HEARTWORM TESTS": ("Heartworm Tests", "Veterinary & Medical Care"),
    "HEALTH INSURANCE & ACCIDENT PLANS": ("Health insurance & accident plans", "Personnel & Staffing"),
    "GAS": ("Vehicle Fuel", "Vehicle expenses"),
    "SALES OF PRODUCT INCOME": ("Sales of Product Income", "Revenue"),
    "SALES OF PRODUCT REVENUE": ("Sales of Product Income", "Revenue"),
    # Confirmed directly by the org (2025-10-14 wire, $251,713.50): proceeds
    # from a building/property sale, already posted by QBO's own books to an
    # "Other Income" account, not a donor-contribution account -- keep that
    # distinction visible instead of folding it into "Contributed income".
    "PROPERTY SALE": ("Property Sale", "Other Income (non-recurring)"),
    # 2026's detailed drilldown (api/data/monthly_drilldown_2026.json) already
    # displays this exact QBO leaf account as "Adoption fees" / "Adoptions
    # and events" -- confirmed live by inspection, not guessed. Matching it
    # keeps 2025 and 2026 visually consistent in the Money Detail Explorer.
    "ANIMAL ADOPTIONS": ("Adoption fees", "Adoptions and events"),
}

# Wire/ACH reference codes with no QBO entity attached, where the payer is
# already known from context (confirmed with the org) rather than recoverable
# from any QBO field -- avoids showing "Unknown" for a transaction whose
# identity isn't actually in question.
KNOWN_MEMO_LABELS = {
    "INCOMING WIRE K0UAA": "Building sale proceeds (wire, Oct 14 2025)",
    "INCOMING WIRE I1GW3": "Major Donor Wire (Oct 6 2025)",
}


def apply_manual_overrides(lookup: dict) -> dict:
    # Force-assign rather than setdefault: an explicit, evidenced manual
    # override should always win over whatever the automatic 2026-file scan
    # happened to pick up. Confirmed necessary for "ANIMAL ADOPTIONS" --
    # published_2026_ytd.json's coarser monthly_statements rev_items already
    # carries a stale ("Animal Adoptions", "Revenue") pair that setdefault
    # would otherwise leave in place ahead of this override, even though the
    # detailed 2026 drilldown itself displays this same money as
    # ("Adoption fees", "Adoptions and events").
    for key, (name, group) in MANUAL_NAME_OVERRIDES.items():
        lookup[key] = {"name": name, "group": group}
    return lookup


def is_leaf_data_section(row: dict) -> bool:
    sub_rows = row.get("Rows", {}).get("Row", [])
    if not sub_rows:
        return False
    return all(r.get("type") == "Data" for r in sub_rows)


def extract_transactions(row: dict, entity_index: dict) -> list[dict]:
    out = []
    for r in row.get("Rows", {}).get("Row", []):
        if r.get("type") != "Data":
            continue
        vals = [c.get("value", "") for c in r.get("ColData", [])]
        if len(vals) < 7:
            continue
        date = vals[0]
        if not date or date == "Beginning Balance":
            continue
        # Year-end adjusting/reversing journal entries (found live: multiple
        # 2024-12-31 "AJE" entries reversing duplicated payroll postings,
        # correcting fixed-asset balances, writing off unknown balances --
        # six-figure single lines that inflate both revenue and expense far
        # past the certified Form 990 totals). These are bookkeeping
        # corrections, not real donor/vendor activity -- exclude them from
        # the transaction-level drilldown the same way non-donation accounts
        # are already excluded from the donor pipeline.
        if (vals[1] or "").strip().lower() == "journal entry":
            continue
        try:
            amount = float(str(vals[6]).replace(",", "") or 0)
        except ValueError:
            continue
        # Preserve the true sign -- do NOT abs() this. QBO's GL report shows
        # a contra/reversing entry (a refund coded straight to a revenue
        # account, a vendor rebate coded straight to an expense account, an
        # overpayment refund) as negative, and abs()'ing it silently flipped
        # a subtraction into an addition. Confirmed live and directly, not
        # guessed: a $200 adoption-fee refund posts as "-200.00" under the
        # "Animal Adoptions" revenue account (Check #4179/#4180, Jan 2025), a
        # $220 BISSELL Pet Foundation rebate posts as "-220.00" under the
        # "General Shelter Supplies" expense account, and a $455 liability-
        # insurance overpayment refund posts as "-455.00" under "Liability
        # insurance" -- all three were being added as positive instead of
        # subtracted, overstating both revenue and expense.
        name = clean_name(vals[3])
        if not name:
            name = KNOWN_MEMO_LABELS.get((vals[4] or "").strip())
        if not name:
            # The GL report's own Name column is frequently blank even when
            # the underlying Deposit/SalesReceipt line has a real named
            # Entity -- backfill from the richer mirror-DB index built in
            # load_entity_enrichment_index() before falling back to "Unknown".
            # The index itself is keyed by the deposit LINE's own amount,
            # which is always positive regardless of how this GL row's sign
            # reads from the contra account's side -- look up by magnitude.
            candidates = entity_index.get((date, round(abs(amount), 2)))
            if candidates:
                name = candidates.pop(0)
        out.append({
            "date": date,
            "type": vals[1],
            "num": vals[2],
            "name": name or "Unknown",
            "memo": vals[4],
            "split": clean_name(vals[5]),
            "amount": amount,
        })
    return out


def walk_leaves(row: dict, results: list[dict], entity_index: dict):
    """Recursively find leaf category sections (direct parent of Data rows),
    tolerating arbitrary nesting depth beyond the 2-level case seen in
    practice."""
    header_vals = [c.get("value", "") for c in row.get("Header", {}).get("ColData", [])]
    name = header_vals[0] if header_vals else ""
    if not name:
        return  # QBO's own "... with sub-accounts" rollup row -- skip
    if is_leaf_data_section(row):
        txs = extract_transactions(row, entity_index)
        if txs:
            results.append({"name": clean_name(name), "transactions": txs})
        return
    for child in row.get("Rows", {}).get("Row", []):
        if "Header" in child:
            walk_leaves(child, results, entity_index)


def build_category(leaf_name: str, transactions: list[dict], name_group_map: dict) -> dict:
    mapped = name_group_map.get(leaf_name.upper())
    display_name = mapped["name"] if mapped else leaf_name
    group = mapped["group"] if mapped else leaf_name

    by_payee: dict = {}
    for tx in transactions:
        p = by_payee.setdefault(tx["name"], {"name": tx["name"], "total": 0.0, "txCount": 0, "transactions": []})
        p["total"] += tx["amount"]
        p["txCount"] += 1
        p["transactions"].append({k: tx[k] for k in ("date", "type", "num", "memo", "split", "amount")})

    payees = sorted(by_payee.values(), key=lambda p: -p["total"])
    total = sum(p["total"] for p in payees)
    return {
        "name": display_name,
        "group": group,
        "total": round(total, 2),
        "pctOfTotal": 0.0,
        "payeeCount": len(payees),
        "txCount": sum(p["txCount"] for p in payees),
        "payees": payees,
        "_mapped": mapped is not None,
    }


def fetch_month(session, realm, year, month, start, end, buckets, name_group_map, unmapped: set, entity_index: dict):
    params = {"start_date": start, "end_date": end, "accounting_method": "Accrual"}
    url = f"https://quickbooks.api.intuit.com/v3/company/{realm}/reports/GeneralLedger?" + urllib.parse.urlencode(params)
    attempt = 0
    while True:
        r = session.get(url, timeout=90)
        if r.status_code == 200:
            break
        if r.status_code in (429, 500, 503) and attempt < 5:
            time.sleep(2 ** attempt)
            attempt += 1
            continue
        print(f"{year}-{month:02d}: FAILED {r.status_code} {r.text[:200]}")
        return None
    data = r.json()
    top_rows = data.get("Rows", {}).get("Row", [])

    rev_cats, cogs_cats, opex_cats, other_cats = [], [], [], []
    for top in top_rows:
        header_vals = [c.get("value", "") for c in top.get("Header", {}).get("ColData", [])]
        top_name = header_vals[0] if header_vals else ""
        if not top_name:
            continue
        bucket = buckets.get(clean_name(top_name).upper())
        if bucket is None:
            continue  # Asset/Liability/Equity or unknown account -- not P&L

        leaves: list[dict] = []
        walk_leaves(top, leaves, entity_index)
        for leaf in leaves:
            if leaf["name"].upper() not in name_group_map:
                unmapped.add(leaf["name"])
            cat = build_category(leaf["name"], leaf["transactions"], name_group_map)
            if bucket == "revenue":
                rev_cats.append(cat)
            elif bucket == "cogs":
                cogs_cats.append(cat)
            elif bucket == "operating_exp":
                opex_cats.append(cat)
            else:
                other_cats.append(cat)

    def merge_duplicate_categories(cats):
        """Two raw QBO leaf accounts can map to the same display (name, group)
        -- e.g. "Salaries & Wages" / "Salaries & Wages-1" both -> "Staff
        wages". Combine those into one card instead of showing two
        same-named categories with split totals."""
        merged: dict = {}
        order: list = []
        for c in cats:
            key = (c["name"], c["group"])
            if key not in merged:
                merged[key] = c
                order.append(key)
                continue
            existing = merged[key]
            existing["total"] = round(existing["total"] + c["total"], 2)
            existing["txCount"] += c["txCount"]
            by_payee = {p["name"]: p for p in existing["payees"]}
            for p in c["payees"]:
                if p["name"] in by_payee:
                    ep = by_payee[p["name"]]
                    ep["total"] = round(ep["total"] + p["total"], 2)
                    ep["txCount"] += p["txCount"]
                    ep["transactions"].extend(p["transactions"])
                else:
                    by_payee[p["name"]] = p
            existing["payees"] = sorted(by_payee.values(), key=lambda p: -p["total"])
            existing["payeeCount"] = len(existing["payees"])
        return [merged[k] for k in order]

    rev_cats = merge_duplicate_categories(rev_cats)
    cogs_cats = merge_duplicate_categories(cogs_cats)
    opex_cats = merge_duplicate_categories(opex_cats)
    other_cats = merge_duplicate_categories(other_cats)

    def finalize(cats):
        total = sum(c["total"] for c in cats)
        for c in cats:
            c["pctOfTotal"] = round((c["total"] / total) * 100, 1) if total > 0 else 0.0
            c.pop("_mapped", None)
        return sorted(cats, key=lambda c: -c["total"]), round(total, 2)

    rev_cats, revenue = finalize(rev_cats)
    cogs_cats, cogs = finalize(cogs_cats)
    opex_cats, operating_exp = finalize(opex_cats)
    other_cats, other_exp = finalize(other_cats)
    total_exp = round(cogs + operating_exp + other_exp, 2)
    net_margin = round(revenue - total_exp, 2)

    all_exp_cats = sorted(cogs_cats + opex_cats + other_cats, key=lambda c: -c["total"])
    top_exp = all_exp_cats[0] if all_exp_cats else None
    driver = (
        f"Largest expense: {top_exp['name']} (${top_exp['total']:,.0f})"
        if top_exp else "No significant expense activity this month."
    )

    month_id = f"month_{year}_{month - 1}"
    month_name = f"{calendar.month_abbr[month]} {year}"
    total_rev_txs = sum(c["txCount"] for c in rev_cats)
    total_exp_txs = sum(c["txCount"] for c in all_exp_cats)

    drilldown_month = {
        "id": month_id,
        "monthKey": f"{year:04d}-{month:02d}",
        "monthName": month_name,
        "isPartial": False,
        "status": "",
        "driver": driver,
        "revenue": revenue,
        "total_exp": total_exp,
        "net_margin": net_margin,
        "totalRevenueTxs": total_rev_txs,
        "totalExpenseTxs": total_exp_txs,
        "revenueCategories": rev_cats,
        "expenseCategories": all_exp_cats,
    }

    statement_row = {
        "id": month_id,
        "month": month_name,
        "is_partial": False,
        "revenue": revenue,
        "cogs": cogs,
        "operating_exp": operating_exp,
        "other_exp": other_exp,
        "total_exp": total_exp,
        "net_margin": net_margin,
        "margin_pct": round((net_margin / revenue) * 100, 1) if revenue else 0.0,
        "status": "",
        "driver": driver,
        "rev_items": [{"name": c["name"], "group": c["group"], "amount": c["total"]} for c in rev_cats],
        "exp_items": [{"name": c["name"], "group": c["group"], "amount": c["total"]} for c in all_exp_cats],
    }

    print(f"{year}-{month:02d}: revenue={revenue:,.2f} total_exp={total_exp:,.2f} net={net_margin:,.2f} "
          f"(rev_cats={len(rev_cats)} exp_cats={len(all_exp_cats)})")
    return drilldown_month, statement_row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", default="2024-01")
    ap.add_argument("--end", default="2025-12")
    args = ap.parse_args()
    sy, sm = (int(x) for x in args.start.split("-"))
    ey, em = (int(x) for x in args.end.split("-"))

    access, realm = get_access_token()
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {access}", "Accept": "application/json"})

    buckets = load_account_buckets()
    name_group_map = apply_manual_overrides(load_name_group_map())
    unmapped: set = set()

    range_start = f"{sy:04d}-{sm:02d}-01"
    range_end = f"{ey:04d}-{em:02d}-{calendar.monthrange(ey, em)[1]:02d}"
    entity_index = load_entity_enrichment_index(range_start, range_end)
    print(f"Entity enrichment index: {sum(len(v) for v in entity_index.values())} candidate names "
          f"across {len(entity_index)} distinct (date, amount) keys, {range_start}..{range_end}")

    by_year: dict = {}
    for year, month, start, end in month_ranges(sy, sm, ey, em):
        result = fetch_month(session, realm, year, month, start, end, buckets, name_group_map, unmapped, entity_index)
        if result is None:
            continue
        drilldown_month, statement_row = result
        by_year.setdefault(year, {"months": {}, "statements": []})
        by_year[year]["months"][drilldown_month["id"]] = drilldown_month
        by_year[year]["statements"].append(statement_row)
        time.sleep(0.2)

    os.makedirs(OUT_DIR, exist_ok=True)
    for year, payload in by_year.items():
        drill_out = {
            "meta": {
                "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                "source": "QuickBooks Online General Ledger",
                "closedMonthsCount": len(payload["statements"]),
                "periodTitle": f"{year} Month-to-Month 3-Level Hierarchical Drilldown",
                "driverNote": "driver text is auto-generated (largest expense category), not curated",
            },
            "months": payload["months"],
        }
        drill_path = os.path.join(OUT_DIR, f"monthly_drilldown_{year}.json")
        with open(drill_path, "w", encoding="utf-8") as f:
            json.dump(drill_out, f, indent=2)
        print(f"Wrote {drill_path}")

        stmt_path = os.path.join(OUT_DIR, f"monthly_statements_{year}.json")
        with open(stmt_path, "w", encoding="utf-8") as f:
            json.dump(payload["statements"], f, indent=2)
        print(f"Wrote {stmt_path}")

    if unmapped:
        print(f"\n{len(unmapped)} unmapped leaf categories (using raw name as display name/group):")
        for n in sorted(unmapped):
            print(f"  - {n}")

    print("\nUnknown-payee rate by year (revenue only, after entity enrichment):")
    for year, payload in sorted(by_year.items()):
        total_rev, unknown_rev = 0.0, 0.0
        total_n, unknown_n = 0, 0
        for month in payload["months"].values():
            for cat in month["revenueCategories"]:
                for payee in cat["payees"]:
                    total_rev += payee["total"]
                    total_n += payee["txCount"]
                    if payee["name"] == "Unknown":
                        unknown_rev += payee["total"]
                        unknown_n += payee["txCount"]
        pct = (unknown_rev / total_rev * 100) if total_rev else 0.0
        print(f"  {year}: ${unknown_rev:,.2f} of ${total_rev:,.2f} ({pct:.1f}%) still Unknown, "
              f"{unknown_n} of {total_n} transactions")


if __name__ == "__main__":
    main()
