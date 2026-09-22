<?php
use App\Core\Router;
use App\Core\Response;
use App\Controllers\AuthController;
use App\Controllers\CategoryController;
use App\Controllers\ProductController;
use App\Controllers\ProductImageController;
use App\Controllers\CustomerController;
use App\Controllers\SupplierController;

return function (Router $r): void {

    $r->get('/api/health', function () {
        Response::ok(['status' => 'ok', 'time' => date('c')], 'Healthy');
    });

    // Auth
    $r->get ('/api/auth/csrf',   [AuthController::class, 'csrf']);
    $r->post('/api/auth/login',  [AuthController::class, 'login']);
    $r->post('/api/auth/logout', [AuthController::class, 'logout']);
    $r->get ('/api/auth/me',     [AuthController::class, 'me']);

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
};