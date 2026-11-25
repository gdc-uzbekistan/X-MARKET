import crypto from 'crypto';
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, generateUniqueProfileId, UPLOADS_DIR } from '../db.ts';
import {
  AuthedRequest,
  checkRateLimit,
  createSession,
  getClientIp,
  hashPassword,
  hashToken,
  isSafeImageUrl,
  logSecurityEvent,
  optionalCustomerAuth,
  requireCustomerAuth,
  resetRateLimit,
  revokeSessionByToken,
  verifyPassword,
} from '../security.ts';

export const authRouter = Router();

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, '').trim();
}

// Secure image upload endpoint (base64 data URI -> local /uploads/<uuid>.<ext>)
authRouter.post('/uploads', optionalCustomerAuth, (req: AuthedRequest, res) => {
  if (!req.customer && !req.admin) {
    res.status(401).json({ error: 'Authentication required to upload files' });
    return;
  }
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image payload is required' });
    return;
  }

  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({ error: 'Only PNG, JPEG, and WebP base64 images are allowed' });
    return;
  }

  const mime = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(400).json({ error: 'Image size must not exceed 5 MB' });
    return;
  }

  const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const targetPath = path.resolve(UPLOADS_DIR, filename);
  if (!targetPath.startsWith(UPLOADS_DIR + path.sep)) {
    res.status(400).json({ error: 'Invalid upload path' });
    return;
  }

  fs.writeFileSync(targetPath, buffer);
  res.json({ url: `/uploads/${filename}` });
});

// Send OTP via configured SMS gateway (never fabricates SMS delivery if unconfigured)
authRouter.post('/auth/otp/send', async (req, res) => {
  const ip = getClientIp(req);
  const phone = normalizePhone(String(req.body?.phone || ''));
  const purpose = req.body?.purpose === 'reset' ? 'reset' : req.body?.purpose === 'verify' ? 'verify' : 'register';

  if (!phone || phone.length < 7 || phone.length > 20) {
    res.status(400).json({ error: 'Valid phone number is required' });
    return;
  }

  const rl = checkRateLimit(`otp:${ip}:${phone}`, 5, 10 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: `Too many OTP requests. Try again in ${rl.retryAfterSec}s.` });
    return;
  }

  if (purpose === 'reset') {
    const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
    if (!existing) {
      res.status(404).json({ error: 'No account found with this phone number' });
      return;
    }
  }

  const smsWebhook = process.env.SMS_WEBHOOK_URL?.trim();
  const smsApiKey = process.env.SMS_API_KEY?.trim();

  if (!smsWebhook) {
    res.json({
      sent: false,
      gatewayConfigured: false,
      message:
        'Live SMS gateway is not configured on the server (SMS_WEBHOOK_URL / SMS_API_KEY). You can still complete registration with pending phone verification.',
    });
    return;
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashToken(`${phone}:${code}`);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO otp_verifications (phone, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)`
  ).run(phone, codeHash, purpose, expiresAt);

  try {
    const gwRes = await fetch(smsWebhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(smsApiKey ? { Authorization: `Bearer ${smsApiKey}` } : {}),
      },
      body: JSON.stringify({
        phone,
        message: `Your X-MARKET verification code is ${code}. Valid for 5 minutes.`,
      }),
    });
    if (!gwRes.ok) {
      res.status(502).json({ error: 'SMS gateway rejected delivery request' });
      return;
    }
    res.json({ sent: true, gatewayConfigured: true, message: 'OTP code sent to your phone number.' });
  } catch {
    res.status(502).json({ error: 'Failed to reach configured SMS gateway' });
  }
});

authRouter.post('/auth/otp/verify', (req, res) => {
  const phone = normalizePhone(String(req.body?.phone || ''));
  const code = String(req.body?.code || '').trim();
  if (!phone || !code) {
    res.status(400).json({ error: 'Phone number and OTP code are required' });
    return;
  }

  const record = db
    .prepare(
      `SELECT * FROM otp_verifications
       WHERE phone = ? AND verified_at IS NULL
       ORDER BY id DESC LIMIT 1`
    )
    .get(phone) as any;

  if (!record) {
    res.status(400).json({ error: 'No active OTP verification found for this number' });
    return;
  }
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    res.status(400).json({ error: 'OTP code has expired' });
    return;
  }
  if (record.attempts >= 5) {
    res.status(429).json({ error: 'Maximum verification attempts exceeded' });
    return;
  }

  const candidateHash = hashToken(`${phone}:${code}`);
  if (candidateHash !== record.code_hash) {
    db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    res.status(400).json({ error: 'Invalid OTP code' });
    return;
  }

  db.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`).run(record.id);
  db.prepare(`UPDATE users SET phone_verified = 1, updated_at = datetime('now') WHERE phone = ?`).run(phone);
  res.json({ verified: true });
});

// Registration
authRouter.post('/auth/register', async (req, res) => {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`register:${ip}`, 10, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: `Too many registration attempts. Try again in ${rl.retryAfterSec}s.` });
    return;
  }

  const {
    fullName,
    phone: rawPhone,
    password,
    confirmPassword,
    region,
    district,
    avatarUrl,
    latitude,
    longitude,
    locationAddress,
    otpCode,
  } = req.body || {};

  const phone = normalizePhone(String(rawPhone || ''));
  if (!fullName || String(fullName).trim().length < 2) {
    res.status(400).json({ error: 'Full name must be at least 2 characters' });
    return;
  }
  if (!phone || phone.length < 7 || phone.length > 20) {
    res.status(400).json({ error: 'Valid phone number is required' });
    return;
  }
  if (!password || String(password).length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ error: 'Passwords do not match' });
    return;
  }
  if (!region || !district) {
    res.status(400).json({ error: 'Region and district are required' });
    return;
  }
  if (avatarUrl && !isSafeImageUrl(avatarUrl)) {
    res.status(400).json({ error: 'Invalid avatar URL' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    res.status(409).json({ error: 'An account with this phone number already exists' });
    return;
  }

  let phoneVerified = 0;
  const smsConfigured = Boolean(process.env.SMS_WEBHOOK_URL?.trim());
  if (smsConfigured) {
    if (!otpCode) {
      res.status(400).json({ error: 'OTP verification code is required' });
      return;
    }
    const otpRec = db
      .prepare(
        `SELECT * FROM otp_verifications WHERE phone = ? AND purpose = 'register' AND verified_at IS NULL ORDER BY id DESC LIMIT 1`
      )
      .get(phone) as any;
    if (!otpRec || new Date(otpRec.expires_at).getTime() <= Date.now()) {
      res.status(400).json({ error: 'Valid non-expired OTP code is required' });
      return;
    }
    if (hashToken(`${phone}:${String(otpCode).trim()}`) !== otpRec.code_hash) {
      res.status(400).json({ error: 'Invalid OTP verification code' });
      return;
    }
    db.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`).run(otpRec.id);
    phoneVerified = 1;
  }

  const passwordHash = await hashPassword(String(password));
  const profileId = generateUniqueProfileId();

  // Customers NEVER receive administrator privileges through registration
  const info = db
    .prepare(
      `INSERT INTO users (profile_id, full_name, phone, password_hash, region, district, avatar_url, latitude, longitude, location_address, phone_verified, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer', 'active')`
    )
    .run(
      profileId,
      String(fullName).trim(),
      phone,
      passwordHash,
      String(region).trim(),
      String(district).trim(),
      avatarUrl || null,
      typeof latitude === 'number' ? latitude : null,
      typeof longitude === 'number' ? longitude : null,
      locationAddress ? String(locationAddress).trim() : null,
      phoneVerified
    );

  const userId = Number(info.lastInsertRowid);
  const { token } = createSession('customer', userId, req);
  logSecurityEvent('customer', userId, 'user.register', 'user', String(userId), { profile_id: profileId }, ip);

  const user = db
    .prepare(
      `SELECT id, profile_id, full_name, phone, region, district, avatar_url, latitude, longitude, location_address, phone_verified, role, status, permissions_json, created_at
       FROM users WHERE id = ?`
    )
    .get(userId) as any;

  res.status(201).json({
    token,
    user: {
      ...user,
      permissions: JSON.parse(user.permissions_json),
    },
  });
});

// Upload avatar during registration (allowed unauthenticated strictly for registration flow with strict size/mime limit)
authRouter.post('/auth/register-avatar', (req, res) => {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`reg-avatar:${ip}`, 10, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    res.status(429).json({ error: 'Too many upload requests' });
    return;
  }
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || typeof dataUrl !== 'string') {
    res.status(400).json({ error: 'Image payload required' });
    return;
  }
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    res.status(400).json({ error: 'Only PNG, JPEG, or WebP images are supported' });
    return;
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 2 * 1024 * 1024) {
    res.status(400).json({ error: 'Profile picture must be under 2 MB' });
    return;
  }
  const ext = match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg';
  const filename = `avatar-${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.resolve(UPLOADS_DIR, filename), buffer);
  res.json({ url: `/uploads/${filename}` });
});

// Login
authRouter.post('/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  const phone = normalizePhone(String(req.body?.phone || ''));
  const password = String(req.body?.password || '');

  const rlKey = `login:${ip}:${phone}`;
  const rl = checkRateLimit(rlKey, 8, 15 * 60 * 1000, 15 * 60 * 1000);
  if (!rl.allowed) {
    logSecurityEvent('guest', null, 'user.login_rate_limited', 'phone', phone, null, ip);
    res.status(429).json({ error: `Too many failed login attempts. Try again in ${rl.retryAfterSec}s.` });
    return;
  }

  if (!phone || !password) {
    res.status(400).json({ error: 'Phone number and password are required' });
    return;
  }

  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any;
  if (!user) {
    res.status(401).json({ error: 'Invalid phone number or password' });
    return;
  }

  if (user.status === 'suspended') {
    logSecurityEvent('customer', user.id, 'user.login_suspended', 'user', String(user.id), null, ip);
    res.status(403).json({ error: 'This account has been suspended. Please contact the administrator.' });
    return;
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    logSecurityEvent('guest', null, 'user.login_failed', 'user', String(user.id), null, ip);
    res.status(401).json({ error: 'Invalid phone number or password' });
    return;
  }

  resetRateLimit(rlKey);
  const { token } = createSession('customer', user.id, req);
  logSecurityEvent('customer', user.id, 'user.login', 'user', String(user.id), null, ip);

  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      profile_id: user.profile_id,
      full_name: user.full_name,
      phone: user.phone,
      region: user.region,
      district: user.district,
      avatar_url: user.avatar_url,
      latitude: user.latitude,
      longitude: user.longitude,
      location_address: user.location_address,
      phone_verified: user.phone_verified,
      role: user.role,
      status: user.status,
      permissions: JSON.parse(user.permissions_json || '{}'),
      created_at: user.created_at,
      seller: seller || null,
    },
  });
});

// Password recovery via OTP (when SMS gateway is configured)
authRouter.post('/auth/reset-password', async (req, res) => {
  const ip = getClientIp(req);
  const phone = normalizePhone(String(req.body?.phone || ''));
  const otpCode = String(req.body?.otpCode || '').trim();
  const newPassword = String(req.body?.newPassword || '');

  if (!phone || !otpCode || newPassword.length < 6) {
    res.status(400).json({ error: 'Phone, OTP code, and a new password (min 6 chars) are required' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) as { id: number } | undefined;
  if (!user) {
    res.status(404).json({ error: 'Account not found' });
    return;
  }

  const otpRec = db
    .prepare(
      `SELECT * FROM otp_verifications WHERE phone = ? AND purpose = 'reset' AND verified_at IS NULL ORDER BY id DESC LIMIT 1`
    )
    .get(phone) as any;

  if (!otpRec || new Date(otpRec.expires_at).getTime() <= Date.now()) {
    res.status(400).json({ error: 'No valid OTP verification found or OTP expired' });
    return;
  }

  if (hashToken(`${phone}:${otpCode}`) !== otpRec.code_hash) {
    db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').run(otpRec.id);
    res.status(400).json({ error: 'Invalid OTP code' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  db.prepare(`UPDATE otp_verifications SET verified_at = datetime('now') WHERE id = ?`).run(otpRec.id);
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(passwordHash, user.id);
  db.prepare(`UPDATE sessions SET revoked = 1 WHERE actor_type = 'customer' AND actor_id = ?`).run(user.id);
  logSecurityEvent('customer', user.id, 'user.password_reset', 'user', String(user.id), null, ip);

  res.json({ success: true });
});

authRouter.post('/auth/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    revokeSessionByToken(header.slice(7).trim());
  }
  res.json({ success: true });
});

authRouter.get('/auth/me', requireCustomerAuth, (req: AuthedRequest, res) => {
  const seller = db.prepare('SELECT * FROM sellers WHERE user_id = ?').get(req.customer!.id);
  res.json({ user: { ...req.customer, seller: seller || null } });
});

authRouter.put('/auth/profile', requireCustomerAuth, (req: AuthedRequest, res) => {
  const { fullName, region, district, avatarUrl, latitude, longitude, locationAddress } = req.body || {};
  if (!fullName || String(fullName).trim().length < 2) {
    res.status(400).json({ error: 'Full name is required' });
    return;
  }
  if (avatarUrl && !isSafeImageUrl(avatarUrl)) {
    res.status(400).json({ error: 'Invalid avatar URL' });
    return;
  }

  db.prepare(
    `UPDATE users
     SET full_name = ?, region = ?, district = ?, avatar_url = ?, latitude = ?, longitude = ?, location_address = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    String(fullName).trim(),
    String(region || req.customer!.region).trim(),
    String(district || req.customer!.district).trim(),
    avatarUrl !== undefined ? avatarUrl : req.customer!.avatar_url,
    typeof latitude === 'number' ? latitude : req.customer!.latitude,
    typeof longitude === 'number' ? longitude : req.customer!.longitude,
    locationAddress !== undefined ? locationAddress : req.customer!.location_address,
    req.customer!.id
  );

  const updated = db
    .prepare(
      `SELECT id, profile_id, full_name, phone, region, district, avatar_url, latitude, longitude, location_address, phone_verified, role, status, permissions_json
       FROM users WHERE id = ?`
    )
    .get(req.customer!.id) as any;

  res.json({ user: { ...updated, permissions: JSON.parse(updated.permissions_json) } });
});

authRouter.post('/auth/change-password', requireCustomerAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || String(newPassword).length < 6) {
    res.status(400).json({ error: 'Current password and new password (min 6 chars) are required' });
    return;
  }
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.customer!.id) as { password_hash: string };
  const valid = await verifyPassword(String(currentPassword), user.password_hash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  const newHash = await hashPassword(String(newPassword));
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`).run(newHash, req.customer!.id);
  logSecurityEvent('customer', req.customer!.id, 'user.password_changed', 'user', String(req.customer!.id), null, getClientIp(req));
  res.json({ success: true });
});

authRouter.get('/auth/sessions', requireCustomerAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(
      `SELECT id, user_agent, ip_address, expires_at, revoked, created_at
       FROM sessions WHERE actor_type = 'customer' AND actor_id = ? AND revoked = 0
       ORDER BY created_at DESC`
    )
    .all(req.customer!.id) as any[];
  res.json({
    sessions: rows.map((s) => ({ ...s, isCurrent: s.id === req.customer!.session_id })),
  });
});

authRouter.delete('/auth/sessions/:id', requireCustomerAuth, (req: AuthedRequest, res) => {
  db.prepare(
    `UPDATE sessions SET revoked = 1 WHERE id = ? AND actor_type = 'customer' AND actor_id = ?`
  ).run(req.params.id, req.customer!.id);
  res.json({ success: true });
});

// Delivery addresses
authRouter.get('/addresses', requireCustomerAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM delivery_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC')
    .all(req.customer!.id);
  res.json({ addresses: rows });
});

authRouter.post('/addresses', requireCustomerAuth, (req: AuthedRequest, res) => {
  const { label, region, district, fullAddress, instructions, latitude, longitude, isDefault } = req.body || {};
  if (!label || !region || !district || !fullAddress) {
    res.status(400).json({ error: 'Label, region, district, and full address are required' });
    return;
  }
  if (isDefault) {
    db.prepare('UPDATE delivery_addresses SET is_default = 0 WHERE user_id = ?').run(req.customer!.id);
  }
  const info = db
    .prepare(
      `INSERT INTO delivery_addresses (user_id, label, region, district, full_address, instructions, latitude, longitude, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.customer!.id,
      String(label).trim(),
      String(region).trim(),
      String(district).trim(),
      String(fullAddress).trim(),
      instructions ? String(instructions).trim() : null,
      typeof latitude === 'number' ? latitude : null,
      typeof longitude === 'number' ? longitude : null,
      isDefault ? 1 : 0
    );
  const created = db.prepare('SELECT * FROM delivery_addresses WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ address: created });
});

authRouter.delete('/addresses/:id', requireCustomerAuth, (req: AuthedRequest, res) => {
  db.prepare('DELETE FROM delivery_addresses WHERE id = ? AND user_id = ?').run(req.params.id, req.customer!.id);
  res.json({ success: true });
});
