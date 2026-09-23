<?php
namespace App\Repositories;

use App\Core\Database;
use App\Core\InvoiceNumber;

class PurchaseRepository
{
    public function paginate(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['search'])) {
            $where[] = '(p.invoice_no LIKE :s OR s.name LIKE :s)';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['supplier_id'])) {
            $where[] = 'p.supplier_id = :sid';
            $params['sid'] = (int)$f['supplier_id'];
        }
        if (!empty($f['status'])) {
            $where[] = 'p.status = :status';
            $params['status'] = $f['status'];
        }
        if (!empty($f['payment_status'])) {
            $where[] = 'p.payment_status = :ps';
            $params['ps'] = $f['payment_status'];
        }
        if (!empty($f['from'])) {
            $where[] = 'p.purchase_date >= :from';
            $params['from'] = $f['from'];
        }
        if (!empty($f['to'])) {
            $where[] = 'p.purchase_date <= :to';
            $params['to'] = $f['to'];
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM purchases p JOIN suppliers s ON s.id = p.supplier_id $whereSql"
        );
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT p.*, s.name AS supplier_name,
                       c.code AS currency_code, c.symbol AS currency_symbol,
                       u.name AS user_name
                FROM purchases p
                JOIN suppliers s ON s.id = p.supplier_id
                JOIN currencies c ON c.id = p.currency_id
                JOIN users u ON u.id = p.user_id
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
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            'SELECT p.*, s.name AS supplier_name,
                    s.contact_person AS supplier_contact, s.phone AS supplier_phone, s.email AS supplier_email,
                    c.code AS currency_code, c.symbol AS currency_symbol,
                    b.code AS base_code, b.symbol AS base_symbol,
                    u.name AS user_name
             FROM purchases p
             JOIN suppliers s ON s.id = p.supplier_id
             JOIN currencies c ON c.id = p.currency_id
             JOIN currencies b ON b.id = p.base_currency_id
             JOIN users u ON u.id = p.user_id
             WHERE p.id = ?'
        );
        $stmt->execute([$id]);
        $purchase = $stmt->fetch();
        if (!$purchase) return null;

        $items = $pdo->prepare(
            'SELECT pi.*, pr.name AS product_name, pr.sku
             FROM purchase_items pi
             JOIN products pr ON pr.id = pi.product_id
             WHERE pi.purchase_id = ?
             ORDER BY pi.id ASC'
        );
        $items->execute([$id]);
        $purchase['items'] = $items->fetchAll();

        $payments = $pdo->prepare(
            'SELECT pay.*, pm.name AS method_name
             FROM payments pay
             LEFT JOIN payment_methods pm ON pm.id = pay.payment_method_id
             WHERE pay.payable_type = "purchase" AND pay.payable_id = ?
             ORDER BY pay.payment_date ASC, pay.id ASC'
        );
        $payments->execute([$id]);
        $purchase['payments'] = $payments->fetchAll();

        return $purchase;
    }

    public function create(array $d, int $userId): int
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $year = (int)date('Y', strtotime($d['purchase_date']));
            $invoiceNo = InvoiceNumber::next($pdo, 'PUR', $year);

            $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

            $stmt = $pdo->prepare(
                'INSERT INTO purchases (
                    invoice_no, supplier_id, user_id, currency_id, base_currency_id,
                    exchange_rate_to_base, purchase_date,
                    subtotal, discount_type, discount_value, discount_amount,
                    tax_rate, tax_amount, total,
                    subtotal_base, discount_amount_base, tax_amount_base, total_base,
                    paid_amount, due_amount, payment_status, status, notes
                ) VALUES (
                    :invoice_no, :supplier_id, :user_id, :currency_id, :base_currency_id,
                    :exchange_rate_to_base, :purchase_date,
                    :subtotal, :discount_type, :discount_value, :discount_amount,
                    :tax_rate, :tax_amount, :total,
                    :subtotal_base, :discount_amount_base, :tax_amount_base, :total_base,
                    :paid_amount, :due_amount, :payment_status, :status, :notes
                )'
            );
            $stmt->execute([
                'invoice_no' => $invoiceNo,
                'supplier_id' => $d['supplier_id'],
                'user_id' => $userId,
                'currency_id' => $d['currency_id'],
                'base_currency_id' => $baseId,
                'exchange_rate_to_base' => $d['exchange_rate_to_base'],
                'purchase_date' => $d['purchase_date'],
                'subtotal' => $d['subtotal'],
                'discount_type' => $d['discount_type'] ?: null,
                'discount_value' => $d['discount_value'] ?: null,
                'discount_amount' => $d['discount_amount'],
                'tax_rate' => $d['tax_rate'] ?: null,
                'tax_amount' => $d['tax_amount'],
                'total' => $d['total'],
                'subtotal_base' => $d['subtotal_base'],
                'discount_amount_base' => $d['discount_amount_base'],
                'tax_amount_base' => $d['tax_amount_base'],
                'total_base' => $d['total_base'],
                'paid_amount' => $d['paid_amount'],
                'due_amount' => $d['due_amount'],
                'payment_status' => $d['payment_status'],
                'status' => $d['status'],
                'notes' => $d['notes'] ?: null,
            ]);
            $purchaseId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare(
                'INSERT INTO purchase_items
                 (purchase_id, product_id, quantity, unit_cost, unit_cost_base,
                  discount_amount, tax_amount, line_total, line_total_base)
                 VALUES (:purchase_id, :product_id, :quantity, :unit_cost, :unit_cost_base,
                  :discount_amount, :tax_amount, :line_total, :line_total_base)'
            );
            $movStmt = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "purchase", ?, "purchase", ?, ?, ?, ?)'
            );
            $stockStmt = $pdo->prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?');

            foreach ($d['items'] as $it) {
                $itemStmt->execute([
                    'purchase_id' => $purchaseId,
                    'product_id' => $it['product_id'],
                    'quantity' => $it['quantity'],
                    'unit_cost' => $it['unit_cost'],
                    'unit_cost_base' => $it['unit_cost_base'],
                    'discount_amount' => $it['discount_amount'],
                    'tax_amount' => $it['tax_amount'],
                    'line_total' => $it['line_total'],
                    'line_total_base' => $it['line_total_base'],
                ]);

                $movStmt->execute([
                    $it['product_id'],
                    $it['quantity'],
                    $purchaseId,
                    $it['unit_cost_base'],
                    $userId,
                    "Purchase {$invoiceNo}",
                ]);

                $stockStmt->execute([$it['quantity'], $it['product_id']]);
            }

            if ($d['paid_amount'] > 0 && !empty($d['payment_method_id'])) {
                $payStmt = $pdo->prepare(
                    'INSERT INTO payments
                     (payable_type, payable_id, currency_id, amount,
                      exchange_rate_to_base, amount_in_transaction_currency, amount_base,
                      payment_method_id, wallet_provider_id, reference_no, payment_date, user_id, note)
                     VALUES ("purchase", ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(), ?, ?)'
                );
                $payStmt->execute([
                    $purchaseId,
                    $d['currency_id'],
                    $d['paid_amount'],
                    $d['exchange_rate_to_base'],
                    $d['paid_amount'],
                    round($d['paid_amount'] * $d['exchange_rate_to_base'], 2),
                    $d['payment_method_id'],
                    $userId,
                    "Initial payment for {$invoiceNo}",
                ]);
            }

            $pdo->commit();
            return $purchaseId;
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function addPayment(int $id, float $amount, int $methodId, int $userId, ?string $note = null): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $purchase = $this->findById($id);
            if (!$purchase) throw new \RuntimeException('Purchase not found');
            if ($purchase['status'] !== 'completed') throw new \RuntimeException('Cannot pay a cancelled purchase');

            $due = (float)$purchase['due_amount'];
            if ($amount <= 0) throw new \RuntimeException('Payment amount must be greater than 0');
            if ($amount > $due + 0.001) {
                throw new \RuntimeException('Payment exceeds the due amount (' . number_format($due, 2) . ')');
            }

            $rate = (float)$purchase['exchange_rate_to_base'];

            $payStmt = $pdo->prepare(
                'INSERT INTO payments
                 (payable_type, payable_id, currency_id, amount,
                  exchange_rate_to_base, amount_in_transaction_currency, amount_base,
                  payment_method_id, wallet_provider_id, reference_no, payment_date, user_id, note)
                 VALUES ("purchase", ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(), ?, ?)'
            );
            $payStmt->execute([
                $id,
                (int)$purchase['currency_id'],
                $amount,
                $rate,
                $amount,
                round($amount * $rate, 2),
                $methodId,
                $userId,
                $note ?: 'Additional payment',
            ]);

            $newPaid = round((float)$purchase['paid_amount'] + $amount, 2);
            $newDue = round((float)$purchase['total'] - $newPaid, 2);
            if ($newDue < 0) $newDue = 0.0;
            $newStatus = $newPaid <= 0 ? 'unpaid' : ($newDue <= 0.001 ? 'paid' : 'partial');

            $upd = $pdo->prepare(
                'UPDATE purchases SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?'
            );
            $upd->execute([$newPaid, $newDue, $newStatus, $id]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    public function cancel(int $id, int $userId): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $purchase = $this->findById($id);
            if (!$purchase) throw new \RuntimeException('Purchase not found');
            if ($purchase['status'] === 'cancelled') throw new \RuntimeException('Purchase already cancelled');

            $stockStmt = $pdo->prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?');
            $movStmt = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "correction", ?, "purchase_cancel", ?, ?, ?, ?)'
            );

            foreach ($purchase['items'] as $it) {
                $stockStmt->execute([$it['quantity'], $it['product_id']]);
                $movStmt->execute([
                    $it['product_id'],
                    -(float)$it['quantity'],
                    $id,
                    $it['unit_cost_base'],
                    $userId,
                    "Cancel purchase {$purchase['invoice_no']}",
                ]);
            }

            $upd = $pdo->prepare('UPDATE purchases SET status = "cancelled" WHERE id = ?');
            $upd->execute([$id]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}