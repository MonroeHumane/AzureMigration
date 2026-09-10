# Staff Theme Notes — Phase 6 (CSS variables)

**Branch:** `chore/staff-theme-batch-2`  
**Date:** 2026-09-10  
**Scope:** Staff portal only (`frontend/src/styles/staff-theme.css` + `DesktopSidebar.astro` theme chrome). No public site CSS changes.

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

## What batch 2 converted

New / expanded tokens:

- Dock / sheet / cmd / FAB shadows: `--sp-dock-*`, `--sp-sheet-shadow`, `--sp-cmd-shadow`, `--sp-fab-shadow`
- Sidebar cmd + chrome helpers: `--sp-sidebar-cmd-*`, `--sp-sidebar-section`, `--sp-sidebar-external*`, `--sp-sidebar-avatar-*`, `--sp-sidebar-active-shadow`
- Logout pair: `--sp-logout-bg|hover-*` (light white / dark rose panel)

Shared var-driven rules added in `staff-theme.css`:

- `.sidebar-cmd-btn` / kbd / section heading / `.sidebar-nav-link` (+ icons) / footer / user / logout
- `#mobile-bottom-nav-dock` collapsed light+dark → `--sp-dock-*`
- `.cms-tab-btn` + `.cms-item-btn` + `.tool-card` / `.grants-portal` shell → tab/card tokens
- Light mobile more-sheet remaps → surface/text/icon/danger tokens
- Cmd-K + FAB light blocks → surface/card/dock tokens
- Dark filter pills / chips → tab tokens; sheet footer → logout/sidebar tokens
- `.sheet-choice-btn` / `.sheet-mode-chip` (partial) → surface/badge tokens

`DesktopSidebar.astro`:

- Removed ~60 duplicate light `!important` hex rules + dark chrome block
- Keeps scrollbar only; theme chrome now owned by shared `.sidebar-root` / class rules in `staff-theme.css`

**Still pinned (do not theme via body text tokens):** `.drill-flow-header`, `.certified-footing` (white-on-brand bars).

## Remaining debt (estimate)

| Metric | Approx. |
|--------|---------|
| Total `!important` in `staff-theme.css` | ~525 (still required vs Tailwind utilities; DesktopSidebar theme `!important` ≈ 0) |
| Hardcoded hex/rgba still on `!important` declarations | ~180 (down from ~350–400 after batch 1) |
| `var(--sp-*)` property uses | ~340+ |

### Next conversion targets (priority)

1. **PetSync / donor roster / table / modal** dark+light remaps → card/surface tokens
2. **Utility soup** (`.bg-teal-950/80`, `.text-slate-400`, arbitrary `bg-[#…]`) — change markup to semantic classes so `!important` can drop
3. **Badge / status / pastel remaps** still hex-heavy in both themes
4. Wire `--color-staff-*` into `tailwind.config` theme.extend.colors when ready
5. Optional: add dark cmd-K / FAB shared rules (today light-only remaps; dark relies on markup)

## Blockers / risks

- **Visual parity:** Collapsing CMS tabs / tool cards onto `--sp-tab-*` / `--sp-card-*` slightly shifts Dark Ops active teal (`#0d9488` → `--sp-tab-active-bg` / accent-hover). Smoke both themes on CMS + grants.
- **DesktopSidebar ownership:** Sidebar look now depends on `staff-theme.css` load order; do not reintroduce component-local hex chrome without tokens.
- **Exceptions that must stay pinned:** `.drill-flow-header`, `.certified-footing`.
- No automated visual regression for staff portal in CI yet (manual smoke: Light ↔ Dark Ops on `/internal/` hub, mobile dock/sheet, sidebar, cmd-K, grants/CMS).

## Out of scope

- Full `!important` purge
- Public `monroe-*.css` / homepage
- Rewriting all staff Astro markup off dark-first utilities in one shot
