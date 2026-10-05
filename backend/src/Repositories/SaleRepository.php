<?php
namespace App\Repositories;

use App\Core\Database;
use App\Core\InvoiceNumber;

class SaleRepository
{
    public function paginate(int $page, int $perPage, array $f): array
    {
        $where = [];
        $params = [];
        if (!empty($f['search'])) {
            $where[] = '(s.invoice_no LIKE :s OR c.name LIKE :s)';
            $params['s'] = '%' . $f['search'] . '%';
        }
        if (!empty($f['customer_id'])) {
            $where[] = 's.customer_id = :cid';
            $params['cid'] = (int)$f['customer_id'];
        }
        if (!empty($f['status'])) {
            $where[] = 's.status = :st';
            $params['st'] = $f['status'];
        }
        if (!empty($f['payment_status'])) {
            $where[] = 's.payment_status = :ps';
            $params['ps'] = $f['payment_status'];
        }
        if (!empty($f['from'])) {
            $where[] = 's.sale_date >= :from';
            $params['from'] = $f['from'];
        }
        if (!empty($f['to'])) {
            $where[] = 's.sale_date <= :to';
            $params['to'] = $f['to'];
        }
        $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

        $pdo = Database::pdo();
        $count = $pdo->prepare(
            "SELECT COUNT(*) FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             $whereSql"
        );
        $count->execute($params);
        $total = (int)$count->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT s.*, c.name AS customer_name,
                       cur.code AS currency_code, cur.symbol AS currency_symbol,
                       u.name AS user_name
                FROM sales s
                LEFT JOIN customers c ON c.id = s.customer_id
                JOIN currencies cur ON cur.id = s.currency_id
                JOIN users u ON u.id = s.user_id
                $whereSql
                ORDER BY s.created_at DESC
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
            'SELECT s.*, c.name AS customer_name,
                    c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address,
                    cur.code AS currency_code, cur.symbol AS currency_symbol,
                    b.code AS base_code, b.symbol AS base_symbol,
                    u.name AS user_name
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN currencies cur ON cur.id = s.currency_id
             JOIN currencies b ON b.id = s.base_currency_id
             JOIN users u ON u.id = s.user_id
             WHERE s.id = ?'
        );
        $stmt->execute([$id]);
        $sale = $stmt->fetch();
        if (!$sale) return null;

        $items = $pdo->prepare(
            'SELECT si.*, p.name AS product_name, p.sku
             FROM sale_items si
             JOIN products p ON p.id = si.product_id
             WHERE si.sale_id = ?
             ORDER BY si.id ASC'
        );
        $items->execute([$id]);
        $sale['items'] = $items->fetchAll();

        $payments = $pdo->prepare(
            'SELECT pay.*, pm.name AS method_name
             FROM payments pay
             LEFT JOIN payment_methods pm ON pm.id = pay.payment_method_id
             WHERE pay.payable_type = "sale" AND pay.payable_id = ?
             ORDER BY pay.payment_date ASC, pay.id ASC'
        );
        $payments->execute([$id]);
        $sale['payments'] = $payments->fetchAll();

        return $sale;
    }

    public function create(array $d, int $userId): int
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $year = (int)date('Y', strtotime($d['sale_date']));
            $invoiceNo = InvoiceNumber::next($pdo, 'INV', $year);

            $baseId = (int)$pdo->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();

            $stmt = $pdo->prepare(
                'INSERT INTO sales (
                    invoice_no, customer_id, user_id, currency_id, base_currency_id,
                    exchange_rate_to_base, sale_date,
                    subtotal, discount_type, discount_value, discount_amount,
                    tax_rate, tax_amount, total,
                    subtotal_base, discount_amount_base, tax_amount_base, total_base,
                    cogs_base, profit_base,
                    paid_amount, due_amount, payment_status, status, notes
                ) VALUES (
                    :invoice_no, :customer_id, :user_id, :currency_id, :base_currency_id,
                    :exchange_rate_to_base, :sale_date,
                    :subtotal, :discount_type, :discount_value, :discount_amount,
                    :tax_rate, :tax_amount, :total,
                    :subtotal_base, :discount_amount_base, :tax_amount_base, :total_base,
                    :cogs_base, :profit_base,
                    :paid_amount, :due_amount, :payment_status, :status, :notes
                )'
            );
            $stmt->execute([
                'invoice_no' => $invoiceNo,
                'customer_id' => $d['customer_id'] ?: null,
                'user_id' => $userId,
                'currency_id' => $d['currency_id'],
                'base_currency_id' => $baseId,
                'exchange_rate_to_base' => $d['exchange_rate_to_base'],
                'sale_date' => $d['sale_date'],
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
                'cogs_base' => $d['cogs_base'],
                'profit_base' => $d['profit_base'],
                'paid_amount' => $d['paid_amount'],
                'due_amount' => $d['due_amount'],
                'payment_status' => $d['payment_status'],
                'status' => 'completed',
                'notes' => $d['notes'] ?: null,
            ]);
            $saleId = (int)$pdo->lastInsertId();

            $itemStmt = $pdo->prepare(
                'INSERT INTO sale_items
                 (sale_id, product_id, quantity, returned_quantity,
                  unit_price, unit_price_base, discount_amount, tax_amount,
                  line_total, line_total_base, cogs_base)
                 VALUES (:sale_id, :product_id, :quantity, 0,
                  :unit_price, :unit_price_base, :discount_amount, :tax_amount,
                  :line_total, :line_total_base, :cogs_base)'
            );
            $movStmt = $pdo->prepare(
                'INSERT INTO stock_movements
                 (product_id, type, quantity, reference_type, reference_id, unit_cost_base, user_id, note)
                 VALUES (?, "sale", ?, "sale", ?, ?, ?, ?)'
            );
            $stockStmt = $pdo->prepare(
                'UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?'
            );

            foreach ($d['items'] as $it) {
                $itemStmt->execute([
                    'sale_id' => $saleId,
                    'product_id' => $it['product_id'],
                    'quantity' => $it['quantity'],
                    'unit_price' => $it['unit_price'],
                    'unit_price_base' => $it['unit_price_base'],
                    'discount_amount' => $it['discount_amount'],
                    'tax_amount' => $it['tax_amount'],
                    'line_total' => $it['line_total'],
                    'line_total_base' => $it['line_total_base'],
                    'cogs_base' => $it['cogs_base'],
                ]);

                $movStmt->execute([
                    $it['product_id'],
                    -(float)$it['quantity'],
                    $saleId,
                    $it['unit_price_base'],
                    $userId,
                    "Sale {$invoiceNo}",
                ]);

                $stockStmt->execute([$it['quantity'], $it['product_id']]);
            }

            if ($d['paid_amount'] > 0 && !empty($d['payment_method_id'])) {
                $payStmt = $pdo->prepare(
                    'INSERT INTO payments
                     (payable_type, payable_id, currency_id, amount,
                      exchange_rate_to_base, amount_in_transaction_currency, amount_base,
                      payment_method_id, wallet_provider_id, reference_no, payment_date, user_id, note)
                     VALUES ("sale", ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(), ?, ?)'
                );
                $payStmt->execute([
                    $saleId,
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
            return $saleId;
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
            $sale = $this->findById($id);
            if (!$sale) throw new \RuntimeException('Sale not found');
            if ($sale['status'] !== 'completed') throw new \RuntimeException('Cannot pay a voided sale');

            $due = (float)$sale['due_amount'];
            if ($amount <= 0) throw new \RuntimeException('Payment amount must be greater than 0');
            if ($amount > $due + 0.001) {
                throw new \RuntimeException('Payment exceeds the due amount (' . number_format($due, 2) . ')');
            }

            $rate = (float)$sale['exchange_rate_to_base'];

            $payStmt = $pdo->prepare(
                'INSERT INTO payments
                 (payable_type, payable_id, currency_id, amount,
                  exchange_rate_to_base, amount_in_transaction_currency, amount_base,
                  payment_method_id, wallet_provider_id, reference_no, payment_date, user_id, note)
                 VALUES ("sale", ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NOW(), ?, ?)'
            );
            $payStmt->execute([
                $id,
                (int)$sale['currency_id'],
                $amount,
                $rate,
                $amount,
                round($amount * $rate, 2),
                $methodId,
                $userId,
                $note ?: 'Additional payment',
            ]);

            $newPaid = round((float)$sale['paid_amount'] + $amount, 2);
            $newDue = round((float)$sale['total'] - $newPaid, 2);
            if ($newDue < 0) $newDue = 0.0;
            $newStatus = $newPaid <= 0 ? 'unpaid' : ($newDue <= 0.001 ? 'paid' : 'partial');

            $upd = $pdo->prepare(
                'UPDATE sales SET paid_amount = ?, due_amount = ?, payment_status = ? WHERE id = ?'
            );
            $upd->execute([$newPaid, $newDue, $newStatus, $id]);

            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}