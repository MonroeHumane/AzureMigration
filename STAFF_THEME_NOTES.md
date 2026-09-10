# Staff Theme Notes — Phase 6 (CSS variables)

**Branch:** `chore/staff-theme-batch-4`  
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

## What batch 3 converted (merged PR #8)

Table / input / modal / panel / brand-hover / hub-review tokens; PetSync + donor-roster light remaps; Dark Ops tables/cards/modals/inputs/accordion/thead; hub review status. See prior notes history in git.

## What batch 4 converted

New / expanded tokens (light + dark):

- Pill families: `--sp-pill-{emerald,teal,amber,rose,purple,blue,slate,sky,pink,success}-{bg|text|border}`
- Tool brand-tint: `--sp-tool-zeffy`, `--sp-tool-grantable`, `--sp-tool-aawa`

Remaps:

- Light high-contrast pastel text (teal/emerald/rose/amber/purple/blue/sky/slate-100/200) → pill / body tokens
- Light hero action buttons (board print + Directus) → surface / brand / accent / brand-hover
- Light card icon badges (`bg-teal-950*`) → `--sp-icon-box-*` / `--sp-brand`
- Light subnav pills → surface-subtle / muted / brand
- Light hero gradient card soft shadow → `--sp-tab-shadow`
- Standalone `.text-teal-400` + `.text-white` on brand buttons → accent-hover / on-accent
- Grants tool tint links (light + Dark Ops) → `--sp-tool-*`
- Dark Ops pastel utility soup (emerald/teal/amber/rose/purple/blue/indigo/sky bg+text) → `--sp-pill-*`
- Grants `.badge-status.*` / `.badge-source.*` Dark Ops → pill families (success/sky/pink/slate)

**Still pinned (do not theme via body text tokens):** `.drill-flow-header`, `.certified-footing` (white-on-brand bars). Print-packet emerald chip on dark control also stays hardcoded.

## Remaining debt (estimate)

| Metric | Approx. |
|--------|---------|
| Total `!important` in `staff-theme.css` | ~523 (still required vs Tailwind utilities) |
| Hardcoded hex/rgba still on `!important` declarations | ~13 (down from ~97 after batch 3; almost all pinned drill/certified/print + one cms-tab translucent white) |
| `var(--sp-*)` property uses | ~504 |

### Next conversion targets (priority)

1. **Utility soup** (`.bg-teal-950/80`, `.text-slate-400`, arbitrary `bg-[#…]` still in markup) — change markup to semantic classes so `!important` can drop
2. Wire `--color-staff-*` into `tailwind.config` theme.extend.colors when ready
3. Optional: dark cmd-K / FAB shared rules; staff-data-status banners → warn/status tokens; cms-tab active icon `rgba(255,255,255,0.2)` → token
4. Drawer share-track fills (`#10b981` / `#94a3b8`) if monthly statement should flip with theme

## Blockers / risks

- **Visual parity:** Grants badge-status `applied` border previously used a slightly brighter blue (`rgba(96,165,250,0.4)`); now shares `--sp-pill-blue-border`. Badge-source `manual` text was `#cbd5e1`, now `--sp-text-secondary` (dark). Hero print button shadow uses `--sp-tab-shadow` (same 0 1px 2px family). Smoke grants badges + hub hero buttons + pastel chips in both themes.
- **Exceptions that must stay pinned:** `.drill-flow-header`, `.certified-footing` (intentionally keep hardcoded white/pastel-on-brand).
- No automated visual regression for staff portal in CI yet (manual smoke: Light ↔ Dark Ops on `/internal/` hub, grants badges, pastel status chips, hero print/Directus, subnav pills, icon badges).

## Out of scope

- Full `!important` purge
- Public `monroe-*.css` / homepage
- Rewriting all staff Astro markup off dark-first utilities in one shot
