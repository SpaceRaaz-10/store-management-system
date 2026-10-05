<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\ExchangeRateRepository;
use App\Repositories\CurrencyRepository;
use App\Services\ExchangeRateFetcher;

class ExchangeRateController
{
    private ExchangeRateRepository $repo;
    private CurrencyRepository $currencies;
    private ExchangeRateFetcher $fetcher;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new ExchangeRateRepository();
        $this->currencies = new CurrencyRepository();
        $this->fetcher = new ExchangeRateFetcher();
    }

    public function history(): void
    {
        $currencyId = (int)Request::query('currency_id', 0);
        if ($currencyId <= 0) Response::error('currency_id is required', 422);
        if (!$this->currencies->findById($currencyId)) Response::error('Currency not found', 404);

        $limit = min(200, max(1, (int)Request::query('limit', 50)));
        $rows = $this->repo->history($currencyId, $limit);
        Response::ok($rows, 'Rate history');
    }

    public function store(): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();

        $currencyId = (int)($data['currency_id'] ?? 0);
        $rate = (float)($data['rate_to_base'] ?? 0);
        $effectiveAtRaw = trim((string)($data['effective_at'] ?? ''));

        $errors = [];
        if ($currencyId <= 0) $errors['currency_id'][] = 'Currency is required';
        if ($rate <= 0) $errors['rate_to_base'][] = 'Rate must be greater than 0';
        if ($effectiveAtRaw === '') {
            $errors['effective_at'][] = 'Effective date/time is required';
        }
        if ($errors) Response::error('Validation failed', 422, $errors);

        if (!$this->currencies->findById($currencyId)) {
            Response::error('Currency not found', 404);
        }
        if ($currencyId === $this->currencies->baseId()) {
            Response::error('Cannot set an exchange rate for the base currency', 422);
        }

        $ts = strtotime($effectiveAtRaw);
        if ($ts === false) {
            Response::error('Validation failed', 422, ['effective_at' => ['Invalid date/time']]);
        }
        $effectiveAt = date('Y-m-d H:i:s', $ts);

        try {
            $id = $this->repo->create($currencyId, $rate, $effectiveAt, Auth::id());
            Response::created($this->repo->findRate($id), 'Exchange rate saved');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        $rate = $this->repo->findRate((int)$id);
        if (!$rate) Response::error('Exchange rate not found', 404);

        $this->repo->delete((int)$id);
        Response::ok(null, 'Exchange rate deleted');
    }

    // POST /api/exchange-rates/fetch — admin, fetch live rates now
    public function fetch(): void
    {
        RoleMiddleware::require('admin');
        try {
            $result = $this->fetcher->fetchAll(false);
            if (!empty($result['errors'])) {
                Response::error(implode('; ', $result['errors']), 502);
            }
            Response::ok($result, sprintf(
                'Fetched %d rate(s), skipped %d unchanged',
                $result['fetched'],
                $result['skipped']
            ));
        } catch (\Throwable $e) {
            Response::error('Fetch failed: ' . $e->getMessage(), 500);
        }
    }

    // GET /api/exchange-rates/status
    public function status(): void
    {
        Response::ok($this->fetcher->status(), 'Rate fetch status');
    }

    // POST /api/exchange-rates/auto  { enabled: true|false }
    public function setAuto(): void
    {
        RoleMiddleware::require('admin');
        $data = Request::json();
        $enabled = (bool)($data['enabled'] ?? true);
        $this->fetcher->setAutoEnabled($enabled);
        Response::ok($this->fetcher->status(), $enabled ? 'Auto-fetch enabled' : 'Auto-fetch disabled');
    }
}