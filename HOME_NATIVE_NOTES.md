# Homepage native Astro migration notes (Phase 3)

## Goal

Rewrite homepage surfaces one at a time into native Astro + Tailwind components under `frontend/src/components/home/`, following the `/games` success pattern: complete rewrite of one surface, leave unused CSS in `monroe-home.css` / widgets for later purge.

## Converted

| Surface | Component | Notes |
|---------|-----------|--------|
| Newsletter band (`.home-nl` + monroe-news-band card) | `frontend/src/components/home/HomeNewsletterSection.astro` | Teal gradient band + cream letter card; Directus featured/latest issue via existing loaders in `index.astro`; preserves `#Newsletter` + `data-nl-*` hydrate hooks. |
| Featured pets / adopt cards (`#FeaturedPets`) | `frontend/src/components/home/HomeFeaturedPets.astro` | Elevated white card + longest-residents badge/CTAs; Directus `getPets().slice(0, 6)` passed from `index.astro`; Tailwind pet cards + scoped marquee; preserves `#FeaturedPets`, `#featuredPetsWidget`, `#fpwExpandBtn`, `#featuredPetsFsDialog`, `#longestRow` / `.scroll-strip--primary`, and `#fpw-fs-longest` so the existing fullscreen-gallery script still works. Dialog nested under `#featuredPetsWidget` so gallery grid styles apply (was previously a sibling, so orphaned `#featuredPetsWidget dialog…` CSS never matched). |
| Events band + flyers rail (`#Events`) | `frontend/src/components/home/HomeEventsSection.astro` | Winner/feature card + next-event hero (pet slideshow + calendar CTAs) + horizontal upcoming flyers strip. Next-event + rail use the same Directus `getEventFlyers()` path as `/events` (upcoming by `event_date`). Preserves `#Events`, `data-home-nav-section="Events"`, and `hs-shirt-artwork-contest-title`. Legacy side `.home-editable-flyers-rail` markup was already absent from `index.astro` (body still carries `home-editable-has-flyers-rail` for theme CSS); native rail restores flyer thumbnails from Directus images. |
| Testimonials / Community Voices (`#Testimonials`) | `frontend/src/components/home/HomeTestimonialsSection.astro` | Static `reviews.json` grid + Google rating summary header; Tailwind parity with `.monroe-testimonials` cards; preserves `#Testimonials` for Header `/#Testimonials` + side-dock. |

## Explicitly not touched

- Hero / cover / `wp-block-cover` / video dim ladder
- Vet partners, auction sponsors, community marquee (`sponsor-widget*`, `sponsor-marquee`)
- Accomplishments (year tabs + outcomes / localStorage staff override)
- FAQ, contact, membership, donations, social, games CTA, supporter story
- No deletion of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` (orphaned events / testimonials / `.home-nl*` / pets widget rules intentionally left)

## Deferred

- **Sponsors widgets** — WP-era shells + marquee clone strips; higher visual-regression risk.
- **Accomplishments** — uses site settings counts; careful with localStorage staff override.
- **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).
- **CSS purge** — orphaned `.home-editable-upcoming-event-*`, `.home-editable-events-band`, `.monroe-testimonials*`, `.home-editable-flyers-rail*`, `.hs-feature-widget.home-editable-events-winner`, `.home-nl*`, pets widget rules after visual sign-off.

## Recommended next order

1. ~~**Pets cards**~~ ✅
2. ~~**Events rail**~~ ✅ (this PR)
3. ~~**Testimonials**~~ ✅ (this PR)
4. **Accomplishments** (year tabs + outcomes) — uses site settings counts; careful with localStorage staff override.
5. **Sponsors widgets** (vet → auction → marquee) after events/testimonials sign-off.
6. **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).

## Visual QA checklist (this PR)

### Events (`#Events`)
- Desktop: centered winner/feature card (green serif title, note callout, letter link) above next-event hero.
- Desktop: next-event hero two-column (pet slideshow | copy + pills + primary/outline buttons + Google/.ics when Directus flyer present).
- Desktop: horizontal upcoming flyers rail when Directus flyers have images; “All events” → `/events`.
- Mobile: stacked slideshow above copy; flyer rail scrolls horizontally.
- Reduced-motion: slideshow shows first pet only (no crossfade).
- Side dock / Mobile TOC `#Events` still scrolls to the section.
- Empty upcoming flyers: rail omitted; next-event falls back to `homepage.json` `next_event`.

### Testimonials (`#Testimonials`)
- Desktop: cream gradient card; Google 4.9 summary + “Review Us on Google”; 2–3 column review grid with gold quote mark + author/role.
- Mobile (≤600px): single-column cards.
- Header “Community Reviews” `/#Testimonials` + side dock still land on the section.
- Hero, sponsors, accomplishments, newsletter, featured pets unchanged.

## Follow-ups

- Purge orphaned events / testimonials / flyers-rail / `.home-nl*` / pets widget CSS only after visual sign-off.
- Optional: share flyer card chrome with `/events` grid where parity allows without dragging calendar/filter concerns onto home.
- Accomplishments native rewrite next.
