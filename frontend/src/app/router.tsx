import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/routes/RequireAuth';
import { RequireAdmin } from '@/routes/RequireAdmin';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { SuppliersPage } from '@/features/suppliers/SuppliersPage';
import { PurchasesPage } from '@/features/purchases/PurchasesPage';
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage';
import { StockPage } from '@/features/inventory/StockPage';
import { MovementsPage } from '@/features/inventory/MovementsPage';
import { LowStockPage } from '@/features/inventory/LowStockPage';
import { SalesPage } from '@/features/sales/SalesPage';
import { NewSalePage } from '@/features/sales/NewSalePage';
import { ReturnsPage } from '@/features/returns/ReturnsPage';
import { VoidsPage } from '@/features/voids/VoidsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { CurrenciesPage } from '@/features/currencies/CurrenciesPage';
import { UsersPage } from '@/features/users/UsersPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'inventory', element: <StockPage /> },
      { path: 'inventory/movements', element: <MovementsPage /> },
      { path: 'inventory/low-stock', element: <LowStockPage /> },
      { path: 'sales', element: <SalesPage /> },
      { path: 'sales/new', element: <NewSalePage /> },
      { path: 'returns', element: <ReturnsPage /> },
      { path: 'voids', element: <VoidsPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'purchases', element: <PurchasesPage /> },
      { path: 'purchases/new', element: <NewPurchasePage /> },
      { path: 'reports', element: <ReportsPage /> },
      {
        path: 'currencies',
        element: (
          <RequireAdmin>
            <CurrenciesPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'users',
        element: (
          <RequireAdmin>
            <UsersPage />
          </RequireAdmin>
        ),
      },
      {
        path: 'settings',
        element: (
          <RequireAdmin>
            <SettingsPage />
          </RequireAdmin>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);