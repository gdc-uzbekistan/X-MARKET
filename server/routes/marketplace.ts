import { Router } from 'express';
import { runMarketplaceAi } from '../ai.ts';
import { createSlug, db, generateUniqueOrderNumber } from '../db.ts';
import {
  calculateDeliveryFee,
  createNotification,
  formatProductRow,
  getCartDetails,
  validatePromoForItems,
} from '../helpers.ts';
import { broadcastAll, getPresenceSummary, sendToAdmins, sendToUser } from '../realtime.ts';
import {
  AuthedRequest,
  getClientIp,
  isSafeImageUrl,
  logSecurityEvent,
  optionalCustomerAuth,
  requireCustomerAuth,
} from '../security.ts';

export const marketplaceRouter = Router();

// Public Categories
marketplaceRouter.get('/categories', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
       FROM categories c
       ORDER BY c.sort_order ASC, c.name ASC`
    )
    .all();
  res.json({ categories: rows });
});

// Public Products with search, category/price filter, sort
marketplaceRouter.get('/products', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const featured = req.query.featured === '1' || req.query.featured === 'true';
  const discounted = req.query.discounted === '1' || req.query.discounted === 'true';
  const sort = String(req.query.sort || 'newest');

  const conditions: string[] = [];
  const params: any[] = [];

  if (q) {
    conditions.push(`(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.tags_json) LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (categoryId) {
    conditions.push(`(p.category_id = ? OR p.category_id IN (SELECT id FROM categories WHERE parent_id = ?))`);
    params.push(categoryId, categoryId);
  }
  if (minPrice !== null && !Number.isNaN(minPrice)) {
    conditions.push(`COALESCE(p.discounted_price, p.original_price) >= ?`);
    params.push(minPrice);
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    conditions.push(`COALESCE(p.discounted_price, p.original_price) <= ?`);
    params.push(maxPrice);
  }
  if (featured) {
    conditions.push(`p.is_featured = 1`);
  }
  if (discounted) {
    conditions.push(`p.discounted_price IS NOT NULL AND p.discounted_price < p.original_price`);
  }

  let orderBy = 'p.created_at DESC, p.id DESC';
  if (sort === 'price_asc') orderBy = 'COALESCE(p.discounted_price, p.original_price) ASC';
  else if (sort === 'price_desc') orderBy = 'COALESCE(p.discounted_price, p.original_price) DESC';
  else if (sort === 'popular') orderBy = 'p.sales_count DESC, p.views_count DESC, p.id DESC';

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name,
              (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY ${orderBy}`
    )
    .all(...params) as any[];

  res.json({ products: rows.map(formatProductRow) });
});

marketplaceRouter.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare(
      `SELECT p.*, c.name AS category_name,
              (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = ?`
    )
    .get(id) as any;

  if (!row) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  db.prepare('UPDATE products SET views_count = views_count + 1 WHERE id = ?').run(id);
  const reviews = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name, u.profile_id, u.avatar_url
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.product_id = ?
       ORDER BY r.id DESC`
    )
    .all(id);

  res.json({ product: formatProductRow(row), reviews });
});

marketplaceRouter.post('/products/:id/reviews', requireCustomerAuth, (req: AuthedRequest, res) => {
  if (!req.customer!.permissions.can_review) {
    res.status(403).json({ error: 'Review permission is disabled for your account' });
    return;
  }
  const productId = Number(req.params.id);
  const rating = Number(req.body?.rating);
  const comment = String(req.body?.comment || '').trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be between 1 and 5' });
    return;
  }
  if (comment.length < 3) {
    res.status(400).json({ error: 'Review comment must be at least 3 characters' });
    return;
  }

  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!prod) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const info = db
    .prepare('INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)')
    .run(productId, req.customer!.id, rating, comment);

  const review = db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at, u.full_name, u.profile_id, u.avatar_url
       FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.id = ?`
    )
    .get(info.lastInsertRowid);

  res.status(201).json({ review });
});

// Favorites
marketplaceRouter.get('/favorites', requireCustomerAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS category_name,
              (SELECT AVG(r.rating) FROM reviews r WHERE r.product_id = p.id) AS avg_rating,
              (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count
       FROM favorites f
       JOIN products p ON p.id = f.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE f.user_id = ?
       ORDER BY f.id DESC`
    )
    .all(req.customer!.id) as any[];

  res.json({ favorites: rows.map(formatProductRow) });
});

marketplaceRouter.post('/favorites/:productId', requireCustomerAuth, (req: AuthedRequest, res) => {
  const productId = Number(req.params.productId);
  const prod = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
  if (!prod) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  db.prepare('INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)').run(req.customer!.id, productId);
  res.json({ favorited: true });
});

marketplaceRouter.delete('/favorites/:productId', requireCustomerAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(
    req.customer!.id,
    Number(req.params.productId)
  );
  res.json({ favorited: false });
});

// Cart
marketplaceRouter.get('/cart', requireCustomerAuth, (req: AuthedRequest, res) => {
  res.json(getCartDetails(req.customer!.id));
});

marketplaceRouter.post('/cart/items', requireCustomerAuth, (req: AuthedRequest, res) => {
  const productId = Number(req.body?.productId);
  const quantity = Math.max(1, Number(req.body?.quantity || 1));

  const product = db.prepare('SELECT id, quantity, is_available FROM products WHERE id = ?').get(productId) as any;
  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  if (!product.is_available || product.quantity <= 0) {
    res.status(400).json({ error: 'Product is currently out of stock' });
    return;
  }

  const cart = getCartDetails(req.customer!.id);
  const existing = db
    .prepare('SELECT id, quantity FROM cart_items WHERE cart_id = ? AND product_id = ?')
    .get(cart.cart_id, productId) as { id: number; quantity: number } | undefined;

  const targetQty = Math.min(product.quantity, (existing?.quantity || 0) + quantity);
  if (existing) {
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(targetQty, existing.id);
  } else {
    db.prepare('INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)').run(
      cart.cart_id,
      productId,
      targetQty
    );
  }
  res.json(getCartDetails(req.customer!.id));
});

marketplaceRouter.patch('/cart/items/:productId', requireCustomerAuth, (req: AuthedRequest, res) => {
  const productId = Number(req.params.productId);
  const quantity = Number(req.body?.quantity);
  const cart = getCartDetails(req.customer!.id);

  if (quantity <= 0) {
    db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cart.cart_id, productId);
    res.json(getCartDetails(req.customer!.id));
    return;
  }

  const product = db.prepare('SELECT quantity, is_available FROM products WHERE id = ?').get(productId) as any;
  if (!product || !product.is_available || product.quantity < quantity) {
    res.status(400).json({ error: `Only ${product?.quantity || 0} units available in stock` });
    return;
  }

  db.prepare('UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?').run(
    quantity,
    cart.cart_id,
    productId
  );
  res.json(getCartDetails(req.customer!.id));
});

marketplaceRouter.delete('/cart/items/:productId', requireCustomerAuth, (req: AuthedRequest, res) => {
  const cart = getCartDetails(req.customer!.id);
  db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(
    cart.cart_id,
    Number(req.params.productId)
  );
  res.json(getCartDetails(req.customer!.id));
});

// Promo validation
marketplaceRouter.post('/promos/validate', requireCustomerAuth, (req: AuthedRequest, res) => {
  const code = String(req.body?.code || '').trim();
  const cart = getCartDetails(req.customer!.id);
  if (cart.items.length === 0) {
    res.status(400).json({ valid: false, error: 'Your cart is empty' });
    return;
  }

  const result = validatePromoForItems(
    code,
    req.customer!.id,
    cart.items.map((it) => ({
      product_id: it.product_id,
      category_id: it.product.category_id,
      line_total: it.line_total,
    })),
    cart.subtotal
  );

  if (!result.valid) {
    res.status(400).json({ valid: false, error: result.error });
    return;
  }

  const afterPromo = Number(Math.max(0, cart.subtotal - result.discountAmount).toFixed(2));
  const deliveryFee = calculateDeliveryFee(afterPromo);
  res.json({
    valid: true,
    code: result.promo.code,
    discount_type: result.promo.discount_type,
    discount_value: result.promo.discount_value,
    discount_amount: result.discountAmount,
    delivery_fee: deliveryFee,
    final_total: Number((afterPromo + deliveryFee).toFixed(2)),
  });
});

// Place Order (atomic stock validation, unique AB12345678 ID, duplicate prevention via idempotencyKey)
marketplaceRouter.post('/orders', requireCustomerAuth, (req: AuthedRequest, res) => {
  if (!req.customer!.permissions.can_order) {
    res.status(403).json({ error: 'Ordering is disabled for your account' });
    return;
  }

  const {
    customerName,
    customerPhone,
    region,
    district,
    deliveryAddress,
    deliveryInstructions,
    latitude,
    longitude,
    promoCode,
    idempotencyKey,
  } = req.body || {};

  if (!customerName || !customerPhone || !region || !district || !deliveryAddress) {
    res.status(400).json({ error: 'Name, phone, region, district, and full delivery address are required' });
    return;
  }

  if (idempotencyKey) {
    const existing = db
      .prepare('SELECT * FROM orders WHERE idempotency_key = ? AND user_id = ?')
      .get(String(idempotencyKey), req.customer!.id) as any;
    if (existing) {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(existing.id);
      res.json({ order: { ...existing, items } });
      return;
    }
  }

  const cart = getCartDetails(req.customer!.id);
  if (cart.items.length === 0) {
    res.status(400).json({ error: 'Shopping cart is empty' });
    return;
  }

  const createOrderTx = db.transaction(() => {
    // Re-verify live stock inside transaction
    for (const item of cart.items) {
      const fresh = db
        .prepare('SELECT id, name, quantity, is_available FROM products WHERE id = ?')
        .get(item.product_id) as any;
      if (!fresh || !fresh.is_available || fresh.quantity < item.quantity) {
        throw new Error(`Insufficient stock for "${item.product.name}" (available: ${fresh?.quantity ?? 0})`);
      }
    }

    let promoDiscount = 0;
    let appliedPromo: any = null;
    if (promoCode && String(promoCode).trim()) {
      const promoCheck = validatePromoForItems(
        String(promoCode),
        req.customer!.id,
        cart.items.map((it) => ({
          product_id: it.product_id,
          category_id: it.product.category_id,
          line_total: it.line_total,
        })),
        cart.subtotal
      );
      if (!promoCheck.valid) {
        throw new Error(promoCheck.error || 'Invalid promo code');
      }
      promoDiscount = promoCheck.discountAmount;
      appliedPromo = promoCheck.promo;
    }

    const afterPromo = Number(Math.max(0, cart.subtotal - promoDiscount).toFixed(2));
    const deliveryFee = calculateDeliveryFee(afterPromo);
    const totalAmount = Number((afterPromo + deliveryFee).toFixed(2));
    const orderNumber = generateUniqueOrderNumber();

    const orderInfo = db
      .prepare(
        `INSERT INTO orders (
          order_number, user_id, customer_name, customer_phone, region, district,
          delivery_address, delivery_instructions, latitude, longitude,
          subtotal, item_discount_total, promo_code, promo_discount, delivery_fee, total_amount,
          status, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)`
      )
      .run(
        orderNumber,
        req.customer!.id,
        String(customerName).trim(),
        String(customerPhone).trim(),
        String(region).trim(),
        String(district).trim(),
        String(deliveryAddress).trim(),
        deliveryInstructions ? String(deliveryInstructions).trim() : null,
        typeof latitude === 'number' ? latitude : null,
        typeof longitude === 'number' ? longitude : null,
        cart.subtotal,
        cart.item_discount_total,
        appliedPromo ? appliedPromo.code : null,
        promoDiscount,
        deliveryFee,
        totalAmount,
        idempotencyKey ? String(idempotencyKey) : null
      );

    const orderId = Number(orderInfo.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (
        order_id, product_id, seller_id, product_name, product_image,
        unit_original_price, unit_price, weight, quantity, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const deductStock = db.prepare(
      `UPDATE products
       SET quantity = quantity - ?,
           sales_count = sales_count + ?,
           is_available = CASE WHEN quantity - ? <= 0 THEN 0 ELSE is_available END,
           updated_at = datetime('now')
       WHERE id = ?`
    );
    const insertInvLog = db.prepare(
      `INSERT INTO inventory_logs (product_id, delta, previous_qty, new_qty, reason, actor_type, actor_id)
       VALUES (?, ?, ?, ?, ?, 'customer', ?)`
    );

    for (const item of cart.items) {
      insertItem.run(
        orderId,
        item.product_id,
        item.product.seller_id || null,
        item.product.name,
        item.product.images[0] || null,
        item.product.original_price,
        item.product.effective_price,
        item.product.weight || null,
        item.quantity,
        item.line_total
      );
      const prevQty = item.product.quantity;
      const newQty = prevQty - item.quantity;
      deductStock.run(item.quantity, item.quantity, item.quantity, item.product_id);
      insertInvLog.run(item.product_id, -item.quantity, prevQty, newQty, `Order ${orderNumber}`, req.customer!.id);
    }

    if (appliedPromo) {
      db.prepare('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = ?').run(appliedPromo.id);
      db.prepare('INSERT INTO promo_code_usages (promo_code_id, user_id, order_id) VALUES (?, ?, ?)').run(
        appliedPromo.id,
        req.customer!.id,
        orderId
      );
    }

    db.prepare(
      `INSERT INTO order_history (order_id, status, note, changed_by) VALUES (?, 'Pending', 'Order placed by customer', ?)`
    ).run(orderId, `Customer #${req.customer!.profile_id}`);

    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cart.cart_id);

    return orderId;
  });

  try {
    const orderId = createOrderTx();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId) as any[];
    const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC').all(orderId);

    // Broadcast updated product stock to all shoppers
    for (const item of items) {
      if (item.product_id) {
        const updatedProd = db
          .prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
          .get(item.product_id);
        if (updatedProd) {
          broadcastAll('product:updated', formatProductRow(updatedProd));
        }
      }
    }

    const fullOrder = { ...order, items, history };
    sendToUser(req.customer!.id, 'order:created', fullOrder);
    sendToAdmins('order:created', fullOrder);

    createNotification({
      recipientRole: 'admin',
      recipientId: 0,
      type: 'new_order',
      title: `New Order ${order.order_number}`,
      body: `${order.customer_name} placed an order totaling $${Number(order.total_amount).toFixed(2)}`,
      linkPage: '/admin/orders',
      referenceId: order.order_number,
    });

    createNotification({
      recipientRole: 'customer',
      recipientId: req.customer!.id,
      type: 'order_confirmed',
      title: `Order ${order.order_number} Received`,
      body: `Your order has been placed and is currently Pending review.`,
      linkPage: `/orders/track/${order.order_number}`,
      referenceId: order.order_number,
    });

    logSecurityEvent('customer', req.customer!.id, 'order.created', 'order', order.order_number, { total: order.total_amount }, getClientIp(req));
    res.status(201).json({ order: fullOrder });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Could not place order' });
  }
});

// My Orders
marketplaceRouter.get('/orders', requireCustomerAuth, (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  const rows = q
    ? (db
        .prepare('SELECT * FROM orders WHERE user_id = ? AND UPPER(order_number) LIKE ? ORDER BY id DESC')
        .all(req.customer!.id, `%${q}%`) as any[])
    : (db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.customer!.id) as any[]);

  const orders = rows.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    history: db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC').all(o.id),
  }));
  res.json({ orders });
});

// Order Tracking by AB12345678 Order Number
marketplaceRouter.get('/orders/track/:orderNumber', optionalCustomerAuth, (req: AuthedRequest, res) => {
  const orderNumber = String(req.params.orderNumber || '').trim().toUpperCase();
  const order = db.prepare('SELECT * FROM orders WHERE UPPER(order_number) = ?').get(orderNumber) as any;
  if (!order) {
    res.status(404).json({ error: 'Order ID not found' });
    return;
  }

  // Only allow full PII if authenticated owner or admin; otherwise return safe status tracking info
  const isOwner = req.customer && req.customer.id === order.user_id;
  const isAdmin = Boolean(req.admin);

  const items = db.prepare('SELECT product_name, product_image, unit_price, weight, quantity, line_total FROM order_items WHERE order_id = ?').all(order.id);
  const history = db.prepare('SELECT status, note, created_at FROM order_history WHERE order_id = ? ORDER BY id ASC').all(order.id);

  if (isOwner || isAdmin) {
    res.json({ order: { ...order, items, history }, authorizedFullView: true });
    return;
  }

  res.json({
    order: {
      order_number: order.order_number,
      status: order.status,
      region: order.region,
      district: order.district,
      total_amount: order.total_amount,
      created_at: order.created_at,
      updated_at: order.updated_at,
      items,
      history,
    },
    authorizedFullView: false,
  });
});

// Customer Support Chat (Direct with Admin)
marketplaceRouter.get('/chat/support', requireCustomerAuth, (req: AuthedRequest, res) => {
  let conv = db
    .prepare(`SELECT * FROM conversations WHERE type = 'admin_support' AND customer_id = ?`)
    .get(req.customer!.id) as any;

  if (!conv) {
    const info = db
      .prepare(`INSERT INTO conversations (type, customer_id) VALUES ('admin_support', ?)`)
      .run(req.customer!.id);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  }

  db.prepare(
    `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = 'admin' AND is_read = 0`
  ).run(conv.id);

  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(conv.id);

  res.json({ conversation: conv, messages, presence: getPresenceSummary() });
});

marketplaceRouter.post('/chat/support', requireCustomerAuth, (req: AuthedRequest, res) => {
  if (!req.customer!.permissions.can_chat) {
    res.status(403).json({ error: 'Messaging permission is disabled for your account' });
    return;
  }
  const content = String(req.body?.content || '').trim();
  const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl) : null;
  if (!content && !imageUrl) {
    res.status(400).json({ error: 'Message text or image is required' });
    return;
  }
  if (imageUrl && !isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Invalid image URL' });
    return;
  }

  let conv = db
    .prepare(`SELECT * FROM conversations WHERE type = 'admin_support' AND customer_id = ?`)
    .get(req.customer!.id) as any;

  if (!conv) {
    const info = db
      .prepare(`INSERT INTO conversations (type, customer_id) VALUES ('admin_support', ?)`)
      .run(req.customer!.id);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  }

  const msgInfo = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_role, sender_id, content, image_url)
       VALUES (?, 'customer', ?, ?, ?)`
    )
    .run(conv.id, req.customer!.id, content, imageUrl);

  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(conv.id);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgInfo.lastInsertRowid);

  const payload = { conversationId: conv.id, message, customer: req.customer };
  sendToUser(req.customer!.id, 'chat:message', payload);
  sendToAdmins('chat:message', payload);

  createNotification({
    recipientRole: 'admin',
    recipientId: 0,
    type: 'new_message',
    title: `Message from ${req.customer!.full_name}`,
    body: content ? content.slice(0, 80) : 'Sent an image attachment',
    linkPage: '/admin/messages',
    referenceId: String(conv.id),
  });

  res.status(201).json({ message });
});

// Buyer-Seller Messaging
marketplaceRouter.get('/chat/sellers', requireCustomerAuth, (req: AuthedRequest, res) => {
  const mySeller = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.customer!.id) as
    | { id: number }
    | undefined;

  const conversations = db
    .prepare(
      `SELECT c.*, s.store_name, s.user_id AS seller_user_id, u.full_name AS customer_name, u.profile_id AS customer_profile_id,
              p.name AS product_name,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.is_read = 0 AND m.sender_id != ?) AS unread_count
       FROM conversations c
       JOIN sellers s ON s.id = c.seller_id
       JOIN users u ON u.id = c.customer_id
       LEFT JOIN products p ON p.id = c.product_id
       WHERE c.type = 'seller_chat' AND (c.customer_id = ? OR c.seller_id = ?)
       ORDER BY c.last_message_at DESC`
    )
    .all(req.customer!.id, req.customer!.id, mySeller?.id || -1);

  res.json({ conversations, presence: getPresenceSummary() });
});

marketplaceRouter.post('/chat/sellers/start', requireCustomerAuth, (req: AuthedRequest, res) => {
  const sellerId = Number(req.body?.sellerId);
  const productId = req.body?.productId ? Number(req.body.productId) : null;
  const orderId = req.body?.orderId ? Number(req.body.orderId) : null;

  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(sellerId) as any;
  if (!seller) {
    res.status(404).json({ error: 'Seller not found' });
    return;
  }

  let conv = db
    .prepare(
      `SELECT * FROM conversations WHERE type = 'seller_chat' AND customer_id = ? AND seller_id = ? AND COALESCE(product_id, 0) = COALESCE(?, 0)`
    )
    .get(req.customer!.id, sellerId, productId) as any;

  if (!conv) {
    const info = db
      .prepare(
        `INSERT INTO conversations (type, customer_id, seller_id, product_id, order_id)
         VALUES ('seller_chat', ?, ?, ?, ?)`
      )
      .run(req.customer!.id, sellerId, productId, orderId);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  }
  res.json({ conversation: conv });
});

marketplaceRouter.get('/chat/sellers/:conversationId', requireCustomerAuth, (req: AuthedRequest, res) => {
  const convId = Number(req.params.conversationId);
  const mySeller = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.customer!.id) as
    | { id: number }
    | undefined;

  const conv = db
    .prepare(
      `SELECT c.*, s.store_name, s.user_id AS seller_user_id, u.full_name AS customer_name
       FROM conversations c
       JOIN sellers s ON s.id = c.seller_id
       JOIN users u ON u.id = c.customer_id
       WHERE c.id = ? AND c.type = 'seller_chat'`
    )
    .get(convId) as any;

  if (!conv || (conv.customer_id !== req.customer!.id && conv.seller_id !== mySeller?.id)) {
    res.status(403).json({ error: 'Access denied to this conversation' });
    return;
  }

  db.prepare(`UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0`).run(
    convId,
    req.customer!.id
  );

  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(convId);
  res.json({ conversation: conv, messages });
});

marketplaceRouter.post('/chat/sellers/:conversationId', requireCustomerAuth, (req: AuthedRequest, res) => {
  const convId = Number(req.params.conversationId);
  const mySeller = db.prepare('SELECT id FROM sellers WHERE user_id = ?').get(req.customer!.id) as
    | { id: number }
    | undefined;

  const conv = db
    .prepare(
      `SELECT c.*, s.user_id AS seller_user_id FROM conversations c JOIN sellers s ON s.id = c.seller_id WHERE c.id = ? AND c.type = 'seller_chat'`
    )
    .get(convId) as any;

  if (!conv || (conv.customer_id !== req.customer!.id && conv.seller_id !== mySeller?.id)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const content = String(req.body?.content || '').trim();
  const imageUrl = req.body?.imageUrl ? String(req.body.imageUrl) : null;
  if (!content && !imageUrl) {
    res.status(400).json({ error: 'Message text or image is required' });
    return;
  }
  if (imageUrl && !isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Invalid image URL' });
    return;
  }

  const senderRole = conv.seller_id === mySeller?.id ? 'seller' : 'customer';
  const info = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_role, sender_id, content, image_url)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(convId, senderRole, req.customer!.id, content, imageUrl);

  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(convId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);

  const targetUserId = senderRole === 'customer' ? conv.seller_user_id : conv.customer_id;
  sendToUser(req.customer!.id, 'chat:message', { conversationId: convId, message });
  sendToUser(targetUserId, 'chat:message', { conversationId: convId, message });

  createNotification({
    recipientRole: 'customer',
    recipientId: targetUserId,
    type: 'seller_message',
    title: 'New Marketplace Message',
    body: content ? content.slice(0, 80) : 'Sent an image attachment',
    linkPage: '/seller-chat',
    referenceId: String(convId),
  });

  res.status(201).json({ message });
});

// Seller Application & Authorized Seller Management
marketplaceRouter.post('/seller/apply', requireCustomerAuth, (req: AuthedRequest, res) => {
  const { storeName, description } = req.body || {};
  if (!storeName || String(storeName).trim().length < 2) {
    res.status(400).json({ error: 'Store name is required' });
    return;
  }
  const existing = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.customer!.id);
  if (existing) {
    res.status(409).json({ error: 'Seller profile already exists for your account' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO sellers (user_id, store_name, description, phone, region, district, authorized_by_admin, status)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'pending')`
    )
    .run(
      req.customer!.id,
      String(storeName).trim(),
      String(description || '').trim(),
      req.customer!.phone,
      req.customer!.region,
      req.customer!.district
    );
  const seller = db.prepare('SELECT * FROM sellers WHERE id = ?').get(info.lastInsertRowid);
  createNotification({
    recipientRole: 'admin',
    recipientId: 0,
    type: 'seller_application',
    title: 'New Seller Authorization Request',
    body: `${req.customer!.full_name} applied to sell as "${storeName}"`,
    linkPage: '/admin/customers',
    referenceId: String(req.customer!.id),
  });
  res.status(201).json({ seller });
});

marketplaceRouter.post('/seller/products', requireCustomerAuth, (req: AuthedRequest, res) => {
  const seller = db
    .prepare(`SELECT * FROM sellers WHERE user_id = ? AND authorized_by_admin = 1 AND status = 'approved'`)
    .get(req.customer!.id) as any;

  if (!seller) {
    res.status(403).json({ error: 'Only admin-authorized sellers can add seller products' });
    return;
  }

  const { name, description, originalPrice, discountedPrice, weight, quantity, categoryId, images, specs, tags } =
    req.body || {};

  if (!name || Number(originalPrice) < 0 || Number(quantity) < 0) {
    res.status(400).json({ error: 'Valid product name, price, and quantity are required' });
    return;
  }

  const orig = Number(originalPrice);
  const disc =
    discountedPrice !== null && discountedPrice !== undefined && discountedPrice !== ''
      ? Number(discountedPrice)
      : null;
  const pct = disc !== null && orig > 0 && disc < orig ? Math.round(((orig - disc) / orig) * 100) : 0;

  const info = db
    .prepare(
      `INSERT INTO products (seller_id, category_id, name, slug, description, original_price, discounted_price, discount_percent, weight, quantity, is_available, specs_json, tags_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      seller.id,
      categoryId ? Number(categoryId) : null,
      String(name).trim(),
      createSlug(String(name)),
      String(description || '').trim(),
      orig,
      disc,
      pct,
      String(weight || '').trim(),
      Number(quantity),
      Number(quantity) > 0 ? 1 : 0,
      JSON.stringify(Array.isArray(specs) ? specs : []),
      JSON.stringify(Array.isArray(tags) ? tags : [])
    );

  const productId = Number(info.lastInsertRowid);
  if (Array.isArray(images)) {
    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
    images.forEach((url: string, idx: number) => {
      if (isSafeImageUrl(url)) stmt.run(productId, url, idx);
    });
  }

  const created = db
    .prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
    .get(productId);
  const formatted = formatProductRow(created);
  broadcastAll('product:created', formatted);
  res.status(201).json({ product: formatted });
});

// Notifications
marketplaceRouter.get('/notifications', requireCustomerAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT * FROM notifications
       WHERE recipient_role = 'customer' AND recipient_id = ?
       ORDER BY id DESC LIMIT 50`
    )
    .all(req.customer!.id);
  res.json({ notifications: rows });
});

marketplaceRouter.patch('/notifications/:id/read', requireCustomerAuth, (req: AuthedRequest, res) => {
  db.prepare(
    `UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_role = 'customer' AND recipient_id = ?`
  ).run(Number(req.params.id), req.customer!.id);
  res.json({ success: true });
});

marketplaceRouter.post('/notifications/read-all', requireCustomerAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_role = 'customer' AND recipient_id = ?`).run(
    req.customer!.id
  );
  res.json({ success: true });
});

// X-MARKET AI Endpoint
marketplaceRouter.post('/ai/chat', optionalCustomerAuth, async (req: AuthedRequest, res) => {
  const message = String(req.body?.message || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  if (!message) {
    res.status(400).json({ error: 'Message is required' });
    return;
  }

  try {
    const aiResult = await runMarketplaceAi(message, history, req.customer?.id || null);
    let recommendedProducts: any[] = [];
    if (aiResult.recommendedProductIds.length > 0) {
      const placeholders = aiResult.recommendedProductIds.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id IN (${placeholders})`
        )
        .all(...aiResult.recommendedProductIds) as any[];
      recommendedProducts = rows.map(formatProductRow);
    }

    res.json({
      reply: aiResult.reply,
      recommendedProducts,
    });
  } catch (err: any) {
    console.error('X-MARKET AI error:', err);
    res.status(500).json({ error: err.message || 'X-MARKET AI service is temporarily unavailable' });
  }
});
