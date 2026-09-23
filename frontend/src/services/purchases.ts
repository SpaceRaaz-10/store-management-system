import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Purchase, PurchaseListItem, Paginated, PurchasePayload } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  supplier_id?: number;
  status?: string;
  payment_status?: string;
  from?: string;
  to?: string;
}

export async function listPurchases(params: ListParams = {}): Promise<Paginated<PurchaseListItem>> {
  const { data } = await http.get<ApiEnvelope<PurchaseListItem[]>>('/api/purchases', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getPurchase(id: number): Promise<Purchase> {
  const { data } = await http.get<ApiEnvelope<Purchase>>(`/api/purchases/${id}`);
  return data.data;
}

export async function createPurchase(payload: PurchasePayload): Promise<Purchase> {
  const { data } = await http.post<ApiEnvelope<Purchase>>('/api/purchases', payload);
  return data.data;
}

export async function cancelPurchase(id: number): Promise<void> {
  await http.post(`/api/purchases/${id}/cancel`);
}