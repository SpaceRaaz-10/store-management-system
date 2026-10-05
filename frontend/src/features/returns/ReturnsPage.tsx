import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search, CheckCircle2, XCircle, Eye, Loader2, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { Label } from '@/components/ui/Label';
import { Pagination } from '@/components/common/Pagination';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { listReturns, approveReturn, rejectReturn, getReturn } from '@/services/returns';
import { formatMoney, formatQty } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { ReturnRequest } from '@/types/models';

export function ReturnsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [params, setParams] = useSearchParams();

  const [rows, setRows] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState(params.get('status') ?? '');

  const [viewing, setViewing] = useState<ReturnRequest | null>(null);
  const [decision, setDecision] = useState<{ req: ReturnRequest; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listReturns({
        page,
        per_page: 10,
        search: debounced || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const current = params.get('status') ?? '';
    if (current === statusFilter) return;
    if (statusFilter) setParams({ status: statusFilter });
    else setParams({});
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleView = async (r: ReturnRequest) => {
    try {
      const full = await getReturn(r.id);
      setViewing(full);
    } catch {
      toast.error('Failed to load return details');
    }
  };

  const handleDecision = async () => {
    if (!decision) return;
    setActing(true);
    try {
      if (decision.action === 'approve') {
        await approveReturn(decision.req.id, note.trim() || undefined);
        toast.success('Return approved and stock restored');
      } else {
        await rejectReturn(decision.req.id, note.trim() || undefined);
        toast.success('Return rejected');
      }
      setDecision(null);
      setNote('');
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/sales')}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Returns & Refunds</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Approve or reject return requests' : 'Your submitted return requests'}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-7">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by invoice # or customer..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Approved</option>
                <option value="rejected">Rejected</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading returns..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No return requests"
              description="Return requests will appear here once submitted from a sale."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3 text-right">Refund</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {r.requested_at.slice(0, 16)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{r.invoice_no}</td>
                      <td className="px-4 py-3 font-medium">{r.customer_name ?? 'Walk-in'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatMoney(r.total, r.currency_symbol)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.requested_by_name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="View details" onClick={() => handleView(r)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && r.status === 'pending' && (
                            <>
                              <Button
                                variant="ghost" size="icon" title="Approve"
                                onClick={() => { setDecision({ req: r, action: 'approve' }); setNote(''); }}
                              >
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" title="Reject"
                                onClick={() => { setDecision({ req: r, action: 'reject' }); setNote(''); }}
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      )}

      {/* Detail dialog */}
      <Dialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `Return ${viewing.invoice_no}` : 'Return'}
        description={viewing ? `Requested by ${viewing.requested_by_name} on ${viewing.requested_at.slice(0, 16)}` : undefined}
        size="xl"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Customer</div>
                <div className="font-medium">{viewing.customer_name ?? 'Walk-in'}</div>
                {viewing.customer_phone && <div className="text-xs text-muted-foreground">{viewing.customer_phone}</div>}
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Status</div>
                <StatusBadge status={viewing.status} />
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Refund Method</div>
                <div className="font-medium capitalize">{viewing.refund_method.replace('_', ' ')}</div>
              </div>
            </div>

            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <div className="text-xs uppercase text-muted-foreground mb-1">Reason</div>
              <div>{viewing.reason}</div>
              {viewing.notes && (
                <>
                  <div className="mt-2 text-xs uppercase text-muted-foreground mb-1">Notes</div>
                  <div className="whitespace-pre-wrap">{viewing.notes}</div>
                </>
              )}
              {viewing.decision_note && (
                <>
                  <div className="mt-2 text-xs uppercase text-muted-foreground mb-1">Admin Decision Note</div>
                  <div className="whitespace-pre-wrap">{viewing.decision_note}</div>
                </>
              )}
            </div>

            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit Price</th>
                    <th className="px-3 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewing.items ?? []).map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{it.product_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{it.sku}</div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatQty(it.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMoney(it.unit_price, viewing.currency_symbol)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatMoney(it.line_total, viewing.currency_symbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-md border p-4 text-sm space-y-1.5 bg-slate-50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatMoney(viewing.subtotal, viewing.currency_symbol)}</span>
              </div>
              {Number(viewing.tax_amount) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="tabular-nums">{formatMoney(viewing.tax_amount, viewing.currency_symbol)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-1.5">
                <span>Refund Total</span>
                <span className="tabular-nums">{formatMoney(viewing.total, viewing.currency_symbol)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              {isAdmin && viewing.status === 'pending' && (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => { setViewing(null); setDecision({ req: viewing, action: 'reject' }); setNote(''); }}
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    onClick={() => { setViewing(null); setDecision({ req: viewing, action: 'approve' }); setNote(''); }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </>
              )}
              {!(isAdmin && viewing.status === 'pending') && (
                <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
              )}
            </div>
          </div>
        )}
      </Dialog>

      {/* Approve/Reject confirmation */}
      <Dialog
        open={!!decision}
        onClose={() => { setDecision(null); setNote(''); }}
        title={decision?.action === 'approve' ? 'Approve Return?' : 'Reject Return?'}
        description={decision ? `Invoice ${decision.req.invoice_no} · ${formatMoney(decision.req.total, decision.req.currency_symbol)}` : undefined}
        size="md"
      >
        {decision && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {decision.action === 'approve'
                ? 'Stock will be restored and the sale status will be updated to reflect the return.'
                : 'The return request will be marked rejected. No stock change will occur.'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="decision-note">Decision note (optional)</Label>
              <Textarea
                id="decision-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional explanation"
              />
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="outline" onClick={() => { setDecision(null); setNote(''); }} disabled={acting}>
                Cancel
              </Button>
              <Button
                variant={decision.action === 'approve' ? 'default' : 'destructive'}
                onClick={handleDecision}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {acting ? 'Processing...' : decision.action === 'approve' ? 'Approve' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: ReturnRequest['status'] }) {
  const variant: 'success' | 'warning' | 'destructive' | 'secondary' =
    status === 'completed' || status === 'approved' ? 'success' :
    status === 'rejected' || status === 'cancelled' ? 'destructive' :
    'warning';
  return <Badge variant={variant}>{status}</Badge>;
}