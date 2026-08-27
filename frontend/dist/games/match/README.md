# Pet Match - image workflow

Pet Match loads card photos from `manifest.json` in this folder.

## Add or replace photos

1. Drop square images (400×400 or larger) into the repo folder `matchimages/` at the project root, **or** directly into `images/` here.
2. Name files consistently (`pet01.jpg`, `pet02.webp`, …).
3. Add one row per image in `manifest.json`:

```json
{ "id": "pet01", "file": "images/pet01.jpg", "alt": "Short description for screen readers" }
```

4. You need **at least 18 unique images** for level 10 (36 cards). Levels 1–7 work with 12+ images.

## Sync helper

From the `wordpress-rebuild` folder:

```powershell
.\tools\sync_match_images.ps1
```

This copies `matchimages/*` into `theme/.../match/images/` and prints manifest rows to paste.

## Progress

Progress is **session only** - each time you open Pet Match from `/games/`, it starts at level 1. Beating levels unlocks the next level until you close the game. **New game** resets within the same session.

## Placeholders

Shipped SVG placeholders (`pet01.svg`–`pet18.svg`) work out of the box. Replace with real shelter photos when ready - no code changes beyond `manifest.json`.
