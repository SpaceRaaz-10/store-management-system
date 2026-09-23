import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Currency, PaymentMethod } from '@/types/models';

export async function listCurrencies(): Promise<Currency[]> {
  const { data } = await http.get<ApiEnvelope<Currency[]>>('/api/currencies');
  return data.data;
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await http.get<ApiEnvelope<PaymentMethod[]>>('/api/payment-methods');
  return data.data;
}