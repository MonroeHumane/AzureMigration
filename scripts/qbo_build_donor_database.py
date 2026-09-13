#!/usr/bin/env python3
"""Build api/data/donor_database.json for the staff-portal Donors page from
the named-gift extraction in extract_qbo_deposit_gifts.py.

extract_qbo_deposit_gifts.py already pulls named Deposit/SalesReceipt lines
plus a Customer/Vendor directory from the live QBO mirror
(E:\\qbbackup\\qbo_mirror.db). This script adds the missing piece: grouping
those flat gifts into one record per donor, in the exact shape
frontend/src/components/donors/DonorRosterTable.astro's Donor/Gift
TypeScript interfaces expect, plus the donor_meta block
frontend/src/pages/internal/donors/index.astro reads.

A few entity names that slip through extract_qbo_deposit_gifts.py's
SKIP_ENTITY_RE are institutional revenue, not donations (confirmed against
this org's own books during the 2024-2026 reconciliation): county
animal-control contract payments, Kroger/retail rebates, and a Fidelity
Brokerage endowment transfer. Those are excluded here rather than upstream,
since extract_qbo_deposit_gifts.py is a general named-transaction extractor
and county/Kroger amounts are legitimate named transactions -- just not
donor gifts.

Usage:
  python scripts/qbo_build_donor_database.py
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_qbo_deposit_gifts import extract, YEARS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "api", "data", "donor_database.json")

# Staff decisions from the "possible duplicates" review panel live in a small
# private blob (no PII beyond donor IDs), not git -- a browser click can't
# commit to git, and this needs to reflect the latest staff review between
# build runs. Set via env var (mirrors DONOR_DATA_BLOB_URL's role in
# api/src/index.js); local runs with it unset just see zero confirmed
# decisions, which is a safe default (nothing gets auto-merged).
MERGE_DECISIONS_URL = os.environ.get("DONOR_MERGE_DECISIONS_URL", "").strip()

DELETED_SUFFIX_RE = re.compile(r"\s*\(deleted\)\s*$", re.I)

# Named, but not a donor: institutional revenue this org already tracks
# separately from contributed income (county contract, retail rebates,
# endowment/brokerage transfers), payment-processor pass-throughs that
# extract_qbo_deposit_gifts.py's own filter doesn't yet catch, and stray
# transaction-description artifacts that landed in the Entity field.
NON_DONOR_RE = re.compile(
    r"county of monroe|fidelity brokerage|^kroger$|kroger community rewards|"
    r"^we\s*pay$|american online giving|give lively foundation|"
    r"^square customer$|^wix$|^base contracting$|^ftc$|"
    r"^refund\b|overpayment|^adjustment$",
    re.I,
)

# Gift-level exclusions: some donors have a mix of real donations and
# non-donation income (rebates, recycling proceeds, retail sales, property
# transactions) under the SAME entity name -- filter by account rather than
# name so a donor's real gifts survive even when one of their other lines
# doesn't belong here (e.g. a corporate sponsor whose GL also runs vet-med
# rebate checks through the same vendor record).
NON_DONOR_ACCOUNTS = {
    "retail partner rebates", "vet med rebates", "bottle & can recycling revenue",
    "bottle refund", "rebate program", "property sale", "services",
    "sales of product income", "insurance:liability insurance",
    "office expenses:office supplies", "pet reclaim", "pet surrender",
    "court restitution", "investments",
}

TRIBUTE_RE = re.compile(r"in\s+(memory|honor|loving memory)\s+of\s+(.+)", re.I)

BANK_AGGREGATE_RE = re.compile(r"\btrust\b|via bank of america|^bank of america$", re.I)

TIERS = [
    ("visionary", "Visionary ($10k+)", "#7c3aed", 10000),
    ("benefactor", "Benefactor ($5k-$10k)", "#10b981", 5000),
    ("patron", "Patron ($1k-$5k)", "#3b82f6", 1000),
    ("sustainer", "Sustainer ($500-$1k)", "#14b8a6", 500),
    ("friend", "Friend ($100-$500)", "#f59e0b", 100),
    ("supporter", "Supporter (< $100)", "#94a3b8", 0),
]


def tier_for(total: float):
    for tier_id, label, color, floor in TIERS:
        if total >= floor:
            return tier_id, label, color
    return TIERS[-1][0], TIERS[-1][1], TIERS[-1][2]


def short_channel(gift: dict) -> str:
    if gift.get("checkNum"):
        return "Paper Check"
    pm = (gift.get("paymentMethod") or "").strip()
    if pm:
        return pm
    if gift.get("qboType") == "Sales Receipt":
        return "Sales Receipt"
    return "Bank Transfer"


def clean_name(name: str) -> str:
    # Strip a literal trailing "(deleted)" -- a stray QBO inactive-record
    # marker that otherwise leaks into a live donor's display name.
    return DELETED_SUFFIX_RE.sub("", name or "").strip()


def normalize_key(name: str) -> str:
    return re.sub(r"\s+", " ", clean_name(name)).strip().upper()


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return slug or "donor"


def pick_display_name(names: list[str]) -> str:
    # Prefer a mixed-case original over an ALL-CAPS one; otherwise most common.
    counts: dict[str, int] = {}
    for n in names:
        counts[n] = counts.get(n, 0) + 1
    mixed_case = [n for n in counts if not n.isupper()]
    pool = mixed_case or list(counts)
    return max(pool, key=lambda n: counts[n])


def compute_is_recurring(gift_dates: list[str]) -> bool:
    """A genuine sustained giver, not just someone with several gifts from
    one event/campaign: needs gifts spread across >= 3 distinct calendar
    months. (Validated against the real dataset: this cleanly separates
    donors like Dave Durchman/Martin DuBois -- gifts every month or two --
    from donors with several gifts logged the same week for one campaign.)"""
    if len(gift_dates) < 4:
        return False
    months = {d[:7] for d in gift_dates if d}
    return len(months) >= 3


def load_merge_decisions() -> list[dict]:
    if not MERGE_DECISIONS_URL:
        return []
    try:
        with urllib.request.urlopen(MERGE_DECISIONS_URL, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data if isinstance(data, list) else []
    except Exception as err:
        print(f"Warning: could not load merge decisions ({err}); treating as none confirmed yet.")
        return []


def decision_key(a_id: str, b_id: str) -> tuple[str, str]:
    return tuple(sorted((a_id, b_id)))


def merge_donor_pair(primary: dict, secondary: dict) -> dict:
    """Combine two donor records that a staff member confirmed are the same
    person/household. Keeps the higher-lifetime-total row's identity fields
    (name/id/contact) as canonical, unless it's missing something the other
    has (e.g. primary has no email but secondary does)."""
    merged_gifts = sorted(primary["gifts"] + secondary["gifts"], key=lambda g: g.get("date") or "")
    dates = [g["date"] for g in merged_gifts if g.get("date")]
    lifetime_total = round(primary["lifetimeTotal"] + secondary["lifetimeTotal"], 2)
    tier_id, tier_label, tier_color = tier_for(lifetime_total)
    address = primary["address"] or secondary["address"]
    return {
        "id": primary["id"],
        "name": primary["name"],
        "email": primary["email"] or secondary["email"],
        "phone": primary["phone"] or secondary["phone"],
        "address": address,
        "lifetimeTotal": lifetime_total,
        "itemizedTotal": lifetime_total,
        "isAggregate": primary["isAggregate"] or secondary["isAggregate"],
        "transactionsCount": len(merged_gifts),
        "firstGiftDate": min(dates) if dates else "",
        "latestGiftDate": max(dates) if dates else "",
        "givingTier": tier_label,
        "tierId": tier_id,
        "tierColor": tier_color,
        "platformsList": sorted(set(primary["platformsList"]) | set(secondary["platformsList"])),
        "campaignsList": sorted(set(primary["campaignsList"]) | set(secondary["campaignsList"])),
        "hasMailingAddress": bool(address),
        "tributesCount": sum(1 for g in merged_gifts if g["isTribute"]),
        "isRecurring": compute_is_recurring(dates),
        "gifts": merged_gifts,
    }


def apply_merge_decisions(donors: list[dict], decisions: list[dict]) -> tuple[list[dict], set[tuple[str, str]]]:
    by_id = {d["id"]: d for d in donors}
    not_duplicate_keys: set[tuple[str, str]] = set()
    removed_ids: set[str] = set()

    for dec in decisions:
        a_id, b_id = dec.get("aId"), dec.get("bId")
        if not a_id or not b_id:
            continue
        if dec.get("decision") == "not_duplicate":
            not_duplicate_keys.add(decision_key(a_id, b_id))
            continue
        if dec.get("decision") != "merge":
            continue
        a, b = by_id.get(a_id), by_id.get(b_id)
        if not a or not b or a_id in removed_ids or b_id in removed_ids:
            continue
        primary, secondary = (a, b) if a["lifetimeTotal"] >= b["lifetimeTotal"] else (b, a)
        merged = merge_donor_pair(primary, secondary)
        by_id[primary["id"]] = merged
        removed_ids.add(secondary["id"])

    result = [d for d in by_id.values() if d["id"] not in removed_ids]
    return result, not_duplicate_keys


NAME_JOINER_RE = re.compile(r"\b(AND)\b")


def name_first_tokens_and_surname(name: str) -> tuple[set[str], str]:
    n = re.sub(r"\s+", " ", (name or "").strip().upper())
    n = NAME_JOINER_RE.sub("&", n)
    parts = [p for p in n.split(" ") if p and p != "&"]
    if not parts:
        return set(), ""
    return set(parts[:-1]), parts[-1]


def is_joint_individual_match(name_a: str, name_b: str) -> bool:
    """Catches the real pattern found in this data: a joint household name
    ("Robert & Valerie Clark") recorded separately from an individual gift
    under just one spouse's name ("Robert Clark"), including nickname/prefix
    variants ("Doug" vs "Douglas") and spacing variants ("Maryann" vs "Mary
    Ann" still share the "Dennis" token)."""
    tokens_a, surname_a = name_first_tokens_and_surname(name_a)
    tokens_b, surname_b = name_first_tokens_and_surname(name_b)
    if not surname_a or surname_a != surname_b or not tokens_a or not tokens_b:
        return False
    for ta in tokens_a:
        for tb in tokens_b:
            if ta == tb or (len(ta) >= 3 and len(tb) >= 3 and (ta.startswith(tb) or tb.startswith(ta))):
                return True
    return False


def find_possible_duplicates(donors: list[dict], exclude_keys: set[tuple[str, str]]) -> list[dict]:
    """Only the two confidently-real signals validated against this dataset:
    exact contact-info match (Tier 1), and same-surname joint/individual name
    overlap (Tier 2). A broader fuzzy-name pass was tried and rejected --
    most hits were different people who happen to share a first name."""
    candidates: dict[tuple[str, str], dict] = {}

    def add(a: dict, b: dict, tier: int, signal: str):
        key = decision_key(a["id"], b["id"])
        if key in exclude_keys:
            return
        existing = candidates.get(key)
        if existing and existing["tier"] <= tier:
            return
        candidates[key] = {
            "aId": a["id"], "aName": a["name"], "aLifetimeTotal": a["lifetimeTotal"],
            "bId": b["id"], "bName": b["name"], "bLifetimeTotal": b["lifetimeTotal"],
            "tier": tier, "signal": signal,
        }

    non_aggregate = [d for d in donors if not d["isAggregate"]]

    for field, label in (("email", "email"), ("phone", "phone"), ("address", "address")):
        groups: dict[str, list[dict]] = {}
        for d in non_aggregate:
            val = (d.get(field) or "").strip().upper()
            if val:
                groups.setdefault(val, []).append(d)
        for group in groups.values():
            if len(group) < 2:
                continue
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    add(group[i], group[j], 1, f"same {label}")

    by_surname: dict[str, list[dict]] = {}
    for d in non_aggregate:
        _, surname = name_first_tokens_and_surname(d["name"])
        if surname:
            by_surname.setdefault(surname, []).append(d)
    for group in by_surname.values():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                if is_joint_individual_match(group[i]["name"], group[j]["name"]):
                    add(group[i], group[j], 2, "shared name (joint/individual)")

    return sorted(candidates.values(), key=lambda c: (c["tier"], -max(c["aLifetimeTotal"], c["bLifetimeTotal"])))


def build_gift(raw: dict) -> dict:
    memo_source = raw.get("description") or raw.get("memo") or raw.get("privateNote") or ""
    m = TRIBUTE_RE.search(memo_source) or TRIBUTE_RE.search(raw.get("privateNote") or "")
    is_tribute = bool(m)
    dedication = m.group(0).strip() if m else ""
    return {
        "date": raw.get("date") or "",
        "amount": raw.get("amount") or 0,
        "platform": short_channel(raw),
        "campaign": raw.get("qboClass") or "",
        "type": raw.get("qboType") or "",
        "memo": raw.get("memo") or "",
        "description": raw.get("description") or "",
        "privateNote": raw.get("privateNote") or "",
        "dedication": dedication,
        "isTribute": is_tribute,
        "reference": raw.get("reference") or "",
        "checkNumber": raw.get("checkNum") or "",
        "paymentMethod": raw.get("paymentMethod") or "",
        "qboClass": raw.get("qboClass") or "",
        "qboType": raw.get("qboType") or "",
        "account": raw.get("account") or "",
        "glCategory": raw.get("account") or "",
        "source": raw.get("source") or "QuickBooks Online",
    }


def main():
    extracted = extract(YEARS)
    gifts = extracted["gifts"]
    directory = extracted.get("directory") or {}
    customers_by_name = {
        normalize_key(c["displayName"]): c for c in directory.get("customers", []) if c.get("displayName")
    }

    groups: dict[str, dict] = {}
    skipped_accounts = 0
    for raw in gifts:
        name = raw.get("donorName") or ""
        if NON_DONOR_RE.search(name):
            continue
        if (raw.get("account") or "").strip().lower() in NON_DONOR_ACCOUNTS:
            skipped_accounts += 1
            continue
        key = normalize_key(name)
        if not key:
            continue
        g = groups.setdefault(key, {"names": [], "gifts": [], "entity_ids": set()})
        g["names"].append(clean_name(name))
        g["gifts"].append(raw)
        if raw.get("entityId"):
            g["entity_ids"].add(raw["entityId"])

    donors = []
    for key, g in groups.items():
        display_name = pick_display_name(g["names"])
        raw_gifts = sorted(g["gifts"], key=lambda r: r.get("date") or "")
        gifts_out = [build_gift(r) for r in raw_gifts]

        lifetime_total = round(sum(r.get("amount") or 0 for r in raw_gifts), 2)
        tx_count = len(raw_gifts)
        dates = [r["date"] for r in raw_gifts if r.get("date")]
        first_date = min(dates) if dates else ""
        latest_date = max(dates) if dates else ""

        platforms = sorted({g2["platform"] for g2 in gifts_out if g2["platform"]})
        campaigns = sorted({g2["campaign"] for g2 in gifts_out if g2["campaign"]})
        tributes_count = sum(1 for g2 in gifts_out if g2["isTribute"])

        contact = customers_by_name.get(key, {})
        address = contact.get("address") or ""
        email = contact.get("email") or ""
        phone = contact.get("phone") or ""

        is_aggregate = bool(BANK_AGGREGATE_RE.search(display_name))
        tier_id, tier_label, tier_color = tier_for(lifetime_total)

        entity_ids = g["entity_ids"]
        donor_id = f"cust-{next(iter(entity_ids))}" if len(entity_ids) == 1 else f"name-{slugify(display_name)}"

        donors.append({
            "id": donor_id,
            "name": display_name,
            "email": email,
            "phone": phone,
            "address": address,
            "lifetimeTotal": lifetime_total,
            "itemizedTotal": lifetime_total,
            "isAggregate": is_aggregate,
            "transactionsCount": tx_count,
            "firstGiftDate": first_date,
            "latestGiftDate": latest_date,
            "givingTier": tier_label,
            "tierId": tier_id,
            "tierColor": tier_color,
            "platformsList": platforms,
            "campaignsList": campaigns,
            "hasMailingAddress": bool(address),
            "tributesCount": tributes_count,
            "isRecurring": compute_is_recurring(dates),
            "gifts": gifts_out,
        })

    decisions = load_merge_decisions()
    donors, not_duplicate_keys = apply_merge_decisions(donors, decisions)
    merges_applied = sum(1 for d in decisions if d.get("decision") == "merge")

    donors.sort(key=lambda d: -d["lifetimeTotal"])

    possible_duplicates = find_possible_duplicates(donors, not_duplicate_keys)

    non_aggregate = [d for d in donors if not d["isAggregate"]]
    lapsed_2025 = [d for d in non_aggregate if d["latestGiftDate"].startswith("2025")]
    lapsed_long = [
        d for d in non_aggregate
        if d["latestGiftDate"] and not d["latestGiftDate"].startswith("2025") and not d["latestGiftDate"].startswith("2026")
    ]

    meta = {
        "total_lifetime_volume": round(sum(d["lifetimeTotal"] for d in donors), 2),
        "total_donors": len(donors),
        "total_with_address": sum(1 for d in donors if d["hasMailingAddress"]),
        "total_tributes_count": sum(d["tributesCount"] for d in donors),
        "major_donors_count": sum(1 for d in donors if d["lifetimeTotal"] >= 1000),
        "active_2026_count": sum(1 for d in donors if d["latestGiftDate"].startswith("2026")),
        "lapsed_2025_count": len(lapsed_2025),
        "lapsed_2025_value": round(sum(d["lifetimeTotal"] for d in lapsed_2025), 2),
        "lapsed_long_count": len(lapsed_long),
        "lapsed_long_value": round(sum(d["lifetimeTotal"] for d in lapsed_long), 2),
        "recurring_count": sum(1 for d in non_aggregate if d["isRecurring"]),
        "possible_duplicates": possible_duplicates,
        "years_covered": list(YEARS),
        "source": "QuickBooks Online (Deposit + SalesReceipt lines, named entities only)",
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "excluded_note": (
            "Excludes payment-processor batch totals (BetterUnite/PayPal/Square/WePay/"
            "Zeffy/Give Lively/American Online Giving) and named institutional revenue "
            "that is not a donation (county animal-control contract payments, Kroger "
            "Community Rewards, Fidelity Brokerage endowment transfers)."
        ),
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "donors": donors}, f, indent=2)

    print(f"Wrote {OUT}")
    print(f"  merge_decisions_loaded={len(decisions)} merges_applied={merges_applied} "
          f"not_duplicate_marked={len(not_duplicate_keys)}")
    print(f"  possible_duplicates_open={len(possible_duplicates)} "
          f"(tier1={sum(1 for c in possible_duplicates if c['tier']==1)}, "
          f"tier2={sum(1 for c in possible_duplicates if c['tier']==2)})")
    print(f"  lapsed_2025={meta['lapsed_2025_count']} (${meta['lapsed_2025_value']:,.2f}) "
          f"lapsed_long={meta['lapsed_long_count']} (${meta['lapsed_long_value']:,.2f}) "
          f"recurring={meta['recurring_count']}")
    print(f"  gifts_excluded_by_account={skipped_accounts}")
    print(f"  donors={len(donors)} lifetime_volume=${meta['total_lifetime_volume']:,.2f}")
    print(f"  with_address={meta['total_with_address']} major(>=1k)={meta['major_donors_count']} "
          f"active_2026={meta['active_2026_count']} tributes={meta['total_tributes_count']}")


if __name__ == "__main__":
    main()
