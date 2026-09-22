<?php
return [
    'name'     => $_ENV['SESSION_NAME'] ?? 'store_sid',
    'lifetime' => (int)($_ENV['SESSION_LIFETIME'] ?? 7200),
    'secure'   => filter_var($_ENV['SESSION_SECURE'] ?? false, FILTER_VALIDATE_BOOL),
    'samesite' => $_ENV['SESSION_SAMESITE'] ?? 'Lax',
    'httponly' => true,
    'path'     => '/',
];