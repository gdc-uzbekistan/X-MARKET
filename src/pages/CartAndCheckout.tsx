import { CheckCircle2, MapPin, ShoppingBag, Tag, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { SafeImage } from '../components/SafeImage.tsx';
import { useStore } from '../context/StoreContext.tsx';
import { apiRequest } from '../lib/api.ts';
import { REGIONS_DATA } from '../lib/regions.ts';
import type { Order } from '../types.ts';

export function CartPage() {
  const { user, cart, navigate, updateCartQuantity, removeFromCart } = useStore();

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-10 h-10 text-[#1F7A4D] mx-auto mb-3" />
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Your Shopping Cart
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Sign in or create an account to save items in your cart and place orders.
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
            onClick={() => navigate('/register')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  const items = cart?.items || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">
        Shopping Cart
      </h1>

      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-12 text-center">
          <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Your cart is empty</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Explore our catalog and add products to begin checkout.
          </p>
          <button
            type="button"
            onClick={() => navigate('/catalog')}
            className="mt-5 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
          >
            Browse Catalog
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-8 mt-8 items-start">
          <div className="lg:col-span-8 space-y-3">
            {items.map((item) => (
              <div
                key={item.cart_item_id}
                className="p-4 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div
                  onClick={() => navigate(`/product/${item.product_id}`)}
                  className="w-24 h-20 rounded-xl overflow-hidden bg-[#F3F7F4] dark:bg-[#0D1611] shrink-0 cursor-pointer"
                >
                  <SafeImage src={item.product.images[0]} alt={item.product.name} />
                </div>

                <div className="flex-1 min-w-0">
                  <h2
                    onClick={() => navigate(`/product/${item.product_id}`)}
                    className="text-base font-display font-semibold text-slate-900 dark:text-slate-100 truncate cursor-pointer hover:text-[#1F7A4D]"
                  >
                    {item.product.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ${item.product.effective_price.toFixed(2)} each
                    {item.product.weight ? ` · ${item.product.weight}` : ''}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-[#243B2E] bg-[#F8FAF9] dark:bg-[#0B120E]">
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                      className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="px-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                      className="px-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="w-24 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    ${item.line_total.toFixed(2)}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product_id)}
                    aria-label="Remove item"
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
              Order Summary
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Original Value</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  ${cart!.subtotal_original.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Product Discounts</dt>
                <dd className="font-mono tabular-nums text-[#1F7A4D] dark:text-[#6EE7B7]">
                  -${cart!.item_discount_total.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  ${cart!.subtotal.toFixed(2)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Delivery Fee (Free over $100)</dt>
                <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                  ${cart!.delivery_fee.toFixed(2)}
                </dd>
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-[#1E3126] flex justify-between text-base font-bold">
                <dt className="text-slate-900 dark:text-slate-100">Estimated Total</dt>
                <dd className="font-mono tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                  ${cart!.estimated_total.toFixed(2)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => navigate('/checkout')}
              className="w-full py-3 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold cursor-pointer"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const { user, cart, navigate, refreshCart, refreshCatalog, showToast } = useStore();
  const regionNames = Object.keys(REGIONS_DATA);

  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone || '');
  const [region, setRegion] = useState(user?.region || regionNames[0]);
  const [district, setDistrict] = useState(user?.district || REGIONS_DATA[regionNames[0]][0]);
  const [deliveryAddress, setDeliveryAddress] = useState(user?.location_address || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [latitude, setLatitude] = useState<number | null>(user?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(user?.longitude ?? null);
  const [geoMessage, setGeoMessage] = useState('');

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount_amount: number;
    delivery_fee: number;
    final_total: number;
  } | null>(null);
  const [promoError, setPromoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Stable idempotency key per checkout session to prevent duplicate order submissions
  const idempotencyKey = useMemo(
    () => `ord-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    []
  );

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Sign in to checkout</p>
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

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">Your cart is empty</p>
        <button
          type="button"
          onClick={() => navigate('/catalog')}
          className="mt-4 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold cursor-pointer"
        >
          Browse Products
        </button>
      </div>
    );
  }

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Geolocation is unavailable in this browser.');
      return;
    }
    setGeoMessage('Waiting for permission...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGeoMessage(
          `Pinned coordinates: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`
        );
      },
      (err) => {
        setGeoMessage(`Location permission declined (${err.message})`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleApplyPromo = async () => {
    setPromoError('');
    if (!promoInput.trim()) return;
    try {
      const res = await apiRequest<{
        valid: boolean;
        code: string;
        discount_amount: number;
        delivery_fee: number;
        final_total: number;
      }>('/api/promos/validate', {
        method: 'POST',
        body: JSON.stringify({ code: promoInput.trim() }),
      });
      setAppliedPromo(res);
      showToast(`Promo ${res.code} applied!`, 'success');
    } catch (err: any) {
      setAppliedPromo(null);
      setPromoError(err.message || 'Invalid promo code');
    }
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ order: Order }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          region,
          district,
          deliveryAddress,
          deliveryInstructions,
          latitude,
          longitude,
          promoCode: appliedPromo?.code || undefined,
          idempotencyKey,
        }),
      });
      await Promise.all([refreshCart(), refreshCatalog()]);
      showToast(`Order ${res.order.order_number} confirmed!`, 'success');
      navigate(`/order-confirmation/${res.order.order_number}`);
    } catch (err: any) {
      setError(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const promoDiscount = appliedPromo ? appliedPromo.discount_amount : 0;
  const deliveryFee = appliedPromo ? appliedPromo.delivery_fee : cart.delivery_fee;
  const finalTotal = appliedPromo ? appliedPromo.final_total : cart.estimated_total;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-slate-100">Checkout</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Verify your delivery details and apply any valid promo codes before placing your order.
      </p>

      {error ? (
        <div className="mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <form onSubmit={handlePlaceOrder} className="grid lg:grid-cols-12 gap-8 mt-6 items-start">
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-4">
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Delivery Information
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Recipient Name
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Region
              </label>
              <select
                value={region}
                onChange={(e) => {
                  const r = e.target.value;
                  setRegion(r);
                  setDistrict((REGIONS_DATA[r] || [])[0] || '');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {regionNames.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                District
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
              >
                {(REGIONS_DATA[region] || [district]).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Full Delivery Address
            </label>
            <input
              type="text"
              required
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Street, building, apartment, landmark..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Delivery Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={deliveryInstructions}
              onChange={(e) => setDeliveryInstructions(e.target.value)}
              placeholder="Gate code, preferred delivery window, call on arrival..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-[#1F7A4D]" />
              <div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Attach Exact GPS Location (With Permission)
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {geoMessage ||
                    (latitude && longitude
                      ? `Coordinates attached: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
                      : 'Optional courier pin')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestLocation}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#243B2E] text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-[#2E8B57] cursor-pointer"
            >
              Use Current Location
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-6 space-y-5">
          <h2 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
            Items &amp; Promo Code
          </h2>

          <div className="divide-y divide-slate-100 dark:divide-[#1E3126] max-h-60 overflow-y-auto">
            {cart.items.map((item) => (
              <div key={item.cart_item_id} className="py-2.5 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100 truncate">{item.product.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Qty {item.quantity} × ${item.product.effective_price.toFixed(2)}
                  </p>
                </div>
                <span className="font-mono font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  ${item.line_total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Promo Code
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E] text-sm font-mono uppercase text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyPromo}
                className="px-4 py-2 rounded-xl bg-[#EBF5EE] dark:bg-[#193022] text-[#14532D] dark:text-[#6EE7B7] text-xs font-semibold hover:bg-[#D6ECDD] cursor-pointer"
              >
                Apply
              </button>
            </div>
            {promoError ? <p className="text-xs text-red-600 dark:text-red-400 mt-1">{promoError}</p> : null}
            {appliedPromo ? (
              <p className="text-xs text-[#1F7A4D] dark:text-[#6EE7B7] mt-1">
                Code {appliedPromo.code} applied (-${appliedPromo.discount_amount.toFixed(2)})
              </p>
            ) : null}
          </div>

          <dl className="space-y-2 text-sm pt-2 border-t border-slate-200 dark:border-[#1E3126]">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Subtotal</dt>
              <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                ${cart.subtotal.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Promo Discount</dt>
              <dd className="font-mono tabular-nums text-[#1F7A4D] dark:text-[#6EE7B7]">
                -${promoDiscount.toFixed(2)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Delivery Fee</dt>
              <dd className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
                ${deliveryFee.toFixed(2)}
              </dd>
            </div>
            <div className="pt-2 border-t border-slate-200 dark:border-[#1E3126] flex justify-between text-base font-bold">
              <dt className="text-slate-900 dark:text-slate-100">Final Total</dt>
              <dd className="font-mono tabular-nums text-[#14532D] dark:text-[#6EE7B7]">
                ${finalTotal.toFixed(2)}
              </dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#14532D] hover:bg-[#0F3D26] text-white text-sm font-semibold disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Placing Order...' : 'Place Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

export function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  const { navigate } = useStore();
  return (
    <div className="max-w-xl mx-auto px-4 py-14">
      <div className="rounded-3xl bg-white dark:bg-[#121F18] border border-slate-200 dark:border-[#21362A] p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#EBF5EE] dark:bg-[#193022] text-[#1F7A4D] dark:text-[#6EE7B7] flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
          Order Confirmed
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Your order has been saved to our database and stock has been reserved.
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-[#F8FAF9] dark:bg-[#0B120E] border border-slate-200 dark:border-[#243B2E]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Unique Order Tracking ID</p>
          <p className="text-2xl font-mono font-bold tracking-wider text-[#14532D] dark:text-[#6EE7B7] mt-1">
            {orderNumber}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/orders/track/${orderNumber}`)}
            className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-semibold hover:bg-[#0F3D26] cursor-pointer"
          >
            Track Order
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#243B2E] text-sm font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            My Orders
          </button>
        </div>
      </div>
    </div>
  );
}
