import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, DollarSign } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/context/ToastContext';
import { addPurchasePayment } from '@/services/purchases';
import { listPaymentMethods } from '@/services/currencies';
import { formatMoney } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Purchase, PaymentMethod } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  purchase: Purchase | null;
}

export function AddPurchasePaymentDialog({ open, onClose, onSaved, purchase }: Props) {
  const toast = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const m = await listPaymentMethods();
        setMethods(m);
        if (m[0]) setMethodId(String(m[0].id));
      } catch { /* ignore */ }
    })();

    if (purchase) {
      // Prefill with the full due amount by default
      setAmount(String(Number(purchase.due_amount).toFixed(2)));
      setNote('');
      setErrors({});
    }
  }, [open, purchase]);

  const due = purchase ? Number(purchase.due_amount) : 0;
  const symbol = purchase?.currency_symbol ?? 'रु';

  const setFull = () => setAmount(due.toFixed(2));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!purchase) return;
    setSaving(true);
    setErrors({});
    try {
      const amt = Number(amount);
      if (!amt || amt <= 0) {
        setErrors({ amount: ['Amount must be greater than 0'] });
        setSaving(false);
        return;
      }
      if (amt > due + 0.001) {
        setErrors({ amount: [`Amount exceeds due (${symbol} ${due.toFixed(2)})`] });
        setSaving(false);
        return;
      }
      await addPurchasePayment(purchase.id, {
        amount: amt,
        payment_method_id: Number(methodId),
        note: note.trim() || null,
      });
      toast.success('Payment recorded');
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Payment failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add Payment"
      description={purchase ? `Invoice ${purchase.invoice_no} · ${purchase.supplier_name}` : undefined}
      size="md"
    >
      {purchase && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border bg-slate-50 p-4 space-y-1.5 text-sm">
            <Row label="Total" value={formatMoney(purchase.total, symbol)} />
            <Row label="Paid so far" value={formatMoney(purchase.paid_amount, symbol)} />
            <Row label="Due" value={formatMoney(purchase.due_amount, symbol)} bold />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount">Amount ({symbol}) *</Label>
              <button
                type="button"
                onClick={setFull}
                className="text-xs text-primary hover:underline"
              >
                Pay full due
              </button>
            </div>
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              max={due.toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
            {errors.amount?.[0] && <p className="text-xs text-destructive">{errors.amount[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-method">Payment Method *</Label>
            <Select id="pay-method" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <option value="">— Choose method —</option>
              {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            {errors.payment_method_id?.[0] && (
              <p className="text-xs text-destructive">{errors.payment_method_id[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pay-note">Note</Label>
            <Textarea
              id="pay-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
              {saving ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={'flex justify-between ' + (bold ? 'font-semibold border-t pt-1.5 mt-1' : '')}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}