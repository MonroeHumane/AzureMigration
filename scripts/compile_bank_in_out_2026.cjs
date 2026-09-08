/**
 * Compile First Merchants checking in/out for Jan–Aug 2026.
 *
 * Jan–Jul line items: Monroeapp statement_transactions.csv (parsed from PDFs).
 * August line items: frontend/src/data/statement_2026_08.json (August PDF).
 * Writes frontend/src/data/bank_in_out_2026.json and api/data/ copy.
 * Asserts proven monthly footings. Does not touch certified P&L nets.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = 'C:\\Users\\Jeff\\Documents\\Monroeapp\\qbonline\\statement_transactions.csv';
const PDF_DIR = 'C:\\Users\\Jeff\\Documents\\Monroeapp\\qbonline\\statements';
const AUG_PDF = path.join(ROOT, 'api', 'data', 'files', 'First_Merchant_Chkng_XXXXXX8478_08312026.pdf');
const AUG_JSON = path.join(ROOT, 'frontend', 'src', 'data', 'statement_2026_08.json');
const OUT_FRONT = path.join(ROOT, 'frontend', 'src', 'data', 'bank_in_out_2026.json');
const OUT_API = path.join(ROOT, 'api', 'data', 'bank_in_out_2026.json');

const PROVEN = [
  { id: '2026-01', monthName: 'Jan 2026', begin: 163219.07, credits: 68198.87, credit_count: 43, debits: 73399.85, debit_count: 92, end: 158018.09, pdf: 'First_Merchant_Chkng_XXXXXX8478_01302026.pdf', period: '01/01/2026 to 01/30/2026', statement_date: '2026-01-30' },
  { id: '2026-02', monthName: 'Feb 2026', begin: 158018.09, credits: 39598.12, credit_count: 44, debits: 43603.09, debit_count: 60, end: 154013.12, pdf: 'First_Merchant_Chkng_XXXXXX8478_02272026.pdf', period: '01/31/2026 to 02/27/2026', statement_date: '2026-02-27' },
  { id: '2026-03', monthName: 'Mar 2026', begin: 154013.12, credits: 38317.49, credit_count: 43, debits: 65187.36, debit_count: 60, end: 127143.25, pdf: 'First_Merchant_Chkng_XXXXXX8478_03312026.pdf', period: '02/28/2026 to 03/31/2026', statement_date: '2026-03-31' },
  { id: '2026-04', monthName: 'Apr 2026', begin: 127143.25, credits: 70430.92, credit_count: 43, debits: 65005.37, debit_count: 62, end: 132568.80, pdf: 'First_Merchant_Chkng_XXXXXX8478_04302026.pdf', period: '04/01/2026 to 04/30/2026', statement_date: '2026-04-30' },
  { id: '2026-05', monthName: 'May 2026', begin: 132568.80, credits: 28287.83, credit_count: 33, debits: 43111.93, debit_count: 61, end: 117744.70, pdf: 'First_Merchant_Chkng_XXXXXX8478_05292026.pdf', period: '05/01/2026 to 05/29/2026', statement_date: '2026-05-29' },
  { id: '2026-06', monthName: 'Jun 2026', begin: 117744.70, credits: 54013.12, credit_count: 38, debits: 59458.43, debit_count: 64, end: 112299.39, pdf: 'First_Merchant_Chkng_XXXXXX8478_06302026.pdf', period: '05/30/2026 to 06/30/2026', statement_date: '2026-06-30' },
  { id: '2026-07', monthName: 'Jul 2026', begin: 112299.39, credits: 19524.26, credit_count: 41, debits: 77543.27, debit_count: 84, end: 54280.38, pdf: 'First_Merchant_Chkng_XXXXXX8478_07312026.pdf', period: '07/01/2026 to 07/31/2026', statement_date: '2026-07-31' },
  { id: '2026-08', monthName: 'Aug 2026', begin: 54280.38, credits: 40889.25, credit_count: 46, debits: 70643.29, debit_count: 62, end: 24526.34, pdf: 'First_Merchant_Chkng_XXXXXX8478_08312026.pdf', period: '08/01/2026 to 08/31/2026', statement_date: '2026-08-31' },
];

const YTD = { in: 359259.86, out: 497952.59, net: -138692.73 };

function cents(n) {
  return Math.round(Number(n) * 100);
}

function dollars(c) {
  return Math.round(c) / 100;
}

function assertEq(label, actual, expected) {
  if (cents(actual) !== cents(expected)) {
    throw new Error(`${label}: got ${actual} expected ${expected}`);
  }
}

function parseCsvLine(line) {
  const first = line.indexOf(',');
  const second = line.indexOf(',', first + 1);
  const last = line.lastIndexOf(',');
  const secondLast = line.lastIndexOf(',', last - 1);
  return {
    StatementFile: line.slice(0, first),
    Date: line.slice(first + 1, second),
    Description: line.slice(second + 1, secondLast),
    Amount: line.slice(secondLast + 1, last),
    Type: line.slice(last + 1).trim(),
  };
}

function classifyCredit(description) {
  const d = String(description || '').toUpperCase();
  if (d.includes('DEPOSIT')) return { category: 'Branch Deposit', channel: 'Branch', type: 'Branch Deposit' };
  if (d.includes('SQUARE')) return { category: 'Merchant Processing', channel: 'Square', type: 'Merchant Card' };
  if (d.includes('PAYPAL')) return { category: 'Digital Donations', channel: 'PayPal', type: 'Electronic Credit' };
  if (d.includes('BETTERUNITE')) return { category: 'Fundraising Platform', channel: 'BetterUnite', type: 'Electronic Credit' };
  if (d.includes('ZEFFY')) return { category: 'Fee-Free Platform', channel: 'Zeffy', type: 'Electronic Credit' };
  if (d.includes('GIVELIFY')) return { category: 'Digital Donations', channel: 'Givelify', type: 'Electronic Credit' };
  if (d.includes('NETWORK FOR GOOD') || d.includes('NETWORKFORGOOD')) return { category: 'Fundraising Platform', channel: 'Network for Good', type: 'Electronic Credit' };
  if (d.includes('STRIPE')) return { category: 'Merchant Processing', channel: 'Stripe', type: 'Merchant Card' };
  if (d.includes('VENMO')) return { category: 'Digital Donations', channel: 'Venmo', type: 'Electronic Credit' };
  if (/\bCITY\b|\bCOUNTY\b|MONROE CITY|TREASURER/.test(d)) return { category: 'Municipal Contract', channel: 'ACH', type: 'Electronic Credit' };
  return { category: 'Electronic Credit', channel: 'ACH', type: 'Electronic Credit' };
}

function classifyDebit(description) {
  const desc = String(description || '');
  const check = desc.match(/Check\s*#?\s*(\d+)/i);
  if (check) {
    return {
      category: 'Paper Check',
      payee: `Check #${check[1]}`,
      type: 'Paper Check',
      check_number: check[1],
    };
  }
  const d = desc.toUpperCase();
  if (d.includes('PAYROLL')) {
    return { category: 'Staff Payroll', payee: 'Intuit Payroll', type: 'Direct Deposit' };
  }
  if (d.includes('INTUIT') && d.includes('TAX')) {
    return { category: 'Payroll Taxes', payee: 'Intuit Tax', type: 'Tax Remittance' };
  }
  if (d.includes('ELAN')) {
    return { category: 'Credit Card Liability', payee: 'Elan Cardmember Services', type: 'Autopay ACH' };
  }
  if (d.includes('SQUARE')) {
    return { category: 'Bank & Processing Fees', payee: 'Square', type: 'Electronic Debit' };
  }
  if (d.includes('BANKCARD') || d.includes('AUTHNET') || d.includes('MTHLY FEES')) {
    return { category: 'Bank & Processing Fees', payee: 'Merchant Fees', type: 'Electronic Debit' };
  }
  const payee = desc.split(/[/,]/)[0].trim().slice(0, 48) || 'Bank Debit';
  return { category: 'Bank Debit', payee, type: 'Electronic Debit' };
}

function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0];
  if (!header.startsWith('StatementFile,Date,Description,Amount,Type')) {
    throw new Error(`Unexpected CSV header: ${header}`);
  }
  return lines.slice(1).map(parseCsvLine);
}

function lineFromCsv(row, isCredit) {
  const amount = Math.abs(Number(row.Amount));
  if (isCredit) {
    const cls = classifyCredit(row.Description);
    return {
      date: row.Date,
      description: row.Description,
      amount,
      category: cls.category,
      channel: cls.channel,
      type: cls.type,
    };
  }
  const cls = classifyDebit(row.Description);
  const out = {
    date: row.Date,
    description: row.Description,
    amount,
    category: cls.category,
    payee: cls.payee,
    type: cls.type,
  };
  if (cls.check_number) out.check_number = cls.check_number;
  return out;
}

function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`Missing CSV: ${CSV_PATH}`);
  if (!fs.existsSync(AUG_JSON)) throw new Error(`Missing August JSON: ${AUG_JSON}`);
  if (!fs.existsSync(AUG_PDF)) throw new Error(`Missing August PDF: ${AUG_PDF}`);

  for (const m of PROVEN.slice(0, 7)) {
    const pdfPath = path.join(PDF_DIR, m.pdf);
    if (!fs.existsSync(pdfPath)) throw new Error(`Missing PDF: ${pdfPath}`);
  }

  const rows = parseCsvRows(fs.readFileSync(CSV_PATH, 'utf8'));
  const augStmt = JSON.parse(fs.readFileSync(AUG_JSON, 'utf8'));
  const months = {};

  for (const spec of PROVEN) {
    let deposits;
    let withdrawals;
    let source;

    if (spec.id === '2026-08') {
      deposits = augStmt.deposits;
      withdrawals = augStmt.withdrawals;
      source = 'statement_2026_08.json (August PDF)';
      assertEq('Aug metadata begin', augStmt.metadata.statement_beginning_balance, spec.begin);
      assertEq('Aug metadata credits', augStmt.metadata.total_deposits_amount, spec.credits);
      assertEq('Aug metadata credit_count', augStmt.metadata.total_deposits_count, spec.credit_count);
      assertEq('Aug metadata debits', augStmt.metadata.total_withdrawals_amount, spec.debits);
      assertEq('Aug metadata debit_count', augStmt.metadata.total_withdrawals_count, spec.debit_count);
      assertEq('Aug metadata end', augStmt.metadata.statement_ending_balance, spec.end);
    } else {
      const monthRows = rows.filter((r) => r.Date.startsWith(spec.id));
      const creditRows = monthRows.filter((r) => r.Type === 'Credit');
      const debitRows = monthRows.filter((r) => r.Type === 'Debit');
      deposits = creditRows.map((r) => lineFromCsv(r, true));
      withdrawals = debitRows.map((r) => lineFromCsv(r, false));
      source = `statement_transactions.csv ← ${spec.pdf}`;
    }

    const creditSum = deposits.reduce((s, d) => s + cents(d.amount), 0);
    const debitSum = withdrawals.reduce((s, w) => s + cents(w.amount), 0);
    const endCents = cents(spec.begin) + creditSum - debitSum;

    assertEq(`${spec.id} credits`, dollars(creditSum), spec.credits);
    assertEq(`${spec.id} credit_count`, deposits.length, spec.credit_count);
    assertEq(`${spec.id} debits`, dollars(debitSum), spec.debits);
    assertEq(`${spec.id} debit_count`, withdrawals.length, spec.debit_count);
    assertEq(`${spec.id} end`, dollars(endCents), spec.end);
    assertEq(`${spec.id} footing begin+in-out`, dollars(cents(spec.begin) + cents(spec.credits) - cents(spec.debits)), spec.end);

    const rec = {
      id: spec.id,
      monthName: spec.monthName,
      statement_file: spec.pdf,
      statement_period: spec.period,
      statement_date: spec.statement_date,
      source,
      begin: spec.begin,
      credits: spec.credits,
      credit_count: spec.credit_count,
      debits: spec.debits,
      debit_count: spec.debit_count,
      end: spec.end,
      deposits,
      withdrawals,
    };

    if (spec.id === '2026-08') {
      rec.book_balance = augStmt.metadata.qbo_register_balance;
      rec.penny_adjusted_ending = augStmt.metadata.penny_adjusted_ending_balance;
      rec.reconciled_float = augStmt.metadata.reconciled_float;
      rec.reconciled_by = augStmt.metadata.reconciled_by;
      rec.reconciliation_status = augStmt.metadata.reconciliation_status;
      rec.detail = 'statement_2026_08.json';
      rec.has_daily_balances = true;
      rec.has_recon = true;
    } else {
      rec.has_daily_balances = false;
      rec.has_recon = false;
    }

    months[spec.id] = rec;
  }

  const ytdIn = PROVEN.reduce((s, m) => s + cents(m.credits), 0);
  const ytdOut = PROVEN.reduce((s, m) => s + cents(m.debits), 0);
  assertEq('YTD in', dollars(ytdIn), YTD.in);
  assertEq('YTD out', dollars(ytdOut), YTD.out);
  assertEq('YTD net', dollars(ytdIn - ytdOut), YTD.net);

  const payload = {
    meta: {
      bank_name: 'First Merchants Bank',
      account_number: 'XXXXXX8478',
      account_type: 'Commercial Checking',
      compiled_at: new Date().toISOString(),
      source: 'Jan–Jul: statement_transactions.csv (First Merchants PDFs). August: statement_2026_08.json. Float/daily/recon stay in statement_2026_08.json.',
      ytd: {
        in: YTD.in,
        out: YTD.out,
        net: YTD.net,
        credit_count: PROVEN.reduce((s, m) => s + m.credit_count, 0),
        debit_count: PROVEN.reduce((s, m) => s + m.debit_count, 0),
        begin: PROVEN[0].begin,
        end: PROVEN[PROVEN.length - 1].end,
      },
      august_bridge: {
        bank_out: 70643.29,
        pnl_spend: 58133.65,
        gap: 12509.64,
        explained_by: [
          { name: 'Elan Cardmember Services', amount: 13166.74, why: 'Credit-card paydown (balance sheet, not August P&L)' },
          { name: 'Monroe Fencing', amount: 7100.0, why: 'Capital play-yard fencing (asset, not P&L expense)' },
        ],
      },
    },
    months,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  fs.mkdirSync(path.dirname(OUT_FRONT), { recursive: true });
  fs.mkdirSync(path.dirname(OUT_API), { recursive: true });
  fs.writeFileSync(OUT_FRONT, json);
  fs.writeFileSync(OUT_API, json);

  console.log('Wrote', OUT_FRONT);
  console.log('Wrote', OUT_API);
  for (const spec of PROVEN) {
    console.log(
      `${spec.monthName} ${spec.begin.toFixed(2)} + ${spec.credits.toFixed(2)} (${spec.credit_count}) - ${spec.debits.toFixed(2)} (${spec.debit_count}) = ${spec.end.toFixed(2)} OK`
    );
  }
  console.log(`YTD in ${YTD.in} / out ${YTD.out} / net ${YTD.net} OK`);
}

main();
