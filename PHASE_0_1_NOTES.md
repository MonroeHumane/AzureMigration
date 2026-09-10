# Phase 0–1 Notes (safety net + safe style cleanup)

Branch: `chore/phase-0-1-style-cleanup`

## What changed

### Phase 0 — safety net
- **`frontend/tools/verify-parity.py`**: retired the anti-Tailwind hard fail. Tailwind on non-home pages (staff portal, games, etc.) is expected and allowed. Homepage still has an *optional* wp-block smoke (warnings only). Hard checks remain: HTTP status, required class signatures, WP artifact sweeps, broken internal refs. Homepage required signature updated from dead `hs-news-2025review` → current `home-nl`.
- **`visual-test`**: audited `backstop.json`. It is **not** circular today — scenarios compare Azure SWA (`url`) to WordPress `monroe-humane.org` (`referenceUrl`). Documented in `visual-test/package.json` and disabled the default `npm test` exit-0-style trap (now fails closed with guidance). Added `npm run backstop:check-config` to refuse SWA-vs-SWA misconfiguration. Kept `backstop.json` and engine scripts; deleted bulky scrape dumps only (see Phase 1).

### Phase 1 — safe style cleanup
- **Deleted** unused `frontend/src/styles/humane-games-launcher.css` (not imported by BaseLayout, games pages, or components; games UI is Tailwind-in-page). Left `frontend/public/assets/humane-games-launcher.*` alone (separate public asset path; out of scope / higher risk).
- **`monroe-home.css`**: surgically removed dead old-newsletter selectors only (`#hs-news-2025review`, `.monroe-home-newsletter-slot`, shortcode leftovers). **Kept** all `.home-nl` / current newsletter band styles. `monroe-home-widgets.css` had no matching dead selectors.
- **`staff-theme.css`**: moved off public `BaseLayout.astro` onto `StaffPortalLayout.astro`, plus `pages/internal/index.astro` (login gate uses BaseLayout directly). Public pages no longer load staff theme; staff portal pages still do.
- **Hygiene deletes**: `frontend/lighthouse-report.report.html`, `frontend/lighthouse-report.report.json`, empty `frontend/build_*.txt`, `visual-test/inline.txt`, `visual-test/live-style.css`, `visual-test/live-styles-info.json`. Kept `visual-test/backstop.json` and meaningful configs.

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
- `frontend/public/assets/humane-games-launcher.css|js` and recovered mirror copies remain; confirm no runtime `<link>`/`<script>` before a later delete.
- `board/print.astro` is a standalone print document (no layout / no staff-theme) — intentional.
- Visual Backstop is still a manual tool, not a CI gate; WP vs SWA diffs can be noisy during cutover.
- Moving `staff-theme.css` off BaseLayout reduces public CSS weight but depends on every staff entrypoint importing it (StaffPortalLayout + `/internal/` login covered; print packet excluded on purpose).

## Explicitly NOT touched

- Homepage WP markup / content structure
- Bulk of `monroe-home.css` / `monroe-home-widgets.css` (beyond dead newsletter selectors)
- `monroe-wp-compat.css`, `monroe-theme.css`
- Redesign / visual restyle of public chrome
