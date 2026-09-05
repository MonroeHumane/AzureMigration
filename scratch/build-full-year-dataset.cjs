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

// Clean alias mappings
const ACCOUNT_NORMALIZATION = {
  'Salaries & Wages-1': 'Caregiver Salaries & Wages',
  'Salaries & Wages': 'Caregiver Salaries & Wages',
  'Donations directed by individuals': 'Individual Donor Contributions',
  'Animal Care Supplies': 'Animal Care Supplies & Food',
  'Gas': 'Rescue Van Fuel & Transit',
  'Liability insurance': 'Shelter Property & Liability Insurance',
  'Workplace Injury & Medical Care': 'Workplace Injury Care',
  'Staff & Volunteer Appreciation Meals': 'Staff & Volunteer Appreciation Meals',
  'Promotional Items': 'Promotional Items',
  'Special Events & Gala Expenses': 'Special Events & Gala Expenses',
  'Building Repairs': 'Building Repairs & Maintenance',
  'Cleaning': 'Facility Cleaning Services',
  'General Shelter Supplies': 'General Shelter Supplies',
  'Adoption Fee Refunds & Returns': 'Adoption Fee Refunds & Returns',
  'Equipment Lease & Maintenance': 'Equipment Lease & Maintenance',
  'Laundry & Sanitation Services': 'Laundry & Sanitation Services',
  'Microchips & Registries': 'Microchips & Pet Registries',
  'Printing & Photocopying': 'Printing & Photocopying',
  'Shipping & Postage': 'Shipping & Postage',
  'Software & Apps': 'Software & Cloud Apps',
  'Bank Fees & Service Charges': 'Bank Fees & Service Charges',
  'Merchant Account Fees': 'Merchant Account Fees',
  'Fundraising fees': 'Fundraising Processing Fees',
  'Vehicle Repairs & Maintenance': 'Vehicle Repairs & Maintenance',
  'Office Supplies': 'Office Supplies',
  'Emergency & Specialty Care': 'Emergency & Specialty Care',
  'Medications & Vaccines': 'Medications & Vaccines',
  'Primary Care & Wellness': 'Primary Care & Wellness',
  'Spay & Neuter Program': 'Spay & Neuter Program',
  'Vendor Rebates & Credits': 'Vendor Rebates & Credits',
  'Bottle & Can Recycling Revenue': 'Bottle & Can Recycling Revenue',
  'Court Restitution': 'Court Restitution',
  'Quarterly Endowment Distributions': 'Quarterly Endowment Distributions',
  'Retail Partner Rebates': 'Retail Partner Rebates',
  'Animal Adoptions': 'Animal Adoptions',
  'Corporate Donations': 'Corporate Donations',
  'Donation Canisters (Dog Banks)': 'Canister & Community Coin Banks',
  'Cat Room Expansion Fund': 'Cat Room Expansion Fund',
  'Foundation Grants': 'Foundation Grants',
  'Government grants & contracts': 'Municipal Contracts & Grants',
  'Grants from other nonprofits': 'Grants from Other Nonprofits',
  'Memorial Donations': 'Memorial Donations',
  'Event Donation': 'Event Donation',
  'Merchandise Sales (Swag)': 'Merchandise Sales (Swag)',
};

const REVENUE_ACCOUNTS = new Set([
  'Animal Adoptions', 'Contributed income', 'Corporate Donations', 'Donation Canisters (Dog Banks)',
  'Cat Room Expansion Fund', 'Donations directed by individuals', 'Foundation Grants',
  'Government grants & contracts', 'Grants from other nonprofits', 'Memorial Donations',
  'cremation', 'Event Donation', 'Merchandise Sales (Swag)', 'Bottle & Can Recycling Revenue',
  'Court Restitution', 'Quarterly Endowment Distributions', 'Retail Partner Rebates',
  'Individual Donor Contributions', 'Canister & Community Coin Banks', 'Municipal Contracts & Grants',
  'Grants from Other Nonprofits'
]);

function isRevenueAccount(accName, parentName) {
  if (REVENUE_ACCOUNTS.has(accName) || REVENUE_ACCOUNTS.has(parentName)) return true;
  if (accName.toLowerCase().includes('donation') || accName.toLowerCase().includes('endowment') ||
      accName.toLowerCase().includes('recycling') || accName.toLowerCase().includes('adoption') ||
      accName.toLowerCase().includes('rebate') || accName.toLowerCase().includes('grant')) {
    return true;
  }
  return false;
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
          // If journal entry has empty payee, categorize nicely
          let cleanPayee = payee.trim();
          if (!cleanPayee) {
            if (txnType === 'Journal Entry') cleanPayee = 'QuickBooks Journal Adjustment';
            else if (txnType === 'Sales Receipt') cleanPayee = 'Public / Shelter Adopter';
            else if (txnType === 'Deposit') cleanPayee = 'Bank Branch Batch Deposit';
            else cleanPayee = 'Direct Operations';
          }

          const rawAmt = parseFloat(amtStr) || 0;
          const isRev = isRevenueAccount(name, parentName);

          txs.push({
            date,
            txnType,
            docNum: docNum.trim(),
            payee: cleanPayee,
            memo: memo.trim(),
            split: split.trim(),
            amount: Math.abs(rawAmt),
            rawAmount: rawAmt,
            account: ACCOUNT_NORMALIZATION[name] || name,
            parentAccount: parentName,
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

const fullYearDataset = {};

for (const m of stepsMap) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${m.step}/output.txt`;
  const gl = JSON.parse(fs.readFileSync(filePath, 'utf8').substring(fs.readFileSync(filePath, 'utf8').indexOf('{')));

  const rawTxs = [];
  for (const row of gl.Rows.Row) {
    const acc = row.Header ? row.Header.ColData[0].value : '';
    if (EXCLUDE_TOP.has(acc)) continue;
    rawTxs.push(...parseSection(row));
  }

  // Filter out the zero-net wage reclassification journal entries if any
  // In August: rows with docNum PAYROLL-CLASS-2026 net to 0
  const filteredTxs = rawTxs.filter(t => {
    if (t.docNum === 'PAYROLL-CLASS-2026') return false; // Reclass journal entry
    return true;
  });

  const revTxs = filteredTxs.filter(t => t.isRevenue);
  const expTxs = filteredTxs.filter(t => !t.isRevenue);

  function groupTxs(txList) {
    const catMap = {};
    for (const t of txList) {
      const cat = t.account;
      if (!catMap[cat]) {
        catMap[cat] = {
          name: cat,
          parent: t.parentAccount,
          transactions: []
        };
      }
      catMap[cat].transactions.push(t);
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
        transactions: p.transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
      })).sort((a, b) => b.total - a.total);

      const total = payees.reduce((s, p) => s + p.total, 0);

      return {
        name: cat.name,
        parent: cat.parent,
        total: Math.round(total * 100) / 100,
        txCount: cat.transactions.length,
        payeeCount: payees.length,
        payees
      };
    }).sort((a, b) => b.total - a.total);
  }

  fullYearDataset[m.id] = {
    id: m.id,
    monthKey: m.key,
    monthName: m.name,
    totalRevenueTxs: revTxs.length,
    totalExpenseTxs: expTxs.length,
    revenueCategories: groupTxs(revTxs),
    expenseCategories: groupTxs(expTxs)
  };
}

const jsonOut = JSON.stringify(fullYearDataset);
console.log('Complete dataset compiled successfully!');
console.log('Total JSON size: ' + Math.round(jsonOut.length / 1024) + ' KB');

// Check August
const aug = fullYearDataset['month_2026_7'];
console.log('\nAugust Revenue Categories:', aug.revenueCategories.length, 'Total Rev:', aug.revenueCategories.reduce((s, c) => s + c.total, 0));
console.log('August Expense Categories:', aug.expenseCategories.length, 'Total Exp:', aug.expenseCategories.reduce((s, c) => s + c.total, 0));
aug.expenseCategories.slice(0, 5).forEach(c => {
  console.log(`  - ${c.name}: $${c.total.toLocaleString()} (${c.payeeCount} payees, ${c.txCount} txs)`);
});
