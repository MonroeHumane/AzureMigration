<?php
declare(strict_types=1);

namespace HumaneArcade;

use PDO;
use Exception;

class ScoresController
{
    private const MAX_SCORES_LIMIT = 50;

    /**
     * Anti-cheat sanity ceiling per game to reject corrupted or spoofed integer submissions.
     */
    private const SCORE_CEILINGS = [
        'flappy_cat'  => 50000,
        'match'       => 1000000,
        'petsnake'    => 50000,
        'shelter_run' => 200000,
        'catwalk'     => 500000,
    ];

    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Fetch top high-scores for a game with ranking and optional timeframe.
     */
    public function getScores(string $gameId, int $limit = 10, string $timeframe = 'all'): array
    {
        if (!GameCatalog::isValidGame($gameId)) {
            return ['ok' => false, 'message' => 'Unknown game_id'];
        }

        $limit = max(1, min(self::MAX_SCORES_LIMIT, $limit));

        $timeSql = '';
        if ($timeframe === 'today') {
            $timeSql = ' AND created_at >= CURDATE()';
        } elseif ($timeframe === 'week') {
            $timeSql = ' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
        }

        try {
            $stmt = $this->db->prepare("
                SELECT id, game_id, player_name, score, metadata, created_at
                FROM arcade_scores
                WHERE game_id = ? $timeSql
                ORDER BY score DESC, created_at ASC
                LIMIT ?
            ");
            $stmt->bindValue(1, $gameId, PDO::PARAM_STR);
            $stmt->bindValue(2, $limit, PDO::PARAM_INT);
            $stmt->execute();

            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $scores = [];
            $rank = 1;
            foreach ($rows as $row) {
                $meta = is_string($row['metadata']) ? json_decode($row['metadata'], true) : $row['metadata'];
                $scores[] = [
                    'rank'       => $rank++,
                    'playerName' => $row['player_name'],
                    'score'      => (int)$row['score'],
                    'metadata'   => is_array($meta) ? $meta : [],
                    'date'       => $row['created_at'],
                ];
            }

            return [
                'ok'        => true,
                'gameId'    => $gameId,
                'timeframe' => $timeframe,
                'count'     => count($scores),
                'scores'    => $scores,
            ];
        } catch (Exception $e) {
            // Table may not yet exist on unmigrated instances — return clean empty leaderboard
            return [
                'ok'        => true,
                'gameId'    => $gameId,
                'timeframe' => $timeframe,
                'count'     => 0,
                'scores'    => [],
            ];
        }
    }

    /**
     * Submit a new score for a player and return their ranking.
     */
    public function submitScore(string $gameId, int $score, string $playerName = 'Player', ?int $profileId = null, array $metadata = []): array
    {
        if (!GameCatalog::isValidGame($gameId)) {
            return ['ok' => false, 'message' => 'Unknown game_id'];
        }

        if ($score <= 0) {
            return ['ok' => false, 'message' => 'Score must be greater than zero'];
        }

        $ceiling = self::SCORE_CEILINGS[$gameId] ?? 10000000;
        if ($score > $ceiling) {
            return ['ok' => false, 'message' => 'Score exceeds maximum threshold'];
        }

        $cleanName = trim(preg_replace('/\s+/', ' ', $playerName));
        if ($cleanName === '') {
            $cleanName = 'Player';
        }
        $cleanName = mb_substr($cleanName, 0, 32);

        $jsonMeta = json_encode($metadata);

        try {
            $stmt = $this->db->prepare("
                INSERT INTO arcade_scores (game_id, profile_id, player_name, score, metadata, created_at)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([
                $gameId,
                $profileId,
                $cleanName,
                $score,
                $jsonMeta,
            ]);

            // Calculate player rank
            $rankStmt = $this->db->prepare("SELECT COUNT(*) + 1 FROM arcade_scores WHERE game_id = ? AND score > ?");
            $rankStmt->execute([$gameId, $score]);
            $rank = (int)$rankStmt->fetchColumn();

            // Calculate personal best
            $pbStmt = $this->db->prepare("SELECT MAX(score) FROM arcade_scores WHERE game_id = ? AND player_name = ?");
            $pbStmt->execute([$gameId, $cleanName]);
            $highScore = (int)$pbStmt->fetchColumn();

            return [
                'ok'        => true,
                'gameId'    => $gameId,
                'score'     => $score,
                'highScore' => max($highScore, $score),
                'rank'      => $rank,
                'message'   => 'Score submitted successfully!',
            ];
        } catch (Exception $e) {
            error_log('[arcade-api] Failed submitting score: ' . $e->getMessage());
            return ['ok' => false, 'message' => 'Could not save score'];
        }
    }
}
