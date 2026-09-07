<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AddAdoptedexTables extends AbstractMigration
{
    public function change(): void
    {
        // 1. Dex Profiles
        $profiles = $this->table('dex_profiles', ['id' => false, 'primary_key' => 'id']);
        $profiles->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('username_slug', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('display_name', 'string', ['limit' => 64, 'default' => ''])
            ->addColumn('pin_hash', 'string', ['limit' => 255, 'null' => true])
            ->addColumn('is_example', 'boolean', ['default' => false])
            ->addColumn('unopened_packs', 'integer', ['signed' => false, 'default' => 0])
            ->addColumn('total_packs_opened', 'integer', ['signed' => false, 'default' => 0])
            ->addColumn('coin_balance', 'integer', ['signed' => false, 'default' => 0])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addColumn('last_active_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addIndex(['username_slug'], ['unique' => true])
            ->addIndex(['is_example'])
            ->create();

        // 2. Coin Transactions Ledger
        $coins = $this->table('dex_coin_transactions', ['id' => false, 'primary_key' => 'id']);
        $coins->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('delta', 'integer')
            ->addColumn('reason', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addIndex(['profile_id'])
            ->addForeignKey('profile_id', 'dex_profiles', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->create();

        // 3. Claimed Rewards (One-time reward deduplication)
        $rewards = $this->table('dex_claimed_rewards', ['id' => false, 'primary_key' => 'id']);
        $rewards->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('game_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
            ->addColumn('reward_key', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addIndex(['profile_id', 'game_id', 'reward_key'], ['unique' => true])
            ->addForeignKey('profile_id', 'dex_profiles', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
            ->create();
    }
}
