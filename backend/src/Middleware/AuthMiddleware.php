<?php
namespace App\Middleware;

use App\Core\Auth;
use App\Core\Response;

class AuthMiddleware
{
    public static function handle(): void
    {
        if (!Auth::check()) {
            Response::error('Authentication required', 401);
        }
    }
}