import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useToast } from '@/context/ToastContext';
import { listSuppliers } from '@/services/suppliers';
import { listProducts } from '@/services/products';
import { listCurrencies, listPaymentMethods } from '@/services/currencies';
import { createPurchase } from '@/services/purchases';
import { formatMoney } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Supplier, Product, Currency, PaymentMethod } from '@/types/models';

interface LineItem {
  key: string;
  product_id: number | '';
  quantity: string;
  unit_cost: string;
}

const newLine = (): LineItem => ({
  key: Math.random().toString(36).slice(2),
  product_id: '',
  quantity: '1',
  unit_cost: '0',
});

export function NewPurchasePage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [supplierId, setSupplierId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [taxRate, setTaxRate] = useState('13');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const [s, p, c, m] = await Promise.all([
          listSuppliers({ per_page: 100, status: 'active' }),
          listProducts({ per_page: 100, status: 'active' }),
          listCurrencies(),
          listPaymentMethods(),
        ]);
        setSuppliers(s.rows);
        setProducts(p.rows);
        setCurrencies(c);
        setPaymentMethods(m);

        const base = c.find((x) => x.is_base === 1);
        if (base) setCurrencyId(String(base.id));
        if (m[0]) setPaymentMethodId(String(m[0].id));
      } catch (err) {
        toast.error('Failed to load form data');
      }
    })();
  }, [toast]);

  const selectedCurrency = useMemo(
    () => currencies.find((c) => String(c.id) === currencyId) ?? null,
    [currencies, currencyId]
  );

  const productMap = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const updateItem = (key: string, patch: Partial<LineItem>) =>
    setItems((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const addItem = () => setItems((rows) => [...rows, newLine()]);
  const removeItem = (key: string) => setItems((rows) => rows.filter((r) => r.key !== key));

  const handleProductPick = (key: string, productId: string) => {
    const id = Number(productId);
    const p = productMap.get(id);
    const cost = p ? Number(p.cost_price) : 0;
    updateItem(key, { product_id: id, unit_cost: String(cost) });
  };

  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const q = Number(it.quantity) || 0;
      const c = Number(it.unit_cost) || 0;
      return sum + q * c;
    }, 0);
  }, [items]);

  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountType === 'percent') return Math.min(subtotal, (subtotal * v) / 100);
    if (discountType === 'fixed') return Math.min(subtotal, v);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const taxable = subtotal - discountAmount;
  const taxAmount = useMemo(() => {
    const r = Number(taxRate) || 0;
    return (taxable * r) / 100;
  }, [taxRate, taxable]);
  const total = taxable + taxAmount;

  const handleSubmit = async (e: FormEvent, andNew: boolean = false) => {
    e.preventDefault();
    setErrors({});

    const clean = items
      .map((it) => ({
        product_id: Number(it.product_id),
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost),
      }))
      .filter((it) => it.product_id > 0 && it.quantity > 0);

    if (!supplierId) { toast.error('Supplier is required'); return; }
    if (!currencyId) { toast.error('Currency is required'); return; }
    if (clean.length === 0) { toast.error('Add at least one item'); return; }

    setSaving(true);
    try {
      const created = await createPurchase({
        supplier_id: Number(supplierId),
        currency_id: Number(currencyId),
        purchase_date: purchaseDate,
        discount_type: discountType === 'none' ? null : discountType,
        discount_value: Number(discountValue) || 0,
        tax_rate: Number(taxRate) || 0,
        paid_amount: Number(paidAmount) || 0,
        payment_method_id: paymentMethodId ? Number(paymentMethodId) : null,
        notes: notes.trim() || null,
        items: clean,
      });
      toast.success(`Purchase ${created.invoice_no} created`);

      if (andNew) {
        setItems([newLine()]);
        setNotes('');
        setPaidAmount('0');
      } else {
        navigate('/purchases');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.errors) setErrors(apiErr.errors);
      toast.error(apiErr.message || 'Failed to save purchase');
    } finally {
      setSaving(false);
    }
  };

  const symbol = selectedCurrency?.symbol ?? 'रु';
  const hasRateWarning = selectedCurrency && selectedCurrency.is_base === 0 && !selectedCurrency.rate_to_base;

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/purchases')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Purchase</h1>
            <p className="text-sm text-muted-foreground">Record a restocking purchase from a supplier</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as unknown as FormEvent, true)} disabled={saving}>
            Save & New
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Purchase'}
          </Button>
        </div>
      </div>

      {/* Header info */}
      <Card>
        <CardHeader><CardTitle>Purchase Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— Choose supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purchase Date *</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Currency *</Label>
              <Select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
                {currencies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} ({c.symbol}){c.is_base === 1 ? ' — base' : ''}
                  </option>
                ))}
              </Select>
              {hasRateWarning && (
                <p className="text-xs text-destructive">No active exchange rate. Set one in Settings first.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Items</CardTitle>
          <Button type="button" size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="pb-2">Product</th>
                  <th className="pb-2 w-24">Qty</th>
                  <th className="pb-2 w-32">Unit Cost</th>
                  <th className="pb-2 w-32 text-right">Line Total</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const lineTotal = (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0);
                  return (
                    <tr key={it.key} className="border-t">
                      <td className="py-2 pr-2">
                        <Select
                          value={it.product_id === '' ? '' : String(it.product_id)}
                          onChange={(e) => handleProductPick(it.key, e.target.value)}
                        >
                          <option value="">— Choose product —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} · {p.sku} (stock {Number(p.stock_qty).toFixed(0)})
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number" min="0.001" step="0.001"
                          value={it.quantity}
                          onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={it.unit_cost}
                          onChange={(e) => updateItem(it.key, { unit_cost: e.target.value })}
                        />
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums font-medium">
                        {formatMoney(lineTotal, symbol)}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          type="button" variant="ghost" size="icon"
                          disabled={items.length === 1}
                          onClick={() => removeItem(it.key)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals + Payment */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Payment & Notes</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                  <option value="">— None —</option>
                  {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Paid Now ({symbol})</Label>
                <Input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this purchase" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Totals</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 items-center">
              <Label className="text-xs">Discount Type</Label>
              <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'none' | 'fixed' | 'percent')}>
                <option value="none">None</option>
                <option value="fixed">Fixed</option>
                <option value="percent">Percent</option>
              </Select>
            </div>
            {discountType !== 'none' && (
              <div className="grid grid-cols-2 gap-2 items-center">
                <Label className="text-xs">Discount Value</Label>
                <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 items-center">
              <Label className="text-xs">Tax Rate (%)</Label>
              <Input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
            </div>

            <div className="border-t pt-3 space-y-1.5">
              <Row label="Subtotal" value={formatMoney(subtotal, symbol)} />
              {discountAmount > 0 && (
                <Row label="Discount" value={`− ${formatMoney(discountAmount, symbol)}`} />
              )}
              {taxAmount > 0 && (
                <Row label={`Tax (${taxRate}%)`} value={formatMoney(taxAmount, symbol)} />
              )}
              <Row label="Total" value={formatMoney(total, symbol)} bold />
              {Number(paidAmount) > 0 && (
                <Row label="Paid" value={formatMoney(Number(paidAmount), symbol)} />
              )}
              <Row label="Due" value={formatMoney(Math.max(0, total - (Number(paidAmount) || 0)), symbol)} warn />
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function Row({ label, value, bold, warn }: { label: string; value: string; bold?: boolean; warn?: boolean }) {
  return (
    <div className={
      'flex justify-between ' +
      (bold ? 'font-semibold text-base border-t pt-2 mt-1' : '') +
      (warn ? ' text-amber-600' : '')
    }>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}