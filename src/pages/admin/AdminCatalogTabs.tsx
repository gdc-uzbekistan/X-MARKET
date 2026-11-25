import { Edit2, ImagePlus, Plus, Star, Trash2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { SafeImage } from '../../components/SafeImage.tsx';
import { useStore } from '../../context/StoreContext.tsx';
import { apiRequest, uploadImageFile } from '../../lib/api.ts';
import type { Product, PromoCode } from '../../types.ts';

export function AdminProductsView() {
  const { products, categories, refreshCatalog, showToast } = useStore();
  const [editing, setEditing] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountedPrice, setDiscountedPrice] = useState('');
  const [weight, setWeight] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [categoryId, setCategoryId] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [specs, setSpecs] = useState<{ label: string; value: string }[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Quick inline category creation inside product form
  const [quickCatName, setQuickCatName] = useState('');

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setOriginalPrice('');
    setDiscountedPrice('');
    setWeight('');
    setQuantity('10');
    setCategoryId('');
    setIsAvailable(true);
    setIsFeatured(false);
    setImages([]);
    setSpecs([]);
    setTagsInput('');
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setOriginalPrice(String(p.original_price));
    setDiscountedPrice(p.discounted_price !== null ? String(p.discounted_price) : '');
    setWeight(p.weight);
    setQuantity(String(p.quantity));
    setCategoryId(p.category_id ? String(p.category_id) : '');
    setIsAvailable(p.is_available);
    setIsFeatured(p.is_featured);
    setImages(p.images || []);
    setSpecs(p.specs || []);
    setTagsInput((p.tags || []).join(', '));
    setShowForm(true);
  };

  const handleMultiImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const url = await uploadImageFile(file, 'admin');
        setImages((prev) => [...prev, url]);
      } catch (err: any) {
        showToast(err.message || 'Image upload failed', 'error');
      }
    }
  };

  const handleQuickCreateCategory = async () => {
    if (!quickCatName.trim()) return;
    try {
      const res = await apiRequest<{ category: any }>('/api/admin/categories', {
        method: 'POST',
        authMode: 'admin',
        body: JSON.stringify({ name: quickCatName.trim() }),
      });
      await refreshCatalog();
      setCategoryId(String(res.category.id));
      setQuickCatName('');
      showToast('Category created', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not create category', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        originalPrice: Number(originalPrice),
        discountedPrice: discountedPrice.trim() !== '' ? Number(discountedPrice) : null,
        weight,
        quantity: Number(quantity),
        categoryId: categoryId ? Number(categoryId) : null,
        isAvailable,
        isFeatured,
        images,
        specs: specs.filter((s) => s.label.trim() && s.value.trim()),
        tags: tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      if (editing) {
        await apiRequest(`/api/admin/products/${editing.id}`, {
          method: 'PUT',
          authMode: 'admin',
          body: JSON.stringify(payload),
        });
        showToast('Product updated in real time', 'success');
      } else {
        await apiRequest('/api/admin/products', {
          method: 'POST',
          authMode: 'admin',
          body: JSON.stringify(payload),
        });
        showToast('Product published in real time', 'success');
      }

      await refreshCatalog();
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiRequest(`/api/admin/products/${id}`, { method: 'DELETE', authMode: 'admin' });
      await refreshCatalog();
      showToast('Product deleted', 'info');
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  const origNum = Number(originalPrice || 0);
  const discNum = discountedPrice.trim() !== '' ? Number(discountedPrice) : null;
  const effPrice = discNum !== null && discNum < origNum ? discNum : origNum;
  const autoDiscountPct = origNum > 0 && effPrice < origNum ? Math.round(((origNum - effPrice) / origNum) * 100) : 0;
  const autoStockValue = effPrice * Math.max(0, Number(quantity || 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
            Product Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Add, edit, feature, discount, and manage inventory in real time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setShowForm((v) => !v);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{showForm ? 'Close Form' : 'Add Product'}</span>
        </button>
      </div>

      {showForm ? (
        <form
          onSubmit={handleSave}
          className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-5"
        >
          <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            {editing ? `Edit Product: ${editing.name}` : 'Create New Product'}
          </h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Product Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Category (or quick-create)
              </label>
              <div className="flex gap-2">
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.parent_id ? `↳ ${c.name}` : c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={quickCatName}
                  onChange={(e) => setQuickCatName(e.target.value)}
                  placeholder="New cat..."
                  className="w-28 px-2.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleQuickCreateCategory}
                  className="px-3 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Original Price ($)
              </label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Discounted Price ($)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discountedPrice}
                onChange={(e) => setDiscountedPrice(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Weight
              </label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 500g, 1.2kg"
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantity
              </label>
              <input
                type="number"
                required
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#EBF5EE] dark:bg-[#162C20] text-xs text-[#14532D] dark:text-[#6EE7B7] flex flex-wrap gap-6 font-mono tabular-nums">
            <span>Calculated Discount: {autoDiscountPct}%</span>
            <span>Effective Unit Price: ${effPrice.toFixed(2)}</span>
            <span>Total Stock Value: ${autoStockValue.toFixed(2)}</span>
          </div>

          {/* Multi-Image Upload */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
              Product Images (Multiple Supported)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {images.map((url, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 dark:border-[#243B2E]">
                  <SafeImage src={url} alt={`Product ${idx + 1}`} />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 p-0.5 rounded-md bg-black/70 text-white cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#2B4637] flex flex-col items-center justify-center text-xs text-slate-500 cursor-pointer hover:border-[#2E8B57]">
                <ImagePlus className="w-5 h-5 mb-1" />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleMultiImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Specifications */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Specifications
              </label>
              <button
                type="button"
                onClick={() => setSpecs((prev) => [...prev, { label: '', value: '' }])}
                className="text-xs font-semibold text-[#1F7A4D] dark:text-[#6EE7B7] cursor-pointer"
              >
                + Add Specification
              </button>
            </div>
            <div className="space-y-2">
              {specs.map((sp, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={sp.label}
                    onChange={(e) =>
                      setSpecs((prev) => prev.map((row, idx) => (idx === i ? { ...row, label: e.target.value } : row)))
                    }
                    placeholder="Property (e.g. Material)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={sp.value}
                    onChange={(e) =>
                      setSpecs((prev) => prev.map((row, idx) => (idx === i ? { ...row, value: e.target.value } : row)))
                    }
                    placeholder="Value (e.g. Stainless Steel)"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setSpecs((prev) => prev.filter((_, idx) => idx !== i))}
                    className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="organic, bestseller, summer"
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-6 pt-4 sm:pt-0">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(e) => setIsAvailable(e.target.checked)}
                />
                <span>Available for Sale</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span>Featured on Homepage</span>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Publish Product'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {/* Products Table */}
      <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1E3126] text-xs text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4 font-medium">Product</th>
              <th className="py-3 px-4 font-medium">Category</th>
              <th className="py-3 px-4 font-medium text-right">Original</th>
              <th className="py-3 px-4 font-medium text-right">Active Price</th>
              <th className="py-3 px-4 font-medium text-right">Stock</th>
              <th className="py-3 px-4 font-medium text-right">Stock Value</th>
              <th className="py-3 px-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1E3126]">
            {products.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                  No products created yet. Click "Add Product" to publish your first listing.
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-[#16271D]">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                        <SafeImage src={p.images[0]} alt={p.name} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.is_featured ? 'Featured · ' : ''}
                          {p.is_available ? 'Available' : 'Unavailable'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                    {p.category_name || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                    ${p.original_price.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                    ${p.effective_price.toFixed(2)}
                    {p.discount_percent > 0 ? ` (-${p.discount_percent}%)` : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                    {p.quantity}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    ${p.stock_value.toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiRequest(`/api/admin/products/${p.id}`, {
                            method: 'PUT',
                            authMode: 'admin',
                            body: JSON.stringify({ isFeatured: !p.is_featured }),
                          });
                          refreshCatalog();
                        }}
                        title="Toggle Featured"
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          p.is_featured ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${p.is_featured ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#14532D] cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCategoriesView() {
  const { categories, refreshCatalog, showToast } = useStore();
  const [editId, setEditId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const reset = () => {
    setEditId(null);
    setName('');
    setParentId('');
    setDescription('');
    setImageUrl('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file, 'admin');
      setImageUrl(url);
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name,
        parentId: parentId ? Number(parentId) : null,
        description,
        imageUrl: imageUrl || null,
      };
      if (editId) {
        await apiRequest(`/api/admin/categories/${editId}`, {
          method: 'PUT',
          authMode: 'admin',
          body: JSON.stringify(payload),
        });
        showToast('Category updated', 'success');
      } else {
        await apiRequest('/api/admin/categories', {
          method: 'POST',
          authMode: 'admin',
          body: JSON.stringify(payload),
        });
        showToast('Category created', 'success');
      }
      await refreshCatalog();
      reset();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Category Management
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create categories and subcategories with custom imagery.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4"
      >
        <div className="grid sm:grid-cols-3 gap-4">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          >
            <option value="">Top-Level Category</option>
            {categories
              .filter((c) => !c.parent_id && c.id !== editId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Subcategory of: {c.name}
                </option>
              ))}
          </select>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer">
            <ImagePlus className="w-4 h-4" />
            <span>{imageUrl ? 'Change Category Image' : 'Upload Category Image'}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} className="hidden" />
          </label>
          {imageUrl ? <img src={imageUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover" /> : null}

          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            {editId ? 'Update Category' : 'Create Category'}
          </button>
          {editId ? (
            <button type="button" onClick={reset} className="text-xs text-slate-500 cursor-pointer">
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-4 flex items-center gap-3"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
              <SafeImage src={c.image_url} alt={c.name} fallbackLabel={c.name} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {c.parent_id ? '↳ ' : ''}
                {c.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {c.product_count ?? 0} products
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditId(c.id);
                setName(c.name);
                setParentId(c.parent_id ? String(c.parent_id) : '');
                setDescription(c.description || '');
                setImageUrl(c.image_url || '');
              }}
              className="p-1.5 text-slate-500 hover:text-[#14532D] cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={async () => {
                await apiRequest(`/api/admin/categories/${c.id}`, { method: 'DELETE', authMode: 'admin' });
                refreshCatalog();
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPromosView() {
  const { categories, products, showToast } = useStore();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrderAmount, setMinOrderAmount] = useState('0');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [perCustomerLimit, setPerCustomerLimit] = useState('1');
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [selectedProds, setSelectedProds] = useState<number[]>([]);

  const loadPromos = async () => {
    try {
      const res = await apiRequest<{ promos: PromoCode[] }>('/api/admin/promos', { authMode: 'admin' });
      setPromos(res.promos || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadPromos();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/promos', {
        method: 'POST',
        authMode: 'admin',
        body: JSON.stringify({
          code,
          discountType,
          discountValue: Number(discountValue),
          minOrderAmount: Number(minOrderAmount || 0),
          maxDiscount: maxDiscount ? Number(maxDiscount) : null,
          expiresAt: expiresAt || null,
          usageLimit: usageLimit ? Number(usageLimit) : null,
          perCustomerLimit: Number(perCustomerLimit || 1),
          applicableCategoryIds: selectedCats,
          applicableProductIds: selectedProds,
        }),
      });
      setCode('');
      setSelectedCats([]);
      setSelectedProds([]);
      await loadPromos();
      showToast('Promo code created', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not create promo', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Promo Code Management
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Configure discount percentages, fixed amounts, usage limits, expiry dates, and targeted products/categories.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Promo Code</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SPRING20"
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Type</label>
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="percent">Percentage (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Discount Value</label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Min Order ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minOrderAmount}
              onChange={(e) => setMinOrderAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Discount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Expiration Date</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Total Usage Limit</label>
            <input
              type="number"
              min="1"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Per-Customer Limit</label>
            <input
              type="number"
              min="1"
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-500 mb-1">Applicable Categories (empty = all)</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E]">
              {categories.map((c) => {
                const active = selectedCats.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() =>
                      setSelectedCats((prev) =>
                        active ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                      )
                    }
                    className={`px-2 py-1 rounded-md cursor-pointer ${
                      active
                        ? 'bg-[#14532D] text-white'
                        : 'bg-white dark:bg-[#121F18] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-slate-500 mb-1">Applicable Products (empty = all)</p>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E]">
              {products.map((p) => {
                const active = selectedProds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setSelectedProds((prev) =>
                        active ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className={`px-2 py-1 rounded-md cursor-pointer ${
                      active
                        ? 'bg-[#14532D] text-white'
                        : 'bg-white dark:bg-[#121F18] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Create Promo Code
        </button>
      </form>

      <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-[#1E3126] text-xs text-slate-500">
              <th className="py-3 px-4">Code</th>
              <th className="py-3 px-4">Discount</th>
              <th className="py-3 px-4">Min Order</th>
              <th className="py-3 px-4">Used / Limit</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1E3126]">
            {promos.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No promo codes configured yet.
                </td>
              </tr>
            ) : (
              promos.map((pr) => (
                <tr key={pr.id}>
                  <td className="py-3 px-4 font-mono font-bold text-[#14532D] dark:text-[#6EE7B7]">
                    {pr.code}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {pr.discount_type === 'percent' ? `${pr.discount_value}%` : `$${pr.discount_value}`}
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums">${pr.min_order_amount}</td>
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {pr.used_count} / {pr.usage_limit ?? '∞'}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/promos/${pr.id}`, {
                          method: 'PATCH',
                          authMode: 'admin',
                          body: JSON.stringify({ isActive: !pr.is_active }),
                        });
                        loadPromos();
                      }}
                      className={`font-semibold cursor-pointer ${
                        pr.is_active ? 'text-[#1F7A4D] dark:text-[#6EE7B7]' : 'text-slate-400'
                      }`}
                    >
                      {pr.is_active ? 'Active (Click to pause)' : 'Inactive (Click to enable)'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/admin/promos/${pr.id}`, {
                          method: 'DELETE',
                          authMode: 'admin',
                        });
                        loadPromos();
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
