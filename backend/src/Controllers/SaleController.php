<?php
namespace App\Controllers;

use App\Core\Auth;
use App\Core\Database;
use App\Core\Request;
use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\SaleRepository;
use App\Repositories\CustomerRepository;
use App\Repositories\ProductRepository;

class SaleController
{
    private SaleRepository $repo;
    private CustomerRepository $customers;
    private ProductRepository $products;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new SaleRepository();
        $this->customers = new CustomerRepository();
        $this->products = new ProductRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'customer_id' => Request::query('customer_id'),
            'status' => trim((string)Request::query('status', '')),
            'payment_status' => trim((string)Request::query('payment_status', '')),
            'from' => trim((string)Request::query('from', '')),
            'to' => trim((string)Request::query('to', '')),
        ];
        $result = $this->repo->paginate($page, $perPage, $filters);

        Response::ok($result['rows'], 'Sales', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $s = $this->repo->findById((int)$id);
        if (!$s) Response::error('Sale not found', 404);
        Response::ok($s, 'Sale');
    }

    public function store(): void
    {
        $data = Request::json();
        $errors = $this->validate($data);
        if ($errors) Response::error('Validation failed', 422, $errors);

        if (!empty($data['customer_id'])) {
            $c = $this->customers->findById((int)$data['customer_id']);
            if (!$c) Response::error('Validation failed', 422, ['customer_id' => ['Customer not found']]);
            if ($c['status'] !== 'active') Response::error('Validation failed', 422, ['customer_id' => ['Customer is inactive']]);
        }

        $currencyId = (int)$data['currency_id'];
        $baseId = (int)Database::pdo()->query("SELECT id FROM currencies WHERE is_base = 1 LIMIT 1")->fetchColumn();
        $rate = $this->resolveRate($currencyId, $baseId);
        if ($rate === null) {
            Response::error('Validation failed', 422, ['currency_id' => ['No active exchange rate for this currency']]);
        }

        // Build items — validate stock with row locks
        $pdo = Database::pdo();
        $items = [];
        $subtotal = 0.0;
        $cogsBase = 0.0;
        $revenueBase = 0.0;

        foreach ($data['items'] as $row) {
            $product = $this->products->findById((int)$row['product_id']);
            if (!$product) {
                Response::error('Validation failed', 422, ['items' => ["Product {$row['product_id']} not found"]]);
            }
            if ($product['status'] !== 'active') {
                Response::error('Validation failed', 422, ['items' => ["{$product['name']} is inactive"]]);
            }

            $qty = (float)$row['quantity'];
            if ($qty > (float)$product['stock_qty']) {
                Response::error('Validation failed', 422, [
                    'items' => ["Not enough stock for {$product['name']}: have " . number_format((float)$product['stock_qty'], 0) . ", need " . number_format($qty, 0)]
                ]);
            }

            $unitPrice = (float)$row['unit_price']; // in transaction currency
            $unitPriceBase = round($unitPrice * $rate, 2);

            $lineTotal = round($qty * $unitPrice, 2);
            $lineTotalBase = round($lineTotal * $rate, 2);
            $lineCogs = round($qty * (float)$product['cost_price'], 2);

            $subtotal += $lineTotal;
            $revenueBase += $lineTotalBase;
            $cogsBase += $lineCogs;

            $items[] = [
                'product_id' => (int)$row['product_id'],
                'quantity' => $qty,
                'unit_price' => $unitPrice,
                'unit_price_base' => $unitPriceBase,
                'discount_amount' => 0.0,
                'tax_amount' => 0.0,
                'line_total' => $lineTotal,
                'line_total_base' => $lineTotalBase,
                'cogs_base' => $lineCogs,
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
        $profitBase = round($revenueBase - $discountAmountBase - $cogsBase, 2);

        $paidAmount = min((float)($data['paid_amount'] ?? 0), $total);
        $dueAmount = round($total - $paidAmount, 2);
        $paymentStatus = $paidAmount <= 0 ? 'unpaid' : ($paidAmount >= $total ? 'paid' : 'partial');

        $saleId = $this->repo->create([
            'customer_id' => !empty($data['customer_id']) ? (int)$data['customer_id'] : null,
            'currency_id' => $currencyId,
            'exchange_rate_to_base' => $rate,
            'sale_date' => $data['sale_date'] ?? date('Y-m-d'),
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
            'cogs_base' => $cogsBase,
            'profit_base' => $profitBase,
            'paid_amount' => $paidAmount,
            'due_amount' => $dueAmount,
            'payment_status' => $paymentStatus,
            'payment_method_id' => $data['payment_method_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'items' => $items,
        ], Auth::id());

        Response::created($this->repo->findById($saleId), 'Sale created');
    }

    public function addPayment(string $id): void
    {
        $sid = (int)$id;
        $sale = $this->repo->findById($sid);
        if (!$sale) Response::error('Sale not found', 404);
        if ($sale['status'] !== 'completed') Response::error('Cannot pay a voided sale', 409);

        $data = Request::json();
        $amount = (float)($data['amount'] ?? 0);
        $methodId = (int)($data['payment_method_id'] ?? 0);
        $note = trim((string)($data['note'] ?? '')) ?: null;

        $errors = [];
        if ($amount <= 0) $errors['amount'][] = 'Amount must be greater than 0';
        if ($methodId <= 0) $errors['payment_method_id'][] = 'Payment method is required';
        if ((float)$sale['due_amount'] <= 0) $errors['amount'][] = 'This sale is already fully paid';
        if ($errors) Response::error('Validation failed', 422, $errors);

        try {
            $this->repo->addPayment($sid, $amount, $methodId, Auth::id(), $note);
            Response::ok($this->repo->findById($sid), 'Payment recorded');
        } catch (\RuntimeException $e) {
            Response::error($e->getMessage(), 422);
        }
    }

    private function validate(array $data): array
    {
        $errors = [];
        if (empty($data['currency_id'])) $errors['currency_id'][] = 'Currency is required';
        if (empty($data['items']) || !is_array($data['items'])) {
            $errors['items'][] = 'At least one item is required';
        } else {
            foreach ($data['items'] as $i => $it) {
                if (empty($it['product_id'])) $errors["items.$i.product_id"][] = 'Product is required';
                if (!isset($it['quantity']) || !is_numeric($it['quantity']) || (float)$it['quantity'] <= 0) {
                    $errors["items.$i.quantity"][] = 'Quantity must be greater than 0';
                }
                if (!isset($it['unit_price']) || !is_numeric($it['unit_price']) || (float)$it['unit_price'] < 0) {
                    $errors["items.$i.unit_price"][] = 'Unit price must be 0 or greater';
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