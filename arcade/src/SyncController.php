<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

/**
 * Maximum save payload size per slot (64 KB).
 * Enforced before any DB write to prevent client abuse.
 */
const MAX_SAVE_BYTES = 65536;

class SyncController
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function handleSync(array $payload, int $profileId): array
    {
        // HTTP Semantics: Valid batches return 200 OK with per-operation statuses.
        $results = [];

        foreach ($payload['operations'] as $op) {
            try {
                // FIX #3: Replace stub catalog check with real GameCatalog authority.
                // The previous check only rejected the literal string 'fake-game-123',
                // allowing any other invented gameId to pass.
                if (!isset($op['gameId']) || !GameCatalog::isValidGame($op['gameId'])) {
                    $results[] = [
                        'operationId' => $op['operationId'] ?? 'unknown',
                        'status'      => 'error',
                        'errorCode'   => 'game_not_in_catalog',
                    ];
                    continue;
                }

                if ($op['type'] === 'save') {
                    // Validate storage capability for this game
                    if (!GameCatalog::gameHasCapability($op['gameId'], 'storage')) {
                        $results[] = [
                            'operationId' => $op['operationId'] ?? 'unknown',
                            'status'      => 'error',
                            'errorCode'   => 'capability_not_granted',
                        ];
                        continue;
                    }
                    $results[] = $this->processSave($op, $profileId);
                } elseif ($op['type'] === 'discovery') {
                    // Validate petdex capability for this game
                    if (!GameCatalog::gameHasCapability($op['gameId'], 'petdex')) {
                        $results[] = [
                            'operationId' => $op['operationId'] ?? 'unknown',
                            'status'      => 'error',
                            'errorCode'   => 'capability_not_granted',
                        ];
                        continue;
                    }
                    $results[] = $this->processDiscovery($op, $profileId);
                } else {
                    $results[] = [
                        'operationId' => $op['operationId'] ?? 'unknown',
                        'status'      => 'error',
                        'errorCode'   => 'unsupported_operation',
                    ];
                }
            } catch (Exception $e) {
                // Batch isolation: one error does not roll back unrelated operations.
                $results[] = [
                    'operationId' => $op['operationId'] ?? 'unknown',
                    'status'      => 'error',
                    'errorCode'   => 'internal_error',
                ];
            }
        }

        return ['results' => $results];
    }

    /**
     * Load a specific save slot from the cloud for this profile.
     * Used by the client on cold boot (new device / cleared IndexedDB) to
     * pull down the authoritative cloud state when Dexie has a cache miss.
     *
     * @return array|null  The save row, or null if no save exists for this slot.
     */
    public function loadSave(string $gameId, string $slot, int $profileId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT save_data, schema_version, revision, updated_at
             FROM game_saves
             WHERE profile_id = ? AND game_id = ? AND slot = ?"
        );
        $stmt->execute([$profileId, $gameId, $slot]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return null;
        }

        return [
            'gameId'        => $gameId,
            'slot'          => $slot,
            'data'          => json_decode($row['save_data'], true),
            'schemaVersion' => (int)$row['schema_version'],
            'revision'      => (int)$row['revision'],
            'updatedAt'     => $row['updated_at'],
        ];
    }

    private function processSave(array $op, int $profileId): array
    {
        $opId = $op['operationId'];

        // FIX #7: Enforce save payload size limit before any DB interaction.
        $encodedData = json_encode($op['data']);
        if ($encodedData === false || strlen($encodedData) > MAX_SAVE_BYTES) {
            return [
                'operationId' => $opId,
                'status'      => 'error',
                'errorCode'   => 'payload_too_large',
            ];
        }

        // Canonical hash of the entire operation payload (used for idempotency fingerprinting)
        $requestHash = hash('sha256', json_encode($op), true);

        $this->db->beginTransaction();

        try {
            // Idempotency receipt check
            $stmt = $this->db->prepare(
                "SELECT request_hash, result_code, result_revision
                 FROM operation_receipts
                 WHERE profile_id = ? AND operation_id = ?"
            );
            $stmt->execute([$profileId, $opId]);
            $receipt = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($receipt) {
                $this->db->rollBack();
                if ($receipt['request_hash'] === $requestHash) {
                    // Exact replay — return the previously committed result.
                    return [
                        'operationId' => $opId,
                        'status'      => $receipt['result_code'],
                        'revision'    => (int)$receipt['result_revision'],
                    ];
                }
                // Same operationId, different payload — idempotency key reuse.
                return [
                    'operationId' => $opId,
                    'status'      => 'error',
                    'errorCode'   => 'idempotency_key_reuse',
                ];
            }

            $expectedRev = $op['expectedRevision'];

            if ($expectedRev === 0) {
                // Atomic create (first save for this slot)
                $insert = $this->db->prepare(
                    "INSERT IGNORE INTO game_saves
                         (profile_id, game_id, slot, schema_version, revision, save_data)
                     VALUES (?, ?, ?, ?, 1, ?)"
                );
                $insert->execute([
                    $profileId,
                    $op['gameId'],
                    $op['slot'],
                    $op['schemaVersion'],
                    $encodedData,
                ]);

                if ($insert->rowCount() === 0) {
                    // FIX #6: Fetch conflict row INSIDE the transaction so that no
                    // concurrent writer can modify it between our check and our read.
                    // Previously buildConflictResponse() ran after rollBack(), making
                    // the SELECT vulnerable to a concurrent commit race.
                    $conflictRow = $this->fetchConflictRowInsideTx($profileId, $op['gameId'], $op['slot']);
                    $this->db->rollBack();
                    return $this->buildConflictResponse($op, $conflictRow);
                }
                $newRev = 1;
            } else {
                // Atomic update — conditional on the client's expected revision
                $update = $this->db->prepare(
                    "UPDATE game_saves
                     SET revision = revision + 1, save_data = ?, schema_version = ?
                     WHERE profile_id = ? AND game_id = ? AND slot = ? AND revision = ?"
                );
                $update->execute([
                    $encodedData,
                    $op['schemaVersion'],
                    $profileId,
                    $op['gameId'],
                    $op['slot'],
                    $expectedRev,
                ]);

                if ($update->rowCount() === 0) {
                    // FIX #6: Same as above — fetch conflict row before rolling back.
                    $conflictRow = $this->fetchConflictRowInsideTx($profileId, $op['gameId'], $op['slot']);
                    $this->db->rollBack();
                    return $this->buildConflictResponse($op, $conflictRow);
                }
                $newRev = $expectedRev + 1;
            }

            // Write idempotency receipt
            $receiptStmt = $this->db->prepare(
                "INSERT INTO operation_receipts
                     (profile_id, operation_id, operation_type, request_hash,
                      result_code, result_revision, expires_at)
                 VALUES (?, ?, 'save', ?, 'success', ?, DATE_ADD(NOW(), INTERVAL 1 DAY))"
            );
            $receiptStmt->execute([$profileId, $opId, $requestHash, $newRev]);

            $this->db->commit();

            return [
                'operationId' => $opId,
                'status'      => 'success',
                'revision'    => $newRev,
            ];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function processDiscovery(array $op, int $profileId): array
    {
        $opId        = $op['operationId'];
        $requestHash = hash('sha256', json_encode($op), true);

        $this->db->beginTransaction();

        try {
            $stmt = $this->db->prepare(
                "SELECT request_hash, result_code
                 FROM operation_receipts
                 WHERE profile_id = ? AND operation_id = ?"
            );
            $stmt->execute([$profileId, $opId]);
            $receipt = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($receipt) {
                $this->db->rollBack();
                if ($receipt['request_hash'] === $requestHash) {
                    return ['operationId' => $opId, 'status' => $receipt['result_code']];
                }
                return ['operationId' => $opId, 'status' => 'error', 'errorCode' => 'idempotency_key_reuse'];
            }

            // Discovery is idempotent via INSERT IGNORE on the composite PK (profile_id, pet_id)
            $insert = $this->db->prepare(
                "INSERT IGNORE INTO game_discoveries (profile_id, pet_id, source_game_id)
                 VALUES (?, ?, ?)"
            );
            $insert->execute([$profileId, $op['petId'], $op['sourceGameId'] ?? null]);

            $receiptStmt = $this->db->prepare(
                "INSERT INTO operation_receipts
                     (profile_id, operation_id, operation_type, request_hash, result_code, expires_at)
                 VALUES (?, ?, 'discovery', ?, 'success', DATE_ADD(NOW(), INTERVAL 1 DAY))"
            );
            $receiptStmt->execute([$profileId, $opId, $requestHash]);

            $this->db->commit();

            return ['operationId' => $opId, 'status' => 'success'];
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    /**
     * FIX #6: Fetch the conflict row WHILE still inside the active transaction.
     * This ensures the revision and save_data we return to the client reflect
     * the exact committed state that caused our insert/update to fail — not a
     * later concurrent write that sneaks in after rollBack().
     */
    private function fetchConflictRowInsideTx(int $profileId, string $gameId, string $slot): ?array
    {
        $fetch = $this->db->prepare(
            "SELECT revision, save_data
             FROM game_saves
             WHERE profile_id = ? AND game_id = ? AND slot = ?"
        );
        $fetch->execute([$profileId, $gameId, $slot]);
        $row = $fetch->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Build a 409-conflict response from a pre-fetched conflict row.
     * The row MUST have been fetched inside the transaction (see fetchConflictRowInsideTx).
     */
    private function buildConflictResponse(array $op, ?array $conflictRow): array
    {
        return [
            'operationId'    => $op['operationId'],
            'status'         => 'conflict',
            'serverRevision' => $conflictRow ? (int)$conflictRow['revision'] : 0,
            'serverData'     => $conflictRow ? json_decode($conflictRow['save_data'], true) : null,
        ];
    }
}
