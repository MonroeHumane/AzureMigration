const fs = require('fs');
const path = require('path');

const stepsMap = {
  'month_2026_0': { id: 'month_2026_0', name: 'Jan 2026', step: 3087 },
  'month_2026_1': { id: 'month_2026_1', name: 'Feb 2026', step: 3089 },
  'month_2026_2': { id: 'month_2026_2', name: 'Mar 2026', step: 3091 },
  'month_2026_3': { id: 'month_2026_3', name: 'Apr 2026', step: 3093 },
  'month_2026_4': { id: 'month_2026_4', name: 'May 2026', step: 3095 },
  'month_2026_5': { id: 'month_2026_5', name: 'Jun 2026', step: 3097 },
  'month_2026_6': { id: 'month_2026_6', name: 'Jul 2026', step: 3099 },
  'month_2026_7': { id: 'month_2026_7', name: 'Aug 2026', step: 3069 },
};

// Target revenue and expense categories based on our P&L mapping
const EXCLUDE_TOP_ACCOUNTS = new Set([
  'Cash', 'Cash 1 (deleted)', 'First Merchant Bank (deleted)', 'First Merchants Bank',
  'Payments to deposit', 'QuickBooks Tax Holding Account', 'Buildings', 'Buildings-AD',
  'Equipment', 'Equipment-AD', 'Land', 'OFFICE HARDWARE & FURNITURE, DESIGN ITEMS',
  'Investments', 'Accounts Payable (A/P)', 'First Merchants Creditcard',
  'Direct Deposit Payable', 'Lines of credit', 'Net Assets With Donor Restrictions',
  'Net Assets Without Donor Restrictions', 'Opening balance equity', 'Retained Earnings'
]);

function extractTxFromAccount(accRow, parentName = '') {
  const accName = accRow.Header ? accRow.Header.ColData[0].value : '';
  const fullName = parentName ? `${parentName}: ${accName}` : accName;
  const results = [];

  if (accRow.Rows && accRow.Rows.Row) {
    for (const child of accRow.Rows.Row) {
      if (child.ColData) {
        const date = child.ColData[0]?.value;
        const txnType = child.ColData[1]?.value || '';
        const docNum = child.ColData[2]?.value || '';
        const name = child.ColData[3]?.value || 'Unspecified';
        const memo = child.ColData[4]?.value || '';
        const split = child.ColData[5]?.value || '';
        const amtStr = child.ColData[6]?.value;

        if (date && amtStr && date !== 'Beginning Balance') {
          const amt = parseFloat(amtStr) || 0;
          results.push({
            date,
            txnType,
            docNum,
            payee: name.trim() || 'Unspecified',
            memo: memo.trim(),
            split: split.trim(),
            amount: Math.abs(amt),
            rawAmount: amt,
            account: accName,
            fullAccount: fullName
          });
        }
      } else if (child.Rows) {
        results.push(...extractTxFromAccount(child, accName));
      }
    }
  }
  return results;
}

const allMonthsData = {};

for (const [monthKey, info] of Object.entries(stepsMap)) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${info.step}/output.txt`;
  const content = fs.readFileSync(filePath, 'utf8');
  const gl = JSON.parse(content.substring(content.indexOf('{')));

  const monthCategories = {};

  for (const row of gl.Rows.Row) {
    const accName = row.Header ? row.Header.ColData[0].value : '';
    if (EXCLUDE_TOP_ACCOUNTS.has(accName)) continue;
    if (accName === 'Payroll Liabilities') continue; // Balance sheet liability

    const txs = extractTxFromAccount(row);
    if (txs.length > 0) {
      // Group by account
      for (const t of txs) {
        const cat = t.account;
        if (!monthCategories[cat]) {
          monthCategories[cat] = {
            name: cat,
            fullAccount: t.fullAccount,
            transactions: []
          };
        }
        monthCategories[cat].transactions.push(t);
      }
    }
  }

  // Group transactions in each category by payee/entity
  const categorized = Object.values(monthCategories).map(cat => {
    const payeeMap = {};
    for (const tx of cat.transactions) {
      const p = tx.payee || 'Unspecified';
      if (!payeeMap[p]) {
        payeeMap[p] = {
          name: p,
          total: 0,
          transactions: []
        };
      }
      payeeMap[p].total += tx.amount;
      payeeMap[p].transactions.push(tx);
    }

    const payees = Object.values(payeeMap).map(p => ({
      name: p.name,
      total: Math.round(p.total * 100) / 100,
      txCount: p.transactions.length,
      transactions: p.transactions.sort((a, b) => new Date(b.date) - new Date(a.date))
    })).sort((a, b) => b.total - a.total);

    const total = payees.reduce((s, p) => s + p.total, 0);

    return {
      category: cat.name,
      total: Math.round(total * 100) / 100,
      txCount: cat.transactions.length,
      payeeCount: payees.length,
      payees
    };
  }).sort((a, b) => b.total - a.total);

  allMonthsData[monthKey] = {
    month: info.name,
    categoriesCount: categorized.length,
    totalTxs: categorized.reduce((s, c) => s + c.txCount, 0),
    categories: categorized
  };
}

console.log('Month Extraction Summary:');
for (const [k, m] of Object.entries(allMonthsData)) {
  console.log(`${m.month}: ${m.categoriesCount} categories, ${m.totalTxs} transactions`);
  m.categories.slice(0, 3).forEach(c => {
    console.log(`  * ${c.category}: $${c.total.toLocaleString()} across ${c.payeeCount} payees (${c.txCount} txs)`);
    console.log(`      Top payee: ${c.payees[0]?.name} ($${c.payees[0]?.total.toLocaleString()})`);
  });
}
