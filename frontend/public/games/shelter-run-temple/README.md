# Shelter Run Temple (parallel remake)

Pseudo-3D **3-lane** Temple Run–style remake of Shelter Run.

## Why parallel?

Per design brief §5: develop at `shelter-run-temple/`, keep live `shelter-run/` until cutover.
Hub can point here for QA; final cutover either swaps folder contents or updates hub URL.

## Design choices

- **Phaser 3** + GameHelix-style vanishing-point corridor (no Three.js)
- **Portrait-first** mobile; landscape still plays (rotate hint)
- L/R = real **lane change**; up = **jump**; down = **timed slide**
- Obstacles: `LANE_BLOCK` / `LOW` / `HIGH` (turn gates deferred to v1.5)
- **2 lives** + short invuln
- Mid-run pet finds = **soft toast**; full Adoptedex flip card at Round Over
- In-run avatar = **procedural rear/¾ silhouette** (companion tint). Remastered `cat-sheet.png` (32×32) kept for **menu picker** only — side profile fights chase camera
- Preserved: `pets.js`, `dex-integration.js`, milestones `distance_500|1500|3000`, `game_id`/`shelter_run`, embed postMessages

## Playtest

- Local: serve `frontend/public` and open `/games/shelter-run-temple/index.html`
- Embed: `/games/shelter-run-temple/index.html?embed=1`
- Debug hitbox: `?debug=1` · force pads: `?touch=1`
