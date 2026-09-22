import axios, { AxiosError, AxiosHeaders } from 'axios';
import type { ApiEnvelope } from '@/types/api';

const baseURL = import.meta.env.VITE_API_BASE_URL || '';

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) { csrfToken = token; }
export function getCsrfToken() { return csrfToken; }

http.interceptors.request.use((config) => {
  const method = (config.method ?? 'get').toUpperCase();
  if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('X-CSRF-Token', csrfToken);
    } else {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)['X-CSRF-Token'] = csrfToken;
    }
  }
  return config;
});

export interface ApiError {
  status: number;
  message: string;
  errors: Record<string, string[]> | null;
}

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiEnvelope<unknown>>) => {
    const e: ApiError = {
      status: err.response?.status ?? 0,
      message: err.response?.data?.message ?? 'Network error',
      errors: err.response?.data?.errors ?? null,
    };
    return Promise.reject(e);
  }
);