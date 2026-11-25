import { CheckCircle2, Clock, Package, Search, Truck, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { SafeImage } from '../components/SafeImage.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest } from '../lib/api.ts';
import type { Order } from '../types.ts';

const STATUS_STEPS = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

function StatusBadgeText({ status }: { status: string }) {
  const color =
    status === 'Delivered'
      ? 'text-[#1F7A4D] dark:text-[#6EE7B7]'
      : status === 'Cancelled' || status === 'Refunded'
      ? 'text-red-600 dark:text-red-400'
      : 'text-amber-700 dark:text-amber-400';
  return <span className={`text-xs font-semibold ${color}`}>{status}</span>;
}

export function MyOrdersPage() {
  const { user, navigate, subscribeWs } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async (q = '') => {
    setLoading(true);
    try {
      const res = await apiRequest<{ orders: Order[] }>(
        `/api/orders${q ? `?q=${encodeURIComponent(q)}` : ''}`
      );
      setOrders(res.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchOrders(searchId);
    else setLoading(false);
  }, [user, fetchOrders, searchId]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if ((ev.type === 'order:created' || ev.type === 'order:updated') && ev.data) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === ev.data.id);
          return exists ? prev.map((o) => (o.id === ev.data.id ? ev.data : o)) : [ev.data, ...prev];
        });
      }
    });
  }, [subscribeWs]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">My Orders</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Sign in to view your order history, or track a specific order by its ID.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders/track')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            Track by Order ID
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-[#1E3126]">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">My Orders</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live order updates and delivery tracking.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="Search Order ID (AB12345678)"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-[#121F18] animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <Package className="w-10 h-10 text-[#1F7A4D] mx-auto mb-3 opacity-70" />
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">No orders found</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Orders you place appear here with real-time status notifications.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-[#1E3126]">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {ord.order_number}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <StatusBadgeText status={ord.status} />
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {new Date(ord.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                    ${Number(ord.total_amount).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate(`/orders/track/${ord.order_number}`)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold hover:bg-[#D6ECDD] cursor-pointer"
                  >
                    Track Order
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
                <span>
                  {ord.region}, {ord.district} — {ord.delivery_address}
                </span>
                <span>·</span>
                <span className="tabular-nums">{ord.items?.length || 0} line item(s)</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function OrderTrackingPage({ initialOrderNumber }: { initialOrderNumber?: string }) {
  const { subscribeWs } = useStore();
  const [queryId, setQueryId] = useState(initialOrderNumber || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [authorizedFull, setAuthorizedFull] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookupOrder = useCallback(async (num: string) => {
    const clean = num.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ order: Order; authorizedFullView: boolean }>(
        `/api/orders/track/${encodeURIComponent(clean)}`
      );
      setOrder(res.order);
      setAuthorizedFull(res.authorizedFullView);
    } catch (err: any) {
      setOrder(null);
      setError(err.message || 'Order ID not found');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialOrderNumber) {
      setQueryId(initialOrderNumber);
      lookupOrder(initialOrderNumber);
    }
  }, [initialOrderNumber, lookupOrder]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type === 'order:updated' && ev.data && order && ev.data.order_number === order.order_number) {
        setOrder(ev.data);
      }
    });
  }, [subscribeWs, order]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    lookupOrder(queryId);
  };

  const isTerminal = order?.status === 'Cancelled' || order?.status === 'Refunded';
  const stepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Order Tracking</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Enter your 10-character Order ID (format: AB12345678) to inspect real-time fulfillment status.
      </p>

      <form onSubmit={handleSearch} className="mt-5 flex gap-2 max-w-md">
        <input
          type="text"
          value={queryId}
          onChange={(e) => setQueryId(e.target.value.toUpperCase())}
          placeholder="e.g. AB12345678"
          className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold cursor-pointer"
        >
          {loading ? 'Searching...' : 'Track'}
        </button>
      </form>

      {error ? (
        <div className="mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {order ? (
        <div className="mt-8 rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-[#1E3126]">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Order ID</p>
              <p className="text-2xl font-mono font-bold text-[#14532D] dark:text-[#6EE7B7]">
                {order.order_number}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">Current Status</p>
              <p className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                {order.status}
              </p>
            </div>
          </div>

          {isTerminal ? (
            <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 flex items-center gap-3 text-sm text-red-700 dark:text-red-300">
              <XCircle className="w-5 h-5 shrink-0" />
              <span>This order is marked as {order.status}.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STATUS_STEPS.map((st, idx) => {
                const done = idx <= stepIndex;
                return (
                  <div
                    key={st}
                    className={`p-3 rounded-xl border text-center ${
                      done
                        ? 'bg-[#EBF5EE] dark:bg-[#193022] border-[#2E8B57] text-[#14532D] dark:text-[#6EE7B7]'
                        : 'bg-[#F8FAF9] dark:bg-[#0B120E] border-slate-200 dark:border-[#21362A] text-slate-400'
                    }`}
                  >
                    <div className="flex justify-center mb-1">
                      {done ? <CheckCircle2 className="w-4 h-4" /> : idx === 3 ? <Truck className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <p className="text-xs font-semibold">{st}</p>
                  </div>
                );
              })}
            </div>
          )}

          {authorizedFull ? (
            <div className="p-4 rounded-2xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#21362A] text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Delivery Destination</p>
              <p>
                {order.customer_name} · {order.customer_phone}
              </p>
              <p>
                {order.region}, {order.district} — {order.delivery_address}
              </p>
              {order.delivery_instructions ? <p>Note: {order.delivery_instructions}</p> : null}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Destination region: {order.region}, {order.district} (Sign in as the order owner to view private recipient details).
            </p>
          )}

          <div>
            <h2 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 mb-3">
              Items ({order.items?.length || 0})
            </h2>
            <div className="divide-y divide-slate-100 dark:divide-[#1E3126]">
              {(order.items || []).map((it, idx) => (
                <div key={idx} className="py-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F3F7F4] dark:bg-[#0D1611] shrink-0">
                    <SafeImage src={it.product_image} alt={it.product_name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {it.product_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      Qty {it.quantity} × ${Number(it.unit_price).toFixed(2)}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    ${Number(it.line_total).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 mb-3">
              Status Timeline
            </h2>
            <div className="space-y-2.5">
              {(order.history || []).map((h, i) => (
                <div key={i} className="flex items-start justify-between gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{h.status}</span>
                    {h.note ? (
                      <span className="text-slate-500 dark:text-slate-400"> — {h.note}</span>
                    ) : null}
                  </div>
                  <span className="font-mono text-slate-400 shrink-0 tabular-nums">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
