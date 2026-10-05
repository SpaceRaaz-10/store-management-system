import { useEffect, useState } from 'react';
import { Printer, Eye, Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { getSale } from '@/services/sales';
import { openSaleInvoice } from './saleInvoiceHtml';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Sale } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  saleId: number | null;
}

export function SaleViewDialog({ open, onClose, saleId }: Props) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<'preview' | 'print' | null>(null);

  useEffect(() => {
    if (!open || !saleId) return;
    setLoading(true);
    setError(null);
    setSale(null);
    (async () => {
      try {
        const s = await getSale(saleId);
        setSale(s);
      } catch (err) {
        setError((err as ApiError).message || 'Failed to load sale');
      } finally {
        setLoading(false);
      }
    })();
  }, [open, saleId]);

  const handleOpen = (autoPrint: boolean) => {
    if (!sale) return;
    setOpening(autoPrint ? 'print' : 'preview');
    try {
      openSaleInvoice(sale, autoPrint);
    } finally {
      setTimeout(() => setOpening(null), 400);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={sale ? `Sale ${sale.invoice_no}` : 'Sale'}
      description={sale ? `${sale.customer_name ?? 'Walk-in'} · ${sale.sale_date}` : undefined}
      size="xl"
    >
      {loading ? (
        <Spinner label="Loading sale..." />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !sale ? null : (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <SummaryBlock label="Customer">
              <div className="font-medium text-sm">{sale.customer_name ?? 'Walk-in Customer'}</div>
              {sale.customer_phone && <div className="text-xs text-muted-foreground">{sale.customer_phone}</div>}
              {sale.customer_email && <div className="text-xs text-muted-foreground">{sale.customer_email}</div>}
            </SummaryBlock>
            <SummaryBlock label="Status">
              <div className="flex flex-wrap gap-2">
                <Badge variant={
                  sale.payment_status === 'paid' ? 'success' :
                  sale.payment_status === 'partial' ? 'warning' : 'secondary'
                }>{sale.payment_status}</Badge>
                {sale.status !== 'completed' && <Badge variant="destructive">{sale.status}</Badge>}
              </div>
            </SummaryBlock>
            <SummaryBlock label="Currency">
              <div className="font-medium text-sm">{sale.currency_code}</div>
              {sale.currency_code !== 'NPR' ? (
                <div className="text-xs text-muted-foreground">
                  1 {sale.currency_code} = {Number(sale.exchange_rate_to_base).toFixed(4)} NPR
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Base currency</div>
              )}
              <div className="text-xs text-muted-foreground">By {sale.user_name}</div>
            </SummaryBlock>
          </div>

          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it, i) => (
                  <tr key={it.id} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{it.product_name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(it.unit_price, sale.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(it.line_total, sale.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {sale.payments.length > 0 && (
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1.5">Payments</div>
                  <div className="rounded-md border divide-y">
                    {sale.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <div>
                          <div className="font-medium">{p.method_name ?? '—'}</div>
                          <div className="text-muted-foreground">{p.payment_date.slice(0, 16)}</div>
                        </div>
                        <div className="tabular-nums font-medium">
                          {formatMoney(p.amount, sale.currency_symbol)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sale.notes && (
                <div className="rounded-md border bg-slate-50 p-3">
                  <div className="text-xs uppercase text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm whitespace-pre-wrap">{sale.notes}</div>
                </div>
              )}
            </div>
            <div className="space-y-1.5 text-sm rounded-md border p-4 bg-slate-50/50">
              <Row label="Subtotal" value={formatMoney(sale.subtotal, sale.currency_symbol)} />
              {Number(sale.discount_amount) > 0 && (
                <Row label="Discount" value={`− ${formatMoney(sale.discount_amount, sale.currency_symbol)}`} />
              )}
              {Number(sale.tax_amount) > 0 && (
                <Row label="Tax" value={formatMoney(sale.tax_amount, sale.currency_symbol)} />
              )}
              <Row label="Total" value={formatMoney(sale.total, sale.currency_symbol)} bold />
              <Row label="Paid" value={formatMoney(sale.paid_amount, sale.currency_symbol)} />
              {Number(sale.due_amount) > 0 && (
                <Row label="Due" value={formatMoney(sale.due_amount, sale.currency_symbol)} warn />
              )}
              {sale.currency_code !== 'NPR' && (
                <Row label="NPR Equivalent" value={formatMoney(sale.total_base, 'रु')} muted />
              )}
              <Row label="Profit (NPR)" value={formatMoney(sale.profit_base, 'रु')} muted />
            </div>
          </div>

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => handleOpen(false)} disabled={opening !== null}>
                {opening === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                Preview Invoice
              </Button>
              <Button onClick={() => handleOpen(true)} disabled={opening !== null}>
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