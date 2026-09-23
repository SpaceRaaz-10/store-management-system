import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Eye, XCircle, Search, Calendar, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { PurchaseViewDialog } from './PurchaseViewDialog';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { listPurchases, cancelPurchase } from '@/services/purchases';
import { listSuppliers } from '@/services/suppliers';
import { formatMoney } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { PurchaseListItem, Supplier } from '@/types/models';

export function PurchasesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<PurchaseListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(params.get('supplier_id') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [viewId, setViewId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<PurchaseListItem | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listSuppliers({ per_page: 100 });
        setSuppliers(res.rows);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPurchases({
        page,
        per_page: 10,
        search: debounced || undefined,
        supplier_id: supplierFilter ? Number(supplierFilter) : undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, supplierFilter, statusFilter, paymentFilter, fromDate, toDate, toast]);

  useEffect(() => { load(); }, [load]);

  // Keep URL in sync when the supplier filter changes
  useEffect(() => {
    const current = params.get('supplier_id') ?? '';
    if (current === supplierFilter) return;
    if (supplierFilter) setParams({ supplier_id: supplierFilter });
    else setParams({});
  }, [supplierFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setActing(true);
    try {
      await cancelPurchase(confirmCancel.id);
      toast.success('Purchase cancelled — stock reversed');
      setConfirmCancel(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Cancellation failed');
    } finally {
      setActing(false);
    }
  };

  const hasFilters = search || supplierFilter || statusFilter || paymentFilter || fromDate || toDate;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">Restock history from suppliers</p>
        </div>
        <Button onClick={() => navigate('/purchases/new')}>
          <Plus className="h-4 w-4" /> New Purchase
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search invoice # or supplier..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}>
                <option value="">All suppliers</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}>
                <option value="">Payment</option>
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Status</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            {hasFilters && (
              <div className="md:col-span-1 flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => {
                  setSearch(''); setSupplierFilter(''); setStatusFilter(''); setPaymentFilter('');
                  setFromDate(''); setToDate(''); setPage(1); setParams({});
                }}>
                  Clear
                </Button>
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
            <Spinner label="Loading purchases..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No purchases match your filters' : 'No purchases yet'}
              description={hasFilters ? 'Try clearing filters.' : 'Record your first purchase from a supplier.'}
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={() => {
                    setSearch(''); setSupplierFilter(''); setStatusFilter(''); setPaymentFilter('');
                    setFromDate(''); setToDate(''); setParams({});
                  }}>Clear filters</Button>
                ) : (
                  <Button onClick={() => navigate('/purchases/new')}>
                    <Plus className="h-4 w-4" /> New Purchase
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs">{p.invoice_no}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.purchase_date}</td>
                      <td className="px-4 py-3 font-medium">{p.supplier_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatMoney(p.total, p.currency_symbol)}
                        {p.currency_code !== 'NPR' && (
                          <div className="text-xs text-muted-foreground">{p.currency_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatMoney(p.paid_amount, p.currency_symbol)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          p.payment_status === 'paid' ? 'success' :
                          p.payment_status === 'partial' ? 'warning' : 'secondary'
                        }>{p.payment_status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === 'completed' ? 'success' : 'destructive'}>{p.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="View" onClick={() => setViewId(p.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Print" onClick={() => { setViewId(p.id); setTimeout(() => window.print(), 400); }}>
                            <Printer className="h-4 w-4" />
                          </Button>
                          {isAdmin && p.status === 'completed' && (
                            <Button variant="ghost" size="icon" title="Cancel" onClick={() => setConfirmCancel(p)}>
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      )}

      <PurchaseViewDialog
        open={viewId !== null}
        onClose={() => setViewId(null)}
        purchaseId={viewId}
      />

      <ConfirmDialog
        open={!!confirmCancel}
        onClose={() => setConfirmCancel(null)}
        onConfirm={handleCancel}
        title="Cancel this purchase?"
        message={`Invoice ${confirmCancel?.invoice_no} will be marked cancelled and stock will be reversed. This cannot be undone.`}
        confirmLabel="Cancel Purchase"
        destructive
        loading={acting}
      />
    </div>
  );
}