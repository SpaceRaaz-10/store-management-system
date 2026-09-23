import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Power, Trash2, Search, Phone, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { SupplierFormDialog } from './SupplierFormDialog';
import { useToast } from '@/context/ToastContext';
import { listSuppliers, setSupplierStatus, deleteSupplier } from '@/services/suppliers';
import type { ApiError } from '@/services/http';
import type { Supplier } from '@/types/models';

export function SuppliersPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<Supplier | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSuppliers({
        page, per_page: 10,
        search: debounced || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await deleteSupplier(confirmDelete.id);
      toast.success('Supplier deleted');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Delete failed');
    } finally {
      setActing(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!confirmStatus) return;
    setActing(true);
    try {
      const next = confirmStatus.status === 'active' ? 'inactive' : 'active';
      await setSupplierStatus(confirmStatus.id, next);
      toast.success(`Supplier ${next === 'active' ? 'activated' : 'deactivated'}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const hasFilters = search || statusFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Manage your supplier directory</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Supplier
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-8">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, contact, phone, or email..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
            {hasFilters && (
              <div className="md:col-span-1 flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading suppliers..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No suppliers match your filters' : 'No suppliers yet'}
              description={hasFilters ? 'Try clearing filters.' : 'Add your first supplier.'}
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter(''); }}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                    <Plus className="h-4 w-4" /> New Supplier
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact Person</th>
                    <th className="px-4 py-3">Phone / Email</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        {s.contact_person ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" /> {s.contact_person}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {s.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" /> {s.phone}</span>}
                          {s.email && <span className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" /> {s.email}</span>}
                          {!s.phone && !s.email && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.status === 'active' ? 'success' : 'secondary'}>{s.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(s); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title={s.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => setConfirmStatus(s)}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(s)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
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

      <SupplierFormDialog open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} editing={editing} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete supplier?"
        message={`"${confirmDelete?.name}" will be permanently removed. Suppliers with purchase history cannot be deleted.`}
        confirmLabel="Delete"
        destructive
        loading={acting}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleToggleStatus}
        title={confirmStatus?.status === 'active' ? 'Deactivate supplier?' : 'Activate supplier?'}
        message={
          confirmStatus?.status === 'active'
            ? `"${confirmStatus?.name}" will be hidden from new purchases.`
            : `"${confirmStatus?.name}" will become available again.`
        }
        confirmLabel={confirmStatus?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={acting}
      />
    </div>
  );
}