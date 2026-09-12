#!/bin/sh
# Container entrypoint: run DB migrations once (cluster-wide named lock so
# concurrent replicas can't double-run phinx), then run the given command —
# or Apache by default.
set -e

echo "[entrypoint] applying database migrations…"
php -r '
$dsn = sprintf("mysql:host=%s;dbname=%s;charset=utf8mb4",
    getenv("DB_HOST") ?: "mysql", getenv("DB_NAME") ?: "arcade_db");
$pdo = new PDO($dsn, getenv("DB_USER") ?: "root", getenv("DB_PASS") ?: "root",
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$got = (int)$pdo->query("SELECT GET_LOCK(\"arcade_migrate\", 60)")->fetchColumn();
if ($got !== 1) { fwrite(STDERR, "[entrypoint] migration lock timeout\n"); exit(1); }
passthru("php /var/www/html/vendor/bin/phinx migrate -e production", $code);
$pdo->query("SELECT RELEASE_LOCK(\"arcade_migrate\")");
exit($code);
'
echo "[entrypoint] migrations ok"
if [ $# -gt 0 ]; then
    exec "$@"
fi
exec apache2-foreground
