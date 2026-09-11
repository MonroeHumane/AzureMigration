# Staff Theme Notes — Phase 6 (CSS variables)

**Branch:** `chore/staff-theme-phase6-batch`  
**Date:** 2026-09-11  
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

## What batch 4 converted (merged PR #10)

Pill families + tool brand-tint; pastel/hero/metric/subnav remaps. See prior notes history in git.

## What batch 5 converted

New / expanded tokens (light + dark):

- Status banners: `--sp-banner-{loading,error,retry}-{bg|border|text}`
- PWA install card: `--sp-pwa-{card-bg,card-border,title,desc,icon-*,btn-*}`
- CMS active tab chip: `--sp-tab-active-chip-bg`
- Month-drawer share bars: `--sp-share-{track,rev,exp}`
- FAB primary button: `--sp-fab-btn-{bg,text,border,hover}`

Remaps / collapses:

- `.staff-data-status--*` + `__retry` → banner tokens (drop duplicate Dark Ops hex blocks)
- `.pwa-install-*` → `--sp-pwa-*` (drop duplicate Dark Ops hex blocks)
- `.sheet-mode-chip` → `--sp-pill-emerald-*` (tokens flip; drop dark-only override)
- `.cms-tab-btn.active div` → `--sp-tab-active-chip-bg` (shared; was light-only rgba)
- Cmd-K palette → shared surface/input/text tokens (was light-only remaps)
- FAB panel + emerald button → dock / `--sp-fab-btn-*` (shared both themes)
- `#monthly-statement-root .drawer-share-*` → `--sp-share-*` (now flips with theme)

**Still pinned (do not theme via body text tokens):** `.drill-flow-header`, `.certified-footing` (white-on-brand bars). Print-packet emerald chip on dark control also stays hardcoded.

## Remaining debt (estimate)

| Metric | Approx. |
|--------|---------|
| Total `!important` in `staff-theme.css` | ~513 (still required vs Tailwind utilities) |
| Hardcoded hex/rgba still on `!important` declarations | ~12 (down from ~13; pinned drill/certified/print only) |
| `var(--sp-*)` property uses | ~518 |

### Next conversion targets (priority)

1. **Utility soup** (`.bg-teal-950/80`, `.text-slate-400`, arbitrary `bg-[#…]` still in markup) — change markup to semantic classes so `!important` can drop
2. Wire `--color-staff-*` into `tailwind.config` theme.extend.colors when ready
3. Optional: further light-only remaps that can become shared once markup is semantic
4. Cream/sand card headers (`#f5efe3` / `#fbf9f5`) → dedicated surface tokens if Dark Ops remap should stay centralized

## Blockers / risks

- **Visual parity:** Dark Ops sheet-mode-chip now uses pill-emerald (was a slightly different emerald-500 tint). PWA / banners preserve prior hex via dedicated tokens. Share bars now dim in Dark Ops (intentional theme flip). Smoke Cmd-K + FAB in both themes after shared promotion.
- **Exceptions that must stay pinned:** `.drill-flow-header`, `.certified-footing` (intentionally keep hardcoded white/pastel-on-brand).
- No automated visual regression for staff portal in CI yet (manual smoke: Light ↔ Dark Ops on `/internal/` hub + key internal pages).

## Out of scope

- Full `!important` purge
- Public `monroe-*.css` / homepage
- Rewriting all staff Astro markup off dark-first utilities in one shot
