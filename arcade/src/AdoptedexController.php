<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class AdoptedexController
{
    /** Max packs granted for any single reward key (client values are ignored). */
    private const MAX_PACKS_PER_REWARD = 2;

    /** Max coins granted for any single reward key (client values are ignored). */
    private const MAX_COINS_PER_REWARD = 25;

    /** Max coins granted for a catalog award reason. */
    private const MAX_COINS_PER_AWARD = 10;

    /** Max game_award coins a profile can receive per UTC day. */
    private const GAME_AWARD_DAILY_CAP = 25;

    /**
     * Server-side pack tiers: tier => card count. The client may request a tier
     * but can only consume an inventory row of that tier — it can never turn a
     * standard pack into a deluxe one.
     */
    private const PACK_TIERS = [
        'standard' => 1,
        'duo'      => 2,
        'deluxe'   => 3,
    ];

    /**
     * Server-side reward table: game_id => reward_key => packs/coins/tier.
     * Client-supplied coins/count/tier are never trusted.
     */
    private const REWARD_TABLE = [
        'match' => [
            'level_3'  => ['packs' => 1, 'coins' => 0, 'tier' => 'standard'],
            'level_5'  => ['packs' => 1, 'coins' => 0, 'tier' => 'standard'],
            'level_10' => ['packs' => 1, 'coins' => 0, 'tier' => 'duo'],
        ],
        'flappy_cat' => [
            'score_5'  => ['packs' => 1, 'coins' => 1,  'tier' => 'standard'],
            'score_10' => ['packs' => 1, 'coins' => 2,  'tier' => 'standard'],
            'score_15' => ['packs' => 1, 'coins' => 3,  'tier' => 'standard'],
            'score_25' => ['packs' => 1, 'coins' => 5,  'tier' => 'duo'],
            'score_30' => ['packs' => 1, 'coins' => 5,  'tier' => 'duo'],
            'score_50' => ['packs' => 1, 'coins' => 10, 'tier' => 'deluxe'],
        ],
        'booster' => [
            'first_pack' => ['packs' => 1, 'coins' => 0,  'tier' => 'standard'],
            'album_10'   => ['packs' => 1, 'coins' => 5,  'tier' => 'standard'],
            'album_25'   => ['packs' => 1, 'coins' => 10, 'tier' => 'duo'],
        ],
        'petsnake' => [
            'score_20' => ['packs' => 1, 'coins' => 2, 'tier' => 'standard'],
            'score_50' => ['packs' => 1, 'coins' => 5, 'tier' => 'standard'],
        ],
        'shelter_run' => [
            'distance_500'  => ['packs' => 1, 'coins' => 1, 'tier' => 'standard'],
            'distance_1500' => ['packs' => 1, 'coins' => 3, 'tier' => 'standard'],
            'distance_3000' => ['packs' => 1, 'coins' => 5, 'tier' => 'duo'],
        ],
        'catwalk' => [
            'score_500'  => ['packs' => 1, 'coins' => 2,  'tier' => 'standard'],
            'score_1500' => ['packs' => 1, 'coins' => 5,  'tier' => 'standard'],
            'score_3000' => ['packs' => 1, 'coins' => 10, 'tier' => 'duo'],
        ],
        'puppy_skater' => [
            'distance_500'  => ['packs' => 1, 'coins' => 1, 'tier' => 'standard'],
            'distance_1500' => ['packs' => 1, 'coins' => 3, 'tier' => 'standard'],
            'distance_3000' => ['packs' => 1, 'coins' => 5, 'tier' => 'duo'],
        ],
        // Album / hub shared systems (client triggers; server caps + unique keys dedup)
        'dex' => [
            'daily_streak' => ['packs' => 1, 'coins' => 5, 'tier' => 'standard'],
            'species_scout_cat_3'  => ['packs' => 1, 'coins' => 3, 'tier' => 'standard'],
            'species_scout_dog_3'  => ['packs' => 1, 'coins' => 3, 'tier' => 'standard'],
            'species_scout_cat_10' => ['packs' => 1, 'coins' => 8, 'tier' => 'standard'],
            'species_scout_dog_10' => ['packs' => 1, 'coins' => 8, 'tier' => 'standard'],
        ],
        'hub' => [
            'daily_streak' => ['packs' => 1, 'coins' => 5, 'tier' => 'standard'],
        ],
    ];

    /**
     * Coin shop catalog: spend reason => fixed cost + pack tier granted.
     * Client-supplied amounts are never trusted.
     */
    private const COIN_SPEND_CATALOG = [
        'buy_pack'   => ['cost' => 25, 'packs' => 1, 'tier' => 'standard'],
        'buy_duo'    => ['cost' => 45, 'packs' => 1, 'tier' => 'duo'],
        'buy_deluxe' => ['cost' => 60, 'packs' => 1, 'tier' => 'deluxe'],
    ];

    /**
     * Server-side coin award catalog: reason => fixed delta.
     * Client-supplied amounts are ignored.
     */
    private const COIN_AWARD_REASONS = [
        'game_award'  => 5,
        'daily_bonus' => 10,
    ];

    /**
     * Per-game upgrade store: upgrade id => 5 coin costs (level 1..5 price).
     * Client-supplied levels/costs are never trusted — the server owns both.
     */
    private const UPGRADE_DEFS = [
        'magnet'   => ['label' => 'Treat Magnet',         'costs' => [60, 140, 280, 500, 800]],
        'golden'   => ['label' => 'Golden Treats',        'costs' => [50, 120, 250, 450, 700]],
        'ghost'    => ['label' => 'Ghost Pepper Zoomies', 'costs' => [80, 180, 360, 650, 1000]],
        'boost'    => ['label' => 'Autopilot Sprint',     'costs' => [90, 200, 400, 700, 1100]],
        'donation' => ['label' => 'Donation Burst',       'costs' => [40, 100, 220, 400, 650]],
    ];

    /** Coins granted by a Donation Burst pickup, indexed by upgrade level 0-5. */
    private const DONATION_VALUES = [0, 8, 16, 26, 40, 60];

    /**
     * Objective catalog per game: key => label. Each claimed objective raises
     * the player's permanent score multiplier for that game by +1.
     */
    private const OBJECTIVE_DEFS = [
        'shelter_run' => [
            'rescue_5'      => 'Rescue 5 pets in one run',
            'rescue_15'     => 'Rescue 15 pets all-time',
            'clean_1000'    => 'Run 1000m without stumbling',
            'streak_8'      => 'Reach an 8-rescue streak',
            'distance_750'  => 'Run 750m in one run',
            'distance_2500' => 'Run 2500m in one run',
            'nearmiss_3'    => 'Dodge 3 obstacles by a whisker in one run',
            'pickups_2'     => 'Grab 2 power-ups in one run',
            'runs_5'        => 'Finish 5 runs',
            'chase_escape'  => 'Escape the kennel pack',
        ],
    ];

    /**
     * Card-rarity draw weights for pack pulls. Mirrors card-model.js —
     * keep the two in sync.
     */
    private const RARITY_WEIGHTS = [
        'common'        => 58,
        'tiny_wonder'   => 14,
        'longtimer'     => 12,
        'golden_senior' => 9,
        'alumni'        => 7,
    ];

    /** Emergency fallback if the generated catalog file is missing. */
    private const SHELTER_PET_POOL = [
        ['id' => '61388848', 'name' => 'Scoot', 'type' => 'cat', 'breed' => 'Domestic Shorthair', 'gender' => 'male', 'age' => '4 months', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61388848.jpg'],
        ['id' => '61461825', 'name' => 'Onion Ring', 'type' => 'dog', 'breed' => 'Mixed Breed Large', 'gender' => 'male', 'age' => '2 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61461825.jpg'],
        ['id' => '61448087', 'name' => 'Puma', 'type' => 'dog', 'breed' => 'Terrier Mix', 'gender' => 'female', 'age' => '4 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61448087.jpg'],
        ['id' => '60985568', 'name' => 'Fiona', 'type' => 'dog', 'breed' => 'Mixed Hound', 'gender' => 'female', 'age' => '5 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/60985568.jpg'],
        ['id' => '61352635', 'name' => 'Munsie', 'type' => 'cat', 'breed' => 'Calico Mix', 'gender' => 'female', 'age' => '3 months', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61352635.jpg', 'archived' => true],
    ];

    private PDO $db;

    /** @var array<int,array>|null Lazily-loaded generated pet catalog. */
    private static ?array $catalog = null;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /** Public tier metadata for GET /v1/pack-tiers. */
    public function getPackTiers(): array
    {
        $out = [];
        $labels = ['standard' => 'Standard Pack', 'duo' => 'Duo Pack', 'deluxe' => 'Deluxe Pack'];
        $costs = ['standard' => 25, 'duo' => 45, 'deluxe' => 60];
        foreach (self::PACK_TIERS as $tier => $count) {
            $out[$tier] = [
                'cardCount' => $count,
                'label'     => $labels[$tier] ?? ucfirst($tier) . ' Pack',
                'coinCost'  => $costs[$tier] ?? null,
            ];
        }
        return $out;
    }

    // ─── Pet catalog ─────────────────────────────────────────────────────────

    /**
     * Load the generated shelter pet catalog (data/shelter-pets.json — built
     * from the frontend shelter-pets.json + archived-pets.json snapshots).
     * Falls back to the small hardcoded pool if the file is absent.
     */
    private function loadCatalog(): array
    {
        if (self::$catalog !== null) {
            return self::$catalog;
        }
        $path = dirname(__DIR__) . '/data/shelter-pets.json';
        if (is_readable($path)) {
            $rows = json_decode((string)file_get_contents($path), true);
            if (is_array($rows) && count($rows) > 0) {
                self::$catalog = array_values(array_filter($rows, function ($p) {
                    return is_array($p) && !empty($p['id']);
                }));
                return self::$catalog;
            }
        }
        self::$catalog = self::SHELTER_PET_POOL;
        return self::$catalog;
    }

    /**
     * Canonical rarity rule — mirrors card-model.js rarityForPet exactly.
     * Age strings like "4 years 1 month" must NOT count as tiny: a year
     * component always wins over the month component.
     */
    public static function petRarity(array $pet): string
    {
        if (!empty($pet['archived']) || !empty($pet['archived_at'])) {
            return 'alumni';
        }
        $age = strtolower((string)($pet['age_display'] ?? $pet['age'] ?? ''));
        $years = null;
        $months = null;
        if (preg_match('/(\d+)\s*year/', $age, $m)) {
            $years = (int)$m[1];
        }
        if ($years === null && preg_match('/(\d+)\s*month/', $age, $m)) {
            $months = (int)$m[1];
        }
        if ($years !== null && $years >= 7) {
            return 'golden_senior';
        }
        if ($years === null && ($months !== null && $months <= 6
            || strpos($age, 'baby') !== false || strpos($age, 'kitten') !== false || strpos($age, 'puppy') !== false)) {
            return 'tiny_wonder';
        }
        if (($pet['location'] ?? '') === 'Foster Care') {
            return 'longtimer';
        }
        $intake = (string)($pet['intake_date'] ?? '');
        if ($intake !== '' && strtotime($intake) !== false && strtotime($intake) < strtotime('-9 months')) {
            return 'longtimer';
        }
        if (strlen((string)($pet['description'] ?? '')) > 200) {
            return 'longtimer';
        }
        return 'common';
    }

    /** Normalized card payload returned to clients. */
    private static function cardPayload(array $pet): array
    {
        return [
            'id'       => (string)$pet['id'],
            'name'     => (string)($pet['name'] ?? 'Companion'),
            'type'     => (string)($pet['type'] ?? 'other'),
            'breed'    => (string)($pet['breed'] ?? 'Rescue Companion'),
            'gender'   => (string)($pet['gender'] ?? 'unknown'),
            'age'      => (string)($pet['age_display'] ?? $pet['age'] ?? ''),
            'location' => (string)($pet['location'] ?? 'Shelter'),
            'file'     => (string)($pet['file'] ?? $pet['image_url'] ?? ''),
            'url'      => (string)($pet['url'] ?? ''),
            'archived' => !empty($pet['archived']),
            'rarity'   => self::petRarity($pet),
        ];
    }

    /**
     * Rarity-weighted card draw. Prefers pets the profile hasn't met yet,
     * falling back to the full pool. No duplicates within one pack.
     * $guaranteeRare forces at least one non-common card (deluxe packs).
     */
    private function drawCards(int $profileId, int $count, bool $guaranteeRare): array
    {
        $pool = array_values(array_filter($this->loadCatalog(), function ($p) {
            return !isset($p['in_pool']) || $p['in_pool'];
        }));
        if (!$pool) {
            return [];
        }

        $met = [];
        try {
            $stmt = $this->db->prepare("SELECT pet_id FROM game_discoveries WHERE profile_id = ?");
            $stmt->execute([$profileId]);
            while ($id = $stmt->fetchColumn()) {
                $met[(string)$id] = true;
            }
        } catch (Exception $e) {}

        $byRarity = [];
        foreach ($pool as $pet) {
            $r = self::petRarity($pet);
            $pet['rarity'] = $r;
            $byRarity[$r][] = $pet;
        }

        // Weighted rarity pick, preferring unmet pets inside the bucket.
        $picked = [];
        $usedIds = [];
        $draw = function (array $rarities) use (&$byRarity, &$met, &$usedIds) {
            $weighted = [];
            foreach ($rarities as $r => $w) {
                if (empty($byRarity[$r])) {
                    continue;
                }
                // Prefer unmet: split bucket, draw unmet first.
                $unmet = array_values(array_filter($byRarity[$r], function ($p) use (&$met, &$usedIds) {
                    return !isset($usedIds[$p['id']]) && !isset($met[$p['id']]);
                }));
                $candidates = $unmet ?: array_values(array_filter($byRarity[$r], function ($p) use (&$usedIds) {
                    return !isset($usedIds[$p['id']]);
                }));
                if (!$candidates) {
                    continue;
                }
                $weighted[] = ['rarity' => $r, 'weight' => $w, 'candidates' => $candidates];
            }
            if (!$weighted) {
                return null;
            }
            $total = array_sum(array_column($weighted, 'weight'));
            $roll = random_int(1, $total);
            foreach ($weighted as $bucket) {
                $roll -= $bucket['weight'];
                if ($roll <= 0) {
                    $card = $bucket['candidates'][random_int(0, count($bucket['candidates']) - 1)];
                    $usedIds[$card['id']] = true;
                    return $card;
                }
            }
            return null;
        };

        for ($i = 0; $i < $count; $i++) {
            $card = $draw(self::RARITY_WEIGHTS);
            if ($card) {
                $picked[] = $card;
            }
        }

        if ($guaranteeRare && $picked) {
            $hasRare = false;
            foreach ($picked as $c) {
                if (($c['rarity'] ?? 'common') !== 'common') {
                    $hasRare = true;
                    break;
                }
            }
            if (!$hasRare) {
                $rareWeights = self::RARITY_WEIGHTS;
                unset($rareWeights['common']);
                $card = $draw($rareWeights);
                if ($card) {
                    $picked[count($picked) - 1] = $card;
                }
            }
        }

        return array_map([self::class, 'cardPayload'], $picked);
    }

    // ─── Identity & ownership ────────────────────────────────────────────────

    /**
     * Resolve a dex profile for a MUTATING call, enforcing ownership.
     * - The 'guest' slug is a shared scratch profile: anyone may mutate it.
     * - A profile with no owner binds itself to the calling arcade session
     *   profile on first mutation (legacy profiles get claimed by first use).
     * - A profile owned by a different arcade profile rejects the call.
     *
     * Must be called inside a transaction (row is locked FOR UPDATE).
     *
     * @return array{row:array}|array{ok:false,code:string,message:string}
     */
    private function resolveMutableProfile(string $userSlug, ?int $sessionProfileId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM dex_profiles WHERE username_slug = ? FOR UPDATE");
        $stmt->execute([$userSlug]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            return ['ok' => false, 'code' => 'not_found', 'message' => 'Profile not found'];
        }

        // Communal guest profile — never bound.
        if ($userSlug === 'guest') {
            return ['row' => $profile];
        }

        $owner = isset($profile['owner_profile_id']) ? (int)$profile['owner_profile_id'] : null;
        if ($owner === null) {
            if ($sessionProfileId === null) {
                return ['ok' => false, 'code' => 'forbidden', 'message' => 'A session is required to claim this profile.'];
            }
            $bind = $this->db->prepare("UPDATE dex_profiles SET owner_profile_id = ? WHERE id = ?");
            $bind->execute([$sessionProfileId, (int)$profile['id']]);
            $profile['owner_profile_id'] = $sessionProfileId;
            return ['row' => $profile];
        }

        if ($sessionProfileId === null || $owner !== $sessionProfileId) {
            return ['ok' => false, 'code' => 'forbidden', 'message' => 'This Adoptédex profile belongs to another player.'];
        }

        return ['row' => $profile];
    }

    /** Count unopened packs by tier (inventory rows + legacy cache remainder). */
    private function packsByTier(int $profileId, int $legacyTotal): array
    {
        $counts = ['standard' => 0, 'duo' => 0, 'deluxe' => 0];
        $invTotal = 0;
        try {
            $stmt = $this->db->prepare("SELECT tier, COUNT(*) FROM dex_pack_inventory WHERE profile_id = ? AND opened_at IS NULL GROUP BY tier");
            $stmt->execute([$profileId]);
            while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
                $tier = (string)$row[0];
                if (!isset($counts[$tier])) {
                    $counts[$tier] = 0;
                }
                $counts[$tier] += (int)$row[1];
                $invTotal += (int)$row[1];
            }
        } catch (Exception $e) {
            // Table may not exist pre-migration; legacy total still works.
        }
        // Legacy packs (unopened_packs cache larger than tracked inventory)
        // behave as standard packs.
        $legacy = max(0, $legacyTotal - $invTotal);
        $counts['standard'] += $legacy;
        return $counts;
    }

    /**
     * Grant pack inventory rows + keep the denormalized unopened_packs
     * counter in sync. Caller must hold the profile row lock.
     */
    private function grantPacks(int $profileId, string $tier, int $count, string $grantedBy): void
    {
        if ($count <= 0) {
            return;
        }
        if (!isset(self::PACK_TIERS[$tier])) {
            $tier = 'standard';
        }
        $ins = $this->db->prepare("INSERT INTO dex_pack_inventory (profile_id, tier, granted_by, created_at) VALUES (?, ?, ?, NOW())");
        for ($i = 0; $i < $count; $i++) {
            try {
                $ins->execute([$profileId, $tier, $grantedBy]);
            } catch (Exception $e) {
                // Inventory table missing pre-migration — counter still tracks packs.
                break;
            }
        }
        $upd = $this->db->prepare("UPDATE dex_profiles SET unopened_packs = unopened_packs + ? WHERE id = ?");
        $upd->execute([$count, $profileId]);
    }

    // ─── Profile ─────────────────────────────────────────────────────────────

    public function getProfile(string $userSlug): array
    {
        $stmt = $this->db->prepare("SELECT * FROM dex_profiles WHERE username_slug = ?");
        $stmt->execute([$userSlug]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $discStmt = $this->db->prepare("SELECT pet_id, source_game_id as source, discovered_at FROM game_discoveries WHERE profile_id = ?");
        $discStmt->execute([(int)$profile['id']]);
        $discoveries = $discStmt->fetchAll(PDO::FETCH_ASSOC);
        $metIds = array_column($discoveries, 'pet_id');

        $stats = [
            'unopened_packs'     => (int)$profile['unopened_packs'],
            'packs_by_tier'      => $this->packsByTier((int)$profile['id'], (int)$profile['unopened_packs']),
            'total_packs_opened' => (int)$profile['total_packs_opened'],
            'coin_balance'       => (int)$profile['coin_balance'],
            'met'                => count($discoveries),
        ];

        return [
            'ok'                 => true,
            'display_name'       => $profile['display_name'],
            'claimed'            => $profile['owner_profile_id'] !== null,
            'stats'              => $stats,
            'met_ids'            => $metIds,
            'met'                => $discoveries,
            'profile' => [
                'id'                 => (int)$profile['id'],
                'slug'               => $profile['username_slug'],
                'display'            => $profile['display_name'],
                'unopened_packs'     => (int)$profile['unopened_packs'],
                'packs_by_tier'      => $stats['packs_by_tier'],
                'total_packs_opened' => (int)$profile['total_packs_opened'],
                'coin_balance'       => (int)$profile['coin_balance'],
                'met'                => count($discoveries),
                'discoveries'        => $discoveries,
                'stats'              => $stats,
            ],
        ];
    }

    /**
     * Profile auth: creates the profile (with a generated rescue PIN) or
     * resolves an existing one. Passing $pin on an existing profile:
     *   - owned by THIS session + no pin set yet → sets the PIN (opt-in).
     *   - owned by ANOTHER session + pin matches → rebinds ownership to this
     *     session (device recovery).
     */
    public function getOrCreateProfile(string $rawDisplay, ?int $sessionProfileId = null, ?string $pin = null): array
    {
        $display = trim(preg_replace('/\s+/', ' ', $rawDisplay));
        if ($display === '') {
            $display = 'Player';
        }

        $slug = strtolower(preg_replace('/[^a-z0-9_-]/', '', str_replace(' ', '-', $display)));
        if (strlen($slug) < 3) {
            $slug = 'player-' . substr(bin2hex(random_bytes(3)), 0, 6);
        }

        $pin = $pin !== null ? trim($pin) : null;
        if ($pin !== null && !preg_match('/^\d{4,8}$/', $pin)) {
            $pin = null; // silently ignore malformed pins
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT * FROM dex_profiles WHERE username_slug = ? FOR UPDATE");
            $stmt->execute([$slug]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $isOwner = $row['owner_profile_id'] === null
                    || $sessionProfileId === null
                    || (int)$row['owner_profile_id'] === $sessionProfileId
                    || $slug === 'guest';
                $reclaimed = false;
                $pinSet = false;

                if (!$isOwner && $pin !== null && !empty($row['pin_hash'])
                    && password_verify($pin, (string)$row['pin_hash'])) {
                    // Rescue-PIN reclaim: bind this session as the new owner.
                    $rebind = $this->db->prepare("UPDATE dex_profiles SET owner_profile_id = ?, last_active_at = NOW() WHERE id = ?");
                    $rebind->execute([$sessionProfileId, (int)$row['id']]);
                    $row['owner_profile_id'] = $sessionProfileId;
                    $isOwner = true;
                    $reclaimed = true;
                } elseif ($isOwner && $pin !== null && empty($row['pin_hash']) && $slug !== 'guest' && $sessionProfileId !== null) {
                    // Opt-in: an owned session can set a rescue PIN once.
                    $set = $this->db->prepare("UPDATE dex_profiles SET pin_hash = ?, last_active_at = NOW() WHERE id = ?");
                    $set->execute([password_hash($pin, PASSWORD_DEFAULT), (int)$row['id']]);
                    $pinSet = true;
                } else {
                    $upd = $this->db->prepare("UPDATE dex_profiles SET last_active_at = NOW() WHERE id = ?");
                    $upd->execute([(int)$row['id']]);
                }
                $this->db->commit();
                $result = $this->getProfile($slug);
                $result['owned'] = $isOwner;
                $result['has_pin'] = !empty($row['pin_hash']);
                if ($reclaimed) {
                    $result['reclaimed'] = true;
                }
                if ($pinSet) {
                    $result['pin_set'] = true;
                }
                return $result;
            }

            // New profile: generate a rescue PIN so the binder can be
            // recovered on another device. Returned once, stored hashed.
            $rescuePin = null;
            $pinHash = null;
            if ($slug !== 'guest') {
                $rescuePin = sprintf('%06d', random_int(0, 999999));
                $pinHash = password_hash($rescuePin, PASSWORD_DEFAULT);
            }

            $ins = $this->db->prepare("INSERT INTO dex_profiles (username_slug, display_name, owner_profile_id, pin_hash, created_at, last_active_at) VALUES (?, ?, ?, ?, NOW(), NOW())");
            $ins->execute([$slug, $display, $slug === 'guest' ? null : $sessionProfileId, $pinHash]);
            $this->db->commit();

            $result = $this->getProfile($slug);
            $result['owned'] = true;
            $result['has_pin'] = $pinHash !== null;
            if ($rescuePin !== null) {
                $result['rescue_pin'] = $rescuePin;
            }
            return $result;
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Discovery ───────────────────────────────────────────────────────────

    /** Pet ids are numeric shelter ids; reject anything that can't be one. */
    private static function isValidPetId(string $petId): bool
    {
        return (bool)preg_match('/^[A-Za-z0-9_-]{1,32}$/', $petId);
    }

    public function discoverPet(string $userSlug, string $petId, string $source = 'dex', ?int $sessionProfileId = null): array
    {
        if (!self::isValidPetId($petId)) {
            return ['ok' => false, 'code' => 'bad_request', 'message' => 'Invalid pet_id'];
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            $ins = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (?, ?, ?)");
            $ins->execute([$profileId, $petId, $source]);
            $this->db->commit();

            return ['ok' => true, 'pet_id' => $petId];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function discoverBulk(string $userSlug, array $petIds, string $source = 'match', ?int $sessionProfileId = null): array
    {
        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            $ins = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (?, ?, ?)");
            $saved = 0;
            $rejected = [];
            foreach ($petIds as $petId) {
                if (!is_string($petId) || $petId === '' || !self::isValidPetId($petId)) {
                    if (is_string($petId) && $petId !== '') {
                        $rejected[] = $petId;
                    }
                    continue;
                }
                $ins->execute([$profileId, $petId, $source]);
                $saved++;
            }
            $this->db->commit();
            return ['ok' => true, 'count' => $saved, 'rejected' => $rejected];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Rewards ─────────────────────────────────────────────────────────────

    public function claimReward(string $userSlug, string $gameId, string $rewardKey, array $extra = [], ?int $sessionProfileId = null): array
    {
        $reward = self::REWARD_TABLE[$gameId][$rewardKey] ?? null;
        if ($reward === null) {
            return ['ok' => false, 'message' => 'Unknown reward'];
        }

        // Daily streak is once per UTC calendar day: look up config by
        // logical key, but store a date-scoped key so tomorrow can claim again.
        $storedRewardKey = $rewardKey;
        if ($rewardKey === 'daily_streak' && ($gameId === 'dex' || $gameId === 'hub')) {
            $storedRewardKey = 'daily_streak_' . gmdate('Y-m-d');
        }

        $packsAwarded = min(self::MAX_PACKS_PER_REWARD, max(0, (int)$reward['packs']));
        $coinsAwarded = min(self::MAX_COINS_PER_REWARD, max(0, (int)$reward['coins']));
        $packTier = (string)($reward['tier'] ?? 'standard');

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            $ins = $this->db->prepare("INSERT IGNORE INTO dex_claimed_rewards (profile_id, game_id, reward_key, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([$profileId, $gameId, $storedRewardKey]);

            if ($ins->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => true, 'claimed' => false, 'message' => 'Reward already claimed'];
            }

            if ($packsAwarded > 0) {
                $this->grantPacks($profileId, $packTier, $packsAwarded, 'reward_' . $gameId . '_' . $rewardKey);
            }

            if ($coinsAwarded > 0) {
                $coinLedger = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
                $coinLedger->execute([$profileId, $coinsAwarded, 'reward_' . $gameId]);

                $coinUpd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
                $coinUpd->execute([$coinsAwarded, $profileId]);
            }

            $balStmt = $this->db->prepare("SELECT unopened_packs, coin_balance FROM dex_profiles WHERE id = ?");
            $balStmt->execute([$profileId]);
            $updated = $balStmt->fetch(PDO::FETCH_ASSOC) ?: ['unopened_packs' => 0, 'coin_balance' => 0];

            $this->db->commit();

            return [
                'ok'             => true,
                'claimed'        => true,
                'packsAwarded'   => $packsAwarded,
                'packTier'       => $packTier,
                'coinsAwarded'   => $coinsAwarded,
                'unopened_packs' => (int)$updated['unopened_packs'],
                'coin_balance'   => (int)$updated['coin_balance'],
                'packs_by_tier'  => $this->packsByTier($profileId, (int)$updated['unopened_packs']),
                'reward_key'     => $storedRewardKey,
                'game_id'        => $gameId,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Packs ───────────────────────────────────────────────────────────────

    /**
     * Per-run rescue pack grant: floor(rescues / 20) standard packs.
     * Each call settles one run — nothing carries over, so a 50-rescue run
     * pays 2 packs and a 10-rescue run pays 0. The rescue count is
     * client-reported like discoveries/scores; it is clamped so a bad
     * payload cannot mint absurd inventory.
     */
    private const RESCUES_PER_PACK = 20;
    private const MAX_RESCUES_PER_RUN = 400;

    public function earnRescuePacks(string $userSlug, string $gameId, int $rescues, ?int $sessionProfileId = null): array
    {
        if (!isset(self::REWARD_TABLE[$gameId])) {
            return ['ok' => false, 'message' => 'Unknown game'];
        }
        $rescues = max(0, min(self::MAX_RESCUES_PER_RUN, $rescues));
        $packs = intdiv($rescues, self::RESCUES_PER_PACK);

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            if ($packs > 0) {
                $this->grantPacks($profileId, 'standard', $packs, 'rescue_packs_' . $gameId);
            }

            $balStmt = $this->db->prepare("SELECT unopened_packs FROM dex_profiles WHERE id = ?");
            $balStmt->execute([$profileId]);
            $updated = $balStmt->fetch(PDO::FETCH_ASSOC) ?: ['unopened_packs' => 0];

            $this->db->commit();

            return [
                'ok'             => true,
                'rescues'        => $rescues,
                'packsAwarded'   => $packs,
                'packTier'       => 'standard',
                'unopened_packs' => (int)$updated['unopened_packs'],
                'packs_by_tier'  => $this->packsByTier($profileId, (int)$updated['unopened_packs']),
                'game_id'        => $gameId,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function openPack(string $userSlug, string $tier = 'standard', ?int $sessionProfileId = null): array
    {
        if (!isset(self::PACK_TIERS[$tier])) {
            $tier = 'standard';
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profile = $resolved['row'];
            $profileId = (int)$profile['id'];

            // Consume one inventory row of the requested tier. If the profile
            // has no tracked inventory at all but still carries a legacy
            // unopened_packs balance (pre-migration grants), that balance opens
            // as standard packs until exhausted.
            $invStmt = $this->db->prepare("SELECT id, tier FROM dex_pack_inventory WHERE profile_id = ? AND opened_at IS NULL AND tier = ? ORDER BY id LIMIT 1 FOR UPDATE");
            $invRow = null;
            try {
                $invStmt->execute([$profileId, $tier]);
                $invRow = $invStmt->fetch(PDO::FETCH_ASSOC) ?: null;
            } catch (Exception $e) {
                // Table missing pre-migration — rely on the legacy counter.
            }

            $legacyOpen = false;
            if (!$invRow) {
                $anyInv = 0;
                try {
                    $cStmt = $this->db->prepare("SELECT COUNT(*) FROM dex_pack_inventory WHERE profile_id = ? AND opened_at IS NULL");
                    $cStmt->execute([$profileId]);
                    $anyInv = (int)$cStmt->fetchColumn();
                } catch (Exception $e) {}

                if ($anyInv > 0 || $tier !== 'standard') {
                    $this->db->rollBack();
                    return [
                        'ok' => false,
                        'message' => 'No ' . $tier . ' packs available.',
                        'packs_by_tier' => $this->packsByTier($profileId, (int)$profile['unopened_packs']),
                    ];
                }
                $legacyOpen = true;
            }

            if ($invRow) {
                // Inventory row is the source of truth; the counter is a cache
                // clamped at 0 so a desynced counter can't block a real pack.
                $mark = $this->db->prepare("UPDATE dex_pack_inventory SET opened_at = NOW() WHERE id = ?");
                $mark->execute([(int)$invRow['id']]);
                $decr = $this->db->prepare("UPDATE dex_profiles SET unopened_packs = GREATEST(0, unopened_packs - 1), total_packs_opened = total_packs_opened + 1 WHERE id = ?");
                $decr->execute([$profileId]);
            } else {
                // Legacy path: counter itself is authoritative.
                $decr = $this->db->prepare("UPDATE dex_profiles SET unopened_packs = unopened_packs - 1, total_packs_opened = total_packs_opened + 1 WHERE id = ? AND unopened_packs > 0");
                $decr->execute([$profileId]);
                if ($decr->rowCount() === 0) {
                    $this->db->rollBack();
                    return ['ok' => false, 'message' => 'No unopened packs available.'];
                }
            }
            $effectiveTier = $legacyOpen ? 'standard' : $tier;

            // Roll pack luck: 50% Common (+0 coins), 35% Uncommon (+1), 15% Rare (+3)
            $roll = random_int(1, 100);
            if ($roll <= 50) {
                $rarity = 'common';
                $rarityLabel = 'Common Pack';
                $coins = 0;
            } elseif ($roll <= 85) {
                $rarity = 'uncommon';
                $rarityLabel = 'Uncommon Pack';
                $coins = 1;
            } else {
                $rarity = 'rare';
                $rarityLabel = 'Rare Pack';
                $coins = 3;
            }

            if ($coins > 0) {
                $coinLedger = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
                $coinLedger->execute([$profileId, $coins, 'booster_pack_' . $rarity]);

                $coinUpd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
                $coinUpd->execute([$coins, $profileId]);
            }

            $cardCount = self::PACK_TIERS[$effectiveTier];
            $selected = $this->drawCards($profileId, $cardCount, $effectiveTier === 'deluxe');

            $discStmt = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id, discovered_at) VALUES (?, ?, 'booster', NOW())");
            foreach ($selected as $card) {
                $discStmt->execute([$profileId, $card['id']]);
            }

            $profUpdStmt = $this->db->prepare("SELECT unopened_packs, total_packs_opened, coin_balance FROM dex_profiles WHERE id = ?");
            $profUpdStmt->execute([$profileId]);
            $updated = $profUpdStmt->fetch(PDO::FETCH_ASSOC) ?: [
                'unopened_packs' => 0,
                'total_packs_opened' => 1,
                'coin_balance' => $coins
            ];

            $packsByTier = $this->packsByTier($profileId, (int)$updated['unopened_packs']);

            $this->db->commit();

            return [
                'ok'                 => true,
                'tier'               => $effectiveTier,
                'pack_rarity'        => $rarity,
                'pack_rarity_label'  => $rarityLabel,
                'coins_awarded'      => $coins,
                'unopened_packs'     => (int)$updated['unopened_packs'],
                'packs_by_tier'      => $packsByTier,
                'total_packs_opened' => (int)$updated['total_packs_opened'],
                'coin_balance'       => (int)$updated['coin_balance'],
                'cards'              => $selected,
                'already_owned'      => [],
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Coins ───────────────────────────────────────────────────────────────

    public function awardCoins(string $userSlug, int $amount, string $reason = 'game_award', ?int $sessionProfileId = null): array
    {
        if (!isset(self::COIN_AWARD_REASONS[$reason])) {
            return ['ok' => false, 'message' => 'Unknown award reason'];
        }

        $delta = min(self::MAX_COINS_PER_AWARD, max(0, (int)self::COIN_AWARD_REASONS[$reason]));
        if ($delta <= 0) {
            return ['ok' => false, 'message' => 'Invalid amount'];
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            if ($reason === 'daily_bonus') {
                // Once per UTC day — date-scoped ledger reason acts as dedup key.
                $dayReason = 'daily_bonus_' . gmdate('Y-m-d');
                $check = $this->db->prepare("SELECT COUNT(*) FROM dex_coin_transactions WHERE profile_id = ? AND reason = ?");
                $check->execute([$profileId, $dayReason]);
                if ((int)$check->fetchColumn() > 0) {
                    $this->db->rollBack();
                    return ['ok' => true, 'awarded' => 0, 'message' => 'Daily bonus already claimed'];
                }
                $reason = $dayReason;
            } elseif ($reason === 'game_award') {
                // Daily cap on generic game coin awards.
                $cap = $this->db->prepare("SELECT COALESCE(SUM(delta),0) FROM dex_coin_transactions WHERE profile_id = ? AND reason = 'game_award' AND created_at >= UTC_DATE()");
                $cap->execute([$profileId]);
                $today = (int)$cap->fetchColumn();
                if ($today + $delta > self::GAME_AWARD_DAILY_CAP) {
                    $this->db->rollBack();
                    return ['ok' => true, 'awarded' => 0, 'message' => 'Daily coin limit reached'];
                }
            }

            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([$profileId, $delta, $reason]);

            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
            $upd->execute([$delta, $profileId]);

            $this->db->commit();
            return ['ok' => true, 'awarded' => $delta];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function spendCoins(string $userSlug, int $amount, string $reason = 'game_spend', ?int $sessionProfileId = null): array
    {
        $grantTier = null;
        $packsFromShop = 0;
        if (isset(self::COIN_SPEND_CATALOG[$reason])) {
            // Server-authoritative shop price — ignore client amount.
            $amount = (int)self::COIN_SPEND_CATALOG[$reason]['cost'];
            $packsFromShop = min(self::MAX_PACKS_PER_REWARD, max(0, (int)self::COIN_SPEND_CATALOG[$reason]['packs']));
            $grantTier = (string)self::COIN_SPEND_CATALOG[$reason]['tier'];
        }

        if ($amount <= 0 || $amount > 100) {
            return ['ok' => false, 'message' => 'Invalid amount'];
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];

            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance - ? WHERE id = ? AND coin_balance >= ?");
            $upd->execute([$amount, $profileId, $amount]);

            if ($upd->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => false, 'message' => 'Insufficient coins'];
            }

            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([$profileId, -$amount, $reason]);

            if ($packsFromShop > 0 && $grantTier !== null) {
                $this->grantPacks($profileId, $grantTier, $packsFromShop, 'coin_shop');
            }

            $balStmt = $this->db->prepare("SELECT coin_balance, unopened_packs FROM dex_profiles WHERE id = ?");
            $balStmt->execute([$profileId]);
            $updated = $balStmt->fetch(PDO::FETCH_ASSOC) ?: ['coin_balance' => 0, 'unopened_packs' => 0];

            $packsByTier = $this->packsByTier($profileId, (int)$updated['unopened_packs']);

            $this->db->commit();
            return [
                'ok'             => true,
                'spent'          => $amount,
                'packsAwarded'   => $packsFromShop,
                'packTier'       => $grantTier,
                'coin_balance'   => (int)$updated['coin_balance'],
                'unopened_packs' => (int)$updated['unopened_packs'],
                'packs_by_tier'  => $packsByTier,
                'reason'         => $reason,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Per-game progression (upgrades + objectives) ────────────────────────

    /**
     * Read the dex_game_progress row for a profile+game. $forUpdate locks the
     * row inside the caller's transaction. Returns ['upgrades'=>map,'objectives'=>list].
     * Missing table (pre-migration) degrades to empty defaults.
     */
    private function readProgress(int $profileId, string $gameId, bool $forUpdate = false): array
    {
        try {
            $sql = "SELECT upgrades_json, objectives_json FROM dex_game_progress WHERE profile_id = ? AND game_id = ?";
            if ($forUpdate) $sql .= " FOR UPDATE";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([$profileId, $gameId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $row = null; // pre-migration — treat as no progress
        }
        if (!$row) return ['upgrades' => [], 'objectives' => []];
        $up = json_decode((string)($row['upgrades_json'] ?? ''), true);
        $ob = json_decode((string)($row['objectives_json'] ?? ''), true);
        return [
            'upgrades'   => is_array($up) ? $up : [],
            'objectives' => is_array($ob) ? array_values($ob) : [],
        ];
    }

    private function writeProgress(int $profileId, string $gameId, array $upgrades, array $objectives): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO dex_game_progress (profile_id, game_id, upgrades_json, objectives_json)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE upgrades_json = VALUES(upgrades_json), objectives_json = VALUES(objectives_json)"
        );
        $stmt->execute([$profileId, $gameId, json_encode($upgrades), json_encode(array_values($objectives))]);
    }

    private static function multiplierFor(array $objectives): int
    {
        return 1 + count($objectives);
    }

    /** Public read: upgrade levels, claimed objectives, derived multiplier, catalogs. */
    public function getGameProgress(string $userSlug, string $gameId): array
    {
        $stmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $stmt->execute([$userSlug]);
        $profileId = $stmt->fetchColumn();
        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }
        $prog = $this->readProgress((int)$profileId, $gameId);
        $defs = self::OBJECTIVE_DEFS[$gameId] ?? [];
        $claimed = array_values(array_intersect(array_keys($defs), $prog['objectives']));
        $upOut = [];
        foreach (self::UPGRADE_DEFS as $id => $def) {
            $lvl = isset($prog['upgrades'][$id]) ? (int)$prog['upgrades'][$id] : 0;
            $upOut[$id] = [
                'label'    => $def['label'],
                'level'    => min(5, max(0, $lvl)),
                'maxLevel' => 5,
                'nextCost' => $lvl < 5 ? $def['costs'][$lvl] : null,
            ];
        }
        return [
            'ok'           => true,
            'game_id'      => $gameId,
            'upgrades'     => $upOut,
            'objectives'   => $claimed,
            'multiplier'   => self::multiplierFor($claimed),
            'objectiveDefs'=> $defs,
        ];
    }

    /** Buy the next level of an upgrade with server-held coins. */
    public function buyUpgrade(string $userSlug, string $gameId, string $upgrade, ?int $sessionProfileId): array
    {
        if (!isset(self::UPGRADE_DEFS[$upgrade])) {
            return ['ok' => false, 'code' => 'bad_request', 'message' => 'Unknown upgrade'];
        }
        if (!\HumaneArcade\GameCatalog::isValidGame($gameId)) {
            return ['ok' => false, 'code' => 'bad_request', 'message' => 'Unknown game'];
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];
            $balance   = (int)$resolved['row']['coin_balance'];

            $prog  = $this->readProgress($profileId, $gameId, true);
            $level = isset($prog['upgrades'][$upgrade]) ? (int)$prog['upgrades'][$upgrade] : 0;
            if ($level >= 5) {
                $this->db->rollBack();
                return ['ok' => false, 'code' => 'maxed', 'message' => 'Upgrade already maxed'];
            }
            $cost = self::UPGRADE_DEFS[$upgrade]['costs'][$level];
            if ($balance < $cost) {
                $this->db->rollBack();
                return ['ok' => false, 'code' => 'insufficient', 'message' => 'Not enough coins', 'coin_balance' => $balance];
            }

            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance - ? WHERE id = ? AND coin_balance >= ?");
            $upd->execute([$cost, $profileId, $cost]);
            if ($upd->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => false, 'code' => 'insufficient', 'message' => 'Not enough coins'];
            }

            $newLevel = $level + 1;
            $upgrades = $prog['upgrades'];
            $upgrades[$upgrade] = $newLevel;
            $this->writeProgress($profileId, $gameId, $upgrades, $prog['objectives']);

            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([$profileId, -$cost, "upgrade_{$gameId}_{$upgrade}_{$newLevel}"]);

            $bal = (int)$balance - $cost;
            $this->db->commit();
            return [
                'ok'           => true,
                'upgrade'      => $upgrade,
                'level'        => $newLevel,
                'cost'         => $cost,
                'coin_balance' => $bal,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /** Claim an objective once — each raises the game's score multiplier by +1. */
    public function claimObjective(string $userSlug, string $gameId, string $key, ?int $sessionProfileId): array
    {
        $defs = self::OBJECTIVE_DEFS[$gameId] ?? [];
        if (!isset($defs[$key])) {
            return ['ok' => false, 'code' => 'bad_request', 'message' => 'Unknown objective'];
        }

        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];
            $prog = $this->readProgress($profileId, $gameId, true);

            if (in_array($key, $prog['objectives'], true)) {
                $this->db->commit();
                return ['ok' => true, 'already' => true, 'multiplier' => self::multiplierFor($prog['objectives']), 'objectives' => $prog['objectives']];
            }
            $objectives = array_merge($prog['objectives'], [$key]);
            $this->writeProgress($profileId, $gameId, $prog['upgrades'], $objectives);

            $this->db->commit();
            return [
                'ok'         => true,
                'already'    => false,
                'objective'  => $key,
                'label'      => $defs[$key],
                'objectives' => $objectives,
                'multiplier' => self::multiplierFor($objectives),
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /** Donation Burst pickup — coins scaled by the player's owned upgrade level. */
    public function awardDonationBurst(string $userSlug, ?int $sessionProfileId): array
    {
        $this->db->beginTransaction();
        try {
            $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
            if (isset($resolved['ok']) && $resolved['ok'] === false) {
                $this->db->rollBack();
                return $resolved;
            }
            $profileId = (int)$resolved['row']['id'];
            $prog = $this->readProgress($profileId, 'shelter_run', true);
            $level = isset($prog['upgrades']['donation']) ? (int)$prog['upgrades']['donation'] : 0;
            $delta = self::DONATION_VALUES[max(0, min(5, $level))];
            if ($delta <= 0) {
                $this->db->rollBack();
                return ['ok' => false, 'message' => 'Donation Burst not owned'];
            }

            // Shares the daily gameplay-earnings pool with game_award.
            $cap = $this->db->prepare("SELECT COALESCE(SUM(delta),0) FROM dex_coin_transactions WHERE profile_id = ? AND reason IN ('game_award','donation_burst') AND created_at >= UTC_DATE()");
            $cap->execute([$profileId]);
            if ((int)$cap->fetchColumn() + $delta > self::GAME_AWARD_DAILY_CAP * 4) {
                $this->db->rollBack();
                return ['ok' => true, 'awarded' => 0, 'message' => 'Daily coin limit reached'];
            }

            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, 'donation_burst', NOW())");
            $ins->execute([$profileId, $delta]);
            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
            $upd->execute([$delta, $profileId]);

            $this->db->commit();
            return ['ok' => true, 'awarded' => $delta, 'level' => $level];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    // ─── Match stats ─────────────────────────────────────────────────────────

    public function getMatchStats(string $userSlug): array
    {
        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $totalPairs = 0;
        $claimedMilestones = [];
        $claimedLevelWins = [];

        try {
            $stmt = $this->db->prepare("SELECT total_pairs, claimed_milestones, claimed_level_wins FROM dex_match_stats WHERE profile_id = ?");
            $stmt->execute([(int)$profileId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                $totalPairs = (int)$row['total_pairs'];
                $milestones = is_string($row['claimed_milestones']) ? json_decode($row['claimed_milestones'], true) : $row['claimed_milestones'];
                $levelWins = is_string($row['claimed_level_wins']) ? json_decode($row['claimed_level_wins'], true) : $row['claimed_level_wins'];
                $claimedMilestones = is_array($milestones) ? $milestones : [];
                $claimedLevelWins = is_array($levelWins) ? $levelWins : [];
            }
        } catch (Exception $e) {
            // Table may not yet exist on unmigrated database
        }

        // Also cross-reference dex_claimed_rewards to ensure all milestone packs are tracked
        try {
            $rewardStmt = $this->db->prepare("SELECT reward_key FROM dex_claimed_rewards WHERE profile_id = ? AND game_id = 'match'");
            $rewardStmt->execute([(int)$profileId]);
            while ($rKey = $rewardStmt->fetchColumn()) {
                if (!in_array($rKey, $claimedMilestones, true)) {
                    $claimedMilestones[] = $rKey;
                }
                if (preg_match('/^level_(\d+)$/', $rKey, $m)) {
                    $lvl = (int)$m[1];
                    if (!in_array($lvl, $claimedLevelWins, true)) {
                        $claimedLevelWins[] = $lvl;
                    }
                }
            }
        } catch (Exception $e) {}

        return [
            'ok'                 => true,
            'total_pairs'        => $totalPairs,
            'claimed_milestones' => $claimedMilestones,
            'claimed_level_wins' => $claimedLevelWins,
        ];
    }

    public function saveMatchStats(string $userSlug, array $data, ?int $sessionProfileId = null): array
    {
        // Ownership gate — this endpoint can mint rewards via new_milestone.
        $this->db->beginTransaction();
        $resolved = $this->resolveMutableProfile($userSlug, $sessionProfileId);
        if (isset($resolved['ok']) && $resolved['ok'] === false) {
            $this->db->rollBack();
            return $resolved;
        }
        $this->db->commit();

        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $totalPairs = max(0, (int)($data['total_pairs'] ?? 0));
        $newMilestone = (string)($data['new_milestone'] ?? '');
        $newLevelWin = isset($data['new_level_win']) ? (int)$data['new_level_win'] : null;

        // Process reward claim if new milestone is submitted
        $packAwarded = false;
        if ($newMilestone !== '') {
            $claimRes = $this->claimReward($userSlug, 'match', $newMilestone, [
                'tier' => (string)($data['new_milestone_tier'] ?? 'standard')
            ], $sessionProfileId);
            if (!empty($claimRes['claimed'])) {
                $packAwarded = true;
            }
        }

        // Merge existing with submitted
        $current = $this->getMatchStats($userSlug);
        $milestones = array_unique(array_merge($current['claimed_milestones'] ?? [], (array)($data['claimed_milestones'] ?? [])));
        if ($newMilestone !== '' && !in_array($newMilestone, $milestones, true)) {
            $milestones[] = $newMilestone;
        }

        $levelWins = array_unique(array_merge($current['claimed_level_wins'] ?? [], (array)($data['claimed_level_wins'] ?? [])));
        if ($newLevelWin !== null && !in_array($newLevelWin, $levelWins, true)) {
            $levelWins[] = $newLevelWin;
        }

        $finalPairs = max($totalPairs, (int)($current['total_pairs'] ?? 0));

        // Ensure table exists & upsert
        try {
            $this->db->exec("
                CREATE TABLE IF NOT EXISTS `dex_match_stats` (
                    `profile_id` BIGINT UNSIGNED NOT NULL,
                    `total_pairs` INT UNSIGNED NOT NULL DEFAULT 0,
                    `claimed_milestones` JSON NULL,
                    `claimed_level_wins` JSON NULL,
                    `updated_at` DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                    PRIMARY KEY (`profile_id`),
                    CONSTRAINT `fk_dex_match_stats_profile` FOREIGN KEY (`profile_id`) REFERENCES `dex_profiles` (`id`) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            ");

            $upsert = $this->db->prepare("
                INSERT INTO dex_match_stats (profile_id, total_pairs, claimed_milestones, claimed_level_wins, updated_at)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    total_pairs = GREATEST(total_pairs, VALUES(total_pairs)),
                    claimed_milestones = VALUES(claimed_milestones),
                    claimed_level_wins = VALUES(claimed_level_wins),
                    updated_at = NOW()
            ");
            $upsert->execute([
                (int)$profileId,
                $finalPairs,
                json_encode(array_values($milestones)),
                json_encode(array_values($levelWins)),
            ]);
        } catch (Exception $e) {
            error_log('[arcade-api] Failed updating dex_match_stats: ' . $e->getMessage());
        }

        return [
            'ok'                 => true,
            'total_pairs'        => $finalPairs,
            'claimed_milestones' => array_values($milestones),
            'claimed_level_wins' => array_values($levelWins),
            'pack_awarded'       => $packAwarded,
        ];
    }
}
