import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import type { Category } from '@/types/models';
import type { ApiError } from '@/services/http';
import { useToast } from '@/context/ToastContext';
import { createCategory, updateCategory } from '@/services/categories';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Category | null;
}

export function CategoryFormDialog({ open, onClose, onSaved, editing }: Props) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '');
      setDescription(editing?.description ?? '');
      setStatus(editing?.status ?? 'active');
      setErrors({});
    }
  }, [open, editing]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = { name: name.trim(), description: description.trim() || null, status };
      if (editing) {
        await updateCategory(editing.id, payload);
        toast.success('Category updated');
      } else {
        await createCategory(payload);
        toast.success('Category created');
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
      title={editing ? 'Edit Category' : 'New Category'}
      description={editing ? 'Update the category details' : 'Add a new category'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cat-name">Name *</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beverages"
            autoFocus
          />
          {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-desc">Description</Label>
          <Textarea
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="cat-status">Status</Label>
          <Select
            id="cat-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}