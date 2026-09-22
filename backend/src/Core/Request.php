<?php
namespace App\Core;

class Request
{
    public static function method(): string { return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'); }
    public static function path(): string {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        return rtrim($uri, '/') ?: '/';
    }
    public static function json(): array {
        $raw = file_get_contents('php://input');
        if ($raw === '' || $raw === false) return [];
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }
    public static function query(string $key, mixed $default = null): mixed { return $_GET[$key] ?? $default; }
    public static function header(string $name): ?string {
        $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$key] ?? null;
    }
}
