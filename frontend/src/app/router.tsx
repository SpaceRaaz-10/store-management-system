import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { RequireAuth } from '@/routes/RequireAuth';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CategoriesPage } from '@/features/categories/CategoriesPage';
import { ProductsPage } from '@/features/products/ProductsPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { SuppliersPage } from '@/features/suppliers/SuppliersPage';
import { PurchasesPage } from '@/features/purchases/PurchasesPage';
import { NewPurchasePage } from '@/features/purchases/NewPurchasePage';

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
      { path: 'customers', element: <CustomersPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'purchases', element: <PurchasesPage /> },
      { path: 'purchases/new', element: <NewPurchasePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);