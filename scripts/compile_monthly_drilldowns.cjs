const fs = require('fs');
const path = require('path');
const {
  loadRecodeMap,
  indexRecodeMap,
  applyCategoryRules,
} = require('./qbo_category_rules.cjs');

const recodeIndex = indexRecodeMap(loadRecodeMap());
const BOARD_LABELS = require('../frontend/src/data/board_display_labels.json');

function displayCategoryName(name) {
  const raw = String(name || '').trim();
  return BOARD_LABELS.categories[raw] || BOARD_LABELS.categories[raw.toLowerCase()] || raw;
}

function displayGroupName(group) {
  const raw = String(group || '').trim();
  return BOARD_LABELS.groups[raw] || BOARD_LABELS.groups[raw.toLowerCase()] || raw;
}

const stepsMap = [
  { id: 'month_2026_0', key: '2026-01', name: 'Jan 2026', step: 3087 },
  { id: 'month_2026_1', key: '2026-02', name: 'Feb 2026', step: 3089 },
  { id: 'month_2026_2', key: '2026-03', name: 'Mar 2026', step: 3091 },
  { id: 'month_2026_3', key: '2026-04', name: 'Apr 2026', step: 3093 },
  { id: 'month_2026_4', key: '2026-05', name: 'May 2026', step: 3095 },
  { id: 'month_2026_5', key: '2026-06', name: 'Jun 2026', step: 3097 },
  { id: 'month_2026_6', key: '2026-07', name: 'Jul 2026', step: 3099 },
  { id: 'month_2026_7', key: '2026-08', name: 'Aug 2026', step: 3069 },
];

const EXCLUDE_TOP = new Set([
  'Cash', 'Cash 1 (deleted)', 'First Merchant Bank (deleted)', 'First Merchants Bank',
  'Payments to deposit', 'QuickBooks Tax Holding Account', 'Buildings', 'Buildings-AD',
  'Equipment', 'Equipment-AD', 'Land', 'OFFICE HARDWARE & FURNITURE, DESIGN ITEMS',
  'Investments', 'Accounts Payable (A/P)', 'First Merchants Creditcard',
  'Direct Deposit Payable', 'Lines of credit', 'Payroll Liabilities',
  'Net Assets With Donor Restrictions', 'Net Assets Without Donor Restrictions',
  'Opening balance equity', 'Retained Earnings'
]);

const ACCOUNT_NORMALIZATION = {
  'Salaries & Wages-1': { name: 'Caregiver Salaries & Wages', group: 'Personnel & Staffing' },
  'Salaries & Wages': { name: 'Caregiver Salaries & Wages', group: 'Personnel & Staffing' },
  'Payroll Taxes': { name: 'Payroll Taxes', group: 'Personnel & Staffing' },
  'Workplace Injury & Medical Care': { name: 'Workplace Injury Care', group: 'Personnel & Staffing' },
  'Staff & Volunteer Appreciation Meals': { name: 'Staff & Volunteer Meals', group: 'Personnel & Staffing' },
  'Animal Care Supplies': { name: 'Animal Care Supplies & Food', group: 'Shelter Operations' },
  'Facility & Cleaning Supplies': { name: 'Facility & Cleaning Supplies', group: 'Shelter Operations' },
  'General Shelter Supplies': { name: 'General Shelter Supplies', group: 'Shelter Operations' },
  'Laundry & Sanitation Services': { name: 'Laundry & Sanitation Services', group: 'Shelter Operations' },
  'Microchips & Registries': { name: 'Microchips & Registries', group: 'Shelter Operations' },
  'Adoption Fee Refunds & Returns': { name: 'Adoption Fee Refunds & Returns', group: 'Shelter Operations' },
  'Building Repairs': { name: 'Building Repairs & Maintenance', group: 'Shelter Operations' },
  'Cleaning': { name: 'Facility Deep Cleaning', group: 'Shelter Operations' },
  'Emergency & Specialty Care': { name: 'Emergency & Specialty Veterinary', group: 'Veterinary & Medical Care' },
  'Medications & Vaccines': { name: 'Medications & Vaccines', group: 'Veterinary & Medical Care' },
  'Primary Care & Wellness': { name: 'Primary Care & Wellness Clinics', group: 'Veterinary & Medical Care' },
  'Spay & Neuter Program': { name: 'Spay & Neuter Program', group: 'Veterinary & Medical Care' },
  'Vendor Rebates & Credits': { name: 'Medical Vendor Rebates', group: 'Veterinary & Medical Care' },
  'Gas': { name: 'Rescue Van Fuel & Transit', group: 'Vehicle Expenses' },
  'Vehicle Repairs & Maintenance': { name: 'Vehicle Repairs & Maintenance', group: 'Vehicle Expenses' },
  'Liability insurance': { name: 'Shelter Property & Liability Insurance', group: 'Insurance & Risk' },
  'Insurance': { name: 'Shelter Property & Liability Insurance', group: 'Insurance & Risk' },
  'Directors & Officers Insurance': { name: 'Directors & Officers Insurance', group: 'Insurance & Risk' },
  'Software & Apps': { name: 'Software & Cloud Apps', group: 'Office & Admin' },
  'Office expenses': { name: 'General Administrative & Office', group: 'Office & Admin' },
  'General Administrative & Office': { name: 'General Administrative & Office', group: 'Office & Admin' },
  'PET RETURN': { name: 'Adoption Fee Refunds & Returns', group: 'Shelter Operations' },
  'DOG BANKS': { name: 'Canister & Community Coin Banks', group: 'Contributed Income' },
  'Equipment Lease & Maintenance': { name: 'Equipment Lease & Maintenance', group: 'Office & Admin' },
  'Office Supplies': { name: 'Office Supplies', group: 'Office & Admin' },
  'Printing & Photocopying': { name: 'Printing & Photocopying', group: 'Office & Admin' },
  'Shipping & Postage': { name: 'Shipping & Postage', group: 'Office & Admin' },
  'Bank Fees & Service Charges': { name: 'Bank & Account Fees', group: 'Financial Operations' },
  'Merchant Account Fees': { name: 'Merchant Gateway & Card Fees', group: 'Financial Operations' },
  'Fundraising fees': { name: 'Fundraising Platform Fees', group: 'Financial Operations' },
  'Promotional Items': { name: 'Promotional Items & Outreach', group: 'Marketing & Outreach' },
  'Special Events & Gala Expenses': { name: 'Special Events & Gala Expenses', group: 'Fundraising & Events' },
  // Revenue
  'Donations directed by individuals': { name: 'Individual Donor Contributions', group: 'Contributed Income' },
  'Corporate Donations': { name: 'Corporate Donations', group: 'Contributed Income' },
  'Donation Canisters (Dog Banks)': { name: 'Canister & Community Coin Banks', group: 'Contributed Income' },
  'Cat Room Expansion Fund': { name: 'Cat Room Expansion Fund', group: 'Contributed Income' },
  'Foundation Grants': { name: 'Foundation Grants', group: 'Contributed Income' },
  'Government grants & contracts': { name: 'Municipal Contracts & Grants', group: 'Contributed Income' },
  'Grants from other nonprofits': { name: 'Grants from Other Nonprofits', group: 'Contributed Income' },
  'Memorial Donations': { name: 'Memorial Donations', group: 'Contributed Income' },
  'Animal Adoptions': { name: 'Animal Adoption Fees', group: 'Earned Revenue' },
  'cremation': { name: 'Pet Cremation Services', group: 'Earned Revenue' },
  'Event Donation': { name: 'Event Proceeds & Ticket Donations', group: 'Earned Revenue' },
  'Merchandise Sales (Swag)': { name: 'Merchandise & Swag Sales', group: 'Earned Revenue' },
  'Bottle & Can Recycling Revenue': { name: 'Bottle & Can Recycling Proceeds', group: 'Community Support' },
  'Court Restitution': { name: 'Court Restitution', group: 'Community Support' },
  'Quarterly Endowment Distributions': { name: 'Community Foundation Endowment Grants', group: 'Endowment Support' },
  'Retail Partner Rebates': { name: 'Retail Partner Rebates (Kroger/Meijer)', group: 'Community Support' },
};

const REVENUE_ACCOUNTS = new Set([
  'Animal Adoptions', 'Contributed income', 'Corporate Donations', 'Donation Canisters (Dog Banks)',
  'Cat Room Expansion Fund', 'Donations directed by individuals', 'Foundation Grants',
  'Government grants & contracts', 'Grants from other nonprofits', 'Memorial Donations',
  'cremation', 'Event Donation', 'Merchandise Sales (Swag)', 'Bottle & Can Recycling Revenue',
  'Court Restitution', 'Quarterly Endowment Distributions', 'Retail Partner Rebates',
  'Individual Donor Contributions', 'Canister & Community Coin Banks', 'Municipal Contracts & Grants',
  'Grants from Other Nonprofits', 'Animal Adoption Fees', 'Community Foundation Endowment Grants',
  'Bottle & Can Recycling Proceeds', 'Retail Partner Rebates (Kroger/Meijer)', 'Memorial Donations'
]);

const FORCE_EXPENSE_ACCOUNTS = new Set([
  'Adoption Fee Refunds & Returns',
  'PET RETURN',
  'Vendor Rebates & Credits',
  'Laundry & Sanitation Services',
  'Directors & Officers Insurance',
  'Insurance',
  'Liability insurance',
  'Office expenses',
]);

const EXPENSE_PARENT_RE = /operations|expense|personnel|staffing|veterinary|vehicle|insurance|office|financial|fundraising & events|marketing/i;

function isRevenueAccount(accName, parentName) {
  const acc = (accName || '').trim();
  const parent = (parentName || '').trim();
  if (FORCE_EXPENSE_ACCOUNTS.has(acc) || FORCE_EXPENSE_ACCOUNTS.has(parent)) return false;
  if (EXPENSE_PARENT_RE.test(parent) && !REVENUE_ACCOUNTS.has(acc)) return false;
  if (REVENUE_ACCOUNTS.has(acc) || REVENUE_ACCOUNTS.has(parent)) return true;
  const l = `${acc} ${parent}`.toLowerCase();
  return l.includes('donation') || l.includes('endowment') || l.includes('recycling') ||
         (l.includes('rebate') && !l.includes('vendor rebate')) ||
         (l.includes('grant') && !l.includes('expense')) ||
         l.includes('swag');
}

function accountKey(leafName, parentName) {
  return (leafName || '').trim() || (parentName || '').trim();
}

function payeeFromMemo(payee, memo, txnType) {
  const m = memo || '';
  if (/UNV\s*LAUNDRY/i.test(m)) return 'UNV Laundry';
  if (/AUTHNET GATEWAY/i.test(m)) return 'Authorize.Net';
  if (/SQUARE INC\/SQ/i.test(m) || /SQUARE INC\/SQUAR/i.test(m)) return 'Square Inc';
  if (/Family Dollar/i.test(m)) return 'Family Dollar';
  if (/THRIVENTGRANT/i.test(m)) return 'Thrivent Financial';
  if (/COUNTY\s+(QUARTERLY\s+)?PAYMENT/i.test(m) || /COUNTY OF MONROE/i.test(m)) return 'COUNTY OF MONROE';
  let clean = (payee || '').trim();
  const orgSelf = /^HUMANE SOCIETY OF MONROE COUNTY$/i.test(clean);
  const junkVendor = /Mi Corporations Div Lansing Mi Mi Corporations/i.test(clean);
  if ((orgSelf || clean === 'IRS' || junkVendor) && m.trim()) {
    const first = m.split(/HUMANE SOCIETY/i)[0].replace(/\/.*/, '').trim();
    if (first) return first.replace(/\s+/g, ' ');
  }
  if (!clean) {
    if (txnType === 'Journal Entry') return 'QuickBooks Journal Adjustment';
    if (txnType === 'Sales Receipt') return 'Public / Shelter Adopters';
    if (txnType === 'Deposit') return 'Branch Deposit Batch';
    return 'Shelter Operational Incurred';
  }
  return clean;
}

function applyMemoOverrides(meta, isRev, memo, payee, txnId, amount) {
  return applyCategoryRules({
    meta,
    isRev,
    memo,
    payee,
    txnId,
    amount,
    accountNormalization: ACCOUNT_NORMALIZATION,
    recodeIndex,
  });
}

function parseSection(sec, parentName = '') {
  const name = sec.Header ? sec.Header.ColData[0].value : '';
  const fullName = parentName ? `${parentName}: ${name}` : name;
  let txs = [];

  if (sec.Rows && sec.Rows.Row) {
    for (const child of sec.Rows.Row) {
      if (child.ColData) {
        const date = child.ColData[0]?.value;
        const txnType = child.ColData[1]?.value || '';
        const txnId = String(child.ColData[1]?.id || '');
        const docNum = child.ColData[2]?.value || '';
        const payee = child.ColData[3]?.value || '';
        const memo = child.ColData[4]?.value || '';
        const split = child.ColData[5]?.value || '';
        const amtStr = child.ColData[6]?.value;

        if (date && amtStr && date !== 'Beginning Balance') {
          let cleanPayee = payeeFromMemo(payee, memo, txnType);

          const rawAmt = parseFloat(amtStr) || 0;
          const accKey = accountKey(name, parentName);
          let isRev = isRevenueAccount(accKey, parentName);
          let meta = ACCOUNT_NORMALIZATION[accKey] || {
            name: accKey,
            group: parentName || (isRev ? 'Revenue' : 'Expenses')
          };
          if (!meta.name) {
            meta = { name: parentName || (isRev ? 'Revenue' : 'Uncategorized'), group: parentName || meta.group };
          }
          ({ meta, isRev, payee: cleanPayee } = applyMemoOverrides(
            meta, isRev, memo, cleanPayee, txnId, Math.abs(rawAmt)
          ));

          // Reclassify donations with explicit memorial/tribute dedications as Memorial Donations
          const fullMemo = (memo + ' ' + payee).toLowerCase();
          const hasDedication = fullMemo.includes('dedication:') || fullMemo.includes('in memory') || fullMemo.includes('in loving memory') || fullMemo.includes('memorial');
          if (isRev && hasDedication) {
            meta = { name: 'Memorial Donations', group: 'Contributed Income' };
          }

          // If donor name is embedded in memo (e.g. BetterUnite payouts), extract actual donor name
          if ((cleanPayee === 'BETTER UNITE' || cleanPayee === 'Branch Deposit Batch') && memo.includes('Donor:')) {
            const donorMatch = memo.match(/Donor:\s*([^|]+)/i);
            if (donorMatch) {
              cleanPayee = donorMatch[1].trim();
            }
          } else if (!payee.trim() && meta.name === 'Memorial Donations') {
            const tributeMatch = memo.match(/(?:memorial(?:\s+for)?|in\s+(?:loving\s+)?memory\s+of|memory\s+of|in\s+honor\s+of)\s+([^,|;]+)/i);
            if (tributeMatch) {
              cleanPayee = `Memorial: ${tributeMatch[1].trim()}`;
            } else if (memo.trim() && !memo.toLowerCase().includes('deposit')) {
              cleanPayee = `Memorial: ${memo.trim()}`;
            }
          }

          const legalName = meta.name;
          const legalGroup = meta.group;
          txs.push({
            date,
            txnType,
            docNum: docNum.trim(),
            payee: cleanPayee,
            memo: memo.trim(),
            split: split.trim(),
            amount: Math.abs(rawAmt),
            rawAmount: rawAmt,
            category: displayCategoryName(legalName),
            group: displayGroupName(legalGroup) || legalGroup,
            legalName,
            legalGroup,
            isRevenue: isRev
          });
        }
      } else if (child.Rows) {
        txs.push(...parseSection(child, name));
      }
    }
  }
  return txs;
}

const monthlyStatements = JSON.parse(fs.readFileSync('frontend/src/data/published_2026_ytd.json', 'utf8')).monthly_statements;

const monthlyDrilldowns = {};
const allYearTxs = [];

for (const m of stepsMap) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${m.step}/output.txt`;
  const gl = JSON.parse(fs.readFileSync(filePath, 'utf8').substring(fs.readFileSync(filePath, 'utf8').indexOf('{')));

  const rawTxs = [];
  for (const row of gl.Rows.Row) {
    const acc = row.Header ? row.Header.ColData[0].value : '';
    if (EXCLUDE_TOP.has(acc)) continue;
    rawTxs.push(...parseSection(row));
  }

  // Filter out wage reclassification journal entries that sum to 0
  const filteredTxs = rawTxs.filter(t => t.docNum !== 'PAYROLL-CLASS-2026');

  // Tag with month info
  filteredTxs.forEach(t => {
    t.monthId = m.id;
    t.monthName = m.name;
    allYearTxs.push(t);
  });

  const revTxs = filteredTxs.filter(t => t.isRevenue);
  const expTxs = filteredTxs.filter(t => !t.isRevenue);

  const stmt = monthlyStatements.find(s => s.id === m.id);

  function groupHierarchy(txList, totalReference) {
    const catMap = {};
    for (const t of txList) {
      if (!catMap[t.category]) {
        catMap[t.category] = {
          name: t.category,
          legalName: t.legalName || t.category,
          group: t.group,
          legalGroup: t.legalGroup || t.group,
          transactions: []
        };
      }
      catMap[t.category].transactions.push(t);
    }

    return Object.values(catMap).map(cat => {
      const payeeMap = {};
      for (const t of cat.transactions) {
        const p = t.payee;
        if (!payeeMap[p]) {
          payeeMap[p] = {
            name: p,
            total: 0,
            transactions: []
          };
        }
        payeeMap[p].total += t.amount;
        payeeMap[p].transactions.push(t);
      }

      const payees = Object.values(payeeMap).map(p => ({
        name: p.name,
        total: Math.round(p.total * 100) / 100,
        txCount: p.transactions.length,
        transactions: p.transactions
          .map(t => ({
            date: t.date,
            type: t.txnType,
            num: t.docNum,
            memo: t.memo,
            split: t.split,
            amount: t.amount
          }))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      })).sort((a, b) => b.total - a.total);

      const catTotal = payees.reduce((s, p) => s + p.total, 0);
      const roundedTotal = Math.round(catTotal * 100) / 100;
      const pctOfTotal = totalReference > 0 ? Math.round((roundedTotal / totalReference) * 1000) / 10 : 0;

      return {
        name: cat.name,
        group: cat.group,
        total: roundedTotal,
        pctOfTotal,
        payeeCount: payees.length,
        txCount: cat.transactions.length,
        payees
      };
    }).sort((a, b) => b.total - a.total);
  }

  const certifiedRev = stmt ? stmt.revenue : revTxs.reduce((s, t) => s + t.amount, 0);
  const certifiedExp = stmt ? stmt.total_exp : expTxs.reduce((s, t) => s + t.amount, 0);

  const revCats = groupHierarchy(revTxs, certifiedRev);
  const expCats = groupHierarchy(expTxs, certifiedExp);

  const catRev = Math.round(revCats.reduce((s, c) => s + c.total, 0) * 100) / 100;
  const catExp = Math.round(expCats.reduce((s, c) => s + c.total, 0) * 100) / 100;
  const revDelta = Math.round((catRev - certifiedRev) * 100) / 100;
  const expDelta = Math.round((catExp - certifiedExp) * 100) / 100;
  if (Math.abs(revDelta) > 0.02 || Math.abs(expDelta) > 0.02) {
    console.warn(
      `[footing] ${m.name}: explorer rev ${catRev} vs certified ${certifiedRev} (Δ ${revDelta}); ` +
      `exp ${catExp} vs certified ${certifiedExp} (Δ ${expDelta})`
    );
  } else {
    console.log(`[footing] ${m.name}: categories match certified P&L`);
  }

  monthlyDrilldowns[m.id] = {
    id: m.id,
    monthKey: m.key,
    monthName: m.name,
    isPartial: stmt ? stmt.is_partial : false,
    status: stmt ? stmt.status : 'Normal',
    driver: stmt ? stmt.driver : '',
    revenue: certifiedRev,
    total_exp: certifiedExp,
    net_margin: stmt ? stmt.net_margin : certifiedRev - certifiedExp,
    totalRevenueTxs: revTxs.length,
    totalExpenseTxs: expTxs.length,
    revenueCategories: revCats,
    expenseCategories: expCats
  };
}

// Build All 2026 YTD Rollup
function buildYtdRollup() {
  const ytdRevTxs = allYearTxs.filter(t => t.isRevenue);
  const ytdExpTxs = allYearTxs.filter(t => !t.isRevenue);

  const totalRev = Object.values(monthlyDrilldowns).reduce((s, m) => s + m.revenue, 0);
  const totalExp = Object.values(monthlyDrilldowns).reduce((s, m) => s + m.total_exp, 0);

  function groupYtd(txList, totalRef) {
    const catMap = {};
    for (const t of txList) {
      if (!catMap[t.category]) {
        catMap[t.category] = {
          name: t.category,
          legalName: t.legalName || t.category,
          group: t.group,
          legalGroup: t.legalGroup || t.group,
          transactions: []
        };
      }
      catMap[t.category].transactions.push(t);
    }

    return Object.values(catMap).map(cat => {
      const payeeMap = {};
      for (const t of cat.transactions) {
        const p = t.payee;
        if (!payeeMap[p]) {
          payeeMap[p] = {
            name: p,
            total: 0,
            transactions: []
          };
        }
        payeeMap[p].total += t.amount;
        payeeMap[p].transactions.push(t);
      }

      const payees = Object.values(payeeMap).map(p => ({
        name: p.name,
        total: Math.round(p.total * 100) / 100,
        txCount: p.transactions.length,
        transactions: p.transactions
          .map(t => ({
            date: t.date,
            type: t.txnType,
            num: t.docNum,
            memo: t.memo,
            split: t.split,
            amount: t.amount
          }))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
      })).sort((a, b) => b.total - a.total);

      const catTotal = payees.reduce((s, p) => s + p.total, 0);
      const roundedTotal = Math.round(catTotal * 100) / 100;
      const pctOfTotal = totalRef > 0 ? Math.round((roundedTotal / totalRef) * 1000) / 10 : 0;

      return {
        name: cat.name,
        group: cat.group,
        total: roundedTotal,
        pctOfTotal,
        payeeCount: payees.length,
        txCount: cat.transactions.length,
        payees
      };
    }).sort((a, b) => b.total - a.total);
  }

  return {
    id: 'all_ytd',
    monthKey: '2026-YTD',
    monthName: 'All 2026 YTD (Jan – Aug)',
    isPartial: false,
    status: 'Certified Year-to-Date',
    driver: 'All 8 closed operational months reconciled from QuickBooks Online',
    revenue: Math.round(totalRev * 100) / 100,
    total_exp: Math.round(totalExp * 100) / 100,
    net_margin: Math.round((totalRev - totalExp) * 100) / 100,
    totalRevenueTxs: ytdRevTxs.length,
    totalExpenseTxs: ytdExpTxs.length,
    revenueCategories: groupYtd(ytdRevTxs, totalRev),
    expenseCategories: groupYtd(ytdExpTxs, totalExp)
  };
}

monthlyDrilldowns['all_ytd'] = buildYtdRollup();

const outputPayload = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: 'QuickBooks Online General Ledger',
    closedMonthsCount: 8,
    cutoffDate: '2026-08-31',
    totalTransactions: allYearTxs.length,
    periodTitle: '2026 Month-to-Month 3-Level Hierarchical Drilldown'
  },
  months: monthlyDrilldowns
};

const targetFront = path.join(__dirname, '..', 'frontend', 'src', 'data', 'monthly_drilldown_2026.json');
const targetApi = path.join(__dirname, '..', 'api', 'data', 'monthly_drilldown_2026.json');

fs.writeFileSync(targetFront, JSON.stringify(outputPayload, null, 2), 'utf8');
fs.writeFileSync(targetApi, JSON.stringify(outputPayload, null, 2), 'utf8');

console.log(`Saved dataset to:\n  ${targetFront}\n  ${targetApi}`);
console.log(`Total transactions processed: ${allYearTxs.length}`);
console.log(`JSON size: ${Math.round(fs.statSync(targetFront).size / 1024)} KB`);
