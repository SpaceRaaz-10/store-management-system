<?php
namespace App\Repositories;

use App\Core\Database;

class ReportRepository
{
    private function buildDateWhere(array $f, string $dateCol, array &$params): string
    {
        $where = [];
        if (!empty($f['from'])) { $where[] = "$dateCol >= :from"; $params['from'] = $f['from']; }
        if (!empty($f['to']))   { $where[] = "$dateCol <= :to";   $params['to'] = $f['to']; }
        return $where ? (' AND ' . implode(' AND ', $where)) : '';
    }

    // ============ 1. SALES REPORT ============
    public function salesReport(array $f): array
    {
        $params = [];
        $where = "WHERE s.status IN ('completed','partially_returned','returned')";
        $where .= $this->buildDateWhere($f, 's.sale_date', $params);

        $groupBy = $f['group_by'] ?? 'day';
        $groupCol = match ($groupBy) {
            'month' => "DATE_FORMAT(s.sale_date, '%Y-%m')",
            'year'  => "YEAR(s.sale_date)",
            'week'  => "DATE_FORMAT(s.sale_date, '%x-W%v')",
            default => "s.sale_date",
        };

        if (!empty($f['currency_id'])) {
            $where .= " AND s.currency_id = :cur";
            $params['cur'] = (int)$f['currency_id'];
        }

        $pdo = Database::pdo();
        $sql = "SELECT $groupCol AS period,
                       COUNT(*) AS order_count,
                       COALESCE(SUM(s.subtotal_base), 0) AS subtotal_base,
                       COALESCE(SUM(s.discount_amount_base), 0) AS discount_base,
                       COALESCE(SUM(s.tax_amount_base), 0) AS tax_base,
                       COALESCE(SUM(s.total_base), 0) AS revenue_base,
                       COALESCE(SUM(s.profit_base), 0) AS profit_base
                FROM sales s
                $where
                GROUP BY period
                ORDER BY period DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $totals = [
            'order_count' => 0,
            'revenue_base' => 0.0,
            'profit_base' => 0.0,
            'discount_base' => 0.0,
            'tax_base' => 0.0,
        ];
        foreach ($rows as $r) {
            $totals['order_count'] += (int)$r['order_count'];
            $totals['revenue_base'] += (float)$r['revenue_base'];
            $totals['profit_base'] += (float)$r['profit_base'];
            $totals['discount_base'] += (float)$r['discount_base'];
            $totals['tax_base'] += (float)$r['tax_base'];
        }

        return ['rows' => $rows, 'totals' => $totals];
    }

    // ============ 2. PURCHASE REPORT ============
    public function purchaseReport(array $f): array
    {
        $params = [];
        $where = "WHERE p.status != 'draft'";
        $where .= $this->buildDateWhere($f, 'p.purchase_date', $params);

        $groupBy = $f['group_by'] ?? 'day';
        $groupCol = match ($groupBy) {
            'month' => "DATE_FORMAT(p.purchase_date, '%Y-%m')",
            'year'  => "YEAR(p.purchase_date)",
            'week'  => "DATE_FORMAT(p.purchase_date, '%x-W%v')",
            default => "p.purchase_date",
        };

        $pdo = Database::pdo();
        $sql = "SELECT $groupCol AS period,
                       COUNT(*) AS order_count,
                       COALESCE(SUM(p.total_base), 0) AS total_base,
                       COALESCE(SUM(p.paid_amount * p.exchange_rate_to_base), 0) AS paid_base,
                       COALESCE(SUM(p.due_amount * p.exchange_rate_to_base), 0) AS due_base
                FROM purchases p
                $where
                GROUP BY period
                ORDER BY period DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $totals = ['order_count' => 0, 'total_base' => 0.0, 'paid_base' => 0.0, 'due_base' => 0.0];
        foreach ($rows as $r) {
            $totals['order_count'] += (int)$r['order_count'];
            $totals['total_base'] += (float)$r['total_base'];
            $totals['paid_base'] += (float)$r['paid_base'];
            $totals['due_base'] += (float)$r['due_base'];
        }

        return ['rows' => $rows, 'totals' => $totals];
    }

    // ============ 3. INVENTORY / STOCK REPORT ============
    public function inventoryReport(array $f): array
    {
        $params = [];
        $where = "WHERE p.status = 'active'";
        if (!empty($f['category_id'])) {
            $where .= " AND p.category_id = :cid";
            $params['cid'] = (int)$f['category_id'];
        }
        if (!empty($f['search'])) {
            $where .= " AND (p.name LIKE :s OR p.sku LIKE :s)";
            $params['s'] = '%' . $f['search'] . '%';
        }

        $pdo = Database::pdo();
        $sql = "SELECT p.id, p.name, p.sku, p.barcode, p.unit,
                       p.cost_price, p.selling_price,
                       p.stock_qty, p.reorder_level,
                       (p.stock_qty * p.cost_price) AS stock_value_cost,
                       (p.stock_qty * p.selling_price) AS stock_value_retail,
                       c.name AS category_name,
                       CASE WHEN p.stock_qty <= p.reorder_level THEN 'low' ELSE 'ok' END AS stock_status
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                $where
                ORDER BY p.name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $totals = ['item_count' => count($rows), 'total_stock_value_cost' => 0.0, 'total_stock_value_retail' => 0.0];
        foreach ($rows as $r) {
            $totals['total_stock_value_cost'] += (float)$r['stock_value_cost'];
            $totals['total_stock_value_retail'] += (float)$r['stock_value_retail'];
        }

        return ['rows' => $rows, 'totals' => $totals];
    }

    // ============ 4. LOW STOCK REPORT ============
    public function lowStockReport(array $f): array
    {
        $params = [];
        $where = "WHERE p.status = 'active' AND p.stock_qty <= p.reorder_level";
        if (!empty($f['category_id'])) {
            $where .= " AND p.category_id = :cid";
            $params['cid'] = (int)$f['category_id'];
        }

        $pdo = Database::pdo();
        $sql = "SELECT p.id, p.name, p.sku, p.unit,
                       p.stock_qty, p.reorder_level,
                       (p.reorder_level - p.stock_qty) AS shortfall,
                       c.name AS category_name,
                       s.name AS default_supplier_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                LEFT JOIN (
                    SELECT pi.product_id, MAX(pu.supplier_id) AS supplier_id
                    FROM purchase_items pi
                    JOIN purchases pu ON pu.id = pi.purchase_id
                    GROUP BY pi.product_id
                ) lastp ON lastp.product_id = p.id
                LEFT JOIN suppliers s ON s.id = lastp.supplier_id
                $where
                ORDER BY shortfall DESC, p.name ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return ['rows' => $rows, 'totals' => ['item_count' => count($rows)]];
    }

    // ============ 5. REVENUE / PROFIT SUMMARY ============
    public function revenueProfit(array $f): array
    {
        $params = [];
        $where = "WHERE s.status = 'completed'";
        $where .= $this->buildDateWhere($f, 's.sale_date', $params);

        $pdo = Database::pdo();

        // Overall summary
        $sql = "SELECT COUNT(*) AS order_count,
                       COALESCE(SUM(s.subtotal_base), 0) AS subtotal_base,
                       COALESCE(SUM(s.discount_amount_base), 0) AS discount_base,
                       COALESCE(SUM(s.tax_amount_base), 0) AS tax_base,
                       COALESCE(SUM(s.total_base), 0) AS revenue_base,
                       COALESCE(SUM(s.cogs_base), 0) AS cogs_base,
                       COALESCE(SUM(s.profit_base), 0) AS profit_base
                FROM sales s $where";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $summary = $stmt->fetch();

        $revenue = (float)$summary['revenue_base'];
        $profit = (float)$summary['profit_base'];
        $summary['margin_percent'] = $revenue > 0 ? round(($profit / $revenue) * 100, 2) : 0.0;

        // By currency breakdown (raw amounts, not converted)
        $byCurrency = $pdo->prepare(
            "SELECT c.code, c.symbol,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(s.total), 0) AS revenue_original,
                    COALESCE(SUM(s.total_base), 0) AS revenue_base
             FROM sales s
             JOIN currencies c ON c.id = s.currency_id
             $where
             GROUP BY c.code, c.symbol
             ORDER BY revenue_base DESC"
        );
        $byCurrency->execute($params);
        $currencyRows = $byCurrency->fetchAll();

        // Top-level breakdown by month
        $byMonth = $pdo->prepare(
            "SELECT DATE_FORMAT(s.sale_date, '%Y-%m') AS period,
                    COUNT(*) AS order_count,
                    COALESCE(SUM(s.total_base), 0) AS revenue_base,
                    COALESCE(SUM(s.cogs_base), 0) AS cogs_base,
                    COALESCE(SUM(s.profit_base), 0) AS profit_base
             FROM sales s
             $where
             GROUP BY period
             ORDER BY period DESC"
        );
        $byMonth->execute($params);
        $monthRows = $byMonth->fetchAll();

        return [
            'summary' => $summary,
            'by_currency' => $currencyRows,
            'by_month' => $monthRows,
        ];
    }

    // ============ 6. TRANSACTION / SALES HISTORY ============
    public function transactions(array $f, int $page, int $perPage): array
    {
        $params = [];
        $where = "WHERE 1=1";
        if (!empty($f['from'])) { $where .= " AND DATE(t.txn_date) >= :from"; $params['from'] = $f['from']; }
        if (!empty($f['to']))   { $where .= " AND DATE(t.txn_date) <= :to";   $params['to'] = $f['to']; }
        if (!empty($f['type'])) { $where .= " AND t.txn_type = :type";        $params['type'] = $f['type']; }
        if (!empty($f['search'])) {
            $where .= " AND (t.reference LIKE :s OR t.party_name LIKE :s)";
            $params['s'] = '%' . $f['search'] . '%';
        }

        // UNION query combining sales + purchases
        $unionSql = "
            SELECT 'sale' AS txn_type, s.id AS ref_id, s.invoice_no AS reference,
                   s.sale_date AS txn_date, s.total AS amount, s.total_base AS amount_base,
                   s.payment_status, s.status,
                   COALESCE(c.name, 'Walk-in') AS party_name,
                   cur.symbol AS currency_symbol, cur.code AS currency_code,
                   u.name AS user_name
            FROM sales s
            LEFT JOIN customers c ON c.id = s.customer_id
            JOIN currencies cur ON cur.id = s.currency_id
            JOIN users u ON u.id = s.user_id
            UNION ALL
            SELECT 'purchase' AS txn_type, p.id AS ref_id, p.invoice_no AS reference,
                   p.purchase_date AS txn_date, p.total AS amount, p.total_base AS amount_base,
                   p.payment_status, p.status,
                   s.name AS party_name,
                   cur.symbol AS currency_symbol, cur.code AS currency_code,
                   u.name AS user_name
            FROM purchases p
            JOIN suppliers s ON s.id = p.supplier_id
            JOIN currencies cur ON cur.id = p.currency_id
            JOIN users u ON u.id = p.user_id
        ";

        $pdo = Database::pdo();
        $countSql = "SELECT COUNT(*) FROM ($unionSql) t $where";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        $offset = ($page - 1) * $perPage;
        $sql = "SELECT * FROM ($unionSql) t $where ORDER BY txn_date DESC, ref_id DESC LIMIT :lim OFFSET :off";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $perPage, \PDO::PARAM_INT);
        $stmt->bindValue('off', $offset, \PDO::PARAM_INT);
        $stmt->execute();

        return ['rows' => $stmt->fetchAll(), 'total' => $total];
    }

    // ============ 7. PRODUCT-WISE SALES ============
    public function productSales(array $f, int $limit = 100): array
    {
        $params = [];
        $where = "WHERE s.status IN ('completed','partially_returned','returned')";
        $where .= $this->buildDateWhere($f, 's.sale_date', $params);
        if (!empty($f['category_id'])) {
            $where .= " AND p.category_id = :cid";
            $params['cid'] = (int)$f['category_id'];
        }

        $pdo = Database::pdo();
        $sql = "SELECT p.id, p.name, p.sku,
                       c.name AS category_name,
                       SUM(si.quantity) AS qty_sold,
                       SUM(si.returned_quantity) AS qty_returned,
                       SUM(si.line_total_base) AS revenue_base,
                       SUM(si.cogs_base) AS cogs_base,
                       (SUM(si.line_total_base) - SUM(si.cogs_base)) AS profit_base
                FROM sale_items si
                JOIN sales s ON s.id = si.sale_id
                JOIN products p ON p.id = si.product_id
                LEFT JOIN categories c ON c.id = p.category_id
                $where
                GROUP BY p.id, p.name, p.sku, c.name
                ORDER BY revenue_base DESC
                LIMIT :lim";
        $stmt = $pdo->prepare($sql);
        foreach ($params as $k => $v) $stmt->bindValue($k, $v);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $totals = ['qty_sold' => 0.0, 'revenue_base' => 0.0, 'profit_base' => 0.0];
        foreach ($rows as $r) {
            $totals['qty_sold'] += (float)$r['qty_sold'];
            $totals['revenue_base'] += (float)$r['revenue_base'];
            $totals['profit_base'] += (float)$r['profit_base'];
        }

        return ['rows' => $rows, 'totals' => $totals];
    }
}