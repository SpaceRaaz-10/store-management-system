import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Sale, SaleListItem, Paginated, SalePayload } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  customer_id?: number;
  status?: string;
  payment_status?: string;
  from?: string;
  to?: string;
}

export async function listSales(params: ListParams = {}): Promise<Paginated<SaleListItem>> {
  const { data } = await http.get<ApiEnvelope<SaleListItem[]>>('/api/sales', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getSale(id: number): Promise<Sale> {
  const { data } = await http.get<ApiEnvelope<Sale>>(`/api/sales/${id}`);
  return data.data;
}

export async function createSale(payload: SalePayload): Promise<Sale> {
  const { data } = await http.post<ApiEnvelope<Sale>>('/api/sales', payload);
  return data.data;
}

export interface AddPaymentPayload {
  amount: number;
  payment_method_id: number;
  note?: string | null;
}

export async function addSalePayment(id: number, payload: AddPaymentPayload): Promise<Sale> {
  const { data } = await http.post<ApiEnvelope<Sale>>(`/api/sales/${id}/payments`, payload);
  return data.data;
}