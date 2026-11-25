import { db } from './db.ts';
import { sendToAdmins, sendToUser } from './realtime.ts';

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function formatProductRow(row: any) {
  const images = db
    .prepare('SELECT id, image_url, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC')
    .all(row.id) as { id: number; image_url: string; sort_order: number }[];

  let sellerInfo = null;
  if (row.seller_id) {
    sellerInfo = db
      .prepare(
        `SELECT s.id, s.store_name, s.description, s.region, s.district, s.authorized_by_admin, s.status, u.profile_id
         FROM sellers s JOIN users u ON u.id = s.user_id WHERE s.id = ?`
      )
      .get(row.seller_id);
  }

  const effectivePrice =
    row.discounted_price !== null && row.discounted_price !== undefined && row.discounted_price < row.original_price
      ? Number(row.discounted_price)
      : Number(row.original_price);

  const discountPercent =
    row.original_price > 0 && effectivePrice < row.original_price
      ? Math.round(((row.original_price - effectivePrice) / row.original_price) * 100)
      : 0;

  return {
    id: row.id,
    seller_id: row.seller_id,
    seller: sellerInfo || null,
    category_id: row.category_id,
    category_name: row.category_name || null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    original_price: Number(row.original_price),
    discounted_price:
      row.discounted_price !== null && row.discounted_price !== undefined ? Number(row.discounted_price) : null,
    effective_price: effectivePrice,
    discount_percent: discountPercent,
    weight: row.weight || '',
    quantity: Number(row.quantity),
    stock_value: Number((effectivePrice * Number(row.quantity)).toFixed(2)),
    is_available: Boolean(row.is_available) && Number(row.quantity) > 0,
    is_featured: Boolean(row.is_featured),
    specs: safeJsonParse<{ label: string; value: string }[]>(row.specs_json, []),
    tags: safeJsonParse<string[]>(row.tags_json, []),
    images: images.map((i) => i.image_url),
    sales_count: Number(row.sales_count || 0),
    views_count: Number(row.views_count || 0),
    avg_rating: row.avg_rating ? Number(Number(row.avg_rating).toFixed(1)) : 0,
    review_count: Number(row.review_count || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function calculateDeliveryFee(subtotalAfterDiscounts: number): number {
  if (subtotalAfterDiscounts <= 0) return 0;
  return subtotalAfterDiscounts >= 100 ? 0 : 5;
}

export function getCartDetails(userId: number) {
  let cart = db.prepare('SELECT id FROM carts WHERE user_id = ?').get(userId) as { id: number } | undefined;
  if (!cart) {
    const info = db.prepare('INSERT INTO carts (user_id) VALUES (?)').run(userId);
    cart = { id: Number(info.lastInsertRowid) };
  }

  const rows = db
    .prepare(
      `SELECT ci.id AS cart_item_id, ci.quantity AS cart_qty, p.*, c.name AS category_name
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ci.cart_id = ?
       ORDER BY ci.id DESC`
    )
    .all(cart.id) as any[];

  let subtotalOriginal = 0;
  let subtotalEffective = 0;
  let itemCount = 0;

  const items = rows.map((r) => {
    const prod = formatProductRow(r);
    const qty = Number(r.cart_qty);
    const lineOriginal = Number((prod.original_price * qty).toFixed(2));
    const lineTotal = Number((prod.effective_price * qty).toFixed(2));
    subtotalOriginal += lineOriginal;
    subtotalEffective += lineTotal;
    itemCount += qty;
    return {
      cart_item_id: r.cart_item_id,
      product_id: prod.id,
      quantity: qty,
      product: prod,
      line_original: lineOriginal,
      line_total: lineTotal,
    };
  });

  const itemDiscountTotal = Number(Math.max(0, subtotalOriginal - subtotalEffective).toFixed(2));
  const deliveryFee = calculateDeliveryFee(subtotalEffective);

  return {
    cart_id: cart.id,
    items,
    item_count: itemCount,
    subtotal_original: Number(subtotalOriginal.toFixed(2)),
    subtotal: Number(subtotalEffective.toFixed(2)),
    item_discount_total: itemDiscountTotal,
    delivery_fee: deliveryFee,
    estimated_total: Number((subtotalEffective + deliveryFee).toFixed(2)),
  };
}

export function validatePromoForItems(
  codeRaw: string,
  userId: number,
  items: { product_id: number; category_id: number | null; line_total: number }[],
  subtotal: number
): { valid: boolean; error?: string; promo?: any; discountAmount: number } {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { valid: false, error: 'Promo code is required', discountAmount: 0 };

  const promo = db.prepare('SELECT * FROM promo_codes WHERE UPPER(code) = ?').get(code) as any;
  if (!promo) return { valid: false, error: 'Promo code not found', discountAmount: 0 };
  if (!promo.is_active) return { valid: false, error: 'This promo code is currently inactive', discountAmount: 0 };
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) {
    return { valid: false, error: 'This promo code has expired', discountAmount: 0 };
  }
  if (promo.usage_limit !== null && promo.used_count >= promo.usage_limit) {
    return { valid: false, error: 'This promo code has reached its total usage limit', discountAmount: 0 };
  }

  const userUsages = db
    .prepare('SELECT COUNT(*) AS cnt FROM promo_code_usages WHERE promo_code_id = ? AND user_id = ?')
    .get(promo.id, userId) as { cnt: number };

  if (promo.per_customer_limit !== null && userUsages.cnt >= promo.per_customer_limit) {
    return { valid: false, error: 'You have already used this promo code the maximum number of times', discountAmount: 0 };
  }

  if (subtotal < Number(promo.min_order_amount || 0)) {
    return {
      valid: false,
      error: `Minimum order amount of $${Number(promo.min_order_amount).toFixed(2)} is required`,
      discountAmount: 0,
    };
  }

  const appCatIds = safeJsonParse<number[]>(promo.applicable_category_ids_json, []);
  const appProdIds = safeJsonParse<number[]>(promo.applicable_product_ids_json, []);

  let eligibleAmount = subtotal;
  if (appCatIds.length > 0 || appProdIds.length > 0) {
    eligibleAmount = items
      .filter((it) => {
        const matchProd = appProdIds.includes(it.product_id);
        const matchCat = it.category_id !== null && appCatIds.includes(it.category_id);
        return matchProd || matchCat;
      })
      .reduce((acc, it) => acc + it.line_total, 0);

    if (eligibleAmount <= 0) {
      return { valid: false, error: 'Promo code does not apply to items in your cart', discountAmount: 0 };
    }
  }

  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = (eligibleAmount * Number(promo.discount_value)) / 100;
  } else {
    discountAmount = Math.min(eligibleAmount, Number(promo.discount_value));
  }

  if (promo.max_discount !== null && promo.max_discount !== undefined && Number(promo.max_discount) > 0) {
    discountAmount = Math.min(discountAmount, Number(promo.max_discount));
  }

  discountAmount = Number(Math.min(subtotal, Math.max(0, discountAmount)).toFixed(2));
  return { valid: true, promo, discountAmount };
}

export function createNotification(params: {
  recipientRole: 'customer' | 'admin';
  recipientId: number;
  type: string;
  title: string;
  body: string;
  linkPage?: string;
  referenceId?: string;
}) {
  const info = db
    .prepare(
      `INSERT INTO notifications (recipient_role, recipient_id, type, title, body, link_page, reference_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.recipientRole,
      params.recipientId,
      params.type,
      params.title,
      params.body,
      params.linkPage || null,
      params.referenceId || null
    );

  const created = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  if (params.recipientRole === 'admin') {
    sendToAdmins('notification:new', created);
  } else {
    sendToUser(params.recipientId, 'notification:new', created);
  }
  return created;
}
