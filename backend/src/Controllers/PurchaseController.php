<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\PurchaseRepository;
use App\Repositories\SupplierRepository;
use App\Repositories\ProductRepository;

class PurchaseController
{
    private PurchaseRepository $repo;
    private SupplierRepository $suppliers;
    private ProductRepository $products;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new PurchaseRepository();
        $this->suppliers = new SupplierRepository();
        $this->products = new ProductRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'supplier_id' => Request::query('supplier_id'),
            'status' => trim((string)Request::query('status', '')),
            'payment_status' => trim((string)Request::query('payment_status', '')),
            'from' => trim((string)Request::query('from', '')),
            'to' => trim((string)Request::query('to', '')),
        ];
        $result = $this->repo->paginate($page, $perPage, $filters);

        Response::ok($result['rows'], 'Purchases', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $p = $this->repo->findById((int)$id);
        if (!$p) Response::error('Purchase not found', 404);
        Response::ok($p, 'Purchase');
    }

    public function store(): void
    {
        $data = Request::json();
        $errors = $this->validate($data);
        if ($errors) Response::error('Validation failed', 422, $errors);

        $supplier = $this->suppliers->findById((int)$data['supplier_id']);
        if (!$supplier) {
            Response::error('Validation failed', 422, ['supplier_id' => ['Supplier not found']]);
        }
        if ($supplier['status'] !== 'active') {
            Response::error('Validation failed', 422, ['supplier_id' => ['Supplier is inactive']]);
        }

        // Resolve exchange rate for the transaction currency
        $currencyId = (int)$data['currency_id'];
        $baseId = (int)Database::pdo()->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();
        $rate = $this->resolveRate($currencyId, $baseId);
        if ($rate === null) {
            Response::error('Validation failed', 422, ['currency_id' => ['No active exchange rate for this currency']]);
        }

        // Build items
        $items = [];
        $subtotal = 0.0;
        foreach ($data['items'] as $row) {
            $product = $this->products->findById((int)$row['product_id']);
            if (!$product) {
                Response::error('Validation failed', 422, ['items' => ["Product {$row['product_id']} not found"]]);
            }
            $qty = (float)$row['quantity'];
            $unitCost = (float)$row['unit_cost'];
            $lineTotal = round($qty * $unitCost, 2);
            $unitCostBase = round($unitCost * $rate, 2);
            $lineTotalBase = round($lineTotal * $rate, 2);
            $subtotal += $lineTotal;

            $items[] = [
                'product_id' => (int)$row['product_id'],
                'quantity' => $qty,
                'unit_cost' => $unitCost,
                'unit_cost_base' => $unitCostBase,
                'discount_amount' => 0.0,
                'tax_amount' => 0.0,
                'line_total' => $lineTotal,
                'line_total_base' => $lineTotalBase,
            ];
        }

        // Order-level discount
        $discountType = $data['discount_type'] ?? null;
        $discountValue = (float)($data['discount_value'] ?? 0);
        $discountAmount = 0.0;
        if ($discountType === 'percent' && $discountValue > 0) {
            $discountAmount = round($subtotal * $discountValue / 100, 2);
        } elseif ($discountType === 'fixed' && $discountValue > 0) {
            $discountAmount = round($discountValue, 2);
        }
        $discountAmount = min($discountAmount, $subtotal);

        // Tax on (subtotal - discount)
        $taxRate = (float)($data['tax_rate'] ?? 0);
        $taxable = $subtotal - $discountAmount;
        $taxAmount = $taxRate > 0 ? round($taxable * $taxRate / 100, 2) : 0.0;

        $total = round($taxable + $taxAmount, 2);
        $subtotalBase = round($subtotal * $rate, 2);
        $discountAmountBase = round($discountAmount * $rate, 2);
        $taxAmountBase = round($taxAmount * $rate, 2);
        $totalBase = round($total * $rate, 2);

        $paidAmount = min((float)($data['paid_amount'] ?? 0), $total);
        $dueAmount = round($total - $paidAmount, 2);
        $paymentStatus = $paidAmount <= 0 ? 'unpaid' : ($paidAmount >= $total ? 'paid' : 'partial');

        $purchaseId = $this->repo->create([
            'supplier_id' => (int)$data['supplier_id'],
            'currency_id' => $currencyId,
            'exchange_rate_to_base' => $rate,
            'purchase_date' => $data['purchase_date'] ?? date('Y-m-d'),
            'subtotal' => $subtotal,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'discount_amount' => $discountAmount,
            'tax_rate' => $taxRate,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'subtotal_base' => $subtotalBase,
            'discount_amount_base' => $discountAmountBase,
            'tax_amount_base' => $taxAmountBase,
            'total_base' => $totalBase,
            'paid_amount' => $paidAmount,
            'due_amount' => $dueAmount,
            'payment_status' => $paymentStatus,
            'payment_method_id' => $data['payment_method_id'] ?? null,
            'status' => 'completed',
            'notes' => $data['notes'] ?? null,
            'items' => $items,
        ], Auth::id());

        Response::created($this->repo->findById($purchaseId), 'Purchase created');
    }

    public function cancel(string $id): void
    {
        RoleMiddleware::require('admin');
        $pid = (int)$id;
        $p = $this->repo->findById($pid);
        if (!$p) Response::error('Purchase not found', 404);
        if ($p['status'] === 'cancelled') Response::error('Purchase already cancelled', 409);

        $this->repo->cancel($pid, Auth::id());
        Response::ok($this->repo->findById($pid), 'Purchase cancelled');
    }

    private function validate(array $data): array
    {
        $errors = [];
        if (empty($data['supplier_id'])) $errors['supplier_id'][] = 'Supplier is required';
        if (empty($data['currency_id'])) $errors['currency_id'][] = 'Currency is required';
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'][] = 'At least one item is required';
        } else {
            foreach ($data['items'] as $i => $it) {
                if (empty($it['product_id'])) $errors["items.$i.product_id"][] = 'Product is required';
                if (!isset($it['quantity']) || !is_numeric($it['quantity']) || (float)$it['quantity'] <= 0) {
                    $errors["items.$i.quantity"][] = 'Quantity must be greater than 0';
                }
                if (!isset($it['unit_cost']) || !is_numeric($it['unit_cost']) || (float)$it['unit_cost'] < 0) {
                    $errors["items.$i.unit_cost"][] = 'Unit cost must be 0 or greater';
                }
            }
        }
        if (isset($data['paid_amount']) && (!is_numeric($data['paid_amount']) || (float)$data['paid_amount'] < 0)) {
            $errors['paid_amount'][] = 'Paid amount must be 0 or greater';
        }
        return $errors;
    }

    private function resolveRate(int $currencyId, int $baseId): ?float
    {
        if ($currencyId === $baseId) return 1.0;
        $stmt = Database::pdo()->prepare(
            'SELECT rate_to_base FROM exchange_rates
             WHERE currency_id = ? AND base_currency_id = ? AND is_active = 1 AND effective_at <= NOW()
             ORDER BY effective_at DESC LIMIT 1'
        );
        $stmt->execute([$currencyId, $baseId]);
        $rate = $stmt->fetchColumn();
        return $rate === false ? null : (float)$rate;
    }
}