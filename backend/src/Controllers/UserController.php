<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\UserRepository;

class UserController
{
    private UserRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        RoleMiddleware::require('admin');
        $this->repo = new UserRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $search = trim((string)Request::query('search', ''));
        $role = trim((string)Request::query('role', ''));
        $status = trim((string)Request::query('status', ''));

        $result = $this->repo->paginate($page, $perPage, $search ?: null, $role ?: null, $status ?: null);

        Response::ok($result['rows'], 'Users', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $u = $this->repo->findById((int)$id);
        if (!$u) Response::error('User not found', 404);
        Response::ok($u, 'User');
    }

    public function store(): void
    {
        $data = Request::json();
        $this->validate($data, true);

        $email = strtolower(trim((string)$data['email']));
        if ($this->repo->emailExists($email)) {
            Response::error('Validation failed', 422, ['email' => ['Email already in use']]);
        }

        $id = $this->repo->create([
            'name' => trim((string)$data['name']),
            'email' => $email,
            'password_hash' => password_hash((string)$data['password'], PASSWORD_BCRYPT),
            'role' => $data['role'] ?? 'staff',
            'status' => $data['status'] ?? 'active',
        ]);

        Response::created($this->repo->findById($id), 'User created');
    }

    public function update(string $id): void
    {
        $uid = (int)$id;
        $existing = $this->repo->findById($uid);
        if (!$existing) Response::error('User not found', 404);

        $data = Request::json();
        $this->validate($data, false);

        $email = strtolower(trim((string)$data['email']));
        if ($this->repo->emailExists($email, $uid)) {
            Response::error('Validation failed', 422, ['email' => ['Email already in use']]);
        }

        // Prevent self-demotion or self-deactivation
        if ($uid === Auth::id()) {
            if (($data['role'] ?? '') !== 'admin') {
                Response::error('You cannot change your own role from admin', 422);
            }
            if (($data['status'] ?? '') !== 'active') {
                Response::error('You cannot deactivate your own account', 422);
            }
        }

        // If this is the last active admin and we're demoting/deactivating, block
        if ($existing['role'] === 'admin' && $existing['status'] === 'active') {
            $wouldLoseAdmin = ($data['role'] ?? '') !== 'admin' || ($data['status'] ?? '') !== 'active';
            if ($wouldLoseAdmin && $this->repo->adminCount() <= 1) {
                Response::error('Cannot demote or deactivate the last remaining admin', 422);
            }
        }

        $this->repo->update($uid, [
            'name' => trim((string)$data['name']),
            'email' => $email,
            'role' => $data['role'] ?? 'staff',
            'status' => $data['status'] ?? 'active',
        ]);

        Response::ok($this->repo->findById($uid), 'User updated');
    }

    public function changePassword(string $id): void
    {
        $uid = (int)$id;
        if (!$this->repo->findById($uid)) Response::error('User not found', 404);

        $data = Request::json();
        $password = (string)($data['password'] ?? '');

        if (strlen($password) < 6) {
            Response::error('Validation failed', 422, ['password' => ['Password must be at least 6 characters']]);
        }
        if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
            Response::error('Validation failed', 422, ['password' => ['Password must contain at least one letter and one digit']]);
        }

        $this->repo->setPassword($uid, password_hash($password, PASSWORD_BCRYPT));
        Response::ok(null, 'Password updated');
    }

    public function activate(string $id): void
    {
        $uid = (int)$id;
        if (!$this->repo->findById($uid)) Response::error('User not found', 404);
        $this->repo->setStatus($uid, 'active');
        Response::ok($this->repo->findById($uid), 'User activated');
    }

    public function deactivate(string $id): void
    {
        $uid = (int)$id;
        $existing = $this->repo->findById($uid);
        if (!$existing) Response::error('User not found', 404);

        if ($uid === Auth::id()) {
            Response::error('You cannot deactivate your own account', 422);
        }
        if ($existing['role'] === 'admin' && $existing['status'] === 'active' && $this->repo->adminCount() <= 1) {
            Response::error('Cannot deactivate the last remaining admin', 422);
        }

        $this->repo->setStatus($uid, 'inactive');
        Response::ok($this->repo->findById($uid), 'User deactivated');
    }

    private function validate(array $data, bool $requirePassword): void
    {
        $v = new Validator($data);
        $v->required('name')->max('name', 100);
        $v->required('email')->max('email', 150);
        $v->in('role', ['admin', 'staff']);
        $v->in('status', ['active', 'inactive']);
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $email = trim((string)$data['email']);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Validation failed', 422, ['email' => ['Invalid email address']]);
        }

        if ($requirePassword) {
            $password = (string)($data['password'] ?? '');
            if (strlen($password) < 6) {
                Response::error('Validation failed', 422, ['password' => ['Password must be at least 6 characters']]);
            }
            if (!preg_match('/[A-Za-z]/', $password) || !preg_match('/\d/', $password)) {
                Response::error('Validation failed', 422, ['password' => ['Password must contain at least one letter and one digit']]);
            }
        }
    }
}