<?php
namespace App\Core;

class Cors
{
    public static function apply(): void
    {
        $cfg = require __DIR__ . '/../../config/cors.php';
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($origin, $cfg['allowed_origins'], true)) {
            header("Access-Control-Allow-Origin: $origin");
            header('Vary: Origin');
        }
        if ($cfg['credentials']) { header('Access-Control-Allow-Credentials: true'); }
        header('Access-Control-Allow-Methods: ' . implode(', ', $cfg['allowed_methods']));
        header('Access-Control-Allow-Headers: ' . implode(', ', $cfg['allowed_headers']));
        if (Request::method() === 'OPTIONS') { http_response_code(204); exit; }
    }
}
