# Staff Theme Notes — Phase 6 (CSS variables)

**Branch:** `chore/staff-theme-css-vars`  
**Date:** 2026-09-10  
**Scope:** Staff portal only (`frontend/src/styles/staff-theme.css`). No public site CSS changes.

## How theme toggle works (smoke checklist)

1. `BaseLayout.astro` inline script reads `localStorage.mchs_staff_theme` before paint and sets:
   - `document.documentElement[data-staff-theme]` = `light` | `dark`
   - class `dark` on `<html>` when dark (Tailwind `dark:` variants)
   - `color-scheme` + `meta[name=theme-color]`
2. `StaffThemeBootstrap.astro` side-effect-imports `staff-theme.css` for staff entrypoints that skip `StaffPortalLayout`.
3. `frontend/src/lib/staff-theme.ts` — `setStaffTheme` / `toggleStaffTheme` / `initStaffThemeToggle` keep `data-staff-theme`, `.dark`, and toggle button labels in sync.
4. **Do not** remove `data-staff-theme` or the pre-paint BaseLayout sync — flash/FOUC and broken Dark Ops would follow.

## What this PR converted (batch 1)

Native foundation on `:root` / `[data-staff-theme="light"|"dark"]`:

- Surfaces: `--sp-bg`, `--sp-surface*`, `--sp-header-*`, `--sp-sidebar-*`, `--sp-card-*`
- Text: `--sp-text-body|primary|secondary|muted|ink|faint`, `--sp-metric`
- Accent/brand/links, badges/status, borders/dividers, danger, tab/nav, sidebar-nav tokens
- Tailwind-oriented aliases: `--color-staff-bg|surface|border|text|muted|accent`

Shared (theme-agnostic) var-driven rules:

- Body color → `--sp-text-body`
- `.staff-portal-header` shell + brand text/icon/pill
- `.sidebar-root` shell + `.sidebar-header` / brand chip/title/subtitle
- Portal `h1–h4.text-white` titles → `--sp-text-primary`
- Hub return links → `--sp-link*`
- Theme toggle button chrome → surface/border/text vars (dark keeps accent ink)

Light-mode first-batch overrides remapped to vars (still `!important` where fighting Tailwind):

- Header live-status / return / logout / email
- `.staff-nav-btn` (+ active/hover)
- Directus admin chip
- Desktop sidebar cmd-k, section headings, nav links/icons, footer/user (staff-theme.css copy)
- Card utility remaps (`bg-[#0b2420…]`), hero gradient, metrics, slate meta, LIVE badge, card footers

## Remaining debt (estimate)

| Metric | Approx. |
|--------|---------|
| Total `!important` in `staff-theme.css` | ~510 (mostly still required vs Tailwind utilities) |
| Hardcoded hex/rgba still on `!important` declarations | ~350–400 (batch 1 removed a slice; foundation enables more) |
| `var(--sp-*)` property uses | ~140+ (was ~7) |

### Next conversion targets (priority)

1. **Mobile bottom nav + more sheet** light remaps → surface/border/text tokens; Dark Ops dock already special-cased.
2. **Command palette + FAB** light blocks → `--sp-card-*` / `--sp-surface-*`.
3. **Tool cards / grants / CMS tabs / filter pills** dark+light pairs → collapse to shared vars.
4. **DesktopSidebar.astro `<style is:global>`** — ~60 `!important` light rules + dark block **duplicate** staff-theme sidebar; migrate to vars then delete duplicate light overrides.
5. **Tailwind utility soup** (`.bg-teal-950\/80`, `.text-slate-400`, arbitrary `bg-[#…]`) — longer term: change markup to semantic classes / `bg-[var(--sp-card-bg)]` so `!important` can drop.
6. Wire `--color-staff-*` into `tailwind.config` theme.extend.colors when ready (optional; not required for batch 1).

## Blockers / risks

- **Visual parity:** Many staff pages encode Dark Ops in Tailwind `dark:` + arbitrary hex; light mode is a large override layer. Collapsing too aggressively without matching tokens causes light/dark drift.
- **Duplicate CSS:** `DesktopSidebar.astro` global styles still own dark sidebar chrome; shared `.sidebar-root` now uses vars with `!important` so it wins — keep `--sp-sidebar-*` / icon-box tokens aligned with that component.
- **Exceptions that must stay pinned:** `.drill-flow-header`, `.certified-footing` (always white-on-brand bars) — do not theme via body text tokens.
- No automated visual regression for staff portal in CI yet (manual smoke: toggle Light ↔ Dark Ops on `/internal/` hub + sidebar).

## Out of scope

- Full `!important` purge
- Public `monroe-*.css` / homepage
- Rewriting all staff Astro markup off dark-first utilities in one shot
