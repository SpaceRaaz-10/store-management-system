<?php
namespace App\Core;

class Response
{
    public static function json(mixed $data = null, int $status = 200, string $message = '', array $meta = [], array $errors = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'success' => $status >= 200 && $status < 300,
            'message' => $message,
            'data'    => $data,
            'errors'  => $errors ?: null,
            'meta'    => $meta ?: null,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    public static function ok(mixed $data = null, string $message = 'OK', array $meta = []): void { self::json($data, 200, $message, $meta); }
    public static function created(mixed $data = null, string $message = 'Created'): void { self::json($data, 201, $message); }
    public static function error(string $message, int $status = 400, array $errors = []): void { self::json(null, $status, $message, [], $errors); }
}
