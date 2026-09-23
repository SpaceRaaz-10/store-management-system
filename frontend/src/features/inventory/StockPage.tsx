import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, AlertTriangle, ImageOff, Sliders, History, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { AdjustStockDialog } from './AdjustStockDialog';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { listStock } from '@/services/inventory';
import { listCategories } from '@/services/categories';
import { imageUrl, formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { StockRow, Category } from '@/types/models';

export function StockPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState<StockRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [adjusting, setAdjusting] = useState<StockRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listCategories({ per_page: 100 });
        setCategories(res.rows);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listStock({
        page,
        per_page: 10,
        search: debounced || undefined,
        category_id: categoryFilter ? Number(categoryFilter) : undefined,
        status: statusFilter || undefined,
        low_stock: lowStockOnly ? 1 : undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, categoryFilter, statusFilter, lowStockOnly, toast]);

  useEffect(() => { load(); }, [load]);

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
    setLowStockOnly(false);
    setPage(1);
  };

  const hasFilters = search || categoryFilter || statusFilter || lowStockOnly;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Current stock across all products</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/inventory/movements')}>
            <History className="h-4 w-4" /> Movements
          </Button>
          <Button variant="outline" onClick={() => navigate('/inventory/low-stock')}>
            <AlertTriangle className="h-4 w-4" /> Low Stock
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-5">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search name, SKU or barcode..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            <div className="md:col-span-2 flex items-center">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => { setLowStockOnly(e.target.checked); setPage(1); }}
                  className="h-4 w-4"
                />
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Low stock only
              </label>
            </div>
          </div>

          {hasFilters && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading stock..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No products match your filters' : 'No products yet'}
              description={hasFilters ? 'Try clearing filters.' : 'Add products first to see them here.'}
              action={hasFilters ? (
                <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
              ) : (
                <Button onClick={() => navigate('/products')}>
                  Go to Products <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Reorder At</th>
                    <th className="px-4 py-3 text-right">Stock Value</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const img = imageUrl(p.image_path);
                    const stock = Number(p.stock_qty);
                    const reorder = Number(p.reorder_level);
                    const low = stock <= reorder;
                    const value = stock * Number(p.cost_price);

                    return (
                      <tr key={p.id} className={
                        'border-b last:border-0 ' +
                        (low ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50/60')
                      }>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-50">
                              {img ? (
                                <img src={img} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <ImageOff className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <div className="font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{p.unit}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.category_name ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={low ? 'font-semibold text-amber-600' : 'font-medium'}>
                            {formatQty(p.stock_qty)}
                          </span>
                          {low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatQty(p.reorder_level)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatMoney(value, 'रु')}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Adjust stock"
                                onClick={() => setAdjusting(p)}
                              >
                                <Sliders className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View movements"
                              onClick={() => navigate(`/inventory/movements?product_id=${p.id}`)}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      )}

      <AdjustStockDialog
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        onSaved={load}
        product={adjusting}
      />
    </div>
  );
}