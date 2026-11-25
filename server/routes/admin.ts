import { Router } from 'express';
import { createSlug, db } from '../db.ts';
import { createNotification, formatProductRow } from '../helpers.ts';
import { broadcastAll, getPresenceSummary, sendToAdmins, sendToUser } from '../realtime.ts';
import {
  AuthedRequest,
  checkRateLimit,
  constantTimeEquals,
  createSession,
  getClientIp,
  hashPassword,
  isSafeImageUrl,
  logSecurityEvent,
  requireAdminAuth,
  resetRateLimit,
  revokeSessionByToken,
  verifyPassword,
} from '../security.ts';

export const adminRouter = Router();

// Check if admin credentials are initialized (either via DB hash or ADMIN_INITIAL_PASSWORD env var)
adminRouter.get('/status', (_req, res) => {
  const admin = db.prepare('SELECT id FROM admins LIMIT 1').get();
  const envConfigured = Boolean(process.env.ADMIN_INITIAL_PASSWORD && process.env.ADMIN_INITIAL_PASSWORD.length > 0);
  res.json({
    initialized: Boolean(admin) || envConfigured,
    requiresBootstrap: !admin && !envConfigured,
  });
});

// One-time First-Run Admin Setup if neither DB admin nor ADMIN_INITIAL_PASSWORD env var exists
adminRouter.post('/bootstrap', async (req, res) => {
  const ip = getClientIp(req);
  const existing = db.prepare('SELECT id FROM admins LIMIT 1').get();
  const envPass = process.env.ADMIN_INITIAL_PASSWORD;

  if (existing || (envPass && envPass.length > 0)) {
    res.status(403).json({ error: 'Administrator account is already configured' });
    return;
  }

  const password = String(req.body?.password || '');
  const fullName = String(req.body?.fullName || 'X-MARKET Administrator').trim();
  if (password.length < 6) {
    res.status(400).json({ error: 'Administrator password must be at least 6 characters' });
    return;
  }

  const hash = await hashPassword(password);
  const info = db
    .prepare(`INSERT INTO admins (username, password_hash, full_name) VALUES ('admin', ?, ?)`)
    .run(hash, fullName);

  const adminId = Number(info.lastInsertRowid);
  const { token } = createSession('admin', adminId, req, 12);
  logSecurityEvent('admin', adminId, 'admin.bootstrap', 'admin', String(adminId), null, ip);

  const admin = db.prepare('SELECT id, username, full_name, telegram_handle FROM admins WHERE id = ?').get(adminId);
  res.status(201).json({ token, admin });
});

// Secure Admin Login (bcrypt + env secret fallback, rate limited, security logged, never leaks password)
adminRouter.post('/login', async (req, res) => {
  const ip = getClientIp(req);
  const rlKey = `admin-login:${ip}`;
  const rl = checkRateLimit(rlKey, 5, 15 * 60 * 1000, 30 * 60 * 1000);
  if (!rl.allowed) {
    logSecurityEvent('guest', null, 'admin.login_rate_limited', 'admin', null, null, ip);
    res.status(429).json({ error: `Too many failed administrator login attempts. Try again in ${rl.retryAfterSec}s.` });
    return;
  }

  const password = String(req.body?.password || '');
  if (!password) {
    res.status(400).json({ error: 'Administrator password is required' });
    return;
  }

  let admin = db.prepare('SELECT * FROM admins LIMIT 1').get() as any;
  const envInitial = process.env.ADMIN_INITIAL_PASSWORD;

  let authenticated = false;
  if (admin) {
    authenticated = await verifyPassword(password, admin.password_hash);
  } else if (envInitial && envInitial.length > 0) {
    if (constantTimeEquals(password, envInitial)) {
      const hash = await hashPassword(password);
      const info = db
        .prepare(`INSERT INTO admins (username, password_hash, full_name) VALUES ('admin', ?, 'X-MARKET Administrator')`)
        .run(hash);
      admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(info.lastInsertRowid);
      authenticated = true;
    }
  }

  if (!authenticated || !admin) {
    logSecurityEvent('guest', null, 'admin.login_failed', 'admin', null, null, ip);
    res.status(401).json({ error: 'Invalid administrator credentials' });
    return;
  }

  resetRateLimit(rlKey);
  const { token, expiresAt } = createSession('admin', admin.id, req, 12);
  logSecurityEvent('admin', admin.id, 'admin.login_success', 'admin', String(admin.id), null, ip);

  res.json({
    token,
    expiresAt,
    admin: {
      id: admin.id,
      username: admin.username,
      full_name: admin.full_name,
      telegram_handle: admin.telegram_handle,
    },
  });
});

adminRouter.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    revokeSessionByToken(header.slice(7).trim());
  }
  res.json({ success: true });
});

adminRouter.get('/me', requireAdminAuth, (req: AuthedRequest, res) => {
  res.json({ admin: req.admin });
});

adminRouter.put('/profile', requireAdminAuth, (req: AuthedRequest, res) => {
  const fullName = String(req.body?.fullName || '').trim();
  if (fullName.length < 2) {
    res.status(400).json({ error: 'Administrator name must be at least 2 characters' });
    return;
  }
  db.prepare(`UPDATE admins SET full_name = ?, updated_at = datetime('now') WHERE id = ?`).run(
    fullName,
    req.admin!.id
  );
  const updated = db
    .prepare('SELECT id, username, full_name, telegram_handle FROM admins WHERE id = ?')
    .get(req.admin!.id);
  res.json({ admin: updated });
});

adminRouter.post('/password', requireAdminAuth, async (req: AuthedRequest, res) => {
  const ip = getClientIp(req);
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 8) {
    res.status(400).json({ error: 'Current password and a new password (min 8 chars) are required' });
    return;
  }

  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin!.id) as any;
  const valid = await verifyPassword(String(currentPassword), admin.password_hash);
  if (!valid) {
    logSecurityEvent('admin', req.admin!.id, 'admin.password_change_failed', 'admin', String(req.admin!.id), null, ip);
    res.status(400).json({ error: 'Current administrator password is incorrect' });
    return;
  }

  const newHash = await hashPassword(String(newPassword));
  db.prepare(`UPDATE admins SET password_hash = ?, password_changed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(
    newHash,
    req.admin!.id
  );
  // Revoke other admin sessions
  db.prepare(`UPDATE sessions SET revoked = 1 WHERE actor_type = 'admin' AND id != ?`).run(req.admin!.session_id);
  logSecurityEvent('admin', req.admin!.id, 'admin.password_changed', 'admin', String(req.admin!.id), null, ip);
  res.json({ success: true });
});

adminRouter.get('/sessions', requireAdminAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, user_agent, ip_address, expires_at, created_at FROM sessions WHERE actor_type = 'admin' AND actor_id = ? AND revoked = 0 ORDER BY created_at DESC`
    )
    .all(req.admin!.id) as any[];
  res.json({ sessions: rows.map((s) => ({ ...s, isCurrent: s.id === req.admin!.session_id })) });
});

// Dashboard & Analytics (100% live database calculations)
adminRouter.get('/analytics', requireAdminAuth, (req, res) => {
  const period = String(req.query.period || 'daily');
  const totalCustomers = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as any).cnt;
  const totalProducts = (db.prepare('SELECT COUNT(*) AS cnt FROM products').get() as any).cnt;
  const totalOrders = (db.prepare('SELECT COUNT(*) AS cnt FROM orders').get() as any).cnt;

  const salesAgg = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Refunded') THEN total_amount ELSE 0 END), 0) AS total_revenue,
         COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) AS pending_orders,
         COALESCE(SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END), 0) AS completed_orders,
         COALESCE(SUM(CASE WHEN status IN ('Cancelled', 'Refunded') THEN 1 ELSE 0 END), 0) AS cancelled_orders,
         COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Refunded') THEN 1 ELSE 0 END), 0) AS active_sales_count
       FROM orders`
    )
    .get() as any;

  const stockAgg = db
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(discounted_price, original_price) * quantity), 0) AS total_stock_value
       FROM products`
    )
    .get() as any;

  const lowStockProducts = db
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.quantity <= 5
       ORDER BY p.quantity ASC, p.id DESC LIMIT 12`
    )
    .all() as any[];

  const recentCustomers = db
    .prepare(
      `SELECT id, profile_id, full_name, phone, region, district, status, phone_verified, created_at
       FROM users ORDER BY id DESC LIMIT 8`
    )
    .all();

  const recentOrders = db
    .prepare(`SELECT * FROM orders ORDER BY id DESC LIMIT 8`)
    .all();

  let groupExpr = `strftime('%Y-%m-%d', created_at)`;
  if (period === 'weekly') groupExpr = `strftime('%Y-W%W', created_at)`;
  else if (period === 'monthly') groupExpr = `strftime('%Y-%m', created_at)`;
  else if (period === 'yearly') groupExpr = `strftime('%Y', created_at)`;

  const chartSeries = db
    .prepare(
      `SELECT ${groupExpr} AS label,
              COUNT(*) AS orders_count,
              COALESCE(SUM(CASE WHEN status NOT IN ('Cancelled', 'Refunded') THEN total_amount ELSE 0 END), 0) AS revenue
       FROM orders
       GROUP BY ${groupExpr}
       ORDER BY label ASC
       LIMIT 30`
    )
    .all();

  const topProducts = db
    .prepare(
      `SELECT p.id, p.name, p.sales_count, p.quantity, p.original_price, p.discounted_price, c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY p.sales_count DESC, p.id DESC LIMIT 8`
    )
    .all();

  res.json({
    kpis: {
      totalCustomers,
      totalProducts,
      totalOrders,
      totalSales: salesAgg.active_sales_count,
      totalRevenue: Number(Number(salesAgg.total_revenue).toFixed(2)),
      pendingOrders: salesAgg.pending_orders,
      completedOrders: salesAgg.completed_orders,
      cancelledOrders: salesAgg.cancelled_orders,
      totalStockValue: Number(Number(stockAgg.total_stock_value).toFixed(2)),
    },
    lowStockProducts: lowStockProducts.map(formatProductRow),
    recentCustomers,
    recentOrders,
    chartSeries,
    topProducts,
  });
});

// Category Management
adminRouter.post('/categories', requireAdminAuth, (req: AuthedRequest, res) => {
  const { name, parentId, imageUrl, description, sortOrder } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  if (imageUrl && !isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Invalid image URL' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO categories (name, slug, parent_id, image_url, description, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      String(name).trim(),
      createSlug(String(name)),
      parentId ? Number(parentId) : null,
      imageUrl || null,
      description ? String(description).trim() : null,
      Number(sortOrder || 0)
    );
  const created = db
    .prepare(`SELECT c.*, 0 AS product_count FROM categories c WHERE c.id = ?`)
    .get(info.lastInsertRowid);
  broadcastAll('category:created', created);
  logSecurityEvent('admin', req.admin!.id, 'category.created', 'category', String(info.lastInsertRowid), { name }, getClientIp(req));
  res.status(201).json({ category: created });
});

adminRouter.put('/categories/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { name, parentId, imageUrl, description, sortOrder } = req.body || {};
  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Category name is required' });
    return;
  }
  if (imageUrl && !isSafeImageUrl(imageUrl)) {
    res.status(400).json({ error: 'Invalid image URL' });
    return;
  }
  db.prepare(
    `UPDATE categories SET name = ?, parent_id = ?, image_url = ?, description = ?, sort_order = ? WHERE id = ?`
  ).run(
    String(name).trim(),
    parentId && Number(parentId) !== id ? Number(parentId) : null,
    imageUrl || null,
    description ? String(description).trim() : null,
    Number(sortOrder || 0),
    id
  );
  const updated = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count FROM categories c WHERE c.id = ?`
    )
    .get(id);
  broadcastAll('category:updated', updated);
  res.json({ category: updated });
});

adminRouter.delete('/categories/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  broadcastAll('category:deleted', { id });
  logSecurityEvent('admin', req.admin!.id, 'category.deleted', 'category', String(id), null, getClientIp(req));
  res.json({ success: true });
});

// Product Management
adminRouter.post('/products', requireAdminAuth, (req: AuthedRequest, res) => {
  const {
    name,
    description,
    originalPrice,
    discountedPrice,
    weight,
    quantity,
    categoryId,
    isAvailable,
    isFeatured,
    images,
    specs,
    tags,
  } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    res.status(400).json({ error: 'Product name is required' });
    return;
  }
  const orig = Number(originalPrice);
  if (Number.isNaN(orig) || orig < 0) {
    res.status(400).json({ error: 'Valid original price is required' });
    return;
  }
  const disc =
    discountedPrice !== null && discountedPrice !== undefined && discountedPrice !== ''
      ? Number(discountedPrice)
      : null;
  if (disc !== null && (Number.isNaN(disc) || disc < 0 || disc > orig)) {
    res.status(400).json({ error: 'Discounted price must be between 0 and original price' });
    return;
  }

  const qty = Math.max(0, Math.floor(Number(quantity || 0)));
  const pct = disc !== null && orig > 0 && disc < orig ? Math.round(((orig - disc) / orig) * 100) : 0;

  const info = db
    .prepare(
      `INSERT INTO products (
        category_id, name, slug, description, original_price, discounted_price, discount_percent,
        weight, quantity, is_available, is_featured, specs_json, tags_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      categoryId ? Number(categoryId) : null,
      String(name).trim(),
      createSlug(String(name)),
      String(description || '').trim(),
      orig,
      disc,
      pct,
      String(weight || '').trim(),
      qty,
      isAvailable === false ? 0 : 1,
      isFeatured ? 1 : 0,
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

  db.prepare(
    `INSERT INTO inventory_logs (product_id, delta, previous_qty, new_qty, reason, actor_type, actor_id)
     VALUES (?, ?, 0, ?, 'Initial product stock', 'admin', ?)`
  ).run(productId, qty, qty, req.admin!.id);

  const row = db
    .prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
    .get(productId);
  const formatted = formatProductRow(row);
  broadcastAll('product:created', formatted);
  logSecurityEvent('admin', req.admin!.id, 'product.created', 'product', String(productId), { name }, getClientIp(req));
  res.status(201).json({ product: formatted });
});

adminRouter.put('/products/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }

  const {
    name,
    description,
    originalPrice,
    discountedPrice,
    weight,
    quantity,
    categoryId,
    isAvailable,
    isFeatured,
    images,
    specs,
    tags,
  } = req.body || {};

  const orig = Number(originalPrice ?? existing.original_price);
  const disc =
    discountedPrice === '' || discountedPrice === null || discountedPrice === undefined
      ? null
      : Number(discountedPrice);

  if (disc !== null && (Number.isNaN(disc) || disc < 0 || disc > orig)) {
    res.status(400).json({ error: 'Discounted price must be between 0 and original price' });
    return;
  }

  const qty = Math.max(0, Math.floor(Number(quantity ?? existing.quantity)));
  const pct = disc !== null && orig > 0 && disc < orig ? Math.round(((orig - disc) / orig) * 100) : 0;

  db.prepare(
    `UPDATE products
     SET category_id = ?, name = ?, description = ?, original_price = ?, discounted_price = ?, discount_percent = ?,
         weight = ?, quantity = ?, is_available = ?, is_featured = ?, specs_json = ?, tags_json = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    categoryId !== undefined ? (categoryId ? Number(categoryId) : null) : existing.category_id,
    String(name ?? existing.name).trim(),
    String(description ?? existing.description).trim(),
    orig,
    disc,
    pct,
    String(weight ?? existing.weight).trim(),
    qty,
    isAvailable !== undefined ? (isAvailable ? 1 : 0) : existing.is_available,
    isFeatured !== undefined ? (isFeatured ? 1 : 0) : existing.is_featured,
    specs !== undefined ? JSON.stringify(Array.isArray(specs) ? specs : []) : existing.specs_json,
    tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags_json,
    id
  );

  if (Array.isArray(images)) {
    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(id);
    const stmt = db.prepare('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (?, ?, ?)');
    images.forEach((url: string, idx: number) => {
      if (isSafeImageUrl(url)) stmt.run(id, url, idx);
    });
  }

  if (qty !== existing.quantity) {
    db.prepare(
      `INSERT INTO inventory_logs (product_id, delta, previous_qty, new_qty, reason, actor_type, actor_id)
       VALUES (?, ?, ?, ?, 'Admin stock adjustment', 'admin', ?)`
    ).run(id, qty - existing.quantity, existing.quantity, qty, req.admin!.id);
  }

  const row = db
    .prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
    .get(id);
  const formatted = formatProductRow(row);
  broadcastAll('product:updated', formatted);
  logSecurityEvent('admin', req.admin!.id, 'product.updated', 'product', String(id), { name: formatted.name }, getClientIp(req));
  res.json({ product: formatted });
});

adminRouter.delete('/products/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  broadcastAll('product:deleted', { id });
  logSecurityEvent('admin', req.admin!.id, 'product.deleted', 'product', String(id), null, getClientIp(req));
  res.json({ success: true });
});

// Customer / Account Management
adminRouter.get('/customers', requireAdminAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = q
    ? db
        .prepare(
          `SELECT u.id, u.profile_id, u.full_name, u.phone, u.region, u.district, u.avatar_url,
                  u.phone_verified, u.role, u.status, u.permissions_json, u.created_at,
                  s.id AS seller_id, s.store_name, s.authorized_by_admin, s.status AS seller_status,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
                  (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status NOT IN ('Cancelled', 'Refunded')) AS total_spent
           FROM users u LEFT JOIN sellers s ON s.user_id = u.id
           WHERE LOWER(u.full_name) LIKE ? OR LOWER(u.phone) LIKE ? OR u.profile_id LIKE ?
           ORDER BY u.id DESC`
        )
        .all(`%${q}%`, `%${q}%`, `%${q}%`)
    : db
        .prepare(
          `SELECT u.id, u.profile_id, u.full_name, u.phone, u.region, u.district, u.avatar_url,
                  u.phone_verified, u.role, u.status, u.permissions_json, u.created_at,
                  s.id AS seller_id, s.store_name, s.authorized_by_admin, s.status AS seller_status,
                  (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count,
                  (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status NOT IN ('Cancelled', 'Refunded')) AS total_spent
           FROM users u LEFT JOIN sellers s ON s.user_id = u.id
           ORDER BY u.id DESC`
        )
        .all();

  res.json({ customers: rows });
});

adminRouter.patch('/customers/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const { fullName, phone, region, district, status, phoneVerified, permissions, authorizeSeller } = req.body || {};

  db.prepare(
    `UPDATE users
     SET full_name = ?, phone = ?, region = ?, district = ?, status = ?, phone_verified = ?, permissions_json = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    fullName ? String(fullName).trim() : existing.full_name,
    phone ? String(phone).trim() : existing.phone,
    region ? String(region).trim() : existing.region,
    district ? String(district).trim() : existing.district,
    status === 'suspended' ? 'suspended' : status === 'active' ? 'active' : existing.status,
    phoneVerified !== undefined ? (phoneVerified ? 1 : 0) : existing.phone_verified,
    permissions ? JSON.stringify(permissions) : existing.permissions_json,
    id
  );

  if (status === 'suspended') {
    db.prepare(`UPDATE sessions SET revoked = 1 WHERE actor_type = 'customer' AND actor_id = ?`).run(id);
  }

  if (authorizeSeller !== undefined) {
    const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(id) as any;
    if (seller) {
      db.prepare('UPDATE sellers SET authorized_by_admin = ?, status = ? WHERE id = ?').run(
        authorizeSeller ? 1 : 0,
        authorizeSeller ? 'approved' : 'suspended',
        seller.id
      );
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(authorizeSeller ? 'seller' : 'customer', id);
      createNotification({
        recipientRole: 'customer',
        recipientId: id,
        type: 'seller_status',
        title: authorizeSeller ? 'Seller Account Approved' : 'Seller Privileges Revoked',
        body: authorizeSeller
          ? 'The administrator authorized your store to list products on X-MARKET.'
          : 'Your seller authorization was updated by the administrator.',
        linkPage: '/seller-chat',
      });
    }
  }

  logSecurityEvent('admin', req.admin!.id, 'customer.updated', 'user', String(id), { status }, getClientIp(req));
  const updated = db
    .prepare(
      `SELECT u.id, u.profile_id, u.full_name, u.phone, u.region, u.district, u.avatar_url,
              u.phone_verified, u.role, u.status, u.permissions_json, u.created_at
       FROM users u WHERE u.id = ?`
    )
    .get(id);
  res.json({ customer: updated });
});

adminRouter.get('/customers/:id/orders', requireAdminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(Number(req.params.id)) as any[];
  const orders = rows.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
  }));
  res.json({ orders });
});

// Promo Code Management
adminRouter.get('/promos', requireAdminAuth, (_req, res) => {
  const promos = db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all();
  res.json({ promos });
});

adminRouter.post('/promos', requireAdminAuth, (req: AuthedRequest, res) => {
  const {
    code,
    discountType,
    discountValue,
    minOrderAmount,
    maxDiscount,
    expiresAt,
    usageLimit,
    perCustomerLimit,
    isActive,
    applicableCategoryIds,
    applicableProductIds,
  } = req.body || {};

  const cleanCode = String(code || '').trim().toUpperCase();
  if (cleanCode.length < 3) {
    res.status(400).json({ error: 'Promo code must be at least 3 characters' });
    return;
  }
  const existing = db.prepare('SELECT id FROM promo_codes WHERE UPPER(code) = ?').get(cleanCode);
  if (existing) {
    res.status(409).json({ error: 'Promo code already exists' });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO promo_codes (
        code, discount_type, discount_value, min_order_amount, max_discount,
        expires_at, usage_limit, per_customer_limit, is_active,
        applicable_category_ids_json, applicable_product_ids_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      cleanCode,
      discountType === 'fixed' ? 'fixed' : 'percent',
      Number(discountValue || 10),
      Number(minOrderAmount || 0),
      maxDiscount ? Number(maxDiscount) : null,
      expiresAt || null,
      usageLimit ? Number(usageLimit) : null,
      perCustomerLimit ? Number(perCustomerLimit) : 1,
      isActive === false ? 0 : 1,
      JSON.stringify(Array.isArray(applicableCategoryIds) ? applicableCategoryIds : []),
      JSON.stringify(Array.isArray(applicableProductIds) ? applicableProductIds : [])
    );

  const promo = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(info.lastInsertRowid);
  logSecurityEvent('admin', req.admin!.id, 'promo.created', 'promo', cleanCode, null, getClientIp(req));
  res.status(201).json({ promo });
});

adminRouter.patch('/promos/:id', requireAdminAuth, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Promo code not found' });
    return;
  }
  const { isActive, discountValue, minOrderAmount, maxDiscount, expiresAt, usageLimit, perCustomerLimit } = req.body || {};
  db.prepare(
    `UPDATE promo_codes
     SET is_active = ?, discount_value = ?, min_order_amount = ?, max_discount = ?, expires_at = ?, usage_limit = ?, per_customer_limit = ?
     WHERE id = ?`
  ).run(
    isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    discountValue !== undefined ? Number(discountValue) : existing.discount_value,
    minOrderAmount !== undefined ? Number(minOrderAmount) : existing.min_order_amount,
    maxDiscount !== undefined ? (maxDiscount ? Number(maxDiscount) : null) : existing.max_discount,
    expiresAt !== undefined ? expiresAt || null : existing.expires_at,
    usageLimit !== undefined ? (usageLimit ? Number(usageLimit) : null) : existing.usage_limit,
    perCustomerLimit !== undefined ? Number(perCustomerLimit) : existing.per_customer_limit,
    id
  );
  res.json({ promo: db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(id) });
});

adminRouter.delete('/promos/:id', requireAdminAuth, (req, res) => {
  db.prepare('DELETE FROM promo_codes WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

// Order Management
adminRouter.get('/orders', requireAdminAuth, (req, res) => {
  const q = String(req.query.q || '').trim().toUpperCase();
  const status = String(req.query.status || '').trim();
  const dateFrom = String(req.query.dateFrom || '').trim();
  const dateTo = String(req.query.dateTo || '').trim();

  const conds: string[] = [];
  const params: any[] = [];
  if (q) {
    conds.push(`(UPPER(o.order_number) LIKE ? OR UPPER(o.customer_name) LIKE ? OR o.customer_phone LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    conds.push(`o.status = ?`);
    params.push(status);
  }
  if (dateFrom) {
    conds.push(`date(o.created_at) >= date(?)`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conds.push(`date(o.created_at) <= date(?)`);
    params.push(dateTo);
  }

  const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT o.*, u.profile_id AS customer_profile_id
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       ${where}
       ORDER BY o.id DESC`
    )
    .all(...params) as any[];

  const orders = rows.map((o) => ({
    ...o,
    items: db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id),
    history: db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC').all(o.id),
  }));

  res.json({ orders });
});

adminRouter.patch('/orders/:id', requireAdminAuth, (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded'];
  const {
    status,
    customerName,
    customerPhone,
    region,
    district,
    deliveryAddress,
    deliveryInstructions,
    internalNotes,
    statusNote,
  } = req.body || {};

  const nextStatus = status && validStatuses.includes(status) ? status : existing.status;

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE orders
       SET status = ?, customer_name = ?, customer_phone = ?, region = ?, district = ?,
           delivery_address = ?, delivery_instructions = ?, internal_notes = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      nextStatus,
      customerName ? String(customerName).trim() : existing.customer_name,
      customerPhone ? String(customerPhone).trim() : existing.customer_phone,
      region ? String(region).trim() : existing.region,
      district ? String(district).trim() : existing.district,
      deliveryAddress ? String(deliveryAddress).trim() : existing.delivery_address,
      deliveryInstructions !== undefined ? deliveryInstructions : existing.delivery_instructions,
      internalNotes !== undefined ? String(internalNotes) : existing.internal_notes,
      id
    );

    if (nextStatus !== existing.status) {
      db.prepare(`INSERT INTO order_history (order_id, status, note, changed_by) VALUES (?, ?, ?, ?)`).run(
        id,
        nextStatus,
        statusNote ? String(statusNote) : `Status updated to ${nextStatus}`,
        'Administrator'
      );

      // Restore stock if moving into Cancelled or Refunded from a non-cancelled state
      const wasCancelled = existing.status === 'Cancelled' || existing.status === 'Refunded';
      const nowCancelled = nextStatus === 'Cancelled' || nextStatus === 'Refunded';
      if (!wasCancelled && nowCancelled) {
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
        for (const it of items) {
          if (it.product_id) {
            const p = db.prepare('SELECT quantity FROM products WHERE id = ?').get(it.product_id) as any;
            if (p) {
              db.prepare(
                `UPDATE products SET quantity = quantity + ?, sales_count = MAX(0, sales_count - ?), is_available = 1 WHERE id = ?`
              ).run(it.quantity, it.quantity, it.product_id);
              db.prepare(
                `INSERT INTO inventory_logs (product_id, delta, previous_qty, new_qty, reason, actor_type, actor_id)
                 VALUES (?, ?, ?, ?, ?, 'admin', ?)`
              ).run(
                it.product_id,
                it.quantity,
                p.quantity,
                p.quantity + it.quantity,
                `Order ${existing.order_number} ${nextStatus}`,
                req.admin!.id
              );
            }
          }
        }
      }
    }
  });

  tx();

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
  const history = db.prepare('SELECT * FROM order_history WHERE order_id = ? ORDER BY id ASC').all(id);
  const fullOrder = { ...updated, items, history };

  sendToUser(updated.user_id, 'order:updated', fullOrder);
  sendToAdmins('order:updated', fullOrder);

  if (nextStatus !== existing.status) {
    for (const it of items) {
      if (it.product_id) {
        const p = db
          .prepare('SELECT p.*, c.name AS category_name FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = ?')
          .get(it.product_id);
        if (p) broadcastAll('product:updated', formatProductRow(p));
      }
    }

    createNotification({
      recipientRole: 'customer',
      recipientId: updated.user_id,
      type: 'order_status',
      title: `Order ${updated.order_number} — ${nextStatus}`,
      body: statusNote || `Your order status has been updated to ${nextStatus}.`,
      linkPage: `/orders/track/${updated.order_number}`,
      referenceId: updated.order_number,
    });
  }

  logSecurityEvent('admin', req.admin!.id, 'order.updated', 'order', updated.order_number, { status: nextStatus }, getClientIp(req));
  res.json({ order: fullOrder });
});

// Admin Messages (Customer Support Inbox)
adminRouter.get('/messages', requireAdminAuth, (_req, res) => {
  const conversations = db
    .prepare(
      `SELECT c.*, u.profile_id, u.full_name, u.phone, u.region, u.district, u.avatar_url, u.status AS user_status,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
              (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_role = 'customer' AND m.is_read = 0) AS unread_count
       FROM conversations c
       JOIN users u ON u.id = c.customer_id
       WHERE c.type = 'admin_support'
       ORDER BY c.last_message_at DESC`
    )
    .all();

  res.json({ conversations, presence: getPresenceSummary() });
});

adminRouter.get('/messages/:conversationId', requireAdminAuth, (req, res) => {
  const convId = Number(req.params.conversationId);
  db.prepare(
    `UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_role = 'customer' AND is_read = 0`
  ).run(convId);

  const conv = db
    .prepare(
      `SELECT c.*, u.profile_id, u.full_name, u.phone, u.region, u.district, u.avatar_url, u.status AS user_status
       FROM conversations c JOIN users u ON u.id = c.customer_id WHERE c.id = ?`
    )
    .get(convId);
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(convId);
  res.json({ conversation: conv, messages });
});

adminRouter.post('/messages/:conversationId', requireAdminAuth, (req: AuthedRequest, res) => {
  const convId = Number(req.params.conversationId);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId) as any;
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
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

  const info = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_role, sender_id, content, image_url)
       VALUES (?, 'admin', ?, ?, ?)`
    )
    .run(convId, req.admin!.id, content, imageUrl);

  db.prepare(`UPDATE conversations SET last_message_at = datetime('now') WHERE id = ?`).run(convId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid);

  sendToUser(conv.customer_id, 'chat:message', { conversationId: convId, message });
  sendToAdmins('chat:message', { conversationId: convId, message });

  createNotification({
    recipientRole: 'customer',
    recipientId: conv.customer_id,
    type: 'admin_reply',
    title: 'New Reply from X-MARKET Admin',
    body: content ? content.slice(0, 80) : 'Sent an image attachment',
    linkPage: '/support',
    referenceId: String(convId),
  });

  res.status(201).json({ message });
});

// Admin Notifications & Security Logs
adminRouter.get('/notifications', requireAdminAuth, (_req, res) => {
  const notifications = db
    .prepare(`SELECT * FROM notifications WHERE recipient_role = 'admin' ORDER BY id DESC LIMIT 50`)
    .all();
  res.json({ notifications });
});

adminRouter.post('/notifications/read-all', requireAdminAuth, (_req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_role = 'admin'`).run();
  res.json({ success: true });
});

adminRouter.get('/audit-logs', requireAdminAuth, (_req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  res.json({ logs });
});
