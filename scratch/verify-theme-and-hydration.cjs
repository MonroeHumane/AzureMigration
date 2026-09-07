const fs = require('fs');
const path = require('path');

console.log('--- AUDITING THEME COLOR ALIGNMENT & CLIENT HYDRATION ---');

let errors = 0;
let passes = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passes++;
  } else {
    console.error(`[FAIL] ${message}`);
    errors++;
  }
}

// 1. Content Manager Hydration & Theme
const contentPagePath = path.join(__dirname, '..', 'frontend', 'src', 'pages', 'internal', 'content', 'index.astro');
const contentContent = fs.readFileSync(contentPagePath, 'utf8');

assert(contentContent.includes('function initContentManager()'), 'content/index.astro defines initContentManager function');
assert(contentContent.includes("document.addEventListener('astro:page-load', initContentManager)"), 'content/index.astro listens to astro:page-load');
assert(contentContent.includes('window.initMCHSContentManager = initContentManager'), 'content/index.astro exposes window.initMCHSContentManager');
assert(!contentContent.includes('bg-[#c2410c]'), 'content/index.astro removed rusty orange bg-[#c2410c] buttons');
assert(contentContent.includes('bg-[#173a39]'), 'content/index.astro uses signature Monroe pine teal bg-[#173a39]');

// 2. Donor Roster Hydration & Brand Theme
const donorTablePath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'donors', 'DonorRosterTable.astro');
const donorTableContent = fs.readFileSync(donorTablePath, 'utf8');

assert(donorTableContent.includes('window.setHSMCDonors = setDonors'), 'DonorRosterTable exposes window.setHSMCDonors');
assert(donorTableContent.includes("window.addEventListener('donors-hydrated'"), 'DonorRosterTable listens to donors-hydrated event');
assert(donorTableContent.includes("document.addEventListener('astro:page-load'"), 'DonorRosterTable listens to astro:page-load');
assert(donorTableContent.includes('window.__HSMC_DONORS__'), 'DonorRosterTable reads existing window.__HSMC_DONORS__');

// 3. Monthly Statement Table Cross-Reference Theme
const statementTablePath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'board', 'MonthlyStatementTable.astro');
const statementContent = fs.readFileSync(statementTablePath, 'utf8');

assert(!statementContent.includes('text-rose-900 border border-rose-200 hover:bg-rose-50'), 'MonthlyStatementTable removed rose/pink styling from donor registry link');
assert(statementContent.includes('text-teal-800 border border-teal-200 hover:bg-teal-50'), 'MonthlyStatementTable donor registry link aligns with Monroe teal brand');

// 4. Cash Flow Explorer Hydration
const expenseExplorerPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'board', 'ExpenseExplorer.astro');
const expenseExplorerContent = fs.readFileSync(expenseExplorerPath, 'utf8');

assert(expenseExplorerContent.includes('window.__HSMC_EXPLORER_MONTHS__ = allMonths'), 'ExpenseExplorer caches months on window');
assert(expenseExplorerContent.includes('(window as any).__HSMC_EXPLORER_MONTHS__'), 'ExpenseExplorer rehydrates from cached window months on astro:page-load');

// 5. Theme CSS Dark Ops & Light Mode Coverage
const themeCssPath = path.join(__dirname, '..', 'frontend', 'src', 'styles', 'staff-theme.css');
const themeCssContent = fs.readFileSync(themeCssPath, 'utf8');

assert(themeCssContent.includes(':root[data-staff-theme="dark"] .bg-\\[\\#f5efe3\\]'), 'staff-theme.css adapts beige card headers in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] .bg-\\[\\#fbf9f5\\]'), 'staff-theme.css adapts cream bank/scenario headers in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] [class*="bg-emerald-50"]'), 'staff-theme.css adapts light pastel emerald pills in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] [class*="bg-teal-50"]'), 'staff-theme.css adapts light pastel teal pills in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] .badge-status.open'), 'staff-theme.css adapts grants status badges in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] .ee-filter-chip:not(.active)'), 'staff-theme.css adapts filter chips in Dark Ops mode');
assert(themeCssContent.includes(':root[data-staff-theme="dark"] tr[id^="drawer-"]'), 'staff-theme.css adapts donor and transaction drawer rows in Dark Ops mode');
assert(themeCssContent.includes(':root:not([data-staff-theme="dark"]) #export-donors-csv-btn'), 'staff-theme.css styles export donors button cleanly in Light mode');

console.log(`\nAudit Results: ${passes} passed, ${errors} failed.`);
if (errors > 0) process.exit(1);
