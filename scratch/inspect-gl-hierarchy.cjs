const fs = require('fs');

const content = fs.readFileSync('C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/3069/output.txt', 'utf8');
const data = JSON.parse(content.substring(content.indexOf('{')));

function dumpAccounts(rows, depth = 0) {
  for (const r of rows) {
    if (r.Header) {
      const name = r.Header.ColData[0].value;
      let txCount = 0;
      let amountSum = 0;
      if (r.Rows && r.Rows.Row) {
        for (const child of r.Rows.Row) {
          if (child.ColData) {
            const date = child.ColData[0]?.value;
            const amtStr = child.ColData[6]?.value;
            if (date && amtStr && date !== 'Beginning Balance') {
              txCount++;
              amountSum += parseFloat(amtStr) || 0;
            }
          }
        }
      }
      console.log('  '.repeat(depth) + `[Header] ${name} (direct txs: ${txCount}, direct sum: $${amountSum.toFixed(2)})`);
      if (r.Rows && r.Rows.Row) {
        dumpAccounts(r.Rows.Row, depth + 1);
      }
    }
  }
}

console.log('--- Account Hierarchy in August GL ---');
dumpAccounts(data.Rows.Row);
