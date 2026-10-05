<?php
namespace App\Services;

use App\Core\Database;

/**
 * Fetches live exchange rates from the free Frankfurter API v2 (ECB-backed, no API key)
 * and stores them into `exchange_rates`.
 *
 * v2 API returns an array of {base, quote, rate} where rate = how many `quote` per 1 `base`.
 * Example: GET https://api.frankfurter.dev/v2/rates?base=npr&quotes=usd,inr
 *   → [
 *       { "date": "2026-10-04", "base": "NPR", "quote": "USD", "rate": 0.0064 },
 *       { "date": "2026-10-04", "base": "NPR", "quote": "INR", "rate": 0.6000 }
 *     ]
 *
 * That tells us: 1 NPR = 0.0064 USD  →  1 USD = 1/0.0064 = 156.25 NPR
 * We invert to store as: 1 foreign = N base.
 */
class ExchangeRateFetcher
{
    private const API_BASE = 'https://api.frankfurter.dev/v2/rates';
    private const TIMEOUT_SECONDS = 10;

    private \PDO $pdo;
    private int $baseCurrencyId;
    private string $baseCode;

    public function __construct()
    {
        $this->pdo = Database::pdo();

        $row = $this->pdo->query(
            "SELECT id, code FROM currencies WHERE is_base = 1 LIMIT 1"
        )->fetch();
        if (!$row) {
            throw new \RuntimeException('Base currency not found');
        }
        $this->baseCurrencyId = (int)$row['id'];
        $this->baseCode = strtolower((string)$row['code']);
    }

    public function fetchAll(bool $dryRun = false): array
    {
        $currencies = $this->pdo->query(
            "SELECT id, code, name FROM currencies WHERE is_active = 1 AND is_base = 0 ORDER BY code ASC"
        )->fetchAll();

        if (empty($currencies)) {
            return ['fetched' => 0, 'skipped' => 0, 'errors' => [], 'rates' => []];
        }

        // Build quotes list (lowercase for v2 API)
        $quotes = array_map(fn($c) => strtolower($c['code']), $currencies);

        $payload = $this->callApi($this->baseCode, $quotes);
        if ($payload === null) {
            return [
                'fetched' => 0,
                'skipped' => 0,
                'errors' => ['API request failed or returned no data'],
                'rates' => [],
            ];
        }

        // v2 API returns a flat array: [{base, quote, rate, date}, ...]
        $apiRates = [];
        if (is_array($payload)) {
            foreach ($payload as $entry) {
                if (isset($entry['quote'], $entry['rate'])) {
                    $apiRates[strtoupper($entry['quote'])] = (float)$entry['rate'];
                }
            }
        }

        $fetched = 0;
        $skipped = 0;
        $results = [];

        foreach ($currencies as $c) {
            $code = strtoupper($c['code']);

            $foreignPerBase = $apiRates[$code] ?? null;
            if (!$foreignPerBase || $foreignPerBase <= 0) {
                $results[] = [
                    'code' => $code,
                    'status' => 'error',
                    'message' => "Rate missing in API response for {$code}",
                ];
                continue;
            }

            // Invert: we have 1 base = X foreign, we need 1 foreign = N base
            $rateToBase = 1.0 / $foreignPerBase;
            $rateToBase = round($rateToBase, 8);

            $current = $this->getCurrentRate((int)$c['id']);
            if ($current !== null && abs($current['rate_to_base'] - $rateToBase) < 0.0000001) {
                $skipped++;
                $results[] = [
                    'code' => $code,
                    'status' => 'skipped',
                    'rate' => $rateToBase,
                    'message' => 'Rate unchanged',
                ];
                continue;
            }

            if (!$dryRun) {
                $stmt = $this->pdo->prepare(
                    'INSERT INTO exchange_rates
                     (currency_id, base_currency_id, rate_to_base, effective_at, is_active, created_by)
                     VALUES (?, ?, ?, NOW(), 1, NULL)'
                );
                $stmt->execute([$c['id'], $this->baseCurrencyId, $rateToBase]);
            }

            $fetched++;
            $results[] = [
                'code' => $code,
                'status' => 'fetched',
                'rate' => $rateToBase,
                'previous' => $current['rate_to_base'] ?? null,
            ];
        }

        if (!$dryRun) {
            $this->pdo->prepare(
                "INSERT INTO settings (`key`, value, updated_by)
                 VALUES ('rates.last_fetch_at', ?, NULL)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()"
            )->execute([date('Y-m-d H:i:s')]);

            $this->pdo->prepare(
                "INSERT INTO settings (`key`, value, updated_by)
                 VALUES ('rates.last_fetch_status', ?, NULL)
                 ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()"
            )->execute([
                json_encode([
                    'fetched' => $fetched,
                    'skipped' => $skipped,
                    'errors' => count(array_filter($results, fn($r) => $r['status'] === 'error')),
                ]),
            ]);
        }

        return [
            'fetched' => $fetched,
            'skipped' => $skipped,
            'errors' => [],
            'rates' => $results,
            'api_base' => strtoupper($this->baseCode),
            'api_date' => date('Y-m-d'),
        ];
    }

    private function getCurrentRate(int $currencyId): ?array
    {
        $stmt = $this->pdo->prepare(
            "SELECT rate_to_base, effective_at
             FROM exchange_rates
             WHERE currency_id = ? AND base_currency_id = ? AND is_active = 1
               AND effective_at <= NOW()
             ORDER BY effective_at DESC
             LIMIT 1"
        );
        $stmt->execute([$currencyId, $this->baseCurrencyId]);
        $row = $stmt->fetch();
        return $row ? ['rate_to_base' => (float)$row['rate_to_base'], 'effective_at' => $row['effective_at']] : null;
    }

    private function callApi(string $base, array $quotes): ?array
    {
        // v2 API: /v2/rates?base=npr&quotes=usd,inr
        $url = self::API_BASE
             . '?base=' . urlencode($base)
             . '&quotes=' . urlencode(implode(',', array_unique($quotes)));

        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => self::TIMEOUT_SECONDS,
                CURLOPT_CONNECTTIMEOUT => self::TIMEOUT_SECONDS,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_USERAGENT => 'StoreManagementSystem/1.0',
                CURLOPT_SSL_VERIFYPEER => true,
            ]);
            $body = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $err = curl_error($ch);
            curl_close($ch);

            if ($body === false || $httpCode !== 200) {
                error_log("[ExchangeRateFetcher] cURL failed: HTTP {$httpCode} {$err} | URL: {$url}");
                return null;
            }
            $decoded = json_decode($body, true);
            return is_array($decoded) ? $decoded : null;
        }

        $ctx = stream_context_create([
            'http' => [
                'timeout' => self::TIMEOUT_SECONDS,
                'user_agent' => 'StoreManagementSystem/1.0',
                'ignore_errors' => true,
            ],
        ]);
        $body = @file_get_contents($url, false, $ctx);
        if ($body === false) {
            error_log("[ExchangeRateFetcher] file_get_contents failed for {$url}");
            return null;
        }
        $decoded = json_decode($body, true);
        return is_array($decoded) ? $decoded : null;
    }

    public function status(): array
    {
        $rows = $this->pdo->query(
            "SELECT `key`, value FROM settings WHERE `key` IN ('rates.last_fetch_at', 'rates.last_fetch_status', 'rates.auto_fetch_enabled')"
        )->fetchAll();

        $map = [];
        foreach ($rows as $r) $map[$r['key']] = $r['value'];

        $lastStatus = null;
        if (!empty($map['rates.last_fetch_status'])) {
            $lastStatus = json_decode($map['rates.last_fetch_status'], true);
        }

        return [
            'auto_enabled' => ($map['rates.auto_fetch_enabled'] ?? '1') === '1',
            'last_fetch_at' => $map['rates.last_fetch_at'] ?? null,
            'last_status' => $lastStatus,
            'api_source' => 'Frankfurter v2 (ECB + 104 central banks)',
            'api_url' => self::API_BASE,
        ];
    }

    public function setAutoEnabled(bool $enabled): void
    {
        $this->pdo->prepare(
            "INSERT INTO settings (`key`, value, updated_by)
             VALUES ('rates.auto_fetch_enabled', ?, NULL)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()"
        )->execute([$enabled ? '1' : '0']);
    }
}