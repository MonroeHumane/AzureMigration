#!/usr/bin/env python3
import hashlib
import json
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "scripts", "data")

def main():
    with open(os.path.join(SRC_DIR, "monthly_statements_2026.json"), encoding="utf-8") as f:
        statements = json.load(f)
    with open(os.path.join(SRC_DIR, "monthly_drilldown_2026.json"), encoding="utf-8") as f:
        drilldown = json.load(f)

    # Note: For 2026, this is YTD through September
    statements = [m for m in statements if m["total_exp"] != 0.0 or m["revenue"] != 0.0]

    total_revenue = round(sum(m["revenue"] for m in statements), 2)
    total_exp = round(sum(m["total_exp"] for m in statements), 2)
    net = round(sum(m["net_margin"] for m in statements), 2)

    checksum = hashlib.sha256(json.dumps(statements, sort_keys=True).encode("utf-8")).hexdigest()
    published_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Load existing published_2026_ytd.json to preserve multiyear_comparison if it exists
    out_pub = os.path.join(ROOT, "api", "data", "published_2026_ytd.json")
    existing_pub = {}
    if os.path.exists(out_pub):
        with open(out_pub, encoding="utf-8") as f:
            existing_pub = json.load(f)

    published = {
        "meta": {
            "period_title": "2026 Year-to-Date Financial Statement",
            "cutoff_date": "2026-09-30",
            "closed_months_count": len(statements),
            "has_partial_cutoff": True,
            "published_by": "Automated (qbo_fetch_monthly_gl_drilldown.py), live QuickBooks General Ledger pull",
            "published_at": published_at,
            "sha256_checksum": checksum,
            "basis": "Accrual",
            "governance_level": "Board-Confidential",
            "organization_name": "Humane Society of Monroe County",
            "total_revenue": total_revenue,
            "total_expenditures": total_exp,
            "net_result": net,
            "reconciliation_note": "Extracted with corrected sign handling and payee matching logic.",
        },
        "monthly_statements": statements,
    }
    
    if "multiyear_comparison" in existing_pub:
        published["multiyear_comparison"] = existing_pub["multiyear_comparison"]
    if "donor_metrics" in existing_pub:
        published["donor_metrics"] = existing_pub["donor_metrics"]

    with open(out_pub, "w", encoding="utf-8") as f:
        json.dump(published, f, indent=2)
    print(f"Wrote {out_pub}")
    print(f"  revenue={total_revenue:,.2f} total_exp={total_exp:,.2f} net={net:,.2f}")

    out_drill = os.path.join(ROOT, "api", "data", "monthly_drilldown_2026.json")
    with open(out_drill, "w", encoding="utf-8") as f:
        json.dump(drilldown, f, indent=2)
    print(f"Wrote {out_drill}")

if __name__ == "__main__":
    main()
