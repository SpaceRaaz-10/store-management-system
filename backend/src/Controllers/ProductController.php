<?php
namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Core\Auth;
use App\Middleware\AuthMiddleware;
use App\Middleware\RoleMiddleware;
use App\Repositories\ProductRepository;
use App\Repositories\CategoryRepository;

class ProductController
{
    private ProductRepository $repo;
    private CategoryRepository $categories;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new ProductRepository();
        $this->categories = new CategoryRepository();
    }

    public function index(): void
    {
        $page = max(1, (int)Request::query('page', 1));
        $perPage = min(100, max(1, (int)Request::query('per_page', 20)));
        $filters = [
            'search' => trim((string)Request::query('search', '')),
            'category_id' => Request::query('category_id'),
            'status' => trim((string)Request::query('status', '')),
            'low_stock' => Request::query('low_stock'),
        ];
        $result = $this->repo->paginate($page, $perPage, $filters);
        Response::ok($result['rows'], 'Products', [
            'page' => $page, 'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int)ceil($result['total'] / $perPage),
        ]);
    }

    public function show(string $id): void
    {
        $p = $this->repo->findById((int)$id);
        if (!$p) Response::error('Product not found', 404);
        Response::ok($p, 'Product');
    }

    public function lookup(): void
    {
        $barcode = trim((string)Request::query('barcode', ''));
        if ($barcode === '') Response::error('Barcode is required', 422);
        $p = $this->repo->findByBarcode($barcode);
        if (!$p) Response::error('Product not found', 404);
        Response::ok($p, 'Product');
    }

    public function nextCode(): void
    {
        Response::ok([
            'sku' => $this->repo->getNextSku(),
            'barcode' => $this->repo->getNextBarcode(),
        ], 'Next codes');
    }

    public function store(): void
    {
        $data = Request::json();
        $this->validate($data, false);

        // Auto-generate SKU/barcode when blank
        $sku = trim((string)($data['sku'] ?? ''));
        if ($sku === '') {
            $sku = $this->repo->getNextSku();
        }
        $barcode = trim((string)($data['barcode'] ?? ''));
        if ($barcode === '') {
            $barcode = $this->repo->getNextBarcode();
        }

        if ($this->repo->skuExists($sku)) {
            Response::error('Validation failed', 422, ['sku' => ['SKU already exists']]);
        }
        if ($this->repo->barcodeExists($barcode)) {
            Response::error('Validation failed', 422, ['barcode' => ['Barcode already exists']]);
        }

        $payload = $this->payload($data);
        $payload['sku'] = $sku;
        $payload['barcode'] = $barcode;

        $id = $this->repo->create($payload, Auth::id());
        Response::created($this->repo->findById($id), 'Product created');
    }

    public function update(string $id): void
    {
        $pid = (int)$id;
        if (!$this->repo->findById($pid)) Response::error('Product not found', 404);

        $data = Request::json();
        $this->validate($data, true);

        $sku = trim((string)($data['sku'] ?? ''));
        $barcode = trim((string)($data['barcode'] ?? ''));

        if ($this->repo->skuExists($sku, $pid)) {
            Response::error('Validation failed', 422, ['sku' => ['SKU already exists']]);
        }
        if ($barcode !== '' && $this->repo->barcodeExists($barcode, $pid)) {
            Response::error('Validation failed', 422, ['barcode' => ['Barcode already exists']]);
        }

        $this->repo->update($pid, $this->payload($data), Auth::id());
        Response::ok($this->repo->findById($pid), 'Product updated');
    }

    public function activate(string $id): void
    {
        RoleMiddleware::require('admin');
        $pid = (int)$id;
        if (!$this->repo->findById($pid)) Response::error('Product not found', 404);
        $this->repo->setStatus($pid, 'active');
        Response::ok($this->repo->findById($pid), 'Product activated');
    }

    public function deactivate(string $id): void
    {
        RoleMiddleware::require('admin');
        $pid = (int)$id;
        if (!$this->repo->findById($pid)) Response::error('Product not found', 404);
        $this->repo->setStatus($pid, 'inactive');
        Response::ok($this->repo->findById($pid), 'Product deactivated');
    }

    public function destroy(string $id): void
    {
        RoleMiddleware::require('admin');
        $pid = (int)$id;
        if (!$this->repo->findById($pid)) Response::error('Product not found', 404);

        $pdo = \App\Core\Database::pdo();
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM sale_items WHERE product_id = ?');
        $stmt->execute([$pid]);
        $sold = (int)$stmt->fetchColumn();
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM purchase_items WHERE product_id = ?');
        $stmt->execute([$pid]);
        $bought = (int)$stmt->fetchColumn();

        if ($sold + $bought > 0) {
            Response::error('Product has transaction history. Deactivate it instead of deleting.', 409);
        }

        $this->repo->delete($pid);
        Response::ok(null, 'Product deleted');
    }

    private function validate(array $data, bool $isUpdate): void
    {
        $v = new Validator($data);
        $v->required('name')->max('name', 150);
        // SKU is only required on update; on create it can be auto-generated
        if ($isUpdate) {
            $v->required('sku');
        }
        $v->max('sku', 60);
        $v->max('barcode', 60);
        $v->numeric('cost_price')->minValue('cost_price', 0);
        $v->numeric('selling_price')->minValue('selling_price', 0);
        $v->numeric('stock_qty')->minValue('stock_qty', 0);
        $v->numeric('reorder_level')->minValue('reorder_level', 0);
        $v->in('status', ['active', 'inactive']);
        if ($v->fails()) Response::error('Validation failed', 422, $v->errors());

        $cid = $data['category_id'] ?? null;
        if ($cid) {
            $cat = $this->categories->findById((int)$cid);
            if (!$cat) Response::error('Validation failed', 422, ['category_id' => ['Category not found']]);
            if ($cat['status'] !== 'active') Response::error('Validation failed', 422, ['category_id' => ['Category is inactive']]);
        }
    }

    private function payload(array $data): array
    {
        return [
            'category_id' => $data['category_id'] ?? null,
            'name' => trim((string)$data['name']),
            'sku' => trim((string)($data['sku'] ?? '')),
            'barcode' => trim((string)($data['barcode'] ?? '')),
            'description' => $data['description'] ?? null,
            'unit' => $data['unit'] ?? 'pcs',
            'cost_price' => (float)($data['cost_price'] ?? 0),
            'selling_price' => (float)($data['selling_price'] ?? 0),
            'stock_qty' => (float)($data['stock_qty'] ?? 0),
            'reorder_level' => (float)($data['reorder_level'] ?? 0),
            'status' => $data['status'] ?? 'active',
        ];
    }
}