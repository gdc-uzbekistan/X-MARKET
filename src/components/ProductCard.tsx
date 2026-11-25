import { Heart, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import type { Product } from '../types.ts';
import { SafeImage } from './SafeImage.tsx';

export function ProductCard({ product }: { product: Product }) {
  const { navigate, addToCart, favoriteIds, toggleFavorite } = useStore();
  const isFav = favoriteIds.has(product.id);
  const hasDiscount = product.discount_percent > 0 && product.discounted_price !== null;

  return (
    <article className="group rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200/80 dark:border-[#21362A] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        onClick={() => navigate(`/product/${product.id}`)}
        className="relative aspect-[4/3] bg-[#F3F7F4] dark:bg-[#0D1611] overflow-hidden cursor-pointer"
      >
        <SafeImage
          src={product.images[0]}
          alt={product.name}
          fallbackLabel={product.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />

        {hasDiscount ? (
          <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-[#14532D] text-white text-xs font-mono font-semibold tabular-nums">
            -{product.discount_percent}%
          </span>
        ) : null}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          aria-label={isFav ? 'Remove from favorites' : 'Save to favorites'}
          className={`absolute top-3 right-3 p-2 rounded-lg transition-colors cursor-pointer ${
            isFav
              ? 'bg-[#14532D] text-white'
              : 'bg-white/90 dark:bg-[#121F18]/90 text-slate-600 dark:text-slate-300 hover:text-[#14532D]'
          }`}
        >
          <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="truncate">{product.category_name || 'Marketplace'}</span>
            {product.weight ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">{product.weight}</span>
              </>
            ) : null}
          </div>

          <h3
            onClick={() => navigate(`/product/${product.id}`)}
            className="mt-1 text-base font-display font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 cursor-pointer hover:text-[#1F7A4D] dark:hover:text-[#6EE7B7]"
          >
            {product.name}
          </h3>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-[#1E3126] flex items-center justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-mono font-semibold tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                ${product.effective_price.toFixed(2)}
              </span>
              {hasDiscount ? (
                <span className="text-xs font-mono tabular-nums text-slate-400 line-through">
                  ${product.original_price.toFixed(2)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {product.is_available ? `${product.quantity} in stock` : 'Out of stock'}
            </p>
          </div>

          <button
            type="button"
            disabled={!product.is_available}
            onClick={() => addToCart(product.id, 1)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] hover:bg-[#1F7A4D] hover:text-white dark:hover:bg-[#1F7A4D] dark:hover:text-white disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </article>
  );
}
