import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Product, Paginated } from '@/types/models';

interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  category_id?: number | '';
  status?: string;
  low_stock?: number | '';
}

export interface NextProductCode {
  sku: string;
  barcode: string;
}

export async function listProducts(params: ListParams = {}): Promise<Paginated<Product>> {
  const { data } = await http.get<ApiEnvelope<Product[]>>('/api/products', { params });
  return {
    rows: data.data,
    page: Number(data.meta?.page ?? 1),
    perPage: Number(data.meta?.per_page ?? 20),
    total: Number(data.meta?.total ?? 0),
    totalPages: Number(data.meta?.total_pages ?? 1),
  };
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await http.get<ApiEnvelope<Product>>(`/api/products/${id}`);
  return data.data;
}

export async function createProduct(payload: Partial<Product>): Promise<Product> {
  const { data } = await http.post<ApiEnvelope<Product>>('/api/products', payload);
  return data.data;
}

export async function updateProduct(id: number, payload: Partial<Product>): Promise<Product> {
  const { data } = await http.put<ApiEnvelope<Product>>(`/api/products/${id}`, payload);
  return data.data;
}

export async function setProductStatus(id: number, status: 'active' | 'inactive'): Promise<void> {
  await http.post(`/api/products/${id}/${status === 'active' ? 'activate' : 'deactivate'}`);
}

export async function deleteProduct(id: number): Promise<void> {
  await http.delete(`/api/products/${id}`);
}

export async function lookupByBarcode(barcode: string): Promise<Product> {
  const { data } = await http.get<ApiEnvelope<Product>>('/api/products/lookup', {
    params: { barcode },
  });
  return data.data;
}

export async function getNextProductCode(): Promise<NextProductCode> {
  const { data } = await http.get<ApiEnvelope<NextProductCode>>('/api/products/next-code');
  return data.data;
}