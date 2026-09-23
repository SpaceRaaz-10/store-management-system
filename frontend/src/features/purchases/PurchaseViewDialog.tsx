import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { getPurchase } from '@/services/purchases';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Purchase } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  purchaseId: number | null;
}

export function PurchaseViewDialog({ open, onClose, purchaseId }: Props) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !purchaseId) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const p = await getPurchase(purchaseId);
        setPurchase(p);
      } catch (err) {
        setError((err as ApiError).message || 'Failed to load purchase');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, purchaseId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={purchase ? `Purchase ${purchase.invoice_no}` : 'Purchase'}
      description={purchase ? `${purchase.supplier_name} · ${purchase.purchase_date}` : undefined}
      size="xl"
    >
      {loading ? (
        <Spinner label="Loading purchase..." />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !purchase ? null : (
        <div className="space-y-5">
          {/* Header meta */}
          <div className="grid gap-3 md:grid-cols-3 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Supplier</div>
              <div className="font-medium">{purchase.supplier_name}</div>
              {purchase.supplier_contact && <div className="text-muted-foreground text-xs">{purchase.supplier_contact}</div>}
              {purchase.supplier_phone && <div className="text-muted-foreground text-xs">{purchase.supplier_phone}</div>}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Status</div>
              <div className="flex gap-2 mt-1">
                <Badge variant={
                  purchase.status === 'cancelled' ? 'destructive' :
                  purchase.payment_status === 'paid' ? 'success' :
                  purchase.payment_status === 'partial' ? 'warning' : 'secondary'
                }>{purchase.payment_status}</Badge>
                {purchase.status !== 'completed' && (
                  <Badge variant="destructive">{purchase.status}</Badge>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Currency</div>
              <div className="font-medium">
                {purchase.currency_code}
                {purchase.currency_code !== 'NPR' && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (1 {purchase.currency_code} = {Number(purchase.exchange_rate_to_base).toFixed(2)} NPR)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{it.product_name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{it.sku}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(it.unit_cost, purchase.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(it.line_total, purchase.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {purchase.notes && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{purchase.notes}</div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatMoney(purchase.subtotal, purchase.currency_symbol)} />
              {Number(purchase.discount_amount) > 0 && (
                <Row label="Discount" value={`− ${formatMoney(purchase.discount_amount, purchase.currency_symbol)}`} />
              )}
              {Number(purchase.tax_amount) > 0 && (
                <Row label="Tax" value={formatMoney(purchase.tax_amount, purchase.currency_symbol)} />
              )}
              <Row label="Total" value={formatMoney(purchase.total, purchase.currency_symbol)} bold />
              <Row label="Paid" value={formatMoney(purchase.paid_amount, purchase.currency_symbol)} />
              {Number(purchase.due_amount) > 0 && (
                <Row label="Due" value={formatMoney(purchase.due_amount, purchase.currency_symbol)} warn />
              )}
              {purchase.currency_code !== 'NPR' && (
                <Row label="NPR Equivalent" value={formatMoney(purchase.total_base, 'रु')} muted />
              )}
            </div>
          </div>

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function Row({ label, value, bold, warn, muted }: { label: string; value: string; bold?: boolean; warn?: boolean; muted?: boolean }) {
  return (
    <div className={
      'flex items-center justify-between ' +
      (bold ? 'font-semibold text-base border-t pt-1.5 mt-1' : '') +
      (warn ? ' text-amber-600' : '') +
      (muted ? ' text-muted-foreground text-xs' : '')
    }>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}