import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { AppUser, UserPayload, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  role?: string;
  status?: string;
}

export async function listUsers(params: ListParams = {}): Promise<Paginated<AppUser>> {
  const { data } = await http.get<ApiEnvelope<AppUser[]>>('/api/users', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function createUser(payload: UserPayload): Promise<AppUser> {
  const { data } = await http.post<ApiEnvelope<AppUser>>('/api/users', payload);
  return data.data;
}

export async function updateUser(id: number, payload: UserPayload): Promise<AppUser> {
  const { data } = await http.put<ApiEnvelope<AppUser>>(`/api/users/${id}`, payload);
  return data.data;
}

export async function changeUserPassword(id: number, password: string): Promise<void> {
  await http.post(`/api/users/${id}/password`, { password });
}

export async function setUserStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  await http.post(`/api/users/${id}/${status === 'active' ? 'activate' : 'deactivate'}`);
}