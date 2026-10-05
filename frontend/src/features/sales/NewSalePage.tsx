import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ScanLine, Plus, Minus, Trash2, Loader2, Save,
  User, Package, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/context/ToastContext';
import { listCustomers } from '@/services/customers';
import { listProducts, lookupByBarcode } from '@/services/products';
import { listCurrencies, listPaymentMethods } from '@/services/currencies';
import { createSale } from '@/services/sales';
import { formatMoney, formatQty, imageUrl } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Customer, Product, Currency, PaymentMethod } from '@/types/models';

interface CartLine {
  key: string;
  product: Product;
  quantity: number;
}

export function NewSalePage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discountType, setDiscountType] = useState<'none' | 'fixed' | 'percent'>('none');
  const [discountValue, setDiscountValue] = useState('0');
  const [taxRate, setTaxRate] = useState('13');
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, cur, m] = await Promise.all([
          listProducts({ per_page: 100, status: 'active' }),
          listCustomers({ per_page: 100, status: 'active' }),
          listCurrencies(),
          listPaymentMethods(),
        ]);
        setProducts(p.rows);
        setCustomers(c.rows);
        setCurrencies(cur);
        setPaymentMethods(m);

        const base = cur.find((x) => x.is_base === 1);
        if (base) setCurrencyId(String(base.id));
        if (m[0]) setPaymentMethodId(String(m[0].id));
      } catch {
        toast.error('Failed to load sale form data');
      }
    })();
  }, [toast]);

  const selectedCurrency = useMemo(
    () => currencies.find((c) => String(c.id) === currencyId) ?? null,
    [currencies, currencyId]
  );
  const symbol = selectedCurrency?.symbol ?? 'रु';
  const rate = selectedCurrency?.rate_to_base ?? 1;

  // ---------- Cart operations ----------
  const addToCart = (product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: l.quantity + qty }
            : l
        );
      }
      return [...prev, { key: Math.random().toString(36).slice(2), product, quantity: qty }];
    });
  };

  const updateQty = (key: string, qty: number) =>
    setCart((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(0.001, qty) } : l))
    );

  const removeLine = (key: string) => setCart((prev) => prev.filter((l) => l.key !== key));

  const clearCart = () => setCart([]);

  // ---------- Search ----------
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 20);
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? '').toLowerCase().includes(q)
    ).slice(0, 20);
  }, [products, search]);

  const handleBarcodeScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const p = await lookupByBarcode(trimmed);
      if (p.status !== 'active') {
        toast.error(`${p.name} is inactive`);
      } else {
        addToCart(p, 1);
        toast.success(`Added ${p.name}`);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 404) toast.error(`No product with barcode "${trimmed}"`);
      else toast.error(apiErr.message || 'Lookup failed');
    } finally {
      if (barcodeRef.current) {
        barcodeRef.current.value = '';
        barcodeRef.current.focus();
      }
    }
  };

  // ---------- Totals ----------
  const subtotal = useMemo(() => {
    return cart.reduce((sum, l) => {
      const unitPriceBase = Number(l.product.selling_price);
      const unitPrice = rate ? unitPriceBase / rate : unitPriceBase;
      return sum + unitPrice * l.quantity;
    }, 0);
  }, [cart, rate]);

  const discountAmount = useMemo(() => {
    const v = Number(discountValue) || 0;
    if (discountType === 'percent') return Math.min(subtotal, (subtotal * v) / 100);
    if (discountType === 'fixed') return Math.min(subtotal, v);
    return 0;
  }, [discountType, discountValue, subtotal]);

  const taxable = subtotal - discountAmount;
  const taxAmount = useMemo(() => (taxable * (Number(taxRate) || 0)) / 100, [taxRate, taxable]);
  const total = taxable + taxAmount;
  const due = Math.max(0, total - (Number(paidAmount) || 0));

  // ---------- Submit ----------
  const handleSubmit = async (e: FormEvent, andNew = false) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    if (!currencyId) {
      toast.error('Currency is required');
      return;
    }

    setSaving(true);
    try {
      const items = cart.map((l) => {
        const unitPriceBase = Number(l.product.selling_price);
        const unitPrice = rate ? unitPriceBase / rate : unitPriceBase;
        return {
          product_id: l.product.id,
          quantity: l.quantity,
          unit_price: round(unitPrice, 2),
        };
      });

      const created = await createSale({
        customer_id: customerId ? Number(customerId) : null,
        currency_id: Number(currencyId),
        sale_date: saleDate,
        discount_type: discountType === 'none' ? null : discountType,
        discount_value: Number(discountValue) || 0,
        tax_rate: Number(taxRate) || 0,
        paid_amount: Number(paidAmount) || 0,
        payment_method_id: paymentMethodId ? Number(paymentMethodId) : null,
        notes: notes.trim() || null,
        items,
      });

      toast.success(`Sale ${created.invoice_no} completed`);

      if (andNew) {
        setCart([]);
        setNotes('');
        setPaidAmount('0');
        setDiscountValue('0');
        setDiscountType('none');
      } else {
        navigate('/sales');
      }
    } catch (err) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || 'Failed to create sale');
    } finally {
      setSaving(false);
    }
  };

  const round = (n: number, dp: number) => Math.round(n * Math.pow(10, dp)) / Math.pow(10, dp);

  return (
    <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate('/sales')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Sale</h1>
            <p className="text-sm text-muted-foreground">Point of sale — search, scan, or click products</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={(e) => handleSubmit(e as unknown as FormEvent, true)} disabled={saving}>
            Save & New
          </Button>
          <Button type="submit" disabled={saving || cart.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : `Complete Sale (${formatMoney(total, symbol)})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* LEFT: Product picker */}
        <div className="lg:col-span-3 space-y-3">
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, SKU, or barcode..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 rounded-md border border-dashed bg-blue-50/50 px-3 py-2">
                <ScanLine className="h-4 w-4 text-primary" />
                <Input
                  ref={barcodeRef}
                  placeholder="Scan barcode + Enter, or type barcode and press Enter"
                  className="h-8 flex-1 border-0 bg-transparent focus-visible:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeScan((e.target as HTMLInputElement).value);
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-2">
              {searchResults.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No products match "{search}"
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {searchResults.map((p) => {
                    const img = imageUrl(p.image_path);
                    const stock = Number(p.stock_qty);
                    const out = stock <= 0;
                    const unitPriceBase = Number(p.selling_price);
                    const unitPrice = rate ? unitPriceBase / rate : unitPriceBase;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={out}
                        onClick={() => addToCart(p, 1)}
                        className={
                          'flex items-start gap-3 rounded-md border p-2 text-left transition-colors ' +
                          (out
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-50'
                            : 'hover:border-primary hover:bg-primary/5')
                        }
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border bg-white">
                          {img ? (
                            <img src={img} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm">{p.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.sku}</div>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-sm font-semibold">{formatMoney(unitPrice, symbol)}</span>
                            <span className={'text-[10px] ' + (stock <= Number(p.reorder_level) ? 'text-amber-600 font-medium' : 'text-muted-foreground')}>
                              {out ? 'Out of stock' : `${formatQty(stock)} left`}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Cart + payment */}
        <div className="lg:col-span-2 space-y-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle>Cart ({cart.length})</CardTitle>
              {cart.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {cart.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  Cart is empty
                </div>
              ) : (
                <div className="max-h-[340px] overflow-y-auto">
                  {cart.map((l) => {
                    const unitPriceBase = Number(l.product.selling_price);
                    const unitPrice = rate ? unitPriceBase / rate : unitPriceBase;
                    const lineTotal = unitPrice * l.quantity;
                    const overStock = l.quantity > Number(l.product.stock_qty);
                    return (
                      <div key={l.key} className="border-t px-3 py-2 first:border-t-0">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{l.product.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatMoney(unitPrice, symbol)} × {formatQty(l.quantity)}
                            </div>
                            {overStock && (
                              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-600">
                                <AlertTriangle className="h-3 w-3" /> Only {formatQty(l.product.stock_qty)} in stock
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button" variant="outline" size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQty(l.key, l.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={l.quantity}
                              onChange={(e) => updateQty(l.key, Number(e.target.value))}
                              className="h-6 w-14 px-1 text-center text-xs"
                            />
                            <Button
                              type="button" variant="outline" size="icon"
                              className="h-6 w-6"
                              onClick={() => updateQty(l.key, l.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="w-16 text-right text-sm font-medium tabular-nums">
                            {formatMoney(lineTotal, symbol)}
                          </div>
                          <Button
                            type="button" variant="ghost" size="icon"
                            className="h-6 w-6"
                            onClick={() => removeLine(l.key)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle>Sale Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" /> Customer (optional)
                </Label>
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
                    {currencies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code}{c.is_base === 1 ? ' (base)' : ''}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                </div>
              </div>

              {selectedCurrency && selectedCurrency.is_base === 0 && (
                <div className="rounded border bg-slate-50 px-2 py-1.5 text-xs text-muted-foreground">
                  1 {selectedCurrency.code} = {Number(selectedCurrency.rate_to_base ?? 0).toFixed(4)} NPR
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Discount</Label>
                  <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as 'none' | 'fixed' | 'percent')}>
                    <option value="none">None</option>
                    <option value="fixed">Fixed ({symbol})</option>
                    <option value="percent">Percent (%)</option>
                  </Select>
                </div>
                {discountType !== 'none' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Value</Label>
                    <Input type="number" min="0" step="0.01" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Tax Rate (%)</Label>
                  <Input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Method</Label>
                  <Select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                    <option value="">— None —</option>
                    {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Amount Paid ({symbol})</Label>
                <Input
                  type="number" min="0" step="0.01"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Enter less than total for partial payment.</span>
                  <button
                    type="button"
                    onClick={() => setPaidAmount(total.toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    Pay full
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-50">
            <CardContent className="p-4 space-y-1.5 text-sm">
              <Row label="Subtotal" value={formatMoney(subtotal, symbol)} />
              {discountAmount > 0 && <Row label="Discount" value={`− ${formatMoney(discountAmount, symbol)}`} />}
              {taxAmount > 0 && <Row label={`Tax (${taxRate}%)`} value={formatMoney(taxAmount, symbol)} />}
              <Row label="Total" value={formatMoney(total, symbol)} bold />
              {Number(paidAmount) > 0 && <Row label="Paid" value={formatMoney(Number(paidAmount), symbol)} />}
              <Row label="Due" value={formatMoney(due, symbol)} warn={due > 0} />
            </CardContent>
          </Card>
        </div>
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