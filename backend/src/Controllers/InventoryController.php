<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\InventoryRepository;

class InventoryController
{
    private InventoryRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new InventoryRepository();
    }

    // GET /api/inventory
    public function stock(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'category_id' => Request::query('category_id'),
            'status' => trim((string)Request::query('status', '')),
            'low_stock' => Request::query('low_stock'),
        ];
        $result = $this->repo->paginateStock($page, $perPage, $filters);

        Response::ok($result['rows'], 'Stock', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    // GET /api/inventory/movements
    public function movements(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'product_id' => Request::query('product_id'),
            'type' => trim((string)Request::query('type', '')),
            'search' => trim((string)Request::query('search', '')),
            'from' => trim((string)Request::query('from', '')),
            'to' => trim((string)Request::query('to', '')),
        ];
        $result = $this->repo->paginateMovements($page, $perPage, $filters);

        Response::ok($result['rows'], 'Stock movements', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    // GET /api/inventory/low-stock
    public function lowStock(): void
    {
        $limit = min(100, max(1, (int)Request::query('limit', 20)));
        $rows = $this->repo->lowStock($limit);
        Response::ok($rows, 'Low stock products');
    }

    // POST /api/inventory/adjust  (admin only)
    public function adjust(): void
    {
        RoleMiddleware::require('admin');

        $data = Request::json();
        $productId = (int)($data['product_id'] ?? 0);
        $mode = (string)($data['mode'] ?? 'set'); // 'set' or 'delta'
        $value = (float)($data['value'] ?? 0);
        $reason = trim((string)($data['reason'] ?? ''));

        $errors = [];
        if ($productId <= 0) $errors['product_id'][] = 'Product is required';
        if (!in_array($mode, ['set', 'delta'], true)) $errors['mode'][] = 'Mode must be set or delta';
        if ($reason === '') $errors['reason'][] = 'Reason is required';
        if ($mode === 'set' && $value < 0) $errors['value'][] = 'New stock cannot be negative';
        if ($mode === 'delta' && !is_numeric($data['value'] ?? null)) $errors['value'][] = 'Adjustment must be a number';
        if ($errors) Response::error('Validation failed', 422, $errors);

        try {
            $result = $this->repo->adjust($productId, $mode, $value, Auth::id(), $reason);
            Response::ok($result, 'Stock adjusted');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }
}