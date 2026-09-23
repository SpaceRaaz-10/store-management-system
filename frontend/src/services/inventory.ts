import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { StockRow, StockMovement, LowStockRow, Paginated, AdjustStockPayload } from '@/types/models';

interface StockListParams {
  page?: number;
  per_page?: number;
  search?: string;
  category_id?: number | '';
  status?: string;
  low_stock?: number | '';
}

export async function listStock(params: StockListParams = {}): Promise<Paginated<StockRow>> {
  const { data } = await http.get<ApiEnvelope<StockRow[]>>('/api/inventory', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

interface MovementListParams {
  page?: number;
  per_page?: number;
  product_id?: number;
  type?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function listMovements(params: MovementListParams = {}): Promise<Paginated<StockMovement>> {
  const { data } = await http.get<ApiEnvelope<StockMovement[]>>('/api/inventory/movements', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function listLowStock(limit = 20): Promise<LowStockRow[]> {
  const { data } = await http.get<ApiEnvelope<LowStockRow[]>>('/api/inventory/low-stock', {
    params: { limit },
  });
  return data.data;
}

export interface AdjustStockResult {
  product_id: number;
  previous_qty: number;
  new_qty: number;
  delta: number;
}

export async function adjustStock(payload: AdjustStockPayload): Promise<AdjustStockResult> {
  const { data } = await http.post<ApiEnvelope<AdjustStockResult>>('/api/inventory/adjust', payload);
  return data.data;
}