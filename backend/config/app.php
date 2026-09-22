<?php
return [
    'env'          => $_ENV['APP_ENV']   ?? 'local',
    'debug'        => filter_var($_ENV['APP_DEBUG'] ?? true, FILTER_VALIDATE_BOOL),
    'url'          => $_ENV['APP_URL']   ?? 'http://localhost:8000',
    'frontend_url' => $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173',
    'upload_dir'   => $_ENV['UPLOAD_DIR'] ?? 'storage/uploads/products',
    'upload_max'   => (int)($_ENV['UPLOAD_MAX_BYTES'] ?? 2097152),
];