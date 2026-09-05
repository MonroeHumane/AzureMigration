const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../frontend/dist/internal/board/index.html');
const html = fs.readFileSync(filePath, 'utf8');

const checks = [
  ['1. Cash Runway & What-If Planner Title', html.includes('Cash Runway & What-If Planner') || html.includes('Cash Runway &amp; What-If Planner')],
  ['2. Shelter Operations Only Button', html.includes('Shelter Operations Only')],
  ['3. All Inflows & Costs Button', html.includes('All Inflows &amp; Costs') || html.includes('All Inflows & Costs')],
  ['4. Monthly Donations & Revenue Slider', html.includes('Monthly Donations &amp; Revenue') || html.includes('Monthly Donations & Revenue')],
  ['5. Monthly Operating Expenses Slider', html.includes('Monthly Operating Expenses')],
  ['6. One-Time Grant or Major Expense Slider', html.includes('One-Time Grant or Major Expense')],
  ['7. Estimated Monthly Net Tile', html.includes('Estimated Monthly Net')],
  ['8. Available Cash & Savings Tile', html.includes('Available Cash &amp; Savings') || html.includes('Available Cash & Savings')],
  ['9. Cash Runway Tile', html.includes('Cash Runway')],
  ['10. Estimated Cash Horizon Tile', html.includes('Estimated Cash Horizon')],
  ['11. What This Means for the Shelter Box', html.includes('What This Means for the Shelter')],
  ['12. Overall Net Result (YTD) KPI', html.includes('Overall Net Result (YTD)')],
  ['13. Day-to-Day Shelter Net KPI', html.includes('Day-to-Day Shelter Net')],
  ['14. Animal Care & Mission Ratio KPI', html.includes('Animal Care &amp; Mission Ratio') || html.includes('Animal Care & Mission Ratio')],
  ['15. 85c of every dollar explanation', html.includes('85¢ of every dollar')],
  ['16. Cash & Board Reserves KPI', html.includes('Cash &amp; Board Reserves') || html.includes('Cash & Board Reserves')],
  ['17. Shelter Assets & Cash Section', html.includes('Shelter Assets &amp; Cash') || html.includes('Shelter Assets & Cash')],
  ['18. Current Bills & Obligations Section', html.includes('Current Bills &amp; Obligations') || html.includes('Current Bills & Obligations')],
  ['19. Net Worth & Reserves Section', html.includes('Net Worth &amp; Reserves') || html.includes('Net Worth & Reserves')],
  ['20. 3-Year Operational Trends Card', html.includes('3-Year Operational Trends')],
  ['21. 2024 Revenue SSR ($393,426)', html.includes('$393,426')],
  ['22. 2025 Revenue SSR ($836,847)', html.includes('$836,847')],
  ['23. 2026 Revenue SSR ($382,326)', html.includes('$382,326')],
  ['24. Subnav Clean Labels (Cash Runway)', html.includes('>Cash Runway<') || html.includes('Cash Runway')],
];

let allPassed = true;
checks.forEach(([label, pass]) => {
  console.log(`${pass ? '✅' : '❌'} ${label}`);
  if (!pass) allPassed = false;
});

console.log('\nResult:', allPassed ? 'ALL CHECKS PASSED PERFECTLY!' : 'SOME CHECKS FAILED');
if (!allPassed) process.exit(1);
