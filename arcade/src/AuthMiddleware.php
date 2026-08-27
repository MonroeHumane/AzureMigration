<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class AuthMiddleware
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function authenticate(string $sessionToken): int
    {
        // 13. No secrets hardcoded
        $tokenHash = hash('sha256', $sessionToken, true);

        $stmt = $this->db->prepare("SELECT profile_id FROM arcade_sessions WHERE token_hash = ? AND expires_at > NOW() AND revoked_at IS NULL");
        $stmt->execute([$tokenHash]);
        
        $profileId = $stmt->fetchColumn();

        if (!$profileId) {
            throw new Exception("Unauthorized", 401);
        }

        return (int)$profileId;
    }
}
