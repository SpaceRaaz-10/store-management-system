import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { DashboardStats } from '@/types/models';

export async function getDashboardStats(): Promise<DashboardStats> {
  const { data } = await http.get<ApiEnvelope<DashboardStats>>('/api/dashboard/stats');
  return data.data;
}