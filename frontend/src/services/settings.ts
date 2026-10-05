import { http } from './http';
import type { ApiEnvelope } from '@/types/api';

export interface SettingEntry {
  value: string | null;
  type: 'string' | 'int' | 'bool' | 'json';
  group: string;
}

export type Settings = Record<string, SettingEntry>;

export async function getSettings(): Promise<Settings> {
  const { data } = await http.get<ApiEnvelope<Settings>>('/api/settings');
  return data.data;
}

export async function updateSettings(updates: Record<string, string>): Promise<Settings> {
  const { data } = await http.put<ApiEnvelope<Settings>>('/api/settings', updates);
  return data.data;
}