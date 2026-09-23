import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, ArrowLeft, ArrowDownRight, ArrowUpRight, Package, Sliders, RotateCcw,
  ShoppingCart, AlertCircle, Calendar, ImageOff,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { useToast } from '@/context/ToastContext';
import { listMovements } from '@/services/inventory';
import { listProducts } from '@/services/products';
import { imageUrl, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { StockMovement, Product } from '@/types/models';

export function MovementsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [productFilter, setProductFilter] = useState(params.get('product_id') ?? '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listProducts({ per_page: 100 });
        setProducts(res.rows);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMovements({
        page,
        per_page: 20,
        search: debounced || undefined,
        type: typeFilter || undefined,
        product_id: productFilter ? Number(productFilter) : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load movements');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, typeFilter, productFilter, fromDate, toDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const current = params.get('product_id') ?? '';
    if (current === productFilter) return;
    if (productFilter) setParams({ product_id: productFilter });
    else setParams({});
  }, [productFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('');
    setProductFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
    setParams({});
  };

  const hasFilters = search || typeFilter || productFilter || fromDate || toDate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Stock Movements</h1>
            <p className="text-sm text-muted-foreground">Every change to your inventory, in order</p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search product or SKU..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={productFilter} onChange={(e) => { setProductFilter(e.target.value); setPage(1); }}>
                <option value="">All products</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="return">Return</option>
                <option value="adjustment">Adjustment</option>
                <option value="correction">Correction</option>
                <option value="void">Void</option>
              </Select>
            </div>
            {hasFilters && (
              <div className="md:col-span-2 flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>Clear</Button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">From</span>
              <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} className="h-8 w-36" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} className="h-8 w-36" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading movements..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No movements match your filters' : 'No stock movements yet'}
              description={
                hasFilters
                  ? 'Try clearing filters.'
                  : 'Stock movements appear here as you create purchases, sales, and adjustments.'
              }
              action={hasFilters && (
                <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
              )}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Change</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Note</th>
                    <th className="px-4 py-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => {
                    const qty = Number(m.quantity);
                    const isPositive = qty > 0;
                    return (
                      <tr key={m.id} className="border-b last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {m.created_at.slice(0, 16)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{m.product_name}</div>
                          <div className="font-mono text-xs text-muted-foreground">{m.sku}</div>
                        </td>
                        <td className="px-4 py-3">
                          <MovementBadge type={m.type} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          <span className={
                            'inline-flex items-center gap-1 font-semibold ' +
                            (isPositive ? 'text-emerald-600' : 'text-red-600')
                          }>
                            {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {isPositive ? '+' : ''}{formatQty(qty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {m.reference_type
                            ? `${m.reference_type}${m.reference_id ? ` #${m.reference_id}` : ''}`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={m.note ?? ''}>
                          {m.note || '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{m.user_name ?? '—'}</td>
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
    </div>
  );
}

function MovementBadge({ type }: { type: StockMovement['type'] }) {
  const config: Record<StockMovement['type'], { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' | 'default'; Icon: typeof Package }> = {
    purchase: { label: 'Purchase', variant: 'success', Icon: ShoppingCart },
    sale: { label: 'Sale', variant: 'default', Icon: Package },
    return: { label: 'Return', variant: 'warning', Icon: RotateCcw },
    adjustment: { label: 'Adjustment', variant: 'secondary', Icon: Sliders },
    correction: { label: 'Correction', variant: 'warning', Icon: AlertCircle },
    void: { label: 'Void', variant: 'destructive', Icon: AlertCircle },
  };
  const { label, variant, Icon } = config[type] ?? config.adjustment;
  return (
    <Badge variant={variant as 'default'}>
      <Icon className="mr-1 h-3 w-3" /> {label}
    </Badge>
  );
}