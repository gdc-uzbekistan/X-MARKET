import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  apiRequest,
  getAdminToken,
  getCustomerToken,
  setAdminToken,
  setCustomerToken,
} from '../lib/api.ts';
import type {
  AdminUser,
  AppNotification,
  CartSummary,
  Category,
  CustomerUser,
  Product,
} from '../types.ts';

interface ToastItem {
  id: string;
  title: string;
  type: 'success' | 'error' | 'info';
}

interface WsEvent {
  type: string;
  data: any;
}

interface StoreContextValue {
  currentPath: string;
  navigate: (path: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  user: CustomerUser | null;
  admin: AdminUser | null;
  categories: Category[];
  products: Product[];
  loadingCatalog: boolean;
  cart: CartSummary | null;
  favoriteIds: Set<number>;
  notifications: AppNotification[];
  unreadNotifications: number;
  presence: { adminOnline: boolean; onlineUserIds: number[] };
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  toasts: ToastItem[];
  showToast: (title: string, type?: 'success' | 'error' | 'info') => void;
  setCustomerSession: (token: string, user: CustomerUser) => void;
  setAdminSession: (token: string, admin: AdminUser) => void;
  logoutCustomer: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  refreshCart: () => Promise<void>;
  refreshFavorites: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateCartQuantity: (productId: number, quantity: number) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  toggleFavorite: (productId: number) => Promise<void>;
  markNotificationRead: (id: number) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  subscribeWs: (listener: (ev: WsEvent) => void) => () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [presence, setPresence] = useState<{ adminOnline: boolean; onlineUserIds: number[] }>({
    adminOnline: false,
    onlineUserIds: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const wsListenersRef = useRef<Set<(ev: WsEvent) => void>>(new Set());

  const showToast = useCallback((title: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, title, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const navigate = useCallback((path: string) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshCatalog = useCallback(async () => {
    try {
      const [catRes, prodRes] = await Promise.all([
        apiRequest<{ categories: Category[] }>('/api/categories', { authMode: 'none' }),
        apiRequest<{ products: Product[] }>('/api/products', { authMode: 'none' }),
      ]);
      setCategories(catRes.categories || []);
      setProducts(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  const refreshCart = useCallback(async () => {
    if (!getCustomerToken()) {
      setCart(null);
      return;
    }
    try {
      const data = await apiRequest<CartSummary>('/api/cart');
      setCart(data);
    } catch {
      setCart(null);
    }
  }, []);

  const refreshFavorites = useCallback(async () => {
    if (!getCustomerToken()) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const data = await apiRequest<{ favorites: Product[] }>('/api/favorites');
      setFavoriteIds(new Set((data.favorites || []).map((p) => p.id)));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (getAdminToken() && currentPath.startsWith('/admin')) {
      try {
        const data = await apiRequest<{ notifications: AppNotification[] }>('/api/admin/notifications', {
          authMode: 'admin',
        });
        setNotifications(data.notifications || []);
      } catch {
        // ignore
      }
      return;
    }
    if (!getCustomerToken()) {
      setNotifications([]);
      return;
    }
    try {
      const data = await apiRequest<{ notifications: AppNotification[] }>('/api/notifications');
      setNotifications(data.notifications || []);
    } catch {
      // ignore
    }
  }, [currentPath]);

  const refreshUser = useCallback(async () => {
    if (!getCustomerToken()) {
      setUser(null);
      return;
    }
    try {
      const data = await apiRequest<{ user: CustomerUser }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setCustomerToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    if (user) {
      refreshCart();
      refreshFavorites();
      refreshNotifications();
    } else {
      setCart(null);
      setFavoriteIds(new Set());
      if (!admin) setNotifications([]);
    }
  }, [user, admin, refreshCart, refreshFavorites, refreshNotifications]);

  useEffect(() => {
    if (admin && currentPath.startsWith('/admin')) {
      refreshNotifications();
    }
  }, [admin, currentPath, refreshNotifications]);

  // Real-time WebSocket connection with automatic reconnection
  const sendWsAuth = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const token = currentPath.startsWith('/admin') && getAdminToken() ? getAdminToken() : getCustomerToken() || getAdminToken();
    if (token) {
      ws.send(JSON.stringify({ type: 'auth', token }));
    }
  }, [currentPath]);

  useEffect(() => {
    let closed = false;
    let reconnectTimer: number | null = null;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        sendWsAuth();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; data?: any; presence?: any };
          if (msg.type === 'connected' && msg.presence) {
            setPresence(msg.presence);
          } else if (msg.type === 'auth:ack' && msg.presence) {
            setPresence(msg.presence);
          } else if (msg.type === 'presence:update' && msg.data) {
            setPresence(msg.data);
          } else if (msg.type === 'product:created' && msg.data) {
            setProducts((prev) => {
              if (prev.some((p) => p.id === msg.data.id)) return prev;
              return [msg.data, ...prev];
            });
          } else if (msg.type === 'product:updated' && msg.data) {
            setProducts((prev) => prev.map((p) => (p.id === msg.data.id ? msg.data : p)));
          } else if (msg.type === 'product:deleted' && msg.data) {
            setProducts((prev) => prev.filter((p) => p.id !== msg.data.id));
          } else if (msg.type === 'category:created' && msg.data) {
            setCategories((prev) => (prev.some((c) => c.id === msg.data.id) ? prev : [...prev, msg.data]));
          } else if (msg.type === 'category:updated' && msg.data) {
            setCategories((prev) => prev.map((c) => (c.id === msg.data.id ? msg.data : c)));
          } else if (msg.type === 'category:deleted' && msg.data) {
            setCategories((prev) => prev.filter((c) => c.id !== msg.data.id));
          } else if (msg.type === 'notification:new' && msg.data) {
            setNotifications((prev) =>
              prev.some((n) => n.id === msg.data.id) ? prev : [msg.data, ...prev]
            );
            showToast(msg.data.title, 'info');
          }

          wsListenersRef.current.forEach((fn) => fn({ type: msg.type, data: msg.data }));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (closed) return;
        attempt += 1;
        const delay = Math.min(10000, 1000 * Math.pow(1.5, attempt));
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [sendWsAuth, showToast]);

  useEffect(() => {
    sendWsAuth();
  }, [user, admin, sendWsAuth]);

  const subscribeWs = useCallback((listener: (ev: WsEvent) => void) => {
    wsListenersRef.current.add(listener);
    return () => {
      wsListenersRef.current.delete(listener);
    };
  }, []);

  const setCustomerSession = useCallback((token: string, customer: CustomerUser) => {
    setCustomerToken(token);
    setUser(customer);
  }, []);

  const setAdminSession = useCallback((token: string, adminUser: AdminUser) => {
    setAdminToken(token);
    setAdmin(adminUser);
  }, []);

  const logoutCustomer = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCustomerToken(null);
    setUser(null);
    setCart(null);
    setFavoriteIds(new Set());
    showToast('Signed out successfully', 'info');
    navigate('/');
  }, [navigate, showToast]);

  const logoutAdmin = useCallback(async () => {
    try {
      await apiRequest('/api/admin/logout', { method: 'POST', authMode: 'admin' });
    } catch {
      // ignore
    }
    setAdminToken(null);
    setAdmin(null);
    showToast('Administrator signed out', 'info');
    navigate('/admin/login');
  }, [navigate, showToast]);

  const addToCart = useCallback(
    async (productId: number, quantity = 1) => {
      if (!getCustomerToken()) {
        showToast('Please sign in to add items to your cart', 'info');
        navigate('/signin');
        return;
      }
      try {
        const updated = await apiRequest<CartSummary>('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity }),
        });
        setCart(updated);
        showToast('Added to shopping cart', 'success');
      } catch (err: any) {
        showToast(err.message || 'Could not add to cart', 'error');
      }
    },
    [navigate, showToast]
  );

  const updateCartQuantity = useCallback(
    async (productId: number, quantity: number) => {
      try {
        const updated = await apiRequest<CartSummary>(`/api/cart/items/${productId}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        });
        setCart(updated);
      } catch (err: any) {
        showToast(err.message || 'Could not update quantity', 'error');
      }
    },
    [showToast]
  );

  const removeFromCart = useCallback(
    async (productId: number) => {
      try {
        const updated = await apiRequest<CartSummary>(`/api/cart/items/${productId}`, {
          method: 'DELETE',
        });
        setCart(updated);
      } catch (err: any) {
        showToast(err.message || 'Could not remove item', 'error');
      }
    },
    [showToast]
  );

  const toggleFavorite = useCallback(
    async (productId: number) => {
      if (!getCustomerToken()) {
        showToast('Please sign in to save favorites', 'info');
        navigate('/signin');
        return;
      }
      const isFav = favoriteIds.has(productId);
      try {
        if (isFav) {
          await apiRequest(`/api/favorites/${productId}`, { method: 'DELETE' });
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(productId);
            return next;
          });
        } else {
          await apiRequest(`/api/favorites/${productId}`, { method: 'POST' });
          setFavoriteIds((prev) => new Set(prev).add(productId));
        }
      } catch (err: any) {
        showToast(err.message || 'Could not update favorites', 'error');
      }
    },
    [favoriteIds, navigate, showToast]
  );

  const markNotificationRead = useCallback(async (id: number) => {
    try {
      await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch {
      // ignore
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    try {
      if (getAdminToken() && currentPath.startsWith('/admin')) {
        await apiRequest('/api/admin/notifications/read-all', { method: 'POST', authMode: 'admin' });
      } else {
        await apiRequest('/api/notifications/read-all', { method: 'POST' });
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch {
      // ignore
    }
  }, [currentPath]);

  const unreadNotifications = notifications.filter((n) => !n.is_read).length;

  return (
    <StoreContext.Provider
      value={{
        currentPath,
        navigate,
        theme,
        toggleTheme,
        user,
        admin,
        categories,
        products,
        loadingCatalog,
        cart,
        favoriteIds,
        notifications,
        unreadNotifications,
        presence,
        searchQuery,
        setSearchQuery,
        toasts,
        showToast,
        setCustomerSession,
        setAdminSession,
        logoutCustomer,
        logoutAdmin,
        refreshUser,
        refreshCatalog,
        refreshCart,
        refreshFavorites,
        refreshNotifications,
        addToCart,
        updateCartQuantity,
        removeFromCart,
        toggleFavorite,
        markNotificationRead,
        markAllNotificationsRead,
        subscribeWs,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
