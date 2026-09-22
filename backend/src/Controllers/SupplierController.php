<?php
namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\SupplierRepository;

class SupplierController
{
    private SupplierRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new SupplierRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $search = trim((string)Request::query('search', ''));
        $status = trim((string)Request::query('status', ''));

        $result = $this->repo->paginate($page, $perPage, $search ?: null, $status ?: null);

        Response::ok($result['rows'], 'Suppliers', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $s = $this->repo->findById((int)$id);
        if (!$s) Response::error('Supplier not found', 404);
        Response::ok($s, 'Supplier');
    }

    public function store(): void
    {
        $data = Request::json();
        $this->validate($data);

        $id = $this->repo->create($this->payload($data));
        Response::created($this->repo->findById($id), 'Supplier created');
    }

    public function update(string $id): void
    {
        $sid = (int)$id;
        if (!$this->repo->findById($sid)) Response::error('Supplier not found', 404);

        $data = Request::json();
        $this->validate($data);

        $this->repo->update($sid, $this->payload($data));
        Response::ok($this->repo->findById($sid), 'Supplier updated');
    }

    public function activate(string $id): void
    {
        RoleMiddleware::require('admin');
        $sid = (int)$id;
        if (!$this->repo->findById($sid)) Response::error('Supplier not found', 404);
        $this->repo->setStatus($sid, 'active');
        Response::ok($this->repo->findById($sid), 'Supplier activated');
    }

    public function deactivate(string $id): void
    {
        RoleMiddleware::require('admin');
        $sid = (int)$id;
        if (!$this->repo->findById($sid)) Response::error('Supplier not found', 404);
        $this->repo->setStatus($sid, 'inactive');
        Response::ok($this->repo->findById($sid), 'Supplier deactivated');
    }

    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        $sid = (int)$id;
        if (!$this->repo->findById($sid)) Response::error('Supplier not found', 404);

        $count = $this->repo->purchaseCount($sid);
        if ($count > 0) {
            Response::error("Cannot delete: supplier has {$count} purchase(s). Deactivate instead.", 409);
        }

        $this->repo->delete($sid);
        Response::ok(null, 'Supplier deleted');
    }

    private function validate(array $data): void
    {
        $v = new Validator($data);
        $v->required('name')->max('name', 150);
        $v->max('contact_person', 100);
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
            'contact_person' => trim((string)($data['contact_person'] ?? '')) ?: null,
            'phone' => trim((string)($data['phone'] ?? '')) ?: null,
            'email' => trim((string)($data['email'] ?? '')) ?: null,
            'address' => trim((string)($data['address'] ?? '')) ?: null,
            'status' => $data['status'] ?? 'active',
        ];
    }
}