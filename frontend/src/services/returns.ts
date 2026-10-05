import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { ReturnRequest, Paginated, CreateReturnPayload } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  sale_id?: number;
}

export async function listReturns(params: ListParams = {}): Promise<Paginated<ReturnRequest>> {
  const { data } = await http.get<ApiEnvelope<ReturnRequest[]>>('/api/returns', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getReturn(id: number): Promise<ReturnRequest> {
  const { data } = await http.get<ApiEnvelope<ReturnRequest>>(`/api/returns/${id}`);
  return data.data;
}

export async function createReturn(saleId: number, payload: CreateReturnPayload): Promise<ReturnRequest> {
  const { data } = await http.post<ApiEnvelope<ReturnRequest>>(`/api/sales/${saleId}/returns`, payload);
  return data.data;
}

export async function approveReturn(id: number, note?: string): Promise<ReturnRequest> {
  const { data } = await http.post<ApiEnvelope<ReturnRequest>>(`/api/returns/${id}/approve`, { note });
  return data.data;
}

export async function rejectReturn(id: number, note?: string): Promise<ReturnRequest> {
  const { data } = await http.post<ApiEnvelope<ReturnRequest>>(`/api/returns/${id}/reject`, { note });
  return data.data;
}