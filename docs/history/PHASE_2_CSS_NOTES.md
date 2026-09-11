# Phase 2 — Global CSS diet (parity-preserving)

**Branch:** `chore/phase-2-css-diet`  
**Date:** 2026-09-10  
**Scope:** Usage-audit + trim of `frontend/src/styles/global-styles.css` only. No homepage markup rewrite. No nav rewrite. `monroe-wp-compat.css` retained. `monroe-home.css` / `monroe-rebuild-theme` untouched.

## How unused rules were verified

1. Snapshot of `frontend/src/{pages,components,layouts,styles,scripts}` from `main` (tarball extract; no git clone).
2. Parsed all sole-class `.has-*{…}` utilities and `--wp--preset--*` / `--wp--custom--*` / `--wp--style--*` definitions from `global-styles.css`.
3. Grepped each token across the snapshot **excluding** `global-styles.css` itself (so self-definitions do not count as usage).
4. Cross-checked homepage `index.astro` class list and inline `--wp--*` vars; `monroe-wp-compat.css`; `monroe-home.css` custom tokens.
5. **Remove only when zero hits.** Anything load-bearing for hero cover-dim, or referenced by homepage / monroe-theme / monroe-home / monroe-wp-compat, was kept. Uncertain → keep + list below.

## Bytes

| File | Before | After | Saved |
|------|-------:|------:|------:|
| `global-styles.css` | 16 003 | ~5 727 | **~10.3 KB (~64%)** |

(Raw source size. Built/minified bundle savings will be similar order of magnitude.)

## Removed from `global-styles.css` (proven unused)

### Unused `.has-*` sole utilities (71)

All color / background / border / gradient / font-size / font-family utilities **except** the six kept below. Examples of removed families:

- Default WP palette: `has-black-*`, `has-white-*`, `has-pale-pink-*`, `has-vivid-red-*`, `has-luminous-vivid-*`, `has-light-green-cyan-*`, `has-vivid-green-cyan-*`, `has-pale-cyan-blue-*`, `has-vivid-purple-*`, `has-cyan-bluish-gray-*`
- Brand extras never referenced in markup: `has-paper-*`, `has-teal-*`, `has-cyan-*`, `has-gold-*`
- All `has-*-gradient-background` (12)
- All `has-*-font-size` / `has-*-font-family` utilities (fonts still applied via `body` / `h1–h3` / button rules)
- Unused border-color variants for colors we otherwise keep (`has-base-border-color`, `has-contrast-border-color`, `has-vivid-cyan-blue-border-color`)

### Unused `:root` presets / custom tokens

- All `--wp--preset--aspect-ratio--*`
- All `--wp--preset--gradient--*`
- All `--wp--preset--spacing--*`
- All `--wp--preset--shadow--*`
- All `--wp--preset--font-size--*`
- Unused colors: black, white, cyan-bluish-gray, pale-pink, vivid-red, luminous-*, light/vivid-green-cyan, pale-cyan-blue, vivid-purple, paper, teal, cyan, gold
- Unused font families: montserrat, bebas-neue (abril/jost/questrial kept)
- Unused monroe custom surfaces: `news-band-gradient-*`, `inset-bg`, `inset-text`, `inset-border` (pill tokens kept — used by `monroe-home.css`)
- `.wp-block-button` dimension presets (`--wp--preset--dimension--*`)
- Unused layout helpers: `.wp-site-blocks > .align*`, `:where(.is-layout-grid)`, `body .is-layout-grid`, `:where(.wp-block-columns.is-layout-grid)`

## Kept (referenced or required)

### `:root` tokens

- `--wp--preset--color--{base,contrast,vivid-cyan-blue}`
- `--wp--preset--font-family--{abril,jost,questrial}`
- `--wp--custom--monroe--surface--inset-pill-{bg,text}` ← `monroe-home.css`
- `--wp--style--global--{content,wide}-size` ← `monroe-wp-compat.css` + constrained layout

### `.has-*` utilities (6)

| Utility | Evidence |
|---------|----------|
| `has-base-color` | `index.astro`, `monroe-wp-compat.css` |
| `has-contrast-color` | `monroe-wp-compat.css` |
| `has-vivid-cyan-blue-color` | `monroe-wp-compat.css` |
| `has-base-background-color` | `monroe-wp-compat.css` |
| `has-contrast-background-color` | `index.astro`, `monroe-wp-compat.css` |
| `has-vivid-cyan-blue-background-color` | `index.astro`, `monroe-wp-compat.css` |

### Hero / cover-dim / eyebrow fixes (unchanged)

- Full `.wp-block-cover__background.has-background-dim{,-10…-100}` ladder
- Eyebrow wrap fixes (`.home-editable-page-index--mobile …`, `.monroe-native-eyebrow`, `.hs-eyebrow`)
- `.home-editable-section-label` wrap fix

### Layout / typography still used by homepage WP mirror

- `body` / `h1–h3` font rules
- `.wp-element-button` / `.wp-block-button__link` base
- `is-layout-flex` / `is-layout-flow` / `is-layout-constrained` (+ align helpers)
- `:where(.wp-block-columns.is-layout-flex){gap:2em}`

### Intentionally untouched sheets

- `monroe-wp-compat.css` — homepage still needs WP block layout shims
- `monroe-home.css` / `monroe-home-widgets.css` — no markup/class changes
- `monroe-theme.css` — documented only (Phase 4)
- `body.monroe-rebuild-theme` — not removed

## Retained unsure

| Item | Why kept |
|------|----------|
| Full cover-dim opacity ladder beyond `dim` / `dim-40` | Explicit Phase 2 goal: keep cover-dim / hero fixes; only `dim` + `dim-40` appear in `index.astro` today, but widget/runtime may emit other steps |
| Global `body`/`h1–h3` font rules in this sheet | Overlaps somewhat with `monroe-theme.css` `body.monroe-rebuild-theme` rules; removing could change pages that omit that body class or race specificity — leave until chrome pass |
| `.wp-element-button` / `.wp-block-button__link` defaults | Homepage uses `wp-element-button`; exact visual dependence on these defaults vs home CSS not fully isolated |
| `is-layout-flow` align float rules | Present on homepage; rarely exercised vs constrained/flex — kept for parity |

## `monroe-theme.css` — what Header / Footer / BottomTabBar need

**Do not rewrite nav in this PR.** Inventory for Phase 4.

### Shared chrome (all BaseLayout public pages)

| Concern | Selectors / region (approx. lines on main) | Consumers |
|---------|--------------------------------------------|-----------|
| Cream + paw tile page background | `:root` `--monroe-paw-*`; `body.monroe-rebuild-theme` (~L20–L86) | BaseLayout body class |
| Inner-page padding hook | `body.monroe-rebuild-theme.monroe-inner-page` | BaseLayout default `bodyClass` |
| Skip link | `.monroe-skip-link` (~L138+) | BaseLayout |
| Tap / iOS input ergonomics | “Mobile Ergonomics” section (~L1118+) | Global |

### Header.astro → needs from `monroe-theme.css`

| BEM / hook | Theme region |
|------------|--------------|
| `monroe-global-nav` + all `__*` parts (bar, brand, panel, list, item, link, trigger, chevron, dropdown, submenu, CTA row, backdrop, menu-toggle, …) | **“Global Navigation — Ground-up Rebuild”** (~L191–~L986) |
| Mobile vs desktop breakpoint `1201px` | Same section |
| `data-nav-style="bottom-bar"\|"hamburger"` interactions with hamburger visibility | **“Mobile Navigation Layout Styles”** (~L1573–L1604) |
| Scroll-hide (`monroe-nav-hidden`) | **“Scroll-Aware Screen Maximizing”** (~L1606–L1640) |

Header has **no** `wp-block*` classes.

### Footer.astro → needs from `monroe-theme.css`

| BEM | Theme region |
|-----|--------------|
| `monroe-site-footer` + `__inner`, `__grid`, `__brand`, `__name`, `__nav`, `__links`, `__contact`, `__address`, `__staff`, `__staff-btn`, `__legal` | **“Site footer”** (~L987–~L1116) |

Footer has **no** `wp-block*` classes.

### BottomTabBar.astro → split ownership

| Concern | Where it lives |
|---------|----------------|
| Show/hide dock by `data-nav-style` + desktop hide + body bottom padding | **`monroe-theme.css`** Mobile Navigation Layout (~L1573–L1604) + scroll-hide (~L1606–L1640) |
| Visual design of tabs, badge, **and entire `monroe-bottom-sheet*`** | **Scoped `<style>` in `BottomTabBar.astro`** (~L327–L570) — **not** in `monroe-theme.css` |

### Related (not Header/Footer/TabBar, but coupled)

| Component | Styles |
|-----------|--------|
| `UserSettings.astro` (cog + dialog) | Mostly scoped `<style>`; theme only toggles visibility/scroll-hide for `.monroe-settings-cog` |
| Staff portal mobile dock | `monroe-theme.css` “Staff Portal Mobile Navigation…” (~L1642+) — staff layouts; public diet unaffected |

## Optional sheet-loading win

**Not taken in this PR.** Evidence:

- `staff-theme.css` already scoped off public `BaseLayout` (Phase 0–1 / PR #1) — StaffPortalLayout + staff components only.
- `/tv` and `/games/catwalk` already **do not** use `BaseLayout` (standalone documents).
- Remaining BaseLayout public pages still need `monroe-theme.css` (nav/footer chrome) and homepage still needs `monroe-wp-compat.css` + dieted `global-styles.css`. No layout with solid proof that it can drop one of those without a dedicated chrome rewrite.

## Risk notes

- **Low–medium visual risk** concentrated on homepage WP color utilities and cover hero. Inner Tailwind pages barely touch removed presets.
- If a Directus/widget path injects a removed `has-*` class at runtime, that node would lose the WP utility color (cascade would fall back to inherited styles). Mitigation: full cover-dim ladder kept; only sole utilities with zero static references removed.
- Do **not** delete `monroe-wp-compat.css` until Phase 3 finishes homepage class migration.

## Out of scope (explicit)

- Homepage Tailwind rewrite / `monroe-home.css` class edits
- Removing `monroe-rebuild-theme`
- Rewriting Header/Footer/BottomTabBar
- Touching `staff-theme.css`
