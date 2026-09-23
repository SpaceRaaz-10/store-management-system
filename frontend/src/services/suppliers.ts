import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Supplier, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
}

export async function listSuppliers(params: ListParams = {}): Promise<Paginated<Supplier>> {
  const { data } = await http.get<ApiEnvelope<Supplier[]>>('/api/suppliers', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function createSupplier(payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await http.post<ApiEnvelope<Supplier>>('/api/suppliers', payload);
  return data.data;
}

export async function updateSupplier(id: number, payload: Partial<Supplier>): Promise<Supplier> {
  const { data } = await http.put<ApiEnvelope<Supplier>>(`/api/suppliers/${id}`, payload);
  return data.data;
}

export async function setSupplierStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  await http.post(`/api/suppliers/${id}/${status === 'active' ? 'activate' : 'deactivate'}`);
}

export async function deleteSupplier(id: number): Promise<void> {
  await http.delete(`/api/suppliers/${id}`);
}