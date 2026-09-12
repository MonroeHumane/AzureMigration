#!/usr/bin/env python3
"""Record the remaining reconciliation gaps identified via same-vendor/
same-type precedent already in the ledger (5 more Square deposits, 3
recurring-fee monthly gaps, 10 real 2024 credit-card charges). Every
category below is backed by 80-100% precedent from that exact vendor or
transaction type elsewhere in this ledger -- see qbo_full_audit_2024_2026.md
for the underlying vendor-history percentages.
"""
import os
import sqlite3
import sys

import requests
from dotenv import load_dotenv
from intuitlib.client import AuthClient

load_dotenv(r"C:\Users\Jeff\Documents\Monroeapp\qbonline\.env")
REDIRECT = "https://monroe-humane.org/callback"
TOKEN_MIRROR = r"E:\qbbackup\qbo_mirror.db"

CHECKING_ACCOUNT = "111"
CC_ACCOUNT = "141"
SQUARE_VENDOR = {"value": "13", "name": "SQUARE"}
ANIMAL_ADOPTIONS = "37"
CLASS_PROGRAM = "1356414"

SQUARE_DEPOSITS = [
    ("2024-03-14", 291.90),
    ("2025-03-03", 292.00),
    ("2025-03-03", 243.20),
    ("2025-03-07", 438.57),
    ("2025-04-02", 82.69),
]

FEE_GAPS = [
    # date, amount, account, memo
    ("2025-02-03", 10.00, "74", "BankCard monthly fee, missing from QBO -- recorded every other month "
     "Jan 2024-Dec 2025 to this account (Bank Fees & Service Charges); only Feb 2025 was missing."),
    ("2025-02-04", 30.00, "68", "AuthNet Gateway monthly billing, missing from QBO -- recorded every "
     "other month at this account (Merchant Account Fees); Feb and Mar 2025 were both missing."),
    ("2025-03-04", 30.00, "68", "AuthNet Gateway monthly billing, missing from QBO -- same gap as Feb 2025 above."),
]

CC_CHARGES = [
    # date, amount, vendor_id, vendor_name, account_id, account_name
    ("2024-06-01", 90.00, "30", "PIRATES COVE STORAGE", "1150040014", "Special Events & Gala Expenses",
     "16/16 (100%) of prior Pirates Cove charges post here."),
    ("2024-06-21", 1287.00, "534", "Humane Ohio", "1150040017", "Spay & Neuter Program",
     "32/32 (100%) of prior Humane Ohio charges post here."),
    ("2024-06-21", 49.45, "87", "BP", "91", "Gas",
     "Confirmed by Jeff: this is a BP gas station charge (Temperance, MI), not the unrelated "
     "Temperance Animal Hospital vendor of a similar name."),
    ("2024-06-21", 529.99, "1792", "Tractor Supply", "43", "General Shelter Supplies",
     "4/5 (80%) of prior Tractor Supply charges post here."),
    ("2024-06-22", 60.39, "1789", "PetSmart", "153", "Animal Care Supplies",
     "3/3 (100%) of prior PetSmart charges post here."),
    ("2024-06-25", 120.00, "14", "WIX", "72", "Software & Apps",
     "Confirmed by Jeff: Wix.com website subscription -- Office expenses:Software & Apps."),
    ("2024-06-27", 97.03, "475", "Amazon", "153", "Animal Care Supplies",
     "209/211 (99%) of prior Amazon charges post here."),
    ("2024-06-27", 96.08, "634", "Walmart", "153", "Animal Care Supplies",
     "33/33 (100%) of prior Walmart Supercenter charges post here."),
    ("2024-06-27", 34.97, "1789", "PetSmart", "153", "Animal Care Supplies",
     "3/3 (100%) of prior PetSmart charges post here."),
    ("2024-06-28", 10.59, "475", "Amazon", "153", "Animal Care Supplies",
     "209/211 (99%) of prior Amazon charges post here."),
]


def get_access_token():
    conn = sqlite3.connect(TOKEN_MIRROR)
    row = conn.execute(
        "SELECT access_token, refresh_token, realm_id FROM oauth_tokens ORDER BY updated_at DESC LIMIT 1"
    ).fetchone()
    access, refresh, realm = row
    client = AuthClient(
        client_id=os.environ["QB_CLIENT_ID"], client_secret=os.environ["QB_CLIENT_SECRET"],
        environment="production", redirect_uri=REDIRECT,
    )
    client.refresh(refresh_token=refresh)
    access, refresh = client.access_token, client.refresh_token
    conn.execute(
        "UPDATE oauth_tokens SET refresh_token=?, access_token=?, updated_at=datetime('now') WHERE realm_id=?",
        (refresh, access, realm),
    )
    conn.commit()
    conn.close()
    return access, realm


def main():
    dry_run = "--live" not in sys.argv
    access, realm = get_access_token()
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {access}", "Accept": "application/json", "Content-Type": "application/json",
    })
    base = f"https://quickbooks.api.intuit.com/v3/company/{realm}"
    created = []

    for date, amount in SQUARE_DEPOSITS:
        payload = {
            "TxnDate": date,
            "DepositToAccountRef": {"value": CHECKING_ACCOUNT},
            "PrivateNote": f"Square adoption-fee deposit missing from QBO -- confirmed on bank statement. "
                           f"Coded to match 181/181 other Square deposits (Animal Adoptions, Program Services).",
            "Line": [{
                "Amount": amount,
                "DetailType": "DepositLineDetail",
                "DepositLineDetail": {
                    "AccountRef": {"value": ANIMAL_ADOPTIONS},
                    "ClassRef": {"value": CLASS_PROGRAM},
                    "Entity": {"value": SQUARE_VENDOR["value"], "name": SQUARE_VENDOR["name"], "type": "VENDOR"},
                },
                "Description": "Square Inc -- see PrivateNote",
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}New Deposit: {date}  ${amount:,.2f}  -> Animal Adoptions")
        if dry_run:
            continue
        r = session.post(f"{base}/deposit", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400]); continue
        d = r.json()["Deposit"]
        print(f"  CREATED Deposit id={d['Id']}")
        created.append(("Deposit", d["Id"], date, amount))

    for date, amount, account, memo in FEE_GAPS:
        payload = {
            "TxnDate": date, "PaymentType": "Cash",
            "AccountRef": {"value": CHECKING_ACCOUNT},
            "PrivateNote": memo,
            "Line": [{
                "Amount": amount, "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {"AccountRef": {"value": account}},
                "Description": memo,
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}New Purchase (fee gap): {date}  ${amount:,.2f}  -> account {account}")
        if dry_run:
            continue
        r = session.post(f"{base}/purchase", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400]); continue
        p = r.json()["Purchase"]
        print(f"  CREATED Purchase id={p['Id']}")
        created.append(("Purchase", p["Id"], date, amount))

    for date, amount, vid, vname, aid, aname, memo in CC_CHARGES:
        payload = {
            "TxnDate": date, "PaymentType": "CreditCard",
            "AccountRef": {"value": CC_ACCOUNT},
            "EntityRef": {"value": vid, "type": "Vendor"},
            "PrivateNote": f"Real card charge confirmed missing from QBO (2024 CC statement). {memo}",
            "Line": [{
                "Amount": amount, "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {"AccountRef": {"value": aid}},
                "Description": f"{vname} -- see PrivateNote",
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}New Purchase (CC): {date}  ${amount:,.2f}  {vname} -> {aname}")
        if dry_run:
            continue
        r = session.post(f"{base}/purchase", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400]); continue
        p = r.json()["Purchase"]
        print(f"  CREATED Purchase id={p['Id']}")
        created.append(("Purchase", p["Id"], date, amount))

    if not dry_run:
        total = len(SQUARE_DEPOSITS) + len(FEE_GAPS) + len(CC_CHARGES)
        print(f"\n{len(created)} / {total} created successfully.")
        for row in created:
            print(" ", row)


if __name__ == "__main__":
    main()
