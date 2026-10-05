<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\ReturnRepository;

class ReturnController
{
    private ReturnRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new ReturnRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'status' => trim((string)Request::query('status', '')),
            'sale_id' => Request::query('sale_id'),
        ];
        $result = $this->repo->paginate($page, $perPage, $filters);

        Response::ok($result['rows'], 'Return requests', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $r = $this->repo->findById((int)$id);
        if (!$r) Response::error('Return request not found', 404);
        Response::ok($r, 'Return request');
    }

    // POST /api/sales/{id}/returns
    public function store(string $saleId): void
    {
        $data = Request::json();

        $errors = [];
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'][] = 'At least one item is required';
        }
        $reason = trim((string)($data['reason'] ?? ''));
        if ($reason === '') $errors['reason'][] = 'Reason is required';

        foreach (($data['items'] ?? []) as $i => $it) {
            if (empty($it['sale_item_id'])) $errors["items.$i.sale_item_id"][] = 'Item is required';
            if (!isset($it['quantity']) || !is_numeric($it['quantity']) || (float)$it['quantity'] <= 0) {
                $errors["items.$i.quantity"][] = 'Quantity must be greater than 0';
            }
        }
        if ($errors) Response::error('Validation failed', 422, $errors);

        $refundMethod = $data['refund_method'] ?? 'original_method';
        if (!in_array($refundMethod, ['cash', 'original_method', 'store_credit', 'other'], true)) {
            $refundMethod = 'original_method';
        }

        try {
            $id = $this->repo->create((int)$saleId, [
                'items' => $data['items'],
                'reason' => $reason,
                'notes' => $data['notes'] ?? null,
                'refund_method' => $refundMethod,
            ], Auth::id());
            Response::created($this->repo->findById($id), 'Return request submitted');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    // Admin-only decisions
    public function approve(string $id): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();
        $note = trim((string)($data['note'] ?? '')) ?: null;

        try {
            $this->repo->approve((int)$id, Auth::id(), $note);
            Response::ok($this->repo->findById((int)$id), 'Return approved and processed');
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
            Response::ok($this->repo->findById((int)$id), 'Return rejected');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }
}