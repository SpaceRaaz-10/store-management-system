import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type {
  ReportFilters,
  SalesReportResult,
  PurchaseReportResult,
  InventoryReportResult,
  LowStockReportRow,
  RevenueProfitResult,
  TransactionRow,
  ProductSalesResult,
  Paginated,
} from '@/types/models';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function cleanFilters(f: ReportFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.group_by) out.group_by = f.group_by;
  if (f.category_id !== undefined && f.category_id !== '') out.category_id = f.category_id;
  if (f.currency_id !== undefined && f.currency_id !== '') out.currency_id = f.currency_id;
  if (f.type) out.type = f.type;
  if (f.search) out.search = f.search;
  return out;
}

export async function getSalesReport(f: ReportFilters): Promise<SalesReportResult> {
  const { data } = await http.get<ApiEnvelope<SalesReportResult>>('/api/reports/sales', { params: cleanFilters(f) });
  return data.data;
}

export async function getPurchaseReport(f: ReportFilters): Promise<PurchaseReportResult> {
  const { data } = await http.get<ApiEnvelope<PurchaseReportResult>>('/api/reports/purchases', { params: cleanFilters(f) });
  return data.data;
}

export async function getInventoryReport(f: ReportFilters): Promise<InventoryReportResult> {
  const { data } = await http.get<ApiEnvelope<InventoryReportResult>>('/api/reports/inventory', { params: cleanFilters(f) });
  return data.data;
}

export interface LowStockReportResult { rows: LowStockReportRow[]; totals: { item_count: number } }

export async function getLowStockReport(f: ReportFilters): Promise<LowStockReportResult> {
  const { data } = await http.get<ApiEnvelope<LowStockReportResult>>('/api/reports/low-stock', { params: cleanFilters(f) });
  return data.data;
}

export async function getRevenueProfit(f: ReportFilters): Promise<RevenueProfitResult> {
  const { data } = await http.get<ApiEnvelope<RevenueProfitResult>>('/api/reports/revenue-profit', { params: cleanFilters(f) });
  return data.data;
}

export async function getTransactions(f: ReportFilters, page = 1, perPage = 50): Promise<Paginated<TransactionRow>> {
  const { data } = await http.get<ApiEnvelope<TransactionRow[]>>('/api/reports/transactions', {
    params: { ...cleanFilters(f), page, per_page: perPage },
  });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 50),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getProductSales(f: ReportFilters): Promise<ProductSalesResult> {
  const { data } = await http.get<ApiEnvelope<ProductSalesResult>>('/api/reports/product-sales', { params: cleanFilters(f) });
  return data.data;
}

/**
 * Trigger a browser download of the given report.
 * The browser will handle the download with the session cookie (GET is a safe method).
 */
export type ExportKind =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'low-stock'
  | 'revenue-profit'
  | 'transactions'
  | 'product-sales';

export function downloadReport(kind: ExportKind, f: ReportFilters, format: 'excel' | 'csv'): void {
  const params = new URLSearchParams();
  const cleaned = cleanFilters(f);
  Object.entries(cleaned).forEach(([k, v]) => params.set(k, String(v)));
  params.set('format', format);

  const url = `${API_BASE}/api/reports/${kind}?${params.toString()}`;

  // Use a hidden anchor so the browser handles it (with cookies) rather than fetch
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}