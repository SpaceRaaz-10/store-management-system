<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\SettingRepository;

class SettingController
{
    private SettingRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new SettingRepository();
    }

    public function index(): void
    {
        Response::ok($this->repo->all(), 'Settings');
    }

    public function update(): void
    {
        RoleMiddleware::require('admin');

        $data = Request::json();
        if (!is_array($data) || empty($data)) {
            Response::error('No settings provided', 422);
        }

        // Whitelist of editable keys
        $allowed = [
            'store.name', 'store.address', 'store.phone', 'store.email',
            'invoice.prefix', 'purchase.prefix', 'invoice.tax_rate',
            'default.currency', 'base.currency',
        ];

        $updates = [];
        foreach ($data as $k => $v) {
            if (!in_array($k, $allowed, true)) continue;
            $updates[$k] = is_scalar($v) ? (string)$v : '';
        }

        if (empty($updates)) {
            Response::error('No valid settings to update', 422);
        }

        // Basic validation
        $errors = [];
        if (isset($updates['store.name']) && trim($updates['store.name']) === '') {
            $errors['store.name'][] = 'Store name is required';
        }
        if (isset($updates['store.email']) && $updates['store.email'] !== '' &&
            !filter_var($updates['store.email'], FILTER_VALIDATE_EMAIL)) {
            $errors['store.email'][] = 'Invalid email';
        }
        if (isset($updates['invoice.tax_rate']) &&
            (!is_numeric($updates['invoice.tax_rate']) || (float)$updates['invoice.tax_rate'] < 0 || (float)$updates['invoice.tax_rate'] > 100)) {
            $errors['invoice.tax_rate'][] = 'Tax rate must be between 0 and 100';
        }
        if (isset($updates['invoice.prefix']) && !preg_match('/^[A-Z0-9]{2,6}$/', $updates['invoice.prefix'])) {
            $errors['invoice.prefix'][] = 'Invoice prefix must be 2–6 uppercase letters or digits';
        }
        if (isset($updates['purchase.prefix']) && !preg_match('/^[A-Z0-9]{2,6}$/', $updates['purchase.prefix'])) {
            $errors['purchase.prefix'][] = 'Purchase prefix must be 2–6 uppercase letters or digits';
        }
        if ($errors) Response::error('Validation failed', 422, $errors);

        $this->repo->bulkUpdate($updates, Auth::id());

        Response::ok($this->repo->all(), 'Settings updated');
    }
}