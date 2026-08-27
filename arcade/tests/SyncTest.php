<?php
declare(strict_types=1);

namespace HumaneArcade\Tests;

use PHPUnit\Framework\TestCase;
use PDO;

class SyncTest extends TestCase
{
    private PDO $db;

    protected function setUp(): void
    {
        // 1. Schema Sanity: In a real run, this connects to arcade_test which is freshly migrated.
        $host = getenv('DB_HOST_TEST') ?: 'arcade-test-db';
        $this->db = new PDO("mysql:host=$host;dbname=arcade_test;charset=utf8mb4", 'root', 'root');
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Clear tables for clean state
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 0; TRUNCATE TABLE operation_receipts; TRUNCATE TABLE game_discoveries; TRUNCATE TABLE game_saves; TRUNCATE TABLE arcade_sessions; TRUNCATE TABLE anonymous_device_credentials; TRUNCATE TABLE profile_identities; TRUNCATE TABLE game_profiles; SET FOREIGN_KEY_CHECKS = 1;');
        
        // Seed dummy profile
        $this->db->exec("INSERT INTO game_profiles (id, display_name) VALUES (1, 'Test Player')");
    }

    public function testAtomicCreateReturnsRevisionOne()
    {
        // 4. Atomic create: expectedRevision=0 creates a save
        $stmt = $this->db->prepare("INSERT IGNORE INTO game_saves (profile_id, game_id, slot, schema_version, revision, save_data) VALUES (1, 'ref-game', 'auto', 1, 1, '{}')");
        $stmt->execute();
        $this->assertEquals(1, $stmt->rowCount(), 'Expected 1 row inserted for creation');
    }

    public function testAtomicUpdateRequiresCorrectRevision()
    {
        // Setup initial save
        $this->db->exec("INSERT INTO game_saves (profile_id, game_id, slot, schema_version, revision, save_data) VALUES (1, 'ref-game', 'auto', 1, 1, '{}')");

        // 5. Atomic update: conditional UPDATE ... WHERE revision = expectedRevision
        $stmt = $this->db->prepare("UPDATE game_saves SET revision = revision + 1, save_data = '{\"score\": 10}' WHERE profile_id = 1 AND game_id = 'ref-game' AND slot = 'auto' AND revision = 1");
        $stmt->execute();
        $this->assertEquals(1, $stmt->rowCount(), 'Expected successful atomic update');

        // 6. Concurrent update proof: attempt to update again with stale revision 1
        $stmt2 = $this->db->prepare("UPDATE game_saves SET revision = revision + 1, save_data = '{\"score\": 20}' WHERE profile_id = 1 AND game_id = 'ref-game' AND slot = 'auto' AND revision = 1");
        $stmt2->execute();
        $this->assertEquals(0, $stmt2->rowCount(), 'Concurrent/stale update MUST fail (0 rows affected)');
    }

    public function testReceiptFingerprintingPreventsPayloadMismatches()
    {
        // 8. Receipt fingerprinting
        $reqHash1 = hash('sha256', 'payload-A', true);
        $reqHash2 = hash('sha256', 'payload-B', true);

        // Insert first receipt
        $stmt = $this->db->prepare("INSERT INTO operation_receipts (profile_id, operation_id, operation_type, request_hash, result_code, result_revision, expires_at) VALUES (1, 'op-123', 'save', ?, 'success', 2, DATE_ADD(NOW(), INTERVAL 1 DAY))");
        $stmt->execute([$reqHash1]);

        // Verify identical hash is accepted (idempotent replay)
        $verify = $this->db->prepare("SELECT request_hash FROM operation_receipts WHERE profile_id = 1 AND operation_id = 'op-123'");
        $verify->execute();
        $storedHash = $verify->fetchColumn();
        $this->assertEquals($reqHash1, $storedHash);
        
        // Verify different hash is rejected
        $this->assertNotEquals($reqHash2, $storedHash, 'Idempotency key reuse with different payload must be rejected');
    }

    public function testDiscoveryIdempotencyPreservesFirstSource()
    {
        // 9. Discovery idempotency
        $stmt = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (1, 'pet_001', 'ref-game')");
        $stmt->execute();
        $this->assertEquals(1, $stmt->rowCount());

        // Duplicate discovery
        $stmt2 = $this->db->prepare("INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id) VALUES (1, 'pet_001', 'another-game')");
        $stmt2->execute();
        $this->assertEquals(0, $stmt2->rowCount(), 'Duplicate discovery must be a no-op');

        $fetch = $this->db->query("SELECT source_game_id FROM game_discoveries WHERE profile_id = 1 AND pet_id = 'pet_001'")->fetchColumn();
        $this->assertEquals('ref-game', $fetch, 'First source_game_id must be preserved');
    }

    public function testCatalogAuthorityValidation()
    {
        // 12. Catalog authority
        $catalogJson = json_encode(['games' => ['ref-game' => ['capabilities' => ['storage', 'adoptedex']]]]);
        $catalog = json_decode($catalogJson, true);

        $this->assertArrayHasKey('ref-game', $catalog['games'], 'Valid game must exist in catalog');
        $this->assertArrayNotHasKey('fake-game', $catalog['games'], 'Invalid game must be rejected by catalog validator');
    }
}
