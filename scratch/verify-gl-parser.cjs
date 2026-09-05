const fs = require('fs');

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

const EXCLUDE_TOP = new Set([
  'Cash', 'Cash 1 (deleted)', 'First Merchant Bank (deleted)', 'First Merchants Bank',
  'Payments to deposit', 'QuickBooks Tax Holding Account', 'Buildings', 'Buildings-AD',
  'Equipment', 'Equipment-AD', 'Land', 'OFFICE HARDWARE & FURNITURE, DESIGN ITEMS',
  'Investments', 'Accounts Payable (A/P)', 'First Merchants Creditcard',
  'Direct Deposit Payable', 'Lines of credit', 'Payroll Liabilities',
  'Net Assets With Donor Restrictions', 'Net Assets Without Donor Restrictions',
  'Opening balance equity', 'Retained Earnings'
]);

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
        const payee = child.ColData[3]?.value || 'Unspecified';
        const memo = child.ColData[4]?.value || '';
        const split = child.ColData[5]?.value || '';
        const amtStr = child.ColData[6]?.value;

        if (date && amtStr && date !== 'Beginning Balance') {
          // If it's a journal entry with blank payee rebalancing wages, let's keep or skip
          txs.push({
            date,
            txnType,
            docNum,
            payee: payee.trim() || 'General Shelter Operations',
            memo: memo.trim(),
            split: split.trim(),
            amount: parseFloat(amtStr) || 0,
            account: name,
            fullAccount: fullName
          });
        }
      } else if (child.Rows) {
        txs.push(...parseSection(child, name));
      }
    }
  }
  return txs;
}

const pnl = JSON.parse(fs.readFileSync('frontend/src/data/published_2026_ytd.json', 'utf8'));

for (const [mKey, info] of Object.entries(stepsMap)) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${info.step}/output.txt`;
  const gl = JSON.parse(fs.readFileSync(filePath, 'utf8').substring(fs.readFileSync(filePath, 'utf8').indexOf('{')));

  const allTxs = [];
  for (const row of gl.Rows.Row) {
    const acc = row.Header ? row.Header.ColData[0].value : '';
    if (EXCLUDE_TOP.has(acc)) continue;
    allTxs.push(...parseSection(row));
  }

  // Find corresponding month in published_2026_ytd.json
  const stmt = pnl.monthly_statements.find(s => s.id === mKey);

  console.log(`\n=== Month: ${info.name} (Statements total_exp: $${stmt?.total_exp}, revenue: $${stmt?.revenue}) ===`);
  console.log(`Extracted ${allTxs.length} transactions.`);
}
