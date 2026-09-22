<?php
return [
    'host'    => $_ENV['DB_HOST'] ?? '127.0.0.1',
    'port'    => (int)($_ENV['DB_PORT'] ?? 3306),
    'name'    => $_ENV['DB_NAME'] ?? 'store_management',
    'user'    => $_ENV['DB_USER'] ?? 'root',
    'pass'    => $_ENV['DB_PASS'] ?? '',
    'charset' => 'utf8mb4',
];