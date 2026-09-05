const fs = require('fs');
const path = require('path');

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
  'Salaries & Wages-1': { name: 'Caregiver Salaries & Wages', group: 'Personnel & Staffing', icon: '💰' },
  'Salaries & Wages': { name: 'Caregiver Salaries & Wages', group: 'Personnel & Staffing', icon: '💰' },
  'Payroll Taxes': { name: 'Payroll Taxes', group: 'Personnel & Staffing', icon: '🏛️' },
  'Workplace Injury & Medical Care': { name: 'Workplace Injury Care', group: 'Personnel & Staffing', icon: '🩹' },
  'Staff & Volunteer Appreciation Meals': { name: 'Staff & Volunteer Meals', group: 'Personnel & Staffing', icon: '🍱' },
  'Animal Care Supplies': { name: 'Animal Care Supplies & Food', group: 'Shelter Operations', icon: '🐾' },
  'Facility & Cleaning Supplies': { name: 'Facility & Cleaning Supplies', group: 'Shelter Operations', icon: '🧹' },
  'General Shelter Supplies': { name: 'General Shelter Supplies', group: 'Shelter Operations', icon: '📦' },
  'Laundry & Sanitation Services': { name: 'Laundry & Sanitation Services', group: 'Shelter Operations', icon: '🧺' },
  'Microchips & Registries': { name: 'Microchips & Registries', group: 'Shelter Operations', icon: '🏷️' },
  'Adoption Fee Refunds & Returns': { name: 'Adoption Fee Refunds & Returns', group: 'Shelter Operations', icon: '↩️' },
  'Building Repairs': { name: 'Building Repairs & Maintenance', group: 'Shelter Operations', icon: '🔧' },
  'Cleaning': { name: 'Facility Deep Cleaning', group: 'Shelter Operations', icon: '🧼' },
  'Emergency & Specialty Care': { name: 'Emergency & Specialty Veterinary', group: 'Veterinary & Medical Care', icon: '🚑' },
  'Medications & Vaccines': { name: 'Medications & Vaccines', group: 'Veterinary & Medical Care', icon: '💊' },
  'Primary Care & Wellness': { name: 'Primary Care & Wellness Clinics', group: 'Veterinary & Medical Care', icon: '🩺' },
  'Spay & Neuter Program': { name: 'Spay & Neuter Program', group: 'Veterinary & Medical Care', icon: '✂️' },
  'Vendor Rebates & Credits': { name: 'Medical Vendor Rebates', group: 'Veterinary & Medical Care', icon: '🏷️' },
  'Gas': { name: 'Rescue Van Fuel & Transit', group: 'Vehicle Expenses', icon: '🚐' },
  'Vehicle Repairs & Maintenance': { name: 'Vehicle Repairs & Maintenance', group: 'Vehicle Expenses', icon: '🔩' },
  'Liability insurance': { name: 'Shelter Property & Liability Insurance', group: 'Insurance & Risk', icon: '🛡️' },
  'Software & Apps': { name: 'Software & Cloud Apps', group: 'Office & Admin', icon: '💻' },
  'Equipment Lease & Maintenance': { name: 'Equipment Lease & Maintenance', group: 'Office & Admin', icon: '🖨️' },
  'Office Supplies': { name: 'Office Supplies', group: 'Office & Admin', icon: '📎' },
  'Printing & Photocopying': { name: 'Printing & Photocopying', group: 'Office & Admin', icon: '📄' },
  'Shipping & Postage': { name: 'Shipping & Postage', group: 'Office & Admin', icon: '✉️' },
  'Bank Fees & Service Charges': { name: 'Bank & Account Fees', group: 'Financial Operations', icon: '🏦' },
  'Merchant Account Fees': { name: 'Merchant Gateway & Card Fees', group: 'Financial Operations', icon: '💳' },
  'Fundraising fees': { name: 'Fundraising Platform Fees', group: 'Financial Operations', icon: '🎗️' },
  'Promotional Items': { name: 'Promotional Items & Outreach', group: 'Marketing & Outreach', icon: '📣' },
  'Special Events & Gala Expenses': { name: 'Special Events & Gala Expenses', group: 'Fundraising & Events', icon: '🎉' },
  // Revenue
  'Donations directed by individuals': { name: 'Individual Donor Contributions', group: 'Contributed Income', icon: '🤝' },
  'Corporate Donations': { name: 'Corporate Donations', group: 'Contributed Income', icon: '🏢' },
  'Donation Canisters (Dog Banks)': { name: 'Canister & Community Coin Banks', group: 'Contributed Income', icon: '🪙' },
  'Cat Room Expansion Fund': { name: 'Cat Room Expansion Fund', group: 'Contributed Income', icon: '🐱' },
  'Foundation Grants': { name: 'Foundation Grants', group: 'Contributed Income', icon: '🏛️' },
  'Government grants & contracts': { name: 'Municipal Contracts & Grants', group: 'Contributed Income', icon: '📜' },
  'Grants from other nonprofits': { name: 'Grants from Other Nonprofits', group: 'Contributed Income', icon: '🎗️' },
  'Memorial Donations': { name: 'Memorial Donations', group: 'Contributed Income', icon: '💐' },
  'Animal Adoptions': { name: 'Animal Adoption Fees', group: 'Earned Revenue', icon: '🐶' },
  'cremation': { name: 'Pet Cremation Services', group: 'Earned Revenue', icon: '🕊️' },
  'Event Donation': { name: 'Event Proceeds & Ticket Donations', group: 'Earned Revenue', icon: '🎟️' },
  'Merchandise Sales (Swag)': { name: 'Merchandise & Swag Sales', group: 'Earned Revenue', icon: '👕' },
  'Bottle & Can Recycling Revenue': { name: 'Bottle & Can Recycling Proceeds', group: 'Community Support', icon: '♻️' },
  'Court Restitution': { name: 'Court Restitution', group: 'Community Support', icon: '⚖️' },
  'Quarterly Endowment Distributions': { name: 'Community Foundation Endowment Grants', group: 'Endowment Support', icon: '🌳' },
  'Retail Partner Rebates': { name: 'Retail Partner Rebates (Kroger/Meijer)', group: 'Community Support', icon: '🛒' },
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

function isRevenueAccount(accName, parentName) {
  if (REVENUE_ACCOUNTS.has(accName) || REVENUE_ACCOUNTS.has(parentName)) return true;
  const l = (accName + ' ' + parentName).toLowerCase();
  return l.includes('donation') || l.includes('endowment') || l.includes('recycling') ||
         l.includes('adoption') || l.includes('rebate') || l.includes('grant') || l.includes('swag');
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
        const docNum = child.ColData[2]?.value || '';
        const payee = child.ColData[3]?.value || '';
        const memo = child.ColData[4]?.value || '';
        const split = child.ColData[5]?.value || '';
        const amtStr = child.ColData[6]?.value;

        if (date && amtStr && date !== 'Beginning Balance') {
          let cleanPayee = payee.trim();
          if (!cleanPayee) {
            if (txnType === 'Journal Entry') cleanPayee = 'QuickBooks Journal Adjustment';
            else if (txnType === 'Sales Receipt') cleanPayee = 'Public / Shelter Adopters';
            else if (txnType === 'Deposit') cleanPayee = 'Branch Deposit Batch';
            else cleanPayee = 'Shelter Operational Incurred';
          }

          const rawAmt = parseFloat(amtStr) || 0;
          const isRev = isRevenueAccount(name, parentName);
          const meta = ACCOUNT_NORMALIZATION[name] || { name, group: parentName || (isRev ? 'Revenue' : 'Expenses'), icon: isRev ? '💵' : '💸' };

          txs.push({
            date,
            txnType,
            docNum: docNum.trim(),
            payee: cleanPayee,
            memo: memo.trim(),
            split: split.trim(),
            amount: Math.abs(rawAmt),
            rawAmount: rawAmt,
            category: meta.name,
            group: meta.group,
            icon: meta.icon,
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
          group: t.group,
          icon: t.icon,
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
        icon: cat.icon,
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
          group: t.group,
          icon: t.icon,
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
        icon: cat.icon,
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
