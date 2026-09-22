<?php
namespace App\Services;

use App\Repositories\UserRepository;

class AuthService
{
    private UserRepository $users;

    public function __construct()
    {
        $this->users = new UserRepository();
    }

    public function authenticate(string $email, string $password): array
    {
        $user = $this->users->findByEmail($email);

        if (!$user) {
            return ['ok' => false, 'message' => 'Invalid email or password'];
        }
        if ($user['status'] !== 'active') {
            return ['ok' => false, 'message' => 'Account is inactive'];
        }
        if (!password_verify($password, $user['password_hash'])) {
            return ['ok' => false, 'message' => 'Invalid email or password'];
        }

        $this->users->updateLastLogin((int)$user['id']);

        return ['ok' => true, 'user' => [
            'id'    => (int)$user['id'],
            'name'  => $user['name'],
            'email' => $user['email'],
            'role'  => $user['role'],
        ]];
    }
}