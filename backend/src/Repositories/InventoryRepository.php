<?php
namespace App\Repositories;

use App\Core\Database;

class InventoryRepository
{
    // -------- Current stock (from products) --------
    public function paginateStock(int $page, int $perPage, array $f): array
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
            $where[] = 'p.status = :st';
            $params['st'] = $f['status'];
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
        $sql = "SELECT p.id, p.name, p.sku, p.barcode, p.unit,
                       p.cost_price, p.selling_price,
                       p.stock_qty, p.reorder_level, p.status, p.image_path,
                       p.category_id, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                $whereSql
                ORDER BY p.name ASC
                LIMIT :lim OFFSET :off";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    // -------- Stock movement history --------
    public function paginateMovements(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['product_id'])) {
            $where[] = 'sm.product_id = :pid';
            $params['pid'] = (int)$f['product_id'];
        }
        if (!empty($f['type'])) {
            $where[] = 'sm.type = :type';
            $params['type'] = $f['type'];
        }
        if (!empty($f['search'])) {
            $where[] = '(p.name LIKE :s OR p.sku LIKE :s)';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['from'])) {
            $where[] = 'DATE(sm.created_at) >= :from';
            $params['from'] = $f['from'];
        }
        if (!empty($f['to'])) {
            $where[] = 'DATE(sm.created_at) <= :to';
            $params['to'] = $f['to'];
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM stock_movements sm
             LEFT JOIN products p ON p.id = sm.product_id
             $whereSql"
        );
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT sm.*, p.name AS product_name, p.sku, u.name AS user_name
                FROM stock_movements sm
                LEFT JOIN products p ON p.id = sm.product_id
                LEFT JOIN users u ON u.id = sm.user_id
                $whereSql
                ORDER BY sm.created_at DESC, sm.id DESC
                LIMIT :lim OFFSET :off";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    // -------- Low stock --------
    public function lowStock(int $limit = 20): array
    {
        $sql = "SELECT p.id, p.name, p.sku, p.unit, p.stock_qty, p.reorder_level,
                       p.status, p.image_path, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE p.status = 'active' AND p.stock_qty <= p.reorder_level
                ORDER BY (p.stock_qty - p.reorder_level) ASC, p.name ASC
                LIMIT :lim";
        $stmt = Database::pdo()->prepare($sql);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    // -------- Manual adjustment (admin) --------
    public function adjust(int $productId, string $mode, float $value, int $userId, string $reason): array
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare('SELECT id, name, stock_qty FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            if (!$product) throw new \RuntimeException('Product not found');

            $current = (float)$product['stock_qty'];

            if ($mode === 'set') {
                $newQty = $value;
                $delta = $newQty - $current;
            } else { // delta
                $delta = $value;
                $newQty = $current + $delta;
            }

            if ($newQty < 0) {
                throw new \RuntimeException('Adjustment would result in negative stock (' . number_format($newQty, 3) . ')');
            }
            if (abs($delta) < 0.0001) {
                throw new \RuntimeException('No change — the requested quantity matches the current stock');
            }

            $upd = $pdo->prepare('UPDATE products SET stock_qty = ?, updated_by = ? WHERE id = ?');
            $upd->execute([$newQty, $userId, $productId]);

            $note = $mode === 'set'
                ? sprintf('Set stock to %s (was %s). %s', number_format($newQty, 3), number_format($current, 3), $reason)
                : sprintf('Manual adjustment of %s. %s', number_format($delta, 3), $reason);

            $mov = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "adjustment", ?, "manual", NULL, NULL, ?, ?)'
            );
            $mov->execute([$productId, $delta, $userId, trim($note)]);

            $pdo->commit();

            return [
                'product_id' => $productId,
                'previous_qty' => $current,
                'new_qty' => $newQty,
                'delta' => $delta,
            ];
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}