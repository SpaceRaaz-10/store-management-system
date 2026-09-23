<?php
namespace App\Controllers;

use App\Core\Database;
use App\Core\Response;
use App\Middleware\AuthMiddleware;

class PaymentMethodController
{
    public function __construct()
    {
        AuthMiddleware::handle();
    }

    public function index(): void
    {
        $rows = Database::pdo()->query(
            'SELECT id, code, name, is_active FROM payment_methods WHERE is_active = 1 ORDER BY id ASC'
        )->fetchAll();

        Response::ok($rows, 'Payment methods');
    }
}