<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Csrf;
use App\Core\Request;
use App\Core\Response;
use App\Repositories\UserRepository;
use App\Services\AuthService;

class AuthController
{
    public function csrf(): void
    {
        Response::ok(['token' => Csrf::token()], 'CSRF token');
    }

    public function login(): void
    {
        $data = Request::json();
        $email = trim((string)($data['email'] ?? ''));
        $password = (string)($data['password'] ?? '');

        $errors = [];
        if ($email === '') $errors['email'][] = 'Email is required';
        elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'][] = 'Invalid email';
        if ($password === '') $errors['password'][] = 'Password is required';

        if ($errors) {
            Response::error('Validation failed', 422, $errors);
        }

        $service = new AuthService();
        $result = $service->authenticate($email, $password);

        if (!$result['ok']) {
            Response::error($result['message'], 401);
        }

        Auth::login($result['user']);
        $newToken = Csrf::regenerate();

        Response::ok([
            'user' => $result['user'],
            'csrf_token' => $newToken,
        ], 'Logged in');
    }

    public function logout(): void
    {
        Auth::logout();
        Response::ok(null, 'Logged out');
    }

    public function me(): void
    {
        if (!Auth::check()) {
            Response::error('Not authenticated', 401);
        }

        $repo = new UserRepository();
        $user = $repo->findById(Auth::id());
        if (!$user || $user['status'] !== 'active') {
            Auth::logout();
            Response::error('Session invalid', 401);
        }

        Response::ok($user, 'Current user');
    }
}