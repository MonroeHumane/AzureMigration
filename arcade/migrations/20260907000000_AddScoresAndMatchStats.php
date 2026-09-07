<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddScoresAndMatchStats extends AbstractMigration
{
    public function change(): void
    {
        // 1. Arcade Leaderboards & Scores Table
        if (!$this->hasTable('arcade_scores')) {
            $scores = $this->table('arcade_scores', ['id' => false, 'primary_key' => 'id']);
            $scores->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
                ->addColumn('game_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
                ->addColumn('profile_id', 'biginteger', ['signed' => false, 'null' => true])
                ->addColumn('player_name', 'string', ['limit' => 64, 'default' => 'Player'])
                ->addColumn('score', 'integer', ['signed' => false, 'default' => 0])
                ->addColumn('metadata', 'json', ['null' => true])
                ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
                ->addIndex(['game_id', 'score'])
                ->addIndex(['profile_id'])
                ->addIndex(['created_at'])
                ->create();
        }

        // 2. Pet Match Stats Table
        if (!$this->hasTable('dex_match_stats')) {
            $matchStats = $this->table('dex_match_stats', ['id' => false, 'primary_key' => 'profile_id']);
            $matchStats->addColumn('profile_id', 'biginteger', ['signed' => false])
                ->addColumn('total_pairs', 'integer', ['signed' => false, 'default' => 0])
                ->addColumn('claimed_milestones', 'json', ['null' => true])
                ->addColumn('claimed_level_wins', 'json', ['null' => true])
                ->addColumn('updated_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
                ->addForeignKey('profile_id', 'dex_profiles', 'id', ['delete' => 'CASCADE', 'update' => 'NO_ACTION'])
                ->create();
        }

        // 3. Seed expanded game catalog into game_catalog table
        if ($this->hasTable('game_catalog')) {
            $this->execute("
                INSERT IGNORE INTO game_catalog (game_id, title, capabilities, is_active) VALUES
                ('flappy_cat',  'Flappy Cat',         '[\"storage\",\"petdex\",\"scores\"]', 1),
                ('match',       'Pet Match Memory',   '[\"storage\",\"petdex\",\"scores\"]', 1),
                ('booster',     'Pet Booster Packs',  '[\"storage\",\"petdex\"]',            1),
                ('shelter_run', 'Shelter Run',        '[\"storage\",\"petdex\",\"scores\"]', 1),
                ('petsnake',    'Pet Snake',          '[\"storage\",\"petdex\",\"scores\"]', 1),
                ('tycoon',      'Shelter Tycoon',     '[\"storage\",\"petdex\"]',            1),
                ('ref-game',    'Reference Game',     '[\"storage\"]',                       1)
            ");
        }
    }
}
