<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class AdoptedexController
{
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

        return [
            'ok'      => true,
            'profile' => [
                'id'                 => (int)$profile['id'],
                'slug'               => $profile['username_slug'],
                'display'            => $profile['display_name'],
                'unopened_packs'     => (int)$profile['unopened_packs'],
                'total_packs_opened' => (int)$profile['total_packs_opened'],
                'coin_balance'       => (int)$profile['coin_balance'],
                'met'                => count($discoveries),
                'discoveries'        => $discoveries,
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

            $packsAwarded = (int)($extra['count'] ?? ($extra['tier'] ? 1 : 0));
            $coinsAwarded = (int)($extra['coins'] ?? 0);

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

            $this->db->commit();

            return [
                'ok'                => true,
                'pack_rarity'       => $rarity,
                'pack_rarity_label' => $rarityLabel,
                'coins_awarded'     => $coins,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function awardCoins(string $userSlug, int $amount, string $reason = 'game_award'): array
    {
        if ($amount <= 0 || $amount > 500) {
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
            $ins->execute([(int)$profileId, $amount, $reason]);

            $upd = $this->db->prepare("UPDATE dex_profiles SET coin_balance = coin_balance + ? WHERE id = ?");
            $upd->execute([$amount, (int)$profileId]);

            $this->db->commit();
            return ['ok' => true, 'awarded' => $amount];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function spendCoins(string $userSlug, int $amount, string $reason = 'game_spend'): array
    {
        if ($amount <= 0) {
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
}
