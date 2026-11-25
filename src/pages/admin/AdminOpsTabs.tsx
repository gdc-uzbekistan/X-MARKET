import { ImagePlus, Search, Send, Shield, UserCheck, UserX } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../context/StoreContext.tsx';
import { apiRequest, getAdminToken, uploadImageFile } from '../../lib/api.ts';
import type { ChatMessage, Order, OrderStatus } from '../../types.ts';

const ALL_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
  'Refunded',
];

export function AdminOrdersView({ onNavigateTab }: { onNavigateTab: (path: string) => void }) {
  const { subscribeWs, showToast } = useStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [editStatus, setEditStatus] = useState<OrderStatus>('Pending');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [statusNote, setStatusNote] = useState('');

  const loadOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    try {
      const res = await apiRequest<{ orders: Order[] }>(`/api/admin/orders?${params.toString()}`, {
        authMode: 'admin',
      });
      setOrders(res.orders || []);
    } catch {
      // ignore
    }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type === 'order:created' || ev.type === 'order:updated') {
        loadOrders();
      }
    });
  }, [subscribeWs, loadOrders]);

  const openOrder = (o: Order) => {
    setSelectedOrder(o);
    setEditStatus(o.status);
    setEditAddress(o.delivery_address);
    setEditNotes(o.internal_notes || '');
    setStatusNote('');
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const res = await apiRequest<{ order: Order }>(`/api/admin/orders/${selectedOrder.id}`, {
        method: 'PATCH',
        authMode: 'admin',
        body: JSON.stringify({
          status: editStatus,
          deliveryAddress: editAddress,
          internalNotes: editNotes,
          statusNote,
        }),
      });
      setSelectedOrder(res.order);
      await loadOrders();
      showToast(`Order ${res.order.order_number} updated`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
            Order Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search by AB-series ID, filter by date or status, update delivery, and add internal notes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Order ID, name, phone..."
              className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs font-mono text-slate-900 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
          >
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1E3126] text-xs text-slate-500">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E3126]">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-500">
                    No matching orders found.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => openOrder(o)}
                    className={`cursor-pointer transition-colors ${
                      selectedOrder?.id === o.id
                        ? 'bg-[#EBF5EE] dark:bg-[#193022]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#16271D]'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#14532D] dark:text-[#6EE7B7]">
                      {o.order_number}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{o.customer_name}</p>
                      <p className="text-slate-500">{o.customer_phone}</p>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {o.status}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      ${Number(o.total_amount).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5">
          {!selectedOrder ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              Select an order to inspect items, edit delivery, change status, or view history.
            </p>
          ) : (
            <form onSubmit={handleSaveOrder} className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1E3126] pb-3">
                <div>
                  <p className="text-lg font-mono font-bold text-[#14532D] dark:text-[#6EE7B7]">
                    {selectedOrder.order_number}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedOrder.customer_name} · {selectedOrder.customer_phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('/admin/messages')}
                  className="px-3 py-1.5 rounded-lg bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer"
                >
                  Contact Customer
                </button>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Order Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Status Update Note (Visible in Timeline)
                </label>
                <input
                  type="text"
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional tracking update message..."
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Delivery Address ({selectedOrder.region}, {selectedOrder.district})
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Internal Admin Notes
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="text-xs space-y-1 pt-2 border-t border-slate-100 dark:border-[#1E3126]">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Items</p>
                {(selectedOrder.items || []).map((it, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>
                      {it.product_name} × {it.quantity}
                    </span>
                    <span className="font-mono tabular-nums">${Number(it.line_total).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-xs font-semibold cursor-pointer"
                >
                  Save Order Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminCustomersView() {
  const { showToast } = useStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [editName, setEditName] = useState('');
  const [editRegion, setEditRegion] = useState('');
  const [editDistrict, setEditDistrict] = useState('');

  const loadCustomers = useCallback(async () => {
    try {
      const res = await apiRequest<{ customers: any[] }>(
        `/api/admin/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
        { authMode: 'admin' }
      );
      setCustomers(res.customers || []);
    } catch {
      // ignore
    }
  }, [q]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const inspectCustomer = async (c: any) => {
    setSelected(c);
    setEditName(c.full_name);
    setEditRegion(c.region);
    setEditDistrict(c.district);
    try {
      const res = await apiRequest<{ orders: Order[] }>(`/api/admin/customers/${c.id}/orders`, {
        authMode: 'admin',
      });
      setCustomerOrders(res.orders || []);
    } catch {
      setCustomerOrders([]);
    }
  };

  const patchCustomer = async (id: number, body: Record<string, unknown>) => {
    try {
      await apiRequest(`/api/admin/customers/${id}`, {
        method: 'PATCH',
        authMode: 'admin',
        body: JSON.stringify(body),
      });
      await loadCustomers();
      showToast('Customer account updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
            Customer &amp; Account Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Search by name, phone, or 6-digit Profile ID; suspend/reactivate accounts; manage seller authorization.
          </p>
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ID, name, phone..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1E3126] text-xs text-slate-500">
                <th className="py-3 px-4">Profile ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Orders</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E3126]">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    No customer accounts registered yet.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => inspectCustomer(c)}
                    className={`cursor-pointer ${
                      selected?.id === c.id
                        ? 'bg-[#EBF5EE] dark:bg-[#193022]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#16271D]'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-[#14532D] dark:text-[#6EE7B7]">
                      #{c.profile_id}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{c.full_name}</p>
                      <p className="text-slate-500">{c.phone}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums">
                      {c.order_count} (${Number(c.total_spent || 0).toFixed(2)})
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className={c.status === 'active' ? 'text-[#1F7A4D] font-semibold' : 'text-red-500 font-semibold'}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() =>
                          patchCustomer(c.id, { status: c.status === 'active' ? 'suspended' : 'active' })
                        }
                        title={c.status === 'active' ? 'Suspend Account' : 'Reactivate Account'}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        {c.status === 'active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4 text-[#1F7A4D]" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-5 space-y-4">
          {!selected ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              Select a customer to edit info, permissions, seller authorization, or view order history.
            </p>
          ) : (
            <>
              <div className="border-b border-slate-100 dark:border-[#1E3126] pb-3">
                <p className="font-mono text-sm font-bold text-[#14532D] dark:text-[#6EE7B7]">
                  #{selected.profile_id}
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-slate-100">{selected.full_name}</p>
                <p className="text-xs text-slate-500">{selected.phone}</p>
              </div>

              <div className="space-y-2.5 text-xs">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={editRegion}
                    onChange={(e) => setEditRegion(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    patchCustomer(selected.id, {
                      fullName: editName,
                      region: editRegion,
                      district: editDistrict,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-[#14532D] text-white font-semibold cursor-pointer"
                >
                  Save Customer Details
                </button>
              </div>

              {selected.seller_id ? (
                <div className="p-3 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-[#14532D] dark:text-[#6EE7B7]">
                      Seller: {selected.store_name}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      {selected.authorized_by_admin ? 'Authorized' : 'Pending approval'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      patchCustomer(selected.id, { authorizeSeller: !selected.authorized_by_admin })
                    }
                    className="px-3 py-1.5 rounded-lg bg-[#14532D] text-white font-semibold cursor-pointer"
                  >
                    {selected.authorized_by_admin ? 'Revoke' : 'Authorize'}
                  </button>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                  Order History ({customerOrders.length})
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                  {customerOrders.map((ord) => (
                    <div key={ord.id} className="flex justify-between py-1 border-b border-slate-100 dark:border-[#1E3126]">
                      <span className="font-mono font-semibold">{ord.order_number}</span>
                      <span>{ord.status}</span>
                      <span className="font-mono tabular-nums">${Number(ord.total_amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminMessagesView() {
  const { presence, subscribeWs, showToast } = useStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadInbox = useCallback(async () => {
    try {
      const res = await apiRequest<{ conversations: any[] }>('/api/admin/messages', { authMode: 'admin' });
      setConversations(res.conversations || []);
    } catch {
      // ignore
    }
  }, []);

  const openConv = async (conv: any) => {
    setActiveConv(conv);
    try {
      const res = await apiRequest<{ conversation: any; messages: ChatMessage[] }>(
        `/api/admin/messages/${conv.id}`,
        { authMode: 'admin' }
      );
      setActiveConv(res.conversation);
      setMessages(res.messages || []);
      loadInbox();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type === 'chat:message') {
        loadInbox();
        if (activeConv && ev.data?.conversationId === activeConv.id && ev.data?.message) {
          setMessages((prev) =>
            prev.some((m) => m.id === ev.data.message.id) ? prev : [...prev, ev.data.message]
          );
        }
      }
    });
  }, [subscribeWs, activeConv, loadInbox]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || (!text.trim() && !imageUrl)) return;
    try {
      const res = await apiRequest<{ message: ChatMessage }>(`/api/admin/messages/${activeConv.id}`, {
        method: 'POST',
        authMode: 'admin',
        body: JSON.stringify({ content: text, imageUrl }),
      });
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setText('');
      setImageUrl(null);
    } catch (err: any) {
      showToast(err.message || 'Reply failed', 'error');
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file, 'admin');
      setImageUrl(url);
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    }
  };

  const filteredConvs = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${c.full_name} ${c.phone} ${c.profile_id}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Customer Messages
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Real-time support conversations with customer profile context and image attachments.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden h-[560px]">
        <div className="lg:col-span-4 border-r border-slate-200 dark:border-[#1E3126] flex flex-col">
          <div className="p-3 border-b border-slate-100 dark:border-[#1E3126]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer..."
              className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1E3126]">
            {filteredConvs.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">No conversations yet.</p>
            ) : (
              filteredConvs.map((c) => {
                const online = presence.onlineUserIds.includes(c.customer_id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openConv(c)}
                    className={`w-full text-left p-3.5 cursor-pointer ${
                      activeConv?.id === c.id
                        ? 'bg-[#EBF5EE] dark:bg-[#193022]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#16271D]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {c.full_name}
                      </span>
                      {c.unread_count > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-[#14532D] text-white text-[10px] font-mono">
                          {c.unread_count}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      #{c.profile_id} · {online ? 'Online' : 'Offline'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-1">
                      {c.last_message || 'Attachment'}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col h-[560px]">
          {activeConv ? (
            <>
              <div className="px-5 py-3 border-b border-slate-200 dark:border-[#1E3126] flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeConv.full_name}{' '}
                    <span className="font-mono text-xs text-slate-400">#{activeConv.profile_id}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {activeConv.phone} · {activeConv.region}, {activeConv.district}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAF9] dark:bg-[#0B120E]">
                {messages.map((m) => {
                  const isAdmin = m.sender_role === 'admin';
                  return (
                    <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm space-y-1.5 ${
                          isAdmin
                            ? 'bg-[#14532D] text-white'
                            : 'bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {m.image_url ? (
                          <img src={m.image_url} alt="Attachment" className="rounded-xl max-h-48 object-cover" />
                        ) : null}
                        {m.content ? <p>{m.content}</p> : null}
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {new Date(m.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleReply} className="p-3 border-t border-slate-200 dark:border-[#1E3126] flex items-center gap-2">
                <label className="p-2 rounded-xl border border-slate-200 dark:border-[#243B2E] text-slate-500 cursor-pointer">
                  <ImagePlus className="w-4 h-4" />
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImagePick} className="hidden" />
                </label>
                {imageUrl ? <span className="text-xs text-[#1F7A4D]">1 image</span> : null}
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Reply to customer..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
                <button type="submit" className="p-2.5 rounded-xl bg-[#14532D] text-white cursor-pointer">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
              Select a customer conversation from the left.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminSettingsView() {
  const { admin, setAdminSession, showToast } = useStore();
  const [fullName, setFullName] = useState(admin?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    apiRequest<{ logs: any[] }>('/api/admin/audit-logs', { authMode: 'admin' })
      .then((r) => setAuditLogs(r.logs || []))
      .catch(() => {});
    apiRequest<{ sessions: any[] }>('/api/admin/sessions', { authMode: 'admin' })
      .then((r) => setSessions(r.sessions || []))
      .catch(() => {});
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ admin: any }>('/api/admin/profile', {
        method: 'PUT',
        authMode: 'admin',
        body: JSON.stringify({ fullName }),
      });
      setAdminSession(getAdminToken() || '', res.admin);
      showToast('Administrator profile updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    try {
      await apiRequest('/api/admin/password', {
        method: 'POST',
        authMode: 'admin',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Administrator password changed securely', 'success');
    } catch (err: any) {
      showToast(err.message || 'Password update failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Administrator Security &amp; Account Settings
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Update the administrator password, inspect active sessions, and review security audit logs.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleChangePassword}
          className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#1F7A4D]" />
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
              Change Administrator Password
            </h3>
          </div>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current administrator password"
            className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Update Password
          </button>
        </form>

        <div className="space-y-6">
          <form
            onSubmit={handleUpdateProfile}
            className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-3"
          >
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100">
              Administrator Profile
            </h3>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer"
            >
              Save Display Name
            </button>
          </form>

          <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6">
            <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 mb-3">
              Active Admin Sessions ({sessions.length})
            </h3>
            <div className="space-y-2 text-xs">
              {sessions.map((s) => (
                <div key={s.id} className="flex justify-between gap-2 text-slate-600 dark:text-slate-300">
                  <span className="truncate">
                    {s.isCurrent ? 'Current · ' : ''}
                    {s.ip_address}
                  </span>
                  <span className="font-mono text-slate-400">Exp {new Date(s.expires_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Security Audit Logs */}
      <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6">
        <h3 className="text-base font-display font-bold text-slate-900 dark:text-slate-100 mb-3">
          Security &amp; Audit Logs
        </h3>
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#1E3126] text-slate-500">
                <th className="py-2 px-3">Timestamp</th>
                <th className="py-2 px-3">Actor</th>
                <th className="py-2 px-3">Action</th>
                <th className="py-2 px-3">Target</th>
                <th className="py-2 px-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1E3126]">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="py-2 px-3 font-mono tabular-nums text-slate-500">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                    {log.actor_role}
                  </td>
                  <td className="py-2 px-3 font-mono text-[#14532D] dark:text-[#6EE7B7]">{log.action}</td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                    {log.target_type} {log.target_id}
                  </td>
                  <td className="py-2 px-3 font-mono text-slate-400">{log.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
