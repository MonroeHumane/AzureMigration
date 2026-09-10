# Staff Theme Notes — Phase 6 (CSS variables)

**Branch:** `chore/staff-theme-batch-3`  
**Date:** 2026-09-10  
**Scope:** Staff portal only (`frontend/src/styles/staff-theme.css`). No public site CSS changes. No DesktopSidebar edits this batch.

## How theme toggle works (smoke checklist)

1. `BaseLayout.astro` inline script reads `localStorage.mchs_staff_theme` before paint and sets:
   - `document.documentElement[data-staff-theme]` = `light` | `dark`
   - class `dark` on `<html>` when dark (Tailwind `dark:` variants)
   - `color-scheme` + `meta[name=theme-color]`
2. `StaffThemeBootstrap.astro` side-effect-imports `staff-theme.css` for staff entrypoints that skip `StaffPortalLayout`.
3. `frontend/src/lib/staff-theme.ts` — `setStaffTheme` / `toggleStaffTheme` / `initStaffThemeToggle` keep `data-staff-theme`, `.dark`, and toggle button labels in sync.
4. **Do not** remove `data-staff-theme` or the pre-paint BaseLayout sync — flash/FOUC and broken Dark Ops would follow.

## What batch 1 converted (merged PR #4)

Native foundation on `:root` / `[data-staff-theme="light"|"dark"]` plus shared header/sidebar shell, first light remaps to `var(--sp-*)`.

## What batch 2 converted (merged PR #6)

Dock / sheet / cmd / FAB / sidebar cmd chrome / logout pair; CMS tabs + tool-card shells; DesktopSidebar theme hex dedupe. See prior notes history in git.

## What batch 3 converted

New / expanded tokens (light + dark):

- Table: `--sp-table-bg|border|text`, `--sp-th-bg|text`, `--sp-td-text`, `--sp-tr-hover-bg`
- Input: `--sp-input-bg|border|text|placeholder|focus-bg|focus-border`
- Modal: `--sp-modal-bg|border`
- Panel / drawer: `--sp-panel-bg|nested-bg|thead-bg`, `--sp-muted-panel-bg`
- Brand helpers: `--sp-brand-hover`, `--sp-on-brand-accent`
- Hub review: `--sp-review-live`, `--sp-warn-text`, `--sp-review-error`

Remaps:

- PetSync light summary cards → `--sp-card-*` / `--sp-text-secondary`
- Donor roster light (cards, inputs, thead, row hover, export CSV btn) → card/input/th/brand tokens
- Dark Ops tables (container/th/td/hover/title) → table tokens
- Dark Ops comprehensive `.bg-white` / slate text / slate-50 panels / inputs → card/surface/input tokens
- Dark Ops `dialog.modal` / `.modal-content` → modal tokens
- Dark Ops sand/cream sub-headers → `--sp-header-bg` / text-primary
- Scoped dark inputs + focus/placeholder → input tokens
- Accordion / vendor / drawer panels → panel tokens
- Dark thead / opacity-slash header rows → th tokens
- Hub PetSync/financials/census review status (live/stale/error) → review/warn tokens; dark-only overrides collapsed (tokens flip)

**Still pinned (do not theme via body text tokens):** `.drill-flow-header`, `.certified-footing` (white-on-brand bars).

## Remaining debt (estimate)

| Metric | Approx. |
|--------|---------|
| Total `!important` in `staff-theme.css` | ~513 (still required vs Tailwind utilities) |
| Hardcoded hex/rgba still on `!important` declarations | ~97 (down from ~170 after batch 2 / ~350–400 after batch 1) |
| `var(--sp-*)` property uses | ~410+ |

### Next conversion targets (priority)

1. **Badge / status / pastel remaps** (emerald/teal/amber/rose/purple/blue dark pill soup) — introduce `--sp-pill-*` families or semantic status tokens
2. **Utility soup** (`.bg-teal-950/80`, `.text-slate-400`, arbitrary `bg-[#…]`) — change markup to semantic classes so `!important` can drop
3. **Hero / metric accent hex** still on light remaps; grants tool brand-tint link colors
4. Wire `--color-staff-*` into `tailwind.config` theme.extend.colors when ready
5. Optional: dark cmd-K / FAB shared rules; staff-data-status banners → warn/status tokens

## Blockers / risks

- **Visual parity:** PetSync card shadow now uses full `--sp-card-shadow` (two-layer) vs prior single soft shadow — slight elevation shift in light. Dark input `bg-slate-50` remaps unified onto `--sp-input-bg` (was a slightly greener `rgba(4,47,46,0.5)`). Smoke donor roster + PetSync + expense drawers in both themes.
- **Exceptions that must stay pinned:** `.drill-flow-header`, `.certified-footing` (intentionally keep hardcoded white/pastel-on-brand).
- No automated visual regression for staff portal in CI yet (manual smoke: Light ↔ Dark Ops on `/internal/` hub, PetSync, donor roster, tables/modals, expense accordion drawers).

## Out of scope

- Full `!important` purge
- Public `monroe-*.css` / homepage
- Rewriting all staff Astro markup off dark-first utilities in one shot