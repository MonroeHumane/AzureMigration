<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class AdoptedexController
{
    /** Max packs granted for any single reward key (client values are ignored). */
    private const MAX_PACKS_PER_REWARD = 1;

    /** Max coins granted for any single reward key (client values are ignored). */
    private const MAX_COINS_PER_REWARD = 25;

    /** Max coins granted for a catalog award reason. */
    private const MAX_COINS_PER_AWARD = 10;

    /**
     * Server-side reward table: game_id => reward_key => packs/coins.
     * Client-supplied coins/count/tier are never trusted.
     */
    private const REWARD_TABLE = [
        'match' => [
            'level_3'  => ['packs' => 1, 'coins' => 0],
            'level_5'  => ['packs' => 1, 'coins' => 0],
            'level_10' => ['packs' => 1, 'coins' => 0],
        ],
        'flappy_cat' => [
            'score_5'  => ['packs' => 1, 'coins' => 1],
            'score_10' => ['packs' => 1, 'coins' => 2],
            'score_15' => ['packs' => 1, 'coins' => 3],
            'score_25' => ['packs' => 1, 'coins' => 5],
            'score_30' => ['packs' => 1, 'coins' => 5],
            'score_50' => ['packs' => 2, 'coins' => 10],
        ],
        'booster' => [
            'first_pack' => ['packs' => 1, 'coins' => 0],
            'album_10'   => ['packs' => 1, 'coins' => 5],
            'album_25'   => ['packs' => 2, 'coins' => 10],
        ],
        'petsnake' => [
            'score_20' => ['packs' => 1, 'coins' => 2],
            'score_50' => ['packs' => 1, 'coins' => 5],
        ],
        'shelter_run' => [
            'distance_500'  => ['packs' => 1, 'coins' => 1],
            'distance_1500' => ['packs' => 1, 'coins' => 3],
            'distance_3000' => ['packs' => 1, 'coins' => 5],
        ],
        'catwalk' => [
            'score_500'  => ['packs' => 1, 'coins' => 2],
            'score_1500' => ['packs' => 1, 'coins' => 5],
            'score_3000' => ['packs' => 1, 'coins' => 10],
        ],
    ];

    private const SHELTER_PET_POOL = [
        ['id' => '61388848', 'name' => 'Scoot', 'type' => 'cat', 'breed' => 'Domestic Shorthair', 'gender' => 'male', 'age' => '4 months', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61388848.jpg', 'rarity' => 'tiny_wonder'],
        ['id' => '61461825', 'name' => 'Onion Ring', 'type' => 'dog', 'breed' => 'Mixed Breed Large', 'gender' => 'male', 'age' => '2 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61461825.jpg', 'rarity' => 'common'],
        ['id' => '61448087', 'name' => 'Puma', 'type' => 'dog', 'breed' => 'Terrier Mix', 'gender' => 'female', 'age' => '4 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61448087.jpg', 'rarity' => 'common'],
        ['id' => '60985568', 'name' => 'Fiona', 'type' => 'dog', 'breed' => 'Mixed Hound', 'gender' => 'female', 'age' => '5 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/60985568.jpg', 'rarity' => 'common'],
        ['id' => '59123456', 'name' => 'Barnaby', 'type' => 'dog', 'breed' => 'Golden Retriever Mix', 'gender' => 'male', 'age' => '8 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61461825.jpg', 'rarity' => 'golden_senior'],
        ['id' => '58223344', 'name' => 'Smokey', 'type' => 'cat', 'breed' => 'Silver Tabby', 'gender' => 'male', 'age' => '6 years', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61388848.jpg', 'rarity' => 'longtimer'],
        ['id' => '61352635', 'name' => 'Munsie', 'type' => 'cat', 'breed' => 'Calico Mix', 'gender' => 'female', 'age' => '3 months', 'file' => 'https://mchsstorage2urwob6xh6j6s.blob.core.windows.net/pet-photos/61352635.jpg', 'archived' => true, 'rarity' => 'alumni']
    ];

    /**
     * Server-side coin award catalog: reason => fixed delta.
     * Client-supplied amounts are ignored.
     */
    private const COIN_AWARD_REASONS = [
        'game_award'  => 5,
        'daily_bonus' => 10,
    ];

    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function getProfile(string $userSlug): array
    {
        $stmt = $this->db->prepare("SELECT * FROM dex_profiles WHERE username_slug = ?");
        $stmt->execute([$userSlug]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        // Fetch discoveries
        $discStmt = $this->db->prepare("SELECT pet_id, source_game_id as source, discovered_at FROM game_discoveries WHERE profile_id = ?");
        $discStmt->execute([(int)$profile['id']]);
        $discoveries = $discStmt->fetchAll(PDO::FETCH_ASSOC);
        $metIds = array_column($discoveries, 'pet_id');

        $stats = [
            'unopened_packs'     => (int)$profile['unopened_packs'],
            'total_packs_opened' => (int)$profile['total_packs_opened'],
            'coin_balance'       => (int)$profile['coin_balance'],
            'met'                => count($discoveries),
        ];

        return [
            'ok'                 => true,
            'display_name'       => $profile['display_name'],
            'stats'              => $stats,
            'met_ids'            => $metIds,
            'met'                => $discoveries,
            'profile' => [
                'id'                 => (int)$profile['id'],
                'slug'               => $profile['username_slug'],
                'display'            => $profile['display_name'],
                'unopened_packs'     => (int)$profile['unopened_packs'],
                'total_packs_opened' => (int)$profile['total_packs_opened'],
                'coin_balance'       => (int)$profile['coin_balance'],
                'met'                => count($discoveries),
                'discoveries'        => $discoveries,
                'stats'              => $stats,
            ],
        ];
    }

    public function getOrCreateProfile(string $rawDisplay): array
    {
        $display = trim(preg_replace('/\s+/', ' ', $rawDisplay));
        if ($display === '') {
            $display = 'Player';
        }

        $slug = strtolower(preg_replace('/[^a-z0-9_-]/', '', str_replace(' ', '-', $display)));
        if (strlen($slug) < 3) {
            $slug = 'player-' . substr(bin2hex(random_bytes(3)), 0, 6);
        }

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT * FROM dex_profiles WHERE username_slug = ? FOR UPDATE");
            $stmt->execute([$slug]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $upd = $this->db->prepare("UPDATE dex_profiles SET last_active_at = NOW() WHERE id = ?");
                $upd->execute([(int)$row['id']]);
                $this->db->commit();
                return $this->getProfile($slug);
            }

            $ins = $this->db->prepare("INSERT INTO dex_profiles (username_slug, display_name, created_at, last_active_at) VALUES (?, ?, NOW(), NOW())");
            $ins->execute([$slug, $display]);
            $this->db->commit();

            return $this->getProfile($slug);
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function discoverPet(string $userSlug, string $petId, string $source = 'dex'): array
    {
        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $ins = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (?, ?, ?)");
        $ins->execute([(int)$profileId, $petId, $source]);

        return ['ok' => true, 'pet_id' => $petId];
    }

    public function discoverBulk(string $userSlug, array $petIds, string $source = 'match'): array
    {
        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $this->db->beginTransaction();
        try {
            $ins = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (?, ?, ?)");
            foreach ($petIds as $petId) {
                if (is_string($petId) && $petId !== '') {
                    $ins->execute([(int)$profileId, $petId, $source]);
                }
            }
            $this->db->commit();
            return ['ok' => true, 'count' => count($petIds)];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function claimReward(string $userSlug, string $gameId, string $rewardKey, array $extra = []): array
    {
        $reward = self::REWARD_TABLE[$gameId][$rewardKey] ?? null;
        if ($reward === null) {
            return ['ok' => false, 'message' => 'Unknown reward'];
        }

        $packsAwarded = min(self::MAX_PACKS_PER_REWARD, max(0, (int)$reward['packs']));
        $coinsAwarded = min(self::MAX_COINS_PER_REWARD, max(0, (int)$reward['coins']));

        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $this->db->beginTransaction();
        try {
            $ins = $this->db->prepare("INSERT IGNORE INTO dex_claimed_rewards (profile_id, game_id, reward_key, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([(int)$profileId, $gameId, $rewardKey]);

            if ($ins->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => true, 'claimed' => false, 'message' => 'Reward already claimed'];
            }

            if ($packsAwarded > 0) {
                $packUpd = $this->db->prepare("UPDATE dex_profiles SET unopened_packs = unopened_packs + ? WHERE id = ?");
                $packUpd->execute([$packsAwarded, (int)$profileId]);
            }

            if ($coinsAwarded > 0) {
                $coinLedger = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
                $coinLedger->execute([(int)$profileId, $coinsAwarded, 'reward_' . $gameId]);

                $coinUpd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
                $coinUpd->execute([$coinsAwarded, (int)$profileId]);
            }

            $this->db->commit();

            return [
                'ok'            => true,
                'claimed'       => true,
                'packsAwarded'  => $packsAwarded,
                'coinsAwarded'  => $coinsAwarded,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function openPack(string $userSlug, string $tier = 'standard'): array
    {
        $profStmt = $this->db->prepare("SELECT id, unopened_packs FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profile = $profStmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $profileId = (int)$profile['id'];

        $this->db->beginTransaction();
        try {
            // Atomic conditional decrement
            $decr = $this->db->prepare("UPDATE dex_profiles SET unopened_packs = unopened_packs - 1, total_packs_opened = total_packs_opened + 1 WHERE id = ? AND unopened_packs > 0");
            $decr->execute([$profileId]);

            if ($decr->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => false, 'message' => 'No unopened packs available.'];
            }

            // Roll pack rarity: 50% Common (+0 coins), 35% Uncommon (+1 coin), 15% Rare (+3 coins)
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

            // Select cards according to tier
            $cardCount = $tier === 'deluxe' ? 3 : ($tier === 'duo' ? 2 : 1);
            $pool = self::SHELTER_PET_POOL;
            shuffle($pool);
            $selected = array_slice($pool, 0, $cardCount);

            // In deluxe tier, guarantee at least 1 rare/legendary if not already drawn
            if ($tier === 'deluxe') {
                $hasRare = false;
                foreach ($selected as $c) {
                    if (in_array($c['rarity'] ?? '', ['alumni', 'golden_senior', 'longtimer'], true)) {
                        $hasRare = true;
                        break;
                    }
                }
                if (!$hasRare) {
                    foreach ($pool as $p) {
                        if (in_array($p['rarity'] ?? '', ['alumni', 'golden_senior', 'longtimer'], true)) {
                            $selected[count($selected) - 1] = $p;
                            break;
                        }
                    }
                }
            }

            // Record discoveries
            $discStmt = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id, discovered_at) VALUES (?, ?, 'booster', NOW())");
            foreach ($selected as $card) {
                $discStmt->execute([$profileId, $card['id']]);
            }

            // Fetch updated profile values
            $profUpdStmt = $this->db->prepare("SELECT unopened_packs, total_packs_opened, coin_balance FROM dex_profiles WHERE id = ?");
            $profUpdStmt->execute([$profileId]);
            $updated = $profUpdStmt->fetch(PDO::FETCH_ASSOC) ?: [
                'unopened_packs' => 0,
                'total_packs_opened' => 1,
                'coin_balance' => $coins
            ];

            $this->db->commit();

            return [
                'ok'                 => true,
                'tier'               => $tier,
                'pack_rarity'        => $rarity,
                'pack_rarity_label'  => $rarityLabel,
                'coins_awarded'      => $coins,
                'unopened_packs'     => (int)$updated['unopened_packs'],
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

    public function awardCoins(string $userSlug, int $amount, string $reason = 'game_award'): array
    {
        if (!isset(self::COIN_AWARD_REASONS[$reason])) {
            return ['ok' => false, 'message' => 'Unknown award reason'];
        }

        $delta = min(self::MAX_COINS_PER_AWARD, max(0, (int)self::COIN_AWARD_REASONS[$reason]));
        if ($delta <= 0) {
            return ['ok' => false, 'message' => 'Invalid amount'];
        }

        $profStmt = $this->db->prepare("SELECT id FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profileId = $profStmt->fetchColumn();

        if (!$profileId) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $this->db->beginTransaction();
        try {
            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([(int)$profileId, $delta, $reason]);

            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
            $upd->execute([$delta, (int)$profileId]);

            $this->db->commit();
            return ['ok' => true, 'awarded' => $delta];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function spendCoins(string $userSlug, int $amount, string $reason = 'game_spend'): array
    {
        if ($amount <= 0 || $amount > 50) {
            return ['ok' => false, 'message' => 'Invalid amount'];
        }

        $profStmt = $this->db->prepare("SELECT id, coin_balance FROM dex_profiles WHERE username_slug = ?");
        $profStmt->execute([$userSlug]);
        $profile = $profStmt->fetch(PDO::FETCH_ASSOC);

        if (!$profile) {
            return ['ok' => false, 'message' => 'Profile not found'];
        }

        $profileId = (int)$profile['id'];

        $this->db->beginTransaction();
        try {
            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance - ? WHERE id = ? AND coin_balance >= ?");
            $upd->execute([$amount, $profileId, $amount]);

            if ($upd->rowCount() === 0) {
                $this->db->rollBack();
                return ['ok' => false, 'message' => 'Insufficient coins'];
            }

            $ins = $this->db->prepare("INSERT INTO dex_coin_transactions (profile_id, delta, reason, created_at) VALUES (?, ?, ?, NOW())");
            $ins->execute([$profileId, -$amount, $reason]);

            $this->db->commit();
            return ['ok' => true, 'spent' => $amount];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

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

    public function saveMatchStats(string $userSlug, array $data): array
    {
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
            ]);
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
