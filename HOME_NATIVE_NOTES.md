# Homepage native Astro migration notes (Phase 3)

## Goal

Rewrite homepage surfaces one at a time into native Astro + Tailwind components under `frontend/src/components/home/`, following the `/games` success pattern: complete rewrite of one surface, leave unused CSS in `monroe-home.css` / widgets for later purge.

## Converted

| Surface | Component | Notes |
|---------|-----------|--------|
| Hero / cover (`#Top`) | `frontend/src/components/home/HomeHeroSection.astro` | **Hybrid BEM extract** (parity over purity). Keeps `wp-block-cover` / `home-editable-hero`, cover-dim ladder (`has-background-dim-40` + global-styles dim rules), poster backdrop, `data-hero-video*` toggle hooks, CTA row, and hero stats. Page script in `index.astro` still owns play/pause / reduced-motion / save-data behavior against `#Top`. Pure Tailwind deferred — prior rewrite reverted (`33768e1`). |
| Intro / About Our Shelter (`#Intro`) | `frontend/src/components/home/HomeIntroSection.astro` | Hybrid BEM; preserves `#Intro`. Call CTA uses `SITE.contact.phoneTel` (replaces undefined `TEL` reference in prior inline markup). |
| Hero Fence (`#hs-hero-fence-widget`) | `frontend/src/components/home/HomeHeroFenceSection.astro` | Preserves fence id + title id; keeps `hs-feature-widget` BEM shared with events/supporter story widgets. |
| Feature card (post–hero-fence) | `frontend/src/components/home/HomeFeatureCardSection.astro` | Keeps `home-editable-feature-card` / media / copy BEM for monroe-home.css layout + buttons. |
| Newsletter band (`.home-nl` + monroe-news-band card) | `frontend/src/components/home/HomeNewsletterSection.astro` | Teal gradient band + cream letter card; Directus featured/latest issue via existing loaders in `index.astro`; preserves `#Newsletter` + `data-nl-*` hydrate hooks. |
| Featured pets / adopt cards (`#FeaturedPets`) | `frontend/src/components/home/HomeFeaturedPets.astro` | Elevated white card + longest-residents badge/CTAs; Directus `getPets().slice(0, 6)` passed from `index.astro`; Tailwind pet cards + scoped marquee; preserves `#FeaturedPets`, `#featuredPetsWidget`, `#fpwExpandBtn`, `#featuredPetsFsDialog`, `#longestRow` / `.scroll-strip--primary`, and `#fpw-fs-longest` so the existing fullscreen-gallery script still works. Dialog nested under `#featuredPetsWidget` so gallery grid styles apply (was previously a sibling, so orphaned `#featuredPetsWidget dialog…` CSS never matched). |
| Events band + flyers rail (`#Events`) | `frontend/src/components/home/HomeEventsSection.astro` | Winner/feature card + next-event hero (pet slideshow + calendar CTAs) + horizontal upcoming flyers strip. Next-event + rail use the same Directus `getEventFlyers()` path as `/events` (upcoming by `event_date`). Preserves `#Events`, `data-home-nav-section="Events"`, and `hs-shirt-artwork-contest-title`. Legacy side `.home-editable-flyers-rail` markup was already absent from `index.astro` (body still carries `home-editable-has-flyers-rail` for theme CSS); native rail restores flyer thumbnails from Directus images. |
| Testimonials / Community Voices (`#Testimonials`) | `frontend/src/components/home/HomeTestimonialsSection.astro` | Static `reviews.json` grid + Google rating summary header; Tailwind parity with `.monroe-testimonials` cards; preserves `#Testimonials` for Header `/#Testimonials` + side-dock. |
| Accomplishments / Annual Outcomes (`#Accomplishments`) | `frontend/src/components/home/HomeAccomplishmentsSection.astro` | Year tabs + outcome stat tiles; Directus site-settings counts still applied in `index.astro` for 2025 before props pass; client script for tabs, `mchs_site_content_v2` staff override, and count-up. Preserves `#Accomplishments` + `data-monroe-accomplishments-widget` / year+panel data hooks. |
| Donations & Giving (`#Donations`) | `frontend/src/components/home/HomeDonationsSection.astro` | PayPal campaign iframes + offline gifts callout + give tiles; Tailwind/scoped-style parity with donate card / give-grid / offline-donations; preserves `#Donations` and Volunteer tile `#Volunteer`. |
| Vet partners (`#VetPartners`) | `frontend/src/components/home/HomeVetPartnersSection.astro` | Native component extraction; preserves `#VetPartners` + `#sponsor-widget-title`. Keeps `sponsor-widget*` / `sponsor-card*` BEM so `monroe-home-widgets.css` modifiers (`--square` / `--wide`) + CTA chrome stay pixel-parity. Full Tailwind restyle deferred with CSS purge (logo aspect modifiers are fragile). |
| Auction sponsors (`#furry-friends-auction-sponsors`) | `frontend/src/components/home/HomeAuctionSponsorsSection.astro` | Preserves auction shell id + title id. Keeps `sponsor-widget-shell--auction-five` BEM so the 3+2 centred `nth-child` grid remains parity. |
| Community partners marquee (`#sponsorMarqueeWidget`) | `frontend/src/components/home/HomeSponsorsMarquee.astro` | Preserves marquee id + `.logo-slider` / `.logo-track` / `.logo-set` clone strip so `monroe-home.css` edge fades + `monroe-home-logo-marquee` animation still apply. Title/intro use light Tailwind. |
| Membership CTA (`#Membership`) | `frontend/src/components/home/HomeMembershipSection.astro` | Under-construction notice only; preserves `#Membership` + shared membership under-construction BEM. |
| Supporter story (`#SupporterStory`) | `frontend/src/components/home/HomeSupporterStorySection.astro` | Carmen & Greg story + gallery; preserves `#SupporterStory` + `#hs-carmen-greg-story-title`. Keeps `hs-feature-widget` / gallery BEM (shared widget CSS with events/hero fence). |
| Social / Facebook hub (`#Social`) | `frontend/src/components/home/HomeSocialSection.astro` | Split hub + live Page Plugin embed; preserves `#Social` and `data-facebook-embed` / `data-facebook-iframe` hooks used by `index.astro` page script. Loader CTA remains plain HTML (ad-block safe). |
| Shelter FAQ (`#FAQ`) | `frontend/src/components/home/HomeFaqSection.astro` | Tailwind + scoped tile grid parity; preserves `#FAQ`. |
| Humane Games CTA (`#Games`) | `frontend/src/components/home/HomeGamesSection.astro` | Teaser grid + CTA; Tailwind/scoped parity; preserves `#Games` + `#home-games-heading`. |
| Contact & Hours (`#Contact`) | `frontend/src/components/home/HomeContactSection.astro` | Mailto form + map + open/closed badge; preserves `#Contact`, field IDs, `data-monroe-contact-mailto`, and `data-hours-*` hooks used by `index.astro` page script. |

## Explicitly not touched (this PR)

- **No deletion** of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` / global-styles cover-dim ladder — orphaned rules intentionally left until visual soak + purge.
- Hero video **behavior script** remains in `index.astro` (queries `#Top`); markup only moved into `HomeHeroSection`.
- Side dock / Mobile TOC section list unchanged (`Top`, `Intro`, `hs-hero-fence-widget`, …).

## Deferred

- **Visual soak** of hero + intro + fence + feature card (desktop/mobile, video, cover dim, CTAs, deep links).
- **CSS purge** — orphaned rules for all converted bands after sign-off; then optional drop of unused `monroe-wp-compat` / cover-dim only when confirmed unused.
- **Sponsors / hero hybrid class cleanup** — port remaining BEM (`sponsor-*`, `hs-feature-widget`, `wp-block-cover` / `home-editable-hero*`, intro/feature cards) into scoped Tailwind **after** soak, not in this PR.

## Recommended next order

1. ~~**Pets cards**~~ ✅
2. ~~**Events rail**~~ ✅
3. ~~**Testimonials**~~ ✅
4. ~~**Accomplishments**~~ ✅
5. ~~**Donations**~~ ✅
6. ~~**Sponsors widgets**~~ ✅ (componentized; Tailwind style port with purge)
7. ~~**FAQ / membership / social / games / supporter / contact**~~ ✅
8. ~~**Intro + Hero Fence + Feature card**~~ ✅ (this PR, with hero)
9. ~~**Hero / cover last**~~ ✅ (this PR — hybrid BEM extract)
10. **Visual soak** (hero video, cover dim, CTAs, fence widget, intro/feature).
11. **CSS purge** / drop unused wp-compat after sign-off; optional Tailwind class cleanup for hybrid surfaces.

## Visual QA checklist (this PR — hero highest risk)

### Hero / cover (`#Top`)
- [ ] Desktop + mobile: display / title / copy / three CTAs / hero stats match pre-extract look (no redesign drift).
- [ ] Background video autoplays when allowed; poster visible before play / when paused.
- [ ] Cover dim ladder still darkens video (`has-background-dim-40` + global-styles `.wp-block-cover__background` opacities) — text remains readable.
- [ ] Play/Pause toggle works; reduced-motion / save-data start paused with poster; Low Power Mode autoplay rejection falls back gracefully.
- [ ] `is-video-playing` / `is-motion-paused` class toggles still drive CSS (poster fade / video opacity).
- [ ] Hero CTAs: Adopt → `/adopt`, Adoptions → `/adoptions`, third button external `target=_blank`.
- [ ] Side dock / Mobile TOC / Header deep link `/#Top` still lands.

### Intro / Fence / Feature
- [ ] `#Intro` card layout (65/35 columns → stack on small) + Call CTA dials `tel:` via `SITE.contact.phoneTel`.
- [ ] `#hs-hero-fence-widget` copy/media/CTA; dock title “Hero Fence” still scrolls to widget.
- [ ] Feature card image + copy + two CTAs (`/adoptions`, `/dog-and-cat-shelter`).
- [ ] Scroll-reveal still applies to `.home-editable-section` wrappers (intro/fence/feature).

### Regression (already-native)
- [ ] Events band still sits correctly under hero (sibling `~` spacing selectors).
- [ ] Featured pets, sponsors, social, contact, newsletter, etc. unchanged functionally.
- [ ] `monroe-home.css` / widgets / wp-compat / global-styles cover-dim **not** deleted.

## Follow-ups

- Soak visually before any CSS purge.
- Purge orphaned CSS only after sign-off (hero BEM + earlier converted bands + leftover sponsor BEM once restyled).
- Optional: Tailwind restyle of hero/intro/fence/feature once parity is signed off.
- Optional: move hero video init into a small client script colocated with `HomeHeroSection` (behavior currently correct in page script).
