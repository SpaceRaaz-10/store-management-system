import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, RefreshCw, ShoppingCart, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/context/ToastContext';
import { listLowStock } from '@/services/inventory';
import { imageUrl, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { LowStockRow } from '@/types/models';

export function LowStockPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLowStock(100);
      setRows(res);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load low stock');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventory')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Low Stock Alerts</h1>
            <p className="text-sm text-muted-foreground">
              Products at or below their reorder level
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <Card><CardContent><Spinner label="Loading low stock..." /></CardContent></Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              title="All stocked up"
              description="No products are below their reorder level right now."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span><strong>{rows.length}</strong> product{rows.length === 1 ? '' : 's'} need restocking</span>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Current Stock</th>
                      <th className="px-4 py-3 text-right">Reorder Level</th>
                      <th className="px-4 py-3 text-right">Shortfall</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => {
                      const img = imageUrl(p.image_path);
                      const shortfall = Number(p.reorder_level) - Number(p.stock_qty);
                      return (
                        <tr key={p.id} className="border-b last:border-0 bg-amber-50/30 hover:bg-amber-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                                {img ? (
                                  <img src={img} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ImageOff className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{p.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{p.sku}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category_name ?? '—'}</td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="font-semibold text-amber-700">
                              {formatQty(p.stock_qty)} {p.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                            {formatQty(p.reorder_level)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="font-medium text-red-600">
                              {formatQty(shortfall)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/purchases/new`)}
                                title="Restock via purchase"
                              >
                                <ShoppingCart className="h-3.5 w-3.5" /> Restock
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}