<?php
namespace App\Core;

class Auth
{
    public static function login(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id']      = (int)$user['id'];
        $_SESSION['user_role']    = $user['role'];
        $_SESSION['user_name']    = $user['name'];
        $_SESSION['logged_in_at'] = time();
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000,
                $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }

    public static function check(): bool
    {
        return !empty($_SESSION['user_id']);
    }

    public static function id(): ?int
    {
        return self::check() ? (int)$_SESSION['user_id'] : null;
    }

    public static function role(): ?string
    {
        return self::check() ? ($_SESSION['user_role'] ?? null) : null;
    }

    public static function user(): ?array
    {
        if (!self::check()) return null;
        return [
            'id'   => self::id(),
            'role' => self::role(),
            'name' => $_SESSION['user_name'] ?? null,
        ];
    }

    public static function isAdmin(): bool
    {
        return self::role() === 'admin';
    }
}