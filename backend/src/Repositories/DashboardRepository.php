<?php
namespace App\Repositories;

use App\Core\Database;

class DashboardRepository
{
    public function totals(): array
    {
        $pdo = Database::pdo();

        $activeProducts = (int)$pdo->query(
            "SELECT COUNT(*) FROM products WHERE status = 'active'"
        )->fetchColumn();

        $totalCustomers = (int)$pdo->query(
            "SELECT COUNT(*) FROM customers WHERE status = 'active'"
        )->fetchColumn();

        $totalSuppliers = (int)$pdo->query(
            "SELECT COUNT(*) FROM suppliers WHERE status = 'active'"
        )->fetchColumn();

        $lowStock = (int)$pdo->query(
            "SELECT COUNT(*) FROM products
             WHERE status = 'active' AND stock_qty <= reorder_level"
        )->fetchColumn();

        $openReturns = (int)$pdo->query(
            "SELECT COUNT(*) FROM return_requests WHERE status = 'pending'"
        )->fetchColumn();

        $openVoids = (int)$pdo->query(
            "SELECT COUNT(*) FROM void_requests WHERE status = 'pending'"
        )->fetchColumn();

        return [
            'active_products' => $activeProducts,
            'total_customers' => $totalCustomers,
            'total_suppliers' => $totalSuppliers,
            'low_stock_count' => $lowStock,
            'pending_returns' => $openReturns,
            'pending_voids' => $openVoids,
        ];
    }

    public function salesSummary(): array
    {
        $pdo = Database::pdo();

        $today = $pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(total_base), 0) AS revenue, COALESCE(SUM(profit_base), 0) AS profit
             FROM sales
             WHERE status = 'completed' AND DATE(sale_date) = CURDATE()"
        )->fetch();

        $month = $pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(total_base), 0) AS revenue, COALESCE(SUM(profit_base), 0) AS profit
             FROM sales
             WHERE status = 'completed'
               AND YEAR(sale_date) = YEAR(CURDATE())
               AND MONTH(sale_date) = MONTH(CURDATE())"
        )->fetch();

        $allTime = $pdo->query(
            "SELECT COUNT(*) AS cnt, COALESCE(SUM(total_base), 0) AS revenue, COALESCE(SUM(profit_base), 0) AS profit
             FROM sales WHERE status = 'completed'"
        )->fetch();

        return [
            'today' => [
                'count' => (int)$today['cnt'],
                'revenue' => (float)$today['revenue'],
                'profit' => (float)$today['profit'],
            ],
            'month' => [
                'count' => (int)$month['cnt'],
                'revenue' => (float)$month['revenue'],
                'profit' => (float)$month['profit'],
            ],
            'all_time' => [
                'count' => (int)$allTime['cnt'],
                'revenue' => (float)$allTime['revenue'],
                'profit' => (float)$allTime['profit'],
            ],
        ];
    }

    public function salesTrend(int $days = 14): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "SELECT DATE(sale_date) AS d,
                    COUNT(*) AS count,
                    COALESCE(SUM(total_base), 0) AS revenue,
                    COALESCE(SUM(profit_base), 0) AS profit
             FROM sales
             WHERE status = 'completed' AND sale_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
             GROUP BY DATE(sale_date)
             ORDER BY d ASC"
        );
        $stmt->bindValue('days', $days, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        // Fill missing days with zeros
        $byDate = [];
        foreach ($rows as $r) $byDate[$r['d']] = $r;

        $result = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = date('Y-m-d', strtotime("-$i days"));
            $row = $byDate[$date] ?? null;
            $result[] = [
                'date' => $date,
                'count' => $row ? (int)$row['count'] : 0,
                'revenue' => $row ? (float)$row['revenue'] : 0.0,
                'profit' => $row ? (float)$row['profit'] : 0.0,
            ];
        }
        return $result;
    }

    public function topProducts(int $limit = 5, int $days = 30): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "SELECT p.id, p.name, p.sku,
                    SUM(si.quantity) AS qty_sold,
                    SUM(si.line_total_base) AS revenue_base
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id AND s.status = 'completed'
             JOIN products p ON p.id = si.product_id
             WHERE s.sale_date >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
             GROUP BY p.id, p.name, p.sku
             ORDER BY revenue_base DESC
             LIMIT :lim"
        );
        $stmt->bindValue('days', $days, \PDO::PARAM_INT);
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function recentSales(int $limit = 5): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "SELECT s.id, s.invoice_no, s.sale_date, s.total, s.total_base,
                    s.payment_status, s.status,
                    c.name AS customer_name,
                    cur.symbol AS currency_symbol, cur.code AS currency_code,
                    u.name AS user_name
             FROM sales s
             LEFT JOIN customers c ON c.id = s.customer_id
             JOIN currencies cur ON cur.id = s.currency_id
             JOIN users u ON u.id = s.user_id
             ORDER BY s.created_at DESC
             LIMIT :lim"
        );
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    public function lowStockTop(int $limit = 5): array
    {
        $pdo = Database::pdo();
        $stmt = $pdo->prepare(
            "SELECT p.id, p.name, p.sku, p.unit, p.stock_qty, p.reorder_level,
                    c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.status = 'active' AND p.stock_qty <= p.reorder_level
             ORDER BY (p.stock_qty - p.reorder_level) ASC
             LIMIT :lim"
        );
        $stmt->bindValue('lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}