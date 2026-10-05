<?php
namespace App\Repositories;

use App\Core\Database;

class VoidRepository
{
    public function paginate(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['search'])) {
            $where[] = 's.invoice_no LIKE :s';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['status'])) {
            $where[] = 'vr.status = :st';
            $params['st'] = $f['status'];
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM void_requests vr JOIN sales s ON s.id = vr.sale_id $whereSql"
        );
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT vr.*, s.invoice_no, s.sale_date, s.total AS sale_total, s.currency_id,
                       c.symbol AS currency_symbol, c.code AS currency_code,
                       req.name AS requested_by_name, apr.name AS approved_by_name
                FROM void_requests vr
                JOIN sales s ON s.id = vr.sale_id
                JOIN currencies c ON c.id = s.currency_id
                JOIN users req ON req.id = vr.requested_by
                LEFT JOIN users apr ON apr.id = vr.approved_by
                $whereSql
                ORDER BY vr.requested_at DESC
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
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT vr.*, s.invoice_no, s.sale_date, s.total AS sale_total,
                    s.customer_id, c.name AS customer_name,
                    cur.code AS currency_code, cur.symbol AS currency_symbol,
                    req.name AS requested_by_name, apr.name AS approved_by_name
             FROM void_requests vr
             JOIN sales s ON s.id = vr.sale_id
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN currencies cur ON cur.id = s.currency_id
             JOIN users req ON req.id = vr.requested_by
             LEFT JOIN users apr ON apr.id = vr.approved_by
             WHERE vr.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public function create(int $saleId, string $reason, int $userId): int
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $saleStmt = $pdo->prepare('SELECT status FROM sales WHERE id = ?');
            $saleStmt->execute([$saleId]);
            $status = $saleStmt->fetchColumn();
            if ($status === false) throw new \RuntimeException('Sale not found');
            if ($status === 'voided') throw new \RuntimeException('Sale is already voided');
            if ($status === 'returned' || $status === 'partially_returned') {
                throw new \RuntimeException('Cannot void a sale with returns — process a return instead');
            }

            // Prevent duplicate pending requests
            $dup = $pdo->prepare('SELECT COUNT(*) FROM void_requests WHERE sale_id = ? AND status = "pending"');
            $dup->execute([$saleId]);
            if ((int)$dup->fetchColumn() > 0) {
                throw new \RuntimeException('A pending void request already exists for this sale');
            }

            $ins = $pdo->prepare(
                'INSERT INTO void_requests (sale_id, requested_by, reason, status)
                 VALUES (?, ?, ?, "pending")'
            );
            $ins->execute([$saleId, $userId, trim($reason)]);
            $id = (int)$pdo->lastInsertId();

            $pdo->prepare('UPDATE sales SET status = "void_requested" WHERE id = ?')->execute([$saleId]);

            $pdo->commit();
            return $id;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function approve(int $id, int $userId, ?string $note): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $req = $this->findById($id);
            if (!$req) throw new \RuntimeException('Void request not found');
            if ($req['status'] !== 'pending') throw new \RuntimeException('Request is not pending');

            $saleId = (int)$req['sale_id'];

            // Load sale items and reverse stock
            $items = $pdo->prepare('SELECT * FROM sale_items WHERE sale_id = ?');
            $items->execute([$saleId]);
            $saleItems = $items->fetchAll();

            $stockStmt = $pdo->prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
            $movStmt = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "void", ?, "void", ?, NULL, ?, ?)'
            );

            foreach ($saleItems as $it) {
                // Restock only the un-returned portion
                $toRestore = (float)$it['quantity'] - (float)$it['returned_quantity'];
                if ($toRestore <= 0) continue;
                $stockStmt->execute([$toRestore, $it['product_id']]);
                $movStmt->execute([
                    $it['product_id'],
                    $toRestore,
                    $id,
                    $userId,
                    "Void {$req['invoice_no']}",
                ]);
            }

            // Mark sale voided
            $pdo->prepare('UPDATE sales SET status = "voided" WHERE id = ?')->execute([$saleId]);

            // Mark request completed
            $done = $pdo->prepare(
                'UPDATE void_requests
                 SET status = "completed", approved_by = ?, decision_note = ?, decided_at = NOW(), completed_at = NOW()
                 WHERE id = ?'
            );
            $done->execute([$userId, $note, $id]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function reject(int $id, int $userId, ?string $note): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $req = $this->findById($id);
            if (!$req) throw new \RuntimeException('Void request not found');
            if ($req['status'] !== 'pending') throw new \RuntimeException('Request is not pending');

            $pdo->prepare(
                'UPDATE void_requests
                 SET status = "rejected", approved_by = ?, decision_note = ?, decided_at = NOW()
                 WHERE id = ?'
            )->execute([$userId, $note, $id]);

            // Return sale to completed
            $pdo->prepare('UPDATE sales SET status = "completed" WHERE id = ?')->execute([$req['sale_id']]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}