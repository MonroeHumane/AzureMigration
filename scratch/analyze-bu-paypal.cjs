const fs = require('fs');

const stepsMap = [
  { key: '2026-01', name: 'Jan 2026', step: 3087 },
  { key: '2026-02', name: 'Feb 2026', step: 3089 },
  { key: '2026-03', name: 'Mar 2026', step: 3091 },
  { key: '2026-04', name: 'Apr 2026', step: 3093 },
  { key: '2026-05', name: 'May 2026', step: 3095 },
  { key: '2026-06', name: 'Jun 2026', step: 3097 },
  { key: '2026-07', name: 'Jul 2026', step: 3099 },
  { key: '2026-08', name: 'Aug 2026', step: 3069 },
];

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
          txs.push({
            account: fullName,
            date,
            txnType,
            docNum,
            payee,
            memo,
            split,
            amount: parseFloat(amtStr) || 0
          });
        }
      } else if (child.Rows) {
        txs.push(...parseSection(child, fullName));
      }
    }
  }
  return txs;
}

const allRows = [];
for (const m of stepsMap) {
  const filePath = `C:/Users/Jeff/.gemini/antigravity-ide/brain/6aff21a2-4d8c-4461-bc9b-88e5b3c9e9bd/.system_generated/steps/${m.step}/output.txt`;
  const txt = fs.readFileSync(filePath, 'utf8');
  const gl = JSON.parse(txt.substring(txt.indexOf('{')));

  for (const row of gl.Rows.Row) {
    const accTxs = parseSection(row);
    accTxs.forEach(t => t.month = m.name);
    allRows.push(...accTxs);
  }
}

console.log('Total GL Rows parsed:', allRows.length);

const buRows = allRows.filter(r => (r.payee + ' ' + r.memo).toLowerCase().includes('better'));
const ppRows = allRows.filter(r => (r.payee + ' ' + r.memo + ' ' + r.split + ' ' + r.account).toLowerCase().includes('paypal'));
const zeffyRows = allRows.filter(r => (r.payee + ' ' + r.memo).toLowerCase().includes('zeffy'));

console.log('BetterUnite Rows:', buRows.length);
console.log('PayPal Rows:', ppRows.length);
console.log('Zeffy Rows:', zeffyRows.length);

console.log('\n--- PAYPAL TRANSACTIONS (Total: ' + ppRows.length + ') ---');
ppRows.forEach(r => {
  console.log(`${r.month} | ${r.date} | ${r.account} | ${r.txnType} | Payee: [${r.payee}] | Memo: [${r.memo}] | $${r.amount}`);
});

console.log('\n--- BETTERUNITE SUMMARY ---');
let buWithDonor = 0;
let buLumpSum = 0;
let buOther = 0;
const buDonors = new Set();

buRows.forEach(r => {
  if (r.memo.includes('Donor:')) {
    buWithDonor++;
    const match = r.memo.match(/Donor:\s*([^|]+)/);
    if (match) buDonors.add(match[1].trim());
  } else if (r.memo.toLowerCase().includes('betterunite payo') || r.memo.toLowerCase().includes('payout')) {
    buLumpSum++;
  } else {
    buOther++;
  }
});

console.log(`BU transactions with donor in memo: ${buWithDonor} (unique donor names in memo: ${buDonors.size})`);
console.log(`BU lump sum payout rows: ${buLumpSum}`);
console.log(`BU other rows: ${buOther}`);

console.log('\n--- SAMPLE BETTERUNITE WITH DONOR IN MEMO ---');
buRows.filter(r => r.memo.includes('Donor:')).slice(0, 10).forEach(r => {
  console.log(`${r.month} | ${r.date} | ${r.account} | Payee: [${r.payee}] | Memo: [${r.memo}] | $${r.amount}`);
});

console.log('\n--- SAMPLE BETTERUNITE LUMP SUMS ---');
buRows.filter(r => !r.memo.includes('Donor:')).slice(0, 10).forEach(r => {
  console.log(`${r.month} | ${r.date} | ${r.account} | Payee: [${r.payee}] | Memo: [${r.memo}] | $${r.amount}`);
});

console.log('\n--- ZEFFY TRANSACTIONS ---');
zeffyRows.forEach(r => {
  console.log(`${r.month} | ${r.date} | ${r.account} | Payee: [${r.payee}] | Memo: [${r.memo}] | $${r.amount}`);
});
