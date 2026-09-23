import { useEffect, useState } from 'react';
import { Printer, Eye, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { getPurchase } from '@/services/purchases';
import { openPurchaseInvoice } from './purchaseInvoiceHtml';
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
  const [opening, setOpening] = useState<'preview' | 'print' | null>(null);

  useEffect(() => {
    if (!open || !purchaseId) return;
    setLoading(true);
    setError(null);
    setPurchase(null);
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

  const handleOpen = async (autoPrint: boolean) => {
    if (!purchase) return;
    setOpening(autoPrint ? 'print' : 'preview');
    try {
      openPurchaseInvoice(purchase, autoPrint);
    } finally {
      setTimeout(() => setOpening(null), 400);
    }
  };

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
          {/* Summary grid */}
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryBlock label="Supplier">
              <div className="font-medium text-sm">{purchase.supplier_name}</div>
              {purchase.supplier_contact && (
                <div className="text-xs text-muted-foreground">Attn: {purchase.supplier_contact}</div>
              )}
              {purchase.supplier_phone && (
                <div className="text-xs text-muted-foreground">{purchase.supplier_phone}</div>
              )}
              {purchase.supplier_email && (
                <div className="text-xs text-muted-foreground">{purchase.supplier_email}</div>
              )}
            </SummaryBlock>

            <SummaryBlock label="Status">
              <div className="flex flex-wrap gap-2">
                <Badge variant={
                  purchase.status === 'cancelled' ? 'destructive' :
                  purchase.payment_status === 'paid' ? 'success' :
                  purchase.payment_status === 'partial' ? 'warning' : 'secondary'
                }>{purchase.payment_status}</Badge>
                {purchase.status !== 'completed' && (
                  <Badge variant="destructive">{purchase.status}</Badge>
                )}
              </div>
            </SummaryBlock>

            <SummaryBlock label="Currency">
              <div className="font-medium text-sm">{purchase.currency_code}</div>
              {purchase.currency_code !== 'NPR' ? (
                <div className="text-xs text-muted-foreground">
                  1 {purchase.currency_code} = {Number(purchase.exchange_rate_to_base).toFixed(4)} NPR
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Base currency</div>
              )}
              <div className="text-xs text-muted-foreground">By {purchase.user_name}</div>
            </SummaryBlock>
          </div>

          {/* Items */}
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((it, i) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.product_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(it.unit_cost, purchase.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(it.line_total, purchase.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes + Totals */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              {purchase.notes && (
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{purchase.notes}</div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 text-sm rounded-md border p-4 bg-slate-50/50">
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

          {/* Actions */}
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleOpen(false)}
                disabled={opening !== null}
              >
                {opening === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview Invoice
              </Button>
              <Button
                onClick={() => handleOpen(true)}
                disabled={opening !== null}
              >
                {opening === 'print' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                Print Invoice
              </Button>
            </div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function SummaryBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-slate-50/60 px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground tracking-wide mb-1">{label}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value, bold, warn, muted }: {
  label: string; value: string; bold?: boolean; warn?: boolean; muted?: boolean;
}) {
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