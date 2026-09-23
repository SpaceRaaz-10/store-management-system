import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Sliders } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { adjustStock } from '@/services/inventory';
import { formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { StockRow } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: StockRow | null;
}

export function AdjustStockDialog({ open, onClose, onSaved, product }: Props) {
  const toast = useToast();
  const [mode, setMode] = useState<'set' | 'delta'>('set');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !product) return;
    setMode('set');
    setValue(formatQty(product.stock_qty));
    setReason('');
    setErrors({});
  }, [open, product]);

  const current = product ? Number(product.stock_qty) : 0;
  const numericValue = Number(value) || 0;
  const preview =
    mode === 'set'
      ? numericValue
      : current + numericValue;
  const delta = preview - current;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSaving(true);
    setErrors({});
    try {
      const res = await adjustStock({
        product_id: product.id,
        mode,
        value: numericValue,
        reason: reason.trim(),
      });
      toast.success(
        `Stock updated: ${formatQty(res.previous_qty)} → ${formatQty(res.new_qty)}`
      );
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Adjustment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Adjust Stock"
      description={product ? `${product.name} · ${product.sku}` : undefined}
      size="md"
    >
      {product && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-slate-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Current stock</span>
              <span className="font-semibold tabular-nums">
                {formatQty(product.stock_qty)} {product.unit}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Adjustment Type *</Label>
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'set' | 'delta')}>
              <option value="set">Set to a new value</option>
              <option value="delta">Add or remove quantity</option>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === 'set'
                ? 'Enter the exact final quantity you want the product to have.'
                : 'Use a positive number to add stock, a negative number to remove stock.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-value">
              {mode === 'set' ? 'New Quantity *' : 'Adjustment *'}
            </Label>
            <Input
              id="adj-value"
              type="number"
              step="0.001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            {errors.value?.[0] && <p className="text-xs text-destructive">{errors.value[0]}</p>}

            <div className="mt-1 rounded border bg-white p-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>New stock will be</span>
                <span className={'tabular-nums font-medium ' + (preview < 0 ? 'text-red-600' : 'text-foreground')}>
                  {formatQty(preview)} {product.unit}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground mt-0.5">
                <span>Change</span>
                <span className={
                  'tabular-nums font-medium ' +
                  (delta === 0 ? 'text-muted-foreground' :
                   delta > 0 ? 'text-emerald-600' : 'text-red-600')
                }>
                  {delta > 0 ? '+' : ''}{formatQty(delta)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-reason">Reason *</Label>
            <Textarea
              id="adj-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Physical count, damaged goods, found stock"
            />
            {errors.reason?.[0] && <p className="text-xs text-destructive">{errors.reason[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button
              type="submit"
              disabled={saving || preview < 0 || !reason.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sliders className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Apply Adjustment'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}