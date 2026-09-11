# Post-cutover / custom-domain smoke checklist

Use after pointing `monroe-humane.org` (and `www`) at Azure Static Web Apps. Until DNS flips, run the same paths against the SWA default hostname.

**Do not** gate CI on this list without deploy secrets — it is a manual ops checklist.

## Confirm stack

- [ ] Response is **Astro / Azure SWA**, not Hostinger WordPress (`wp-content`, `x-powered-by: PHP`, LiteSpeed).
- [ ] HTTPS works on apex and `www` (redirect or both serving SWA).

## Public paths

- [ ] `/` — homepage loads (native sections, no WP chrome)
- [ ] `/adopt` — pet grid / filters
- [ ] `/donate` — Zeffy embed frames (CSP allows `https://www.zeffy.com`)
- [ ] `/events` and `/events.ics` — calendar + ICS
- [ ] `/newsletter/` and a known issue URL (e.g. `/newsletter/issue/september-2026/`)
- [ ] `/games` — cabinet hub
- [ ] `/contact` — phone/mailto; form opens mail client (no server email send)
- [ ] `/shop` and `/membership` — WIP + `noindex` (do not expect commerce)

## Staff

- [ ] `/internal` — staff login still works
- [ ] One board/financials view loads (donor JSON is optional local restore — see `api/data/README.md`)

## After soak

- [ ] Update README “Primary Domain” only when apex truly serves SWA
- [ ] Keep Hostinger rollback until 24–72h soak looks clean

Storage account / resource names: prefer `.env.example` as the repo source of truth, then **verify in the Azure portal** before changing infra or docs.
