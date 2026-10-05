<?php
use App\Core\Router;
use App\Core\Response;
use App\Controllers\AuthController;
use App\Controllers\CategoryController;
use App\Controllers\ProductController;
use App\Controllers\ProductImageController;
use App\Controllers\CustomerController;
use App\Controllers\SupplierController;
use App\Controllers\PurchaseController;
use App\Controllers\SaleController;
use App\Controllers\ReturnController;
use App\Controllers\VoidController;
use App\Controllers\CurrencyController;
use App\Controllers\PaymentMethodController;
use App\Controllers\InventoryController;
use App\Controllers\DashboardController;
use App\Controllers\ReportController;
use App\Controllers\SettingController;
use App\Controllers\UserController;
use App\Controllers\ExchangeRateController;

return function (Router $r): void {

    $r->get('/api/health', function () {
        Response::ok(['status' => 'ok', 'time' => date('c')], 'Healthy');
    });

    // Auth
    $r->get ('/api/auth/csrf',   [AuthController::class, 'csrf']);
    $r->post('/api/auth/login',  [AuthController::class, 'login']);
    $r->post('/api/auth/logout', [AuthController::class, 'logout']);
    $r->get ('/api/auth/me',     [AuthController::class, 'me']);

    // Reference data
    $r->get('/api/currencies',       [CurrencyController::class, 'index']);
    $r->get('/api/currencies/all',   [CurrencyController::class, 'all']);
    $r->post('/api/currencies',      [CurrencyController::class, 'store']);
    $r->get('/api/currencies/{id}',  [CurrencyController::class, 'show']);
    $r->put('/api/currencies/{id}',  [CurrencyController::class, 'update']);
    $r->post('/api/currencies/{id}/activate',   [CurrencyController::class, 'activate']);
    $r->post('/api/currencies/{id}/deactivate', [CurrencyController::class, 'deactivate']);
    $r->delete('/api/currencies/{id}',          [CurrencyController::class, 'destroy']);

    // Exchange rates
    $r->get('/api/exchange-rates/history', [ExchangeRateController::class, 'history']);
    $r->get('/api/exchange-rates/status',  [ExchangeRateController::class, 'status']);
    $r->post('/api/exchange-rates/fetch',  [ExchangeRateController::class, 'fetch']);
    $r->post('/api/exchange-rates/auto',   [ExchangeRateController::class, 'setAuto']);
    $r->post('/api/exchange-rates',        [ExchangeRateController::class, 'store']);
    $r->delete('/api/exchange-rates/{id}', [ExchangeRateController::class, 'destroy']);

    $r->get('/api/payment-methods', [PaymentMethodController::class, 'index']);

    // Categories
    $r->get   ('/api/categories',                 [CategoryController::class, 'index']);
    $r->post  ('/api/categories',                 [CategoryController::class, 'store']);
    $r->get   ('/api/categories/{id}',            [CategoryController::class, 'show']);
    $r->put   ('/api/categories/{id}',            [CategoryController::class, 'update']);
    $r->post  ('/api/categories/{id}/activate',   [CategoryController::class, 'activate']);
    $r->post  ('/api/categories/{id}/deactivate', [CategoryController::class, 'deactivate']);
    $r->delete('/api/categories/{id}',            [CategoryController::class, 'destroy']);

    // Products
    $r->get   ('/api/products/lookup',            [ProductController::class, 'lookup']);
    $r->get   ('/api/products/next-code',         [ProductController::class, 'nextCode']);
    $r->get   ('/api/products',                   [ProductController::class, 'index']);
    $r->post  ('/api/products',                   [ProductController::class, 'store']);
    $r->get   ('/api/products/{id}',              [ProductController::class, 'show']);
    $r->put   ('/api/products/{id}',              [ProductController::class, 'update']);
    $r->post  ('/api/products/{id}/activate',     [ProductController::class, 'activate']);
    $r->post  ('/api/products/{id}/deactivate',   [ProductController::class, 'deactivate']);
    $r->delete('/api/products/{id}',              [ProductController::class, 'destroy']);
    $r->post  ('/api/products/{id}/image',        [ProductImageController::class, 'upload']);
    $r->delete('/api/products/{id}/image',        [ProductImageController::class, 'delete']);

    // Customers
    $r->get   ('/api/customers',                 [CustomerController::class, 'index']);
    $r->post  ('/api/customers',                 [CustomerController::class, 'store']);
    $r->get   ('/api/customers/{id}',            [CustomerController::class, 'show']);
    $r->put   ('/api/customers/{id}',            [CustomerController::class, 'update']);
    $r->post  ('/api/customers/{id}/activate',   [CustomerController::class, 'activate']);
    $r->post  ('/api/customers/{id}/deactivate', [CustomerController::class, 'deactivate']);
    $r->delete('/api/customers/{id}',            [CustomerController::class, 'destroy']);

    // Suppliers
    $r->get   ('/api/suppliers',                 [SupplierController::class, 'index']);
    $r->post  ('/api/suppliers',                 [SupplierController::class, 'store']);
    $r->get   ('/api/suppliers/{id}',            [SupplierController::class, 'show']);
    $r->put   ('/api/suppliers/{id}',            [SupplierController::class, 'update']);
    $r->post  ('/api/suppliers/{id}/activate',   [SupplierController::class, 'activate']);
    $r->post  ('/api/suppliers/{id}/deactivate', [SupplierController::class, 'deactivate']);
    $r->delete('/api/suppliers/{id}',            [SupplierController::class, 'destroy']);

    // Purchases
    $r->get   ('/api/purchases',             [PurchaseController::class, 'index']);
    $r->post  ('/api/purchases',             [PurchaseController::class, 'store']);
    $r->get   ('/api/purchases/{id}',        [PurchaseController::class, 'show']);
    $r->post  ('/api/purchases/{id}/payments', [PurchaseController::class, 'addPayment']);
    $r->post  ('/api/purchases/{id}/cancel', [PurchaseController::class, 'cancel']);

    // Sales
    $r->get   ('/api/sales',             [SaleController::class, 'index']);
    $r->post  ('/api/sales',             [SaleController::class, 'store']);
    $r->get   ('/api/sales/{id}',        [SaleController::class, 'show']);
    $r->post  ('/api/sales/{id}/payments', [SaleController::class, 'addPayment']);
    $r->post  ('/api/sales/{id}/returns', [ReturnController::class, 'store']);
    $r->post  ('/api/sales/{id}/void',    [VoidController::class, 'store']);

    // Returns
    $r->get ('/api/returns',                [ReturnController::class, 'index']);
    $r->get ('/api/returns/{id}',           [ReturnController::class, 'show']);
    $r->post('/api/returns/{id}/approve',   [ReturnController::class, 'approve']);
    $r->post('/api/returns/{id}/reject',    [ReturnController::class, 'reject']);

    // Voids
    $r->get ('/api/voids',               [VoidController::class, 'index']);
    $r->get ('/api/voids/{id}',          [VoidController::class, 'show']);
    $r->post('/api/voids/{id}/approve',  [VoidController::class, 'approve']);
    $r->post('/api/voids/{id}/reject',   [VoidController::class, 'reject']);

    // Users (admin only)
    $r->get   ('/api/users',                 [UserController::class, 'index']);
    $r->post  ('/api/users',                 [UserController::class, 'store']);
    $r->get   ('/api/users/{id}',            [UserController::class, 'show']);
    $r->put   ('/api/users/{id}',            [UserController::class, 'update']);
    $r->post  ('/api/users/{id}/password',   [UserController::class, 'changePassword']);
    $r->post  ('/api/users/{id}/activate',   [UserController::class, 'activate']);
    $r->post  ('/api/users/{id}/deactivate', [UserController::class, 'deactivate']);

    // Settings
    $r->get('/api/settings', [SettingController::class, 'index']);
    $r->put('/api/settings', [SettingController::class, 'update']);

    // Dashboard
    $r->get('/api/dashboard/stats', [DashboardController::class, 'stats']);

    // Reports
    $r->get('/api/reports/sales',         [ReportController::class, 'sales']);
    $r->get('/api/reports/purchases',     [ReportController::class, 'purchases']);
    $r->get('/api/reports/inventory',     [ReportController::class, 'inventory']);
    $r->get('/api/reports/low-stock',     [ReportController::class, 'lowStock']);
    $r->get('/api/reports/revenue-profit',[ReportController::class, 'revenueProfit']);
    $r->get('/api/reports/transactions',  [ReportController::class, 'transactions']);
    $r->get('/api/reports/product-sales', [ReportController::class, 'productSales']);

    // Inventory
    $r->get ('/api/inventory',            [InventoryController::class, 'stock']);
    $r->get ('/api/inventory/movements',  [InventoryController::class, 'movements']);
    $r->get ('/api/inventory/low-stock',  [InventoryController::class, 'lowStock']);
    $r->post('/api/inventory/adjust',     [InventoryController::class, 'adjust']);
};