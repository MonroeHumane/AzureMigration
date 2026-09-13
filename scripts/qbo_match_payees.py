#!/usr/bin/env python3
"""Build a persistent payee-matching database for the revenue-side "Unknown"
transactions left over after qbo_fetch_monthly_gl_drilldown.py's live-QBO
entity enrichment, and apply every high-confidence match back into the
published monthly_drilldown_{year}.json files.

Why this exists: the GL report's own Name column, and even the raw QBO
Deposit/SalesReceipt Entity field, are both frequently blank -- but the same
Deposit line's own Description field often *does* carry a real donor name
(e.g. "SUSAN FRANCES COWCHOCK"), just not in a structured field. This reuses
the exact pattern-matching rules already proven in extract_qbo_deposit_gifts.py
(the script that built api/data/donor_database.json) rather than re-inventing
weaker heuristics: a description only counts as a name if it looks like one
(2+ alphabetic words, 5-80 chars) and isn't a known payment-processor/bank
artifact ("Square Inc/0202 SQUAR", "DEPOSIT", "BetterUnite Payo...", etc).

Two independent matching passes, both logged to a real SQLite database
(scripts/data/payee_matching.db) for audit -- not just silently applied:
  1. Description-pattern match -- looks_like_named_donor() on the
     transaction's own memo/description text.
  2. Donor-database cross-check -- (date, amount) lookup against every gift
     already in api/data/donor_database.json (built from the same
     Deposit/SalesReceipt records via a slightly different fallback path,
     so it occasionally has a name this pull's entity index missed).

Usage:
  python scripts/qbo_match_payees.py --year 2025
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sqlite3
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "scripts", "data")
API_DATA_DIR = os.path.join(ROOT, "api", "data")
DB_PATH = os.path.join(DATA_DIR, "payee_matching.db")

# Identical to extract_qbo_deposit_gifts.py's proven rules -- reused, not
# reinvented, so a name is only ever accepted here if the same logic that
# already built api/data/donor_database.json would also have accepted it.
SKIP_ENTITY_RE = re.compile(
    r"better\s*unite|paypal|square(\s+inc)?$|^intuit\b|branch deposit batch|"
    r"^deposit$|public\s*/\s*shelter adopters|quickbooks journal|\bzeffy\b|"
    r"^incoming wire\b|^wire transfer\b|\bach\s+(pmt|payment)\b",
    re.I,
)
WORD_RE = re.compile(r"^[A-Za-z][A-Za-z.'-]*$")
FILLER_RE = re.compile(r"^(AND|&|OF|THE|SON|FOR)$", re.I)


def skip_entity(name: str) -> bool:
    n = (name or "").strip()
    if not n:
        return True
    return bool(SKIP_ENTITY_RE.search(n))


def looks_like_named_donor(raw: str) -> bool:
    t = re.sub(r"\s+", " ", raw or "").strip()
    if len(t) < 5 or len(t) > 80:
        return False
    words = t.split(" ")
    if len(words) < 2:
        return False
    return all(WORD_RE.match(w) or FILLER_RE.match(w) for w in words)


def clean_title_case(name: str) -> str:
    # Memo text is often shouty caps ("SUSAN FRANCES COWCHOCK"); title-case it
    # for display consistency with the rest of the donor-facing UI, but leave
    # short all-caps tokens (initials, "II", "LLC") alone.
    words = name.split(" ")
    out = []
    for w in words:
        out.append(w if len(w) <= 3 and w.isupper() else w.capitalize())
    return " ".join(out)


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS gl_transactions (
            id TEXT PRIMARY KEY,
            year INTEGER NOT NULL,
            month_id TEXT NOT NULL,
            category TEXT NOT NULL,
            group_name TEXT NOT NULL,
            txn_date TEXT NOT NULL,
            txn_type TEXT,
            memo TEXT,
            split_account TEXT,
            amount REAL NOT NULL,
            original_name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS payee_matches (
            transaction_id TEXT NOT NULL REFERENCES gl_transactions(id),
            matched_name TEXT NOT NULL,
            method TEXT NOT NULL,
            confidence TEXT NOT NULL,
            detail TEXT,
            matched_at TEXT NOT NULL,
            PRIMARY KEY (transaction_id, method)
        );
        """
    )
    conn.commit()


def txn_id(year: int, month_id: str, category: str, tx: dict, idx: int) -> str:
    return f"{month_id}|{category}|{tx['date']}|{tx['amount']}|{idx}"


def load_donor_gift_index() -> dict:
    """{(date, amount rounded to cents): [donor name, ...]} from the existing
    donor database -- built from the same Deposit/SalesReceipt records via
    extract_qbo_deposit_gifts.py's Description-fallback path, so it can
    surface a name this run's own entity index missed."""
    path = os.path.join(API_DATA_DIR, "donor_database.json")
    if not os.path.isfile(path):
        return {}
    with open(path, encoding="utf-8") as f:
        dd = json.load(f)
    index: dict = {}
    for donor in dd.get("donors", []):
        if donor.get("isAggregate"):
            continue
        for g in donor.get("gifts", []):
            try:
                key = (g["date"], round(float(g["amount"]), 2))
            except (KeyError, TypeError, ValueError):
                continue
            index.setdefault(key, []).append(donor["name"])
    return index


# Category-convention rules -- NOT guesses. Each one is the org's own
# established label for this exact kind of transaction, confirmed live
# against api/data/monthly_drilldown_2026.json (which is independently
# 0% "Unknown"): 2026 labels the identical category/memo combination this
# same way. These take priority over the generic passes below because they
# reflect the org's own convention that a fee-for-service/processor-batch
# deposit was never going to carry a person's name -- "Unknown" is actively
# misleading there, not just incomplete.
CATEGORY_CONVENTION_RULES = [
    # (category name, memo predicate, matched name, evidence)
    ("Individual Donor Contributions", lambda m: "BETTERUNITE" in m.upper(), "BetterUnite",
     "2026 labels all 'BetterUnite' platform payout memos to this matching entity name"),
    ("Individual Donor Contributions", lambda m: "PAYPAL/TRANSFER" in m.upper(), "PayPal Giving Fund",
     "2026 labels all PayPal batch payouts to this matching entity name"),
    ("Individual Donor Contributions", lambda m: m.strip().upper() == "DEPOSIT", "Branch Deposit Batch",
     "org-wide convention for unattributed cash/check register batches"),
    ("Adoption fees", lambda m: "SQUAR" in m.upper(), "Square Inc",
     "2026's identical 'Adoption fees' category uses payee 'Square Inc' for this same card-batch memo"),
    ("Adoption fees", lambda m: m.strip().upper() == "DEPOSIT", "Branch Deposit Batch",
     "2026's 'Adoption fees' category uses 'Branch Deposit Batch' for cash/check adoption-fee deposits"),
    ("Services", lambda m: m.strip().upper() == "DEPOSIT", "Branch Deposit Batch",
     "2026 splits this same QBO group into named fee lines but labels unattributed program-fee deposits 'Branch Deposit Batch'"),
    ("Bottle & Can Recycling Revenue", lambda m: True, "Branch Deposit Batch",
     "every 2026 'Bottle & Can Recycling Revenue' payee entry is 'Branch Deposit Batch' -- redemption income has no donor"),
    ("Event Donation", lambda m: "AUCTION GAMES" in m.upper(), "Auction Games & Items (2025 event)",
     "memo verbatim reads '2025 AUCTION GAMES, ITEMS' -- event proceeds, not a named gift"),
]

# Single-transaction literal identifications -- a real name/company sits in
# the memo but fails looks_like_named_donor() because of surrounding
# processor boilerplate (slashes, repeated text, trailing "ACH Pmt ..."), so
# match on a distinctive substring instead of the full memo.
KNOWN_MEMO_SUBSTRINGS = [
    ("PROVEN WINNERS", "Proven Winners"),
    ("BISSELL PET", "BISSELL Pet Foundation"),
    ("WINNERS AUT", "Winners Auto & Cycle (mis-coded expense)"),
]


def match_by_category_convention(category: str, tx: dict) -> tuple[str, str, str, str] | None:
    memo = (tx.get("memo") or "")
    for cat_name, predicate, matched_name, evidence in CATEGORY_CONVENTION_RULES:
        if category == cat_name and predicate(memo):
            return matched_name, "category_convention", "high", evidence
    return None


def match_transaction(category: str, tx: dict, donor_index: dict) -> tuple[str, str, str, str] | None:
    """Returns (matched_name, method, confidence, detail) or None."""
    result = match_by_category_convention(category, tx)
    if result:
        return result

    memo = (tx.get("memo") or "").strip()
    for substring, matched_name in KNOWN_MEMO_SUBSTRINGS:
        if substring in memo.upper():
            return matched_name, "known_memo_substring", "high", f"memo={memo!r}"

    if memo and not skip_entity(memo) and looks_like_named_donor(memo):
        return clean_title_case(memo), "description_pattern", "medium", f"memo={memo!r}"

    key = (tx["date"], round(tx["amount"], 2))
    candidates = donor_index.get(key)
    if candidates:
        return candidates[0], "donor_database_lookup", "medium", f"matched {len(candidates)} candidate(s) by date+amount"

    return None


def rebuild_category(cat: dict) -> None:
    by_payee: dict = {}
    for payee in cat["payees"]:
        for tx in payee["transactions"]:
            name = tx.get("_matched_name") or payee["name"]
            p = by_payee.setdefault(name, {"name": name, "total": 0.0, "txCount": 0, "transactions": []})
            p["total"] += tx["amount"]
            p["txCount"] += 1
            tx.pop("_matched_name", None)
            p["transactions"].append(tx)
    payees = sorted(by_payee.values(), key=lambda p: -p["total"])
    for p in payees:
        p["total"] = round(p["total"], 2)
    cat["payees"] = payees
    cat["payeeCount"] = len(payees)
    cat["txCount"] = sum(p["txCount"] for p in payees)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2025)
    args = ap.parse_args()

    drill_path = os.path.join(DATA_DIR, f"monthly_drilldown_{args.year}.json")
    with open(drill_path, encoding="utf-8") as f:
        drilldown = json.load(f)

    donor_index = load_donor_gift_index()
    print(f"Donor-database gift index: {sum(len(v) for v in donor_index.values())} gifts, "
          f"{len(donor_index)} distinct (date, amount) keys")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    init_db(conn)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    total_before = total_after = 0.0
    n_before = 0
    matched_amt = 0.0
    matched_n = 0
    method_totals: dict = {}

    for month_id, month in drilldown["months"].items():
        for section in ("revenueCategories", "expenseCategories"):
            for cat in month.get(section, []):
                for payee in cat["payees"]:
                    for idx, tx in enumerate(payee["transactions"]):
                        if section == "revenueCategories":
                            total_before += tx["amount"]
                            n_before += 1
                        if payee["name"] != "Unknown":
                            continue

                        tid = f"{section}|" + txn_id(args.year, month_id, cat["name"], tx, idx)
                        conn.execute(
                            """INSERT OR REPLACE INTO gl_transactions
                               (id, year, month_id, category, group_name, txn_date, txn_type,
                                memo, split_account, amount, original_name)
                               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                            (tid, args.year, month_id, cat["name"], cat["group"], tx["date"],
                             tx.get("type"), tx.get("memo"), tx.get("split"), tx["amount"], payee["name"]),
                        )

                        result = match_transaction(cat["name"], tx, donor_index)
                        if result:
                            matched_name, method, confidence, detail = result
                            conn.execute(
                                """INSERT OR REPLACE INTO payee_matches
                                   (transaction_id, matched_name, method, confidence, detail, matched_at)
                                   VALUES (?,?,?,?,?,?)""",
                                (tid, matched_name, method, confidence, detail, now),
                            )
                            tx["_matched_name"] = matched_name
                            if section == "revenueCategories":
                                matched_amt += tx["amount"]
                                matched_n += 1
                                method_totals[method] = method_totals.get(method, 0.0) + tx["amount"]

                rebuild_category(cat)

        # recompute pctOfTotal per month now that payee groupings shifted
        total = sum(c["total"] for c in month["revenueCategories"])
        for c in month["revenueCategories"]:
            c["pctOfTotal"] = round((c["total"] / total) * 100, 1) if total > 0 else 0.0
        month["totalRevenueTxs"] = sum(c["txCount"] for c in month["revenueCategories"])

    conn.commit()

    total_after = sum(
        tx["amount"]
        for m in drilldown["months"].values()
        for c in m["revenueCategories"]
        for p in c["payees"]
        for tx in p["transactions"]
    )

    unknown_after_amt = sum(
        p["total"]
        for m in drilldown["months"].values()
        for c in m["revenueCategories"]
        for p in c["payees"]
        if p["name"] == "Unknown"
    )
    unknown_after_n = sum(
        p["txCount"]
        for m in drilldown["months"].values()
        for c in m["revenueCategories"]
        for p in c["payees"]
        if p["name"] == "Unknown"
    )

    print(f"\nTotal revenue transactions: {n_before} (${total_before:,.2f})")
    print(f"Newly matched: {matched_n} transactions, ${matched_amt:,.2f}")
    for method, amt in sorted(method_totals.items(), key=lambda kv: -kv[1]):
        print(f"  {method}: ${amt:,.2f}")
    print(f"Still Unknown after matching: {unknown_after_n} transactions, ${unknown_after_amt:,.2f} "
          f"({unknown_after_amt/total_before*100:.1f}% of revenue)")
    assert abs(total_before - total_after) < 0.01, "dollar total changed during matching -- bug"

    with open(drill_path, "w", encoding="utf-8") as f:
        json.dump(drilldown, f, indent=2)
    print(f"\nWrote {drill_path}")

    conn.close()
    print(f"Match audit trail: {DB_PATH}")


if __name__ == "__main__":
    main()
