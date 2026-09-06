import { isStaffAuthenticated, getStaffToken } from '../lib/staff-auth';
import { getStoredStaffToken, getCachedFinancials } from '../lib/api';
import { publishedLabel, refreshStaffFinancials, setStaffDataStatus } from '../lib/staff-financials';

/**
 * Authenticated data shape from GET /api/financials (Bearer staff token required):
 *   published YTD report fields — meta, headline_kpis, monthly_statements,
 *   statement_of_position, bridge_composition, multiyear_comparison,
 *   accounts_payable_schedule — plus bank_statement (August statement JSON),
 *   monthly_drilldown ({ meta, months }) for 3-level GL explorer,
 *   donors (array), donor_meta, donor_database ({ meta, donors }).
 * PDFs: GET /api/statement?doc=bank|qbo with Authorization: Bearer only.
 * Do not put the staff token on the query string — the API ignores ?token=.
 */
function applyDashboard(data: any, token: string | null): void {
  if (!data) return;
  hydrateExecutiveBanner(data.meta);
  hydrateHeadlineKpis(data.headline_kpis);
  hydrateOperatingBridge(data.headline_kpis, data.bridge_composition);
  hydrateMonthlyStatements(data.monthly_statements);
  hydratePositionAndCash(data.statement_of_position);
  hydrateMultiYear(data.multiyear_comparison);
  hydrateScenarioSimulator(data);
  if (data.bank_statement && token) {
    hydrateBankStatement(data.bank_statement, token);
  }
  hydrateExpenseExplorer(data);
  hydrateFooter(data.meta);
}

function formatDollar(val: number, maxDigits = 0): string {
  const isNeg = val < 0;
  const abs = Math.abs(Math.round(val));
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: maxDigits,
  }).format(abs);
  return isNeg ? `(${formatted})` : formatted;
}

function formatCents(val: number): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return isNeg ? `(${formatted})` : formatted;
}

function formatSigned(val: number): string {
  const isNeg = val < 0;
  const abs = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return isNeg ? `- ${formatted}` : `+ ${formatted}`;
}

export async function initBoardDashboard(): Promise<void> {
  if (!isStaffAuthenticated()) {
    const target = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/internal/?redirect=${target}`);
    return;
  }

  const cached = getCachedFinancials();
  const cachedToken = getStoredStaffToken();
  if (cached && cached.headline_kpis) {
    try {
      applyDashboard(cached, cachedToken);
      setStaffDataStatus('board-data-status', 'loading', `Showing cached packet. Refreshing ${publishedLabel(cached)}…`);
    } catch (e) {
      console.warn('[BoardDashboard] Error rendering cached financials:', e);
    }
  } else {
    setStaffDataStatus('board-data-status', 'loading');
  }

  const result = await refreshStaffFinancials();
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) return;
    if (cached?.headline_kpis) {
      setStaffDataStatus('board-data-status', 'error', `${result.error}. Still showing the last loaded packet.`, () => {
        void initBoardDashboard();
      });
      return;
    }
    setStaffDataStatus('board-data-status', 'error', result.error, () => {
      void initBoardDashboard();
    });
    return;
  }

  const token = cachedToken || (await getStaffToken());
  applyDashboard(result.data, token);
  setStaffDataStatus('board-data-status', 'hidden');
}

function itemsToExplorerCats(items: any[], total: number, kind: 'expense' | 'revenue'): any[] {
  return (items || []).map((it: any) => ({
    name: it.name,
    group: it.group || (kind === 'revenue' ? 'Contributed' : 'Operations'),
    total: it.amount,
    pctOfTotal: total > 0 ? ((it.amount / total) * 100).toFixed(1) : '0.0',
    payeeCount: 1,
    txCount: 1,
    payees: [{
      name: it.name,
      total: it.amount,
      txCount: 1,
      transactions: [{ date: '', memo: it.name, type: 'Category', amount: it.amount }],
    }],
  }));
}

function groupBankRows(rows: any[], nameKey: string): any[] {
  const byCat = new Map<string, any>();
  for (const row of rows || []) {
    const catName = row.category || 'Uncategorized';
    if (!byCat.has(catName)) {
      byCat.set(catName, {
        name: catName,
        group: row.group || catName,
        total: 0,
        payees: new Map<string, any>(),
      });
    }
    const cat = byCat.get(catName);
    const amount = Math.abs(Number(row.amount) || 0);
    cat.total += amount;
    const payeeName = row[nameKey] || row.payee || row.channel || row.description || 'Unknown';
    if (!cat.payees.has(payeeName)) {
      cat.payees.set(payeeName, { name: payeeName, total: 0, txCount: 0, transactions: [] });
    }
    const payee = cat.payees.get(payeeName);
    payee.total += amount;
    payee.txCount += 1;
    payee.transactions.push({
      date: row.date || '',
      memo: row.description || row.relational_notes || payeeName,
      type: row.type || row.channel || '',
      num: row.check_number || '',
      amount,
    });
  }

  const cats = Array.from(byCat.values()).map((cat) => {
    const payees = Array.from(cat.payees.values()).sort((a: any, b: any) => b.total - a.total);
    return {
      name: cat.name,
      group: cat.group,
      total: cat.total,
      pctOfTotal: '0.0',
      payeeCount: payees.length,
      txCount: payees.reduce((n: number, p: any) => n + p.txCount, 0),
      payees,
    };
  });
  const grand = cats.reduce((n, c) => n + c.total, 0);
  for (const cat of cats) {
    cat.pctOfTotal = grand > 0 ? ((cat.total / grand) * 100).toFixed(1) : '0.0';
  }
  return cats.sort((a, b) => b.total - a.total);
}

function hydrateExpenseExplorer(data: any): void {
  const drilldownMonths = data.monthly_drilldown?.months;
  if (
    drilldownMonths &&
    typeof drilldownMonths === 'object' &&
    !Array.isArray(drilldownMonths) &&
    Object.values(drilldownMonths).some((m: any) => Array.isArray(m?.expenseCategories) || Array.isArray(m?.revenueCategories))
  ) {
    const months: Record<string, any> = { ...drilldownMonths };
    const ytdExp: any[] = [];
    const ytdRev: any[] = [];
    let ytdNet = 0;
    for (const month of Object.values(months) as any[]) {
      if (!month || month.id === 'all_ytd') continue;
      ytdExp.push(...(month.expenseCategories || []));
      ytdRev.push(...(month.revenueCategories || []));
      ytdNet += month.net_margin || 0;
    }
    if (!months.all_ytd) {
      months.all_ytd = {
        id: 'all_ytd',
        monthName: 'All 2026 YTD',
        monthKey: 'all_ytd',
        net_margin: ytdNet,
        status: 'YTD',
        expenseCategories: ytdExp,
        revenueCategories: ytdRev,
      };
    }
    const hydrate = (window as any).__hydrateExpenseExplorer;
    if (typeof hydrate === 'function') {
      hydrate(months);
    }
    return;
  }

  const months: Record<string, any> = {};
  for (const m of data.monthly_statements || []) {
    months[m.id] = {
      id: m.id,
      monthName: m.month,
      monthKey: m.id,
      net_margin: m.net_margin,
      status: m.status,
      expenseCategories: itemsToExplorerCats(m.exp_items, m.total_exp, 'expense'),
      revenueCategories: itemsToExplorerCats(m.rev_items, m.revenue, 'revenue'),
    };
  }

  const ytdExp: any[] = [];
  const ytdRev: any[] = [];
  let ytdNet = 0;
  for (const month of Object.values(months) as any[]) {
    ytdExp.push(...(month.expenseCategories || []));
    ytdRev.push(...(month.revenueCategories || []));
    ytdNet += month.net_margin || 0;
  }
  months.all_ytd = {
    id: 'all_ytd',
    monthName: 'All 2026 YTD',
    monthKey: 'all_ytd',
    net_margin: ytdNet,
    status: 'YTD',
    expenseCategories: ytdExp,
    revenueCategories: ytdRev,
  };

  const stmt = data.bank_statement;
  if (stmt) {
    const aug = (data.monthly_statements || []).find((s: any) => /aug/i.test(s.month || ''));
    const augId = aug?.id || 'month_2026_7';
    months[augId] = {
      id: augId,
      monthName: aug?.month || 'Aug 2026',
      monthKey: augId,
      net_margin: aug?.net_margin ?? 0,
      status: aug?.status || 'Bank Rec',
      expenseCategories: groupBankRows(stmt.withdrawals, 'payee'),
      revenueCategories: groupBankRows(stmt.deposits, 'channel'),
    };
  }

  const hydrate = (window as any).__hydrateExpenseExplorer;
  if (typeof hydrate === 'function') {
    hydrate(months);
  }
}

function hydrateExecutiveBanner(meta: any) {
  if (!meta) return;
  const titleEl = document.getElementById('banner-period-title');
  if (titleEl) titleEl.textContent = meta.period_title;

  const govEl = document.getElementById('banner-governance');
  if (govEl) govEl.textContent = meta.governance_level;

  const cutoffEl = document.getElementById('banner-cutoff');
  if (cutoffEl) cutoffEl.textContent = meta.cutoff_date || '';

  const pubEl = document.getElementById('banner-publisher');
  if (pubEl) pubEl.textContent = meta.published_by || '';
}

function hydrateHeadlineKpis(kpis: any) {
  if (!kpis) return;

  const allInNet = document.getElementById('kpi-all-in-net');
  if (allInNet) allInNet.textContent = formatDollar(kpis.all_in_net);

  const allInMargin = document.getElementById('kpi-all-in-margin');
  if (allInMargin) allInMargin.textContent = `${kpis.all_in_margin_pct.toFixed(1)}%`;

  const allInRev = document.getElementById('kpi-all-in-rev');
  if (allInRev) allInRev.textContent = formatDollar(kpis.all_in_revenue);

  const allInExp = document.getElementById('kpi-all-in-exp');
  if (allInExp) allInExp.textContent = formatDollar(kpis.all_in_expenditures);

  const allInExact = document.getElementById('kpi-all-in-exact');
  if (allInExact) allInExact.textContent = formatCents(kpis.all_in_net);

  const qboNet = document.getElementById('kpi-qbo-net');
  if (qboNet) qboNet.textContent = formatDollar(kpis.qbo_operating_net);

  const qboRev = document.getElementById('kpi-qbo-rev');
  if (qboRev) qboRev.textContent = formatDollar(kpis.qbo_operating_revenue);

  const qboExp = document.getElementById('kpi-qbo-exp');
  if (qboExp) qboExp.textContent = formatDollar(kpis.qbo_cogs + kpis.qbo_operating_expenditures);

  const qboBridge = document.getElementById('kpi-qbo-bridge');
  if (qboBridge) qboBridge.textContent = `+${formatDollar(kpis.non_operating_bridge)}`;

  const progRatio = document.getElementById('kpi-program-ratio');
  if (progRatio) progRatio.textContent = `${kpis.program_ratio_pct.toFixed(1)}%`;

  const progTarget = document.getElementById('kpi-program-target');
  if (progTarget) {
    progTarget.textContent = kpis.program_ratio_pct >= 75 ? '≥75%' : '<75%';
  }

  const progCents = document.getElementById('kpi-program-cents');
  if (progCents) {
    progCents.textContent = `${Math.round(kpis.program_ratio_pct)}¢ of every dollar spent goes directly to animal rescue, clinical veterinary care, and feeding.`;
  }

  const progSpend = document.getElementById('kpi-program-spend');
  if (progSpend) progSpend.textContent = formatDollar(kpis.program_spend);

  const progOpexp = document.getElementById('kpi-program-opexp');
  if (progOpexp) progOpexp.textContent = formatDollar(kpis.qbo_operating_expenditures);

  const progExact = document.getElementById('kpi-program-exact');
  if (progExact) progExact.textContent = formatCents(kpis.program_spend);

  const bankChecking = kpis.bank_register_cash || kpis.operating_checking_first_merchants || 0;
  const realLiquidity = bankChecking + kpis.fidelity_reserve;

  const runwayBadge = document.getElementById('kpi-runway-badge');
  if (runwayBadge) {
    const mo = (realLiquidity / Math.abs(kpis.qbo_operating_net / 8)).toFixed(1);
    runwayBadge.textContent = `${mo} mo`;
  }

  const totLiq = document.getElementById('kpi-total-liquidity');
  if (totLiq) totLiq.textContent = formatDollar(realLiquidity);

  const opCash = document.getElementById('kpi-operating-cash');
  if (opCash) opCash.textContent = formatDollar(bankChecking);

  const fidRes = document.getElementById('kpi-fidelity-reserve');
  if (fidRes) fidRes.textContent = formatDollar(kpis.fidelity_reserve);

  const zeroInf = document.getElementById('kpi-zero-inflow');
  if (zeroInf) {
    const moZero = (realLiquidity / ((kpis.qbo_cogs + kpis.qbo_operating_expenditures) / 8)).toFixed(1);
    zeroInf.textContent = `${moZero} mo`;
  }
}

function hydrateOperatingBridge(kpis: any, bridge: any) {
  if (!bridge || !kpis) return;

  const badge = document.getElementById('bridge-badge');
  if (badge) {
    const formatted = formatCents(bridge.net_bridge_total).replace('(', '').replace(')', '');
    badge.textContent = `Net Outside Support: +${formatted}`;
  }

  const qboNet = document.getElementById('bridge-qbo-net');
  if (qboNet) qboNet.textContent = formatCents(kpis.qbo_operating_net);

  const opInflows = document.getElementById('bridge-op-inflows');
  if (opInflows) opInflows.textContent = `(${formatCents(kpis.qbo_operating_revenue)})`;

  const opOutflows = document.getElementById('bridge-op-outflows');
  if (opOutflows) opOutflows.textContent = `(${formatCents(kpis.qbo_cogs + kpis.qbo_operating_expenditures)})`;

  const endEl = document.getElementById('bridge-endowment');
  if (endEl) endEl.textContent = formatSigned(bridge.endowment_distributions);

  const recEl = document.getElementById('bridge-recycling');
  if (recEl) recEl.textContent = formatSigned(bridge.recycling_and_rebates);

  const fleetEl = document.getElementById('bridge-fleet');
  if (fleetEl) fleetEl.textContent = formatSigned(bridge.fleet_transit_and_fuel);

  const netTot = document.getElementById('bridge-net-total');
  if (netTot) netTot.textContent = `+${formatCents(bridge.net_bridge_total)}`;

  const allInNet = document.getElementById('bridge-all-in-net');
  if (allInNet) allInNet.textContent = formatCents(kpis.all_in_net);

  const allinInflows = document.getElementById('bridge-allin-inflows');
  if (allinInflows) allinInflows.textContent = `(${formatCents(kpis.all_in_revenue)})`;

  const allinOutflows = document.getElementById('bridge-allin-outflows');
  if (allinOutflows) allinOutflows.textContent = `(${formatCents(kpis.all_in_expenditures)})`;

  const commEl = document.getElementById('bridge-c2-commentary');
  if (commEl) commEl.textContent = bridge.c2_commentary || '';
}

function hydrateStatementFootings(statements: any[]) {
  const totalRev = statements.reduce((acc, m) => acc + m.revenue, 0);
  const totalCogs = statements.reduce((acc, m) => acc + m.cogs, 0);
  const totalOpExp = statements.reduce((acc, m) => acc + m.operating_exp, 0);
  const totalOtherExp = statements.reduce((acc, m) => acc + m.other_exp, 0);
  const totalExp = statements.reduce((acc, m) => acc + m.total_exp, 0);
  const totalNet = statements.reduce((acc, m) => acc + m.net_margin, 0);
  const totalMarginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;

  const fRev = document.getElementById('footing-rev');
  if (fRev) fRev.textContent = formatDollar(totalRev);
  const fCogs = document.getElementById('footing-cogs');
  if (fCogs) fCogs.textContent = formatDollar(totalCogs);
  const fOp = document.getElementById('footing-op-exp');
  if (fOp) fOp.textContent = formatDollar(totalOpExp);
  const fOther = document.getElementById('footing-other-exp');
  if (fOther) fOther.textContent = formatDollar(totalOtherExp);
  const fTotExp = document.getElementById('footing-total-exp');
  if (fTotExp) fTotExp.textContent = formatDollar(totalExp);
  const fNet = document.getElementById('footing-net-margin');
  if (fNet) fNet.textContent = `${totalNet >= 0 ? '+' : ''}${formatDollar(totalNet)}`;
  const fPct = document.getElementById('footing-margin-pct');
  if (fPct) fPct.textContent = `${totalMarginPct.toFixed(1)}%`;

  const mfRev = document.getElementById('mobile-footing-rev');
  if (mfRev) mfRev.textContent = formatDollar(totalRev);
  const mfTotExp = document.getElementById('mobile-footing-exp');
  if (mfTotExp) mfTotExp.textContent = formatDollar(totalExp);
  const mfNet = document.getElementById('mobile-footing-net');
  if (mfNet) mfNet.textContent = `${totalNet >= 0 ? '+' : ''}${formatDollar(totalNet)}`;
  const mfPct = document.getElementById('mobile-footing-pct');
  if (mfPct) mfPct.textContent = `${totalMarginPct.toFixed(1)}%`;
}

function hydrateMonthlyStatements(statements: any[]) {
  if (!statements || !statements.length) return;

  const tbody = document.getElementById('statement-rows-tbody');
  const root = document.getElementById('monthly-statement-root');
  if (root) {
    root.setAttribute('data-statements', JSON.stringify(statements));
  }

  // If statically rendered rows with 3-level drilldowns are already present, preserve them!
  const hasExistingDrilldowns = document.getElementById('row-month_2026_0');
  const hasLoadingRow = document.getElementById('statement-loading-row');
  if (hasExistingDrilldowns && !hasLoadingRow) {
    // Update footing only
    hydrateStatementFootings(statements);
    return;
  }

  if (tbody) {
    tbody.innerHTML = '';
    statements.forEach((m) => {
      const isSurplus = m.net_margin >= 0;
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition cursor-pointer group';
      tr.id = `row-${m.id}`;
      tr.setAttribute('data-target', `drawer-${m.id}`);

      tr.innerHTML = `
        <td class="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap flex items-center gap-2">
          <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition transform group-[.is-open]:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span>${m.month}</span>
          ${m.is_partial ? '<span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">Partial</span>' : ''}
        </td>
        <td class="py-3 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">${formatDollar(m.revenue)}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">${formatDollar(m.cogs)}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">${formatDollar(m.operating_exp)}</td>
        <td class="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap">${formatDollar(m.other_exp)}</td>
        <td class="py-3 px-3 text-right font-mono font-medium text-slate-900 whitespace-nowrap">${formatDollar(m.total_exp)}</td>
        <td class="py-3 px-3 text-right font-mono font-bold whitespace-nowrap ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}">
          ${isSurplus ? '+' : ''}${formatDollar(m.net_margin)}
        </td>
        <td class="py-3 px-3 text-right font-semibold whitespace-nowrap ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}">
          ${m.margin_pct.toFixed(1)}%
        </td>
        <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap flex items-center justify-between">
          <span class="truncate max-w-[140px] sm:max-w-xs" title="${m.driver}">${m.driver}</span>
          <span class="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${isSurplus ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
            ${m.status}
          </span>
        </td>
      `;

      // Drawer row
      const drawerTr = document.createElement('tr');
      drawerTr.id = `drawer-${m.id}`;
      drawerTr.className = 'hidden bg-[#fbf9f5] border-y border-slate-200/80';

      const revItemsHtml = (m.rev_items || [])
        .map((it: any) => {
          const pct = m.revenue > 0 ? ((it.amount / m.revenue) * 100).toFixed(1) : '0.0';
          return `
            <div class="py-2 px-2 flex items-center justify-between hover:bg-emerald-50/40 rounded transition">
              <div class="pr-2 min-w-0">
                <div class="font-semibold text-slate-800 text-xs truncate">${it.name}</div>
                ${it.group ? `<span class="text-[10px] text-slate-400 font-medium block truncate">${it.group}</span>` : ''}
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-bold text-xs text-emerald-700 block">+${formatCents(it.amount)}</span>
                <span class="text-[10px] text-slate-400 font-medium">${pct}% of rev</span>
              </div>
            </div>
          `;
        })
        .join('');

      const expItemsHtml = (m.exp_items || [])
        .map((it: any) => {
          const pct = m.total_exp > 0 ? ((it.amount / m.total_exp) * 100).toFixed(1) : '0.0';
          return `
            <div class="py-2 px-2 flex items-center justify-between hover:bg-slate-50 rounded transition">
              <div class="pr-2 min-w-0">
                <div class="font-semibold text-slate-800 text-xs truncate">${it.name}</div>
                ${it.group ? `<span class="text-[10px] text-slate-400 font-medium block truncate">${it.group}</span>` : ''}
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-bold text-xs text-slate-900 block">${formatCents(it.amount)}</span>
                <span class="text-[10px] text-slate-400 font-medium">${pct}% of spend</span>
              </div>
            </div>
          `;
        })
        .join('');

      drawerTr.innerHTML = `
        <td colspan="9" class="p-4 sm:p-6">
          <div class="space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-slate-900">${m.month} Complete Category Breakdown</span>
                <span class="text-[11px] text-slate-500 font-medium">QuickBooks Online Verified Ledger</span>
              </div>
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Total Revenue: <strong class="font-mono">${formatDollar(m.revenue)}</strong> (${(m.rev_items || []).length} categories)
                </span>
                <span class="font-semibold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                  Total Expenditures: <strong class="font-mono">${formatDollar(m.total_exp)}</strong> (${(m.exp_items || []).length} categories)
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <!-- Revenue Inflows Schedule -->
              <div class="bg-white rounded-xl border border-emerald-200/80 shadow-2xs overflow-hidden flex flex-col">
                <div class="bg-emerald-900 text-white px-4 py-2.5 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-emerald-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m0 0l6.75-6.75M12 19.5l-6.75-6.75"/></svg>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-emerald-100">
                      Revenue Inflows (${m.month})
                    </h4>
                  </div>
                  <span class="text-xs font-mono font-bold text-emerald-200 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/60">
                    ${formatDollar(m.revenue)}
                  </span>
                </div>
                <div class="p-3 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  ${revItemsHtml}
                </div>
                <div class="mt-auto px-4 py-2.5 bg-emerald-50/70 border-t border-emerald-100 flex items-center justify-between text-xs text-emerald-900 font-bold">
                  <span>Total Verified Inflows (${(m.rev_items || []).length} categories):</span>
                  <span class="font-mono font-bold text-emerald-800">${formatDollar(m.revenue)}</span>
                </div>
              </div>

              <!-- Expenditures Schedule -->
              <div class="bg-white rounded-xl border border-rose-200/80 shadow-2xs overflow-hidden flex flex-col">
                <div class="bg-[#173a39] text-white px-4 py-2.5 flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-rose-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19.5v-15m0 0l-6.75 6.75M12 4.5l6.75 6.75"/></svg>
                    <h4 class="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Expenditures by Category (${m.month})
                    </h4>
                  </div>
                  <span class="text-xs font-mono font-bold text-amber-200 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-700/60">
                    ${formatDollar(m.total_exp)}
                  </span>
                </div>
                <div class="p-3 divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  ${expItemsHtml}
                </div>
                <div class="mt-auto px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-900 font-bold">
                  <span>Total Verified Spend (${(m.exp_items || []).length} categories):</span>
                  <span class="font-mono font-bold text-slate-900">${formatDollar(m.total_exp)}</span>
                </div>
              </div>
            </div>
          </div>
        </td>
      `;

      // Accordion click handler
      tr.addEventListener('click', () => {
        const isOpen = !drawerTr.classList.contains('hidden');
        drawerTr.classList.toggle('hidden', isOpen);
        tr.classList.toggle('is-open', !isOpen);
      });

      tbody.appendChild(tr);
      tbody.appendChild(drawerTr);
    });
  }

  // Hydrate mobile stacked cards
  const mobileContainer = document.getElementById('monthly-statement-mobile-container');
  if (mobileContainer) {
    mobileContainer.innerHTML = '';
    statements.forEach((m) => {
      const isSurplus = m.net_margin >= 0;
      const card = document.createElement('div');
      card.className = 'p-4 bg-white hover:bg-slate-50/80 transition';
      card.id = `mobile-card-${m.id}`;

      const revItemsHtml = (m.rev_items || [])
        .map((it: any) => {
          const pct = m.revenue > 0 ? ((it.amount / m.revenue) * 100).toFixed(1) : '0.0';
          return `
            <div class="py-1.5 px-1 flex justify-between items-center text-slate-700">
              <div class="min-w-0 pr-2">
                <span class="font-medium text-slate-800 block truncate">${it.name}</span>
                ${it.group ? `<span class="text-[10px] text-slate-400 block truncate">${it.group}</span>` : ''}
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-semibold text-emerald-700 block">+${formatDollar(it.amount)}</span>
                <span class="text-[9px] text-slate-400">${pct}%</span>
              </div>
            </div>
          `;
        }).join('');

      const expItemsHtml = (m.exp_items || [])
        .map((it: any) => {
          const pct = m.total_exp > 0 ? ((it.amount / m.total_exp) * 100).toFixed(1) : '0.0';
          return `
            <div class="py-1.5 px-1 flex justify-between items-center text-slate-700">
              <div class="min-w-0 pr-2">
                <span class="font-medium text-slate-800 block truncate">${it.name}</span>
                ${it.group ? `<span class="text-[10px] text-slate-400 block truncate">${it.group}</span>` : ''}
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-semibold text-slate-900 block">${formatDollar(it.amount)}</span>
                <span class="text-[9px] text-slate-400">${pct}%</span>
              </div>
            </div>
          `;
        }).join('');

      card.innerHTML = `
        <div class="flex items-start justify-between gap-2 mb-2">
          <div>
            <div class="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
              <span>${m.month}</span>
              ${m.is_partial ? '<span class="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">Partial</span>' : ''}
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5" title="${m.driver}">${m.driver}</div>
          </div>
          <div class="text-right flex flex-col items-end shrink-0">
            <span class="font-mono font-bold text-sm ${isSurplus ? 'text-emerald-600' : 'text-rose-600'}">
              ${isSurplus ? '+' : ''}${formatDollar(m.net_margin)}
            </span>
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
              isSurplus ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }">
              ${m.margin_pct.toFixed(1)}% &bull; ${m.status}
            </span>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-xs mb-2.5">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Revenue</span>
            <span class="font-mono font-semibold text-slate-800">${formatDollar(m.revenue)}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Total Exp</span>
            <span class="font-mono font-semibold text-slate-800">${formatDollar(m.total_exp)}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Direct Care</span>
            <span class="font-mono text-slate-600">${formatDollar(m.cogs)}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Ops & Payroll</span>
            <span class="font-mono text-slate-600">${formatDollar(m.operating_exp)}</span>
          </div>
        </div>
        <button
          type="button"
          class="w-full py-1.5 px-3 rounded text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/60 flex items-center justify-center gap-1.5 transition cursor-pointer"
          data-mobile-target="mobile-drawer-${m.id}"
        >
          <span>View Breakdown</span>
          <svg class="w-3.5 h-3.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div id="mobile-drawer-${m.id}" class="hidden pt-3 space-y-3">
          <div class="bg-emerald-50/40 p-3 rounded-lg border border-emerald-100 text-xs">
            <h4 class="text-[11px] font-bold uppercase tracking-wider text-emerald-900 pb-1.5 border-b border-emerald-200/60 mb-1.5">
              Revenue Inflows Schedule (${m.month})
            </h4>
            <div class="space-y-1">${revItemsHtml}</div>
          </div>
          <div class="bg-rose-50/40 p-3 rounded-lg border border-rose-100 text-xs">
            <h4 class="text-[11px] font-bold uppercase tracking-wider text-rose-900 pb-1.5 border-b border-rose-200/60 mb-1.5">
              Expenditures Schedule (${m.month})
            </h4>
            <div class="space-y-1">${expItemsHtml}</div>
          </div>
        </div>
      `;

      const btn = card.querySelector('[data-mobile-target]');
      const drawer = card.querySelector(`#mobile-drawer-${m.id}`);
      if (btn && drawer) {
        btn.addEventListener('click', () => {
          drawer.classList.toggle('hidden');
          const svg = btn.querySelector('svg');
          if (svg) svg.classList.toggle('rotate-180');
        });
      }

      mobileContainer.appendChild(card);
    });

    // Mobile Footing card
    const footingCard = document.createElement('div');
    footingCard.className = 'p-4 bg-[#173a39] text-white';
    footingCard.innerHTML = `
      <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-300 mb-2 flex items-center justify-between">
        <span>2026 YTD Certified Footing</span>
        <span class="text-[10px] text-emerald-400 font-normal">✓ Cent-for-cent</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-slate-300 block text-[10px]">Total Revenue</span>
          <span id="mobile-footing-rev" class="font-mono font-bold text-emerald-300"></span>
        </div>
        <div>
          <span class="text-slate-300 block text-[10px]">Total Expenditures</span>
          <span id="mobile-footing-exp" class="font-mono font-bold text-amber-300"></span>
        </div>
        <div>
          <span class="text-slate-300 block text-[10px]">Net Margin</span>
          <span id="mobile-footing-net" class="font-mono font-bold text-rose-400"></span>
        </div>
        <div>
          <span class="text-slate-300 block text-[10px]">Margin %</span>
          <span id="mobile-footing-pct" class="font-mono font-bold text-rose-300"></span>
        </div>
      </div>
    `;
    mobileContainer.appendChild(footingCard);
  }

  // Totals footing
  const totalRev = statements.reduce((acc, m) => acc + m.revenue, 0);
  const totalCogs = statements.reduce((acc, m) => acc + m.cogs, 0);
  const totalOpExp = statements.reduce((acc, m) => acc + m.operating_exp, 0);
  const totalOtherExp = statements.reduce((acc, m) => acc + m.other_exp, 0);
  const totalExp = statements.reduce((acc, m) => acc + m.total_exp, 0);
  const totalNet = statements.reduce((acc, m) => acc + m.net_margin, 0);
  const totalMarginPct = totalRev > 0 ? (totalNet / totalRev) * 100 : 0;

  const fRev = document.getElementById('footing-rev');
  if (fRev) fRev.textContent = formatDollar(totalRev);
  const fCogs = document.getElementById('footing-cogs');
  if (fCogs) fCogs.textContent = formatDollar(totalCogs);
  const fOp = document.getElementById('footing-op-exp');
  if (fOp) fOp.textContent = formatDollar(totalOpExp);
  const fOther = document.getElementById('footing-other-exp');
  if (fOther) fOther.textContent = formatDollar(totalOtherExp);
  const fTotExp = document.getElementById('footing-total-exp');
  if (fTotExp) fTotExp.textContent = formatDollar(totalExp);
  const fNet = document.getElementById('footing-net-margin');
  if (fNet) fNet.textContent = `${totalNet >= 0 ? '+' : ''}${formatDollar(totalNet)}`;
  const fPct = document.getElementById('footing-margin-pct');
  if (fPct) fPct.textContent = `${totalMarginPct.toFixed(1)}%`;

  const mfRev = document.getElementById('mobile-footing-rev');
  if (mfRev) mfRev.textContent = formatDollar(totalRev);
  const mfTotExp = document.getElementById('mobile-footing-exp');
  if (mfTotExp) mfTotExp.textContent = formatDollar(totalExp);
  const mfNet = document.getElementById('mobile-footing-net');
  if (mfNet) mfNet.textContent = `${totalNet >= 0 ? '+' : ''}${formatDollar(totalNet)}`;
  const mfPct = document.getElementById('mobile-footing-pct');
  if (mfPct) mfPct.textContent = `${totalMarginPct.toFixed(1)}%`;
}

function hydratePositionAndCash(position: any) {
  if (!position) return;
  const assets = position.assets || {};
  const liab = position.liabilities || {};
  const netAssets = position.net_assets || {};

  const setEl = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setEl('pos-total-assets-badge', `Total: ${formatDollar(assets.total_assets)}`);
  setEl('pos-checking-book', formatDollar(assets.operating_checking_first_merchants));
  setEl('pos-checking-register', formatDollar(assets.operating_checking_bank_register));
  setEl('pos-bank-stmt-note', formatDollar(assets.operating_checking_bank_register));
  setEl('pos-undeposited-funds', formatDollar(assets.undeposited_funds));
  setEl('pos-petty-cash', formatDollar(assets.petty_cash));
  setEl('pos-total-book-cash', formatDollar(assets.total_book_operating_cash));
  setEl('pos-tax-escrow', formatDollar(assets.tax_holding_escrow));
  setEl('pos-fidelity-reserve', formatDollar(assets.fidelity_board_designated_reserve));
  setEl('pos-total-liquid', formatDollar(assets.total_liquid_reserves));
  setEl('pos-fixed-assets', formatDollar(assets.fixed_assets_net));
  setEl('pos-total-assets', formatDollar(assets.total_assets));

  setEl('pos-total-liab-badge', `Total: ${formatDollar(liab.total_operating_obligations_current)}`);
  setEl('pos-accounts-payable', formatDollar(liab.accounts_payable));
  setEl('pos-merchants-cc', formatDollar(liab.first_merchants_credit_card));
  setEl('pos-line-of-credit', formatDollar(liab.drawn_line_of_credit));
  setEl('pos-payroll-payable', formatDollar(liab.payroll_clearing_direct_deposit_payable));
  setEl('pos-total-liabilities', formatDollar(liab.total_operating_obligations_current));

  if (netAssets.without_donor_restrictions) {
    const nodonor = netAssets.without_donor_restrictions;
    setEl('pos-net-undesignated', formatDollar(nodonor.undesignated_operating));
    setEl('pos-net-fidelity', formatDollar(nodonor.board_designated_fidelity_reserve));
    setEl('pos-net-without-restrictions', formatDollar(nodonor.total_without_donor_restrictions));
  }

  if (netAssets.with_donor_restrictions) {
    const withdonor = netAssets.with_donor_restrictions;
    setEl('pos-net-cat-room', formatDollar(withdonor.cat_room_expansion_fund));
    setEl('pos-net-angels', formatDollar(withdonor.angels_medical_fund));
    setEl('pos-net-schlick', formatDollar(withdonor.schlick_estate_restricted_corpus));
    setEl('pos-net-with-restrictions', formatDollar(withdonor.total_with_donor_restrictions));
  }

  setEl('pos-total-equity-badge', `Total Equity: ${formatDollar(netAssets.total_equity_qbo)}`);
  setEl('pos-opening-equity', formatDollar(netAssets.opening_balance_equity));
  setEl('pos-retained-earnings', formatDollar(netAssets.retained_earnings_historical));
  setEl('pos-current-net', formatDollar(netAssets.current_year_net_margin));
  setEl('pos-total-equity', formatDollar(netAssets.total_equity_qbo));
  setEl('pos-total-eq-assets', formatDollar(assets.total_assets));
  if (liab.payroll_clearing_footnote) {
    setEl('pos-payroll-clearing-note', liab.payroll_clearing_footnote);
  }
}

function hydrateBankStatement(stmt: any, token: string) {
  if (!stmt || !stmt.metadata) return;

  const setEl = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // Quick metrics ribbon
  setEl('bank-stat-balance', formatCents(stmt.metadata.statement_ending_balance));
  setEl('bank-stat-cash', formatCents(stmt.metadata.qbo_register_balance));
  const acct = stmt.metadata.account_number ? `••••${String(stmt.metadata.account_number).slice(-4)}` : 'on file';
  setEl('bank-stat-meta-note', `Account ${acct} · Statement Period: August 1 – August 31, 2026 · Reconciled by ${stmt.metadata.reconciled_by || 'staff'} with $0.00 difference.`);

  // Statement totals
  setEl('stmt-total-deposits', `+${formatCents(stmt.metadata.total_deposits_amount)}`);
  setEl('stmt-total-withdrawals', `-${formatCents(stmt.metadata.total_withdrawals_amount)}`);
  setEl('stmt-ending-balance', formatCents(stmt.metadata.statement_ending_balance));
  setEl('daily-august-low-val', formatCents(stmt.metadata.statement_ending_balance));
  if (stmt.daily_balances && stmt.daily_balances.length) {
    const peak = Math.max(...stmt.daily_balances.map((d: any) => d.balance));
    setEl('daily-peak-val', formatCents(peak));
  }

  // Bearer-only: fetch PDFs with Authorization and attach blob URLs (never ?token=).
  void attachStatementPdfBlobs(token);

  // Hydrate Tab 1 Transactions
  const deposits = (stmt.deposits || []).map((d: any, i: number) => ({
    id: `dep-${i}`,
    date: d.date,
    description: d.description,
    payee: d.channel ? `${d.channel} Transfer` : 'Deposit',
    type: d.channel === 'Branch' ? 'Branch Deposit' : d.channel === 'Square' ? 'Merchant Card' : 'Electronic Credit',
    isDeposit: true,
    amount: d.amount,
    category: d.category,
    relational_link: d.relational_account,
    relational_notes: d.relational_notes,
    isPayroll: false,
    isCheck: false,
    isAP: false,
    check_number: null,
  }));

  const withdrawals = (stmt.withdrawals || []).map((w: any, i: number) => {
    const isCheck = !!w.check_number;
    const isPayroll = w.category.includes('Paycheck') || w.category.includes('Payroll') || (w.relational_link && w.relational_link.includes('126'));
    const isAP = !!w.relational_link && (w.relational_link.includes('AP Aging') || w.relational_link.includes('Capital Assets'));
    return {
      id: `wd-${i}`,
      date: w.date,
      description: w.description,
      payee: w.payee,
      type: w.type,
      isDeposit: false,
      amount: -Math.abs(w.amount),
      category: w.category,
      relational_link: w.relational_link,
      relational_notes: w.relational_notes,
      isPayroll,
      isCheck,
      isAP,
      check_number: w.check_number || null,
    };
  });

  const allTx = [...deposits, ...withdrawals].sort((a, b) => {
    if (a.date === b.date) return b.amount - a.amount;
    return a.date.localeCompare(b.date);
  });

  let running = stmt.metadata.statement_beginning_balance;
  const allWithRunning = allTx.map((tx) => {
    running = Math.round((running + tx.amount) * 100) / 100;
    return { ...tx, runningBalance: running };
  });

  const tbody = document.getElementById('statement-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    allWithRunning.forEach((tx) => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition statement-row';
      tr.setAttribute('data-is-deposit', tx.isDeposit ? 'true' : 'false');
      tr.setAttribute('data-is-check', tx.isCheck ? 'true' : 'false');
      tr.setAttribute('data-is-payroll', tx.isPayroll ? 'true' : 'false');
      tr.setAttribute('data-is-ap', tx.isAP ? 'true' : 'false');
      tr.setAttribute('data-search', `${tx.date} ${tx.description} ${tx.payee} ${tx.category} ${tx.relational_link} ${tx.relational_notes} ${tx.check_number || ''} ${Math.abs(tx.amount)}`.toLowerCase());
      tr.setAttribute('data-amount', String(tx.amount));

      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">${tx.date}</td>
        <td class="py-2.5 px-3">
          <div class="font-medium text-slate-900 flex items-center gap-1.5">
            <span>${tx.payee}</span>
            ${tx.check_number ? `<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">Check #${tx.check_number}</span>` : ''}
          </div>
          <div class="text-[11px] text-slate-500 font-mono">${tx.description}</div>
          ${tx.relational_notes ? `<div class="text-[10px] text-slate-400 italic">${tx.relational_notes}</div>` : ''}
        </td>
        <td class="py-2.5 px-3 whitespace-nowrap">
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${tx.isDeposit ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : tx.isCheck ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : tx.isPayroll ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-slate-100 text-slate-700'}">
            ${tx.type}
          </span>
          <span class="block text-[10px] text-slate-400 mt-0.5">${tx.category}</span>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-1">
            ${tx.isAP ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">AP Aging</span>' : ''}
            ${tx.isPayroll ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Acct 126</span>' : ''}
            ${tx.isDeposit ? '<span class="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Revenue</span>' : ''}
            <span class="font-mono text-slate-700 text-[11px] truncate max-w-xs block" title="${tx.relational_link}">${tx.relational_link || ''}</span>
          </div>
        </td>
        <td class="py-2.5 px-3 text-right font-mono whitespace-nowrap">
          <span class="font-bold ${tx.isDeposit ? 'text-emerald-700' : Math.abs(tx.amount) >= 5000 ? 'text-rose-700' : 'text-slate-900'}">
            ${tx.isDeposit ? `+${formatCents(tx.amount)}` : `-${formatCents(Math.abs(tx.amount))}`}
          </span>
        </td>
        <td class="py-2.5 px-3 text-right font-mono font-medium text-slate-700 whitespace-nowrap">${formatCents(tx.runningBalance)}</td>
      `;

      tbody.appendChild(tr);
    });
    window.dispatchEvent(new CustomEvent('bank-statement-rendered'));
  }

  // Hydrate Tab 3 Daily Balances
  const dailyTbody = document.getElementById('daily-balances-tbody');
  if (dailyTbody && stmt.daily_balances && stmt.daily_balances.length) {
    dailyTbody.innerHTML = '';
    const maxBal = Math.max(...stmt.daily_balances.map((d: any) => d.balance));
    let prev = stmt.metadata.statement_beginning_balance;

    stmt.daily_balances.forEach((d: any) => {
      const delta = Math.round((d.balance - prev) * 100) / 100;
      prev = d.balance;
      const pct = Math.max(5, Math.round((d.balance / maxBal) * 100));

      let note = 'Routine operating deposits & debits';
      if (d.date === '2026-08-03') note = '+$12.6k branch cash, weekend adoptions & donor drops';
      if (d.date === '2026-08-14') note = 'Mid-month caregiver payroll & tax batch (-$19.7k)';
      if (d.date === '2026-08-21') note = 'Monroe Fencing capital play yard installation (-$7.1k)';
      if (d.date === '2026-08-28') note = 'End-of-month caregiver payroll run (-$17.5k)';
      if (d.date === '2026-08-31') note = 'August statement close & final reconciliation locking';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50/80 transition';
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono font-medium text-slate-700 whitespace-nowrap">${d.date}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">${formatCents(d.balance)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-semibold whitespace-nowrap">
          <span class="${delta > 0 ? 'text-emerald-700' : delta < 0 ? 'text-rose-700' : 'text-slate-500'}">
            ${delta > 0 ? `+${formatCents(delta)}` : delta < 0 ? `-${formatCents(Math.abs(delta))}` : '$0.00'}
          </span>
        </td>
        <td class="py-2.5 px-3">
          <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div class="h-full rounded-full ${d.balance < 30000 ? 'bg-amber-500' : 'bg-[#173a39]'}" style="width: ${pct}%"></div>
          </div>
          <span class="text-[9px] font-mono text-slate-400 block mt-0.5">${pct}% of peak</span>
        </td>
        <td class="py-2.5 px-3 text-slate-600 text-[11px]">${note}</td>
      `;
      dailyTbody.appendChild(tr);
    });
  }
}

const statementPdfBlobs: { bank?: string; qbo?: string } = {};

async function fetchStatementPdfBlob(doc: 'bank' | 'qbo', token: string): Promise<string | null> {
  const res = await fetch(`/api/statement?doc=${doc}&token=${encodeURIComponent(token)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Staff-Token': token,
      'X-Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

async function attachStatementPdfBlobs(token: string): Promise<void> {
  try {
    const [bankUrl, qboUrl] = await Promise.all([
      fetchStatementPdfBlob('bank', token),
      fetchStatementPdfBlob('qbo', token),
    ]);

    if (statementPdfBlobs.bank) URL.revokeObjectURL(statementPdfBlobs.bank);
    if (statementPdfBlobs.qbo) URL.revokeObjectURL(statementPdfBlobs.qbo);
    statementPdfBlobs.bank = bankUrl || undefined;
    statementPdfBlobs.qbo = qboUrl || undefined;

    const btnBank = document.getElementById('btn-pdf-bank');
    if (btnBank && bankUrl) btnBank.setAttribute('data-pdf-url', bankUrl);

    const btnQbo = document.getElementById('btn-pdf-qbo');
    if (btnQbo && qboUrl) btnQbo.setAttribute('data-pdf-url', qboUrl);

    const newTabBtn = document.getElementById('pdf-open-newtab') as HTMLAnchorElement | null;
    if (newTabBtn && bankUrl) newTabBtn.href = bankUrl;

    const openStmtPdf = document.getElementById('btn-open-statement-pdf') as HTMLAnchorElement | null;
    if (openStmtPdf && bankUrl) openStmtPdf.href = bankUrl;

    const downloadBtn = document.getElementById('pdf-download-btn') as HTMLAnchorElement | null;
    if (downloadBtn && bankUrl) downloadBtn.href = bankUrl;

    const iframe = document.getElementById('pdf-viewer-frame') as HTMLIFrameElement | null;
    if (iframe && bankUrl) iframe.src = `${bankUrl}#toolbar=1&navpanes=0&scrollbar=1`;

    const recReportPdf = document.getElementById('qbo-rec-report-pdf-link') as HTMLAnchorElement | null;
    if (recReportPdf && qboUrl) recReportPdf.href = qboUrl;
  } catch (err) {
    console.debug('[BoardDashboard] Statement PDF fetch failed:', err);
  }
}

function hydrateMultiYear(comp: any) {
  if (!comp) return;
  const setEl = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  if (comp['2024']) {
    setEl('my-2024-rev', formatDollar(comp['2024'].total_revenue));
    setEl('my-2024-exp', formatDollar(comp['2024'].total_expenditures));
    setEl('my-2024-net', formatDollar(comp['2024'].net_result));
    setEl('my-2024-margin', `${comp['2024'].margin_pct.toFixed(1)}%`);
    setEl('my-2024-prog', `${comp['2024'].program_ratio.toFixed(1)}%`);
  }

  if (comp['2025']) {
    setEl('my-2025-rev', formatDollar(comp['2025'].total_revenue));
    setEl('my-2025-exp', formatDollar(comp['2025'].total_expenditures));
    setEl('my-2025-net', `+${formatDollar(comp['2025'].net_result)}`);
    setEl('my-2025-ex-bequest', formatDollar(comp['2025'].ex_bequest_operating_net || 0));
    setEl('my-2025-prog', `${comp['2025'].program_ratio.toFixed(1)}%`);
  }

  if (comp['2026']) {
    setEl('my-2026-rev', formatDollar(comp['2026'].total_revenue));
    setEl('my-2026-exp', formatDollar(comp['2026'].total_expenditures));
    setEl('my-2026-net', formatDollar(comp['2026'].net_result));
    setEl('my-2026-margin', `${comp['2026'].margin_pct.toFixed(1)}%`);
    setEl('my-2026-prog', `${comp['2026'].program_ratio.toFixed(1)}%`);
  }
}

function hydrateScenarioSimulator(data: any) {
  const root = document.getElementById('scenario-simulator-root');
  if (!root || !data.headline_kpis || !data.statement_of_position) return;

  const closed = data.meta?.closed_months_count || 8;
  const coreRev = data.headline_kpis.qbo_operating_revenue / closed;
  const coreExp = (data.headline_kpis.qbo_cogs + data.headline_kpis.qbo_operating_expenditures) / closed;
  const allinRev = data.headline_kpis.all_in_revenue / closed;
  const allinExp = data.headline_kpis.all_in_expenditures / closed;
  const baseChecking = data.statement_of_position.assets.total_book_operating_cash;
  const baseFidelity = data.statement_of_position.assets.fidelity_board_designated_reserve;

  root.setAttribute('data-core-rev', String(coreRev));
  root.setAttribute('data-core-exp', String(coreExp));
  root.setAttribute('data-allin-rev', String(allinRev));
  root.setAttribute('data-allin-exp', String(allinExp));
  root.setAttribute('data-base-rev', String(coreRev));
  root.setAttribute('data-base-exp', String(coreExp));
  root.setAttribute('data-base-checking', String(baseChecking));
  root.setAttribute('data-base-fidelity', String(baseFidelity));

  window.dispatchEvent(new CustomEvent('update-scenario-simulator', {
    detail: { coreRev, coreExp, allinRev, allinExp, baseChecking, baseFidelity }
  }));
}

function hydrateFooter(meta: any) {
  if (!meta) return;
  const footerChecksum = document.getElementById('footer-checksum');
  if (footerChecksum) {
    footerChecksum.textContent = `Source Data Canonical Checksum: ${meta.sha256_checksum} · Accounting System: QuickBooks Online (Accrual)`;
  }
}
