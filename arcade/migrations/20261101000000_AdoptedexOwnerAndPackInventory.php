<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AdoptedexOwnerAndPackInventory extends AbstractMigration
{
    public function change(): void
    {
        // 1. Bind each Adoptédex profile to the arcade game_profile that owns it.
        //    NULL = unclaimed legacy profile; first mutating call binds it.
        $profiles = $this->table('dex_profiles');
        if (!$profiles->hasColumn('owner_profile_id')) {
            $profiles
                ->addColumn('owner_profile_id', 'biginteger', ['signed' => false, 'null' => true, 'default' => null])
                ->addIndex(['owner_profile_id'])
                ->addForeignKey('owner_profile_id', 'game_profiles', 'id', ['delete' => 'SET_NULL', 'update' => 'NO_ACTION'])
                ->update();
        }

        // 2. Per-pack inventory rows so pack tier is server-granted, not client-chosen.
        //    Legacy rows in dex_profiles.unopened_packs stay honored via controller
        //    fallback (treated as standard packs) until exhausted.
        if (!$this->hasTable('dex_pack_inventory')) {
            $inv = $this->table('dex_pack_inventory', ['id' => false, 'primary_key' => 'id']);
            $inv->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
                ->addColumn('profile_id', 'biginteger', ['signed' => false])
                ->addColumn('tier', 'string', ['limit' => 16, 'collation' => 'ascii_bin', 'default' => 'standard'])
                ->addColumn('granted_by', 'string', ['limit' => 64, 'collation' => 'ascii_bin', 'default' => 'reward'])
                ->addColumn('opened_at', 'datetime', ['precision' => 6, 'null' => true, 'default' => null])
                ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
                ->addIndex(['profile_id', 'opened_at'])
                ->addIndex(['profile_id', 'tier', 'opened_at'])
                ->addForeignKey('profile_id', 'dex_profiles', 'id', ['delete' => 'RESTRICT', 'update' => 'NO_ACTION'])
                ->create();
        }
    }
}
