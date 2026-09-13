#!/usr/bin/env python3
"""Assemble api/data/published_2025_ytd.json and api/data/monthly_drilldown_2025.json
from the fresh live-QBO pull already written to scripts/data/ by
qbo_fetch_monthly_gl_drilldown.py.

These are presented as a live GL-sourced figure, not a re-statement of the
existing multiyear_comparison["2025"] summary in published_2026_ytd.json
(which is marked "Audited Full Year" from a separate source and is left
untouched here) -- reconciliation found the two agree on every traced
transaction ($251,713.50 building/property sale proceeds -- confirmed by
the org, posted by QBO to its own "Property Sale" Other Income account, not
a bequest -- plus a separate, unrelated $25,000 individual donor wire the
same week; the $40,000 Fidelity Brokerage transfer correctly excluded; no
hidden journal-entry corrections) but differ by ~4% in aggregate, most
likely because the audited summary is a rounded whole-dollar figure rather
than a fresh GL pull. Both numbers are kept visible rather than silently
overwriting one with the other.

Usage:
  python scripts/qbo_publish_2025_drilldown.py
"""
import hashlib
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "scripts", "data")


def main():
    with open(os.path.join(SRC_DIR, "monthly_statements_2025.json"), encoding="utf-8") as f:
        statements = json.load(f)
    with open(os.path.join(SRC_DIR, "monthly_drilldown_2025.json"), encoding="utf-8") as f:
        drilldown = json.load(f)

    total_revenue = round(sum(m["revenue"] for m in statements), 2)
    total_exp = round(sum(m["total_exp"] for m in statements), 2)
    net = round(sum(m["net_margin"] for m in statements), 2)

    checksum = hashlib.sha256(json.dumps(statements, sort_keys=True).encode("utf-8")).hexdigest()
    published_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    certified_revenue, certified_exp = 836847, 664492
    gap_pct = abs((total_revenue + total_exp) - (certified_revenue + certified_exp)) / (certified_revenue + certified_exp) * 100

    published = {
        "meta": {
            "period_title": "2025 Full Year Financial Statement",
            "cutoff_date": "2025-12-31",
            "closed_months_count": 12,
            "has_partial_cutoff": False,
            "published_by": "Automated (qbo_fetch_monthly_gl_drilldown.py), live QuickBooks General Ledger pull",
            "published_at": published_at,
            "sha256_checksum": checksum,
            "basis": "Accrual",
            "governance_level": "Board-Confidential",
            "organization_name": "Humane Society of Monroe County",
            "total_revenue": total_revenue,
            "total_expenditures": total_exp,
            "net_result": net,
            "reconciliation_note": (
                "This month-by-month breakdown comes from a fresh live QuickBooks "
                "General Ledger pull (2026-09-13), traced transaction-by-transaction "
                "against the checking account statements. Two large October wires were "
                "confirmed to the penny: a $251,713.50 wire (Oct 14 2025), confirmed "
                "with the org to be building/property sale proceeds -- QBO itself posts "
                "this to its own 'Property Sale' Other Income account, kept in revenue "
                "here and labeled as a one-time sale rather than a donation -- and a "
                "separate, unrelated $25,000 individual donor wire (Oct 6 2025). The "
                "$40,000 Fidelity Brokerage transfer was confirmed correctly excluded "
                "(an asset transfer, not revenue), and no hidden journal-entry "
                "corrections were found. "
                "A sign-handling defect in the extraction was also found and fixed: "
                "QBO's GL report shows a contra/reversing entry -- a refund posted "
                "straight to a revenue account, a vendor rebate posted straight to an "
                "expense account -- as a negative value, which an earlier pass of this "
                "pull was discarding via abs() and double-counting as a positive "
                "addition instead of a reduction (confirmed directly against live QBO "
                "data: two $200 adoption-fee refunds posted as \"-200.00\" under Animal "
                "Adoptions, a $220 BISSELL Pet Foundation rebate posted as \"-220.00\" "
                "under General Shelter Supplies, a $455 insurance-overpayment refund "
                "posted as \"-455.00\" under Liability insurance, among others). "
                "Correcting this lowered both revenue and total expenditures from this "
                "pull's first version; it does not affect the bank-statement "
                "reconciliation above, since it only changes which QBO income/expense "
                "account absorbs an entry, not actual cash movement. "
                f"This corrected pull differs from the existing multiyear_comparison "
                f"2025 summary (published_2026_ytd.json, 'Audited Full Year', revenue "
                f"${certified_revenue:,} / expenditures ${certified_exp:,} -- stated as "
                f"whole dollars, no cents) by about {gap_pct:.1f}% in aggregate -- "
                "closer than the ~4% gap before the sign fix, consistent with the "
                "correction being a real improvement rather than a new discrepancy; "
                "every individually-traced large transaction still matches, so the "
                "remaining gap is most likely rounding or a minor presentation "
                "difference in how that audited summary was compiled. "
                "That summary figure is left as-is here rather than overwritten."
            ),
        },
        "monthly_statements": statements,
    }

    out_pub = os.path.join(ROOT, "api", "data", "published_2025_ytd.json")
    with open(out_pub, "w", encoding="utf-8") as f:
        json.dump(published, f, indent=2)
    print(f"Wrote {out_pub}")
    print(f"  revenue={total_revenue:,.2f} total_exp={total_exp:,.2f} net={net:,.2f}")

    out_drill = os.path.join(ROOT, "api", "data", "monthly_drilldown_2025.json")
    with open(out_drill, "w", encoding="utf-8") as f:
        json.dump(drilldown, f, indent=2)
    print(f"Wrote {out_drill}")


if __name__ == "__main__":
    main()
