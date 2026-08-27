<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;

/**
 * Purges expired and revoked rows that accumulate over time.
 *
 * Intended to be triggered by a server-side cron job (not from the browser):
 *
 *   POST /arcade-api/v1/internal/cleanup
 *   X-Cleanup-Secret: <value of CLEANUP_SECRET env var>
 *
 * Suggested cron schedule (runs daily at 03:00 server time):
 *   0 3 * * * curl -s -X POST https://api.example.com/arcade-api/v1/internal/cleanup \
 *               -H "X-Cleanup-Secret: $CLEANUP_SECRET"
 *
 * All DELETE operations are idempotent — safe to call repeatedly.
 */
final class CleanupController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Purge expired/revoked rows from all time-bounded tables.
     *
     * Deletion order matters for FK integrity:
     *   1. operation_receipts — no FK dependencies on other audit tables
     *   2. arcade_sessions    — no FK dependencies on device credentials
     *   3. anonymous_device_credentials — no FK dependencies on sessions
     *   4. rate_limit_buckets — no FK dependencies at all (not tied to a profile)
     *
     * None of these deletions touch game_profiles (parent table), so FK
     * RESTRICT constraints on profile_id are never triggered.
     *
     * @return array{operationReceipts: int, sessions: int, deviceCredentials: int, rateLimitBuckets: int}
     */
    public function purgeExpired(): array
    {
        // 1. Expired idempotency receipts
        $receipts = (int) $this->db->exec(
            "DELETE FROM operation_receipts WHERE expires_at < NOW()"
        );

        // 2. Expired sessions OR sessions whose revoked_at grace period has passed
        $sessions = (int) $this->db->exec(
            "DELETE FROM arcade_sessions
             WHERE expires_at < NOW()
                OR (revoked_at IS NOT NULL AND revoked_at < NOW())"
        );

        // 3. Expired device credentials OR credentials whose revoked_at grace period has passed
        //    NOTE: revoked_at is set to NOW() + 5 minutes during rotation to allow
        //    simultaneous-tab refresh races to settle. Only delete after that window.
        $deviceCreds = (int) $this->db->exec(
            "DELETE FROM anonymous_device_credentials
             WHERE expires_at < NOW()
                OR (revoked_at IS NOT NULL AND revoked_at < NOW())"
        );

        // 4. Rate-limit buckets are hour-aligned (see RateLimiter); anything
        //    more than 2 hours old is definitely a closed window.
        $rateLimitBuckets = (int) $this->db->exec(
            "DELETE FROM rate_limit_buckets WHERE window_start < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR)"
        );

        return [
            'operationReceipts'  => $receipts,
            'sessions'           => $sessions,
            'deviceCredentials'  => $deviceCreds,
            'rateLimitBuckets'   => $rateLimitBuckets,
        ];
    }
}
