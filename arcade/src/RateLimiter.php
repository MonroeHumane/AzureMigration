<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;

/**
 * Fixed-window IP rate limiter backed by the same MySQL connection as
 * everything else — no Redis/APCu dependency, which shared hosting doesn't
 * reliably provide. Windows are hour-aligned so bucket_key values are
 * naturally short-lived; CleanupController::purgeExpired() sweeps them.
 *
 * IPs are hashed, not stored raw, matching how device/session tokens are
 * handled elsewhere in this codebase.
 */
final class RateLimiter
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Atomically increments the ($action, $ip) bucket for the current hour
     * and returns true if this request is still within $limit for that
     * window (the incrementing request itself counts toward the total).
     */
    public function allow(string $action, string $ip, int $limit): bool
    {
        $window = gmdate('YmdH'); // hour-aligned, UTC
        $ipHash = hash('sha256', $ip);
        $bucketKey = substr($action . ':' . $ipHash . ':' . $window, 0, 96);

        $stmt = $this->db->prepare(
            'INSERT INTO rate_limit_buckets (bucket_key, window_start, request_count)
             VALUES (?, UTC_TIMESTAMP(), 1)
             ON DUPLICATE KEY UPDATE request_count = request_count + 1'
        );
        $stmt->execute([$bucketKey]);

        $check = $this->db->prepare(
            'SELECT request_count FROM rate_limit_buckets WHERE bucket_key = ?'
        );
        $check->execute([$bucketKey]);

        return (int) $check->fetchColumn() <= $limit;
    }
}
