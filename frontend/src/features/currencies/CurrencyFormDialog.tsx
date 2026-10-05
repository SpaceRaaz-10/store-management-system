import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, Coins } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { createCurrency, updateCurrency } from '@/services/currencies';
import type { ApiError } from '@/services/http';
import type { Currency } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Currency | null;
}

interface FormState {
  code: string;
  name: string;
  symbol: string;
  decimal_places: string;
}

const empty: FormState = { code: '', name: '', symbol: '', decimal_places: '2' };

export function CurrencyFormDialog({ open, onClose, onSaved, editing }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        code: editing.code,
        name: editing.name,
        symbol: editing.symbol,
        decimal_places: String(editing.decimal_places),
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
        await updateCurrency(editing.id, {
          name: form.name.trim(),
          symbol: form.symbol.trim(),
          decimal_places: Number(form.decimal_places),
        });
        toast.success('Currency updated');
      } else {
        await createCurrency({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          symbol: form.symbol.trim(),
          decimal_places: Number(form.decimal_places),
        });
        toast.success('Currency created');
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
      title={editing ? 'Edit Currency' : 'New Currency'}
      description={editing ? 'Update currency details' : 'Add a new currency to the system'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cur-code">Currency Code *</Label>
            <Input
              id="cur-code"
              value={form.code}
              onChange={(e) => update('code', e.target.value.toUpperCase())}
              placeholder="USD"
              maxLength={3}
              disabled={!!editing}
              className="font-mono uppercase"
            />
            {editing ? (
              <p className="text-xs text-muted-foreground">Code cannot be changed after creation.</p>
            ) : (
              <p className="text-xs text-muted-foreground">3-letter ISO code (e.g. USD, EUR)</p>
            )}
            {errors.code?.[0] && <p className="text-xs text-destructive">{errors.code[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cur-symbol">Symbol *</Label>
            <Input
              id="cur-symbol"
              value={form.symbol}
              onChange={(e) => update('symbol', e.target.value)}
              placeholder="$ or €"
              maxLength={10}
            />
            {errors.symbol?.[0] && <p className="text-xs text-destructive">{errors.symbol[0]}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cur-name">Currency Name *</Label>
          <Input
            id="cur-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="US Dollar"
            autoFocus={!editing}
          />
          {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="cur-dp">Decimal Places</Label>
          <Select value={form.decimal_places} onChange={(e) => update('decimal_places', e.target.value)}>
            <option value="0">0 (whole units only)</option>
            <option value="2">2 (standard)</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </Select>
          <p className="text-xs text-muted-foreground">Applies to display and rounding.</p>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}