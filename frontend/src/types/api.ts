export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  errors: Record<string, string[]> | null;
  meta: Record<string, unknown> | null;
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
  last_login_at?: string | null;
  created_at?: string;
}