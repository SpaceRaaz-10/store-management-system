<?php
namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\CategoryRepository;

class CategoryController
{
    private CategoryRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new CategoryRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $search = trim((string)Request::query('search', ''));
        $status = trim((string)Request::query('status', ''));

        $result = $this->repo->paginate($page, $perPage, $search ?: null, $status ?: null);

        Response::ok($result['rows'], 'Categories', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $cat = $this->repo->findById((int)$id);
        if (!$cat) Response::error('Category not found', 404);
        Response::ok($cat, 'Category');
    }

    public function store(): void
    {
        $data = Request::json();
        $v = new Validator($data);
        $v->required('name')->max('name', 100);
        $v->in('status', ['active', 'inactive']);
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $name = trim((string)$data['name']);
        if ($this->repo->nameExists($name)) {
            Response::error('Validation failed', 422, ['name' => ['Category name already exists']]);
        }

        $id = $this->repo->create([
            'name' => $name,
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);

        Response::created($this->repo->findById($id), 'Category created');
    }

    public function update(string $id): void
    {
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Category not found', 404);

        $data = Request::json();
        $v = new Validator($data);
        $v->required('name')->max('name', 100);
        $v->in('status', ['active', 'inactive']);
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $name = trim((string)$data['name']);
        if ($this->repo->nameExists($name, $cid)) {
            Response::error('Validation failed', 422, ['name' => ['Category name already exists']]);
        }

        $this->repo->update($cid, [
            'name' => $name,
            'description' => $data['description'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);

        Response::ok($this->repo->findById($cid), 'Category updated');
    }

    public function activate(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Category not found', 404);
        $this->repo->setStatus($cid, 'active');
        Response::ok($this->repo->findById($cid), 'Category activated');
    }

    public function deactivate(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Category not found', 404);
        $this->repo->setStatus($cid, 'inactive');
        Response::ok($this->repo->findById($cid), 'Category deactivated');
    }

    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        if (!$this->repo->findById($cid)) Response::error('Category not found', 404);

        $count = $this->repo->productCount($cid);
        if ($count > 0) {
            Response::error("Cannot delete: {$count} product(s) still use this category. Deactivate it instead.", 409);
        }

        $this->repo->delete($cid);
        Response::ok(null, 'Category deleted');
    }
}