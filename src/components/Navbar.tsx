import {
  Bell,
  Heart,
  Menu,
  MessageCircle,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  User,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.tsx';
import { TELEGRAM_ADMIN_URL } from '../lib/regions.ts';

export function Navbar() {
  const {
    currentPath,
    navigate,
    theme,
    toggleTheme,
    user,
    cart,
    unreadNotifications,
    searchQuery,
    setSearchQuery,
  } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/catalog');
  };

  const navLinks = [
    { label: 'Catalog', path: '/catalog' },
    { label: 'Categories', path: '/categories' },
    { label: 'Orders', path: user ? '/orders' : '/orders/track' },
    { label: 'Support', path: '/support' },
    { label: 'Admin', path: '/admin' },
  ];

  const cartCount = cart?.item_count || 0;

  return (
    <div className="sticky top-0 z-40 bg-white/95 dark:bg-[#0E1712]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#1E3126]">
      {/* Primary 3-Zone Top Bar */}
      <header className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Wordmark */}
        <button
          type="button"
          onClick={() => navigate('/')}
          className="text-xl font-display font-extrabold tracking-tight text-[#113826] dark:text-[#D6ECDD] whitespace-nowrap shrink-0 cursor-pointer"
        >
          X-MARKET
        </button>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          {navLinks.map((link) => {
            const active =
              currentPath === link.path ||
              (link.path !== '/' && currentPath.startsWith(link.path));
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 border-b-2 ${
                  active
                    ? 'text-[#14532D] dark:text-[#6EE7B7] border-[#2E8B57]'
                    : 'border-transparent hover:text-[#113826] dark:hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F7A4D] hover:bg-[#14532D] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Cart</span>
            <span className="font-mono tabular-nums text-xs opacity-90">({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182920] cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Secondary Customer Utility Toolbar (Search, Account, Notifications, Theme, Permanent Contact Admin) */}
      <div className="border-t border-slate-100 dark:border-[#192920] bg-[#F8FAF9] dark:bg-[#0B120E]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleSearchSubmit} className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, tags, or Order ID (AB12345678)..."
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#2E8B57]"
            />
          </form>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <a
              href={TELEGRAM_ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EBF5EE] dark:bg-[#162C20] text-[#14532D] dark:text-[#6EE7B7] hover:bg-[#D6ECDD] dark:hover:bg-[#1F3D2D] transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Contact Admin</span>
            </a>

            <button
              type="button"
              onClick={() => navigate('/favorites')}
              aria-label="Favorites"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#192920] transition-colors cursor-pointer"
            >
              <Heart className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#192920] transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#1F7A4D] text-white text-[10px] font-mono font-semibold flex items-center justify-center">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle light or dark theme"
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#192920] transition-colors cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs font-medium text-slate-800 dark:text-slate-100 hover:border-[#2E8B57] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#1F7A4D] dark:text-[#6EE7B7]" />
                <span className="max-w-[120px] truncate">{user.full_name}</span>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">#{user.profile_id}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/signin')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#192920] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#14532D] text-white hover:bg-[#0F3D26] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Create Account
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen ? (
        <div className="md:hidden border-t border-slate-200 dark:border-[#1E3126] bg-white dark:bg-[#0E1712] px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <button
              key={link.path}
              type="button"
              onClick={() => {
                navigate(link.path);
                setMobileOpen(false);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#EBF5EE] dark:hover:bg-[#182920] cursor-pointer"
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              navigate('/ai');
              setMobileOpen(false);
            }}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#14532D] dark:text-[#6EE7B7] hover:bg-[#EBF5EE] dark:hover:bg-[#182920] cursor-pointer"
          >
            X-MARKET AI Assistant
          </button>
          <button
            type="button"
            onClick={() => {
              navigate('/seller-chat');
              setMobileOpen(false);
            }}
            className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-[#EBF5EE] dark:hover:bg-[#182920] cursor-pointer"
          >
            Seller Messages
          </button>
        </div>
      ) : null}
    </div>
  );
}
