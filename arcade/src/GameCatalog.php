<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

/**
 * Authoritative game catalog — the single source of truth for which gameIds
 * are valid and what capabilities each game may exercise.
 *
 * Supports static registry fallback as well as dynamic hydration from the
 * `game_catalog` database table for runtime extensibility.
 */
final class GameCatalog
{
    /**
     * Default built-in registry of flagship games and capabilities:
     *   'storage'  — game may call save/load operations
     *   'petdex'   — game may emit pet discovery events
     *   'scores'   — game records high scores and leaderboard standings
     */
    private static array $registry = [
        'flappy_cat' => [
            'title'        => 'Flappy Cat',
            'capabilities' => ['storage', 'petdex', 'scores'],
        ],
        'match' => [
            'title'        => 'Pet Match Memory',
            'capabilities' => ['storage', 'petdex', 'scores'],
        ],
        'booster' => [
            'title'        => 'Pet Booster Packs',
            'capabilities' => ['storage', 'petdex'],
        ],
        'shelter_run' => [
            'title'        => 'Shelter Run',
            'capabilities' => ['storage', 'petdex', 'scores'],
        ],
        'petsnake' => [
            'title'        => 'Pet Snake',
            'capabilities' => ['storage', 'petdex', 'scores'],
        ],
        'tycoon' => [
            'title'        => 'Shelter Tycoon',
            'capabilities' => ['storage', 'petdex'],
        ],
        'catwalk' => [
            'title'        => 'Catwalk Night Patrol',
            'capabilities' => ['storage', 'scores'],
        ],
        'ref-game' => [
            'title'        => 'Reference Game',
            'capabilities' => ['storage'],
        ],
    ];

    private static bool $dbHydrated = false;

    /**
     * Optionally merge runtime catalog definitions from the `game_catalog` database table.
     */
    public static function initFromPdo(?PDO $pdo): void
    {
        if (self::$dbHydrated || $pdo === null) {
            return;
        }

        try {
            $stmt = $pdo->query("SELECT game_id, title, capabilities FROM game_catalog WHERE is_active = 1");
            if ($stmt) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $caps = is_string($row['capabilities']) ? json_decode($row['capabilities'], true) : $row['capabilities'];
                    self::$registry[$row['game_id']] = [
                        'title'        => $row['title'] ?? $row['game_id'],
                        'capabilities' => is_array($caps) ? $caps : ['storage'],
                    ];
                }
            }
            self::$dbHydrated = true;
        } catch (Exception $e) {
            // Table may not yet exist on fresh installs prior to migration
            self::$dbHydrated = true;
        }
    }

    /**
     * Returns true if the gameId is registered in the catalog.
     */
    public static function isValidGame(string $gameId): bool
    {
        return isset(self::$registry[$gameId]);
    }

    /**
     * Returns true if the registered game has the given capability.
     */
    public static function gameHasCapability(string $gameId, string $capability): bool
    {
        return in_array($capability, self::$registry[$gameId]['capabilities'] ?? [], true);
    }

    /**
     * Returns metadata for a registered game.
     */
    public static function getGame(string $gameId): ?array
    {
        return self::$registry[$gameId] ?? null;
    }

    /**
     * Returns all registered game IDs.
     *
     * @return string[]
     */
    public static function allGameIds(): array
    {
        return array_keys(self::$registry);
    }

    /**
     * Returns full catalog dictionary.
     */
    public static function getAll(): array
    {
        return self::$registry;
    }
}
