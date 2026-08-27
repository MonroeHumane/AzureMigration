<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class InitialArcadeSchema extends AbstractMigration
{
    public function change(): void
    {
        // 1. Profiles
        $profiles = $this->table('game_profiles', ['id' => false, 'primary_key' => 'id']);
        $profiles->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('display_name', 'string', ['limit' => 64, 'null' => true])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->create();

        // 2. Identities
        $identities = $this->table('profile_identities', ['id' => false, 'primary_key' => ['provider', 'subject']]);
        $identities->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('provider', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('subject', 'string', ['limit' => 255, 'collation' => 'utf8mb4_bin'])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();

        // 3. Anonymous Device Credentials
        $deviceCreds = $this->table('anonymous_device_credentials', ['id' => false, 'primary_key' => 'id']);
        $deviceCreds->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('credential_hash', 'binary', ['limit' => 32])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addColumn('expires_at', 'datetime', ['precision' => 6])
            ->addColumn('revoked_at', 'datetime', ['precision' => 6, 'null' => true])
            ->addIndex(['credential_hash'], ['unique' => true])
            ->addIndex(['profile_id'])
            ->addIndex(['expires_at'])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();

        // 4. Arcade Sessions
        $sessions = $this->table('arcade_sessions', ['id' => false, 'primary_key' => 'id']);
        $sessions->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('token_hash', 'binary', ['limit' => 32])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addColumn('expires_at', 'datetime', ['precision' => 6])
            ->addColumn('revoked_at', 'datetime', ['precision' => 6, 'null' => true])
            ->addIndex(['token_hash'], ['unique' => true])
            ->addIndex(['profile_id'])
            ->addIndex(['expires_at'])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();

        // 5. Game Saves
        $saves = $this->table('game_saves', ['id' => false, 'primary_key' => 'id']);
        $saves->addColumn('id', 'biginteger', ['identity' => true, 'signed' => false])
            ->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('game_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
            ->addColumn('slot', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('schema_version', 'integer', ['signed' => false])
            ->addColumn('revision', 'integer', ['signed' => false, 'default' => 1])
            ->addColumn('save_data', 'json')
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addColumn('updated_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)', 'update' => 'CURRENT_TIMESTAMP(6)'])
            ->addIndex(['profile_id', 'game_id', 'slot'], ['unique' => true])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();

        // 6. Discoveries
        $discoveries = $this->table('game_discoveries', ['id' => false, 'primary_key' => ['profile_id', 'pet_id']]);
        $discoveries->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('pet_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
            ->addColumn('source_game_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin', 'null' => true])
            ->addColumn('discovered_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();

        // 7. Operation Receipts
        $receipts = $this->table('operation_receipts', ['id' => false, 'primary_key' => ['profile_id', 'operation_id']]);
        $receipts->addColumn('profile_id', 'biginteger', ['signed' => false])
            ->addColumn('operation_id', 'string', ['limit' => 64, 'collation' => 'ascii_bin'])
            ->addColumn('operation_type', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('request_hash', 'binary', ['limit' => 32])
            ->addColumn('result_code', 'string', ['limit' => 32, 'collation' => 'ascii_bin'])
            ->addColumn('result_revision', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('created_at', 'datetime', ['precision' => 6, 'default' => 'CURRENT_TIMESTAMP(6)'])
            ->addColumn('expires_at', 'datetime', ['precision' => 6])
            ->addIndex(['expires_at'])
            ->addForeignKey('profile_id', 'game_profiles', 'id', ['delete'=> 'RESTRICT', 'update'=> 'NO_ACTION'])
            ->create();
    }
}
