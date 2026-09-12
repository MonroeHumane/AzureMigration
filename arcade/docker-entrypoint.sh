#!/bin/sh
# Container entrypoint: run DB migrations once (cluster-wide named lock so
# concurrent replicas can't double-run phinx), then run the given command —
# or Apache by default.
set -e

echo "[entrypoint] applying database migrations…"
php -r '
$host = getenv("DB_HOST") ?: "mysql";
$dsn = sprintf("mysql:host=%s;dbname=%s;charset=utf8mb4",
    $host, getenv("DB_NAME") ?: "arcade_db");
$opts = [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION];
$wantSsl = filter_var(getenv("DB_SSL") ?: "", FILTER_VALIDATE_BOOLEAN)
    || str_contains($host, ".mysql.database.azure.com");
if ($wantSsl) {
    foreach ([getenv("DB_SSL_CA") ?: "", "/etc/ssl/certs/ca-certificates.crt",
              "/etc/ssl/cert.pem", "/etc/pki/tls/certs/ca-bundle.crt"] as $ca) {
        if ($ca !== "" && is_readable($ca)) { $opts[PDO::MYSQL_ATTR_SSL_CA] = $ca; break; }
    }
    $v = getenv("DB_SSL_VERIFY");
    $opts[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] =
        $v === false || $v === "" ? isset($opts[PDO::MYSQL_ATTR_SSL_CA]) : filter_var($v, FILTER_VALIDATE_BOOLEAN);
}
$pdo = new PDO($dsn, getenv("DB_USER") ?: "root", getenv("DB_PASS") ?: "root", $opts);
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
