# Phase CSS purge notes (homepage orphan rules)

**Branch:** `chore/homepage-css-orphan-purge`  
**Date:** 2026-09-10  
**Scope:** Careful, parity-preserving purge of CSS rules that are **truly unreferenced** after Phase 3 homepage component extracts (Hero PR #13 merged).

## What this PR does

- Inventories class / id tokens used by `frontend/src/components/home/*`, `pages/index.astro`, Header deep-links, homepage scripts, layouts, and `data/*` (incl. `sponsors.json` modifiers).
- In `monroe-home.css` and `monroe-home-widgets.css`, **removes only rules whose every selector alternative requires at least one class/id with zero frontend references**.
- When unsure → **KEEP**.
- Does **not** rewrite remaining BEM → Tailwind.
- Does **not** delete `monroe-home.css` / widgets wholesale.
- Does **not** touch `monroe-wp-compat.css`, global-styles cover-dim ladder, staff-theme, or `monroe-rebuild-theme` body class.

## Bytes saved

| File | Before | After | Saved |
|------|--------|-------|-------|
| `frontend/src/styles/monroe-home.css` | 102,788 | 45,902 | **56,886** |
| `frontend/src/styles/monroe-home-widgets.css` | 46,490 | 24,026 | **22,464** |
| **Total** | 149,278 | 69,928 | **79,350** |

Rule counts (approx.): monroe-home removed 310 rules / kept 227; widgets removed 140 / kept 102. Also dropped empty `@media` blocks and unreferenced `@keyframes`.

## Major removal buckets (safe orphans)

These surfaces were already replaced by native Astro + Tailwind / scoped styles; leftover BEM / embed CSS had **no** matching markup:

- Legacy **newsletter** `.home-nl*` band (only `.home-nl__btn--off` retained — still toggled in `HomeNewsletterSection`)
- Legacy **hs-news-section** + lightbox / gallery chrome (newsletter now native)
- Legacy **featured-pets widget** internals (`fpw-toolbar`, `pet-card-widget`, old scroll-track marquee, adopt-all, etc.) while keeping live `#featuredPetsWidget` / `fpw-expand-btn` / `fpw-fs-*` hooks still present in markup/scripts
- Legacy **events artwork / winner / QR** hs-feature modifiers (events band is Tailwind)
- Legacy **give-grid / give-tile**, **membership-grid / membership-card**, **compare-bar**, **offline-donations** BEM (donations/membership under-construction use new classes)
- **elfsight** / Trustindex live embed shells, unused **ultrawide** sponsor modifier
- Orphaned FAQ / games / events-card / accomplishments-card shared card selectors trimmed from multi-selector lists where those classnames no longer appear in components

## Retained (used or unsure — KEEP)

- Entire remaining monroe-home.css / monroe-home-widgets.css hybrid BEM for hero, intro, feature card, contact, social split, side-dock, sponsors/marquee, hs-feature-widget (fence + supporter story), membership under-construction shell, news-band vet partners wrapper, home-nl__btn--off, accomplishments widget hooks, #featuredPetsWidget shell rules that still match live ids (even where native Tailwind also styles children).
- monroe-wp-compat.css — untouched (hero still uses wp-block-cover + has-background-dim*).
- global-styles.css cover-dim ladder — untouched.
- monroe-rebuild-theme body class — untouched.
- Inert but id-anchored leftovers under #featuredPetsWidget (e.g. .badge) kept because class token exists elsewhere in frontend and id is live — when unsure, KEEP.
- sponsor-card--square / --wide kept (sponsors.json modifiers); --ultrawide removed.

### Still intentionally hybrid (do not Tailwind in this PR)

- Hero / cover (`wp-block-cover`, `home-editable-hero*`, dim classes, video toggle)
- Intro + feature card BEM
- Contact location + monroe-contact-form*
- Social split hub (`home-editable-social-*`)
- Side dock (`home-side-dock*`)
- Sponsors / auction / vet partners (`sponsor-*`, news-band wrapper)
- Logo marquee (`.logo-slider` / track / set + `monroe-home-logo-marquee`)
- `hs-feature-widget` for Hero Fence + Supporter Story
- Accomplishments widget hooks (`monroe-accomplishments-*`)
- Membership under-construction shared BEM
- Scroll-reveal (`.reveal-pending` / `.is-revealed`) + body `home-editable-has-flyers-rail` tokens

## Untouched (explicit)

- `frontend/src/styles/monroe-wp-compat.css`
- Cover-dim rules in `global-styles.css` (`has-background-dim*`)
- Staff theme / staff portal styles
- `monroe-rebuild-theme` body class wiring in `BaseLayout`

## Method

1. Build reference sets of class/id tokens from `frontend/src/{pages,components,layouts,scripts,data}` (class attrs, `class:list` object keys, `querySelector` / `classList`, hash deep-links, `sponsors.json` modifiers).
2. Parse CSS rules; for each comma-separated selector alternative, mark **dead** only if it requires ≥1 class/id that is definitively absent from the reference set.
3. Drop rules where all alternatives are dead; trim multi-selector lists; drop emptied `@media` and unreferenced `@keyframes`.
4. Ambiguous ultra-generic tokens (`active`, `open`, …) alone never justify deletion.

## Visual QA (parity)

Spot-check homepage after deploy/soak:

- [ ] Hero video + dim + CTAs + stats + play/pause
- [ ] Intro / fence / feature card layout
- [ ] Events band + flyers rail (Tailwind)
- [ ] Featured pets marquee + fullscreen dialog
- [ ] Vet partners + auction sponsors + logo marquee
- [ ] Social embed loader / contact form+hours map
- [ ] Side dock + Mobile TOC deep links
- [ ] Newsletter band buttons (incl. PDF-off state)
- [ ] Accomplishments tabs/count-up
- [ ] Membership under-construction notice

## Follow-ups (not this PR)

- Optional further trim of inert `#featuredPetsWidget` shell once neutralize overrides are proven sole styling source
- Optional drop of `monroe-wp-compat` / cover-dim only after hero no longer uses `wp-block-cover` + dim classes
- Tailwind port of remaining hybrid BEM after visual soak
