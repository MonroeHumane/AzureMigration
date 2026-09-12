#!/usr/bin/env python3
"""Reshape scripts/data/checking_monthly_balance.json (from
qbo_fetch_checking_monthly_balance.py) into the board portal's
api/data/checking_balance_2024_2026.json snapshot: one ending-balance
array per year plus a governance-style meta block, matching the pattern
in api/data/published_2026_ytd.json.

Run qbo_fetch_checking_monthly_balance.py first to refresh the source file.
"""
import hashlib
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "data", "checking_monthly_balance.json")
OUT = os.path.join(ROOT, "api", "data", "checking_balance_2024_2026.json")


def main():
    with open(SRC) as f:
        months = json.load(f)

    by_year = {}
    for m in months:
        by_year.setdefault(str(m["year"]), []).append(m)

    years = {}
    for year, rows in by_year.items():
        rows.sort(key=lambda r: r["month"])
        years[year] = [r["ending_balance"] for r in rows]

    last = months[-1]
    today = datetime.now(timezone.utc)
    is_partial = (last["year"], last["month"]) == (today.year, today.month)
    closed = months[:-1] if is_partial else months
    cutoff = closed[-1]["last_txn_date"] if closed else None

    payload = {
        "years": years,
        "meta": {
            "period_title": "First Merchants Bank Checking -- Month-End Balance History",
            "cutoff_date": cutoff,
            "latest_partial_date": last["last_txn_date"] if is_partial else None,
            "has_partial_cutoff": bool(is_partial),
            "source": "QuickBooks Online GeneralLedger report, First Merchants Bank checking (account 111)",
            "basis": "Accrual",
            "published_by": "Automated (qbo_publish_checking_balance_history.py)",
            "published_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        },
    }
    payload["meta"]["sha256_checksum"] = hashlib.sha256(
        json.dumps(years, sort_keys=True).encode("utf-8")
    ).hexdigest()

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        json.dump(payload, f, indent=2)

    print(f"Wrote {OUT}")
    for year, vals in years.items():
        print(f"  {year}: {len(vals)} months, last={vals[-1]}")


if __name__ == "__main__":
    main()
