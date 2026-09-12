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
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_qbo_deposit_gifts import extract, YEARS  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "api", "data", "donor_database.json")

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


def normalize_key(name: str) -> str:
    return re.sub(r"\s+", " ", name or "").strip().upper()


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
        g["names"].append(name)
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
            "gifts": gifts_out,
        })

    donors.sort(key=lambda d: -d["lifetimeTotal"])

    meta = {
        "total_lifetime_volume": round(sum(d["lifetimeTotal"] for d in donors), 2),
        "total_donors": len(donors),
        "total_with_address": sum(1 for d in donors if d["hasMailingAddress"]),
        "total_tributes_count": sum(d["tributesCount"] for d in donors),
        "major_donors_count": sum(1 for d in donors if d["lifetimeTotal"] >= 1000),
        "active_2026_count": sum(1 for d in donors if d["latestGiftDate"].startswith("2026")),
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
    print(f"  gifts_excluded_by_account={skipped_accounts}")
    print(f"  donors={len(donors)} lifetime_volume=${meta['total_lifetime_volume']:,.2f}")
    print(f"  with_address={meta['total_with_address']} major(>=1k)={meta['major_donors_count']} "
          f"active_2026={meta['active_2026_count']} tributes={meta['total_tributes_count']}")


if __name__ == "__main__":
    main()
