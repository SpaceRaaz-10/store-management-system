<?php
namespace App\Repositories;

use App\Core\Database;

class ProductRepository
{
    public function paginate(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['search'])) {
            $where[] = '(p.name LIKE :s OR p.sku LIKE :s OR p.barcode LIKE :s)';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['category_id'])) {
            $where[] = 'p.category_id = :cid';
            $params['cid'] = (int)$f['category_id'];
        }
        if (!empty($f['status'])) {
            $where[] = 'p.status = :status';
            $params['status'] = $f['status'];
        }
        if (!empty($f['low_stock'])) {
            $where[] = 'p.stock_qty <= p.reorder_level';
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare("SELECT COUNT(*) FROM products p $whereSql");
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT p.*, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                $whereSql
                ORDER BY p.created_at DESC
                LIMIT :lim OFFSET :off";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    public function findById(int $id): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT p.*, c.name AS category_name
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        return $stmt->fetch() ?: null;
    }

    public function findByBarcode(string $barcode): ?array
    {
        $stmt = Database::pdo()->prepare(
            'SELECT p.*, c.name AS category_name
             FROM products p LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.barcode = ? AND p.status = "active" LIMIT 1'
        );
        $stmt->execute([$barcode]);
        return $stmt->fetch() ?: null;
    }

    public function skuExists(string $sku, ?int $excludeId = null): bool
    {
        $sql = 'SELECT COUNT(*) FROM products WHERE sku = ?';
        $params = [$sku];
        if ($excludeId !== null) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function barcodeExists(string $barcode, ?int $excludeId = null): bool
    {
        if ($barcode === '') return false;
        $sql = 'SELECT COUNT(*) FROM products WHERE barcode = ?';
        $params = [$barcode];
        if ($excludeId !== null) { $sql .= ' AND id != ?'; $params[] = $excludeId; }
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute($params);
        return (int)$stmt->fetchColumn() > 0;
    }

    public function getNextSku(): string
    {
        $stmt = Database::pdo()->query(
            "SELECT MAX(CAST(SUBSTRING(sku, 5) AS UNSIGNED)) AS n
             FROM products WHERE sku REGEXP '^SKU-[0-9]+$'"
        );
        $n = (int)($stmt->fetchColumn() ?: 0);
        return 'SKU-' . str_pad((string)($n + 1), 6, '0', STR_PAD_LEFT);
    }

    public function getNextBarcode(): string
    {
        $stmt = Database::pdo()->query(
            "SELECT MAX(CAST(barcode AS UNSIGNED)) AS n
             FROM products WHERE barcode REGEXP '^2[0-9]{12}$'"
        );
        $n = (int)($stmt->fetchColumn() ?: 0);
        if ($n < 2000000000000) $n = 2000000000000;
        return (string)($n + 1);
    }

    public function create(array $d, int $userId): int
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                'INSERT INTO products
                 (category_id, name, sku, barcode, description, unit, cost_price, selling_price,
                  stock_qty, reorder_level, status, created_by, updated_by)
                 VALUES (:category_id, :name, :sku, :barcode, :description, :unit, :cost_price,
                  :selling_price, :stock_qty, :reorder_level, :status, :created_by, :updated_by)'
            );
            $stmt->execute([
                'category_id' => $d['category_id'] ?: null,
                'name' => $d['name'],
                'sku' => $d['sku'],
                'barcode' => $d['barcode'] ?: null,
                'description' => $d['description'] ?? null,
                'unit' => $d['unit'] ?? 'pcs',
                'cost_price' => $d['cost_price'] ?? 0,
                'selling_price' => $d['selling_price'] ?? 0,
                'stock_qty' => $d['stock_qty'] ?? 0,
                'reorder_level' => $d['reorder_level'] ?? 0,
                'status' => $d['status'] ?? 'active',
                'created_by' => $userId,
                'updated_by' => $userId,
            ]);
            $id = (int)$pdo->lastInsertId();

            $initial = (float)($d['stock_qty'] ?? 0);
            if ($initial > 0) {
                $mov = $pdo->prepare(
                    'INSERT INTO stock_movements (product_id, type, quantity, reference_type, user_id, note)
                     VALUES (?, "adjustment", ?, "initial", ?, "Initial stock on product creation")'
                );
                $mov->execute([$id, $initial, $userId]);
            }

            $pdo->commit();
            return $id;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $d, int $userId): void
    {
        $stmt = Database::pdo()->prepare(
            'UPDATE products SET
               category_id = :category_id, name = :name, sku = :sku, barcode = :barcode,
               description = :description, unit = :unit, cost_price = :cost_price,
               selling_price = :selling_price, reorder_level = :reorder_level,
               status = :status, updated_by = :updated_by
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'category_id' => $d['category_id'] ?: null,
            'name' => $d['name'],
            'sku' => $d['sku'],
            'barcode' => $d['barcode'] ?: null,
            'description' => $d['description'] ?? null,
            'unit' => $d['unit'] ?? 'pcs',
            'cost_price' => $d['cost_price'] ?? 0,
            'selling_price' => $d['selling_price'] ?? 0,
            'reorder_level' => $d['reorder_level'] ?? 0,
            'status' => $d['status'] ?? 'active',
            'updated_by' => $userId,
        ]);
    }

    public function setStatus(int $id, string $status): void
    {
        $stmt = Database::pdo()->prepare('UPDATE products SET status = :s WHERE id = :id');
        $stmt->execute(['id' => $id, 's' => $status]);
    }

    public function delete(int $id): void
    {
        $stmt = Database::pdo()->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
    }
}