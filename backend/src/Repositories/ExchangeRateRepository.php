<?php
namespace App\Repositories;

use App\Core\Database;

class ExchangeRateRepository
{
    public function currentRates(): array
    {
        $pdo = Database::pdo();
        $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

        $rows = $pdo->query(
            "SELECT id, code, name, symbol, decimal_places, is_base, is_active
             FROM currencies
             WHERE is_active = 1
             ORDER BY is_base DESC, code ASC"
        )->fetchAll();

        foreach ($rows as &$r) {
            $r['rate_to_base'] = 1.0;
            $r['effective_at'] = null;
            $r['rate_id'] = null;

            if ((int)$r['is_base'] !== 1) {
                $stmt = $pdo->prepare(
                    "SELECT id, rate_to_base, effective_at
                     FROM exchange_rates
                     WHERE currency_id = :cid
                       AND base_currency_id = :bid
                       AND is_active = 1
                       AND effective_at <= NOW()
                     ORDER BY effective_at DESC
                     LIMIT 1"
                );
                $stmt->execute(['cid' => $r['id'], 'bid' => $baseId]);
                $row = $stmt->fetch();
                if ($row) {
                    $r['rate_id'] = (int)$row['id'];
                    $r['rate_to_base'] = (float)$row['rate_to_base'];
                    $r['effective_at'] = $row['effective_at'];
                } else {
                    $r['rate_to_base'] = null;
                }
            }
        }
        unset($r);

        return $rows;
    }

    public function history(int $currencyId, int $limit = 50): array
    {
        $pdo = Database::pdo();
        $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

        $stmt = $pdo->prepare(
            "SELECT er.id, er.rate_to_base, er.effective_at, er.is_active,
                    er.created_at, er.updated_at,
                    u.name AS created_by_name
             FROM exchange_rates er
             LEFT JOIN users u ON u.id = er.created_by
             WHERE er.currency_id = :cid
               AND er.base_currency_id = :bid
             ORDER BY er.effective_at DESC, er.id DESC
             LIMIT :lim"
        );
        $stmt->bindValue('cid', $currencyId, \PDO::PARAM_INT);
        $stmt->bindValue('bid', $baseId, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function create(int $currencyId, float $rate, string $effectiveAt, int $userId): int
    {
        $pdo = Database::pdo();
        $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

        if ($currencyId === $baseId) {
            throw new \RuntimeException('Cannot add an exchange rate for the base currency');
        }
        if ($rate <= 0) {
            throw new \RuntimeException('Exchange rate must be greater than 0');
        }

        $pdo->prepare(
            "DELETE FROM exchange_rates
             WHERE currency_id = :cid AND base_currency_id = :bid AND effective_at = :eff"
        )->execute(['cid' => $currencyId, 'bid' => $baseId, 'eff' => $effectiveAt]);

        $stmt = $pdo->prepare(
            "INSERT INTO exchange_rates
             (currency_id, base_currency_id, rate_to_base, effective_at, is_active, created_by)
             VALUES (:cid, :bid, :rate, :eff, 1, :uid)"
        );
        $stmt->execute([
            'cid' => $currencyId,
            'bid' => $baseId,
            'rate' => $rate,
            'eff' => $effectiveAt,
            'uid' => $userId,
        ]);
        return (int)$pdo->lastInsertId();
    }

    public function delete(int $id): void
    {
        $stmt = Database::pdo()->prepare('DELETE FROM exchange_rates WHERE id = :id');
        $stmt->execute(['id' => $id]);
    }

    public function findRate(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM exchange_rates WHERE id = :id');
        $stmt->execute(['id' => $id]);
        return $stmt->fetch() ?: null;
    }
}