<?php

$prodSecrets = (getenv('HOME') ?: '/home/u290696932') . '/arcade-secrets/config.production.php';
if (is_readable($prodSecrets)) {
    require $prodSecrets;
}

$dbHost = getenv('DB_HOST') ?: 'mysql';
$dbName = getenv('DB_NAME') ?: 'arcade_db';
$dbUser = getenv('DB_USER') ?: 'root';
$dbPass = getenv('DB_PASS') !== false ? getenv('DB_PASS') : 'root';

return
[
    'paths' => [
        'migrations' => '%%PHINX_CONFIG_DIR%%/db/migrations',
        'seeds' => '%%PHINX_CONFIG_DIR%%/db/seeds'
    ],
    'environments' => [
        'default_migration_table' => 'phinxlog',
        'default_environment' => 'development',
        'production' => [
            'adapter' => 'mysql',
            'host'    => $dbHost,
            'name'    => $dbName,
            'user'    => $dbUser,
            'pass'    => $dbPass,
            'port'    => '3306',
            'charset' => 'utf8mb4',
        ],
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
