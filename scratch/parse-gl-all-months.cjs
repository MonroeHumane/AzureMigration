const fs = require('fs');
const path = require('path');

const stepsMap = {
  'month_2026_0': { name: 'Jan 2026', step: 3087 },
  'month_2026_1': { name: 'Feb 2026', step: 3089 },
  'month_2026_2': { name: 'Mar 2026', step: 3091 },
  'month_2026_3': { name: 'Apr 2026', step: 3093 },
  'month_2026_4': { name: 'May 2026', step: 3095 },
  'month_2026_5': { name: 'Jun 2026', step: 3097 },
  'month_2026_6': { name: 'Jul 2026', step: 3099 },
  'month_2026_7': { name: 'Aug 2026', step: 3069 },
};

function parseGL(step) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${step}/output.txt`;
  if (!fs.existsSync(filePath)) {
    console.error('File missing:', filePath);
    return null;
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const jsonStr = content.substring(content.indexOf('{'));
  return JSON.parse(jsonStr);
}

for (const [monthId, info] of Object.entries(stepsMap)) {
  const gl = parseGL(info.step);
  console.log(`\n=== ${info.name} (Step ${info.step}) ===`);
  if (!gl || !gl.Rows || !gl.Rows.Row) {
    console.log('No rows');
    continue;
  }

  let totalTxCount = 0;
  let accountsFound = 0;

  function countRows(row) {
    let count = 0;
    if (row.Rows && row.Rows.Row) {
      for (const child of row.Rows.Row) {
        if (child.ColData) {
          const type = child.ColData[1] ? child.ColData[1].value : '';
          if (type !== 'Beginning Balance' && child.ColData[0]?.value) {
            count++;
          }
        } else if (child.Rows) {
          count += countRows(child);
        }
      }
    }
    return count;
  }

  for (const accRow of gl.Rows.Row) {
    const accName = accRow.Header ? accRow.Header.ColData[0].value : 'Unknown';
    const txCount = countRows(accRow);
    if (txCount > 0) {
      accountsFound++;
      totalTxCount += txCount;
    }
  }

  console.log(`Accounts with activity: ${accountsFound}, Total Transactions: ${totalTxCount}`);
}
