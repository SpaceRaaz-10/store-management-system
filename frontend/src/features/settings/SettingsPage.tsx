import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Save, Loader2, Store, Receipt, Phone, Mail, MapPin, Percent, Hash, Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { getSettings, updateSettings } from '@/services/settings';
import type { ApiError } from '@/services/http';

interface FormState {
  'store.name': string;
  'store.address': string;
  'store.phone': string;
  'store.email': string;
  'invoice.prefix': string;
  'purchase.prefix': string;
  'invoice.tax_rate': string;
  'default.currency': string;
  'base.currency': string;
}

const empty: FormState = {
  'store.name': '',
  'store.address': '',
  'store.phone': '',
  'store.email': '',
  'invoice.prefix': 'INV',
  'purchase.prefix': 'PUR',
  'invoice.tax_rate': '13',
  'default.currency': 'NPR',
  'base.currency': 'NPR',
};

export function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [form, setForm] = useState<FormState>(empty);
  const [original, setOriginal] = useState<FormState>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getSettings();
      const next: FormState = { ...empty };
      (Object.keys(empty) as Array<keyof FormState>).forEach((k) => {
        const entry = s[k];
        if (entry && entry.value !== null) next[k] = entry.value;
      });
      setForm(next);
      setOriginal(next);
    } catch (err) {
      toast.error((err as ApiError).message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(original);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only administrators can save settings');
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const s = await updateSettings(form);
      const next: FormState = { ...empty };
      (Object.keys(empty) as Array<keyof FormState>).forEach((k) => {
        const entry = s[k];
        if (entry && entry.value !== null) next[k] = entry.value;
      });
      setForm(next);
      setOriginal(next);
      toast.success('Settings saved');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(original);
    setErrors({});
  };

  if (loading) {
    return <div className="flex h-[60vh] items-center justify-center"><Spinner label="Loading settings..." /></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? 'Configure your store and system preferences' : 'View system settings'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {dirty && (
              <Button type="button" variant="outline" onClick={handleReset} disabled={saving}>
                Discard
              </Button>
            )}
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>

      {/* Store Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Store Information</CardTitle>
          </div>
          <CardDescription>Shown on invoices, receipts, and reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Store Name *</Label>
            <Input
              id="store-name"
              value={form['store.name']}
              onChange={(e) => update('store.name', e.target.value)}
              disabled={!isAdmin}
              placeholder="My Store"
            />
            {errors['store.name']?.[0] && <p className="text-xs text-destructive">{errors['store.name'][0]}</p>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="store-phone">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</span>
              </Label>
              <Input
                id="store-phone"
                value={form['store.phone']}
                onChange={(e) => update('store.phone', e.target.value)}
                disabled={!isAdmin}
                placeholder="+977-1-XXXXXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-email">
                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
              </Label>
              <Input
                id="store-email"
                type="email"
                value={form['store.email']}
                onChange={(e) => update('store.email', e.target.value)}
                disabled={!isAdmin}
                placeholder="info@store.local"
              />
              {errors['store.email']?.[0] && <p className="text-xs text-destructive">{errors['store.email'][0]}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="store-address">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Address</span>
            </Label>
            <Textarea
              id="store-address"
              rows={2}
              value={form['store.address']}
              onChange={(e) => update('store.address', e.target.value)}
              disabled={!isAdmin}
              placeholder="Street, City, Country"
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Billing & Invoicing</CardTitle>
          </div>
          <CardDescription>Invoice numbering and default tax rate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="inv-prefix">
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Sales Prefix</span>
              </Label>
              <Input
                id="inv-prefix"
                value={form['invoice.prefix']}
                onChange={(e) => update('invoice.prefix', e.target.value.toUpperCase())}
                disabled={!isAdmin}
                maxLength={6}
                placeholder="INV"
              />
              {errors['invoice.prefix']?.[0] && <p className="text-xs text-destructive">{errors['invoice.prefix'][0]}</p>}
              <p className="text-xs text-muted-foreground">
                e.g. <code className="font-mono">{form['invoice.prefix']}-2026-000001</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pur-prefix">
                <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> Purchase Prefix</span>
              </Label>
              <Input
                id="pur-prefix"
                value={form['purchase.prefix']}
                onChange={(e) => update('purchase.prefix', e.target.value.toUpperCase())}
                disabled={!isAdmin}
                maxLength={6}
                placeholder="PUR"
              />
              {errors['purchase.prefix']?.[0] && <p className="text-xs text-destructive">{errors['purchase.prefix'][0]}</p>}
              <p className="text-xs text-muted-foreground">
                e.g. <code className="font-mono">{form['purchase.prefix']}-2026-000001</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax-rate">
                <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> Default Tax Rate</span>
              </Label>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form['invoice.tax_rate']}
                onChange={(e) => update('invoice.tax_rate', e.target.value)}
                disabled={!isAdmin}
              />
              {errors['invoice.tax_rate']?.[0] && <p className="text-xs text-destructive">{errors['invoice.tax_rate'][0]}</p>}
              <p className="text-xs text-muted-foreground">Applied by default on new sales</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Currency</CardTitle>
          </div>
          <CardDescription>Base currency used for reporting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Base / Reporting Currency</Label>
              <Input value={form['base.currency']} disabled />
              <p className="text-xs text-muted-foreground">
                NPR is the fixed base. All reports convert to NPR equivalent.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Default Transaction Currency</Label>
              <Input value={form['default.currency']} disabled />
              <p className="text-xs text-muted-foreground">
                Used as the default when creating sales and purchases.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You are signed in as staff. Only administrators can change these settings.
        </div>
      )}
    </form>
  );
}