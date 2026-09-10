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
| Accomplishments / Annual Outcomes (`#Accomplishments`) | `frontend/src/components/home/HomeAccomplishmentsSection.astro` | Year tabs + outcome stat tiles; Directus site-settings counts still applied in `index.astro` for 2025 before props pass; client script for tabs, `mchs_site_content_v2` staff override, and count-up. Preserves `#Accomplishments` + `data-monroe-accomplishments-widget` / year+panel data hooks. |
| Donations & Giving (`#Donations`) | `frontend/src/components/home/HomeDonationsSection.astro` | PayPal campaign iframes + offline gifts callout + give tiles; Tailwind/scoped-style parity with donate card / give-grid / offline-donations; preserves `#Donations` and Volunteer tile `#Volunteer`. |

## Explicitly not touched

- Hero / cover / `wp-block-cover` / video dim ladder
- Vet partners, auction sponsors, community marquee (`sponsor-widget*`, `sponsor-marquee`)
- FAQ, contact, membership, social, games CTA, supporter story
- No deletion of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` (orphaned accomplishments / donations / events / testimonials / `.home-nl*` / pets widget rules intentionally left)

## Deferred

- **Sponsors widgets** — WP-era shells + marquee clone strips; higher visual-regression risk.
- **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).
- **CSS purge** — orphaned `.home-editable-accomplishments-*`, `.monroe-accomplishments-*`, `.home-editable-donate-card` / give-grid / offline-donations / paypal-giving rules, plus earlier events / testimonials / `.home-nl*` / pets widget rules after visual sign-off.

## Recommended next order

1. ~~**Pets cards**~~ ✅
2. ~~**Events rail**~~ ✅
3. ~~**Testimonials**~~ ✅
4. ~~**Accomplishments**~~ ✅ (this PR)
5. ~~**Donations**~~ ✅ (this PR)
6. **Sponsors widgets** (vet → auction → marquee).
7. **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).

## Visual QA checklist (this PR)

### Accomplishments (`#Accomplishments`)
- Desktop: centered pill + impact-green title + intro; year pill tabs; 3-column outcome tiles (accent tile gradient).
- Tablet (481–768): tighter 3-column tiles / smaller type.
- Mobile (≤480): single-column tiles.
- Year tab switch updates panels + aria-selected; inactive panels stay `hidden`.
- Staff portal `localStorage mchs_site_content_v2.outcomes` still overrides matching labels before count-up.
- Reduced-motion: no count-up animation (final display values shown).
- Side dock / Mobile TOC `#Accomplishments` still lands on the section.
- 2025 counts still come from Directus site settings via `index.astro` frontmatter.

### Donations (`#Donations`)
- Desktop: cream donate card; two PayPal iframes side-by-side; offline callout; 3 give tiles.
- ≤900px: PayPal iframes stack; iframe height ~420px.
- ≤768px: give tiles stack to one column.
- Volunteer tile keeps `#Volunteer`; section keeps `#Donations`.
- Hero, sponsors, membership, newsletter, featured pets, events, testimonials unchanged.

## Follow-ups

- Purge orphaned accomplishments / donations / events / testimonials / flyers-rail / `.home-nl*` / pets widget CSS only after visual sign-off.
- Optional: share flyer card chrome with `/events` grid where parity allows without dragging calendar/filter concerns onto home.
- Sponsors widgets next; hero last.
