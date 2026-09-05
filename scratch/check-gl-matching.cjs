const fs = require('fs');

const pnl = JSON.parse(fs.readFileSync('frontend/src/data/published_2026_ytd.json', 'utf8'));

const stepsMap = {
  'month_2026_0': 3087,
  'month_2026_1': 3089,
  'month_2026_2': 3091,
  'month_2026_3': 3093,
  'month_2026_4': 3095,
  'month_2026_5': 3097,
  'month_2026_6': 3099,
  'month_2026_7': 3069,
};

// Aliases mapping GL account names to P&L item names
const ACCOUNT_TO_ITEM_NAME = {
  'Salaries & Wages-1': 'Caregiver Salaries & Wages',
  'Salaries & Wages': 'Caregiver Salaries & Wages',
  'Donations directed by individuals': 'Individual Donor Contributions',
  'Animal Care Supplies': 'Animal Care Supplies & Food',
  'Gas': 'Rescue Van Fuel & Transit',
  'Liability insurance': 'Shelter Property & Liability Insurance',
  'Workplace Injury & Medical Care': 'Caregiver Salaries & Wages', // or separate
};

function normalizeName(acc) {
  return ACCOUNT_TO_ITEM_NAME[acc] || acc;
}

for (const stmt of pnl.monthly_statements) {
  const step = stepsMap[stmt.id];
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${step}/output.txt`;
  const gl = JSON.parse(fs.readFileSync(filePath, 'utf8').substring(fs.readFileSync(filePath, 'utf8').indexOf('{')));

  console.log(`\n================ ${stmt.month} ================`);
  // Let's check which exp_items match
  const glAccountsFound = new Set();

  function scanRows(row, parent = '') {
    const acc = row.Header ? row.Header.ColData[0].value : '';
    if (row.Rows && row.Rows.Row) {
      for (const c of row.Rows.Row) {
        if (c.ColData && c.ColData[0]?.value && c.ColData[0]?.value !== 'Beginning Balance') {
          glAccountsFound.add(acc);
        } else if (c.Rows) {
          scanRows(c, acc);
        }
      }
    }
  }

  for (const r of gl.Rows.Row) {
    scanRows(r);
  }

  const expNames = stmt.exp_items.map(i => i.name);
  let matched = 0;
  for (const exp of expNames) {
    // Check if found in glAccounts
    let found = false;
    for (const glAcc of glAccountsFound) {
      if (normalizeName(glAcc) === exp || glAcc === exp) {
        found = true;
        break;
      }
    }
    if (found) matched++;
    else console.log(`  Not found in GL: [${exp}]`);
  }
  console.log(`Matched ${matched} / ${expNames.length} exp_items`);
}
