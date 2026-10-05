import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CheckCircle2, XCircle, Eye, Loader2, XCircle as XCircleIcon } from 'lucide-react';
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
import { listVoids, approveVoid, rejectVoid } from '@/services/voids';
import { formatMoney } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { VoidRequest } from '@/types/models';

export function VoidsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState<VoidRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [decision, setDecision] = useState<{ req: VoidRequest; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVoids({
        page, per_page: 10,
        search: debounced || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load void requests');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDecision = async () => {
    if (!decision) return;
    setActing(true);
    try {
      if (decision.action === 'approve') {
        await approveVoid(decision.req.id, note.trim() || undefined);
        toast.success('Sale voided — stock reversed');
      } else {
        await rejectVoid(decision.req.id, note.trim() || undefined);
        toast.success('Void request rejected');
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
            <XCircleIcon className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Void Requests</h1>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Approve or reject sale void requests' : 'Your submitted void requests'}
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
                placeholder="Search invoice #..."
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
            <Spinner label="Loading void requests..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No void requests"
              description="Void requests will appear here once submitted from a sale."
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
                    <th className="px-4 py-3 text-right">Sale Total</th>
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
                        {formatMoney(r.sale_total, r.currency_symbol)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          r.status === 'completed' || r.status === 'approved' ? 'success' :
                          r.status === 'rejected' ? 'destructive' : 'warning'
                        }>{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{r.requested_by_name}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
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

      <Dialog
        open={!!decision}
        onClose={() => { setDecision(null); setNote(''); }}
        title={decision?.action === 'approve' ? 'Approve Void?' : 'Reject Void?'}
        description={decision ? `Invoice ${decision.req.invoice_no} · ${formatMoney(decision.req.sale_total, decision.req.currency_symbol)}` : undefined}
        size="md"
      >
        {decision && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {decision.action === 'approve'
                ? 'The sale will be marked voided and all un-returned items will be restocked. This cannot be undone.'
                : 'The void request will be rejected. The sale stays as completed.'}
            </p>
            <div className="space-y-2">
              <Label htmlFor="void-note">Decision note (optional)</Label>
              <Textarea
                id="void-note"
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
                variant={decision.action === 'approve' ? 'destructive' : 'default'}
                onClick={handleDecision}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {acting ? 'Processing...' : decision.action === 'approve' ? 'Approve Void' : 'Reject'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}