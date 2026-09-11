# Unified Humane Game System (Desktop + Mobile)

Shared chrome, tokens, and input patterns for every embedded Humane Arcade game
(booster, match, flappy-cat, catwalk, shelter-run, dex, and future titles).

## Files

| File | Role |
|------|------|
| `humane-game-system.css` | Design tokens, HUD chips, buttons, overlays, desktop/mobile control visibility, safe areas |
| `shared-styles.css` | Site/game shell styles; **imports** `humane-game-system.css` |
| `shared.js` | `HumaneAudio` + **`HumaneGameSystem`** input/viewport helpers |
| `embed.js` / `embed.css` | `?embed=1` → `html.humane-embed` (no double chrome in hub iframe) |
| Hub `frontend/src/pages/games/index.astro` | Cabinet iframe + dock; supplies outer chrome |

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

## Token reference (CSS)

Core (parity with teal/cream Humane look): `--fur`, `--treat`, `--treat-deep`, `--ink`, `--mint`, `--cream`, `--teal`, `--teal-deep`, `--shadow`.

System: `--hg-touch-min`, `--hg-safe-*`, `--hg-thumb-zone`, `--hg-focus-ring`, `--hg-chip-bg`, `--hg-overlay-scrim`, `--hg-playfield-max`.

## JS API (`window.HumaneGameSystem`)

- `isEmbed()`, `isMobileLike()`, `isCoarsePointer()`, `isFinePointer()`
- `applyViewportClasses(htmlElement?)` → `{ desktop, mobile, coarse }`
- `bindControlSurfaces({ onAction, root, escapePauses, listenGlobalKeys })` → `unbind()`
- `pauseOnVisibilityChange(onPause, onResume?)` → `unbind()`
- `boot({ onAction, onVisibilityPause, onVisibilityResume, watchResize })` → `{ mode, isEmbed, dispose }`

`HumaneAudio.getSuite()` remains unchanged for SFX/music.

## Hub notes

Light cabinet tweaks only: touch-friendly header controls, iframe `touch-action`, safe-area on header/dock. Do not redesign the whole games hub when extending this system.
