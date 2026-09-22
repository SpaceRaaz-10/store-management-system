import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Plus, Pencil, Power, Trash2, Search, ScanLine, AlertTriangle, ImageOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { ProductFormDialog } from './ProductFormDialog';
import { useToast } from '@/context/ToastContext';
import { listCategories } from '@/services/categories';
import {
  listProducts, setProductStatus, deleteProduct, lookupByBarcode,
} from '@/services/products';
import { imageUrl, formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Category, Product } from '@/types/models';

export function ProductsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<Product | null>(null);
  const [acting, setActing] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

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
      const res = await listProducts({
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
      toast.error((err as ApiError).message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, categoryFilter, statusFilter, lowStockOnly, toast]);

  useEffect(() => { load(); }, [load]);

  const handleBarcodeLookup = async (value: string) => {
    const code = value.trim();
    if (!code) return;
    try {
      const product = await lookupByBarcode(code);
      setEditing(product);
      setFormOpen(true);
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 404) toast.error(`No product with barcode "${code}"`);
      else toast.error(apiErr.message || 'Lookup failed');
    } finally {
      if (barcodeInputRef.current) barcodeInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await deleteProduct(confirmDelete.id);
      toast.success('Product deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Delete failed');
    } finally {
      setActing(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmStatus) return;
    setActing(true);
    try {
      const next = confirmStatus.status === 'active' ? 'inactive' : 'active';
      await setProductStatus(confirmStatus.id, next);
      toast.success(`Product ${next === 'active' ? 'activated' : 'deactivated'}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

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
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Product
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, SKU, or barcode..."
                className="pl-9"
              />
            </div>

            <div className="md:col-span-3">
              <Select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              >
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            <div className="md:col-span-2">
              <Select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
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
                Low stock
              </label>
            </div>

            {hasFilters && (
              <div className="md:col-span-1 flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-md border border-dashed bg-slate-50 px-3 py-2">
            <ScanLine className="h-4 w-4 text-muted-foreground" />
            <Input
              ref={barcodeInputRef}
              placeholder="Scan or type barcode, then press Enter"
              className="h-8 flex-1 border-0 bg-transparent focus-visible:ring-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeLookup((e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading products..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No products match your filters' : 'No products yet'}
              description={hasFilters ? 'Try clearing filters or search.' : 'Create your first product to get started.'}
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
                ) : (
                  <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                    <Plus className="h-4 w-4" /> New Product
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">SKU / Barcode</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const img = imageUrl(p.image_path);
                    const low = Number(p.stock_qty) <= Number(p.reorder_level);
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50/60">
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
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs">{p.sku}</div>
                          {p.barcode && <div className="font-mono text-xs text-muted-foreground">{p.barcode}</div>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.category_name ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{formatMoney(p.cost_price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums font-medium">{formatMoney(p.selling_price)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={low ? 'font-semibold text-amber-600' : ''}>
                            {formatQty(p.stock_qty)}
                          </span>
                          {low && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />}
                          <div className="text-xs text-muted-foreground">reorder at {formatQty(p.reorder_level)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(p); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title={p.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => setConfirmStatus(p)}>
                              <Power className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(p)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
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

      <ProductFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete product?"
        message={`"${confirmDelete?.name}" will be permanently removed. Products with transaction history cannot be deleted — use deactivate instead.`}
        confirmLabel="Delete"
        destructive
        loading={acting}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleToggleStatus}
        title={confirmStatus?.status === 'active' ? 'Deactivate product?' : 'Activate product?'}
        message={
          confirmStatus?.status === 'active'
            ? `"${confirmStatus?.name}" will be hidden from sales.`
            : `"${confirmStatus?.name}" will become available for sale again.`
        }
        confirmLabel={confirmStatus?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={acting}
      />
    </div>
  );
}