import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Pencil, Power, Trash2, TrendingUp, History, Loader2, Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CurrencyFormDialog } from './CurrencyFormDialog';
import { AddRateDialog } from './AddRateDialog';
import { RateHistoryDialog } from './RateHistoryDialog';
import { useToast } from '@/context/ToastContext';
import {
  listAllCurrencies, listCurrencies, setCurrencyStatus, deleteCurrency,
  type CurrencyWithRate,
} from '@/services/currencies';
import type { ApiError } from '@/services/http';
import type { Currency } from '@/types/models';

export function CurrenciesPage() {
  const toast = useToast();
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [activeRates, setActiveRates] = useState<Record<number, CurrencyWithRate>>({});
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [rateFor, setRateFor] = useState<Currency | null>(null);
  const [historyFor, setHistoryFor] = useState<Currency | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Currency | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<Currency | null>(null);
  const [acting, setActing] = useState(false);

  const baseCurrency = currencies.find((c) => c.is_base === 1);
  const baseCode = baseCurrency?.code ?? 'NPR';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [all, withRates] = await Promise.all([
        listAllCurrencies(),
        listCurrencies(),
      ]);
      setCurrencies(all);
      const map: Record<number, CurrencyWithRate> = {};
      withRates.forEach((c) => { map[c.id] = c; });
      setActiveRates(map);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load currencies');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await deleteCurrency(confirmDelete.id);
      toast.success('Currency deleted');
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
      const next = confirmStatus.is_active === 1;
      await setCurrencyStatus(confirmStatus.id, !next);
      toast.success(`Currency ${next ? 'deactivated' : 'activated'}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Currencies</h1>
          <p className="text-sm text-muted-foreground">
            Manage supported currencies and exchange rates
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Currency
        </Button>
      </div>

      {/* Rate direction reference */}
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <TrendingUp className="h-4 w-4 shrink-0" />
        <span>
          Rates are stored as <strong>1 unit of foreign currency = N {baseCode}</strong>. The most
          recent rate on or before a transaction is used.
        </span>
      </div>

      {loading ? (
        <Card><CardContent><Spinner label="Loading currencies..." /></CardContent></Card>
      ) : currencies.length === 0 ? (
        <EmptyState
          title="No currencies configured"
          description="Add the first currency to get started."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {currencies.map((c) => {
            const info = activeRates[c.id];
            const rate = info?.rate_to_base ?? (c.is_base === 1 ? 1 : null);
            const isBase = c.is_base === 1;
            const isActive = c.is_active === 1;

            return (
              <Card key={c.id} className={!isActive ? 'opacity-60' : ''}>
                <CardContent className="p-5 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                        {c.symbol || c.code.slice(0, 1)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{c.code}</span>
                          {isBase && <Badge variant="default"><span className="text-[10px]">Base</span></Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">{c.name}</div>
                      </div>
                    </div>
                    <Badge variant={isActive ? 'success' : 'secondary'}>
                      {isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Rate */}
                  <div className="rounded-md border bg-slate-50 px-3 py-2">
                    {isBase ? (
                      <div className="text-sm">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Base Currency</div>
                        <div className="font-medium">All rates convert to {c.code}</div>
                      </div>
                    ) : rate !== null && rate !== undefined ? (
                      <div className="text-sm space-y-0.5">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Current Rate</div>
                        <div className="font-mono font-medium">
                          1 {c.code} = {Number(rate).toFixed(6)} {baseCode}
                        </div>
                        {info?.effective_at && (
                          <div className="text-xs text-muted-foreground">
                            Since {info.effective_at.slice(0, 16)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm">
                        <div className="text-xs uppercase tracking-wide text-amber-700">No rate set</div>
                        <div className="text-xs text-amber-700">Set a rate before using this currency</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {!isBase && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRateFor(c)}
                          title="Add a new rate"
                        >
                          <TrendingUp className="h-3.5 w-3.5" /> Add Rate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryFor(c)}
                          title="View rate history"
                        >
                          <History className="h-3.5 w-3.5" /> History
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit"
                      onClick={() => { setEditing(c); setFormOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={isActive ? 'Deactivate' : 'Activate'}
                      onClick={() => setConfirmStatus(c)}
                      disabled={isBase}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete"
                      onClick={() => setConfirmDelete(c)}
                      disabled={isBase}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CurrencyFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
      />

      <AddRateDialog
        open={rateFor !== null}
        onClose={() => setRateFor(null)}
        onSaved={load}
        currency={rateFor}
        baseCode={baseCode}
      />

      <RateHistoryDialog
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        currency={historyFor}
        baseCode={baseCode}
        onChanged={load}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete currency?"
        message={`"${confirmDelete?.name}" will be permanently removed. Currencies used by any transaction cannot be deleted — deactivate instead.`}
        confirmLabel="Delete"
        destructive
        loading={acting}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleToggleStatus}
        title={confirmStatus?.is_active === 1 ? 'Deactivate currency?' : 'Activate currency?'}
        message={
          confirmStatus?.is_active === 1
            ? `"${confirmStatus?.name}" will no longer be available for new transactions. Existing records keep their currency.`
            : `"${confirmStatus?.name}" will be available for new transactions again.`
        }
        confirmLabel={confirmStatus?.is_active === 1 ? 'Deactivate' : 'Activate'}
        loading={acting}
      />
    </div>
  );
}