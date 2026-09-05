async function test() {
  try {
    const res = await fetch('http://localhost:4321/internal/board/');
    console.log('HTTP Status:', res.status);
    const html = await res.text();
    console.log('HTML size:', Math.round(html.length / 1024), 'KB');
    console.log('✓ Monthly Statement Root:', html.includes('id="monthly-statement-root"'));
    console.log('✓ August Drawer (id="drawer-month_2026_7"):', html.includes('id="drawer-month_2026_7"'));
    console.log('✓ January Drawer (id="drawer-month_2026_0"):', html.includes('id="drawer-month_2026_0"'));
    console.log('✓ Level 1 category toggle buttons:', html.includes('cat-toggle-btn'));
    console.log('✓ Level 2 payee toggle buttons:', html.includes('payee-toggle-btn'));
    console.log('✓ In-drawer live search input:', html.includes('drawer-search-input'));
    console.log('✓ Cross-module jump buttons:', html.includes('jump-to-explorer-btn'));
    console.log('✓ ExpenseExplorer Period buttons:', html.includes('ee-period-btn'));
    console.log('✓ Caregiver Salaries & Wages:', html.includes('Caregiver Salaries & Wages'));
    console.log('✓ Spay & Neuter Program:', html.includes('Spay & Neuter Program'));
    console.log('✓ Humane Ohio clinic:', html.includes('Humane Ohio'));
    console.log('✓ Employee Amy Cunningham-Shinault:', html.includes('AMY CUNNINGHAM-SHINAULT'));
    console.log('✓ Obsolete sections removed (balance, governance, strategy):', 
      !html.includes('id="sec-balance"') && 
      !html.includes('id="sec-governance"') && 
      !html.includes('id="sec-strategy"')
    );
  } catch (e) {
    console.error('Error fetching server:', e);
  }
}
test();
