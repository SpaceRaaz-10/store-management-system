import { useEffect, useState, type FormEvent } from 'react';
import { Upload, X, Loader2, RefreshCw, Wand2, Trash2, ImageOff } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/context/ToastContext';
import { listCategories } from '@/services/categories';
import { createProduct, updateProduct, getNextProductCode } from '@/services/products';
import { uploadProductImage, deleteProductImage } from '@/services/productImages';
import { imageUrl } from '@/lib/format';
import type { ApiError } from '@/services/http';
import type { Category, Product } from '@/types/models';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Product | null;
}

interface FormState {
  name: string;
  sku: string;
  barcode: string;
  category_id: string;
  unit: string;
  cost_price: string;
  selling_price: string;
  stock_qty: string;
  reorder_level: string;
  description: string;
  status: 'active' | 'inactive';
}

const empty: FormState = {
  name: '', sku: '', barcode: '', category_id: '', unit: 'pcs',
  cost_price: '0', selling_price: '0', stock_qty: '0', reorder_level: '5',
  description: '', status: 'active',
};

export function ProductFormDialog({ open, onClose, onSaved, editing }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const res = await listCategories({ per_page: 100, status: 'active' });
        setCategories(res.rows);
      } catch { /* ignore */ }
    })();

    if (editing) {
      setForm({
        name: editing.name,
        sku: editing.sku,
        barcode: editing.barcode ?? '',
        category_id: editing.category_id ? String(editing.category_id) : '',
        unit: editing.unit,
        cost_price: String(editing.cost_price),
        selling_price: String(editing.selling_price),
        stock_qty: String(editing.stock_qty),
        reorder_level: String(editing.reorder_level),
        description: editing.description ?? '',
        status: editing.status,
      });
      setImagePreview(imageUrl(editing.image_path));
    } else {
      setForm(empty);
      setImagePreview(null);
      refreshCodes();
    }

    setPendingImage(null);
    setRemoveExisting(false);
    setErrors({});
  }, [open, editing]);

  useEffect(() => {
    if (!pendingImage) return;
    const url = URL.createObjectURL(pendingImage);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingImage]);

  const refreshCodes = async () => {
    setLoadingCodes(true);
    try {
      const { sku, barcode } = await getNextProductCode();
      setForm((f) => ({ ...f, sku, barcode }));
    } catch {
      // Silent — backend auto-generates on save if blank
    } finally {
      setLoadingCodes(false);
    }
  };

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handlePickFile = (file: File | null) => {
    if (!file) return;
    setPendingImage(file);
    setRemoveExisting(false);
  };

  const handleRemoveImage = () => {
    // Clear the staged file first
    setPendingImage(null);
    // If the product already had a saved image, mark it for deletion on save
    if (editing?.image_path) setRemoveExisting(true);
    setImagePreview(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        barcode: form.barcode.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        unit: form.unit,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
        stock_qty: Number(form.stock_qty),
        reorder_level: Number(form.reorder_level),
        description: form.description.trim() || null,
        status: form.status,
      };

      let product: Product;
      if (editing) {
        product = await updateProduct(editing.id, payload);
      } else {
        product = await createProduct(payload);
      }

      // Handle image changes
      if (pendingImage) {
        try {
          await uploadProductImage(product.id, pendingImage);
        } catch {
          toast.error('Product saved, but image upload failed');
        }
      } else if (removeExisting && editing?.image_path) {
        try {
          await deleteProductImage(product.id);
        } catch {
          toast.error('Product saved, but image removal failed');
        }
      }

      toast.success(editing ? 'Product updated' : 'Product created');
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

  const isNew = !editing;
  const hasImage = !!imagePreview;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Product' : 'New Product'}
      description={editing ? 'Update product details' : 'Add a new product'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="p-name">Name *</Label>
            <Input id="p-name" value={form.name} onChange={(e) => update('name', e.target.value)} autoFocus />
            {errors.name?.[0] && <p className="text-xs text-destructive">{errors.name[0]}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="p-sku">SKU {isNew ? '' : '*'}</Label>
              {isNew && (
                <button
                  type="button"
                  onClick={refreshCodes}
                  disabled={loadingCodes}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {loadingCodes ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </button>
              )}
            </div>
            <div className="relative">
              <Input id="p-sku" value={form.sku} onChange={(e) => update('sku', e.target.value)} placeholder="Auto-generated" />
              {isNew && <Wand2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
            </div>
            {isNew && !errors.sku?.[0] && <p className="text-xs text-muted-foreground">Auto-generated. You can edit if needed.</p>}
            {errors.sku?.[0] && <p className="text-xs text-destructive">{errors.sku[0]}</p>}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="p-barcode">Barcode</Label>
              {isNew && (
                <button
                  type="button"
                  onClick={refreshCodes}
                  disabled={loadingCodes}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  {loadingCodes ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  Regenerate
                </button>
              )}
            </div>
            <div className="relative">
              <Input id="p-barcode" value={form.barcode} onChange={(e) => update('barcode', e.target.value)} placeholder="Auto-generated" />
              {isNew && <Wand2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
            </div>
            {isNew && !errors.barcode?.[0] && <p className="text-xs text-muted-foreground">Auto-generated. Scanner-friendly.</p>}
            {errors.barcode?.[0] && <p className="text-xs text-destructive">{errors.barcode[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-cat">Category</Label>
            <Select id="p-cat" value={form.category_id} onChange={(e) => update('category_id', e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {errors.category_id?.[0] && <p className="text-xs text-destructive">{errors.category_id[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-unit">Unit</Label>
            <Input id="p-unit" value={form.unit} onChange={(e) => update('unit', e.target.value)} placeholder="pcs / kg / ltr" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-cost">Cost Price (NPR) *</Label>
            <Input id="p-cost" type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => update('cost_price', e.target.value)} />
            {errors.cost_price?.[0] && <p className="text-xs text-destructive">{errors.cost_price[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-sell">Selling Price (NPR) *</Label>
            <Input id="p-sell" type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => update('selling_price', e.target.value)} />
            {errors.selling_price?.[0] && <p className="text-xs text-destructive">{errors.selling_price[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-stock">Stock Quantity</Label>
            <Input
              id="p-stock"
              type="number"
              step="0.001"
              min="0"
              value={form.stock_qty}
              onChange={(e) => update('stock_qty', e.target.value)}
              disabled={!!editing}
            />
            {editing && <p className="text-xs text-muted-foreground">Stock changes after creation go through Inventory.</p>}
            {errors.stock_qty?.[0] && <p className="text-xs text-destructive">{errors.stock_qty[0]}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-reorder">Reorder Level</Label>
            <Input id="p-reorder" type="number" step="0.001" min="0" value={form.reorder_level} onChange={(e) => update('reorder_level', e.target.value)} />
            <p className="text-xs text-muted-foreground">Alert threshold. Default: 5.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-status">Status</Label>
            <Select id="p-status" value={form.status} onChange={(e) => update('status', e.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" rows={3} value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>

          {/* ---------------- Product Image ---------------- */}
          <div className="space-y-2 md:col-span-2">
            <Label>Product Image</Label>
            <div className="flex items-start gap-4">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border bg-slate-50">
                {hasImage ? (
                  <>
                    <img src={imagePreview!} alt="preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      title="Remove image"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white transition-opacity hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" />
                    <span className="mt-1 text-xs">No image</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <input
                  id="p-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handlePickFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('p-image')?.click()}
                  >
                    <Upload className="h-4 w-4" /> {hasImage ? 'Replace' : 'Upload Image'}
                  </Button>
                  {hasImage && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage}>
                      <Trash2 className="h-4 w-4 text-destructive" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, or WebP · max 2 MB · you can change or remove anytime.
                </p>
                {pendingImage && (
                  <p className="text-xs text-emerald-600">
                    Ready to upload: {pendingImage.name}
                  </p>
                )}
                {removeExisting && !pendingImage && (
                  <p className="text-xs text-amber-600">
                    Image will be removed when you save.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}