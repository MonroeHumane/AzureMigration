#!/usr/bin/env python3
"""Parse every First Merchants/Elan credit-card statement PDF into individual
transaction lines. Replaces the old cc_statement_transactions.csv, which only
captured the first page of each multi-page statement (confirmed: it captured
5 of 32 transactions on the 2026-08-06 statement).

Read-only: only reads local PDF files, writes to the local audit sqlite db.
"""
from __future__ import annotations

import glob
import os
import re
import sqlite3

import pdfplumber

CC_DIR = r"C:\Users\Jeff\Documents\Monroeapp\creditstatements"
DB = os.path.join(os.path.dirname(__file__), "data", "qbo_audit_2024_2026.db")

TXN_RE = re.compile(
    r"^(\d{2}/\d{2})\s+(\d{2}/\d{2})\s+(\S+)\s+(.+?)\s+\$?(-?[\d,]+\.\d{2})(CR)?$"
)
SUMMARY_RE = {
    "previous_balance": re.compile(r"Previous Balance\s*\+?\s*\$?([\d,]+\.\d{2})"),
    "payments": re.compile(r"Payments\s*-\s*\$?([\d,]+\.\d{2})CR"),
    "other_credits": re.compile(r"Other Credits\s*-\s*\$?([\d,]+\.\d{2})CR"),
    "purchases": re.compile(r"Purchases\s*\+\s*\$?([\d,]+\.\d{2})"),
    "new_balance": re.compile(r"New Balance\s*\$?([\d,]+\.\d{2})"),
}
CLOSING_DATE_RE = re.compile(r"Closing Date:?\s*(\d{2}/\d{2}/\d{4})")
OPEN_DATE_RE = re.compile(r"Open Date:?\s*(\d{2}/\d{2}/\d{4})")


def to_float(s):
    return float(s.replace(",", ""))


def infer_year(mmdd, closing_date):
    month, day = mmdd.split("/")
    close_month, close_day, close_year = closing_date.split("/")[0], closing_date.split("/")[1], closing_date.split("/")[2]
    year = int(close_year)
    if int(month) > int(close_month) + 1:
        year -= 1
    return f"{year:04d}-{month}-{day}"


FILENAME_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def parse_statement(path):
    with pdfplumber.open(path) as pdf:
        full_text = "\n".join((p.extract_text() or "") for p in pdf.pages)

    m = CLOSING_DATE_RE.search(full_text)
    closing_date = m.group(1) if m else None
    if not closing_date:
        # Filenames follow "YYYY-MM-DD Statement - Card...6035.pdf" where the
        # leading date is the statement closing date -- far more reliable
        # than regexing the PDF text, whose "Closing Date" phrasing varies
        # across statement-template eras.
        fm = FILENAME_DATE_RE.match(os.path.basename(path))
        if fm:
            y, mo, d = fm.groups()
            closing_date = f"{mo}/{d}/{y}"
    summary = {}
    for key, rx in SUMMARY_RE.items():
        m = rx.search(full_text)
        if m:
            summary[key] = to_float(m.group(1))

    lines = []
    for raw_line in full_text.split("\n"):
        line = raw_line.strip()
        m = TXN_RE.match(line)
        if not m:
            continue
        post_date, trans_date, ref, desc, amount, cr = m.groups()
        if ref.upper() in ("DATE",) or desc.upper().startswith("TRANSACTION DESCRIPTION"):
            continue
        amt = to_float(amount)
        is_credit = bool(cr)
        signed = -amt if is_credit else amt
        txn_date = infer_year(trans_date, closing_date) if closing_date else None
        post_date_full = infer_year(post_date, closing_date) if closing_date else None
        lines.append((post_date_full, txn_date, ref, desc, signed, is_credit))

    return closing_date, summary, lines


SCHEMA = """
CREATE TABLE IF NOT EXISTS cc_statement_lines (
    statement_file TEXT, closing_date TEXT, post_date TEXT, txn_date TEXT,
    ref TEXT, description TEXT, amount REAL, is_credit INTEGER
);
CREATE TABLE IF NOT EXISTS cc_statement_summary (
    statement_file TEXT PRIMARY KEY, closing_date TEXT,
    previous_balance REAL, payments REAL, other_credits REAL, purchases REAL,
    new_balance REAL, parsed_line_count INTEGER, parsed_debit_sum REAL, parsed_credit_sum REAL
);
"""


def main():
    conn = sqlite3.connect(DB)
    conn.execute("DROP TABLE IF EXISTS cc_statement_lines")
    conn.execute("DROP TABLE IF EXISTS cc_statement_summary")
    conn.executescript(SCHEMA)
    conn.commit()

    files = sorted(glob.glob(os.path.join(CC_DIR, "*.pdf")))
    print(f"Found {len(files)} CC statement PDFs")

    cur = conn.cursor()
    total_lines = 0
    for path in files:
        fname = os.path.basename(path)
        closing_date, summary, lines = parse_statement(path)
        for post_date, txn_date, ref, desc, signed, is_credit in lines:
            cur.execute(
                "INSERT INTO cc_statement_lines VALUES (?,?,?,?,?,?,?,?)",
                (fname, closing_date, post_date, txn_date, ref, desc, signed, int(is_credit)),
            )
        debit_sum = round(sum(l[4] for l in lines if not l[5]), 2)
        credit_sum = round(sum(-l[4] for l in lines if l[5]), 2)
        cur.execute(
            """INSERT OR REPLACE INTO cc_statement_summary VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                fname, closing_date, summary.get("previous_balance"), summary.get("payments"),
                summary.get("other_credits"), summary.get("purchases"), summary.get("new_balance"),
                len(lines), debit_sum, credit_sum,
            ),
        )
        conn.commit()
        total_lines += len(lines)

        purchases_expected = summary.get("purchases")
        payments_expected = summary.get("payments")
        other_credits_expected = summary.get("other_credits")
        flag = ""
        if purchases_expected is not None and abs(debit_sum - purchases_expected) > 0.02:
            flag += f" MISMATCH purchases: parsed {debit_sum} vs stated {purchases_expected}"
        credit_expected_total = (payments_expected or 0) + (other_credits_expected or 0)
        if credit_expected_total and abs(credit_sum - credit_expected_total) > 0.02:
            flag += f" MISMATCH credits: parsed {credit_sum} vs stated {credit_expected_total}"
        print(f"{fname}: {len(lines)} lines, debit_sum={debit_sum}, credit_sum={credit_sum}{flag}")

    print(f"\nTotal lines parsed: {total_lines}")
    n_mismatch = 0
    for row in conn.execute(
        "SELECT statement_file, purchases, parsed_debit_sum, payments, other_credits, parsed_credit_sum FROM cc_statement_summary"
    ):
        fname, purchases, debit_sum, payments, other_credits, credit_sum = row
        if purchases is not None and abs((debit_sum or 0) - purchases) > 0.02:
            n_mismatch += 1
        credit_expected = (payments or 0) + (other_credits or 0)
        if credit_expected and abs((credit_sum or 0) - credit_expected) > 0.02:
            n_mismatch += 1
    print(f"Statements with a validation mismatch: {n_mismatch} / {len(files)}")
    conn.close()


if __name__ == "__main__":
    main()
