import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { createUser, updateUser } from '@/services/users';
import type { ApiError } from '@/services/http';
import type { AppUser } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: AppUser | null;
  currentUserId: number;
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
}

const empty: FormState = { name: '', email: '', password: '', role: 'staff', status: 'active' };

export function UserFormDialog({ open, onClose, onSaved, editing, currentUserId }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const isSelf = editing?.id === currentUserId;

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        email: editing.email,
        password: '',
        role: editing.role,
        status: editing.status,
      });
    } else {
      setForm(empty);
    }
    setErrors({});
  }, [open, editing]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      if (editing) {
        await updateUser(editing.id, {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role,
          status: form.status,
        });
        toast.success('User updated');
      } else {
        await createUser({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          status: form.status,
        });
        toast.success('User created');
      }
      onSaved();
      onClose();
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit User' : 'New User'}
      description={editing ? 'Update user details and role' : 'Create a new staff or admin account'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="u-name">Full Name *</Label>
          <Input id="u-name" value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus />
          {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="u-email">Email *</Label>
          <Input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="user@store.local"
          />
          {errors.email?.[0] && <p className="text-xs text-destructive">{errors.email[0]}</p>}
        </div>

        {!editing && (
          <div className="space-y-2">
            <Label htmlFor="u-pass">Password *</Label>
            <Input
              id="u-pass"
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="At least 6 characters with a letter and a digit"
            />
            {errors.password?.[0] && <p className="text-xs text-destructive">{errors.password[0]}</p>}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="u-role">Role *</Label>
            <Select
              id="u-role"
              value={form.role}
              onChange={(e) => update('role', e.target.value as 'admin' | 'staff')}
              disabled={isSelf}
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">You cannot change your own role.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="u-status">Status *</Label>
            <Select
              id="u-status"
              value={form.status}
              onChange={(e) => update('status', e.target.value as 'active' | 'inactive')}
              disabled={isSelf}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
            {isSelf && <p className="text-xs text-muted-foreground">You cannot deactivate yourself.</p>}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {saving ? 'Saving...' : editing ? 'Update' : 'Create User'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}