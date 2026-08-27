<?php
declare(strict_types=1);

namespace HumaneArcade;

/**
 * Authoritative game catalog — the single source of truth for which gameIds
 * are valid and what capabilities each game may exercise.
 *
 * SYNC REQUIREMENT: this registry MUST stay in sync with the WordPress theme
 * catalog defined in monroe-rebuild/inc/humane-games.php. When a new game is
 * added to the WP theme it must also be added here, and vice-versa.
 *
 * Future: migrate to the `game_catalog` DB table (seeded in migration
 * 20260820000001_AddGameCatalog) and load dynamically at boot.
 */
final class GameCatalog
{
    /**
     * Registry format:
     *   'game_id' => ['capabilities' => ['storage', 'petdex', ...]]
     *
     * Capabilities:
     *   'storage'  — game may call save/load operations
     *   'petdex'   — game may emit pet discovery events
     */
    private static array $registry = [
        'flappy_cat' => [
            'capabilities' => ['storage', 'petdex'],
        ],
        'ref-game' => [
            'capabilities' => ['storage'],
        ],
    ];

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
     * Returns all registered game IDs.
     *
     * @return string[]
     */
    public static function allGameIds(): array
    {
        return array_keys(self::$registry);
    }
}
