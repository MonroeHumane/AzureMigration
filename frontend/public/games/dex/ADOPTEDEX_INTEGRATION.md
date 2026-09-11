# Adoptédex integration guide (game authors)

Shared client: `frontend/public/games/dex/dex-shared.js` → `window.MonroeAdoptedex`.

## Load order

```html
<script src="/games/dex/dex-shared.js?v=6"></script>
<!-- optional standalone CSS if you do not rely on injected toast styles -->
<link rel="stylesheet" href="/games/dex/reward-toast.css?v=6" />
```

Pass `dex_user` / `dex_api` / `dex_display` on the embed URL (cabinet hub already does this). Guests resolve to `guest` via `getParams()`.

## Core API

| Method | Purpose |
|--------|---------|
| `getParams()` | `{ dexUser, dexDisplay, dexApi }` |
| `fetchDex(api, user)` | Profile + `met_ids` + pack/coin stats |
| `discoverPet` / `discoverBulk` | Record discoveries (`postMessage` `adoptedex:pet_discovered`) |
| `claimReward(api, user, gameId, rewardKey, extra?)` | **Server-authoritative** packs/coins. Only treat as earned when `result.claimed === true`. Posts `adoptedex:pack_awarded` on success. |
| `openPack(api, user, tier?)` | Spend one unopened pack; returns cards + `pack_rarity` |
| `awardCoins` / `spendCoins` | Coin ledger (shop uses `spendCoins(..., 'buy_pack')`) |
| `createFlipCard` / `renderGrid` | Shared flip-card UI |
| `showRewardToast(opts)` | Shared pack-earned overlay (44px targets, safe-area) |
| `showFlipCardOverlay(pet, opts)` | Meet-the-Pet / reveal celebration |
| `claimDailyStreak(api, user, 'dex'\|'hub')` | Once per UTC day |
| `claimSpeciesScout(api, user, species, count)` | Bonus after 3 / 10 of one type |
| `buyPackWithCoins(api, user)` | 25 coins → 1 pack |
| `meetRandomPet(...)` | Discover one unmet pet + flip overlay |
| `syncLocalPacksFromProfile(data)` | Keep `localStorage.monroeDexPacks` aligned with server |

## Reward claim contract

1. Call `claimReward` with a **key that exists** in `AdoptedexController::REWARD_TABLE`.
2. **Never** bump `monroeDexPacks` or `postMessage` until `claimed === true` (the shared client already posts on success / offline fallback).
3. Show UI with `showRewardToast` only after a confirmed claim.

### Known game_id → reward_key examples

- `match`: `level_3`, `level_5`, `level_10`
- `flappy_cat`: `score_5`, `score_10`, `score_15`, `score_25`, `score_30`, `score_50`
- `shelter_run`: `distance_500`, `distance_1500`, `distance_3000`
- `catwalk`: `score_500`, `score_1500`, `score_3000`
- `booster`: `first_pack`, `album_10`, `album_25`
- `dex` / `hub`: `daily_streak` (stored as `daily_streak_YYYY-MM-DD`)
- `dex`: `species_scout_cat_3`, `species_scout_dog_3`, `species_scout_cat_10`, `species_scout_dog_10`

## postMessage events (iframe → cabinet)

- `adoptedex:pet_discovered`
- `adoptedex:pack_awarded`
- `adoptedex:pack_opened`

## Do / Don't

- **Do** keep `?embed=1` behavior unchanged; avoid chrome that breaks cabinet embeds.
- **Do** support guest profiles (`dex_user=guest`).
- **Don't** trust client `count` / `coins` — server caps apply.
- **Don't** rewrite the booster engine; bridge via `MonroeAdoptedex` + `monroe-adoptedex-updated`.
