<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\Response;
use App\Middleware\AuthMiddleware;

class CurrencyController
{
    public function __construct()
    {
        AuthMiddleware::handle();
    }

    public function index(): void
    {
        $pdo = Database::pdo();
        $rows = $pdo->query(
            'SELECT id, code, name, symbol, decimal_places, is_base, is_active
             FROM currencies WHERE is_active = 1 ORDER BY is_base DESC, code ASC'
        )->fetchAll();

        // Attach the current active rate for each non-base currency
        foreach ($rows as &$row) {
            $row['rate_to_base'] = 1.0;
            if ((int)$row['is_base'] !== 1) {
                $stmt = $pdo->prepare(
                    'SELECT rate_to_base FROM exchange_rates
                     WHERE currency_id = ? AND is_active = 1 AND effective_at <= NOW()
                     ORDER BY effective_at DESC LIMIT 1'
                );
                $stmt->execute([$row['id']]);
                $rate = $stmt->fetchColumn();
                $row['rate_to_base'] = $rate !== false ? (float)$rate : null;
            }
        }
        unset($row);

        Response::ok($rows, 'Currencies');
    }
}