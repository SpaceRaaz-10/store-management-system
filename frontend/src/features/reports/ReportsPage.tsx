import { useCallback, useEffect, useState } from 'react';
import {
  Calendar, Download, FileSpreadsheet, Loader2, Search, TrendingUp, TrendingDown,
  Filter, X, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';
import { listCategories } from '@/services/categories';
import {
  getSalesReport, getPurchaseReport, getInventoryReport, getLowStockReport,
  getRevenueProfit, getTransactions, getProductSales, downloadReport,
} from '@/services/reports';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type {
  ReportFilters, SalesReportResult, PurchaseReportResult, InventoryReportResult,
  LowStockReportRow, RevenueProfitResult, TransactionRow, ProductSalesResult,
  Category,
} from '@/types/models';

type TabKey = 'sales' | 'purchases' | 'inventory' | 'low-stock' | 'revenue-profit' | 'transactions' | 'product-sales';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'low-stock', label: 'Low Stock' },
  { key: 'revenue-profit', label: 'Revenue / Profit' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'product-sales', label: 'Product Sales' },
];

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>('sales');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'excel' | 'csv' | null>(null);

  // Filters
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [categoryId, setCategoryId] = useState<string>('');
  const [txnType, setTxnType] = useState<string>('');
  const [search, setSearch] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);

  // Data caches per tab
  const [sales, setSales] = useState<SalesReportResult | null>(null);
  const [purchases, setPurchases] = useState<PurchaseReportResult | null>(null);
  const [inventory, setInventory] = useState<InventoryReportResult | null>(null);
  const [lowStock, setLowStock] = useState<LowStockReportRow[] | null>(null);
  const [revenue, setRevenue] = useState<RevenueProfitResult | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[] | null>(null);
  const [productSales, setProductSales] = useState<ProductSalesResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await listCategories({ per_page: 100 });
        setCategories(res.rows);
      } catch { /* ignore */ }
    })();
  }, []);

  const currentFilters = (): ReportFilters => ({
    from: from || undefined,
    to: to || undefined,
    group_by: groupBy,
    category_id: categoryId === '' ? undefined : Number(categoryId),
    type: txnType || undefined,
    search: search || undefined,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const f = currentFilters();
    try {
      switch (tab) {
        case 'sales':
          setSales(await getSalesReport(f));
          break;
        case 'purchases':
          setPurchases(await getPurchaseReport(f));
          break;
        case 'inventory':
          setInventory(await getInventoryReport(f));
          break;
        case 'low-stock': {
          const r = await getLowStockReport(f);
          setLowStock(r.rows);
          break;
        }
        case 'revenue-profit':
          setRevenue(await getRevenueProfit(f));
          break;
        case 'transactions': {
          const r = await getTransactions(f, 1, 100);
          setTransactions(r.rows);
          break;
        }
        case 'product-sales':
          setProductSales(await getProductSales(f));
          break;
      }
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [tab, from, to, groupBy, categoryId, txnType, search, toast]);

  useEffect(() => { load(); }, [load]);

  const handleExport = (format: 'excel' | 'csv') => {
    setExporting(format);
    try {
      downloadReport(tab, currentFilters(), format);
      toast.success(`Downloading ${format === 'excel' ? 'Excel' : 'CSV'} file...`);
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setTimeout(() => setExporting(null), 800);
    }
  };

  const resetFilters = () => {
    setFrom(defaultFrom());
    setTo(today());
    setGroupBy('day');
    setCategoryId('');
    setTxnType('');
    setSearch('');
  };

  const hasDateFilters = tab === 'sales' || tab === 'purchases' || tab === 'revenue-profit' || tab === 'transactions' || tab === 'product-sales';
  const hasGroupBy = tab === 'sales' || tab === 'purchases';
  const hasCategoryFilter = tab === 'inventory' || tab === 'low-stock' || tab === 'product-sales';
  const hasTypeFilter = tab === 'transactions';
  const hasSearch = tab === 'inventory' || tab === 'transactions';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Business analytics and exports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting !== null}>
            {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            CSV
          </Button>
          <Button onClick={() => handleExport('excel')} disabled={exporting !== null}>
            {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Download Excel
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              'relative -mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
              (tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filters
          </div>
          <div className="grid gap-3 md:grid-cols-12">
            {hasDateFilters && (
              <>
                <div className="md:col-span-3">
                  <Label className="text-xs">From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </>
            )}
            {hasGroupBy && (
              <div className="md:col-span-2">
                <Label className="text-xs">Group by</Label>
                <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month' | 'year')}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </Select>
              </div>
            )}
            {hasCategoryFilter && (
              <div className="md:col-span-2">
                <Label className="text-xs">Category</Label>
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>
            )}
            {hasTypeFilter && (
              <div className="md:col-span-2">
                <Label className="text-xs">Type</Label>
                <Select value={txnType} onChange={(e) => setTxnType(e.target.value)}>
                  <option value="">All types</option>
                  <option value="sale">Sales only</option>
                  <option value="purchase">Purchases only</option>
                </Select>
              </div>
            )}
            {hasSearch && (
              <div className="md:col-span-3">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-9"
                  />
                </div>
              </div>
            )}
            <div className={hasDateFilters || hasGroupBy || hasCategoryFilter || hasTypeFilter || hasSearch ? 'md:col-span-1 flex items-end' : 'hidden'}>
              <Button variant="ghost" size="sm" onClick={resetFilters} title="Reset filters">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report body */}
      {loading ? (
        <Card><CardContent><Spinner label="Loading report..." /></CardContent></Card>
      ) : (
        <>
          {tab === 'sales' && sales && <SalesTable data={sales} />}
          {tab === 'purchases' && purchases && <PurchasesTable data={purchases} />}
          {tab === 'inventory' && inventory && <InventoryTable data={inventory} />}
          {tab === 'low-stock' && lowStock && <LowStockTable rows={lowStock} />}
          {tab === 'revenue-profit' && revenue && <RevenueProfitView data={revenue} />}
          {tab === 'transactions' && transactions && <TransactionsTable rows={transactions} />}
          {tab === 'product-sales' && productSales && <ProductSalesTable data={productSales} />}
        </>
      )}
    </div>
  );
}

// ---------- Sub-views ----------

function SummaryStrip({ items }: { items: Array<{ label: string; value: string; accent?: 'emerald' | 'amber' | 'red' }> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {items.map((i) => (
        <Card key={i.label}>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{i.label}</div>
            <div className={
              'mt-1 text-xl font-bold tabular-nums ' +
              (i.accent === 'emerald' ? 'text-emerald-700' :
               i.accent === 'amber' ? 'text-amber-700' :
               i.accent === 'red' ? 'text-red-700' : '')
            }>{i.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SalesTable({ data }: { data: SalesReportResult }) {
  if (data.rows.length === 0) return <EmptyState title="No sales in this period" />;
  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: 'Orders', value: String(data.totals.order_count) },
        { label: 'Revenue (NPR)', value: formatMoney(data.totals.revenue_base, 'रु') },
        { label: 'Discount (NPR)', value: formatMoney(data.totals.discount_base, 'रु') },
        { label: 'Profit (NPR)', value: formatMoney(data.totals.profit_base, 'रु'), accent: 'emerald' },
      ]} />
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2 text-right">Orders</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
                <th className="px-4 py-2 text-right">Discount</th>
                <th className="px-4 py-2 text-right">Tax</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.period} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{r.period}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.order_count}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.subtotal_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(r.discount_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(r.tax_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(r.revenue_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-700">{formatMoney(r.profit_base, 'रु')}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50 font-semibold">
                <td className="px-4 py-2">TOTAL</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.order_count}</td>
                <td className="px-4 py-2 text-right">—</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.discount_base, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.tax_base, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.revenue_base, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(data.totals.profit_base, 'रु')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function PurchasesTable({ data }: { data: PurchaseReportResult }) {
  if (data.rows.length === 0) return <EmptyState title="No purchases in this period" />;
  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: 'Orders', value: String(data.totals.order_count) },
        { label: 'Total (NPR)', value: formatMoney(data.totals.total_base, 'रु') },
        { label: 'Paid (NPR)', value: formatMoney(data.totals.paid_base, 'रु'), accent: 'emerald' },
        { label: 'Due (NPR)', value: formatMoney(data.totals.due_base, 'रु'), accent: 'amber' },
      ]} />
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Period</th>
                <th className="px-4 py-2 text-right">Orders</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.period} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{r.period}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.order_count}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(r.total_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(r.paid_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-amber-700">{formatMoney(r.due_base, 'रु')}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50 font-semibold">
                <td className="px-4 py-2">TOTAL</td>
                <td className="px-4 py-2 text-right tabular-nums">{data.totals.order_count}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.total_base, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(data.totals.paid_base, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700">{formatMoney(data.totals.due_base, 'रु')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function InventoryTable({ data }: { data: InventoryReportResult }) {
  if (data.rows.length === 0) return <EmptyState title="No products match the filters" />;
  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: 'Products', value: String(data.totals.item_count) },
        { label: 'Stock Value (Cost)', value: formatMoney(data.totals.total_stock_value_cost, 'रु') },
        { label: 'Stock Value (Retail)', value: formatMoney(data.totals.total_stock_value_retail, 'रु') },
        { label: 'Potential Profit', value: formatMoney(data.totals.total_stock_value_retail - data.totals.total_stock_value_cost, 'रु'), accent: 'emerald' },
      ]} />
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Reorder</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Value (Cost)</th>
                <th className="px-4 py-2 text-right">Value (Retail)</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className={'border-b last:border-0 ' + (r.stock_status === 'low' ? 'bg-amber-50/40' : 'hover:bg-slate-50/60')}>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.category_name ?? '—'}</td>
                  <td className={'px-4 py-2 text-right tabular-nums ' + (r.stock_status === 'low' ? 'text-amber-700 font-semibold' : '')}>
                    {formatQty(r.stock_qty)} {r.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatQty(r.reorder_level)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.cost_price, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.stock_value_cost, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(r.stock_value_retail, 'रु')}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50 font-semibold">
                <td className="px-4 py-2" colSpan={6}>TOTAL ({data.totals.item_count} items)</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.total_stock_value_cost, 'रु')}</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(data.totals.total_stock_value_retail, 'रु')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function LowStockTable({ rows }: { rows: LowStockReportRow[] }) {
  if (rows.length === 0) {
    return <EmptyState title="All products are well-stocked" description="No products are below their reorder level." />;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <TrendingDown className="h-4 w-4 shrink-0" />
        <span><strong>{rows.length}</strong> product{rows.length === 1 ? '' : 's'} need restocking</span>
      </div>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Stock</th>
                <th className="px-4 py-2 text-right">Reorder</th>
                <th className="px-4 py-2 text-right">Shortfall</th>
                <th className="px-4 py-2">Last Supplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 bg-amber-50/30 hover:bg-amber-50/60">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.category_name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-amber-700">
                    {formatQty(r.stock_qty)} {r.unit}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatQty(r.reorder_level)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600">{formatQty(r.shortfall)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.default_supplier_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}

function RevenueProfitView({ data }: { data: RevenueProfitResult }) {
  const s = data.summary;
  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: 'Revenue (NPR)', value: formatMoney(s.revenue_base, 'रु') },
        { label: 'COGS (NPR)', value: formatMoney(s.cogs_base, 'रु') },
        { label: 'Profit (NPR)', value: formatMoney(s.profit_base, 'रु'), accent: 'emerald' },
        { label: 'Margin', value: `${s.margin_percent}%`, accent: s.margin_percent >= 0 ? 'emerald' : 'red' },
      ]} />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* By currency */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
              Revenue by Currency
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2">Currency</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Original</th>
                  <th className="px-4 py-2 text-right">NPR Equivalent</th>
                </tr>
              </thead>
              <tbody>
                {data.by_currency.map((c) => (
                  <tr key={c.code} className="border-t">
                    <td className="px-4 py-2 font-medium">{c.code}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.order_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(c.revenue_original, c.symbol)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(c.revenue_base, 'रु')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* By month */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
              Monthly Breakdown
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Orders</th>
                  <th className="px-4 py-2 text-right">Revenue</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {data.by_month.map((m) => (
                  <tr key={m.period} className="border-t">
                    <td className="px-4 py-2 font-medium">{m.period}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{m.order_count}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatMoney(m.revenue_base, 'रु')}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(m.profit_base, 'रु')}</td>
                  </tr>
                ))}
                {data.by_month.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">No data</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4 text-sm">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Total Orders</div>
            <div className="mt-1 font-semibold tabular-nums">{s.order_count}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Subtotal</div>
            <div className="mt-1 font-semibold tabular-nums">{formatMoney(s.subtotal_base, 'रु')}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Discounts</div>
            <div className="mt-1 font-semibold tabular-nums text-amber-700">{formatMoney(s.discount_base, 'रु')}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground">Tax Collected</div>
            <div className="mt-1 font-semibold tabular-nums">{formatMoney(s.tax_base, 'रु')}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  if (rows.length === 0) return <EmptyState title="No transactions in this period" />;
  return (
    <Card><CardContent className="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Party</th>
              <th className="px-4 py-2 text-right">Amount</th>
              <th className="px-4 py-2 text-right">NPR</th>
              <th className="px-4 py-2">Payment</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.txn_type}-${r.ref_id}-${i}`} className="border-b last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{r.txn_date}</td>
                <td className="px-4 py-2">
                  <Badge variant={r.txn_type === 'sale' ? 'success' : 'default'}>
                    {r.txn_type === 'sale' ? 'Sale' : 'Purchase'}
                  </Badge>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{r.reference}</td>
                <td className="px-4 py-2 font-medium">{r.party_name}</td>
                <td className="px-4 py-2 text-right tabular-nums">
                  {formatMoney(r.amount, r.currency_symbol)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                  {formatMoney(r.amount_base, 'रु')}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={
                    r.payment_status === 'paid' ? 'success' :
                    r.payment_status === 'partial' ? 'warning' : 'secondary'
                  }>{r.payment_status}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Badge variant={r.status === 'completed' ? 'success' : 'destructive'}>{r.status}</Badge>
                </td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{r.user_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent></Card>
  );
}

function ProductSalesTable({ data }: { data: ProductSalesResult }) {
  if (data.rows.length === 0) return <EmptyState title="No product sales in this period" />;
  return (
    <div className="space-y-4">
      <SummaryStrip items={[
        { label: 'Products Sold', value: String(data.rows.length) },
        { label: 'Total Qty', value: formatQty(data.totals.qty_sold) },
        { label: 'Revenue (NPR)', value: formatMoney(data.totals.revenue_base, 'रु') },
        { label: 'Profit (NPR)', value: formatMoney(data.totals.profit_base, 'रु'), accent: 'emerald' },
      ]} />
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2 text-right">Qty Sold</th>
                <th className="px-4 py-2 text-right">Returned</th>
                <th className="px-4 py-2 text-right">Revenue</th>
                <th className="px-4 py-2 text-right">COGS</th>
                <th className="px-4 py-2 text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.category_name ?? '—'}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatQty(r.qty_sold)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatQty(r.qty_returned)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{formatMoney(r.revenue_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{formatMoney(r.cogs_base, 'रु')}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-emerald-700">{formatMoney(r.profit_base, 'रु')}</td>
                </tr>
              ))}
              <tr className="bg-indigo-50 font-semibold">
                <td className="px-4 py-2" colSpan={3}>TOTAL</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatQty(data.totals.qty_sold)}</td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(data.totals.revenue_base, 'रु')}</td>
                <td className="px-4 py-2"></td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{formatMoney(data.totals.profit_base, 'रु')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent></Card>
    </div>
  );
}