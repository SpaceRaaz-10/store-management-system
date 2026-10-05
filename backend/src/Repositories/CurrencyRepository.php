<?php
namespace App\Repositories;

use App\Core\Database;

class CurrencyRepository
{
    public function all(bool $onlyActive = false): array
    {
        $sql = 'SELECT * FROM currencies';
        if ($onlyActive) $sql .= ' WHERE is_active = 1';
        $sql .= ' ORDER BY is_base DESC, code ASC';
        return Database::pdo()->query($sql)->fetchAll();
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM currencies WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByCode(string $code): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM currencies WHERE code = ?');
        $stmt->execute([strtoupper($code)]);
        return $stmt->fetch() ?: null;
    }

    public function codeExists(string $code, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM currencies WHERE code = ?';
        $params = [strtoupper($code)];
        if ($excludeId !== null) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function baseId(): int
    {
        return (int)Database::pdo()->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();
    }

    public function create(array $d): int
    {
        $stmt = Database::pdo()->prepare(
            'INSERT INTO currencies (code, name, symbol, decimal_places, is_base, is_active)
             VALUES (:code, :name, :symbol, :dp, 0, 1)'
        );
        $stmt->execute([
            'code' => strtoupper($d['code']),
            'name' => $d['name'],
            'symbol' => $d['symbol'],
            'dp' => $d['decimal_places'] ?? 2,
        ]);
        return (int)Database::pdo()->lastInsertId();
    }

    public function update(int $id, array $d): void
    {
        $stmt = Database::pdo()->prepare(
            'UPDATE currencies SET name = :name, symbol = :symbol, decimal_places = :dp WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $d['name'],
            'symbol' => $d['symbol'],
            'dp' => $d['decimal_places'] ?? 2,
        ]);
    }

    public function setStatus(int $id, bool $active): void
    {
        if ($id === $this->baseId()) {
            throw new \RuntimeException('Cannot deactivate the base currency');
        }
        $stmt = Database::pdo()->prepare('UPDATE currencies SET is_active = ? WHERE id = ?');
        $stmt->execute([$active ? 1 : 0, $id]);
    }

    public function isUsed(int $id): bool
    {
        $pdo = Database::pdo();
        foreach (['sales', 'purchases', 'payments', 'return_requests'] as $tbl) {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM $tbl WHERE currency_id = ?");
            $stmt->execute([$id]);
            if ((int)$stmt->fetchColumn() > 0) return true;
        }
        return false;
    }

    public function delete(int $id): void
    {
        if ($id === $this->baseId()) {
            throw new \RuntimeException('Cannot delete the base currency');
        }
        if ($this->isUsed($id)) {
            throw new \RuntimeException('Currency is used by transactions. Deactivate instead.');
        }
        $pdo = Database::pdo();
        $pdo->prepare('DELETE FROM exchange_rates WHERE currency_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM currencies WHERE id = ?')->execute([$id]);
    }
}