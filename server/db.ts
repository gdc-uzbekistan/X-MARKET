import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'xmarket.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      region TEXT NOT NULL,
      district TEXT NOT NULL,
      avatar_url TEXT,
      latitude REAL,
      longitude REAL,
      location_address TEXT,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'customer',
      status TEXT NOT NULL DEFAULT 'active',
      permissions_json TEXT NOT NULL DEFAULT '{"can_order":true,"can_chat":true,"can_review":true}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT 'X-MARKET Administrator',
      telegram_handle TEXT NOT NULL DEFAULT 'https://t.me/RAHMATAL1EV',
      password_changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('customer', 'admin')),
      actor_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      user_agent TEXT,
      ip_address TEXT,
      expires_at TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      purpose TEXT NOT NULL CHECK(purpose IN ('register', 'reset', 'verify')),
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      image_url TEXT,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      store_name TEXT NOT NULL,
      description TEXT,
      phone TEXT,
      region TEXT,
      district TEXT,
      authorized_by_admin INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      original_price REAL NOT NULL CHECK(original_price >= 0),
      discounted_price REAL CHECK(discounted_price IS NULL OR discounted_price >= 0),
      discount_percent REAL NOT NULL DEFAULT 0,
      weight TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 0 CHECK(quantity >= 0),
      is_available INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      specs_json TEXT NOT NULL DEFAULT '[]',
      tags_json TEXT NOT NULL DEFAULT '[]',
      sales_count INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      previous_qty INTEGER NOT NULL,
      new_qty INTEGER NOT NULL,
      reason TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      UNIQUE(cart_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL CHECK(discount_type IN ('percent', 'fixed')),
      discount_value REAL NOT NULL CHECK(discount_value > 0),
      min_order_amount REAL NOT NULL DEFAULT 0,
      max_discount REAL,
      expires_at TEXT,
      usage_limit INTEGER,
      per_customer_limit INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      applicable_category_ids_json TEXT NOT NULL DEFAULT '[]',
      applicable_product_ids_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS promo_code_usages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      promo_code_id INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL,
      used_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS delivery_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      region TEXT NOT NULL,
      district TEXT NOT NULL,
      full_address TEXT NOT NULL,
      instructions TEXT,
      latitude REAL,
      longitude REAL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      region TEXT NOT NULL,
      district TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      delivery_instructions TEXT,
      latitude REAL,
      longitude REAL,
      subtotal REAL NOT NULL,
      item_discount_total REAL NOT NULL DEFAULT 0,
      promo_code TEXT,
      promo_discount REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','Confirmed','Processing','Shipped','Delivered','Cancelled','Refunded')),
      internal_notes TEXT DEFAULT '',
      idempotency_key TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE SET NULL,
      product_name TEXT NOT NULL,
      product_image TEXT,
      unit_original_price REAL NOT NULL,
      unit_price REAL NOT NULL,
      weight TEXT,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      line_total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      note TEXT,
      changed_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('admin_support', 'seller_chat')),
      customer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      last_message_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL CHECK(sender_role IN ('customer', 'admin', 'seller')),
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipient_role TEXT NOT NULL CHECK(recipient_role IN ('customer', 'admin')),
      recipient_id INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link_page TEXT,
      reference_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_role TEXT NOT NULL,
      actor_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      details_json TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_role, recipient_id, is_read);
  `);
}

export function generateUniqueProfileId(): string {
  const checkStmt = db.prepare('SELECT 1 FROM users WHERE profile_id = ?');
  for (let i = 0; i < 50; i++) {
    const id = String(crypto.randomInt(100000, 1000000));
    if (!checkStmt.get(id)) {
      return id;
    }
  }
  throw new Error('Unable to allocate unique 6-digit profile ID');
}

export function generateUniqueOrderNumber(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const checkStmt = db.prepare('SELECT 1 FROM orders WHERE order_number = ?');
  for (let i = 0; i < 50; i++) {
    const l1 = letters[crypto.randomInt(0, letters.length)];
    const l2 = letters[crypto.randomInt(0, letters.length)];
    const digits = String(crypto.randomInt(0, 100000000)).padStart(8, '0');
    const orderNumber = `${l1}${l2}${digits}`;
    if (!checkStmt.get(orderNumber)) {
      return orderNumber;
    }
  }
  throw new Error('Unable to allocate unique order number');
}

export function createSlug(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}
