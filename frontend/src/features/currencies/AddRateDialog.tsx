import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useToast } from '@/context/ToastContext';
import { createExchangeRate } from '@/services/currencies';
import type { ApiError } from '@/services/http';
import type { Currency } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  currency: Currency | null;
  baseCode: string;
}

function nowForInput(): string {
  // yyyy-MM-ddTHH:mm — for datetime-local input
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AddRateDialog({ open, onClose, onSaved, currency, baseCode }: Props) {
  const toast = useToast();
  const [rate, setRate] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(nowForInput());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setRate('');
    setEffectiveAt(nowForInput());
    setErrors({});
  }, [open, currency]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currency) return;
    setSaving(true);
    setErrors({});
    try {
      const r = Number(rate);
      if (!r || r <= 0) {
        setErrors({ rate_to_base: ['Rate must be greater than 0'] });
        setSaving(false);
        return;
      }
      // Send as MySQL-friendly string: "YYYY-MM-DD HH:MM:SS"
      const dt = effectiveAt.replace('T', ' ') + ':00';
      await createExchangeRate({
        currency_id: currency.id,
        rate_to_base: r,
        effective_at: dt,
      });
      toast.success(`Rate saved: 1 ${currency.code} = ${r} ${baseCode}`);
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add / Update Rate"
      description={currency ? `Set the exchange rate for ${currency.name} (${currency.code})` : undefined}
      size="md"
    >
      {currency && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-slate-50 p-4 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rate direction</div>
            <div className="mt-1 font-medium">
              1 {currency.code} = <span className="text-primary">___ {baseCode}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Enter how many {baseCode} equal 1 {currency.code}.
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">Rate (1 {currency.code} = ? {baseCode}) *</Label>
            <Input
              id="rate"
              type="number"
              step="0.00000001"
              min="0.00000001"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="e.g. 140"
              autoFocus
            />
            {rate && Number(rate) > 0 && (
              <p className="text-xs text-muted-foreground">
                1 {baseCode} = {(1 / Number(rate)).toFixed(6)} {currency.code}
              </p>
            )}
            {errors.rate_to_base?.[0] && <p className="text-xs text-destructive">{errors.rate_to_base[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective">Effective From *</Label>
            <Input
              id="effective"
              type="datetime-local"
              value={effectiveAt}
              onChange={(e) => setEffectiveAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The rate applies to transactions on or after this date/time. Backdate if you need a
              historical rate.
            </p>
            {errors.effective_at?.[0] && <p className="text-xs text-destructive">{errors.effective_at[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Rate'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}