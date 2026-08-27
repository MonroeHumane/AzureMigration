<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Migration 20260820000001 — Game Catalog Table
 *
 * Adds a `game_catalog` table so the catalog authority can eventually be
 * managed in the database rather than in the hardcoded GameCatalog PHP class.
 *
 * For now, GameCatalog.php is still the live authority. This table is seeded
 * with the same initial entries and is ready to be activated by switching
 * SyncController to load from it instead of the static class.
 */
final class AddGameCatalog extends AbstractMigration
{
    public function change(): void
    {
        $catalog = $this->table('game_catalog', [
            'id'          => false,
            'primary_key' => 'game_id',
        ]);

        $catalog
            ->addColumn('game_id', 'string', [
                'limit'     => 64,
                'collation' => 'ascii_bin',
                'comment'   => 'Stable identifier — must match game_id in WordPress theme catalog',
            ])
            ->addColumn('title', 'string', ['limit' => 128])
            ->addColumn('capabilities', 'json', [
                'comment' => 'JSON array of capability strings e.g. ["storage","petdex"]',
            ])
            ->addColumn('is_active', 'boolean', ['default' => true])
            ->addColumn('created_at', 'datetime', [
                'precision' => 6,
                'default'   => 'CURRENT_TIMESTAMP(6)',
            ])
            ->create();

        // Seed initial games (mirrors GameCatalog.php registry)
        $this->execute("
            INSERT INTO game_catalog (game_id, title, capabilities, is_active) VALUES
            ('flappy_cat', 'Flappy Cat Cloud', '[\"storage\",\"petdex\"]', 1),
            ('ref-game',   'Reference Game',   '[\"storage\"]',           1)
        ");
    }
}
