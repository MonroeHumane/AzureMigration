#!/usr/bin/env python3
"""Record 9 real bank-confirmed transactions that were missing from QBO,
identified via user knowledge of the front-desk/donation-platform activity
and confirmed against the exact 100%/94% precedent every other transaction
of the same type already uses in this ledger:

- 1 Square adoption-fee deposit (100% precedent: every other Square deposit
  -- 181/181 -- posts to Animal Adoptions, class Program Services)
- 6 BetterUnite individual donations (94% precedent: 227/241 other
  BetterUnite deposits post to Contributed income: Donations directed by
  individuals, class Fundraising)
- 2 card-processor chargebacks reversing adoption fees, coded to Adoption
  Fee Refunds & Returns (account 35 other refunds already use) since no
  Bill/check was ever cut for these -- a first-of-kind entry, not backed by
  a 100% precedent the way the other two are.

Read-only verification happened separately; this script performs the writes.
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
SQUARE_VENDOR = {"value": "13", "name": "SQUARE"}
BETTERUNITE_VENDOR = {"value": "12", "name": "BETTER UNITE"}
ANIMAL_ADOPTIONS = "37"
DONATIONS_INDIVIDUALS = "54"
ADOPTION_FEE_REFUNDS = "1150040012"
CLASS_PROGRAM = "1356414"
CLASS_FUNDRAISING = "1356416"

DEPOSITS = [
    # (date, amount, account, class, vendor, memo)
    ("2025-02-21", 611.07, ANIMAL_ADOPTIONS, CLASS_PROGRAM, SQUARE_VENDOR,
     "Square adoption-fee deposit missing from QBO -- confirmed on bank statement "
     "(First_Merchant_Chkng_XXXXXX8478_02282025.pdf, 'Feb 21 SQUARE INC/SQUAR 0221 611.07'). "
     "Coded to match 181/181 other Square deposits (Animal Adoptions, Program Services)."),
    ("2025-01-30", 20.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Coded to match "
     "227/241 other BetterUnite deposits (Donations directed by individuals, Fundraising)."),
    ("2025-02-10", 20.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Same precedent as above."),
    ("2025-02-28", 100.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Same precedent as above."),
    ("2025-03-03", 100.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Same precedent as above."),
    ("2025-03-20", 10.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Same precedent as above."),
    ("2025-12-24", 50.00, DONATIONS_INDIVIDUALS, CLASS_FUNDRAISING, BETTERUNITE_VENDOR,
     "BetterUnite donation missing from QBO -- confirmed on bank statement. Same precedent as above."),
]

CHARGEBACKS = [
    ("2025-02-11", 50.00,
     "Card-processor chargeback reversing an adoption fee -- confirmed on bank statement "
     "(First_Merchant_Chkng_XXXXXX8478_02282025.pdf, 'Feb 11 CHARGE BACK 50.00'). No Bill/check "
     "was ever cut for this (unlike the 30+ staff-initiated adoption refunds), so it was never "
     "entered. Coded to Adoption Fee Refunds & Returns for reporting consistency with those refunds. "
     "Which specific adoption this reversed is unknown -- the bank statement carries no further detail."),
    ("2025-07-24", 100.00,
     "Card-processor chargeback reversing an adoption fee -- confirmed on bank statement. Same "
     "situation as the Feb 11 chargeback above: never entered, no Bill/check exists, coded to "
     "Adoption Fee Refunds & Returns. Which specific adoption this reversed is unknown."),
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

    for date, amount, account, cls, vendor, memo in DEPOSITS:
        payload = {
            "TxnDate": date,
            "DepositToAccountRef": {"value": CHECKING_ACCOUNT},
            "PrivateNote": memo,
            "Line": [{
                "Amount": amount,
                "DetailType": "DepositLineDetail",
                "DepositLineDetail": {
                    "AccountRef": {"value": account},
                    "ClassRef": {"value": cls},
                    "Entity": {"value": vendor["value"], "name": vendor["name"], "type": "VENDOR"},
                },
                "Description": f"{vendor['name']} -- see PrivateNote",
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}New Deposit: {date}  ${amount:,.2f}  -> account {account}  vendor={vendor['name']}")
        if dry_run:
            continue
        r = session.post(f"{base}/deposit", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400])
            continue
        d = r.json()["Deposit"]
        print(f"  CREATED Deposit id={d['Id']}")
        created.append(("Deposit", d["Id"], date, amount))

    for date, amount, memo in CHARGEBACKS:
        payload = {
            "TxnDate": date,
            "PaymentType": "Cash",
            "AccountRef": {"value": CHECKING_ACCOUNT},
            "PrivateNote": memo,
            "Line": [{
                "Amount": amount,
                "DetailType": "AccountBasedExpenseLineDetail",
                "AccountBasedExpenseLineDetail": {"AccountRef": {"value": ADOPTION_FEE_REFUNDS}},
                "Description": "Card-processor chargeback -- see PrivateNote",
            }],
        }
        print(f"{'[DRY RUN] ' if dry_run else ''}New Purchase (chargeback): {date}  ${amount:,.2f}  -> Adoption Fee Refunds & Returns")
        if dry_run:
            continue
        r = session.post(f"{base}/purchase", json=payload, timeout=30)
        if r.status_code != 200:
            print("  WRITE FAILED:", r.status_code, r.text[:400])
            continue
        p = r.json()["Purchase"]
        print(f"  CREATED Purchase id={p['Id']}")
        created.append(("Purchase", p["Id"], date, amount))

    if not dry_run:
        print(f"\n{len(created)} / {len(DEPOSITS) + len(CHARGEBACKS)} created successfully.")
        for row in created:
            print(" ", row)


if __name__ == "__main__":
    main()
