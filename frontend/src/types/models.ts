export interface Category {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  category_id: number | null;
  category_name: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  unit: string;
  cost_price: string;
  selling_price: string;
  stock_qty: string;
  reorder_level: string;
  image_path: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  rows: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_base: 0 | 1;
  is_active: 0 | 1;
  rate_to_base: number | null;
}

export interface PaymentMethod {
  id: number;
  code: string;
  name: string;
  is_active: number;
}

export interface PurchaseListItem {
  id: number;
  invoice_no: string;
  supplier_id: number;
  supplier_name: string;
  user_id: number;
  user_name: string;
  currency_id: number;
  currency_code: string;
  currency_symbol: string;
  exchange_rate_to_base: string;
  purchase_date: string;
  subtotal: string;
  discount_amount: string;
  tax_amount: string;
  total: string;
  total_base: string;
  paid_amount: string;
  due_amount: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  status: 'draft' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  quantity: string;
  unit_cost: string;
  unit_cost_base: string;
  line_total: string;
  line_total_base: string;
}

export interface Purchase extends PurchaseListItem {
  supplier_contact: string | null;
  supplier_phone: string | null;
  supplier_email: string | null;
  items: PurchaseItem[];
}

export interface PurchasePayload {
  supplier_id: number;
  currency_id: number;
  purchase_date: string;
  discount_type: 'fixed' | 'percent' | null;
  discount_value: number;
  tax_rate: number;
  paid_amount: number;
  payment_method_id: number | null;
  notes: string | null;
  items: Array<{
    product_id: number;
    quantity: number;
    unit_cost: number;
  }>;
}

export interface StockRow {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  cost_price: string;
  selling_price: string;
  stock_qty: string;
  reorder_level: string;
  status: 'active' | 'inactive';
  image_path: string | null;
  category_id: number | null;
  category_name: string | null;
}

export interface StockMovement {
  id: number;
  product_id: number;
  product_name: string;
  sku: string;
  type: 'purchase' | 'sale' | 'return' | 'adjustment' | 'void' | 'correction';
  quantity: string;
  reference_type: string | null;
  reference_id: number | null;
  unit_cost_base: string | null;
  user_id: number | null;
  user_name: string | null;
  note: string | null;
  created_at: string;
}

export interface LowStockRow {
  id: number;
  name: string;
  sku: string;
  unit: string;
  stock_qty: string;
  reorder_level: string;
  status: 'active' | 'inactive';
  image_path: string | null;
  category_name: string | null;
}

export interface AdjustStockPayload {
  product_id: number;
  mode: 'set' | 'delta';
  value: number;
  reason: string;
}