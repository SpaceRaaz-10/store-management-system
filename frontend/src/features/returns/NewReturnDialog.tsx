import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/context/ToastContext';
import { createReturn } from '@/services/returns';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Sale } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sale: Sale | null;
}

export function NewReturnDialog({ open, onClose, onSaved, sale }: Props) {
  const toast = useToast();
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'original_method' | 'store_credit' | 'other'>('original_method');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setQuantities({});
    setReason('');
    setNotes('');
    setRefundMethod('original_method');
    setErrors({});
  }, [open, sale]);

  const symbol = sale?.currency_symbol ?? 'रु';
  const rate = sale ? Number(sale.exchange_rate_to_base) : 1;

  // Compute refund preview from entered quantities
  const { refundSubtotal, refundTotal } = useMemo(() => {
    if (!sale) return { refundSubtotal: 0, refundTotal: 0 };
    let sub = 0;
    for (const it of sale.items) {
      const q = Number(quantities[it.id] ?? 0);
      if (q > 0) sub += q * Number(it.unit_price);
    }
    // Apply same tax rate as original sale
    const originalSub = Number(sale.subtotal);
    const taxRate = originalSub > 0 ? Number(sale.tax_amount) / originalSub : 0;
    const tax = sub * taxRate;
    return { refundSubtotal: sub, refundTotal: sub + tax };
  }, [sale, quantities]);

  const setQty = (itemId: number, value: string) => {
    setQuantities((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    const items = sale.items
      .map((it) => ({ sale_item_id: it.id, quantity: Number(quantities[it.id] ?? 0) }))
      .filter((x) => x.quantity > 0);

    if (items.length === 0) {
      toast.error('Select at least one item and quantity to return');
      return;
    }
    if (!reason.trim()) {
      setErrors({ reason: ['Reason is required'] });
      return;
    }

    // Client-side check: no more than available
    for (const it of sale.items) {
      const want = Number(quantities[it.id] ?? 0);
      const available = Number(it.quantity) - Number(it.returned_quantity);
      if (want > available + 0.0001) {
        toast.error(`Too many for ${it.product_name} — only ${formatQty(available)} available`);
        return;
      }
    }

    setSaving(true);
    setErrors({});
    try {
      await createReturn(sale.id, {
        reason: reason.trim(),
        notes: notes.trim() || null,
        refund_method: refundMethod,
        items,
      });
      toast.success('Return request submitted — awaiting admin approval');
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Return request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request Return / Refund"
      description={sale ? `Sale ${sale.invoice_no} · ${sale.customer_name ?? 'Walk-in'}` : undefined}
      size="xl"
    >
      {sale && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-md border bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
            Return requests must be approved by an admin before stock is restored and refunds are processed.
          </div>

          {/* Items with quantity picker */}
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Sold</th>
                  <th className="px-3 py-2 text-right">Already Returned</th>
                  <th className="px-3 py-2 text-right">Available</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right w-32">Return Qty</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it) => {
                  const sold = Number(it.quantity);
                  const already = Number(it.returned_quantity);
                  const available = sold - already;
                  const qty = quantities[it.id] ?? '';
                  const lineTotal = qty ? Number(qty) * Number(it.unit_price) : 0;
                  return (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.product_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(sold)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {formatQty(already)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {formatQty(available)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(it.unit_price, symbol)}
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          max={available}
                          step="0.001"
                          value={qty}
                          disabled={available <= 0}
                          onChange={(e) => setQty(it.id, e.target.value)}
                          className="h-8 text-right"
                        />
                        {lineTotal > 0 && (
                          <div className="mt-0.5 text-right text-[10px] text-muted-foreground">
                            = {formatMoney(lineTotal, symbol)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="r-reason">Reason *</Label>
              <Input
                id="r-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Defective, wrong item, customer changed mind"
              />
              {errors.reason?.[0] && <p className="text-xs text-destructive">{errors.reason[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-method">Refund Method</Label>
              <Select
                id="r-method"
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as typeof refundMethod)}
              >
                <option value="original_method">Original payment method</option>
                <option value="cash">Cash</option>
                <option value="store_credit">Store credit</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="r-notes">Notes</Label>
            <Textarea id="r-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>

          {/* Refund preview */}
          <div className="rounded-md border bg-slate-50 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Refund Subtotal</span>
              <span className="tabular-nums">{formatMoney(refundSubtotal, symbol)}</span>
            </div>
            <div className="mt-1 flex justify-between font-semibold">
              <span>Refund Total (incl. tax)</span>
              <span className="tabular-nums">{formatMoney(refundTotal, symbol)}</span>
            </div>
            {sale.currency_code !== 'NPR' && (
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>NPR Equivalent</span>
                <span className="tabular-nums">रु {(refundTotal * rate).toFixed(2)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || refundTotal <= 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {saving ? 'Submitting...' : 'Submit Return Request'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}