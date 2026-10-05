<?php
namespace App\Repositories;

use App\Core\Database;

class ReturnRepository
{
    public function paginate(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['search'])) {
            $where[] = '(s.invoice_no LIKE :s OR c.name LIKE :s)';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['status'])) {
            $where[] = 'rr.status = :st';
            $params['st'] = $f['status'];
        }
        if (!empty($f['sale_id'])) {
            $where[] = 'rr.sale_id = :sid';
            $params['sid'] = (int)$f['sale_id'];
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM return_requests rr
             JOIN sales s ON s.id = rr.sale_id
             LEFT JOIN customers c ON c.id = rr.customer_id
             $whereSql"
        );
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT rr.*, s.invoice_no,
                       c.name AS customer_name,
                       cur.code AS currency_code, cur.symbol AS currency_symbol,
                       req.name AS requested_by_name,
                       apr.name AS approved_by_name
                FROM return_requests rr
                JOIN sales s ON s.id = rr.sale_id
                LEFT JOIN customers c ON c.id = rr.customer_id
                JOIN currencies cur ON cur.id = rr.currency_id
                JOIN users req ON req.id = rr.requested_by
                LEFT JOIN users apr ON apr.id = rr.approved_by
                $whereSql
                ORDER BY rr.requested_at DESC
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
            'SELECT rr.*, s.invoice_no, s.sale_date, s.total AS sale_total,
                    c.name AS customer_name, c.phone AS customer_phone,
                    cur.code AS currency_code, cur.symbol AS currency_symbol,
                    req.name AS requested_by_name, apr.name AS approved_by_name
             FROM return_requests rr
             JOIN sales s ON s.id = rr.sale_id
             LEFT JOIN customers c ON c.id = rr.customer_id
             JOIN currencies cur ON cur.id = rr.currency_id
             JOIN users req ON req.id = rr.requested_by
             LEFT JOIN users apr ON apr.id = rr.approved_by
             WHERE rr.id = ?'
        );
        $stmt->execute([$id]);
        $request = $stmt->fetch();
        if (!$request) return null;

        $items = $pdo->prepare(
            'SELECT ri.*, p.name AS product_name, p.sku
             FROM return_items ri
             JOIN products p ON p.id = ri.product_id
             WHERE ri.return_request_id = ?
             ORDER BY ri.id ASC'
        );
        $items->execute([$id]);
        $request['items'] = $items->fetchAll();

        return $request;
    }

    public function create(int $saleId, array $d, int $userId): int
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            // Verify sale
            $saleStmt = $pdo->prepare('SELECT * FROM sales WHERE id = ?');
            $saleStmt->execute([$saleId]);
            $sale = $saleStmt->fetch();
            if (!$sale) throw new \RuntimeException('Sale not found');
            if ($sale['status'] === 'voided') throw new \RuntimeException('Cannot return a voided sale');
            if ($sale['status'] === 'returned') throw new \RuntimeException('Sale is already fully returned');

            $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

            // Build items
            $itemStmt = $pdo->prepare(
                'INSERT INTO return_items
                 (return_request_id, sale_item_id, product_id, quantity, unit_price, line_total, line_total_base)
                 VALUES (:rid, :siid, :pid, :qty, :up, :lt, :ltb)'
            );

            $subtotal = 0.0;
            $subtotalBase = 0.0;
            $rate = (float)$sale['exchange_rate_to_base'];
            $validatedItems = [];

            foreach ($d['items'] as $row) {
                $siStmt = $pdo->prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?');
                $siStmt->execute([(int)$row['sale_item_id'], $saleId]);
                $saleItem = $siStmt->fetch();
                if (!$saleItem) throw new \RuntimeException("Sale item {$row['sale_item_id']} not found");

                $qty = (float)$row['quantity'];
                $availableToReturn = (float)$saleItem['quantity'] - (float)$saleItem['returned_quantity'];
                if ($qty > $availableToReturn + 0.0001) {
                    throw new \RuntimeException(sprintf(
                        'Cannot return %.3f of item %d — only %.3f available',
                        $qty, $saleItem['id'], $availableToReturn
                    ));
                }
                if ($qty <= 0) throw new \RuntimeException('Return quantity must be greater than 0');

                $unitPrice = (float)$saleItem['unit_price'];
                $lineTotal = round($qty * $unitPrice, 2);
                $lineTotalBase = round($lineTotal * $rate, 2);

                $subtotal += $lineTotal;
                $subtotalBase += $lineTotalBase;

                $validatedItems[] = [
                    'sale_item_id' => (int)$saleItem['id'],
                    'product_id' => (int)$saleItem['product_id'],
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                    'line_total_base' => $lineTotalBase,
                ];
            }

            if (empty($validatedItems)) throw new \RuntimeException('At least one item is required');

            // Simple tax calculation on returned subtotal (assume same rate as original sale total/subtotal)
            $originalSubtotal = (float)$sale['subtotal'];
            $originalTax = (float)$sale['tax_amount'];
            $taxRate = $originalSubtotal > 0 ? $originalTax / $originalSubtotal : 0;
            $taxAmount = round($subtotal * $taxRate, 2);
            $total = round($subtotal + $taxAmount, 2);
            $totalBase = round($total * $rate, 2);

            // Insert request
            $reqStmt = $pdo->prepare(
                'INSERT INTO return_requests
                 (sale_id, customer_id, requested_by, currency_id, base_currency_id,
                  exchange_rate_to_base, reason, notes, subtotal, tax_amount, total, total_base,
                  refund_method, refund_currency_id, refund_exchange_rate_base,
                  refund_amount, refund_amount_base, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending")'
            );
            $reqStmt->execute([
                $saleId,
                $sale['customer_id'] ?: null,
                $userId,
                (int)$sale['currency_id'],
                $baseId,
                $rate,
                trim((string)$d['reason']),
                $d['notes'] ?? null,
                $subtotal,
                $taxAmount,
                $total,
                $totalBase,
                $d['refund_method'] ?? 'original_method',
                (int)$sale['currency_id'],
                $rate,
                $total,
                $totalBase,
            ]);
            $requestId = (int)$pdo->lastInsertId();

            foreach ($validatedItems as $it) {
                $itemStmt->execute([
                    'rid' => $requestId,
                    'siid' => $it['sale_item_id'],
                    'pid' => $it['product_id'],
                    'qty' => $it['quantity'],
                    'up' => $it['unit_price'],
                    'lt' => $it['line_total'],
                    'ltb' => $it['line_total_base'],
                ]);
            }

            $pdo->commit();
            return $requestId;
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
            $request = $this->findById($id);
            if (!$request) throw new \RuntimeException('Return request not found');
            if ($request['status'] !== 'pending') throw new \RuntimeException('Request is not pending');

            $saleId = (int)$request['sale_id'];

            // Restock each returned item
            $stockStmt = $pdo->prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');
            $movStmt = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "return", ?, "return", ?, NULL, ?, ?)'
            );
            $updItemStmt = $pdo->prepare(
                'UPDATE sale_items SET returned_quantity = returned_quantity + ? WHERE id = ?'
            );

            foreach ($request['items'] as $it) {
                $stockStmt->execute([$it['quantity'], $it['product_id']]);
                $movStmt->execute([
                    $it['product_id'],
                    $it['quantity'],
                    $id,
                    $userId,
                    "Return for {$request['invoice_no']}",
                ]);
                $updItemStmt->execute([$it['quantity'], $it['sale_item_id']]);
            }

            // Record refund as a negative payment? For BCA clarity, insert a payment row with the refund amount.
            // Convention: refund is stored as a payment on the sale with negative amount in the note,
            // but since our payments table has no signed amount, we simply log it and do not alter sale total.
            // Instead, we reduce sale's paid_amount if refund is paid back in cash, or leave it.
            // For academic simplicity: reduce due/paid proportionally via note. Update sale status only.

            // Determine whether sale is now fully or partially returned
            $remaining = $pdo->prepare(
                'SELECT SUM(quantity - returned_quantity) AS remaining
                 FROM sale_items WHERE sale_id = ?'
            );
            $remaining->execute([$saleId]);
            $remainingQty = (float)$remaining->fetchColumn();

            $newSaleStatus = $remainingQty <= 0.0001 ? 'returned' : 'partially_returned';
            $upd = $pdo->prepare('UPDATE sales SET status = ? WHERE id = ?');
            $upd->execute([$newSaleStatus, $saleId]);

            // Mark request approved + completed
            $done = $pdo->prepare(
                'UPDATE return_requests
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
            $request = $this->findById($id);
            if (!$request) throw new \RuntimeException('Return request not found');
            if ($request['status'] !== 'pending') throw new \RuntimeException('Request is not pending');

            $upd = $pdo->prepare(
                'UPDATE return_requests
                 SET status = "rejected", approved_by = ?, decision_note = ?, decided_at = NOW()
                 WHERE id = ?'
            );
            $upd->execute([$userId, $note, $id]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}