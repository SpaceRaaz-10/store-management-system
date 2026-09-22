import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Category, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
}

export async function listCategories(params: ListParams = {}): Promise<Paginated<Category>> {
  const { data } = await http.get<ApiEnvelope<Category[]>>('/api/categories', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function createCategory(payload: Partial<Category>): Promise<Category> {
  const { data } = await http.post<ApiEnvelope<Category>>('/api/categories', payload);
  return data.data;
}

export async function updateCategory(id: number, payload: Partial<Category>): Promise<Category> {
  const { data } = await http.put<ApiEnvelope<Category>>(`/api/categories/${id}`, payload);
  return data.data;
}

export async function setCategoryStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  await http.post(`/api/categories/${id}/${status === 'active' ? 'activate' : 'deactivate'}`);
}

export async function deleteCategory(id: number): Promise<void> {
  await http.delete(`/api/categories/${id}`);
}