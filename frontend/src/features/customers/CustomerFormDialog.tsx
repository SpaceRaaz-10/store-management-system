import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { createCustomer, updateCustomer } from '@/services/customers';
import type { ApiError } from '@/services/http';
import type { Customer } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Customer | null;
}

interface FormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
}

const empty: FormState = { name: '', phone: '', email: '', address: '', status: 'active' };

export function CustomerFormDialog({ open, onClose, onSaved, editing }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        phone: editing.phone ?? '',
        email: editing.email ?? '',
        address: editing.address ?? '',
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
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        status: form.status,
      };
      if (editing) {
        await updateCustomer(editing.id, payload);
        toast.success('Customer updated');
      } else {
        await createCustomer(payload);
        toast.success('Customer created');
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
      title={editing ? 'Edit Customer' : 'New Customer'}
      description={editing ? 'Update customer details' : 'Add a new customer'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="c-name">Name *</Label>
          <Input id="c-name" value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus />
          {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="c-phone">Phone</Label>
            <Input id="c-phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
            {errors.phone?.[0] && <p className="text-xs text-destructive">{errors.phone[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
            {errors.email?.[0] && <p className="text-xs text-destructive">{errors.email[0]}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-address">Address</Label>
          <Textarea id="c-address" rows={3} value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="c-status">Status</Label>
          <Select id="c-status" value={form.status} onChange={(e) => update('status', e.target.value as 'active' | 'inactive')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}