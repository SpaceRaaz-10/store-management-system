import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Power, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { CategoryFormDialog } from './CategoryFormDialog';
import { useToast } from '@/context/ToastContext';
import type { Category } from '@/types/models';
import type { ApiError } from '@/services/http';
import {
  listCategories, setCategoryStatus, deleteCategory,
} from '@/services/categories';

export function CategoriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<Category | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCategories({ page, per_page: 10, search: debounced || undefined });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActing(true);
    try {
      await deleteCategory(confirmDelete.id);
      toast.success('Category deleted');
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
      await setCategoryStatus(confirmStatus.id, next);
      toast.success(`Category ${next === 'active' ? 'activated' : 'deactivated'}`);
      setConfirmStatus(null);
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">Organize your products into groups</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New Category
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search categories..."
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading categories..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No categories yet"
              description="Create your first category to organize products."
              action={
                <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                  <Plus className="h-4 w-4" /> New Category
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.description || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge variant={c.status === 'active' ? 'success' : 'secondary'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.created_at.slice(0, 10)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(c); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title={c.status === 'active' ? 'Deactivate' : 'Activate'} onClick={() => setConfirmStatus(c)}>
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => setConfirmDelete(c)}>
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

      <CategoryFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Delete category?"
        message={`"${confirmDelete?.name}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        loading={acting}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleToggleStatus}
        title={confirmStatus?.status === 'active' ? 'Deactivate category?' : 'Activate category?'}
        message={
          confirmStatus?.status === 'active'
            ? `"${confirmStatus?.name}" will be hidden from new product selection.`
            : `"${confirmStatus?.name}" will become available again.`
        }
        confirmLabel={confirmStatus?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={acting}
      />
    </div>
  );
}