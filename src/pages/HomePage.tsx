import { ArrowRight, Bot, MapPin, MessageCircle, Package, ShieldCheck, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { TELEGRAM_ADMIN_URL } from '../lib/regions.ts';

type ShowcaseTab = 'featured' | 'discounted' | 'popular' | 'new';

export function HomePage() {
  const { user, categories, products, loadingCatalog, navigate } = useStore();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('featured');

  const topCategories = useMemo(
    () => categories.filter((c) => !c.parent_id).slice(0, 6),
    [categories]
  );

  const displayedProducts = useMemo(() => {
    if (activeTab === 'featured') {
      const feat = products.filter((p) => p.is_featured);
      return (feat.length > 0 ? feat : products).slice(0, 6);
    }
    if (activeTab === 'discounted') {
      return products.filter((p) => p.discount_percent > 0).slice(0, 6);
    }
    if (activeTab === 'popular') {
      return [...products].sort((a, b) => b.sales_count - a.sales_count || b.views_count - a.views_count).slice(0, 6);
    }
    return [...products].sort((a, b) => b.id - a.id).slice(0, 6);
  }, [activeTab, products]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {/* Hero Split Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 rounded-3xl bg-[#EBF5EE] dark:bg-[#12241A] border border-[#D6ECDD] dark:border-[#1E3B2B] p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium tracking-wide text-[#14532D] dark:text-[#6EE7B7]">
                  X-MARKET · Live Curated Commerce
                </p>
                <h1 className="mt-4 text-3xl sm:text-5xl font-display font-bold tracking-tight text-[#0F3D26] dark:text-[#EDF4EF] leading-[1.1] [text-wrap:balance]">
                  Shop verified products with live inventory and direct support.
                </h1>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  Browse real-time marketplace listings, apply validated promo codes, track every order with unique AB-series IDs, and consult X-MARKET AI anytime.
                </p>
              </div>

              <div className="mt-8 space-y-4">
                {!user ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/register')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/signin')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-[#0E1712] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100 hover:border-[#2E8B57] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/catalog')}
                      className="px-4 py-3 text-sm font-medium text-[#14532D] dark:text-[#6EE7B7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Browse Catalog
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/catalog')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>Explore Catalog</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/orders')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white dark:bg-[#0E1712] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100 hover:border-[#2E8B57] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <span>My Orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/ai')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/80 dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-sm font-medium hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Bot className="w-4 h-4" />
                      <span>Ask X-MARKET AI</span>
                    </button>
                  </div>
                )}

                <div className="pt-4 border-t border-[#D6ECDD] dark:border-[#1E3B2B] flex flex-wrap items-center gap-5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#1F7A4D]" />
                    Verified inventory &amp; pricing
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#1F7A4D]" />
                    Regional &amp; district delivery
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#1F7A4D]" />
                    Permission-first geolocation
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-[#21362A] min-h-[320px] lg:min-h-[440px]">
              <img
                src="/src/assets/images/hero_xmarket_storefront_1795608272677.jpg"
                alt="X-MARKET modern architectural storefront"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Categories Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200/70 dark:border-[#1B2D23]">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                Shop by Category
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Live marketplace categories managed directly by store administrators.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/categories')}
              className="text-sm font-medium text-[#1F7A4D] dark:text-[#6EE7B7] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              All Categories
            </button>
          </div>

          {topCategories.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-8 text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                No categories have been published yet.
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Administrators can add categories and subcategories from the Admin Portal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {topCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => navigate(`/catalog?category=${cat.id}`)}
                  className="group rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200/80 dark:border-[#21362A] p-3 text-left hover:border-[#2E8B57] transition-colors cursor-pointer"
                >
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F3F7F4] dark:bg-[#0D1611] mb-3">
                    <SafeImage src={cat.image_url} alt={cat.name} fallbackLabel={cat.name} />
                  </div>
                  <p className="text-sm font-display font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {cat.product_count ?? 0} items
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Marketplace Products Showcase (Featured, Discounted, Popular, New Arrivals) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200/70 dark:border-[#1B2D23]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                Marketplace Collection
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real-time inventory synchronized with administrator updates.
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-x-auto">
              {[
                { key: 'featured', label: 'Featured' },
                { key: 'discounted', label: 'Discounted' },
                { key: 'popular', label: 'Popular' },
                { key: 'new', label: 'New Arrivals' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as ShowcaseTab)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-[#1D3527] text-[#14532D] dark:text-[#6EE7B7] shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingCatalog ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-80 rounded-2xl bg-slate-100 dark:bg-[#121F18] animate-pulse border border-slate-200 dark:border-[#21362A]"
                />
              ))}
            </div>
          ) : displayedProducts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
              <Package className="w-10 h-10 text-[#2E8B57] mx-auto mb-3 opacity-70" />
              <h3 className="text-base font-display font-semibold text-slate-900 dark:text-slate-100">
                No {activeTab === 'discounted' ? 'discounted ' : ''}products available yet
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Products added in the Admin Portal appear here immediately in real time for all shoppers.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/catalog')}
                  className="px-4 py-2 rounded-xl bg-[#1F7A4D] text-white text-sm font-medium hover:bg-[#14532D] cursor-pointer"
                >
                  Open Full Catalog
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#192920] cursor-pointer"
                >
                  Admin Portal
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* Editorial Support & AI Gateway */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 border-t border-slate-200/70 dark:border-[#1B2D23]">
          <div className="grid lg:grid-cols-12 gap-8 items-stretch rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden">
            <div className="lg:col-span-5 min-h-[260px]">
              <img
                src="/src/assets/images/category_editorial_showcase_1795608272669.jpg"
                alt="X-MARKET curated essentials"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="lg:col-span-7 p-8 sm:p-10 flex flex-col justify-center">
              <p className="text-xs font-medium text-[#1F7A4D] dark:text-[#6EE7B7]">
                24/7 Shopping Assistance &amp; Order Tracking
              </p>
              <h2 className="mt-2 text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-slate-100 [text-wrap:balance]">
                Need product guidance, promo help, or direct administrator support?
              </h2>
              <p className="mt-3 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                Chat directly with X-MARKET AI powered by live marketplace data, message administrators inside the app with real-time read receipts, or reach us on Telegram anytime.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/ai')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-medium hover:bg-[#0F3D26] cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>Open X-MARKET AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/support')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-sm font-medium hover:bg-[#D6ECDD] cursor-pointer"
                >
                  <span>In-App Admin Chat</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/orders/track')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-[#2E8B57] cursor-pointer"
                >
                  <span>Track Order ID</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Marketplace Footer */}
      <footer className="border-t border-slate-200 dark:border-[#1E3126] bg-white dark:bg-[#0E1712] mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-display font-bold text-[#14532D] dark:text-[#6EE7B7]">X-MARKET</span>
            <span aria-hidden="true">·</span>
            <span>Commercial Online Marketplace</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-sm">
            <button
              type="button"
              onClick={() => navigate('/catalog')}
              className="text-slate-600 dark:text-slate-300 hover:text-[#14532D] cursor-pointer"
            >
              Catalog
            </button>
            <button
              type="button"
              onClick={() => navigate('/orders/track')}
              className="text-slate-600 dark:text-slate-300 hover:text-[#14532D] cursor-pointer"
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={() => navigate('/seller-chat')}
              className="text-slate-600 dark:text-slate-300 hover:text-[#14532D] cursor-pointer"
            >
              Seller Hub
            </button>
            <a
              href={TELEGRAM_ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[#14532D] dark:text-[#6EE7B7] hover:underline"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Admin</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
