<?php
namespace App\Controllers;

use App\Core\Csv;
use App\Core\Excel;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\ReportRepository;

class ReportController
{
    private ReportRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new ReportRepository();
    }

    private function filters(): array
    {
        return [
            'from' => trim((string)Request::query('from', '')),
            'to' => trim((string)Request::query('to', '')),
            'group_by' => trim((string)Request::query('group_by', 'day')),
            'category_id' => Request::query('category_id'),
            'currency_id' => Request::query('currency_id'),
            'type' => trim((string)Request::query('type', '')),
            'search' => trim((string)Request::query('search', '')),
        ];
    }

    private function format(): string
    {
        return strtolower((string)Request::query('format', 'json'));
    }

    private function periodLabel(array $f): string
    {
        $from = $f['from'] ?? '';
        $to = $f['to'] ?? '';
        if ($from && $to) return "$from to $to";
        if ($from) return "From $from";
        if ($to) return "Until $to";
        return 'All time';
    }

    // ============ 1. SALES ============
    public function sales(): void
    {
        $f = $this->filters();
        $result = $this->repo->salesReport($f);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'Period' => $r['period'],
                'Orders' => $r['order_count'],
                'Subtotal (NPR)' => number_format((float)$r['subtotal_base'], 2, '.', ''),
                'Discount (NPR)' => number_format((float)$r['discount_base'], 2, '.', ''),
                'Tax (NPR)' => number_format((float)$r['tax_base'], 2, '.', ''),
                'Revenue (NPR)' => number_format((float)$r['revenue_base'], 2, '.', ''),
                'Profit (NPR)' => number_format((float)$r['profit_base'], 2, '.', ''),
            ], $result['rows']);
            Csv::download('sales-report-' . date('Ymd-His') . '.csv', array_keys($rows[0] ?? ['Period'=>1,'Orders'=>1,'Subtotal (NPR)'=>1,'Discount (NPR)'=>1,'Tax (NPR)'=>1,'Revenue (NPR)'=>1,'Profit (NPR)'=>1]), $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'period', 'label' => 'Period', 'align' => 'left'],
                ['key' => 'order_count', 'label' => 'Orders', 'align' => 'right', 'format' => 'int'],
                ['key' => 'subtotal_base', 'label' => 'Subtotal (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'discount_base', 'label' => 'Discount (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'tax_base', 'label' => 'Tax (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'revenue_base', 'label' => 'Revenue (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'profit_base', 'label' => 'Profit (NPR)', 'align' => 'right', 'format' => 'money'],
            ];
            $totalsRow = [
                'period' => 'TOTAL',
                'order_count' => $result['totals']['order_count'],
                'subtotal_base' => $result['totals']['revenue_base'], // fallback
                'discount_base' => $result['totals']['discount_base'],
                'tax_base' => $result['totals']['tax_base'],
                'revenue_base' => $result['totals']['revenue_base'],
                'profit_base' => $result['totals']['profit_base'],
            ];
            Excel::download(
                'sales-report-' . date('Ymd-His') . '.xlsx',
                'Sales Report',
                [
                    'Period' => $this->periodLabel($f),
                    'Grouped by' => ucfirst($f['group_by']),
                    'Currency' => 'NPR (base, equivalent)',
                ],
                $columns,
                $result['rows'],
                $totalsRow
            );
        }

        Response::ok($result, 'Sales report');
    }

    // ============ 2. PURCHASES ============
    public function purchases(): void
    {
        $f = $this->filters();
        $result = $this->repo->purchaseReport($f);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'Period' => $r['period'],
                'Orders' => $r['order_count'],
                'Total (NPR)' => number_format((float)$r['total_base'], 2, '.', ''),
                'Paid (NPR)' => number_format((float)$r['paid_base'], 2, '.', ''),
                'Due (NPR)' => number_format((float)$r['due_base'], 2, '.', ''),
            ], $result['rows']);
            Csv::download('purchase-report-' . date('Ymd-His') . '.csv', ['Period','Orders','Total (NPR)','Paid (NPR)','Due (NPR)'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'period', 'label' => 'Period', 'align' => 'left'],
                ['key' => 'order_count', 'label' => 'Orders', 'align' => 'right', 'format' => 'int'],
                ['key' => 'total_base', 'label' => 'Total (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'paid_base', 'label' => 'Paid (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'due_base', 'label' => 'Due (NPR)', 'align' => 'right', 'format' => 'money'],
            ];
            $totalsRow = [
                'period' => 'TOTAL',
                'order_count' => $result['totals']['order_count'],
                'total_base' => $result['totals']['total_base'],
                'paid_base' => $result['totals']['paid_base'],
                'due_base' => $result['totals']['due_base'],
            ];
            Excel::download(
                'purchase-report-' . date('Ymd-His') . '.xlsx',
                'Purchase Report',
                [
                    'Period' => $this->periodLabel($f),
                    'Grouped by' => ucfirst($f['group_by']),
                    'Currency' => 'NPR (base, equivalent)',
                ],
                $columns,
                $result['rows'],
                $totalsRow
            );
        }

        Response::ok($result, 'Purchase report');
    }

    // ============ 3. INVENTORY ============
    public function inventory(): void
    {
        $f = $this->filters();
        $result = $this->repo->inventoryReport($f);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'SKU' => $r['sku'],
                'Name' => $r['name'],
                'Category' => $r['category_name'] ?? '',
                'Unit' => $r['unit'],
                'Stock' => $r['stock_qty'],
                'Reorder' => $r['reorder_level'],
                'Cost' => number_format((float)$r['cost_price'], 2, '.', ''),
                'Selling' => number_format((float)$r['selling_price'], 2, '.', ''),
                'Value (Cost)' => number_format((float)$r['stock_value_cost'], 2, '.', ''),
                'Value (Retail)' => number_format((float)$r['stock_value_retail'], 2, '.', ''),
                'Status' => $r['stock_status'],
            ], $result['rows']);
            Csv::download('inventory-report-' . date('Ymd-His') . '.csv', ['SKU','Name','Category','Unit','Stock','Reorder','Cost','Selling','Value (Cost)','Value (Retail)','Status'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'sku', 'label' => 'SKU', 'align' => 'left'],
                ['key' => 'name', 'label' => 'Product', 'align' => 'left'],
                ['key' => 'category_name', 'label' => 'Category', 'align' => 'left'],
                ['key' => 'unit', 'label' => 'Unit', 'align' => 'center'],
                ['key' => 'stock_qty', 'label' => 'Stock', 'align' => 'right', 'format' => 'number'],
                ['key' => 'reorder_level', 'label' => 'Reorder', 'align' => 'right', 'format' => 'number'],
                ['key' => 'cost_price', 'label' => 'Cost', 'align' => 'right', 'format' => 'money'],
                ['key' => 'selling_price', 'label' => 'Selling', 'align' => 'right', 'format' => 'money'],
                ['key' => 'stock_value_cost', 'label' => 'Value (Cost)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'stock_value_retail', 'label' => 'Value (Retail)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'stock_status', 'label' => 'Status', 'align' => 'center'],
            ];
            $totalsRow = [
                'sku' => 'TOTAL',
                'name' => $result['totals']['item_count'] . ' items',
                'category_name' => '',
                'unit' => '',
                'stock_qty' => '',
                'reorder_level' => '',
                'cost_price' => '',
                'selling_price' => '',
                'stock_value_cost' => $result['totals']['total_stock_value_cost'],
                'stock_value_retail' => $result['totals']['total_stock_value_retail'],
                'stock_status' => '',
            ];
            Excel::download(
                'inventory-report-' . date('Ymd-His') . '.xlsx',
                'Inventory / Stock Report',
                [
                    'As of' => date('Y-m-d H:i'),
                    'Category' => $f['category_id'] ? "Category #{$f['category_id']}" : 'All categories',
                    'Currency' => 'NPR',
                ],
                $columns,
                $result['rows'],
                $totalsRow
            );
        }

        Response::ok($result, 'Inventory report');
    }

    // ============ 4. LOW STOCK ============
    public function lowStock(): void
    {
        $f = $this->filters();
        $result = $this->repo->lowStockReport($f);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'SKU' => $r['sku'],
                'Name' => $r['name'],
                'Category' => $r['category_name'] ?? '',
                'Stock' => $r['stock_qty'],
                'Reorder' => $r['reorder_level'],
                'Shortfall' => $r['shortfall'],
                'Unit' => $r['unit'],
                'Last Supplier' => $r['default_supplier_name'] ?? '',
            ], $result['rows']);
            Csv::download('low-stock-report-' . date('Ymd-His') . '.csv', ['SKU','Name','Category','Stock','Reorder','Shortfall','Unit','Last Supplier'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'sku', 'label' => 'SKU', 'align' => 'left'],
                ['key' => 'name', 'label' => 'Product', 'align' => 'left'],
                ['key' => 'category_name', 'label' => 'Category', 'align' => 'left'],
                ['key' => 'stock_qty', 'label' => 'Current Stock', 'align' => 'right', 'format' => 'number'],
                ['key' => 'reorder_level', 'label' => 'Reorder Level', 'align' => 'right', 'format' => 'number'],
                ['key' => 'shortfall', 'label' => 'Shortfall', 'align' => 'right', 'format' => 'number'],
                ['key' => 'unit', 'label' => 'Unit', 'align' => 'center'],
                ['key' => 'default_supplier_name', 'label' => 'Last Supplier', 'align' => 'left'],
            ];
            $totalsRow = [
                'sku' => 'TOTAL',
                'name' => $result['totals']['item_count'] . ' products low',
                'category_name' => '',
                'stock_qty' => '',
                'reorder_level' => '',
                'shortfall' => '',
                'unit' => '',
                'default_supplier_name' => '',
            ];
            Excel::download(
                'low-stock-report-' . date('Ymd-His') . '.xlsx',
                'Low Stock Report',
                [
                    'As of' => date('Y-m-d H:i'),
                    'Filter' => $f['category_id'] ? "Category #{$f['category_id']}" : 'All categories',
                ],
                $columns,
                $result['rows'],
                $totalsRow
            );
        }

        Response::ok($result, 'Low stock report');
    }

    // ============ 5. REVENUE / PROFIT ============
    public function revenueProfit(): void
    {
        $f = $this->filters();
        $result = $this->repo->revenueProfit($f);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'Month' => $r['period'],
                'Orders' => $r['order_count'],
                'Revenue (NPR)' => number_format((float)$r['revenue_base'], 2, '.', ''),
                'COGS (NPR)' => number_format((float)$r['cogs_base'], 2, '.', ''),
                'Profit (NPR)' => number_format((float)$r['profit_base'], 2, '.', ''),
            ], $result['by_month']);
            Csv::download('revenue-profit-' . date('Ymd-His') . '.csv', ['Month','Orders','Revenue (NPR)','COGS (NPR)','Profit (NPR)'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'period', 'label' => 'Month', 'align' => 'left'],
                ['key' => 'order_count', 'label' => 'Orders', 'align' => 'right', 'format' => 'int'],
                ['key' => 'revenue_base', 'label' => 'Revenue (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'cogs_base', 'label' => 'COGS (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'profit_base', 'label' => 'Profit (NPR)', 'align' => 'right', 'format' => 'money'],
            ];
            $totalsRow = [
                'period' => 'TOTAL',
                'order_count' => $result['summary']['order_count'] ?? '',
                'revenue_base' => $result['summary']['revenue_base'] ?? '',
                'cogs_base' => $result['summary']['cogs_base'] ?? '',
                'profit_base' => $result['summary']['profit_base'] ?? '',
            ];
            $summary = $result['summary'];
            $margin = $summary['margin_percent'] ?? 0;
            Excel::download(
                'revenue-profit-' . date('Ymd-His') . '.xlsx',
                'Revenue / Profit Summary',
                [
                    'Period' => $this->periodLabel($f),
                    'Total Orders' => $summary['order_count'] ?? 0,
                    'Total Revenue' => 'NPR ' . number_format((float)($summary['revenue_base'] ?? 0), 2),
                    'Total Profit' => 'NPR ' . number_format((float)($summary['profit_base'] ?? 0), 2),
                    'Margin' => $margin . '%',
                ],
                $columns,
                $result['by_month'],
                $totalsRow
            );
        }

        Response::ok($result, 'Revenue / profit report');
    }

    // ============ 6. TRANSACTIONS ============
    public function transactions(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(500, max(1, (int)Request::query('per_page', 50)));
        $f = $this->filters();
        $result = $this->repo->transactions($f, $page, $perPage);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'Date' => $r['txn_date'],
                'Type' => ucfirst($r['txn_type']),
                'Reference' => $r['reference'],
                'Party' => $r['party_name'],
                'Amount' => number_format((float)$r['amount'], 2, '.', ''),
                'Currency' => $r['currency_code'],
                'Amount (NPR)' => number_format((float)$r['amount_base'], 2, '.', ''),
                'Payment' => $r['payment_status'],
                'Status' => $r['status'],
                'Recorded By' => $r['user_name'],
            ], $result['rows']);
            Csv::download('transactions-' . date('Ymd-His') . '.csv', ['Date','Type','Reference','Party','Amount','Currency','Amount (NPR)','Payment','Status','Recorded By'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'txn_date', 'label' => 'Date', 'align' => 'left', 'format' => 'date'],
                ['key' => 'txn_type', 'label' => 'Type', 'align' => 'center'],
                ['key' => 'reference', 'label' => 'Reference', 'align' => 'left', 'format' => 'mono'],
                ['key' => 'party_name', 'label' => 'Party', 'align' => 'left'],
                ['key' => 'amount', 'label' => 'Amount', 'align' => 'right', 'format' => 'money'],
                ['key' => 'currency_code', 'label' => 'Currency', 'align' => 'center'],
                ['key' => 'amount_base', 'label' => 'Amount (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'payment_status', 'label' => 'Payment', 'align' => 'center'],
                ['key' => 'status', 'label' => 'Status', 'align' => 'center'],
                ['key' => 'user_name', 'label' => 'Recorded By', 'align' => 'left'],
            ];
            $rows = array_map(function ($r) {
                $r['txn_type'] = ucfirst($r['txn_type']);
                return $r;
            }, $result['rows']);
            $totalAmountBase = 0.0;
            foreach ($result['rows'] as $r) $totalAmountBase += (float)$r['amount_base'];

            Excel::download(
                'transactions-' . date('Ymd-His') . '.xlsx',
                'Transaction / Sales History',
                [
                    'Period' => $this->periodLabel($f),
                    'Type' => $f['type'] ? ucfirst($f['type']) : 'All types',
                    'Total records' => $result['total'],
                ],
                $columns,
                $rows,
                [
                    'txn_date' => 'TOTAL (this page)',
                    'txn_type' => '',
                    'reference' => '',
                    'party_name' => '',
                    'amount' => '',
                    'currency_code' => '',
                    'amount_base' => $totalAmountBase,
                    'payment_status' => '',
                    'status' => '',
                    'user_name' => '',
                ]
            );
        }

        Response::ok($result['rows'], 'Transactions', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    // ============ 7. PRODUCT-WISE SALES ============
    public function productSales(): void
    {
        $f = $this->filters();
        $result = $this->repo->productSales($f, 500);
        $format = $this->format();

        if ($format === 'csv') {
            $rows = array_map(fn($r) => [
                'SKU' => $r['sku'],
                'Name' => $r['name'],
                'Category' => $r['category_name'] ?? '',
                'Qty Sold' => $r['qty_sold'],
                'Qty Returned' => $r['qty_returned'],
                'Revenue (NPR)' => number_format((float)$r['revenue_base'], 2, '.', ''),
                'COGS (NPR)' => number_format((float)$r['cogs_base'], 2, '.', ''),
                'Profit (NPR)' => number_format((float)$r['profit_base'], 2, '.', ''),
            ], $result['rows']);
            Csv::download('product-sales-' . date('Ymd-His') . '.csv', ['SKU','Name','Category','Qty Sold','Qty Returned','Revenue (NPR)','COGS (NPR)','Profit (NPR)'], $rows);
        }

        if ($format === 'excel' || $format === 'xls') {
            $columns = [
                ['key' => 'sku', 'label' => 'SKU', 'align' => 'left'],
                ['key' => 'name', 'label' => 'Product', 'align' => 'left'],
                ['key' => 'category_name', 'label' => 'Category', 'align' => 'left'],
                ['key' => 'qty_sold', 'label' => 'Qty Sold', 'align' => 'right', 'format' => 'number'],
                ['key' => 'qty_returned', 'label' => 'Returned', 'align' => 'right', 'format' => 'number'],
                ['key' => 'revenue_base', 'label' => 'Revenue (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'cogs_base', 'label' => 'COGS (NPR)', 'align' => 'right', 'format' => 'money'],
                ['key' => 'profit_base', 'label' => 'Profit (NPR)', 'align' => 'right', 'format' => 'money'],
            ];
            $totalsRow = [
                'sku' => 'TOTAL',
                'name' => '',
                'category_name' => '',
                'qty_sold' => $result['totals']['qty_sold'],
                'qty_returned' => '',
                'revenue_base' => $result['totals']['revenue_base'],
                'cogs_base' => '',
                'profit_base' => $result['totals']['profit_base'],
            ];
            Excel::download(
                'product-sales-' . date('Ymd-His') . '.xlsx',
                'Product-wise Sales',
                [
                    'Period' => $this->periodLabel($f),
                    'Category' => $f['category_id'] ? "Category #{$f['category_id']}" : 'All categories',
                ],
                $columns,
                $result['rows'],
                $totalsRow
            );
        }

        Response::ok($result, 'Product-wise sales');
    }
}