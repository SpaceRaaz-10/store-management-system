import { http, getCsrfToken } from './http';
import type { ApiEnvelope } from '@/types/api';

export async function uploadProductImage(productId: number, file: File): Promise<string> {
  const form = new FormData();
  form.append('image', file);
  const token = getCsrfToken();
  if (token) form.append('_csrf', token);

  const { data } = await http.post<ApiEnvelope<{ image_path: string }>>(
    `/api/products/${productId}/image`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data.image_path;
}

export async function deleteProductImage(productId: number): Promise<void> {
  await http.delete(`/api/products/${productId}/image`);
}