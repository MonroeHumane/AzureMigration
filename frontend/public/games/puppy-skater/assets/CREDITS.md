# Puppy Skater — asset credits

## Dog sprite sheets (`dog_*.png`)

Baked from a rigged 3D model — rendered to 2D sprite strips by `dev/bake.html`.

- **Model:** "Dog" by Quaternius — https://poly.pizza/m/2kUk0QqpCg — CC0 (public domain)
- **Skateboard:** "Skateboard" by Poly by Google — https://poly.pizza/m/7Dfn4VtTCWY — **CC-BY 3.0** — "Skateboard model by Google Poly archive"
- Coat variants (barnaby/daisy/pepper/patches) produced by texture-atlas filtering at bake time.

## Dev rigs (viewer only, not shipped in-game)

`dev/models/` — Quaternius pug/husky/shiba/dog (CC0 / CC-BY per `dev/dogview.html` labels), Gobkit corgi (CC0), Khronos Fox (CC0), Poly Pizza skateboards + hoverboards (CC0 / CC-BY per labels).

## Everything else

Generated in-repo by `tools/gen_puppy_skater.py` (PIL): blocks, fish, whale, clouds, skyline/hedge/fence strips, cover, Get Ready / Game Over art. Original PIL dog sheets preserved in `dev/pil_backup/`.
