import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/context/ToastContext';
import { createVoid } from '@/services/voids';
import { formatMoney } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Sale } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sale: Sale | null;
}

export function NewVoidDialog({ open, onClose, onSaved, sale }: Props) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setReason('');
    setErrors({});
  }, [open, sale]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sale) return;

    if (!reason.trim()) {
      setErrors({ reason: ['Reason is required'] });
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      await createVoid(sale.id, reason.trim());
      toast.success('Void request submitted — awaiting admin approval');
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Void request failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Request Sale Void"
      description={sale ? `Sale ${sale.invoice_no} · ${sale.customer_name ?? 'Walk-in'}` : undefined}
      size="md"
    >
      {sale && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <div className="font-medium">This will reverse the sale and restock items.</div>
            <div className="mt-1 text-xs">
              Void requests must be approved by an admin. Once approved:
            </div>
            <ul className="mt-1 list-inside list-disc text-xs">
              <li>All un-returned items will be restocked</li>
              <li>The sale will be marked voided</li>
              <li>Payments on this sale will need to be refunded separately</li>
            </ul>
          </div>

          <div className="rounded-md border bg-slate-50 p-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice</span>
              <span className="font-mono font-medium">{sale.invoice_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sale Total</span>
              <span className="tabular-nums font-medium">
                {formatMoney(sale.total, sale.currency_symbol)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>{sale.items.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="v-reason">Reason for Void *</Label>
            <Textarea
              id="v-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this sale needs to be voided"
              autoFocus
            />
            {errors.reason?.[0] && <p className="text-xs text-destructive">{errors.reason[0]}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              {saving ? 'Submitting...' : 'Submit Void Request'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}