<?php

$prodSecrets = (getenv('HOME') ?: '/home/u290696932') . '/arcade-secrets/config.production.php';
if (is_readable($prodSecrets)) {
    require $prodSecrets;
}

$dbHost = getenv('DB_HOST') ?: 'mysql';
$dbName = getenv('DB_NAME') ?: 'arcade_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'root';

// Mirror the SSL resolution in public/index.php — Azure MySQL requires TLS,
// and mysqlnd only upgrades the socket when a CA (or KEY/CERT) is supplied.
$prodExtra = [];
$wantSsl = filter_var(getenv('DB_SSL') ?: '', FILTER_VALIDATE_BOOLEAN)
    || str_contains($dbHost, '.mysql.database.azure.com');
if ($wantSsl) {
    foreach ([getenv('DB_SSL_CA') ?: '', '/etc/ssl/certs/ca-certificates.crt', '/etc/ssl/cert.pem', '/etc/pki/tls/certs/ca-bundle.crt'] as $candidate) {
        if ($candidate !== '' && is_readable($candidate)) {
            $prodExtra['mysql_attr_ssl_ca'] = $candidate;
            break;
        }
    }
    $verifyRaw = getenv('DB_SSL_VERIFY');
    $prodExtra['mysql_attr_ssl_verify_server_cert'] = $verifyRaw === false || $verifyRaw === ''
        ? isset($prodExtra['mysql_attr_ssl_ca'])
        : filter_var($verifyRaw, FILTER_VALIDATE_BOOLEAN);
}

return
[
    'paths' => [
        'migrations' => '%%PHINX_CONFIG_DIR%%/db/migrations',
        'seeds' => '%%PHINX_CONFIG_DIR%%/db/seeds'
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'development',
        'production' => array_merge([
            'adapter' => 'mysql',
            'host'    => $dbHost,
            'name'    => $dbName,
            'user'    => $dbUser,
            'pass'    => $dbPass,
            'port'    => '3306',
            'charset' => 'utf8mb4',
        ], $prodExtra),
        'development' => [
            'adapter' => 'mysql',
            'host'    => $dbHost,
            'name'    => $dbName,
            'user'    => $dbUser,
            'pass'    => $dbPass,
            'port'    => '3306',
            'charset' => 'utf8mb4',
        ],
        'testing' => [
            'adapter' => 'mysql',
            'host'    => getenv('DB_HOST_TEST') ?: 'mysql',
            'name'    => 'arcade_test',
            'user'    => $dbUser,
            'pass'    => $dbPass,
            'port'    => '3306',
            'charset' => 'utf8mb4',
        ]
    ],
    'version_order' => 'creation'
];
