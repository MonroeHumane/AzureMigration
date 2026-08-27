# Shelter Pit - Art Style

All gameplay sprites are **procedurally generated** at boot via Phaser `generateTexture`. No external sprite sheets.

## Grid

- Logical cell: **32×32** px
- HD export: **64×64** (`CFG.HD_MUL = 2`) with `FilterMode.NEAREST`
- UI elements may bake at 1× native resolution

## Palette

See `src/art/palette.js` - Monroe Humane dark UI + warm kennel floor tones.

## Rules

1. Max **4 fill colors** + 1 highlight + 1 outline (`#0f172a`) per gameplay icon
2. Care balls: rounded rect + family color + tier ring (L2 blue, L3 gold)
3. Stressors: soft shapes only - no violent imagery
4. Volunteers: simple face + hair block + role color frame
5. Buildings: isometric-ish box + triangle roof

## Texture keys

Convention: `care:{id}:{tier}`, `perk:{id}`, `stressor:{type}:{size}`, `vol:{id}`, `bld:{kind}`, `bg:{zoneId}`

Run `npm run export:atlas` to regenerate `tools/texture-manifest.json`.
