# Pet Snake Engine Migration Log

Use this checklist to track the transition from the legacy inline implementation in `petsnake.html` to the shared `PetSnakeEngine` module and DOM renderer.

## Phase 1 – Preparation
- [x] Document current inline logic and UI responsibilities.
- [x] Extract initial engine scaffold (`engine/pet-snake-engine.js`).
- [x] Build DOM renderer helper (`engine/dom-board-renderer.js`).

## Phase 2 – Engine Parity
- [ ] Move remaining legacy helpers (board sizing, best-score hooks) into engine-friendly utilities.
- [ ] Confirm hazards (powerups, bombs, vacuum, tail) behave identically inside the engine.

## Phase 3 – UI Integration
- [x] Convert `petsnake.html` script to an ES module and import the engine/renderer.
- [x] Instantiate a single engine + renderer instance after board creation.
- [x] Route all inputs (keyboard, touch, buttons) through engine APIs (`startRun`, `pause`, `resume`, `enqueueDirection`).
- [x] Subscribe to engine events (`score`, `run:*`, `effects`, `live`, `powerup:*`, `bomb:*`) to update UI, meters, audio, and menus.
- [x] Remove redundant global state/RAF loop from `petsnake.html` once event wiring is complete.

### Updated Plan (2025-11-29)
- Execute Phase 3 in three mini-steps to keep the game playable:
	1. **Inputs First** – wire keyboard/touch/menu controls to engine APIs while legacy loop still runs (guarded behind feature flag) to validate control flow.
	2. **HUD & Audio Events** – subscribe to engine events for score/effects/live updates; gradually disable legacy state writes.
	3. **Legacy Cleanup** – remove old globals, RAF loop, and direct DOM mutations once event wiring is stable.
- After each mini-step, smoke-test Classic/Super to ensure regressions are caught early.

## Phase 4 – Verification
- [ ] Regression test Classic/Super modes across all boards, ensuring audio, fullscreen, accessibility, and best-score storage still work.
- [ ] Update documentation/readme to mention the shared engine architecture.

_Add notes below as you work through the checklist._

### Notes
- 2025-11-28: Engine scaffold and DOM renderer committed; hazards now live inside `PetSnakeEngine` but UI still uses legacy loop.
- 2025-11-29: Switched `petsnake.html` to module script, imported engine/renderer, and instantiated them after board setup.
- 2025-11-30: Cleaned up the accidental render block, routed the main render helper through `DomBoardRenderer`, added engine config sync helpers, and began forwarding inputs/pause events to the engine (Phase 3 mini-step 1 groundwork).
- 2025-11-30: Cleaned up the accidental render block, routed the main render helper through `DomBoardRenderer`, added engine config sync helpers, and began forwarding inputs/pause events to the engine (Phase 3 mini-step 1 groundwork).
- 2025-11-29: Finished Phase 3 mini-step 1 by subscribing the UI to engine events (score/effects/live/audio) and handing run control to `engine.startRun`, keeping the legacy loop only as a fallback.
- 2025-11-29: Completed mini-step 3 by deleting the legacy RAF loop, vacuum helpers, and manual state caches so the UI now relies solely on `PetSnakeEngine` for game flow.
