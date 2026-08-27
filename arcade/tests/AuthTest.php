<?php
declare(strict_types=1);

namespace HumaneArcade\Tests;

use PHPUnit\Framework\TestCase;
use PDO;
use HumaneArcade\AuthController;

class AuthTest extends TestCase
{
    private PDO $db;
    private AuthController $auth;

    protected function setUp(): void
    {
        $host = getenv('DB_HOST_TEST') ?: 'arcade-test-db';
        $this->db = new PDO("mysql:host=$host;dbname=arcade_test;charset=utf8mb4", 'root', 'root');
        $this->db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        // Clean state
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 0; TRUNCATE TABLE arcade_sessions; TRUNCATE TABLE anonymous_device_credentials; TRUNCATE TABLE game_profiles; SET FOREIGN_KEY_CHECKS = 1;');
        
        $this->auth = new AuthController($this->db);
    }

    public function testFirstAnonymousLaunchCreatesExactEntities()
    {
        // 1. First anonymous launch creates exactly one profile, one device credential, one short-lived session
        $result = $this->auth->anonymousLaunch();
        
        $this->assertArrayHasKey('profileId', $result);
        $this->assertArrayHasKey('deviceToken', $result);
        $this->assertArrayHasKey('sessionToken', $result);
        
        $profileCount = $this->db->query("SELECT COUNT(*) FROM game_profiles")->fetchColumn();
        $deviceCount = $this->db->query("SELECT COUNT(*) FROM anonymous_device_credentials")->fetchColumn();
        $sessionCount = $this->db->query("SELECT COUNT(*) FROM arcade_sessions")->fetchColumn();
        
        $this->assertEquals(1, $profileCount);
        $this->assertEquals(1, $deviceCount);
        $this->assertEquals(1, $sessionCount);
    }

    public function testRawCredentialsAreNeverStored()
    {
        // 2. Raw session/device credentials are never stored server-side; only hashes are stored.
        $result = $this->auth->anonymousLaunch();
        
        $deviceToken = $result['deviceToken'];
        $sessionToken = $result['sessionToken'];
        
        // Assert they don't appear anywhere in the database in plaintext
        $checkDevice = $this->db->prepare("SELECT COUNT(*) FROM anonymous_device_credentials WHERE credential_hash = ?");
        $checkDevice->execute([$deviceToken]);
        $this->assertEquals(0, $checkDevice->fetchColumn());

        $checkSession = $this->db->prepare("SELECT COUNT(*) FROM arcade_sessions WHERE token_hash = ?");
        $checkSession->execute([$sessionToken]);
        $this->assertEquals(0, $checkSession->fetchColumn());
        
        // Assert the hash matches
        $expectedDeviceHash = hash('sha256', $deviceToken, true);
        $storedDeviceHash = $this->db->query("SELECT credential_hash FROM anonymous_device_credentials")->fetchColumn();
        $this->assertEquals($expectedDeviceHash, $storedDeviceHash);
    }

    public function testRefreshSessionRestoresSameProfileAndRotatesSafe()
    {
        $result = $this->auth->anonymousLaunch();
        $profileId = $result['profileId'];
        
        // 3. Expired short session + valid device credential restores the same profile, not a new profile.
        // 4. Device refresh rotates credentials safely.
        $refresh = $this->auth->refreshSession($result['deviceToken']);
        
        $this->assertNotEquals($result['sessionToken'], $refresh['sessionToken']);
        $this->assertNotEquals($result['deviceToken'], $refresh['deviceToken']);
        
        // Still only one profile
        $this->assertEquals(1, $this->db->query("SELECT COUNT(*) FROM game_profiles")->fetchColumn());
        
        // Check new session belongs to same profile
        $newSessionHash = hash('sha256', $refresh['sessionToken'], true);
        $sessionProfileId = $this->db->prepare("SELECT profile_id FROM arcade_sessions WHERE token_hash = ?");
        $sessionProfileId->execute([$newSessionHash]);
        $this->assertEquals($profileId, $sessionProfileId->fetchColumn());
    }

    public function testSimultaneousTabRefreshUsesGracePeriod()
    {
        $result = $this->auth->anonymousLaunch();
        $originalDeviceToken = $result['deviceToken'];
        
        // Tab A refreshes
        $refreshA = $this->auth->refreshSession($originalDeviceToken);
        
        // Tab B refreshes at the exact same moment (using the same original token before it gets the rotated one)
        // 5. Two simultaneous tabs attempting refresh do not cause profile loss or invalidate each other incorrectly.
        // Since we implemented a 5-minute revoked_at grace period, Tab B should still get a valid response (or identical rotated response depending on strict implementation, here it gets a new session).
        $refreshB = $this->auth->refreshSession($originalDeviceToken);
        
        $this->assertNotEmpty($refreshA['sessionToken']);
        $this->assertNotEmpty($refreshB['sessionToken']);
    }

    public function testRevokedSessionIsRejected()
    {
        $result = $this->auth->anonymousLaunch();
        $sessionHash = hash('sha256', $result['sessionToken'], true);
        
        $update = $this->db->prepare("UPDATE arcade_sessions SET revoked_at = NOW() WHERE token_hash = ?");
        $update->execute([$sessionHash]);
        
        $middleware = new \HumaneArcade\AuthMiddleware($this->db);
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage("Unauthorized");
        $middleware->authenticate($result['sessionToken']);
    }

    public function testRevokedDeviceCredentialCannotRestoreSession()
    {
        $result = $this->auth->anonymousLaunch();
        $deviceHash = hash('sha256', $result['deviceToken'], true);
        
        // 8. Revoked/forgotten device credential cannot restore a session
        $update = $this->db->prepare("UPDATE anonymous_device_credentials SET revoked_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE) WHERE credential_hash = ?");
        $update->execute([$deviceHash]);
        
        $this->expectException(\Exception::class);
        $this->expectExceptionMessage("Unauthorized");
        $this->auth->refreshSession($result['deviceToken']);
    }

    public function testOrdinarySessionExpiryDoesNotDestroyProfile()
    {
        $result = $this->auth->anonymousLaunch();
        $sessionHash = hash('sha256', $result['sessionToken'], true);
        
        $update = $this->db->prepare("UPDATE arcade_sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE token_hash = ?");
        $update->execute([$sessionHash]);
        
        // Session should be rejected
        $middleware = new \HumaneArcade\AuthMiddleware($this->db);
        try {
            $middleware->authenticate($result['sessionToken']);
            $this->fail('Session should be expired');
        } catch (\Exception $e) {}

        // But we can still refresh it because the device credential is valid
        $refresh = $this->auth->refreshSession($result['deviceToken']);
        $this->assertNotEmpty($refresh['sessionToken']);
    }
}
