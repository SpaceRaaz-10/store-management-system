<?php
namespace App\Middleware;

use App\Core\Auth;
use App\Core\Response;

class RoleMiddleware
{
    public static function require(string ...$roles): void
    {
        if (!Auth::check()) {
            Response::error('Authentication required', 401);
        }
        if (!in_array(Auth::role(), $roles, true)) {
            Response::error('Forbidden', 403);
        }
    }
}