const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, '..', 'frontend', 'dist', 'internal', 'board', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const checks = [
  { name: 'MonthlyStatementTable root', pass: html.includes('id="monthly-statement-root"') },
  { name: 'August drawer exists', pass: html.includes('id="drawer-month_2026_7"') },
  { name: 'January drawer exists', pass: html.includes('id="drawer-month_2026_0"') },
  { name: 'Level 1 category toggle buttons', pass: html.includes('cat-toggle-btn') },
  { name: 'Level 2 payee toggle buttons', pass: html.includes('payee-toggle-btn') },
  { name: 'Drawer search input', pass: html.includes('drawer-search-input') },
  { name: 'Jump to Explorer buttons', pass: html.includes('jump-to-explorer-btn') },
  { name: 'ExpenseExplorer Month selector buttons', pass: html.includes('ee-period-btn') },
  { name: 'ExpenseExplorer Period tabs (Aug, Jul, ...)', pass: html.includes('data-month-id="month_2026_7"') && html.includes('data-month-id="all_ytd"') },
  { name: 'Caregiver Salaries & Wages present', pass: html.includes('Caregiver Salaries & Wages') },
  { name: 'Spay & Neuter Program present', pass: html.includes('Spay & Neuter Program') },
  { name: 'Humane Ohio present', pass: html.includes('Humane Ohio') },
  { name: 'AMY CUNNINGHAM-SHINAULT present', pass: html.includes('AMY CUNNINGHAM-SHINAULT') },
  { name: 'sec-balance NOT present', pass: !html.includes('id="sec-balance"') },
  { name: 'sec-governance NOT present', pass: !html.includes('id="sec-governance"') },
  { name: 'sec-strategy NOT present', pass: !html.includes('id="sec-strategy"') },
];

console.log('=== Static Build Verification Results ===');
let allPassed = true;
checks.forEach(c => {
  console.log((c.pass ? '✓ PASS' : '✗ FAIL') + ' - ' + c.name);
  if (!c.pass) allPassed = false;
});
if (allPassed) {
  console.log('\nAll 16/16 verification checks passed with 100% success!');
} else {
  console.error('\nSome checks failed!');
  process.exit(1);
}
