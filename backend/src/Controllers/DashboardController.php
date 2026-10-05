<?php
namespace App\Controllers;

use App\Core\Response;
use App\Middleware\AuthMiddleware;
use App\Repositories\DashboardRepository;

class DashboardController
{
    private DashboardRepository $repo;

    public function __construct()
    {
        AuthMiddleware::handle();
        $this->repo = new DashboardRepository();
    }

    public function stats(): void
    {
        Response::ok([
            'totals' => $this->repo->totals(),
            'sales' => $this->repo->salesSummary(),
            'trend' => $this->repo->salesTrend(14),
            'top_products' => $this->repo->topProducts(5, 30),
            'recent_sales' => $this->repo->recentSales(5),
            'low_stock' => $this->repo->lowStockTop(5),
        ], 'Dashboard statistics');
    }
}