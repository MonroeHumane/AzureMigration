/**
 * Compile First Merchants checking in/out for 2024 and 2025.
 *
 * Line items: Monroeapp statement_transactions.csv.
 * 2025 begin/end stamped from native PDF text. 2024 PDFs are scanned;
 * those months chain backward from the 2025-01 opening ($136,770.92).
 * 2025-12 ending must equal the locked 2026-01 opening ($163,219.07).
 * Does not rebuild 2026 or touch certified P&L.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSV_PATH = 'C:\\Users\\Jeff\\Documents\\Monroeapp\\qbonline\\statement_transactions.csv';
const PDF_DIR = 'C:\\Users\\Jeff\\Documents\\Monroeapp\\qbonline\\statements';
const YEARS = [2024, 2025];
const OPEN_2025_01 = 136770.92;
const OPEN_2026_01 = 163219.07;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PDF_2025 = {
  '2025-01': { pdf: 'First_Merchant_Chkng_XXXXXX8478_01312025.pdf', begin: 136770.92, end: 103017.12, credits: 34271.09, credit_count: 53, debits: 68024.89, debit_count: 59, period: '01/01/2025 to 01/31/2025', statement_date: '2025-01-31' },
  '2025-02': { pdf: 'First_Merchant_Chkng_XXXXXX8478_02282025.pdf', begin: 103017.12, end: 106125.11, credits: 49865.22, credit_count: 53, debits: 46757.23, debit_count: 52, period: '02/01/2025 to 02/28/2025', statement_date: '2025-02-28' },
  '2025-03': { pdf: 'First_Merchant_Chkng_XXXXXX8478_03312025.pdf', begin: 106125.11, end: 111811.21, credits: 62106.08, credit_count: 46, debits: 56419.98, debit_count: 47, period: '03/01/2025 to 03/31/2025', statement_date: '2025-03-31' },
  '2025-04': { pdf: 'First_Merchant_Chkng_XXXXXX8478_04302025.pdf', begin: 111811.21, end: 135499.39, credits: 67002.71, credit_count: 48, debits: 43314.53, debit_count: 42, period: '04/01/2025 to 04/30/2025', statement_date: '2025-04-30' },
  '2025-05': { pdf: 'First_Merchant_Chkng_XXXXXX8478_05302025.pdf', begin: 135499.39, end: 109344.77, credits: 22488.95, credit_count: 49, debits: 48643.57, debit_count: 58, period: '05/01/2025 to 05/31/2025', statement_date: '2025-05-30' },
  '2025-06': { pdf: 'First_Merchant_Chkng_XXXXXX8478_06302025.pdf', begin: 109344.77, end: 92014.6, credits: 24074.18, credit_count: 39, debits: 41404.35, debit_count: 51, period: '06/01/2025 to 06/30/2025', statement_date: '2025-06-30' },
  '2025-07': { pdf: 'First_Merchant_Chkng_XXXXXX8478_07312025.pdf', begin: 92014.6, end: 72921.64, credits: 36025.36, credit_count: 43, debits: 55118.32, debit_count: 59, period: '07/01/2025 to 07/31/2025', statement_date: '2025-07-31' },
  '2025-08': { pdf: 'First_Merchant_Chkng_XXXXXX8478_08292025.pdf', begin: 72921.64, end: 24920.78, credits: 27726.74, credit_count: 40, debits: 75727.6, debit_count: 89, period: '08/01/2025 to 08/31/2025', statement_date: '2025-08-29' },
  '2025-09': { pdf: 'First_Merchant_Chkng_XXXXXX8478_09302025.pdf', begin: 24920.78, end: 85950.32, credits: 131318.16, credit_count: 49, debits: 70288.62, debit_count: 69, period: '09/01/2025 to 09/30/2025', statement_date: '2025-09-30' },
  '2025-10': { pdf: 'First_Merchant_Chkng_XXXXXX8478_10312025.pdf', begin: 85950.32, end: 163894.61, credits: 307846.7, credit_count: 44, debits: 229902.41, debit_count: 56, period: '10/01/2025 to 10/31/2025', statement_date: '2025-10-31' },
  '2025-11': { pdf: 'First_Merchant_Chkng_XXXXXX8478_11282025.pdf', begin: 163894.61, end: 169241.14, credits: 48905.26, credit_count: 39, debits: 43558.73, debit_count: 67, period: '11/01/2025 to 11/30/2025', statement_date: '2025-11-28' },
  '2025-12': { pdf: 'First_Merchant_Chkng_XXXXXX8478_12312025.pdf', begin: 169241.14, end: 163219.07, credits: 56170.26, credit_count: 50, debits: 62192.33, debit_count: 62, period: '12/01/2025 to 12/31/2025', statement_date: '2025-12-31' },
};

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
  if (d.includes('STRIPE')) return { category: 'Merchant Processing', channel: 'Stripe', type: 'Electronic Credit' };
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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthId(year, month) {
  return `${year}-${pad2(month)}`;
}

function mdy(iso) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function listYearPdfs(year) {
  const files = fs.readdirSync(PDF_DIR).filter((f) => f.startsWith('First_Merchant_Chkng_XXXXXX8478_') && f.endsWith('.pdf'));
  const byMonth = {};
  for (const file of files) {
    const m = file.match(/_(\d{2})(\d{2})(\d{4})\.pdf$/);
    if (!m) continue;
    const mm = Number(m[1]);
    const dd = m[2];
    const yyyy = Number(m[3]);
    if (yyyy !== year) continue;
    byMonth[monthId(year, mm)] = {
      pdf: file,
      statement_date: `${yyyy}-${pad2(mm)}-${dd}`,
    };
  }
  return byMonth;
}

function compileYear(year, rows, pdfs) {
  const specs = [];
  for (let month = 1; month <= 12; month += 1) {
    const id = monthId(year, month);
    const pdfMeta = pdfs[id];
    if (!pdfMeta) throw new Error(`Missing PDF for ${id}`);
    const pdfPath = path.join(PDF_DIR, pdfMeta.pdf);
    if (!fs.existsSync(pdfPath)) throw new Error(`Missing PDF file: ${pdfPath}`);

    const monthRows = rows.filter((r) => r.Date.startsWith(id));
    const creditRows = monthRows.filter((r) => r.Type === 'Credit');
    const debitRows = monthRows.filter((r) => r.Type === 'Debit');
    const deposits = creditRows.map((r) => lineFromCsv(r, true));
    const withdrawals = debitRows.map((r) => lineFromCsv(r, false));
    const credits = dollars(deposits.reduce((s, d) => s + cents(d.amount), 0));
    const debits = dollars(withdrawals.reduce((s, w) => s + cents(w.amount), 0));

    const stamped = PDF_2025[id] || null;
    if (stamped) {
      if (pdfMeta.pdf !== stamped.pdf) {
        throw new Error(`${id} pdf file: got ${pdfMeta.pdf} expected ${stamped.pdf}`);
      }
      assertEq(`${id} credits`, credits, stamped.credits);
      assertEq(`${id} credit_count`, deposits.length, stamped.credit_count);
      assertEq(`${id} debits`, debits, stamped.debits);
      assertEq(`${id} debit_count`, withdrawals.length, stamped.debit_count);
    }

    specs.push({
      id,
      monthName: `${MONTH_NAMES[month - 1]} ${year}`,
      pdf: pdfMeta.pdf,
      statement_date: stamped ? stamped.statement_date : pdfMeta.statement_date,
      period: stamped ? stamped.period : null,
      begin: stamped ? stamped.begin : null,
      end: stamped ? stamped.end : null,
      credits,
      credit_count: deposits.length,
      debits,
      debit_count: withdrawals.length,
      deposits,
      withdrawals,
      stamped: !!stamped,
    });
  }

  if (year === 2024) {
    specs[11].end = OPEN_2025_01;
    for (let i = 11; i >= 0; i -= 1) {
      const spec = specs[i];
      spec.begin = dollars(cents(spec.end) - cents(spec.credits) + cents(spec.debits));
      if (i > 0) specs[i - 1].end = spec.begin;
    }
  }

  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i];
    assertEq(`${spec.id} footing begin+in-out`, dollars(cents(spec.begin) + cents(spec.credits) - cents(spec.debits)), spec.end);
    if (i > 0) assertEq(`${spec.id} chains from prior end`, spec.begin, specs[i - 1].end);
    if (!spec.period) {
      const startIso = i === 0 ? `${year}-01-01` : addDays(specs[i - 1].statement_date, 1);
      spec.period = `${mdy(startIso)} to ${mdy(spec.statement_date)}`;
    }
  }

  if (year === 2025) {
    assertEq('2025-01 opening', specs[0].begin, OPEN_2025_01);
    assertEq('2025-12 ending vs 2026-01 opening', specs[11].end, OPEN_2026_01);
  }
  if (year === 2024) {
    assertEq('2024-12 ending vs 2025-01 opening', specs[11].end, OPEN_2025_01);
  }

  const months = {};
  for (const spec of specs) {
    months[spec.id] = {
      id: spec.id,
      monthName: spec.monthName,
      statement_file: spec.pdf,
      statement_period: spec.period,
      statement_date: spec.statement_date,
      source: spec.stamped
        ? `statement_transactions.csv ← ${spec.pdf} (PDF begin/end stamped)`
        : `statement_transactions.csv ← ${spec.pdf} (scanned; chained from 2025-01 opening ${OPEN_2025_01})`,
      begin: spec.begin,
      credits: spec.credits,
      credit_count: spec.credit_count,
      debits: spec.debits,
      debit_count: spec.debit_count,
      end: spec.end,
      deposits: spec.deposits,
      withdrawals: spec.withdrawals,
      has_daily_balances: false,
      has_recon: false,
    };
  }

  const ytdIn = specs.reduce((s, m) => s + cents(m.credits), 0);
  const ytdOut = specs.reduce((s, m) => s + cents(m.debits), 0);
  const payload = {
    meta: {
      bank_name: 'First Merchants Bank',
      account_number: 'XXXXXX8478',
      account_type: 'Commercial Checking',
      year,
      compiled_at: new Date().toISOString(),
      source: year === 2025
        ? 'statement_transactions.csv with native First Merchants PDF begin/end stamps. No QBO recon in this pack.'
        : 'statement_transactions.csv. 2024 PDFs are scanned; begin/end chained from the 2025-01 opening. No QBO recon in this pack.',
      ytd: {
        in: dollars(ytdIn),
        out: dollars(ytdOut),
        net: dollars(ytdIn - ytdOut),
        credit_count: specs.reduce((s, m) => s + m.credit_count, 0),
        debit_count: specs.reduce((s, m) => s + m.debit_count, 0),
        begin: specs[0].begin,
        end: specs[specs.length - 1].end,
      },
    },
    months,
  };

  return { payload, specs };
}

function writePack(year, payload) {
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  const front = path.join(ROOT, 'frontend', 'src', 'data', `bank_in_out_${year}.json`);
  const api = path.join(ROOT, 'api', 'data', `bank_in_out_${year}.json`);
  fs.mkdirSync(path.dirname(front), { recursive: true });
  fs.mkdirSync(path.dirname(api), { recursive: true });
  fs.writeFileSync(front, json);
  fs.writeFileSync(api, json);
  return { front, api };
}

function main() {
  if (!fs.existsSync(CSV_PATH)) throw new Error(`Missing CSV: ${CSV_PATH}`);
  if (!fs.existsSync(PDF_DIR)) throw new Error(`Missing PDF dir: ${PDF_DIR}`);
  const rows = parseCsvRows(fs.readFileSync(CSV_PATH, 'utf8'));

  for (const year of YEARS) {
    const { payload, specs } = compileYear(year, rows, listYearPdfs(year));
    const { front, api } = writePack(year, payload);
    console.log('Wrote', front);
    console.log('Wrote', api);
    for (const spec of specs) {
      console.log(
        `${spec.monthName} ${spec.begin.toFixed(2)} + ${spec.credits.toFixed(2)} (${spec.credit_count}) - ${spec.debits.toFixed(2)} (${spec.debit_count}) = ${spec.end.toFixed(2)} OK`
      );
    }
    const ytd = payload.meta.ytd;
    console.log(`${year} YTD in ${ytd.in} / out ${ytd.out} / net ${ytd.net} OK`);
  }
}

main();
