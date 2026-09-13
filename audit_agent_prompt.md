# 🐾 HSMC QBO Financial Reconciliation & Audit Agent Prompt
## Self-Contained Briefing, Methodology & Operational Handoff

> **Target Audience:** Autonomous Coding Agent / Financial Audit Session  
> **Workspace:** `c:\Users\Jeff\Documents\AzureMigration`  
> **Scope:** QuickBooks Online (QBO) General Ledger Ingest, Monthly Statements, Category Drilldown, Payee Matching, and Board Explorer Integration for 2024, 2025, and 2026.

---

## 1. System Context & What Exists

The Humane Society of Monroe County (HSMC) cloud platform presents certified board financials and monthly drilldown statements through the Astro frontend (`/internal/board`) backed by Azure Static Web Apps Functions (`/api/financials`).

Financial presentation is grounded on **QuickBooks Online (QBO)** general ledger data, verified line-by-line against actual First Merchants Bank checking account statements (`First_Merchant_Chkng_XXXXXX8478_*.pdf`).

### 1.1 Ground-Truth Reference: Why 2026 is the Anchor
* **2026 Data Files:** [`api/data/published_2026_ytd.json`](file:///c:/Users/Jeff/Documents/AzureMigration/api/data/published_2026_ytd.json) and [`api/data/monthly_drilldown_2026.json`](file:///c:/Users/Jeff/Documents/AzureMigration/api/data/monthly_drilldown_2026.json).
* **0% "Unknown" Baseline:** 2026 has zero "Unknown" payees across all revenue and expense categories. It establishes the organizational display conventions (e.g., categorizing fee-for-service cash/check deposits as `"Branch Deposit Batch"`, card batches as `"Square Inc"`, and donor checks under clean individual names).
* **Display Hierarchy:** The 2026 drilldown establishes how raw QBO leaf accounts map into board-facing groups (e.g., leaf `"Staff wages"` displays under group `"Staff"`, not the chart-of-accounts root `"Personnel & Staffing"`).

### 1.2 Core Scripts Built This Session
1. **[`scripts/qbo_fetch_monthly_gl_drilldown.py`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/qbo_fetch_monthly_gl_drilldown.py):**
   * Connects via Intuit OAuth / mirror to extract QBO `GeneralLedger` reports month-by-month.
   * Walks leaf accounts, skips non-activity balances, and extracts transaction-level items.
   * Enriches blank GL name fields from Deposit and SalesReceipt line entities using `(txn_date, round(abs(amount), 2))` matching against the live SQLite mirror.
   * Excludes year-end adjusting journal entries (`vals[1] == 'Journal Entry'`), which are bookkeeping adjustments rather than real donor/vendor cashflows.
   * **Crucial Sign Handling:** Preserves signed numbers (`amount = float(...)`), avoiding silent `abs()` conversions of contra/reversing entries.
   * Applies `MANUAL_NAME_OVERRIDES` and `KNOWN_MEMO_LABELS` to map legacy accounts to canonical 2026 display names.

2. **[`scripts/qbo_match_payees.py`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/qbo_match_payees.py):**
   * Resolves residual `"Unknown"` payees in `monthly_drilldown_{year}.json` without guessing.
   * Runs four sequential, prioritized matching tiers:
     1. `category_convention`: Organization's established convention from 2026 (e.g., `Bottle & Can Recycling Revenue` -> `"Branch Deposit Batch"`, Square batches -> `"Square Inc"`).
     2. `known_memo_substring`: Exact string matches inside noisy processor memos (e.g., `"PROVEN WINNERS"`, `"BISSELL PET"`).
     3. `description_pattern`: Validates that memo text conforms to a real human donor name (`looks_like_named_donor()`), reusing rules from `extract_qbo_deposit_gifts.py`.
     4. `donor_database_lookup`: `(date, amount)` cross-check against [`api/data/donor_database.json`](file:///c:/Users/Jeff/Documents/AzureMigration/api/data/donor_database.json).
   * Logs every match, method, confidence, and timestamp into `payee_matching.db`.
   * Enforces dollar-balance invariance: asserts `abs(total_before - total_after) < 0.01`.

3. **[`scripts/qbo_publish_2025_drilldown.py`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/qbo_publish_2025_drilldown.py):**
   * Bundles the verified 2025 GL pull into [`scripts/data/monthly_statements_2025.json`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/data/monthly_statements_2025.json) and publishes to `api/data/`.
   * Formulates full reconciliation metadata, documenting large single-event items (October 2025 $251,713.50 property sale wire, $25,000 individual wire, $40,000 Fidelity asset transfer exclusion) and explaining the ~4% gap to the certified summary.

4. **[`scripts/extract_qbo_deposit_gifts.py`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/extract_qbo_deposit_gifts.py) & [`scripts/qbo_build_donor_database.py`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/qbo_build_donor_database.py):**
   * Ingests deposit and sales receipt lines into the private donor registry, applying household/joint deduplication and tracking donor retention metrics.

### 1.3 Databases
1. **[`scripts/data/qbo_audit_2024_2026.db`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/data/qbo_audit_2024_2026.db):**
   * Primary audit database containing 151 accounts, 377 vendors, 2,791 customers, 4,138 transactions, 5,411 transaction lines, 3,264 bank statement lines, and 4,132 verified reconciliation matches.
   * Tables include `transactions`, `transaction_lines`, `bank_statement_lines`, `reconciliation_matches`, `pending_fixes`, and `board_cash_ledger`.
2. **[`scripts/data/payee_matching.db`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/data/payee_matching.db):**
   * Audit trail for payee resolution.
   * `gl_transactions` (1,193 rows) and `payee_matches` (373 rows) recording exact method, confidence, and evidence for every resolved payee.
3. **Live Mirror (`E:\qbbackup\qbo_mirror.db` / `TOKEN_MIRROR`):**
   * Local replica of raw QBO entities (`qbo_record`, `qbo_line`) used for fast offline querying.

---

## 2. Core Methodology & Verification Discipline

When continuing this audit work, adhere strictly to these engineering principles:

### 2.1 Verify Live, Never Guess
* **No Speculative Guessing:** If a transaction is unlabelled or ambiguous, never invent a donor or vendor name based on intuition.
* **Precedent Matching:** Verify whether the exact same category, description, or memo exists in 2026 or elsewhere in the QBO chart of accounts. If 2026 labels cash adoption deposits `"Branch Deposit Batch"`, 2024/2025 must follow that precedent.
* **Audit Trail Mandate:** Every enrichment step must log its rationale, matched identifier, and confidence tier to SQLite (`payee_matching.db` or `qbo_audit_2024_2026.db`).

### 2.2 Mathematical Invariants & Zero-Loss Guarantees
* Total revenue and total expenses per month and category must be identical before and after any matching pass (`assert abs(total_before - total_after) < 0.01`).
* Category re-grouping may move transactions between payees within a category, but must never drop transactions or alter line amounts.

### 2.3 Worked Example: The Contra/Reversing Entry Sign Bug
* **The Bug:** An earlier version of `qbo_fetch_monthly_gl_drilldown.py` used `abs(float(vals[6]))`.
* **The Discovery Pattern:**
  * QBO GL reports represent contra-entries (e.g., refunds posted to a revenue account, rebates/reversals posted to an expense account) as negative values.
  * Taking `abs()` flipped subtractions into additions. For instance:
    * Two $200 adoption refunds posted as `"-200.00"` under *Animal Adoptions* were added as `+$200.00` (a $400 overstatement).
    * A $220 BISSELL Pet Foundation rebate posted as `"-220.00"` under *General Shelter Supplies* was added as `+$220.00` (a $440 expense overstatement).
    * A $455 insurance overpayment refund was added as `+$455.00`.
  * **The Fix:** Preserve the true sign in extraction, and update UI renderers (such as [`ExpenseExplorer.astro`](file:///c:/Users/Jeff/Documents/AzureMigration/frontend/src/components/board/ExpenseExplorer.astro)) to display negative lines with rose styling (`text-rose-700`) rather than crashing or displaying `+-` artifacts.

---

## 3. What Has Already Been Ruled Out

Do not waste time re-investigating paths already proven invalid:

1. **The Payment/Invoice Extraction Dead End:**
   * In QBO, customer `Payment` transactions against `Invoice` records do not contain the revenue classification lines (those live on the underlying invoice lines). Querying `Payment` records for income accounts yields blank splits. Revenue tracking must always rely on `Deposit` lines, `SalesReceipt` records, and the GL report itself.
2. **Generic Fuzzy Name Matching on Bank Memos:**
   * Attempting Levenshtein/fuzzy matching on bank deposit descriptions produces unacceptably high false-positive rates (matching unrelated individuals sharing common first names). Only exact contact matches (Tier 1) and exact surname + first token household matches (Tier 2) are valid.
3. **Overwriting 2025 Certified Summary with GL Totals:**
   * The audited 2025 summary in `published_2026_ytd.json` ($836,847 revenue / $664,492 expense) is a certified whole-dollar figure. The GL pull ($803K revenue after excluding non-operating transfers) agrees on every verified wire and check to the penny. The remaining ~4% difference is due to year-end presentation rounding and accrual adjustments, not an extraction error. Both numbers must remain visible side-by-side with clear reconciliation notes.

---

## 4. Open Judgment Calls (Do Not Resolve Without Org Approval)

### Judgment Call 1: The November 2025 Martin DuBois $3,000 Dual-Entry
* **Evidence in `month_2025_10` (Nov 2025):**
  * `Deposit` on `2025-11-22`: $3,000.00, Payee: `"Martin DuBois"`, Memo: `""`.
  * `Deposit` on `2025-11-24`: $3,000.00, Payee: `"Unknown"`, Memo: `"DEPOSIT"`.
  * Bank statement line 1904 shows cleared `$3,000.00` deposit on `2025-11-24`.
* **The Question:** Is the 11/24 unattached deposit the clearing entry for Martin DuBois's 11/22 contribution, or did HSMC receive two separate $3,000 gifts that week?
* **Current Action:** Flagged as open; left unmerged in GL drilldown to prevent accidental undercounting or duplicate attribution.

### Judgment Call 2: Winners Auto & Cycle Miscoding
* **Evidence in `qbo_audit_2024_2026.db`:**
  * `Purchase 3458` (`2025-06-24`): $2,452.16, Payee: `"Winners Auto & Cycle Romulus Mi"`.
  * Line 1 is coded to Account `1150040007` (`Event Donation`, Classification: **Revenue**).
  * `Purchase 3977` (`2025-07-01`): $816.31 to Winners Auto, correctly coded to Account `152` (`Facility & Cleaning Supplies`, Expense).
* **The Question:** Purchase 3458 was entered as a Purchase transaction but mapped to a revenue account (`Event Donation`), creating a negative revenue entry instead of a vehicle repair expense.
* **Current Action:** Documented in audit findings; not unilaterally reclassified in production books without CPA/staff sign-off.

---

## 5. Concrete Menu of Unfinished Threads

The fresh session should prioritize the following threads:

### Thread 1: 2024 GL Enrichment & Sign-Fix Pipeline (Highest Priority)
* **Current State:** [`scripts/data/monthly_drilldown_2024.json`](file:///c:/Users/Jeff/Documents/AzureMigration/scripts/data/monthly_drilldown_2024.json) has **91.4% ($574,967.10 of $629,186.22) revenue classified as "Unknown"** across 488 transactions. It has 0 negative transactions because it predated the sign fix.
* **Tasks:**
  1. Re-run or adapt `qbo_fetch_monthly_gl_drilldown.py --start 2024-01 --end 2024-12` ensuring true signed amounts are preserved.
  2. Execute `qbo_match_payees.py --year 2024` with the full 4-tier matching engine.
  3. Validate against bank statement files (`First_Merchant_Chkng_XXXXXX8478_01312024.pdf` through `12312024.pdf`).
  4. Write `scripts/qbo_publish_2024_drilldown.py` and promote verified outputs to `api/data/published_2024_ytd.json` and `api/data/monthly_drilldown_2024.json`.

### Thread 2: Audit 2026 for Hidden Sign Bugs
* **Current State:** 2026 drilldown currently shows 0 negative transactions and 0% "Unknown".
* **Tasks:**
  1. Inspect the raw 2026 QBO `GeneralLedger` report rows in `qbo_audit_2024_2026.db` or the live mirror to determine whether negative contra-entries existed in raw QBO for 2026.
  2. Verify whether 2026's original generation script used `abs()` on contra-entries or whether 2026 books genuinely booked all refunds through explicit expense accounts (e.g., `Adoption refunds`).
  3. If raw negative lines exist that were flipped to positive, quantify the variance.

### Thread 3: Duplicate-Account & Chart-of-Accounts Rationalization
* **Examples Found:**
  * `"Salaries & Wages"` vs. `"Salaries & Wages-1"` (duplicate accounts from legacy payroll migration, where `-1` holds $357K and the base holds $37K in 2025).
  * `"Sales of Product Income"` vs. `"Sales of Product Revenue"`.
* **Tasks:**
  1. Run automated scan across `accounts` in `qbo_audit_2024_2026.db` for duplicate account names with suffixes like `-1`, `(deleted)`, or minor punctuation differences.
  2. Expand `MANUAL_NAME_OVERRIDES` in `qbo_fetch_monthly_gl_drilldown.py` to ensure all historical duplicates merge seamlessly into single board cards.

### Thread 4: Git Hygiene & Repository Cleanup
* **Tasks:**
  1. Add `__pycache__/`, `*.pyc`, and `.local-secrets/` to [`.gitignore`](file:///c:/Users/Jeff/Documents/AzureMigration/.gitignore).
  2. Untrack committed bytecode files (`git rm -r --cached scripts/__pycache__`).
  3. Untrack build log files (`git rm --cached frontend/.astro/*.log`).
  4. Stage and commit active working tree updates to `scripts/` and `ExpenseExplorer.astro`.
