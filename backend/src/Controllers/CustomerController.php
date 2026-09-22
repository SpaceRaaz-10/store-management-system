<?php
namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\CustomerRepository;

class CustomerController
{
    private CustomerRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new CustomerRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $search = trim((string)Request::query('search', ''));
        $status = trim((string)Request::query('status', ''));

        $result = $this->repo->paginate($page, $perPage, $search ?: null, $status ?: null);

        Response::ok($result['rows'], 'Customers', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $c = $this->repo->findById((int)$id);
        if (!$c) Response::error('Customer not found', 404);
        Response::ok($c, 'Customer');
    }

    public function store(): void
    {
        $data = Request::json();
        $this->validate($data);

        $id = $this->repo->create($this->payload($data));
        Response::created($this->repo->findById($id), 'Customer created');
    }

    public function update(string $id): void
    {
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Customer not found', 404);

        $data = Request::json();
        $this->validate($data);

        $this->repo->update($cid, $this->payload($data));
        Response::ok($this->repo->findById($cid), 'Customer updated');
    }

    public function activate(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Customer not found', 404);
        $this->repo->setStatus($cid, 'active');
        Response::ok($this->repo->findById($cid), 'Customer activated');
    }

    public function deactivate(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Customer not found', 404);
        $this->repo->setStatus($cid, 'inactive');
        Response::ok($this->repo->findById($cid), 'Customer deactivated');
    }

    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Customer not found', 404);

        $count = $this->repo->saleCount($cid);
        if ($count > 0) {
            Response::error("Cannot delete: customer has {$count} sale(s). Deactivate instead.", 409);
        }

        $this->repo->delete($cid);
        Response::ok(null, 'Customer deleted');
    }

    private function validate(array $data): void
    {
        $v = new Validator($data);
        $v->required('name')->max('name', 150);
        $v->max('phone', 30);
        $v->max('email', 150);
        $v->in('status', ['active', 'inactive']);
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $email = trim((string)($data['email'] ?? ''));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Validation failed', 422, ['email' => ['Invalid email address']]);
        }
    }

    private function payload(array $data): array
    {
        return [
            'name' => trim((string)$data['name']),
            'phone' => trim((string)($data['phone'] ?? '')) ?: null,
            'email' => trim((string)($data['email'] ?? '')) ?: null,
            'address' => trim((string)($data['address'] ?? '')) ?: null,
            'status' => $data['status'] ?? 'active',
        ];
    }
}