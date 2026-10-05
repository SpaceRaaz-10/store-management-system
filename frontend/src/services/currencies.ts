import { http } from './http';
import type { ApiEnvelope } from '@/types/api';
import type { Currency, PaymentMethod } from '@/types/models';

export interface CurrencyWithRate extends Currency {
  rate_to_base: number | null;
  effective_at: string | null;
  rate_id: number | null;
}

export interface ExchangeRateRow {
  id: number;
  rate_to_base: string;
  effective_at: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  created_by_name: string | null;
}

export async function listCurrencies(): Promise<CurrencyWithRate[]> {
  const { data } = await http.get<ApiEnvelope<CurrencyWithRate[]>>('/api/currencies');
  return data.data;
}

export async function listAllCurrencies(): Promise<Currency[]> {
  const { data } = await http.get<ApiEnvelope<Currency[]>>('/api/currencies/all');
  return data.data;
}

export async function createCurrency(payload: { code: string; name: string; symbol: string; decimal_places?: number }): Promise<Currency> {
  const { data } = await http.post<ApiEnvelope<Currency>>('/api/currencies', payload);
  return data.data;
}

export async function updateCurrency(id: number, payload: { name: string; symbol: string; decimal_places?: number }): Promise<Currency> {
  const { data } = await http.put<ApiEnvelope<Currency>>(`/api/currencies/${id}`, payload);
  return data.data;
}

export async function setCurrencyStatus(id: number, active: boolean): Promise<void> {
  await http.post(`/api/currencies/${id}/${active ? 'activate' : 'deactivate'}`);
}

export async function deleteCurrency(id: number): Promise<void> {
  await http.delete(`/api/currencies/${id}`);
}

export async function getRateHistory(currencyId: number): Promise<ExchangeRateRow[]> {
  const { data } = await http.get<ApiEnvelope<ExchangeRateRow[]>>('/api/exchange-rates/history', {
    params: { currency_id: currencyId },
  });
  return data.data;
}

export async function createExchangeRate(payload: { currency_id: number; rate_to_base: number; effective_at: string }): Promise<void> {
  await http.post('/api/exchange-rates', payload);
}

export async function deleteExchangeRate(id: number): Promise<void> {
  await http.delete(`/api/exchange-rates/${id}`);
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await http.get<ApiEnvelope<PaymentMethod[]>>('/api/payment-methods');
  return data.data;
}