import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2, Clock } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/context/ToastContext';
import { getRateHistory, deleteExchangeRate, type ExchangeRateRow } from '@/services/currencies';
import type { ApiError } from '@/services/http';
import type { Currency } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  currency: Currency | null;
  baseCode: string;
  onChanged: () => void;
}

export function RateHistoryDialog({ open, onClose, currency, baseCode, onChanged }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<ExchangeRateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [toDelete, setToDelete] = useState<ExchangeRateRow | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!currency) return;
    setLoading(true);
    try {
      const data = await getRateHistory(currency.id);
      setRows(data);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [currency, toast]);

  useEffect(() => {
    if (open && currency) load();
  }, [open, currency, load]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setActing(true);
    try {
      await deleteExchangeRate(toDelete.id);
      toast.success('Rate deleted');
      setToDelete(null);
      load();
      onChanged();
    } catch (err) {
      toast.error((err as ApiError).message || 'Delete failed');
    } finally {
      setActing(false);
    }
  };

  const now = new Date();

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        title={currency ? `Rate History — ${currency.code}` : 'Rate History'}
        description="Rates are stored with an effective date. The most recent rate on or before a transaction date is used."
        size="lg"
      >
        {loading ? (
          <Spinner label="Loading history..." />
        ) : rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No rates on file yet. Click <strong>Add Rate</strong> to create the first one.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Effective From</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created By</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isFuture = new Date(r.effective_at) > now;
                  return (
                    <tr key={r.id} className="border-t last:border-0">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{r.effective_at.slice(0, 16)}</span>
                          {isFuture && (
                            <Badge variant="warning">
                              <span className="text-[10px]">Scheduled</span>
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        1 {currency?.code} = {Number(r.rate_to_base).toFixed(6)} {baseCode}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.is_active ? 'success' : 'secondary'}>
                          {r.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.created_by_name ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete rate"
                            onClick={() => setToDelete(r)}
                          >
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

        <div className="mt-4 flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title="Delete this rate?"
        message={
          toDelete
            ? `The rate ${Number(toDelete.rate_to_base).toFixed(6)} effective from ${toDelete.effective_at.slice(0, 16)} will be removed. Historical transactions are not affected (they store their own snapshot).`
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={acting}
      />
    </>
  );
}