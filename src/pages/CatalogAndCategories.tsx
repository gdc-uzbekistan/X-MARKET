import { ArrowLeft, Heart, MessageSquare, Package, ShoppingBag, Star } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Product } from '../types.ts';

export function CatalogPage() {
  const { categories, products, searchQuery, setSearchQuery, loadingCatalog } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('category') || 'all';
  });
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'price_asc' | 'price_desc'>('newest');
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    const childCatIds =
      selectedCategory !== 'all'
        ? new Set([
            Number(selectedCategory),
            ...categories.filter((c) => c.parent_id === Number(selectedCategory)).map((c) => c.id),
          ])
        : null;

    const list = products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.description} ${p.category_name || ''} ${p.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (childCatIds && (!p.category_id || !childCatIds.has(p.category_id))) {
        return false;
      }
      if (min !== null && !Number.isNaN(min) && p.effective_price < min) return false;
      if (max !== null && !Number.isNaN(max) && p.effective_price > max) return false;
      if (onlyDiscounted && p.discount_percent <= 0) return false;
      return true;
    });

    if (sortBy === 'price_asc') return [...list].sort((a, b) => a.effective_price - b.effective_price);
    if (sortBy === 'price_desc') return [...list].sort((a, b) => b.effective_price - a.effective_price);
    if (sortBy === 'popular')
      return [...list].sort((a, b) => b.sales_count - a.sales_count || b.views_count - a.views_count);
    return [...list].sort((a, b) => b.id - a.id);
  }, [products, categories, searchQuery, selectedCategory, minPrice, maxPrice, onlyDiscounted, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#1E3126]">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
            Product Catalog
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {filtered.length} product{filtered.length === 1 ? '' : 's'} matching your filters
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.parent_id ? `↳ ${c.name}` : c.name}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min $"
            className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-800 dark:text-slate-100"
          />

          <input
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max $"
            className="w-24 px-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm font-mono text-slate-800 dark:text-slate-100"
          />

          <button
            type="button"
            onClick={() => setOnlyDiscounted((v) => !v)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              onlyDiscounted
                ? 'bg-[#14532D] text-white border-[#14532D]'
                : 'bg-white dark:bg-[#121F18] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#243B2E]'
            }`}
          >
            Discounted Only
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-800 dark:text-slate-100"
          >
            <option value="newest">Sort: Newest</option>
            <option value="popular">Sort: Popular</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {loadingCatalog ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-80 rounded-2xl bg-slate-100 dark:bg-[#121F18] animate-pulse border border-slate-200 dark:border-[#21362A]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <Package className="w-10 h-10 text-[#2E8B57] mx-auto mb-3 opacity-70" />
          <p className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
            No products found
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Try clearing your search or price filters, or check back as administrators add new listings.
          </p>
          {(searchQuery || selectedCategory !== 'all' || minPrice || maxPrice || onlyDiscounted) ? (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setMinPrice('');
                setMaxPrice('');
                setOnlyDiscounted(false);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer"
            >
              Reset All Filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoriesPage() {
  const { categories, navigate } = useStore();
  const rootCats = categories.filter((c) => !c.parent_id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
        Marketplace Categories
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Browse categories and subcategories configured in X-MARKET.
      </p>

      {categories.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">No categories yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Categories created in Admin Category Management appear here instantly.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {rootCats.map((cat) => {
            const subcats = categories.filter((s) => s.parent_id === cat.id);
            return (
              <div
                key={cat.id}
                className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/catalog?category=${cat.id}`)}
                  className="aspect-[4/3] bg-[#F3F7F4] dark:bg-[#0D1611] overflow-hidden cursor-pointer text-left"
                >
                  <SafeImage src={cat.image_url} alt={cat.name} fallbackLabel={cat.name} />
                </button>
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                        {cat.name}
                      </h2>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {cat.product_count ?? 0} products
                      </span>
                    </div>
                    {cat.description ? (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{cat.description}</p>
                    ) : null}

                    {subcats.length > 0 ? (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#1E3126] flex flex-wrap gap-2">
                        {subcats.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => navigate(`/catalog?category=${sub.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-medium hover:bg-[#D6ECDD] cursor-pointer"
                          >
                            {sub.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/catalog?category=${cat.id}`)}
                    className="mt-4 w-full py-2.5 rounded-xl bg-[#14532D] text-white text-xs font-semibold hover:bg-[#0F3D26] cursor-pointer"
                  >
                    View Products
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage({ productId }: { productId: number }) {
  const { navigate, addToCart, favoriteIds, toggleFavorite, user, showToast } = useStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiRequest<{ product: Product; reviews: any[] }>(`/api/products/${productId}`, { authMode: 'none' })
      .then((res) => {
        setProduct(res.product);
        setReviews(res.reviews || []);
        setActiveImg(0);
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  const handleMessageSeller = async () => {
    if (!user) {
      showToast('Please sign in to message the seller', 'info');
      navigate('/signin');
      return;
    }
    if (!product?.seller_id) {
      navigate('/support');
      return;
    }
    try {
      await apiRequest('/api/chat/sellers/start', {
        method: 'POST',
        body: JSON.stringify({ sellerId: product.seller_id, productId: product.id }),
      });
      navigate('/seller-chat');
    } catch (err: any) {
      showToast(err.message || 'Could not start seller chat', 'error');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/signin');
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await apiRequest<{ review: any }>(`/api/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      });
      setReviews((prev) => [res.review, ...prev]);
      setComment('');
      showToast('Review submitted', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not submit review', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="h-96 rounded-3xl bg-slate-100 dark:bg-[#121F18] animate-pulse" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">Product not found</h1>
        <button
          type="button"
          onClick={() => navigate('/catalog')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-medium cursor-pointer"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  const isFav = favoriteIds.has(product.id);
  const hasDiscount = product.discount_percent > 0 && product.discounted_price !== null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={() => navigate('/catalog')}
        className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-[#14532D] mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Catalog</span>
      </button>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Gallery Left */}
        <div className="lg:col-span-7 space-y-4">
          <div className="aspect-[4/3] rounded-3xl overflow-hidden bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A]">
            <SafeImage
              src={product.images[activeImg]}
              alt={product.name}
              fallbackLabel={product.name}
            />
          </div>

          {product.images.length > 1 ? (
            <div className="grid grid-cols-5 gap-3">
              {product.images.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImg(idx)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 cursor-pointer ${
                    activeImg === idx
                      ? 'border-[#1F7A4D]'
                      : 'border-slate-200 dark:border-[#21362A] opacity-75 hover:opacity-100'
                  }`}
                >
                  <SafeImage src={url} alt={`${product.name} ${idx + 1}`} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Sticky Purchase Module Right */}
        <div className="lg:col-span-5 rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 sm:p-8 space-y-5 lg:sticky lg:top-32">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{product.category_name || 'Marketplace'}</span>
            {product.weight ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Weight: {product.weight}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{product.views_count} views</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-mono font-bold tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
              ${product.effective_price.toFixed(2)}
            </span>
            {hasDiscount ? (
              <>
                <span className="text-lg font-mono tabular-nums text-slate-400 line-through">
                  ${product.original_price.toFixed(2)}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-mono font-semibold">
                  Save {product.discount_percent}%
                </span>
              </>
            ) : null}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {product.description || 'No description provided.'}
          </p>

          <div className="py-3 border-y border-slate-100 dark:border-[#1E3126] flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">Availability</span>
            <span
              className={`font-medium tabular-nums ${
                product.is_available ? 'text-[#1F7A4D] dark:text-[#6EE7B7]' : 'text-red-600 dark:text-red-400'
              }`}
            >
              {product.is_available ? `In Stock (${product.quantity} available)` : 'Out of Stock'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-[#243B2E] bg-[#F8FAF9] dark:bg-[#0B120E]">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3.5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                -
              </button>
              <span className="px-3 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(Math.max(1, product.quantity), q + 1))}
                className="px-3.5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={!product.is_available}
              onClick={() => addToCart(product.id, qty)}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold disabled:opacity-45 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Add to Cart</span>
            </button>

            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              aria-label="Toggle favorite"
              className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                isFav
                  ? 'bg-[#14532D] border-[#14532D] text-white'
                  : 'border-slate-200 dark:border-[#243B2E] text-slate-600 dark:text-slate-300 hover:border-[#2E8B57]'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </div>

          {/* Seller / Support Box */}
          <div className="p-4 rounded-2xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sold by</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {product.seller ? product.seller.store_name : 'X-MARKET Official Store'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleMessageSeller}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs font-medium text-[#14532D] dark:text-[#6EE7B7] hover:border-[#2E8B57] cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{product.seller ? 'Message Seller' : 'Ask Admin'}</span>
            </button>
          </div>

          {product.specs.length > 0 ? (
            <div className="pt-2">
              <h2 className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Specifications
              </h2>
              <dl className="divide-y divide-slate-100 dark:divide-[#1E3126] text-xs">
                {product.specs.map((sp, i) => (
                  <div key={i} className="py-2 flex justify-between gap-4">
                    <dt className="text-slate-500 dark:text-slate-400">{sp.label}</dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100 text-right">{sp.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {product.tags.length > 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tags: {product.tags.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section className="mt-12 pt-8 border-t border-slate-200 dark:border-[#1E3126] grid lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5">
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            Customer Reviews ({reviews.length})
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Verified customer feedback for this product.
          </p>

          <form onSubmit={handleReviewSubmit} className="mt-5 p-5 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] space-y-3">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Write a Review</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 cursor-pointer"
                >
                  <Star
                    className={`w-5 h-5 ${
                      n <= rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />
                </button>
              ))}
            </div>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={user ? 'Share your experience with this product...' : 'Sign in to leave a review'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={submittingReview}
              className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold hover:bg-[#0F3D26] cursor-pointer"
            >
              {submittingReview ? 'Submitting...' : 'Post Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-3">
          {reviews.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] text-sm text-slate-500 dark:text-slate-400">
              No reviews yet for this product.
            </div>
          ) : (
            reviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {rev.full_name} <span className="font-mono text-xs text-slate-400">#{rev.profile_id}</span>
                  </span>
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                    {'★'.repeat(rev.rating)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
