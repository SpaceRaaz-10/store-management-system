import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Pencil, Power, Search, KeyRound, Shield, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Card, CardContent } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { UserFormDialog } from './UserFormDialog';
import { PasswordDialog } from './PasswordDialog';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { listUsers, setUserStatus } from '@/services/users';
import type { ApiError } from '@/services/http';
import type { AppUser } from '@/types/models';

export function UsersPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [rows, setRows] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [pwdUser, setPwdUser] = useState<AppUser | null>(null);
  const [confirmStatus, setConfirmStatus] = useState<AppUser | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listUsers({
        page, per_page: 10,
        search: debounced || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setTotal(res.total);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, debounced, roleFilter, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleToggleStatus = async () => {
    if (!confirmStatus) return;
    setActing(true);
    try {
      const next = confirmStatus.status === 'active' ? 'inactive' : 'active';
      await setUserStatus(confirmStatus.id, next);
      toast.success(`User ${next === 'active' ? 'activated' : 'deactivated'}`);
      setConfirmStatus(null);
      load();
    } catch (err) {
      toast.error((err as ApiError).message || 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const hasFilters = search || roleFilter || statusFilter;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage admin and staff accounts</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="h-4 w-4" /> New User
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="relative md:col-span-6">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name or email..."
                className="pl-9"
              />
            </div>
            <div className="md:col-span-3">
              <Select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}>
                <option value="">All roles</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </div>
          </div>
          {hasFilters && (
            <div className="mt-2 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}>
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <Spinner label="Loading users..." />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasFilters ? 'No users match your filters' : 'No users yet'}
              description={hasFilters ? 'Try clearing filters.' : 'Create the first staff account.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            {u.name}
                            {isSelf && <span className="text-[10px] uppercase tracking-wide text-primary">(You)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                        <td className="px-4 py-3">
                          <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                            <span className="flex items-center gap-1">
                              {u.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                              {u.role}
                            </span>
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={u.status === 'active' ? 'success' : 'secondary'}>
                            {u.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {u.last_login_at ? u.last_login_at.slice(0, 16) : 'Never'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => { setEditing(u); setFormOpen(true); }}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Change password" onClick={() => setPwdUser(u)}>
                              <KeyRound className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                              disabled={isSelf}
                              onClick={() => setConfirmStatus(u)}
                            >
                              <Power className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && rows.length > 0 && (
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
      )}

      <UserFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        editing={editing}
        currentUserId={currentUser?.id ?? 0}
      />

      <PasswordDialog
        open={pwdUser !== null}
        onClose={() => setPwdUser(null)}
        user={pwdUser}
      />

      <ConfirmDialog
        open={!!confirmStatus}
        onClose={() => setConfirmStatus(null)}
        onConfirm={handleToggleStatus}
        title={confirmStatus?.status === 'active' ? 'Deactivate user?' : 'Activate user?'}
        message={
          confirmStatus?.status === 'active'
            ? `"${confirmStatus?.name}" will not be able to sign in.`
            : `"${confirmStatus?.name}" will be able to sign in again.`
        }
        confirmLabel={confirmStatus?.status === 'active' ? 'Deactivate' : 'Activate'}
        loading={acting}
      />
    </div>
  );
}