# Phase 0–1 Notes (safety net + safe style cleanup)

Branch: `chore/phase-0-1-style-cleanup`

## What changed

### Phase 0 — safety net
- **`frontend/tools/verify-parity.py`**: retired the anti-Tailwind hard fail. Tailwind on non-home pages (staff portal, games, etc.) is expected and allowed. Homepage still has an *optional* wp-block smoke (warnings only). Hard checks remain: HTTP status, required class signatures, WP artifact sweeps, broken internal refs. Homepage required signature updated from dead `hs-news-2025review` → current `home-nl`.
- **`visual-test`**: audited `backstop.json`. It is **not** circular today — scenarios compare Azure SWA (`url`) to WordPress `monroe-humane.org` (`referenceUrl`). Documented in `visual-test/package.json` and disabled the default `npm test` trap (now fails closed with guidance). Added `npm run backstop:check-config` to refuse SWA-vs-SWA misconfiguration. Kept `backstop.json` and engine scripts; deleted bulky scrape dumps (Phase 1).

### Phase 1 — safe style cleanup
- **Deleted** unused `frontend/src/styles/humane-games-launcher.css` (not imported by BaseLayout, games pages, or components; games UI is Tailwind-in-page). Left `frontend/public/assets/humane-games-launcher.*` alone (separate public asset path; out of scope / higher risk).
- **`monroe-home.css` dead-newsletter cleanup**: **SKIPPED mid-flight** — cleaned content was prepared (remove `#hs-news-2025review`, `.monroe-home-newsletter-slot`, shortcode leftovers; keep `.home-nl`), but pushing the ~104KB file via GitHub MCP exceeded practical payload limits for this executor path. Residual risk: unused dead selectors remain in `monroe-home.css` (homepage already uses `.home-nl`; no visual change expected). Follow-up: apply the prepared surgical delete from a clone or smaller chunked PR.
- **`staff-theme.css`**: removed from public `BaseLayout.astro`. Staff pages still load it via `StaffPortalLayout.astro` plus `MobileBottomNav.astro` (covers `/internal` login gate which uses BaseLayout directly). Also added helper `StaffThemeBootstrap.astro` for explicit opt-in if needed later.
- **Hygiene deletes**: lighthouse reports, empty `frontend/build_*.txt`, `visual-test/inline.txt`, `visual-test/live-style.css`, `visual-test/live-styles-info.json`. Kept `visual-test/backstop.json` and meaningful configs.

## Smoke routes (manual / verify-parity)

Prefer local or preview, then:

- `/` (home — `home-nl`, hero, widgets)
- `/adopt`, `/games`, `/newsletter`
- `/internal/` (login gate — staff theme + toggle)
- One authenticated staff route via StaffPortalLayout (e.g. `/internal/pets`)

```bash
cd frontend && python tools/verify-parity.py http://localhost:4321
```

## Residual risks

- Homepage still carries large WP-compat / `monroe-home*` CSS surface; this PR does **not** rewrite or redesign the homepage.
- Dead old-newsletter selectors still present in `monroe-home.css` (skipped push); unused but not deleted yet.
- `frontend/public/assets/humane-games-launcher.css|js` and recovered mirror copies remain; confirm no runtime `<link>`/`<script>` before a later delete.
- `board/print.astro` is a standalone print document (no layout / no staff-theme) — intentional.
- Visual Backstop is still a manual tool, not a CI gate; WP vs SWA diffs can be noisy during cutover.
- Staff theme on `/internal` relies on `MobileBottomNav` remaining in that page’s component tree (it does today).

## Explicitly NOT touched

- Homepage WP markup / content structure
- Bulk of `monroe-home.css` / `monroe-home-widgets.css` (dead-newsletter delete skipped; see above)
- `monroe-wp-compat.css`, `monroe-theme.css`
- Redesign / visual restyle of public chrome
