# Unified Humane Game System (Desktop + Mobile)

Shared chrome, tokens, and input patterns for every embedded Humane Arcade game
(booster, match, flappy-cat, catwalk, shelter-run, dex, and future titles).

## Files

| File | Role |
|------|------|
| `humane-game-system.css` | Design tokens, HUD chips, buttons, overlays, desktop/mobile control visibility, safe areas |
| `shared-styles.css` | Site/game shell styles; **imports** `humane-game-system.css` |
| `shared.js` | `HumaneAudio` + **`HumaneGameSystem`** input/viewport helpers |
| `embed.js` / `embed.css` | `?embed=1` → `html.humane-embed` (no double chrome in hub iframe); also first-paint `?theme=` |
| `theme.js` | Arcade light/dark: `html.pm-theme-light` / `html.pm-theme-dark`, `window.HumaneGamesTheme` |
| Hub `frontend/src/pages/games/index.astro` | Cabinet iframe + dock; supplies outer chrome and the Light/Dark button |

Do **not** break embed detection (`embed=1` query → `html.humane-embed`).
Do **not** delete legacy petsnake / tycoon.

## Quick adopt checklist (per-game bots)

1. **Viewport meta** (mobile):
   ```html
   <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
   ```
   Prefer `viewport-fit=cover` so `env(safe-area-inset-*)` works. Avoid zoom traps;
   if you must lock scale, keep `touch-action: manipulation` on chrome.

2. **Load order** (typical standalone HTML game):
   ```html
   <script src="/games/embed.js"></script>
   <script src="/games/theme.js"></script>   <!-- before any stylesheet -->
   <link rel="stylesheet" href="/games/shared-styles.css">
   <!-- or at minimum: -->
   <link rel="stylesheet" href="/games/humane-game-system.css">
   <link rel="stylesheet" href="/games/embed.css">
   <script src="/games/shared.js"></script>
   ```

3. **Boot the system**:
   ```js
   const session = HumaneGameSystem.boot({
     onAction(action) {
       if (action === 'pause') pauseGame();
       if (action === 'resume') resumeGame();
     },
     onVisibilityPause() { pauseGame(); },
     // onVisibilityResume optional — prefer a tap before resuming audio
   });
   // session.dispose() on teardown
   ```

4. **Markup contract**:
   ```html
   <div class="hg-game-root">
     <div class="hg-hud">
       <div class="hg-score-chip"><span class="hg-chip__label">Score</span>
         <span class="hg-chip__value" id="score">0</span></div>
     </div>

     <div data-hg-desktop-controls class="hg-desktop-controls">
       <span class="hg-kbd-hint"><kbd class="hg-kbd">←</kbd><kbd class="hg-kbd">→</kbd> move</span>
       <button type="button" class="hg-btn hg-btn--secondary" data-hg-action="pause" data-hg-key="Escape">Pause</button>
     </div>

     <div data-hg-mobile-controls class="hg-mobile-controls hg-thumb-actions">
       <button type="button" class="hg-control hg-control--pad" data-hg-action="left" aria-label="Left">◀</button>
       <button type="button" class="hg-btn hg-btn--primary" data-hg-action="action">Go</button>
       <button type="button" class="hg-control hg-control--pad" data-hg-action="right" aria-label="Right">▶</button>
     </div>

     <div class="hg-overlay" id="pause-overlay" hidden>
       <div class="hg-overlay__panel">
         <h2 class="hg-overlay__title">Paused</h2>
         <div class="hg-overlay__actions">
           <button type="button" class="hg-btn hg-btn--primary" data-hg-action="resume">Resume</button>
         </div>
       </div>
     </div>
   </div>
   ```

5. **Hide duplicate chrome in embed**:
   - Add `hg-hide-in-embed` or `data-hg-hide-in-embed` to in-game back links / title bars
     that the cabinet already provides.

6. **Always append `?embed=1`** when opening from the hub cabinet (hub already does this).

## Desktop vs mobile system rules

### Desktop (`html.hg-desktop`, fine pointer)

- Show `[data-hg-desktop-controls]` / `.hg-desktop-controls` (keyboard hints, denser HUD).
- Hover styles are allowed as **enhancement only** (`.hg-hover-only`); never the sole path to an action.
- Use more horizontal playfield width (`--hg-playfield-max` up to ~1280px).
- Dense HUD chips OK (`html.hg-desktop .hg-hud`).
- Escape → pause (via `bindControlSurfaces` / `boot`).

### Mobile / coarse pointer (`html.hg-mobile`, `html.hg-coarse`)

- Show `[data-hg-mobile-controls]` / `.hg-mobile-controls`.
- **Min 44×44px** touch targets (`.hg-btn`, `.hg-control`, chips on mobile).
- Respect **safe-area insets** (`--hg-safe-*`, `.hg-safe-pad`, thumb dock padding).
- Put primary actions in the **thumb zone** (`.hg-thumb-actions`).
- **No hover-only UI**; use visible buttons.
- Prefer `touch-action: manipulation` on chrome; `touch-action: none` only on the canvas/playfield that owns gestures.
- Prevent overscroll chaining (`overscroll-behavior: none` on `body` / `.hg-game-root`).
- Viewport guidance: `viewport-fit=cover`; avoid nested scroll traps inside the cabinet iframe.

### Embed (hub iframe)

- `embed.js` adds `humane-embed` (and early `hg-mobile` / `hg-desktop` hints).
- Strip site header / adventure nav / back links (`embed.css`) — **cabinet owns chrome**.
- Fill `100dvh` without double top bars; keep bottom safe-area for home indicator when needed.
- Optional: `HumaneGameSystem.pauseOnVisibilityChange` when the player switches dock games or backgrounds the tab.

## Light / dark theming

Every cabinet game shares one arcade preference. The cabinet header owns the
control; games follow.

**Preference:** `localStorage.humaneGamesTheme` = `light` | `dark` (legacy key
`petMatchTheme` still reads). This is deliberately **separate** from the staff
portal's `mchs_staff_theme` — flipping the arcade never changes the portal, and
vice versa.

**Resolution order** in `theme.js`: `?theme=` → saved preference → embed/standalone
default. The URL param wins because the cabinet is authoritative while a game is
framed.

**How it reaches a game:**

1. The hub appends `&theme=light|dark` to the iframe URL on open.
2. `embed.js` sets `html.pm-theme-*` before the first stylesheet lands (no flash).
3. `theme.js` re-applies the same value and takes over storage + events.
4. Toggling mid-session posts `{ type: 'arcade:set_theme', theme }` into the
   iframe — same pattern as `arcade:set_mute`.

**Adopting a game:**

- Load `theme.js` right after `embed.js`, **before** stylesheets.
- Style off `--hg-theme-*` instead of hardcoded hex. Games built on `.hg-*`
  classes flip for free.
- Do **not** ship an in-frame Light/Dark button. The cabinet's top-right toggle
  is the only theme control in the arcade; a second one would disagree with the
  saved preference. `embed.css` hides `[data-hg-theme-toggle]` as a backstop.
- Canvas games can't use CSS for the playfield, so listen instead:
  ```js
  window.addEventListener('humane-games-theme', (e) => retint(e.detail.theme));
  retint(window.HumaneGamesTheme?.get?.());
  ```

**Where art flips and where it doesn't.** Photographic and illustrated assets —
Booster foil packs, Shelter Run's temple trail — keep their designed palettes in
both themes, because there is no light version of a photograph.

Catwalk is the exception: its playfield is generated vector linework, so light
mode repaints it. `src/games/catwalk/rendering/palette.ts` holds a night set and
a day set for both the wire colors (`PALETTE`) and the cockpit HUD (`HUD`), and
`setCatwalkTheme()` swaps them in place plus zeroes `glowScale` — the neon bloom
is what makes the night version read as spooky. `resolveShift()` then runs the
daylight → afternoon progression instead of night → late night → dawn.

`window.HumaneGamesTheme`: `get()`, `apply(theme, opts)`, `toggle()`,
`bindToggle(btn)`, `isEmbedded()`, `getUrlTheme()`, `getSaved()`, `resolve()`.

## Token reference (CSS)

Core (parity with teal/cream Humane look): `--fur`, `--treat`, `--treat-deep`, `--ink`, `--mint`, `--cream`, `--teal`, `--teal-deep`, `--shadow`.

System: `--hg-touch-min`, `--hg-safe-*`, `--hg-thumb-zone`, `--hg-focus-ring`, `--hg-chip-bg`, `--hg-overlay-scrim`, `--hg-playfield-max`.

Theme (flip with `html.pm-theme-light` / `html.pm-theme-dark`, aligned to the staff
portal's `--sp-*` palette): `--hg-theme-bg`, `--hg-theme-bg-elevated`,
`--hg-theme-surface`, `--hg-theme-surface-soft`, `--hg-theme-text`,
`--hg-theme-text-muted`, `--hg-theme-border`, `--hg-theme-border-soft`,
`--hg-theme-accent`, `--hg-theme-accent-soft`, `--hg-theme-accent-contrast`,
`--hg-theme-scrim`, `--hg-theme-shadow`.

| | Light | Dark |
|---|---|---|
| bg | `#f4f7f5` | `#071a17` |
| surface | `#ffffff` | `rgba(11,36,32,0.85)` |
| text | `#173a39` | `#ffffff` |
| border | `#cbd5e1` | `rgba(19,78,74,0.8)` |
| accent | `#0f766e` | `#5eead4` |

## JS API (`window.HumaneGameSystem`)

- `isEmbed()`, `isMobileLike()`, `isCoarsePointer()`, `isFinePointer()`
- `applyViewportClasses(htmlElement?)` → `{ desktop, mobile, coarse }`
- `bindControlSurfaces({ onAction, root, escapePauses, listenGlobalKeys })` → `unbind()`
- `pauseOnVisibilityChange(onPause, onResume?)` → `unbind()`
- `boot({ onAction, onVisibilityPause, onVisibilityResume, watchResize })` → `{ mode, isEmbed, dispose }`

`HumaneAudio.getSuite()` remains unchanged for SFX/music.

## Hub notes

Light cabinet tweaks only: touch-friendly header controls, iframe `touch-action`, safe-area on header/dock. Do not redesign the whole games hub when extending this system.
