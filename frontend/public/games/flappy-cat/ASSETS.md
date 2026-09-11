# Flappy Cat art sources

Environment and UI sprites are **real game-art packs** (not AI stills), CC0 from [Kenney.nl](https://kenney.nl):

- **Tappy Plane** — rocks (`rockGrass` / `rockGrassDown` as `rock_top.png` / `rock_bottom.png`), puff, star; UI/numbers already in-tree
  - **Rock variants** (same pack, same 108×239 size): ice / snow / dirt pairs used for score-gated and run-to-run variety via `game/fc-asset-variants.js` (swaps `gameInstance.images.rockTop` / `rockBottom` after assets load when mutable)
    - `rock_top_ice.png` ← `rockIceDown.png`, `rock_bottom_ice.png` ← `rockIce.png`
    - `rock_top_snow.png` ← `rockSnowDown.png`, `rock_bottom_snow.png` ← `rockSnow.png`
    - `rock_top_dirt.png` ← `rockDown.png`, `rock_bottom_dirt.png` ← `rock.png`
- **Background Elements** — clouds, houses, trees, sun
  - Extra clouds `cloud4.png`–`cloud6.png` injected into `gameInstance.clouds` when images are mutable

Companion cat strips (`cat_*.png`, `remastered_grey_tabby.png`) are the shelter-branded run cycles (black keyed to alpha for canvas draw).

## DOM visual pass (no bundle rewrite)

`game/index.html` adds score-gated biome classes on `html` / `#game-shell` (`fc-biome-dawn|day|dusk|night`), combo/streak pops, near-death vignette from `gameInstance.model.pipes`, and honors `prefers-reduced-motion`.

AI remaster from PR #37 was reverted/replaced because it baked checkerboards and opaque backgrounds.
