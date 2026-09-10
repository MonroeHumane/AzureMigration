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
| Vet partners (`#VetPartners`) | `frontend/src/components/home/HomeVetPartnersSection.astro` | Native component extraction; preserves `#VetPartners` + `#sponsor-widget-title`. Keeps `sponsor-widget*` / `sponsor-card*` BEM so `monroe-home-widgets.css` modifiers (`--square` / `--wide`) + CTA chrome stay pixel-parity. Full Tailwind restyle deferred with CSS purge (logo aspect modifiers are fragile). |
| Auction sponsors (`#furry-friends-auction-sponsors`) | `frontend/src/components/home/HomeAuctionSponsorsSection.astro` | Preserves auction shell id + title id. Keeps `sponsor-widget-shell--auction-five` BEM so the 3+2 centred `nth-child` grid remains parity. |
| Community partners marquee (`#sponsorMarqueeWidget`) | `frontend/src/components/home/HomeSponsorsMarquee.astro` | Preserves marquee id + `.logo-slider` / `.logo-track` / `.logo-set` clone strip so `monroe-home.css` edge fades + `monroe-home-logo-marquee` animation still apply. Title/intro use light Tailwind. |
| Membership CTA (`#Membership`) | `frontend/src/components/home/HomeMembershipSection.astro` | Under-construction notice only; preserves `#Membership` + shared membership under-construction BEM. |
| Supporter story (`#SupporterStory`) | `frontend/src/components/home/HomeSupporterStorySection.astro` | Carmen & Greg story + gallery; preserves `#SupporterStory` + `#hs-carmen-greg-story-title`. Keeps `hs-feature-widget` / gallery BEM (shared widget CSS with events/hero fence). |
| Social / Facebook hub (`#Social`) | `frontend/src/components/home/HomeSocialSection.astro` | Split hub + live Page Plugin embed; preserves `#Social` and `data-facebook-embed` / `data-facebook-iframe` hooks used by `index.astro` page script. Loader CTA remains plain HTML (ad-block safe). |
| Shelter FAQ (`#FAQ`) | `frontend/src/components/home/HomeFaqSection.astro` | Tailwind + scoped tile grid parity; preserves `#FAQ`. |
| Humane Games CTA (`#Games`) | `frontend/src/components/home/HomeGamesSection.astro` | Teaser grid + CTA; Tailwind/scoped parity; preserves `#Games` + `#home-games-heading`. |
| Contact & Hours (`#Contact`) | `frontend/src/components/home/HomeContactSection.astro` | Mailto form + map + open/closed badge; preserves `#Contact`, field IDs, `data-monroe-contact-mailto`, and `data-hours-*` hooks used by `index.astro` page script. |

## Explicitly not touched

- Hero / cover / `wp-block-cover` / video dim ladder (`#Top`)
- Intro card (`#Intro`)
- Hero Fence (`#hs-hero-fence-widget`)
- Feature card (post–hero-fence band)
- No deletion of `monroe-home.css` / `monroe-home-widgets.css` / `monroe-wp-compat.css` (sponsor / social / contact / membership / hs-feature / faq / games rules intentionally left; FAQ/games native styles coexist until purge)

## Deferred

- **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).
- **Intro / Hero Fence / Feature card** — remaining chrome adjacent to hero; convert with or after hero so layout/CTA relationships stay coherent.
- **Sponsors Tailwind restyle** — componentized, but vet/auction/marquee still rely on existing BEM CSS for parity (auction-five `nth-child` grid + logo modifiers + marquee edge fades). Port styles into scoped Tailwind during CSS purge after visual sign-off.
- **CSS purge** — orphaned rules for converted bands (and leftover sponsor BEM once restyled) after visual sign-off.

## Recommended next order

1. ~~**Pets cards**~~ ✅
2. ~~**Events rail**~~ ✅
3. ~~**Testimonials**~~ ✅
4. ~~**Accomplishments**~~ ✅
5. ~~**Donations**~~ ✅
6. ~~**Sponsors widgets**~~ ✅ (componentized; Tailwind style port with purge)
7. ~~**FAQ / membership / social / games / supporter / contact**~~ ✅ (this PR)
8. **Intro + Hero Fence + Feature card** (remaining chrome), or fold into hero pass.
9. **Hero / cover last** — highest risk (video, cover-dim ladder, CTA overlap with intro card).
10. **CSS purge** after visual sign-off.

## Visual QA checklist (this PR)

### Sponsors
- Vet partners: 2-col cards → 1-col ≤900px; square/wide logo modifiers; Visit website CTAs open partner sites.
- Auction: 3+2 centred five-card grid on desktop; stacks correctly ≤900 / ≤580.
- Marquee: continuous scroll; pauses on hover/focus; edge fades; reduced-motion shows static wrap (clone set hidden).
- Side dock targets `#VetPartners`, `#furry-friends-auction-sponsors`, `#sponsorMarqueeWidget` still land.

### Remaining bands
- Membership under-construction notice + `#Membership` anchor.
- Supporter story quote + gallery pair; `#SupporterStory` dock link.
- Social split: feature grid + Facebook iframe; loader CTA visible before iframe load; `is-loaded` after load.
- FAQ 3 tiles → stack on mobile; external donate link keeps `target=_blank`.
- Games teasers link to `/games`; `#Games` / `#home-games-heading` anchors.
- Contact mailto honeypot + feedback; hours badge Open/Closed; map iframe; `#Contact` anchor.
- Hero / Intro / Hero Fence / Feature card unchanged.

## Follow-ups

- Purge orphaned CSS only after visual sign-off (sponsors BEM + social/contact/membership/hs-feature leftovers + earlier converted bands).
- Optional: Tailwind restyle of sponsor cards/marquee once auction-five + modifier parity is signed off.
- Intro / Hero Fence / Feature card next; hero last.
