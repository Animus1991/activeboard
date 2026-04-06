import { createMiddleware } from 'hono/factory';
import * as jose from 'jose';
import type { AppVariables, JWTPayload } from '../types.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'tableforge-dev-secret-change-in-production'
);

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// Parse duration string to seconds
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

// Generate access token
export async function generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): Promise<string> {
  const jwt = await new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(JWT_SECRET);
  
  return jwt;
}

// Generate refresh token
export async function generateRefreshToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresInSeconds = parseDuration(JWT_REFRESH_EXPIRES_IN);
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  
  const jwt = await new jose.SignJWT({ sub: userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_REFRESH_EXPIRES_IN)
    .sign(JWT_SECRET);
  
  return { token: jwt, expiresAt };
}

// Verify token
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

// Hash token for storage
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Auth middleware - requires authentication
export const authMiddleware = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.slice(7);
  const payload = await verifyToken(token);
  
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
  
  c.set('user', payload);
  c.set('userId', payload.sub);
  
  await next();
});

// Optional auth middleware - doesn't require authentication but sets user if present
export const optionalAuthMiddleware = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    
    if (payload) {
      c.set('user', payload);
      c.set('userId', payload.sub);
    }
  }
  
  await next();
});

// Admin middleware - requires admin role
export const adminMiddleware = createMiddleware<{ Variables: AppVariables }>(async (c, next) => {
  const user = c.get('user');
  
  if (!user || !user.isAdmin) {
    return c.json({ success: false, error: 'Forbidden: Admin access required' }, 403);
  }
  
  await next();
});
