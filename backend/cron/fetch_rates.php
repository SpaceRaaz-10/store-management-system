<?php
/**
 * Scheduled task: fetch live exchange rates once a day (or however often you schedule).
 *
 * Windows Task Scheduler example:
 *   Program:  C:\xampp\php\php.exe
 *   Argument: "D:\store-management-system\backend\cron\fetch_rates.php"
 *   Trigger:  Daily at 08:00
 *
 * Linux cron example (every day at 8am):
 *   0 8 * * * /usr/bin/php /var/www/store/backend/cron/fetch_rates.php >> /var/log/store-rates.log 2>&1
 *
 * Or run manually:
 *   php cron/fetch_rates.php
 */

require __DIR__ . '/../autoload.php';

use App\Core\Env;
use App\Core\Database;
use App\Services\ExchangeRateFetcher;

Env::load(__DIR__ . '/../.env');

$ts = date('Y-m-d H:i:s');
echo "[{$ts}] Exchange rate fetch started\n";

try {
    // Check auto-fetch flag
    $pdo = Database::pdo();
    $stmt = $pdo->prepare("SELECT value FROM settings WHERE `key` = 'rates.auto_fetch_enabled' LIMIT 1");
    $stmt->execute();
    $flag = $stmt->fetchColumn();

    if ($flag === '0') {
        echo "[{$ts}] Auto-fetch is disabled. Skipping.\n";
        exit(0);
    }

    $fetcher = new ExchangeRateFetcher();
    $result = $fetcher->fetchAll(false);

    echo "[{$ts}] Fetched: {$result['fetched']} | Skipped: {$result['skipped']}\n";
    foreach ($result['rates'] as $r) {
        $prev = isset($r['previous']) ? sprintf(' (was %.6f)', $r['previous']) : '';
        if ($r['status'] === 'fetched') {
            echo "  ✓ {$r['code']}: 1 {$r['code']} = {$r['rate']} {$result['api_base']}{$prev}\n";
        } elseif ($r['status'] === 'skipped') {
            echo "  · {$r['code']}: unchanged ({$r['rate']})\n";
        } else {
            echo "  ✗ {$r['code']}: {$r['message']}\n";
        }
    }

    if (!empty($result['errors'])) {
        foreach ($result['errors'] as $e) {
            echo "  ERROR: {$e}\n";
        }
        exit(1);
    }

    echo "[{$ts}] Done.\n";
    exit(0);
} catch (\Throwable $e) {
    echo "[{$ts}] FATAL: {$e->getMessage()}\n";
    exit(2);
}