import { http, setCsrfToken } from './http';
import type { ApiEnvelope, CurrentUser } from '@/types/api';

interface LoginResponse {
  user: CurrentUser;
  csrf_token: string;
}

export async function fetchCsrfToken(): Promise<string> {
  const { data } = await http.get<ApiEnvelope<{ token: string }>>('/api/auth/csrf');
  setCsrfToken(data.data.token);
  return data.data.token;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  // Ensure token is fresh and matched with the current session right before POST
  await fetchCsrfToken();
  const { data } = await http.post<ApiEnvelope<LoginResponse>>('/api/auth/login', { email, password });
  setCsrfToken(data.data.csrf_token);
  return data.data.user;
}

export async function logout(): Promise<void> {
  await http.post('/api/auth/logout');
  setCsrfToken(null);
}

export async function me(): Promise<CurrentUser> {
  const { data } = await http.get<ApiEnvelope<CurrentUser>>('/api/auth/me');
  return data.data;
}