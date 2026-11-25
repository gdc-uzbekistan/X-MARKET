import {
  BarChart3,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext.tsx';
import { apiRequest } from '../../lib/api.ts';
import { AdminCategoriesView, AdminProductsView, AdminPromosView } from './AdminCatalogTabs.tsx';
import { AdminLoginPage } from './AdminLoginPage.tsx';
import {
  AdminCustomersView,
  AdminMessagesView,
  AdminOrdersView,
  AdminSettingsView,
} from './AdminOpsTabs.tsx';

function AdminDashboardAndAnalytics({ isAnalytics }: { isAnalytics: boolean }) {
  const { navigate, subscribeWs } = useStore();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [data, setData] = useState<any | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await apiRequest(`/api/admin/analytics?period=${period}`, { authMode: 'admin' });
      setData(res);
    } catch {
      // ignore
    }
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type.startsWith('order:') || ev.type.startsWith('product:')) {
        loadAnalytics();
      }
    });
  }, [subscribeWs, loadAnalytics]);

  if (!data) {
    return <div className="py-12 text-center text-sm text-slate-500">Loading real-time metrics...</div>;
  }

  const { kpis, lowStockProducts, recentCustomers, recentOrders, chartSeries, topProducts } = data;
  const maxRevenue = Math.max(1, ...chartSeries.map((c: any) => Number(c.revenue || 0)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
            {isAnalytics ? 'Revenue & Sales Analytics' : 'Executive Overview'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Live database metrics across customers, inventory, and orders.
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A]">
          {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize cursor-pointer ${
                period === p
                  ? 'bg-[#14532D] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#192920]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: `$${Number(kpis.totalRevenue).toFixed(2)}` },
          { label: 'Total Orders', value: String(kpis.totalOrders) },
          { label: 'Total Customers', value: String(kpis.totalCustomers) },
          { label: 'Total Products', value: String(kpis.totalProducts) },
          { label: 'Pending Orders', value: String(kpis.pendingOrders) },
          { label: 'Delivered Orders', value: String(kpis.completedOrders) },
          { label: 'Cancelled / Refunded', value: String(kpis.cancelledOrders) },
          { label: 'Inventory Stock Value', value: `$${Number(kpis.totalStockValue).toFixed(2)}` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</p>
            <p className="mt-2 text-2xl font-mono font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Sales Chart */}
      <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 capitalize">
            {period} Revenue &amp; Order Volume
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {chartSeries.length} period(s) recorded
          </span>
        </div>

        {chartSeries.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-slate-500">
            No sales recorded yet. Revenue bars appear here automatically as orders are placed.
          </div>
        ) : (
          <div className="h-52 flex items-end gap-3 pt-4 overflow-x-auto">
            {chartSeries.map((pt: any) => {
              const pct = Math.max(6, Math.round((Number(pt.revenue) / maxRevenue) * 100));
              return (
                <div key={pt.label} className="flex-1 min-w-[52px] flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    ${Number(pt.revenue).toFixed(0)}
                  </span>
                  <div
                    style={{ height: `${pct}%` }}
                    className="w-full max-w-[44px] rounded-t-lg bg-[#1F7A4D] dark:bg-[#2E8B57]"
                    title={`${pt.label}: $${Number(pt.revenue).toFixed(2)} (${pt.orders_count} orders)`}
                  />
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-full">
                    {pt.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Tables */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
              Low-Stock Products (&le; 5)
            </h3>
            <button
              type="button"
              onClick={() => navigate('/admin/products')}
              className="text-xs text-[#1F7A4D] dark:text-[#6EE7B7] cursor-pointer"
            >
              Manage
            </button>
          </div>
          {lowStockProducts.length === 0 ? (
            <p className="text-xs text-slate-500">No low-stock products.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1E3126] text-xs">
              {lowStockProducts.map((p: any) => (
                <div key={p.id} className="py-2 flex justify-between gap-2">
                  <span className="truncate text-slate-800 dark:text-slate-200">{p.name}</span>
                  <span className="font-mono font-bold text-amber-600 tabular-nums">{p.quantity} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
              Recent Customers
            </h3>
            <button
              type="button"
              onClick={() => navigate('/admin/customers')}
              className="text-xs text-[#1F7A4D] dark:text-[#6EE7B7] cursor-pointer"
            >
              View All
            </button>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-xs text-slate-500">No registered customers yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1E3126] text-xs">
              {recentCustomers.map((c: any) => (
                <div key={c.id} className="py-2 flex justify-between gap-2">
                  <span className="truncate text-slate-800 dark:text-slate-200">{c.full_name}</span>
                  <span className="font-mono text-slate-500">#{c.profile_id}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100">
              {isAnalytics ? 'Top Products' : 'Recent Orders'}
            </h3>
            <button
              type="button"
              onClick={() => navigate(isAnalytics ? '/admin/products' : '/admin/orders')}
              className="text-xs text-[#1F7A4D] dark:text-[#6EE7B7] cursor-pointer"
            >
              View All
            </button>
          </div>
          {isAnalytics ? (
            topProducts.length === 0 ? (
              <p className="text-xs text-slate-500">No products yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1E3126] text-xs">
                {topProducts.map((tp: any) => (
                  <div key={tp.id} className="py-2 flex justify-between gap-2">
                    <span className="truncate text-slate-800 dark:text-slate-200">{tp.name}</span>
                    <span className="font-mono tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                      {tp.sales_count} sold
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : recentOrders.length === 0 ? (
            <p className="text-xs text-slate-500">No orders placed yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#1E3126] text-xs">
              {recentOrders.map((o: any) => (
                <div key={o.id} className="py-2 flex justify-between gap-2">
                  <span className="font-mono font-semibold text-[#14532D] dark:text-[#6EE7B7]">
                    {o.order_number}
                  </span>
                  <span className="text-slate-500">{o.status}</span>
                  <span className="font-mono tabular-nums">${Number(o.total_amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminPortal() {
  const { admin, currentPath, navigate, logoutAdmin, theme, toggleTheme } = useStore();

  // Strictly block access to any /admin route if not authenticated as Admin
  if (!admin || currentPath === '/admin/login') {
    return <AdminLoginPage />;
  }

  const navItems = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Products', path: '/admin/products', icon: Package },
    { label: 'Categories', path: '/admin/categories', icon: FolderTree },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingCart },
    { label: 'Customers', path: '/admin/customers', icon: Users },
    { label: 'Promo Codes', path: '/admin/promos', icon: Tag },
    { label: 'Messages', path: '/admin/messages', icon: MessageSquare },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
    { label: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const activeLabel = navItems.find((i) => i.path === currentPath)?.label || 'Dashboard';

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-[#0B120E] flex flex-col lg:flex-row">
      {/* Admin Sidebar */}
      <aside className="lg:w-64 bg-white dark:bg-[#0E1712] border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-[#1E3126] flex flex-col shrink-0">
        <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200 dark:border-[#1E3126]">
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="text-lg font-display font-extrabold text-[#14532D] dark:text-[#6EE7B7] whitespace-nowrap cursor-pointer"
          >
            X-MARKET Admin
          </button>
        </div>

        <nav className="p-3 flex lg:flex-col gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16271D]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-200 dark:border-[#1E3126] hidden lg:block space-y-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#16271D] cursor-pointer"
          >
            <Store className="w-4 h-4" />
            <span>View Storefront</span>
          </button>
          <button
            type="button"
            onClick={logoutAdmin}
            className="w-full flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-[#0E1712] border-b border-slate-200 dark:border-[#1E3126] px-6 flex items-center justify-between gap-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Admin <span className="mx-1.5">/</span>{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{activeLabel}</span>
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#192920] cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:inline">
              {admin.full_name}
            </span>
            <button
              type="button"
              onClick={logoutAdmin}
              className="lg:hidden px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 border border-red-200 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {currentPath === '/admin/products' ? (
            <AdminProductsView />
          ) : currentPath === '/admin/categories' ? (
            <AdminCategoriesView />
          ) : currentPath === '/admin/orders' ? (
            <AdminOrdersView onNavigateTab={navigate} />
          ) : currentPath === '/admin/customers' ? (
            <AdminCustomersView />
          ) : currentPath === '/admin/promos' ? (
            <AdminPromosView />
          ) : currentPath === '/admin/messages' ? (
            <AdminMessagesView />
          ) : currentPath === '/admin/settings' ? (
            <AdminSettingsView />
          ) : currentPath === '/admin/analytics' ? (
            <AdminDashboardAndAnalytics isAnalytics />
          ) : (
            <AdminDashboardAndAnalytics isAnalytics={false} />
          )}
        </main>
      </div>
    </div>
  );
}
