# CSS chrome soak-safe trim

**Branch:** `chore/css-chrome-soak-trim`  
**Date:** 2026-09-11  
**Scope:** Proven-unused rules only in `monroe-wp-compat.css` + `global-styles.css`. No homepage rewrite. No `monroe-home*` edits (already purged). `BaseLayout` import of `monroe-wp-compat.css` **kept** (live homepage still uses wp-block-* / is-layout-* / align* / has-* CTA colors).

## Method

1. Fetched `frontend/src` (astro/ts/json) via `gh api` contents (no clone).
2. Built reference class/id set from `class` / `class:list` / `querySelector*` / `classList` / `id` / `bodyClass` / data JSON modifiers.
3. Parsed selectors in the four CSS surfaces; marked a sole utility **dead** only at zero markup hits.
4. When unsure → KEEP (cover-dim ladder, `:not(.alignleft)` constrained helpers, `is-not-stacked-on-mobile` media query, `monroe-home*`).

## Bytes (source)

| File | Before | After | Saved |
|------|-------:|------:|------:|
| `monroe-wp-compat.css` | 3 905 | 3 546 | **359** |
| `global-styles.css` | 5 723 | 5 254 | **469** |
| `monroe-home.css` / `monroe-home-widgets.css` | — | unchanged | 0 (no safe orphans left) |
| **Combined trim** | | | **828 B** |

## Removed (evidence: 0 hits in `frontend/src` markup/scripts)

### `monroe-wp-compat.css`

- `.is-content-justification-center`
- `.has-text-align-left`, `.has-text-align-right`
- `.has-vivid-cyan-blue-color`, `.has-contrast-color`, `.has-base-background-color`
- `.has-secondary-background-color`, `.has-secondary-color`
- `.has-accent-background-color`, `.has-accent-color`
- Empty stubs `.has-text-color` / `.has-background` (classes still present on CTAs; rules had no declarations)

### `global-styles.css`

- `.is-layout-flow > .alignleft|alignright` and `.is-layout-constrained > .alignleft|alignright` float helpers (`alignleft`/`alignright` never appear in markup)
- `.has-contrast-color`, `.has-vivid-cyan-blue-color`, `.has-base-background-color` (only previously self-justified via wp-compat; now unused site-wide)
- Dead eyebrow selectors `.home-editable-page-index--mobile`, `.home-editable-page-index__link`, `.hs-eyebrow` (MobileTOC / home no longer emit them). Kept `.monroe-native-eyebrow` (`dog-and-cat-shelter`).

## Intentionally NOT changed

- **`BaseLayout` still imports `monroe-wp-compat.css`** — homepage components still use `wp-block-cover*`, `wp-block-columns`, `wp-block-buttons`, `is-layout-constrained` / `flex`, `alignwide` / `alignfull`, CTA `has-*` colors.
- **`index.astro` `home-editable*` classnames** — not vestigial; styled by `monroe-home.css` (`home-editable-has-flyers-rail`, `home-editable-shell`) and scroll-reveal script (`.home-editable-section`).
- **`monroe-home.css` / `monroe-home-widgets.css`** — post–orphan-purge audit found no additional safe class orphans (only false positives).
- Cover-dim ladder, staff-theme, games binaries, donor JSON, newsletter.

## Soak test plan

After preview / SWA deploy, spot-check:

- [ ] `/` — hero video + dim-40 scrim + CTAs + stats; intro columns; feature card; sponsors marquee; social split; contact form buttons
- [ ] `/adopt` — grid + chrome (theme / nav)
- [ ] `/donate` — layout + buttons
- [ ] `/events` — flyers rail / cards
- [ ] `/newsletter` — list / issue chrome
- [ ] `/games` — arcade shell (untouched CSS; regression only)
- [ ] `/dog-and-cat-shelter` — `.monroe-native-eyebrow` wrap still OK

History note: big Tailwind homepage rewrite was reverted (`33768e1`); this PR only deletes proven-unused CSS.