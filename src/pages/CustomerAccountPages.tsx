import {
  Bell,
  Camera,
  CheckCheck,
  ImagePlus,
  LogOut,
  MapPin,
  MessageCircle,
  Send,
  Shield,
  Store,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProductCard } from '../components/ProductCard.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest, uploadImageFile } from '../lib/api.ts';
import { REGIONS_DATA, TELEGRAM_ADMIN_URL } from '../lib/regions.ts';
import type { ChatMessage, Product } from '../types.ts';

export function ProfilePage() {
  const { user, navigate, logoutCustomer, refreshUser, showToast } = useStore();
  const regionNames = Object.keys(REGIONS_DATA);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [region, setRegion] = useState(user?.region || regionNames[0]);
  const [district, setDistrict] = useState(user?.district || '');
  const [locationAddress, setLocationAddress] = useState(user?.location_address || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [latitude, setLatitude] = useState<number | null>(user?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(user?.longitude ?? null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [addresses, setAddresses] = useState<any[]>([]);
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrFull, setNewAddrFull] = useState('');

  const [sessions, setSessions] = useState<any[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeDesc, setStoreDesc] = useState('');

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name);
    setRegion(user.region);
    setDistrict(user.district);
    setLocationAddress(user.location_address || '');
    setAvatarUrl(user.avatar_url || '');
    setLatitude(user.latitude);
    setLongitude(user.longitude);

    apiRequest<{ addresses: any[] }>('/api/addresses').then((r) => setAddresses(r.addresses || [])).catch(() => {});
    apiRequest<{ sessions: any[] }>('/api/auth/sessions').then((r) => setSessions(r.sessions || [])).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to view your profile</p>
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, region, district, avatarUrl, latitude, longitude, locationAddress }),
      });
      await refreshUser();
      showToast('Profile updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file, 'customer');
      setAvatarUrl(url);
      showToast('Photo uploaded — click Save Profile to apply', 'info');
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    }
  };

  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        showToast('Coordinates captured — save profile to persist', 'success');
      },
      (err) => showToast(`Location permission denied: ${err.message}`, 'error')
    );
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      showToast('Password updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Password change failed', 'error');
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{ address: any }>('/api/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: newAddrLabel,
          region,
          district,
          fullAddress: newAddrFull,
          latitude,
          longitude,
          isDefault: addresses.length === 0,
        }),
      });
      setAddresses((prev) => [res.address, ...prev]);
      setNewAddrLabel('');
      setNewAddrFull('');
      showToast('Delivery address saved', 'success');
    } catch (err: any) {
      showToast(err.message || 'Could not save address', 'error');
    }
  };

  const handleRevokeSession = async (id: string) => {
    await apiRequest(`/api/auth/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
    showToast('Session revoked', 'info');
  };

  const handleApplySeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/apply', {
        method: 'POST',
        body: JSON.stringify({ storeName, description: storeDesc }),
      });
      await refreshUser();
      showToast('Seller application sent to administrator', 'success');
    } catch (err: any) {
      showToast(err.message || 'Application failed', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header Summary */}
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#EBF5EE] dark:bg-[#193022] shrink-0">
            <SafeImage src={avatarUrl} alt={user.full_name} fallbackLabel={user.full_name} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
              {user.full_name}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Profile ID: <span className="font-mono font-semibold text-[#14532D] dark:text-[#6EE7B7]">#{user.profile_id}</span>
              {' · '}
              <span>{user.phone}</span>
              {' · '}
              <span>{user.phone_verified ? 'Phone Verified' : 'Verification Pending'}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logoutCustomer}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-red-400 hover:text-red-600 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Edit Profile */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">Edit Profile</h2>

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-medium cursor-pointer">
              <Camera className="w-4 h-4" />
              <span>Change Avatar</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} className="hidden" />
            </label>
            <button
              type="button"
              onClick={handleUpdateLocation}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#243B2E] text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <MapPin className="w-3.5 h-3.5 text-[#1F7A4D]" />
              <span>Update GPS Location</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => {
                  setRegion(e.target.value);
                  setDistrict((REGIONS_DATA[e.target.value] || [])[0] || '');
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {regionNames.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">District</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {(REGIONS_DATA[region] || [district]).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Default Delivery Address
            </label>
            <input
              type="text"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="Street, building, apartment..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          {latitude && longitude ? (
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
              GPS: {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </p>
          ) : null}

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold cursor-pointer"
          >
            Save Profile
          </button>
        </form>

        {/* Security & Password */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-3"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1F7A4D]" />
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                Security &amp; Password
              </h2>
            </div>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="w-full px-3.5 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold cursor-pointer"
            >
              Change Password
            </button>
          </form>

          {/* Seller Account Application */}
          <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#1F7A4D]" />
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">Seller Portal</h2>
            </div>
            {user.seller ? (
              <div className="text-xs space-y-2 text-slate-600 dark:text-slate-300">
                <p>
                  Store: <span className="font-semibold text-slate-900 dark:text-slate-100">{user.seller.store_name}</span>
                </p>
                <p>
                  Status:{' '}
                  <span className="font-semibold text-[#1F7A4D] dark:text-[#6EE7B7]">
                    {user.seller.authorized_by_admin ? 'Authorized by Admin' : `Pending Admin Approval (${user.seller.status})`}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/seller-chat')}
                  className="px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] font-semibold cursor-pointer"
                >
                  Open Seller Hub
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplySeller} className="space-y-2.5">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Request administrator authorization to sell products on X-MARKET.
                </p>
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Proposed Store Name"
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={storeDesc}
                  onChange={(e) => setStoreDesc(e.target.value)}
                  placeholder="What do you sell?"
                  className="w-full px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold cursor-pointer"
                >
                  Apply as Seller
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Saved Delivery Addresses & Active Sessions */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Saved Delivery Addresses
          </h2>
          <form onSubmit={handleAddAddress} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newAddrLabel}
              onChange={(e) => setNewAddrLabel(e.target.value)}
              placeholder="Label (Home, Office)"
              className="sm:w-36 px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              required
              value={newAddrFull}
              onChange={(e) => setNewAddrFull(e.target.value)}
              placeholder="Full address..."
              className="flex-1 px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-xs text-slate-900 dark:text-slate-100"
            />
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold cursor-pointer">
              Add
            </button>
          </form>
          <div className="divide-y divide-slate-100 dark:divide-[#1E3126]">
            {addresses.map((a) => (
              <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{a.label}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {' · '}
                    {a.region}, {a.district} — {a.full_address}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiRequest(`/api/addresses/${a.id}`, { method: 'DELETE' });
                    setAddresses((prev) => prev.filter((x) => x.id !== a.id));
                  }}
                  className="text-slate-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Active Sessions
          </h2>
          <div className="divide-y divide-slate-100 dark:divide-[#1E3126]">
            {sessions.map((s) => (
              <div key={s.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                    {s.isCurrent ? 'Current Session' : 'Active Session'} · {s.ip_address}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 truncate">{s.user_agent || 'Browser'}</p>
                </div>
                {!s.isCurrent ? (
                  <button
                    type="button"
                    onClick={() => handleRevokeSession(s.id)}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#243B2E] text-red-600 cursor-pointer"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="text-[#1F7A4D] dark:text-[#6EE7B7] font-semibold">Active</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FavoritesPage() {
  const { user, products, favoriteIds, navigate } = useStore();
  const favProducts = products.filter((p) => favoriteIds.has(p.id));

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to view saved favorites</p>
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Saved Favorites</h1>
      {favProducts.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">You have not saved any favorite products yet.</p>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {favProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export function NotificationsPage() {
  const { user, notifications, markNotificationRead, markAllNotificationsRead, navigate } = useStore();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to view notifications</p>
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-[#1E3126]">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time alerts for orders, messages, and store updates.
          </p>
        </div>
        {notifications.length > 0 ? (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Read</span>
          </button>
        ) : null}
      </div>

      {notifications.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <Bell className="w-9 h-9 text-[#1F7A4D] mx-auto mb-2 opacity-60" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (!n.is_read) markNotificationRead(n.id);
                if (n.link_page) navigate(n.link_page);
              }}
              className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                n.is_read
                  ? 'bg-white dark:bg-[#121F18] border-slate-200 dark:border-[#21362A]'
                  : 'bg-[#EBF5EE]/70 dark:bg-[#162C20] border-[#2E8B57]/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{n.title}</p>
                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CustomerSupportChatPage() {
  const { user, navigate, presence, subscribeWs, showToast } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [convId, setConvId] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadChat = useCallback(async () => {
    try {
      const res = await apiRequest<{ conversation: any; messages: ChatMessage[] }>('/api/chat/support');
      setConvId(res.conversation.id);
      setMessages(res.messages || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) loadChat();
  }, [user, loadChat]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type === 'chat:message' && ev.data?.conversationId === convId && ev.data?.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === ev.data.message.id) ? prev : [...prev, ev.data.message]
        );
      }
    });
  }, [subscribeWs, convId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Administrator Support
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Sign in to chat directly with X-MARKET administrators inside the app, or reach us via Telegram.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/signin')}
            className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Sign In
          </button>
          <a
            href={TELEGRAM_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EBF5EE] text-[#14532D] text-sm font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Telegram Admin</span>
          </a>
        </div>
      </div>
    );
  }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImageFile(file, 'customer');
      setImageUrl(url);
    } catch (err: any) {
      showToast(err.message || 'Image upload failed', 'error');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imageUrl) return;
    try {
      const res = await apiRequest<{ message: ChatMessage }>('/api/chat/support', {
        method: 'POST',
        body: JSON.stringify({ content: text, imageUrl }),
      });
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setText('');
      setImageUrl(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to send message', 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden flex flex-col h-[620px]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1E3126] flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
              Direct Administrator Chat
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Admin status: {presence.adminOnline ? 'Online now' : 'Offline — replies appear in real time'}
            </p>
          </div>
          <a
            href={TELEGRAM_ADMIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Contact on Telegram</span>
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F8FAF9] dark:bg-[#0B120E]">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-10">
              Start a conversation with X-MARKET Administrator.
            </p>
          ) : (
            messages.map((m) => {
              const isMe = m.sender_role === 'customer';
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm space-y-2 ${
                      isMe
                        ? 'bg-[#14532D] text-white'
                        : 'bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {m.image_url ? (
                      <img
                        src={m.image_url}
                        alt="Attachment"
                        className="rounded-xl max-h-52 object-cover"
                      />
                    ) : null}
                    {m.content ? <p className="whitespace-pre-wrap">{m.content}</p> : null}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 mt-1 px-1">
                    {new Date(m.created_at).toLocaleTimeString()}
                    {isMe ? (m.is_read ? ' · Read' : ' · Sent') : ''}
                  </span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-[#1E3126] space-y-2">
          {imageUrl ? (
            <div className="flex items-center gap-2 text-xs text-[#1F7A4D]">
              <img src={imageUrl} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
              <span>Image attached</span>
              <button type="button" onClick={() => setImageUrl(null)} className="text-red-500 cursor-pointer">
                Remove
              </button>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <label className="p-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-slate-600 dark:text-slate-300 cursor-pointer hover:border-[#2E8B57]">
              <ImagePlus className="w-4 h-4" />
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImagePick} className="hidden" />
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message to administrator..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SellerChatPage() {
  const { user, categories, navigate, subscribeWs, showToast } = useStore();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');

  // Authorized seller product creation
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodQty, setProdQty] = useState('1');
  const [prodCat, setProdCat] = useState('');
  const [prodDesc, setProdDesc] = useState('');

  const loadConversations = useCallback(async () => {
    try {
      const res = await apiRequest<{ conversations: any[] }>('/api/chat/sellers');
      setConversations(res.conversations || []);
      if (!activeConvId && res.conversations?.length > 0) {
        setActiveConvId(res.conversations[0].id);
      }
    } catch {
      // ignore
    }
  }, [activeConvId]);

  const loadMessages = useCallback(async (id: number) => {
    try {
      const res = await apiRequest<{ messages: ChatMessage[] }>(`/api/chat/sellers/${id}`);
      setMessages(res.messages || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId);
  }, [activeConvId, loadMessages]);

  useEffect(() => {
    return subscribeWs((ev) => {
      if (ev.type === 'chat:message' && ev.data?.conversationId === activeConvId && ev.data?.message) {
        setMessages((prev) =>
          prev.some((m) => m.id === ev.data.message.id) ? prev : [...prev, ev.data.message]
        );
      }
    });
  }, [subscribeWs, activeConvId]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Sign in to access Seller Hub</p>
        <button
          type="button"
          onClick={() => navigate('/signin')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConvId || !text.trim()) return;
    try {
      const res = await apiRequest<{ message: ChatMessage }>(`/api/chat/sellers/${activeConvId}`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setMessages((prev) =>
        prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]
      );
      setText('');
    } catch (err: any) {
      showToast(err.message || 'Send failed', 'error');
    }
  };

  const handleCreateSellerProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/seller/products', {
        method: 'POST',
        body: JSON.stringify({
          name: prodName,
          originalPrice: Number(prodPrice),
          quantity: Number(prodQty),
          categoryId: prodCat ? Number(prodCat) : null,
          description: prodDesc,
        }),
      });
      setProdName('');
      setProdPrice('');
      setProdDesc('');
      showToast('Seller product published in real time!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to publish product', 'error');
    }
  };

  const isApprovedSeller = Boolean(user.seller?.authorized_by_admin && user.seller?.status === 'approved');

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
          Buyer &amp; Seller Messages
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Direct product and order conversations between buyers and authorized sellers.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6 rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden min-h-[460px]">
        <div className="lg:col-span-4 border-r border-slate-200 dark:border-[#1E3126] p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2">Conversations</p>
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-4">
              No seller conversations yet. Open any seller product and click "Message Seller".
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveConvId(c.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                  activeConvId === c.id
                    ? 'bg-[#EBF5EE] dark:bg-[#193022] border-[#2E8B57]'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#16271D]'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {c.store_name} · {c.customer_name}
                </p>
                {c.product_name ? (
                  <p className="text-[11px] text-[#1F7A4D] dark:text-[#6EE7B7] truncate">{c.product_name}</p>
                ) : null}
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                  {c.last_message || 'No messages yet'}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-8 flex flex-col h-[460px]">
          <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F8FAF9] dark:bg-[#0B120E]">
            {messages.map((m) => {
              const isMe = m.sender_id === user.id;
              return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm ${
                      isMe
                        ? 'bg-[#14532D] text-white'
                        : 'bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-[#1E3126] flex gap-2">
            <input
              type="text"
              disabled={!activeConvId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a message..."
              className="flex-1 px-4 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={!activeConvId}
              className="px-4 py-2 rounded-xl bg-[#14532D] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {isApprovedSeller ? (
        <form
          onSubmit={handleCreateSellerProduct}
          className="rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4"
        >
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Authorized Seller — Publish Product ({user.seller?.store_name})
          </h2>
          <div className="grid sm:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Product name"
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={prodPrice}
              onChange={(e) => setProdPrice(e.target.value)}
              placeholder="Price ($)"
              className="px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
            <input
              type="number"
              required
              min="1"
              value={prodQty}
              onChange={(e) => setProdQty(e.target.value)}
              placeholder="Quantity"
              className="px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select
              value={prodCat}
              onChange={(e) => setProdCat(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={prodDesc}
              onChange={(e) => setProdDesc(e.target.value)}
              placeholder="Short description..."
              className="sm:col-span-2 px-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Publish Seller Product
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function AiAssistantPage() {
  const { navigate } = useStore();
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; content: string; recommendedProducts?: Product[] }[]
  >([
    {
      role: 'assistant',
      content:
        'Welcome to X-MARKET AI. Tell me what you are looking for, your budget, or ask about active discounts, promo codes, delivery rules, or your order statuses.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    const next = [...messages, { role: 'user' as const, content: q }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await apiRequest<{ reply: string; recommendedProducts: Product[] }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          message: q,
          history: next.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.reply, recommendedProducts: res.recommendedProducts },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err.message || 'Unable to reach X-MARKET AI.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] overflow-hidden flex flex-col h-[640px]">
        <div className="px-6 py-4 bg-[#14532D] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/xmarket_ai_emblem_1795608273523.jpg"
              alt="X-MARKET AI"
              className="w-10 h-10 rounded-xl object-cover"
            />
            <div>
              <h1 className="text-lg font-display font-bold">X-MARKET AI</h1>
              <p className="text-xs text-emerald-200">
                Grounded in live marketplace inventory, pricing, promo codes, and your orders
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/support')}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium cursor-pointer"
          >
            Human Admin Support
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F8FAF9] dark:bg-[#0B120E]">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#14532D] text-white'
                    : 'bg-white dark:bg-[#15241C] border border-slate-200 dark:border-[#243B2E] text-slate-900 dark:text-slate-100'
                }`}
              >
                {m.content}
              </div>

              {m.recommendedProducts && m.recommendedProducts.length > 0 ? (
                <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full">
                  {m.recommendedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {loading ? <p className="text-xs text-slate-500 dark:text-slate-400">Analyzing live catalog...</p> : null}
        </div>

        <form onSubmit={handleSend} className="p-4 border-t border-slate-200 dark:border-[#1E3126] flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask X-MARKET AI to recommend products, compare prices, or check discounts..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            Ask AI
          </button>
        </form>
      </div>
    </div>
  );
}
