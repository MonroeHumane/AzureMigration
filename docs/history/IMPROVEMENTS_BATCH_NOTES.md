# Improvements Batch Notes — P0–P1 native cleanups

**Branch:** `fix/p0-p1-native-cleanups`  
**Date:** 2026-09-10  
**Base:** `main` after Phase 0–1 PR #1 merge

## Goals

Correctness and hygiene that do **not** rewrite the homepage, purge `monroe-home.css` / `monroe-wp-compat`, or invent Square checkout.

## Decisions & changes

| Item | Decision |
|------|----------|
| `/events.ics` | Runtime Directus `event_flyers` fetch (same filter/sort as `getEventFlyers`). Bundled JSON fallback + `X-Events-Source` + shorter cache when Directus misses. |
| Staff `?token=` | **Removed** from `bearerToken()` in `api/src/index.js`. Auth is header-only (`Authorization` / `X-Staff-Token` / `X-Authorization`). PDF loader no longer appends `token` to `/api/statement` query. Staff login unchanged (POST body). |
| `humane-games-launcher.*` | Deleted from `frontend/public/assets/` and recovered CDN mirrors after zero live references (games hub is Tailwind-in-page). |
| BetterUnite | Removed from CSP `frame-src` and `SITE.integrations.betterUnite`. Zeffy kept; pages use Zeffy embeds only. |
| `/api/inquiry` | Honest **501** when intake is not wired (still validates + honeypot). No “sent to shelter team” claim. Prefer mailto/phone on `/contact`. |
| Shop / membership | Demoted primary Membership CTA; Resources / footer / bottom sheet labeled “(coming soon)”. `noindex` on both pages. Routes stay up; no Square checkout invented. |
| Games orphans | Removed obvious test/widget HTML (`widget.html`, `test-engine-compatibility.html`, `tmp.png`) + SWA 301 → `/games`. Kept petsnake/tycoon/found on disk; hub gains **Legacy games** links. Large music/PNGs deferred. |
| Donor JSON in git | **Deferred removal from tracking.** Strengthened `.gitignore` for `api/data/donor_database.json` + scratch donor/QBO dumps. File still required at runtime via `loadJsonOptional` for `/api/financials` until private artifact store exists. No history rewrite. |
| Docs | `.env.example` storage account aligned to infra/README (`mchsstorage2urwob6xh6j6s`). Master doc games list + CSP wording updated to match hub. |
| CI | Optional `test-site-integrity.cjs` step after build with `continue-on-error: true` (does not block deploy). |

## Deferred (out of scope)

- Phase 3 homepage section rewrite
- Phase 2 heavy global CSS diet / preset purge
- Phase 6 staff-theme `!important` rewrite (follow-up PR when ready)
- Force-removing `api/data/donor_database.json` from git history
- Square membership/shop launch
- Deleting multi-MB game music / tycoon trees (keep deep links)

## Archive note (games)

Legacy HTML games (`petsnake.html`, `petsnakerouguelike.html`, `shelter-tycoon/`, `found/`) are **not** in the primary `GAMES[]` cabinet. They remain reachable and are listed under Legacy on `/games`. Test/widget HTML was redirected to the hub.

## Test plan

1. `GET /events.ics` — valid VCALENDAR; `X-Events-Source: directus` when CMS reachable.
2. Staff login + board financials PDF open still works (Bearer / X-Staff-Token only).
3. Confirm no `humane-games-launcher` network requests on `/games`.
4. CSP: Zeffy donation iframe still loads; no BetterUnite hosts in `staticwebapp.config.json`.
5. `POST /api/inquiry` with valid body → 501 + clear message (honeypot still 200 discard).
6. `/shop` and `/membership` show WIP + `noindex, nofollow`; Membership not in primary CTA row.
7. `/games/widget.html` → 301 `/games`; legacy petsnake link still 200.
8. Deploy workflow still green; integrity step may warn without failing the job.
