# Homepage native Astro migration notes (Phase 3)

## Goal

Rewrite homepage surfaces one at a time into native Astro + Tailwind components under `frontend/src/components/home/`, following the `/games` success pattern: complete rewrite of one surface, leave unused CSS in `monroe-home.css` / widgets for later purge.

## Converted

| Surface | Component | Notes |
|---------|-----------|--------|
| Newsletter band (`.home-nl` + monroe-news-band card) | `frontend/src/components/home/HomeNewsletterSection.astro` | Teal gradient band + cream letter card; Directus featured/latest issue via existing loaders in `index.astro`; preserves `#Newsletter` + `data-nl-*` hydrate hooks. |
| Featured pets / adopt cards (`#FeaturedPets`) | `frontend/src/components/home/HomeFeaturedPets.astro` | Elevated white card + longest-residents badge/CTAs; Directus `getPets().slice(0, 6)` passed from `index.astro`; Tailwind pet cards + scoped marquee; preserves `#FeaturedPets`, `#featuredPetsWidget`, `#fpwExpandBtn`, `#featuredPetsFsDialog`, `#longestRow` / `.scroll-strip--primary`, and `#fpw-fs-longest` so the existing fullscreen-gallery script still works. Dialog nested under `#featuredPetsWidget` so gallery grid styles apply (was previously a sibling, so orphaned `#featuredPetsWidget dialog…` CSS never matched). |

**Why pets (not testimonials) this PR:** Pets is next in the recommended order, already uses the Directus pets loader on the page, and the strip is a single self-contained band with stable nav IDs. Testimonials are cleaner CSS-wise, but lower priority and not the branch target; deferred below.

## Explicitly not touched

- Hero / cover / `wp-block-cover` / video dim ladder
- Vet partners, auction sponsors, community marquee (`sponsor-widget*`, `sponsor-marquee`)
- Testimonials (`monroe-testimonials`)
- Events rail, accomplishments, FAQ, contact, membership, donations, social, games CTA
- No deletion of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` (orphaned `.home-featured-pets-*`, `#featuredPetsWidget .pet-card-widget` / marquee rules intentionally left)

## Deferred

- **Sponsors widgets** — WP-era shells + marquee clone strips; higher visual-regression risk.
- **Testimonials** — static `reviews.json` grid; low coupling; good follow-up after pets sign-off.
- **Events rail / accomplishments / hero** — as in prior recommended order.

## Recommended next order

1. ~~**Pets cards**~~ ✅ (this PR)
2. **Events rail** (upcoming event hero / flyers rail) — Directus `event_flyers` already loaded on the page.
3. **Accomplishments** (year tabs + outcomes) — uses site settings counts; careful with localStorage staff override.
4. **Sponsors widgets** (vet → auction → marquee) after pets/events stabilize.
5. **Testimonials** (reviews JSON) — low coupling once sponsors path is clear.
6. **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).

## Visual QA checklist (this PR)

- Desktop: elevated white pets card; badge → serif title → intro; primary “Search All Adoptable Pets” + secondary “Full Screen Gallery”.
- Desktop: horizontal marquee of pet cards (pause on hover); clone strip seamless loop.
- Mobile (≤700px): narrower cards; header actions wrap; reduced-motion users get horizontal scroll (no marquee / no clone).
- Fullscreen dialog: expand copies primary-strip cards into `#fpw-fs-longest` grid; Close dismisses; backdrop dims.
- Side dock / Mobile TOC `#FeaturedPets` still scrolls to the section.
- Empty Directus roster: dashed empty state + link to `/adopt`.
- Hero, sponsors, events rail, accomplishments, newsletter unchanged.

## Follow-ups

- Purge orphaned `.home-featured-pets-*` / `#featuredPetsWidget` widget rules only after visual sign-off.
- Purge orphaned `.home-nl*` rules after newsletter sign-off.
- Optional: share card chrome with adopt `PetCard.astro` where parity allows without dragging adopt-page concerns onto home.
