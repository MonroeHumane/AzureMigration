import labels from '../data/board_display_labels.json';

const CATEGORY_DISPLAY = labels.categories as Record<string, string>;
const GROUP_DISPLAY = labels.groups as Record<string, string>;

const CATEGORY_LOOKUP: Record<string, string> = {};
for (const [from, to] of Object.entries(CATEGORY_DISPLAY)) {
  CATEGORY_LOOKUP[from] = to;
  CATEGORY_LOOKUP[from.toLowerCase()] = to;
}

const GROUP_LOOKUP: Record<string, string> = {};
for (const [from, to] of Object.entries(GROUP_DISPLAY)) {
  GROUP_LOOKUP[from] = to;
  GROUP_LOOKUP[from.toLowerCase()] = to;
}

export function displayCategoryName(name: string | undefined | null): string {
  const raw = String(name || '').trim();
  if (!raw) return 'Uncategorized';
  return CATEGORY_LOOKUP[raw] || CATEGORY_LOOKUP[raw.toLowerCase()] || raw;
}

export function displayGroupName(group: string | undefined | null): string {
  const raw = String(group || '').trim();
  if (!raw) return '';
  return GROUP_LOOKUP[raw] || GROUP_LOOKUP[raw.toLowerCase()] || raw;
}

export function legalCategoryName(cat: { legalName?: string; name?: string } | string | null | undefined): string {
  if (!cat) return '';
  if (typeof cat === 'string') return cat;
  return String(cat.legalName || cat.name || '');
}

export type InflowLegendKey = 'gifts' | 'rebates' | 'adoptions' | 'other';

export function inflowLegendKey(group: string | undefined | null): InflowLegendKey {
  const g = displayGroupName(group).toLowerCase();
  const raw = String(group || '').toLowerCase();
  if (g.includes('gift') || raw.includes('contributed')) return 'gifts';
  if (g.includes('rebate') || g.includes('recycl') || raw.includes('community') || raw.includes('other revenue')) return 'rebates';
  if (g.includes('adoption') || g.includes('event') || raw.includes('earned')) return 'adoptions';
  return 'other';
}

export function inflowGroupTone(group: string | undefined | null): {
  dot: string;
  fill: string;
  badge: string;
  border: string;
} {
  const key = inflowLegendKey(group);
  if (key === 'gifts') {
    return { dot: 'bg-teal-600', fill: '#0f766e', badge: 'bg-teal-100 text-teal-800', border: 'border-teal-200' };
  }
  if (key === 'rebates') {
    return { dot: 'bg-sky-500', fill: '#0284c7', badge: 'bg-sky-100 text-sky-800', border: 'border-sky-200' };
  }
  if (key === 'adoptions') {
    return { dot: 'bg-emerald-500', fill: '#059669', badge: 'bg-emerald-100 text-emerald-800', border: 'border-emerald-200' };
  }
  return { dot: 'bg-slate-400', fill: '#94a3b8', badge: 'bg-slate-100 text-slate-700', border: 'border-slate-200' };
}

export function decorateBoardCategory<T extends { name?: string; group?: string; total?: number }>(cat: T): T & {
  legalName: string;
  legalGroup: string;
} {
  const legalName = String(cat.name || '');
  const legalGroup = String(cat.group || '');
  return {
    ...cat,
    legalName,
    legalGroup,
    name: displayCategoryName(legalName),
    group: displayGroupName(legalGroup) || legalGroup,
  };
}

export function isVisibleAmount(amount: number | undefined | null): boolean {
  return Math.abs(Number(amount) || 0) >= 1;
}
