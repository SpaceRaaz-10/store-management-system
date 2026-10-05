import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Eye, Search, Calendar, Printer, Banknote, ChevronRight, ChevronDown,
  Package, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/common/Pagination';
import { SaleViewDialog } from './SaleViewDialog';
import { AddSalePaymentDialog } from './AddSalePaymentDialog';
import { openSaleInvoice } from './saleInvoiceHtml';
import { useToast } from '@/context/ToastContext';
import { listSales, getSale } from '@/services/sales';
import { listCustomers } from '@/services/customers';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Sale, SaleListItem, Customer } from '@/types/models';

export function SalesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<SaleListItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [customerFilter, setCustomerFilter] = useState(params.get('customer_id') ?? '');
  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [viewId, setViewId] = useState<number | null>(null);
  const [printingId, setPrintingId] = useState<number | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedData, setExpandedData] = useState<Record<number, Sale>>({});
  const [expandingId, setExpandingId] = useState<number | null>(null);

  const [payingId, setPayingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      try {
        const res = await listCustomers({ per_page: 100 });
        setCustomers(res.rows);
      } catch { /* ignore */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSales({
        page,
        per_page: 10,
        search: debounced || undefined,
        customer_id: customerFilter ? Number(customerFilter) : undefined,
        status: statusFilter || undefined,
        payment_status: paymentFilter || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
      setExpandedId(null);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, customerFilter, statusFilter, paymentFilter, fromDate, toDate, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const current = params.get('customer_id') ?? '';
    if (current === customerFilter) return;
    if (customerFilter) setParams({ customer_id: customerFilter });
    else setParams({});
  }, [customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleToggleExpand = async (id: number) => {
    if (expandedId === id) { setExpandedId(null); return; }
    if (expandedData[id]) { setExpandedId(id); return; }
    setExpandingId(id);
    try {
      const full = await getSale(id);
      setExpandedData((prev) => ({ ...prev, [id]: full }));
      setExpandedId(id);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load sale');
    } finally {
      setExpandingId(null);
    }
  };

  const handleRowPrint = async (id: number) => {
    setPrintingId(id);
    try {
      const full = expandedData[id] ?? (await getSale(id));
      openSaleInvoice(full, true);
    } catch {
      toast.error('Failed to load invoice');
    } finally {
      setTimeout(() => setPrintingId(null), 400);
    }
  };

  const handleOpenPayment = async (id: number) => {
    try {
      const full = expandedData[id] ?? (await getSale(id));
      setExpandedData((prev) => ({ ...prev, [id]: full }));
      setPayingId(id);
    } catch {
      toast.error('Failed to load sale');
    }
  };

  const hasFilters = search || customerFilter || statusFilter || paymentFilter || fromDate || toDate;

  const resetFilters = () => {
    setSearch(''); setCustomerFilter(''); setStatusFilter(''); setPaymentFilter('');
    setFromDate(''); setToDate(''); setPage(1); setParams({});
  };

  const totalRevenue = rows.reduce((s, r) => s + Number(r.total_base), 0);
  const totalProfit = rows.reduce((s, r) => s + Number(r.profit_base), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
          <p className="text-sm text-muted-foreground">All sales transactions</p>
        </div>
        <Button onClick={() => navigate('/sales/new')}>
          <Plus className="h-4 w-4" /> New Sale
        </Button>
      </div>

      {!loading && rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Sales on this page</div>
              <div className="mt-1 text-2xl font-bold">{rows.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs uppercase text-muted-foreground">Revenue (NPR eq.)</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">{formatMoney(totalRevenue, 'रु')}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1 text-xs uppercase text-muted-foreground">
                <TrendingUp className="h-3 w-3" /> Profit (NPR)
              </div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{formatMoney(totalProfit, 'रु')}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search invoice # or customer..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}>
                <option value="">All customers</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                <option value="voided">Voided</option>
              </Select>
            </div>
            {hasFilters && (
              <div className="md:col-span-1 flex items-center justify-end">
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
            <Spinner label="Loading sales..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No sales match your filters' : 'No sales yet'}
              description={hasFilters ? 'Try clearing filters.' : 'Create your first sale.'}
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={resetFilters}>Clear filters</Button>
                ) : (
                  <Button onClick={() => navigate('/sales/new')}>
                    <Plus className="h-4 w-4" /> New Sale
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 px-2 py-3"></th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => {
                    const isExpanded = expandedId === s.id;
                    const isExpanding = expandingId === s.id;
                    const detail = expandedData[s.id];
                    return (
                      <>
                        <tr
                          key={s.id}
                          className={
                            'border-b transition-colors ' +
                            (isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/60')
                          }
                        >
                          <td className="px-2 py-3">
                            <button
                              type="button"
                              onClick={() => handleToggleExpand(s.id)}
                              disabled={isExpanding}
                              className="flex h-6 w-6 items-center justify-center rounded hover:bg-accent disabled:opacity-50"
                            >
                              {isExpanding ? (
                                <Spinner className="!py-0 !px-0" />
                              ) : isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{s.invoice_no}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.sale_date}</td>
                          <td className="px-4 py-3 font-medium">{s.customer_name ?? 'Walk-in'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {detail ? (
                              `${detail.items.length} item${detail.items.length === 1 ? '' : 's'}`
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleToggleExpand(s.id)}
                                className="text-primary hover:underline"
                              >
                                Show items
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatMoney(s.total, s.currency_symbol)}
                            {s.currency_code !== 'NPR' && (
                              <div className="text-xs text-muted-foreground">{s.currency_code}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatMoney(s.paid_amount, s.currency_symbol)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={
                              s.payment_status === 'paid' ? 'success' :
                              s.payment_status === 'partial' ? 'warning' : 'secondary'
                            }>{s.payment_status}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={s.status === 'completed' ? 'success' : 'destructive'}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" title="View details" onClick={() => setViewId(s.id)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" title="Print invoice"
                                disabled={printingId === s.id}
                                onClick={() => handleRowPrint(s.id)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {s.status === 'completed' && Number(s.due_amount) > 0.001 && (
                                <Button variant="ghost" size="icon" title="Add payment" onClick={() => handleOpenPayment(s.id)}>
                                  <Banknote className="h-4 w-4 text-emerald-600" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && detail && (
                          <tr key={`${s.id}-detail`} className="border-b bg-slate-50/70">
                            <td colSpan={10} className="px-4 py-3">
                              <div className="rounded-md border bg-white">
                                <div className="flex items-center gap-2 border-b bg-slate-50/60 px-4 py-2 text-xs font-medium text-muted-foreground">
                                  <Package className="h-3.5 w-3.5" />
                                  Items in {detail.invoice_no}
                                </div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs uppercase text-muted-foreground">
                                      <th className="px-4 py-2">Product</th>
                                      <th className="px-4 py-2">SKU</th>
                                      <th className="px-4 py-2 text-right">Qty</th>
                                      <th className="px-4 py-2 text-right">Unit Price</th>
                                      <th className="px-4 py-2 text-right">Line Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.items.map((it) => (
                                      <tr key={it.id} className="border-t">
                                        <td className="px-4 py-2 font-medium">{it.product_name}</td>
                                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{it.sku}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{formatMoney(it.unit_price, detail.currency_symbol)}</td>
                                        <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(it.line_total, detail.currency_symbol)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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

      <SaleViewDialog
        open={viewId !== null}
        onClose={() => setViewId(null)}
        saleId={viewId}
      />

      {payingId !== null && (
        <AddSalePaymentDialog
          open={true}
          onClose={() => setPayingId(null)}
          onSaved={() => {
            setExpandedData({});
            load();
          }}
          sale={expandedData[payingId] ?? null}
        />
      )}
    </div>
  );
}