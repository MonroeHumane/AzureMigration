# Homepage native Astro migration notes (Phase 3)

## Goal

Rewrite homepage surfaces one at a time into native Astro + Tailwind components under `frontend/src/components/home/`, following the `/games` success pattern: complete rewrite of one surface, leave unused CSS in `monroe-home.css` / widgets for later purge.

## Converted in this PR

| Surface | Component | Notes |
|---------|-----------|--------|
| Newsletter band (`.home-nl` + monroe-news-band card) | `frontend/src/components/home/HomeNewsletterSection.astro` | Teal gradient band + cream letter card; Directus featured/latest issue via existing `getFeaturedNewsletterIssue` / `getNewsletterIssues` loaders in `index.astro`; fallbacks from `homepage.json`. Preserves `#Newsletter`, `data-newsletter-home`, and `data-nl-*` hooks so `hydrateHomeNewsletter()` still works. |

**Sponsors / testimonials:** deferred (see below).

## Explicitly not touched

- Hero / cover / `wp-block-cover` / video dim ladder
- Vet partners, auction sponsors, community marquee (`sponsor-widget*`, `sponsor-marquee`)
- Testimonials (`monroe-testimonials`)
- Pets strip, events rail, accomplishments, FAQ, contact, membership, donations, social, games CTA
- No deletion of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` (unused `.home-nl*` rules intentionally left)

## Why sponsors were deferred

- Not adjacent to the newsletter block (vet / auction / marquee sit earlier; testimonials mid-page; newsletter near the bottom).
- Tightly coupled to WP-era widget shells (`.sponsor-widget-shell`, `.sponsor-grid`, marquee duplication / clone strips) and widget CSS in `monroe-home-widgets.css`.
- Higher visual-regression risk than the already-modern `.home-nl` card.
- Branch name kept `…newsletter-sponsors` for the Phase 3 track; sponsors land in a follow-up once newsletter ships cleanly.

## Recommended next order

1. **Pets cards** (`#FeaturedPets` / featured pet strip + fullscreen dialog) — high traffic, already somewhat componentized (`PetCard` exists for adopt).
2. **Events rail** (upcoming event hero / flyers rail) — Directus `event_flyers` already loaded on the page.
3. **Accomplishments** (year tabs + outcomes) — uses site settings counts; careful with localStorage staff override.
4. **Sponsors widgets** (vet → auction → marquee) after pets/events stabilize.
5. **Testimonials** (reviews JSON) — low coupling once sponsors path is clear.
6. **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).

## Visual QA checklist (this PR)

- Desktop: newsletter band teal gradient, cream card, photo | letter two-column, hierarchy (gold label → white masthead → cream card title in Abril).
- Mobile (≤800px): single column; photo `16:9`; buttons wrap.
- Client hydrate: featured Directus issue still updates label/title/excerpt/PDF when CMS differs from SSG.
- Side dock / Mobile TOC `#Newsletter` still scrolls to the section.
- Hero cover unchanged.

## Follow-ups

- Purge orphaned `.home-nl*` / `.is-style-monroe-news-band` rules only after visual sign-off and when no other page references them.
- Optional: move `formatDate` helper shared with other home components into `lib/dates.ts`.