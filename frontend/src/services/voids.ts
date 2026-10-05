import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { VoidRequest, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
}

export async function listVoids(params: ListParams = {}): Promise<Paginated<VoidRequest>> {
  const { data } = await http.get<ApiEnvelope<VoidRequest[]>>('/api/voids', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getVoid(id: number): Promise<VoidRequest> {
  const { data } = await http.get<ApiEnvelope<VoidRequest>>(`/api/voids/${id}`);
  return data.data;
}

export async function createVoid(saleId: number, reason: string): Promise<VoidRequest> {
  const { data } = await http.post<ApiEnvelope<VoidRequest>>(`/api/sales/${saleId}/void`, { reason });
  return data.data;
}

export async function approveVoid(id: number, note?: string): Promise<VoidRequest> {
  const { data } = await http.post<ApiEnvelope<VoidRequest>>(`/api/voids/${id}/approve`, { note });
  return data.data;
}

export async function rejectVoid(id: number, note?: string): Promise<VoidRequest> {
  const { data } = await http.post<ApiEnvelope<VoidRequest>>(`/api/voids/${id}/reject`, { note });
  return data.data;
}