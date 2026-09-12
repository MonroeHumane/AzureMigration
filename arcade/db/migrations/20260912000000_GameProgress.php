<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Per-game progression: owned upgrade levels + claimed objectives.
 * Both are server-authoritative — purchases deduct coin_balance inside a
 * transaction, and the score multiplier derives from claimed objectives.
 */
final class GameProgress extends AbstractMigration
{
    public function change(): void
    {
        if (!$this->hasTable('dex_game_progress')) {
            $t = $this->table('dex_game_progress', ['id' => false, 'primary_key' => 'id']);
            $t->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
                ->addColumn('profile_id', 'biginteger', ['signed' => false])
                ->addColumn('game_id', 'string', ['limit' => 40, 'collation' => 'ascii_bin'])
                ->addColumn('upgrades_json', 'text', ['null' => true, 'default' => null])
                ->addColumn('objectives_json', 'text', ['null' => true, 'default' => null])
                ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
                ->addColumn('updated_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)', 'update' => 'CURRENT_TIMESTAMP(6)'])
                ->addIndex(['profile_id', 'game_id'], ['unique' => true])
                ->addForeignKey('profile_id', 'dex_profiles', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
                ->create();
        }
    }
}
