#!/usr/bin/env python3
"""Restate the certified 2026 YTD packet so operating vs other matches live QBO recodes.

All-in monthly revenue, spend, and net do not change. County contract cash moves
from endowment (other) onto Government grants (operating). Kroger Community Rewards
moves from Corporate onto Retail Partner Rebates. Thrivent Choice moves onto
Foundation Grants. Checksums are rewritten; both frontend and api copies are saved.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONT = os.path.join(ROOT, "frontend", "src", "data", "published_2026_ytd.json")
API = os.path.join(ROOT, "api", "data", "published_2026_ytd.json")


def money(n: float) -> float:
    return round(float(n) + 1e-9, 2)


def item(items, name):
    for it in items:
        if it.get("name") == name:
            return it
    return None


def add_or_bump(items, name, group, amount):
    amount = money(amount)
    if abs(amount) < 0.005:
        return
    it = item(items, name)
    if it:
        it["amount"] = money(it["amount"] + amount)
        if abs(it["amount"]) < 0.005:
            items.remove(it)
        return
    items.append({"name": name, "group": group, "amount": amount})


def take(items, name, amount):
    amount = money(amount)
    it = item(items, name)
    if not it:
        raise SystemExit(f"Missing source item {name} while taking {amount}")
    if money(it["amount"]) + 0.001 < amount:
        raise SystemExit(f"{name} has {it['amount']}, cannot take {amount}")
    it["amount"] = money(it["amount"] - amount)
    if abs(it["amount"]) < 0.005:
        items.remove(it)


def sort_items(items):
    items.sort(key=lambda it: (-float(it["amount"]), it["name"]))


def month(data, month_id):
    for m in data["monthly_statements"]:
        if m["id"] == month_id:
            return m
    raise SystemExit(f"Missing month {month_id}")


def assert_month_foots(m):
    rev = money(sum(it["amount"] for it in m.get("rev_items") or []))
    if abs(rev - money(m["revenue"])) > 0.02:
        raise SystemExit(f"{m['month']} rev_items {rev} != revenue {m['revenue']}")


def compute_checksum(data: dict) -> str:
    data_copy = json.loads(json.dumps(data))
    if "meta" in data_copy and "sha256_checksum" in data_copy["meta"]:
        del data_copy["meta"]["sha256_checksum"]
    serialized = json.dumps(data_copy, sort_keys=True, indent=2)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def restatement_hash(data: dict) -> str:
    payload = {
        "headline_kpis": data.get("headline_kpis"),
        "bridge_composition": data.get("bridge_composition"),
        "monthly_statements": data.get("monthly_statements"),
    }
    serialized = json.dumps(payload, sort_keys=True, indent=2)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def apply_restatement(data):
    jan = month(data, "month_2026_0")
    mar = month(data, "month_2026_2")
    apr = month(data, "month_2026_3")
    may = month(data, "month_2026_4")
    jun = month(data, "month_2026_5")
    jul = month(data, "month_2026_6")
    aug = month(data, "month_2026_7")

    take(jan["rev_items"], "Quarterly Endowment Distributions", 12555.48)
    add_or_bump(jan["rev_items"], "Government grants & contracts", "Contributed income", 12555.48)
    take(may["rev_items"], "Quarterly Endowment Distributions", 7429.10)
    add_or_bump(may["rev_items"], "Government grants & contracts", "Contributed income", 7429.10)
    take(aug["rev_items"], "Quarterly Endowment Distributions", 8479.38)
    add_or_bump(aug["rev_items"], "Government grants & contracts", "Contributed income", 8479.38)

    take(mar["rev_items"], "Corporate Donations", 901.99)
    add_or_bump(mar["rev_items"], "Retail Partner Rebates", "Other Revenue", 901.99)
    take(jun["rev_items"], "Corporate Donations", 878.71)
    add_or_bump(jun["rev_items"], "Retail Partner Rebates", "Other Revenue", 878.71)

    take(jan["rev_items"], "Individual Donor Contributions", 750.28)
    add_or_bump(jan["rev_items"], "Foundation Grants", "Contributed income", 750.28)
    take(apr["rev_items"], "Government grants & contracts", 3245.0)
    add_or_bump(apr["rev_items"], "Foundation Grants", "Contributed income", 3245.0)
    take(may["rev_items"], "Government grants & contracts", 122.0)
    add_or_bump(may["rev_items"], "Foundation Grants", "Contributed income", 122.0)
    take(jun["rev_items"], "Government grants & contracts", 177.0)
    add_or_bump(jun["rev_items"], "Foundation Grants", "Contributed income", 177.0)
    take(jul["rev_items"], "Individual Donor Contributions", 50.0)
    add_or_bump(jul["rev_items"], "Foundation Grants", "Contributed income", 50.0)

    jun["driver"] = "Summer adoption peak & community giving"

    for m in (jan, mar, apr, may, jun, jul, aug):
        sort_items(m["rev_items"])
        assert_month_foots(m)

    county = 28463.96
    kroger = 1780.70
    kpis = data["headline_kpis"]
    kpis["qbo_operating_revenue"] = money(kpis["qbo_operating_revenue"] + county - kroger)
    kpis["qbo_operating_net"] = money(kpis["qbo_operating_net"] + county - kroger)
    kpis["non_operating_bridge"] = money(kpis["non_operating_bridge"] - county + kroger)

    bridge = data["bridge_composition"]
    bridge["endowment_distributions"] = 0.0
    bridge["recycling_detail"]["retail_partner_rebates"] = money(
        bridge["recycling_detail"]["retail_partner_rebates"] + kroger
    )
    bridge["recycling_and_rebates"] = money(
        bridge["recycling_detail"]["bottle_and_can_recycling"]
        + bridge["recycling_detail"]["retail_partner_rebates"]
        + bridge["recycling_detail"]["court_restitution"]
    )
    bridge["net_bridge_total"] = money(
        bridge["endowment_distributions"] + bridge["recycling_and_rebates"] + bridge["fleet_transit_and_fuel"]
    )
    bridge["c2_commentary"] = (
        "County animal-control pay is already in shelter operations. "
        "This card is only recycling, rebates, and the van."
    )
    bridge["restatement_note"] = (
        "2026-09-09 restatement to live QBO recodes: county off endowment, Kroger off Corporate, "
        "Thrivent Choice onto Foundation Grants. Deposit 5100 keeps both $375.14 Thrivent lines."
    )
    data["kpi_dictionary"]["Operating Net vs All-In Net"] = (
        f"Operating Net (${kpis['qbo_operating_net']:,.2f}) is shelter operations after moving the county "
        f"contract into Government grants. All-In Net (${kpis['all_in_net']:,.2f}) still adds recycling/rebate "
        "support and subtracts fleet fuel. No Community Foundation endowment draw remains in this YTD window."
    )
    data["meta"]["restated_at"] = "2026-09-09T20:00:00Z"
    data["meta"]["restatement_note"] = bridge["restatement_note"]


MONTH_WHY = {
    "month_2026_0": "Insurance renewals and winter utilities",
    "month_2026_1": "Strong adoptions and clinic fees",
    "month_2026_2": "Spring vet bills before the gala",
    "month_2026_3": "Spring gala proceeds",
    "month_2026_4": "Quieter giving and kitten intake",
    "month_2026_5": "Peak adoptions and community gifts",
    "month_2026_6": "Three paydays and high vet bills",
    "month_2026_7": "Late-summer vet bills and van costs",
}


def set_month_why(data: dict) -> None:
    for month in data.get("monthly_statements") or []:
        why = MONTH_WHY.get(month.get("id"))
        if why:
            month["driver"] = why
            month["status"] = ""


def main():
    with open(FRONT, encoding="utf-8") as f:
        data = json.load(f)

    already = abs(float((data.get("bridge_composition") or {}).get("endowment_distributions") or 0)) < 0.005 and (
        data.get("meta") or {}
    ).get("restated_at")
    if already:
        print("Already restated; refreshing checksums only.")
    else:
        apply_restatement(data)

    set_month_why(data)

    kpis = data["headline_kpis"]
    bridge = data["bridge_composition"]
    if abs(money(kpis["qbo_operating_net"] + bridge["net_bridge_total"]) - money(kpis["all_in_net"])) > 0.02:
        raise SystemExit(
            f"Bridge broken: {kpis['qbo_operating_net']} + {bridge['net_bridge_total']} != {kpis['all_in_net']}"
        )
    if abs(bridge["net_bridge_total"] - kpis["non_operating_bridge"]) > 0.02:
        raise SystemExit("Bridge total != headline non_operating_bridge")

    data["meta"]["extended_payload_sha256"] = restatement_hash(data)
    data["meta"]["sha256_checksum"] = compute_checksum(data)

    with open(FRONT, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    shutil.copyfile(FRONT, API)
    print(f"Wrote {FRONT}")
    print(f"Copied {API}")
    print(f"operating_revenue {kpis['qbo_operating_revenue']}")
    print(f"operating_net {kpis['qbo_operating_net']}")
    print(f"bridge {bridge['net_bridge_total']}")
    print(f"endowment {bridge['endowment_distributions']}")
    print(f"rebates {bridge['recycling_detail']['retail_partner_rebates']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
