<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\VoidRepository;

class VoidController
{
    private VoidRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new VoidRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'status' => trim((string)Request::query('status', '')),
        ];
        $result = $this->repo->paginate($page, $perPage, $filters);

        Response::ok($result['rows'], 'Void requests', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $r = $this->repo->findById((int)$id);
        if (!$r) Response::error('Void request not found', 404);
        Response::ok($r, 'Void request');
    }

    // POST /api/sales/{id}/void
    public function store(string $saleId): void
    {
        $data = Request::json();
        $reason = trim((string)($data['reason'] ?? ''));
        if ($reason === '') {
            Response::error('Validation failed', 422, ['reason' => ['Reason is required']]);
        }

        try {
            $id = $this->repo->create((int)$saleId, $reason, Auth::id());
            Response::created($this->repo->findById($id), 'Void request submitted');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function approve(string $id): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();
        $note = trim((string)($data['note'] ?? '')) ?: null;

        try {
            $this->repo->approve((int)$id, Auth::id(), $note);
            Response::ok($this->repo->findById((int)$id), 'Sale voided and stock reversed');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function reject(string $id): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();
        $note = trim((string)($data['note'] ?? '')) ?: null;

        try {
            $this->repo->reject((int)$id, Auth::id(), $note);
            Response::ok($this->repo->findById((int)$id), 'Void request rejected');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }
}