<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

/**
 * Fixed-window rate-limit counters for endpoints that can create new rows
 * without any prior credential (currently just POST /session/anonymous,
 * which mints a fresh game_profiles + anonymous_device_credentials row per
 * call). Bucket keys are hour-aligned so old rows are naturally short-lived;
 * CleanupController::purgeExpired() sweeps anything older than 2 hours.
 */
final class AddRateLimitBuckets extends AbstractMigration
{
    public function change(): void
    {
        $buckets = $this->table('rate_limit_buckets', ['id' => false, 'primary_key' => 'bucket_key']);
        $buckets->addColumn('bucket_key', 'string', ['limit' => 96, 'collation' => 'ascii_bin'])
            ->addColumn('window_start', 'datetime', ['precision' => 6])
            ->addColumn('request_count', 'integer', ['signed' => false, 'default' => 1])
            ->addIndex(['window_start'])
            ->create();
    }
}
