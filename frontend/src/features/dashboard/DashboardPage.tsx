import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Users, Truck, AlertTriangle, Receipt, RotateCcw, XCircle,
  TrendingUp, TrendingDown, ArrowRight, RefreshCw, Boxes, DollarSign,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';
import { getDashboardStats } from '@/services/dashboard';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { DashboardStats } from '@/types/models';

export function DashboardPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getDashboardStats();
      setStats(s);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner label="Loading dashboard..." />
      </div>
    );
  }

  if (!stats) {
    return (
      <EmptyState
        title="Dashboard unavailable"
        description="Could not load statistics."
        action={<Button onClick={load}>Try Again</Button>}
      />
    );
  }

  const t = stats.totals;
  const s = stats.sales;

  const trendData = stats.trend.map((p) => ({
    date: p.date.slice(5),
    revenue: Number(p.revenue),
    profit: Number(p.profit),
    count: p.count,
  }));

  const topData = stats.top_products.map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
    revenue: Number(p.revenue_base),
    qty: Number(p.qty_sold),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Business overview</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Sales summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Sales"
          value={String(s.today.count)}
          subtitle={formatMoney(s.today.revenue, 'रु')}
          profit={s.today.profit}
          icon={Receipt}
          accent="blue"
        />
        <StatCard
          label="This Month"
          value={String(s.month.count)}
          subtitle={formatMoney(s.month.revenue, 'रु')}
          profit={s.month.profit}
          icon={TrendingUp}
          accent="emerald"
        />
        <StatCard
          label="All-Time Revenue"
          value={formatMoney(s.all_time.revenue, 'रु')}
          subtitle={`${s.all_time.count} sales`}
          profit={s.all_time.profit}
          icon={DollarSign}
          accent="indigo"
        />
        <StatCard
          label="Low Stock Alerts"
          value={String(t.low_stock_count)}
          subtitle={t.low_stock_count > 0 ? 'Needs restocking' : 'All good'}
          icon={AlertTriangle}
          accent={t.low_stock_count > 0 ? 'amber' : 'slate'}
          onClick={() => navigate('/inventory/low-stock')}
        />
      </div>

      {/* Quick entity counts */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Products" value={t.active_products} icon={Package} onClick={() => navigate('/products')} />
        <MiniStat label="Customers" value={t.total_customers} icon={Users} onClick={() => navigate('/customers')} />
        <MiniStat label="Suppliers" value={t.total_suppliers} icon={Truck} onClick={() => navigate('/suppliers')} />
        <MiniStat label="Inventory" value="→" icon={Boxes} onClick={() => navigate('/inventory')} />
        <MiniStat
          label="Pending Returns"
          value={t.pending_returns}
          icon={RotateCcw}
          accent={t.pending_returns > 0 ? 'amber' : undefined}
          onClick={() => navigate('/returns?status=pending')}
        />
        <MiniStat
          label="Pending Voids"
          value={t.pending_voids}
          icon={XCircle}
          accent={t.pending_voids > 0 ? 'destructive' : undefined}
          onClick={() => navigate('/voids?status=pending')}
        />
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Trend — Last 14 Days</CardTitle>
          <CardDescription>Revenue and profit in NPR equivalent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(v: number, name) => [
                    formatMoney(v, 'रु'),
                    name === 'revenue' ? 'Revenue' : 'Profit',
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend
                  formatter={(v) => (v === 'revenue' ? 'Revenue' : 'Profit')}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#profGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Top Products + Low Stock */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Products — Last 30 Days</CardTitle>
            <CardDescription>By revenue (NPR equivalent)</CardDescription>
          </CardHeader>
          <CardContent>
            {topData.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No sales yet — nothing to show.
              </div>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topData} layout="vertical" margin={{ left: 10, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#94a3b8"
                        fontSize={11}
                        width={120}
                      />
                      <Tooltip
                        formatter={(v: number) => [formatMoney(v, 'रु'), 'Revenue']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        cursor={false}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#3b82f6"
                        radius={[0, 4, 4, 0]}
                        activeBar={{ fill: '#1e40af', stroke: '#1e40af' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-3 divide-y rounded-md border">
                  {stats.top_products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium tabular-nums">
                          {formatMoney(p.revenue_base, 'रु')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatQty(p.qty_sold)} sold
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Low Stock Alerts</CardTitle>
              <CardDescription>Products at or below reorder level</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/low-stock')}>
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {(() => {
              const low = t.low_stock_count;
              const healthy = Math.max(0, t.active_products - low);
              const total = low + healthy;
              const pct = total > 0 ? Math.round((low / total) * 100) : 0;
              const pieData = [
                { name: 'Healthy', value: healthy, color: '#10b981' },
                { name: 'Low stock', value: low, color: '#f59e0b' },
              ].filter((d) => d.value > 0);

              if (total === 0) {
                return (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No products yet.
                  </div>
                );
              }

              return (
                <>
                  {/* Donut chart */}
                  <div className="relative">
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={82}
                            paddingAngle={pieData.length > 1 ? 2 : 0}
                            dataKey="value"
                            stroke="none"
                            startAngle={90}
                            endAngle={-270}
                          >
                            {pieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number, name: string) => [
                              `${v} product${v === 1 ? '' : 's'}`,
                              name,
                            ]}
                            contentStyle={{ fontSize: 12, borderRadius: 8 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Center label */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div
                          className={
                            'text-2xl font-bold tabular-nums ' +
                            (low > 0 ? 'text-amber-600' : 'text-emerald-600')
                          }
                        >
                          {low}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Low stock
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {pct}% of {total}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="mt-1 flex items-center justify-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="text-muted-foreground">
                        Healthy ({healthy})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="text-muted-foreground">
                        Low stock ({low})
                      </span>
                    </div>
                  </div>

                  {/* Top low-stock products */}
                  {stats.low_stock.length > 0 && (
                    <div className="mt-4 divide-y border-t">
                      {stats.low_stock.slice(0, 3).map((p) => {
                        const stock = Number(p.stock_qty);
                        const reorder = Number(p.reorder_level);
                        const shortfall = reorder - stock;
                        return (
                          <div key={p.id} className="flex items-center justify-between py-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {p.sku} · {p.category_name ?? 'Uncategorized'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-amber-600 tabular-nums">
                                {formatQty(stock)} {p.unit}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                order +{formatQty(shortfall)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Recent sales */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent Sales</CardTitle>
            <CardDescription>Last 5 transactions</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/sales')}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {stats.recent_sales.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No sales yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Customer</th>
                    <th className="px-4 py-2">By</th>
                    <th className="px-4 py-2 text-right">Total</th>
                    <th className="px-4 py-2">Payment</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_sales.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-2 font-mono text-xs">{r.invoice_no}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.sale_date}</td>
                      <td className="px-4 py-2 font-medium">{r.customer_name ?? 'Walk-in'}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">{r.user_name}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatMoney(r.total, r.currency_symbol)}
                        {r.currency_code !== 'NPR' && (
                          <div className="text-xs text-muted-foreground">{r.currency_code}</div>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={
                          r.payment_status === 'paid' ? 'success' :
                          r.payment_status === 'partial' ? 'warning' : 'secondary'
                        }>{r.payment_status}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={r.status === 'completed' ? 'success' : 'destructive'}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, subtitle, profit, icon: Icon, accent, onClick,
}: {
  label: string;
  value: string;
  subtitle?: string;
  profit?: number;
  icon: typeof Package;
  accent: 'blue' | 'emerald' | 'indigo' | 'amber' | 'slate';
  onClick?: () => void;
}) {
  const accents = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    amber: 'bg-amber-50 text-amber-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
            {subtitle && (
              <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
            )}
            {profit !== undefined && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {profit >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={profit >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                  Profit {formatMoney(profit, 'रु')}
                </span>
              </div>
            )}
          </div>
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${accents[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label, value, icon: Icon, accent, onClick,
}: {
  label: string;
  value: string | number;
  icon: typeof Package;
  accent?: 'amber' | 'destructive';
  onClick?: () => void;
}) {
  const accentClass =
    accent === 'amber' ? 'text-amber-600' :
    accent === 'destructive' ? 'text-red-600' :
    'text-foreground';
  return (
    <Card
      className={onClick ? 'cursor-pointer transition-shadow hover:shadow-md' : ''}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`text-lg font-semibold tabular-nums ${accentClass}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}