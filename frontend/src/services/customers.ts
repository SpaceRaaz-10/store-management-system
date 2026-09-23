import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Customer, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
}

export async function listCustomers(params: ListParams = {}): Promise<Paginated<Customer>> {
  const { data } = await http.get<ApiEnvelope<Customer[]>>('/api/customers', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function createCustomer(payload: Partial<Customer>): Promise<Customer> {
  const { data } = await http.post<ApiEnvelope<Customer>>('/api/customers', payload);
  return data.data;
}

export async function updateCustomer(id: number, payload: Partial<Customer>): Promise<Customer> {
  const { data } = await http.put<ApiEnvelope<Customer>>(`/api/customers/${id}`, payload);
  return data.data;
}

export async function setCustomerStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  await http.post(`/api/customers/${id}/${status === 'active' ? 'activate' : 'deactivate'}`);
}

export async function deleteCustomer(id: number): Promise<void> {
  await http.delete(`/api/customers/${id}`);
}