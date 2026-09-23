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