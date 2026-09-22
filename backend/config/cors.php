<?php
return [
    'allowed_origins' => [
        $_ENV['FRONTEND_URL'] ?? 'http://localhost:5173',
    ],
    'allowed_methods' => ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    'allowed_headers' => ['Content-Type','X-CSRF-Token','X-Requested-With'],
    'credentials'     => true,
];