# Shelter Pit - Game Design Document

Kid-friendly Ball x Pit–style roguelite for Monroe Humane Society.

## Loops

### Kennel Shift (run)

- Shoot tennis / care balls at **stressors** on a grid
- Collect **heart tokens** → level up → **draft** care ball or perk
- **Enrichment Station** drops: Boost, Blend (fuse 2× L3), Evolve (recipe craft)
- Clear all stressors or survive the shift timer

### Shelter Campus (meta)

- Unlocks after **2 completed shifts**
- Place buildings, resource tiles regrow over real time
- **Harvest run**: volunteer bounces to collect supplies

## Content

- 8 care balls (expandable to 12)
- 12 perks
- 17 evolution recipes
- 8 volunteers / 6 zones

## Integration

- Adoptédex nickname required on `/games/`
- Real pet photos via `pet-match-pets` REST
- Cloud save: `shelter-pit/{user}/save`
