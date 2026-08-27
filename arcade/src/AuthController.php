<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class AuthController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function anonymousLaunch(): array
    {
        $this->db->beginTransaction();
        try {
            // Create Profile
            $stmt = $this->db->prepare("INSERT INTO game_profiles () VALUES ()");
            $stmt->execute();
            $profileId = (int)$this->db->lastInsertId();

            // Issue Long-lived Device Credential
            $deviceToken = bin2hex(random_bytes(32));
            $deviceHash = hash('sha256', $deviceToken, true);
            $stmtCred = $this->db->prepare("INSERT INTO anonymous_device_credentials (profile_id, credential_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR))");
            $stmtCred->execute([$profileId, $deviceHash]);

            // Issue Short-lived Session
            $sessionToken = bin2hex(random_bytes(32));
            $sessionHash = hash('sha256', $sessionToken, true);
            $stmtSession = $this->db->prepare("INSERT INTO arcade_sessions (profile_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))");
            $stmtSession->execute([$profileId, $sessionHash]);

            $this->db->commit();

            return [
                'profileId' => $profileId,
                'deviceToken' => $deviceToken, // Transport via Secure HttpOnly cookie
                'sessionToken' => $sessionToken // Transport via Secure HttpOnly cookie
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function refreshSession(string $deviceToken): array
    {
        $deviceHash = hash('sha256', $deviceToken, true);

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("SELECT profile_id FROM anonymous_device_credentials WHERE credential_hash = ? AND expires_at > NOW() AND (revoked_at IS NULL OR revoked_at > NOW())");
            $stmt->execute([$deviceHash]);
            $profileId = $stmt->fetchColumn();

            if (!$profileId) {
                throw new Exception("Unauthorized", 401);
            }

            // Issue new Session
            $sessionToken = bin2hex(random_bytes(32));
            $sessionHash = hash('sha256', $sessionToken, true);
            $stmtSession = $this->db->prepare("INSERT INTO arcade_sessions (profile_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))");
            $stmtSession->execute([$profileId, $sessionHash]);

            // Issue new Device Credential (Rotation)
            $newDeviceToken = bin2hex(random_bytes(32));
            $newDeviceHash = hash('sha256', $newDeviceToken, true);
            $stmtNewCred = $this->db->prepare("INSERT INTO anonymous_device_credentials (profile_id, credential_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR))");
            $stmtNewCred->execute([$profileId, $newDeviceHash]);

            // Mark old device credential as revoked (with short grace period to prevent race conditions)
            $stmtRevoke = $this->db->prepare("UPDATE anonymous_device_credentials SET revoked_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE) WHERE credential_hash = ?");
            $stmtRevoke->execute([$deviceHash]);

            $this->db->commit();

            return [
                'profileId'   => (int)$profileId,
                'sessionToken' => $sessionToken,
                'deviceToken'  => $newDeviceToken,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }
}
