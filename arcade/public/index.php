<?php
require '../vendor/autoload.php';

// ─── Production secrets ─────────────────────────────────────────────────────
$secretsFile = (getenv('HOME') ?: '/home/u290696932') . '/arcade-secrets/config.production.php';
if (is_readable($secretsFile)) {
    require $secretsFile;
}

use HumaneArcade\SyncController;
use HumaneArcade\AuthController;
use HumaneArcade\AuthMiddleware;
use HumaneArcade\CleanupController;
use HumaneArcade\RateLimiter;
use HumaneArcade\AdoptedexController;

// ─── URL normalization ─────────────────────────────────────────────────────────
if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/arcade-api') === 0) {
    $_SERVER['REQUEST_URI'] = substr($_SERVER['REQUEST_URI'], strlen('/arcade-api')) ?: '/';
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
$allowedOrigins = array_filter(array_map('trim', explode(',',
    getenv('CORS_ALLOWED_ORIGINS') ?: 'http://localhost:5173,http://localhost:8060,http://localhost:4321,http://localhost:3000'
)));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($requestOrigin !== '' && (in_array($requestOrigin, $allowedOrigins, true) || in_array('*', $allowedOrigins, true))) {
    header("Access-Control-Allow-Origin: $requestOrigin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Cleanup-Secret, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ─── DB Connection ────────────────────────────────────────────────────────────
$host    = getenv('DB_HOST') ?: 'localhost';
$db      = getenv('DB_NAME') ?: 'arcade_dev';
$user    = getenv('DB_USER') ?: 'root';
$pass    = getenv('DB_PASS') ?: '';
$charset = 'utf8mb4';

$dsn     = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

$wantSsl = filter_var(getenv('DB_SSL') ?: '', FILTER_VALIDATE_BOOLEAN)
    || str_contains($host, '.mysql.database.azure.com');
if ($wantSsl) {
    $caPath = getenv('DB_SSL_CA') ?: '';
    if ($caPath !== '' && is_readable($caPath)) {
        $options[PDO::MYSQL_ATTR_SSL_CA] = $caPath;
    }

    $verifyRaw = getenv('DB_SSL_VERIFY');
    if ($verifyRaw === false || $verifyRaw === '') {
        $verify = $caPath !== '' && is_readable($caPath);
    } else {
        $verify = filter_var($verifyRaw, FILTER_VALIDATE_BOOLEAN);
    }
    $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = $verify;
}

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    error_log('[arcade-api] DB connection failed: ' . $e->getMessage());
    http_response_code(503);
    echo json_encode(['error' => ['code' => 'service_unavailable', 'message' => 'Database unavailable.']]);
    exit();
}

$syncController     = new SyncController($pdo);
$authController     = new AuthController($pdo);
$authMiddleware     = new AuthMiddleware($pdo);
$cleanupController  = new CleanupController($pdo);
$rateLimiter        = new RateLimiter($pdo);
$adoptedexController = new AdoptedexController($pdo);

// ─── Cookie Helpers ───────────────────────────────────────────────────────────
function setAuthCookies(string $sessionToken, string $deviceToken): void
{
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

    // Short-lived session cookie (1 hour)
    setcookie('arcade_session', $sessionToken, [
        'expires'  => time() + 3600,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $isSecure,
    ]);

    // Long-lived device cookie (1 year)
    setcookie('arcade_device', $deviceToken, [
        'expires'  => time() + (365 * 86400),
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => $isSecure,
    ]);
}

function getSessionToken(): ?string
{
    return $_COOKIE['arcade_session'] ?? null;
}

function getDeviceToken(): ?string
{
    return $_COOKIE['arcade_device'] ?? null;
}

function serverError(string $context, \Throwable $e): void
{
    error_log("[arcade-api] $context: " . $e->getMessage());
    Flight::json(['error' => ['code' => 'server_error', 'message' => 'An internal error occurred.']], 500);
}

/**
 * Return a valid arcade_session profile id, or null if the cookie is missing/expired.
 * Does not bind the session profile_id to Adoptédex username slugs.
 */
function currentArcadeSessionProfile(AuthMiddleware $authMiddleware): ?int
{
    $sessionToken = getSessionToken();
    if (!$sessionToken) {
        return null;
    }

    try {
        return $authMiddleware->authenticate($sessionToken);
    } catch (\Exception $e) {
        if ($e->getCode() === 401) {
            return null;
        }
        throw $e;
    }
}

/**
 * Mint an anonymous arcade_session when none is valid. Reuses a valid session,
 * then tries device-cookie refresh, then anonymousLaunch (rate-limited).
 * Returns false after sending a 429. Does not skip auth on mutating routes.
 */
function mintAnonymousArcadeSession(AuthController $authController, AuthMiddleware $authMiddleware, RateLimiter $rateLimiter): bool
{
    if (currentArcadeSessionProfile($authMiddleware) !== null) {
        return true;
    }

    $deviceToken = getDeviceToken();
    if ($deviceToken) {
        try {
            $refresh = $authController->refreshSession($deviceToken);
            setAuthCookies($refresh['sessionToken'], $refresh['deviceToken']);
            return true;
        } catch (\Exception $e) {
            if ($e->getCode() !== 401) {
                throw $e;
            }
        }
    }

    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!$rateLimiter->allow('anon_launch', $ip, 20)) {
        header('Retry-After: 3600');
        Flight::json(['error' => ['code' => 'rate_limited', 'message' => 'Too many new sessions from this address — try again later.']], 429);
        return false;
    }

    $result = $authController->anonymousLaunch();
    setAuthCookies($result['sessionToken'], $result['deviceToken']);
    return true;
}

/**
 * Require a valid arcade_session cookie. Does not bind the session profile_id
 * to Adoptédex username slugs — those identity systems are not linked.
 */
function requireArcadeSession(AuthMiddleware $authMiddleware): ?int
{
    $sessionToken = getSessionToken();
    if (!$sessionToken) {
        Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Missing session credential']], 401);
        return null;
    }

    try {
        return $authMiddleware->authenticate($sessionToken);
    } catch (\Exception $e) {
        if ($e->getCode() === 401) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Session expired']], 401);
            return null;
        }
        throw $e;
    }
}

// ─── Platform Routes ──────────────────────────────────────────────────────────

Flight::route('POST /v1/session/anonymous', function () use ($authController, $authMiddleware, $rateLimiter) {
    try {
        $existing = currentArcadeSessionProfile($authMiddleware);
        if ($existing !== null) {
            Flight::json(['status' => 'ok', 'profileId' => $existing]);
            return;
        }

        if (!mintAnonymousArcadeSession($authController, $authMiddleware, $rateLimiter)) {
            return;
        }

        $profileId = currentArcadeSessionProfile($authMiddleware);
        Flight::json(['status' => 'ok', 'profileId' => $profileId]);
    } catch (\Exception $e) {
        serverError('anonymousLaunch', $e);
    }
});

Flight::route('POST /v1/session/refresh', function () use ($authController) {
    try {
        $deviceToken = getDeviceToken();
        if (!$deviceToken) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Missing device credential']], 401);
            return;
        }

        $refresh = $authController->refreshSession($deviceToken);
        setAuthCookies($refresh['sessionToken'], $refresh['deviceToken']);
        Flight::json(['status' => 'ok', 'profileId' => $refresh['profileId']]);
    } catch (\Exception $e) {
        $status = $e->getCode() === 401 ? 401 : 500;
        if ($status === 401) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Invalid or expired device credential']], 401);
        } else {
            serverError('refreshSession', $e);
        }
    }
});

Flight::route('POST /v1/sync', function () use ($syncController, $authMiddleware) {
    try {
        $sessionToken = getSessionToken();
        if (!$sessionToken) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Missing session credential']], 401);
            return;
        }

        $profileId = $authMiddleware->authenticate($sessionToken);
        $payload = json_decode(Flight::request()->getBody(), true);
        if (!$payload || !isset($payload['operations']) || !is_array($payload['operations'])) {
            Flight::json(['error' => ['code' => 'bad_request', 'message' => 'Invalid JSON or missing operations array']], 400);
            return;
        }

        $result = $syncController->handleSync($payload, $profileId);
        Flight::json($result);
    } catch (\Exception $e) {
        $status = $e->getCode() === 401 ? 401 : 500;
        if ($status === 401) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Session expired']], 401);
        } else {
            serverError('sync', $e);
        }
    }
});

Flight::route('GET /v1/saves', function () use ($syncController, $authMiddleware) {
    try {
        $sessionToken = getSessionToken();
        if (!$sessionToken) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Missing session credential']], 401);
            return;
        }

        $profileId = $authMiddleware->authenticate($sessionToken);
        $gameId = Flight::request()->query['gameId'] ?? '';
        $slot   = Flight::request()->query['slot']   ?? '';

        if ($gameId === '' || $slot === '') {
            Flight::json(['error' => ['code' => 'bad_request', 'message' => 'gameId and slot query parameters are required']], 400);
            return;
        }

        if (!\HumaneArcade\GameCatalog::isValidGame($gameId)) {
            Flight::json(['error' => ['code' => 'game_not_in_catalog', 'message' => 'Unknown game']], 404);
            return;
        }

        $save = $syncController->loadSave($gameId, $slot, $profileId);
        if ($save === null) {
            Flight::json(['error' => ['code' => 'not_found', 'message' => 'No save found for this slot']], 404);
            return;
        }

        Flight::json($save);
    } catch (\Exception $e) {
        $status = $e->getCode() === 401 ? 401 : 500;
        if ($status === 401) {
            Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Session expired']], 401);
        } else {
            serverError('loadSave', $e);
        }
    }
});

// ─── Adoptédex & Game Economy Endpoints ────────────────────────────────────────

Flight::route('POST /v1/adoptedex/auth', function () use ($adoptedexController, $authController, $authMiddleware, $rateLimiter) {
    try {
        if (!mintAnonymousArcadeSession($authController, $authMiddleware, $rateLimiter)) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $username = $payload['username'] ?? $payload['display_name'] ?? $payload['user'] ?? 'Player';
        $result = $adoptedexController->getOrCreateProfile((string)$username);
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('adoptedexAuth', $e);
    }
});

Flight::route('GET /v1/adoptedex/@user', function ($user) use ($adoptedexController) {
    try {
        $result = $adoptedexController->getProfile((string)$user);
        if (!$result['ok']) {
            Flight::json($result, 404);
            return;
        }
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('getAdoptedex', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/discover', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $petId   = (string)($payload['pet_id'] ?? '');
        $source  = (string)($payload['source'] ?? 'dex');

        if ($petId === '') {
            Flight::json(['ok' => false, 'message' => 'Missing pet_id'], 400);
            return;
        }

        $result = $adoptedexController->discoverPet((string)$user, $petId, $source);
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('discoverPet', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/discover/bulk', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $petIds  = (array)($payload['pet_ids'] ?? []);
        $source  = (string)($payload['source'] ?? 'match');

        $result = $adoptedexController->discoverBulk((string)$user, $petIds, $source);
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('discoverBulk', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/rewards/claim', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload   = json_decode(Flight::request()->getBody(), true) ?: [];
        $gameId    = (string)($payload['game_id'] ?? '');
        $rewardKey = (string)($payload['reward_key'] ?? '');

        if ($gameId === '' || $rewardKey === '') {
            Flight::json(['ok' => false, 'message' => 'game_id and reward_key are required'], 400);
            return;
        }

        $result = $adoptedexController->claimReward((string)$user, $gameId, $rewardKey);
        if (!$result['ok']) {
            $status = ($result['message'] ?? '') === 'Profile not found' ? 404 : 400;
            Flight::json($result, $status);
            return;
        }
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('claimReward', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/packs/open', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $tier    = (string)($payload['tier'] ?? 'standard');

        $result = $adoptedexController->openPack((string)$user, $tier);
        if (!$result['ok']) {
            Flight::json($result, 409);
            return;
        }
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('openPack', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/coins/award', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $reason  = (string)($payload['reason'] ?? 'game_award');

        $result = $adoptedexController->awardCoins((string)$user, 0, $reason);
        if (!$result['ok']) {
            $status = ($result['message'] ?? '') === 'Profile not found' ? 404 : 400;
            Flight::json($result, $status);
            return;
        }
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('awardCoins', $e);
    }
});

Flight::route('POST /v1/adoptedex/@user/coins/spend', function ($user) use ($adoptedexController, $authMiddleware) {
    try {
        if (requireArcadeSession($authMiddleware) === null) {
            return;
        }

        $payload = json_decode(Flight::request()->getBody(), true) ?: [];
        $amount  = (int)($payload['amount'] ?? 0);
        $reason  = (string)($payload['reason'] ?? 'game_spend');

        $result = $adoptedexController->spendCoins((string)$user, $amount, $reason);
        if (!$result['ok']) {
            Flight::json($result, 402);
            return;
        }
        Flight::json($result);
    } catch (\Exception $e) {
        serverError('spendCoins', $e);
    }
});

Flight::route('GET /v1/pack-tiers', function () {
    Flight::json([
        'standard' => ['cardCount' => 1, 'label' => 'Standard Pack'],
        'duo'      => ['cardCount' => 2, 'label' => 'Duo Pack'],
        'deluxe'   => ['cardCount' => 3, 'label' => 'Deluxe Pack'],
    ]);
});

// ─── Maintenance & Health ─────────────────────────────────────────────────────

Flight::route('POST /v1/internal/cleanup', function () use ($cleanupController) {
    $secret = getenv('CLEANUP_SECRET');
    if (!$secret) {
        Flight::json(['error' => ['code' => 'not_configured', 'message' => 'Cleanup not configured on this server.']], 503);
        return;
    }

    $provided = $_SERVER['HTTP_X_CLEANUP_SECRET'] ?? '';
    if (!hash_equals($secret, $provided)) {
        Flight::json(['error' => ['code' => 'unauthorized', 'message' => 'Invalid cleanup secret.']], 401);
        return;
    }

    try {
        $counts = $cleanupController->purgeExpired();
        Flight::json(['status' => 'ok', 'deleted' => $counts]);
    } catch (\Exception $e) {
        serverError('cleanup', $e);
    }
});

Flight::route('/', function () {
    Flight::json([
        'service' => 'Humane Arcade API',
        'version' => '1.2.0',
        'status'  => 'healthy',
    ]);
});

Flight::start();
