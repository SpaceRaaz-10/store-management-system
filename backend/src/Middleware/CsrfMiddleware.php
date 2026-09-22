<?php
namespace App\Middleware;

use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;

class CsrfMiddleware
{
    private const SAFE = ['GET', 'HEAD', 'OPTIONS'];

    public static function handle(): void
    {
        if (in_array(Request::method(), self::SAFE, true)) return;

        $token = Request::header('X-CSRF-Token')
              ?? $_POST['_csrf']
              ?? $_GET['_csrf']
              ?? null;

        if (!Csrf::validate($token)) {
            Response::error('Invalid CSRF token', 419);
        }
    }
}