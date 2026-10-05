<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\CurrencyRepository;
use App\Repositories\ExchangeRateRepository;

class CurrencyController
{
    private CurrencyRepository $repo;
    private ExchangeRateRepository $rates;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new CurrencyRepository();
        $this->rates = new ExchangeRateRepository();
    }

    // GET /api/currencies — auth, list with current rates
    public function index(): void
    {
        Response::ok($this->rates->currentRates(), 'Currencies');
    }

    // GET /api/currencies/all — auth, includes inactive for admin management
    public function all(): void
    {
        Response::ok($this->repo->all(false), 'All currencies');
    }

    // GET /api/currencies/{id}
    public function show(string $id): void
    {
        $c = $this->repo->findById((int)$id);
        if (!$c) Response::error('Currency not found', 404);
        Response::ok($c, 'Currency');
    }

    // POST /api/currencies — admin
    public function store(): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();

        $v = new Validator($data);
        $v->required('code')->max('code', 3);
        $v->required('name')->max('name', 50);
        $v->required('symbol')->max('symbol', 10);
        $v->numeric('decimal_places');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $code = strtoupper(trim((string)$data['code']));
        if (!preg_match('/^[A-Z]{3}$/', $code)) {
            Response::error('Validation failed', 422, ['code' => ['Currency code must be 3 uppercase letters (e.g. USD)']]);
        }
        if ($this->repo->codeExists($code)) {
            Response::error('Validation failed', 422, ['code' => ['Currency code already exists']]);
        }

        $id = $this->repo->create([
            'code' => $code,
            'name' => trim((string)$data['name']),
            'symbol' => trim((string)$data['symbol']),
            'decimal_places' => (int)($data['decimal_places'] ?? 2),
        ]);

        Response::created($this->repo->findById($id), 'Currency created');
    }

    // PUT /api/currencies/{id} — admin
    public function update(string $id): void
    {
        RoleMiddleware::require('admin');
        $cid = (int)$id;
        $existing = $this->repo->findById($cid);
        if (!$existing) Response::error('Currency not found', 404);

        $data = Request::json();
        $v = new Validator($data);
        $v->required('name')->max('name', 50);
        $v->required('symbol')->max('symbol', 10);
        $v->numeric('decimal_places');
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $this->repo->update($cid, [
            'name' => trim((string)$data['name']),
            'symbol' => trim((string)$data['symbol']),
            'decimal_places' => (int)($data['decimal_places'] ?? 2),
        ]);

        Response::ok($this->repo->findById($cid), 'Currency updated');
    }

    // POST /api/currencies/{id}/activate — admin
    public function activate(string $id): void
    {
        RoleMiddleware::require('admin');
        try {
            $this->repo->setStatus((int)$id, true);
            Response::ok($this->repo->findById((int)$id), 'Currency activated');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    // POST /api/currencies/{id}/deactivate — admin
    public function deactivate(string $id): void
    {
        RoleMiddleware::require('admin');
        try {
            $this->repo->setStatus((int)$id, false);
            Response::ok($this->repo->findById((int)$id), 'Currency deactivated');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    // DELETE /api/currencies/{id} — admin
    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        try {
            $this->repo->delete((int)$id);
            Response::ok(null, 'Currency deleted');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }
}