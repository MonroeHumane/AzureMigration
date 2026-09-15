# Agent notes — AzureMigration

## Repo layout
- `frontend/` — Astro site; games live under `frontend/public/games/<id>/` (plain ES modules + canvas, NOT covered by `astro check` — CI runs `node --check` on them).
- `arcade/` — PHP arcade API (Apache + Phinx). Migrations: `arcade/db/migrations/` ONLY (`arcade/migrations/` was a dead duplicate — removed).
- `api/` — Directus-adjacent Node service. `cron/` — PetSync job. `infra/` — bicep.

## Game architecture (Shelter Run, Flappy Cat, Puppy Skater)
- Shared skeleton: `config / engine / render / ui / arcade / audio / main`. Engine is pure (no DOM) — `window.__sr` debug handle enables deterministic tests.
- Pseudo-3D games need a near-plane clip + fade — projection explodes at the camera otherwise.
- Remote pet photos taint the canvas — keep them in DOM (`crossOrigin` + never `getImageData`).
- Art pipeline: PIL-baked sprites (supersample 3x, cel outline) + procedural FX. Bake once, draw cheap.

## Economy rules
- **Never let the client invent value** — awards, prices, packs, multiplier are server-authoritative (`AdoptedexController.php` owns tables: `UPGRADE_DEFS`, `COIN_AWARD_REASONS`, `DONATION_VALUES`). Client tables in `config.js` are display mirrors.
- Guests/signed-out get a device-local wallet (`sr_coins` in localStorage) mirroring server values + daily caps. Server unreachable → degrade to local, but respect server business rejections (`insufficient`, `maxed`).
- `MonroeAdoptedex` auto-provisions `player-*` users — almost nobody is a true "guest"; the local path is mainly a resilience fallback.
- **Never block UI on network** — overlays render immediately, data streams in. All arcade fetches have 8s timeouts. A hung API must never prevent starting a run.

## Ops runbook
- Prod: RG `MCHS-Platform-RG`, ACA `mchs-arcade-api` (env `mchs-aca-env-prod`), MySQL `mchs-mysql-2urwob6xh6j6s`, db `arcade_db`, user `monroeadmin`. DB password lives in the ACA secret `db-pass`.
- **Migrations**: run automatically in the container entrypoint before Apache. If a prod DB predates phinx tracking, seed `phinxlog` rows for applied migrations first (empty phinxlog = phinx replays everything → crash loop). This exact outage happened 2026-09-14.
- **Direct DB access**: temp firewall rule via ARM REST (`az mysql flexible-server firewall-rule create` intermittently 500s), then `az mysql flexible-server execute`. Remove the rule after. Firewall should only ever contain `AllowAzureServices`.
- **`az containerapp exec` is broken** on `mchs-aca-env-prod` (500 at the exec endpoint) — use the DB path or `containerapp logs show`.
- **Secret rotation**: `az mysql flexible-server update --admin-password` → `az containerapp secret set --secrets db-pass=...` → `az containerapp revision restart`. Brief blip; verified pattern works.
- **Leaderboard reset**: `DELETE FROM arcade_scores` via the firewall path. `dex_match_stats` is per-profile stats, not a leaderboard.

## Testing
- `cd frontend && python tests/shelter_run.py` — 29 browser checks incl. API-down resilience lane. Needs the static server on :8399.
- `cd arcade && node tests/smoke.mjs` — API contract tests (needs local stack: `docker compose up arcade-api arcade-migrate`).
- Test by injecting state (`__sr.cameraZ`, `chase.t`, `effects`), never by waiting on real gameplay — deterministic beats sleeps.

## Windows/headless traps
- `> nul` creates a real file named `nul`. cp1252 consoles can't print emoji/→ (sanitize test output). MSYS mangles paths — `MSYS_NO_PATHCONV=1` when needed.
- `typeof null === 'object'` — guard nullable lookups before `.level` etc.

## Frontend architecture traps
- **Astro View Transitions break Alpine.js**: The @astrojs/alpinejs integration drops state across ClientRouter navigations (e.g., window.history.replaceState). Do not use Alpine directives (x-data, x-show, etc.) for DOM-toggling or interactive components in the Astro site. Use Vanilla JS scripts instead.
