import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : EPHEMERAL_SECRET;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function constantTimeEquals(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

export function hashToken(token: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(token).digest('hex');
}

export function createSession(
  actorType: 'customer' | 'admin',
  actorId: number,
  req: Request,
  ttlHours = 24 * 7
): { token: string; sessionId: string; expiresAt: string } {
  const sessionId = crypto.randomUUID();
  const rawToken = `${sessionId}.${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString();
  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || '').slice(0, 240);

  db.prepare(
    `INSERT INTO sessions (id, actor_type, actor_id, token_hash, user_agent, ip_address, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, actorType, actorId, tokenHash, ua, ip, expiresAt);

  return { token: rawToken, sessionId, expiresAt };
}

export function revokeSessionByToken(rawToken: string): void {
  const tokenHash = hashToken(rawToken);
  db.prepare('UPDATE sessions SET revoked = 1 WHERE token_hash = ?').run(tokenHash);
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

// In-memory rate limiter for authentication & sensitive endpoints
const rateBuckets = new Map<string, { count: number; resetAt: number; blockedUntil?: number }>();

export function checkRateLimit(
  bucketKey: string,
  maxAttempts = 8,
  windowMs = 15 * 60 * 1000,
  blockMs = 15 * 60 * 1000
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const entry = rateBuckets.get(bucketKey);

  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.blockedUntil - now) / 1000) };
  }

  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  entry.count += 1;
  if (entry.count > maxAttempts) {
    entry.blockedUntil = now + blockMs;
    return { allowed: false, retryAfterSec: Math.ceil(blockMs / 1000) };
  }
  return { allowed: true };
}

export function resetRateLimit(bucketKey: string): void {
  rateBuckets.delete(bucketKey);
}

export function logSecurityEvent(
  actorRole: string,
  actorId: number | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: Record<string, unknown> | null,
  ipAddress: string
): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (actor_role, actor_id, action, target_type, target_id, details_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      actorRole,
      actorId,
      action,
      targetType,
      targetId,
      details ? JSON.stringify(details) : null,
      ipAddress
    );
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

export interface AuthCustomer {
  id: number;
  profile_id: string;
  full_name: string;
  phone: string;
  region: string;
  district: string;
  avatar_url: string | null;
  latitude: number | null;
  longitude: number | null;
  location_address: string | null;
  phone_verified: number;
  role: string;
  status: string;
  permissions: { can_order: boolean; can_chat: boolean; can_review: boolean };
  session_id: string;
}

export interface AuthAdmin {
  id: number;
  username: string;
  full_name: string;
  telegram_handle: string;
  session_id: string;
}

export interface AuthedRequest extends Request {
  customer?: AuthCustomer;
  admin?: AuthAdmin;
}

export function resolveToken(rawToken: string): {
  actorType: 'customer' | 'admin';
  sessionId: string;
  customer?: AuthCustomer;
  admin?: AuthAdmin;
} | null {
  if (!rawToken || !rawToken.includes('.')) return null;
  const tokenHash = hashToken(rawToken);
  const session = db
    .prepare(
      `SELECT id, actor_type, actor_id, expires_at, revoked
       FROM sessions WHERE token_hash = ?`
    )
    .get(tokenHash) as
    | { id: string; actor_type: 'customer' | 'admin'; actor_id: number; expires_at: string; revoked: number }
    | undefined;

  if (!session || session.revoked) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) return null;

  if (session.actor_type === 'customer') {
    const user = db
      .prepare(
        `SELECT id, profile_id, full_name, phone, region, district, avatar_url, latitude, longitude,
                location_address, phone_verified, role, status, permissions_json
         FROM users WHERE id = ?`
      )
      .get(session.actor_id) as any;

    if (!user || user.status !== 'active') return null;

    let permissions = { can_order: true, can_chat: true, can_review: true };
    try {
      permissions = { ...permissions, ...JSON.parse(user.permissions_json || '{}') };
    } catch {
      // default permissions
    }

    return {
      actorType: 'customer',
      sessionId: session.id,
      customer: {
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
        permissions,
        session_id: session.id,
      },
    };
  }

  const admin = db
    .prepare(`SELECT id, username, full_name, telegram_handle FROM admins WHERE id = ?`)
    .get(session.actor_id) as any;

  if (!admin) return null;
  return {
    actorType: 'admin',
    sessionId: session.id,
    admin: {
      id: admin.id,
      username: admin.username,
      full_name: admin.full_name,
      telegram_handle: admin.telegram_handle,
      session_id: session.id,
    },
  };
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export function optionalCustomerAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (token) {
    const resolved = resolveToken(token);
    if (resolved?.actorType === 'customer' && resolved.customer) {
      req.customer = resolved.customer;
    } else if (resolved?.actorType === 'admin' && resolved.admin) {
      req.admin = resolved.admin;
    }
  }
  next();
}

export function requireCustomerAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const resolved = resolveToken(token);
  if (!resolved || resolved.actorType !== 'customer' || !resolved.customer) {
    res.status(401).json({ error: 'Invalid or expired customer session' });
    return;
  }
  req.customer = resolved.customer;
  next();
}

export function requireAdminAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Administrator authentication required' });
    return;
  }
  const resolved = resolveToken(token);
  if (!resolved || resolved.actorType !== 'admin' || !resolved.admin) {
    res.status(403).json({ error: 'Administrator privileges required' });
    return;
  }
  req.admin = resolved.admin;
  next();
}

export function isSafeImageUrl(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith('/uploads/') || url.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}
