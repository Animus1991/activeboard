import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, refreshTokens } from '../db/schema.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashToken,
  authMiddleware,
} from '../middleware/auth.js';
import type { AppVariables } from '../types.js';

const auth = new Hono<{ Variables: AppVariables }>();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
  password: z.string().min(8).max(100),
  displayName: z.string().min(1).max(100).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// POST /auth/register
auth.post('/register', zValidator('json', registerSchema), async (c) => {
  const { email, username, password, displayName } = c.req.valid('json');

  // Check if user exists
  const existingUser = await db.query.users.findFirst({
    where: (users, { or, eq }) => or(eq(users.email, email), eq(users.username, username)),
  });

  if (existingUser) {
    const field = existingUser.email === email ? 'email' : 'username';
    return c.json({ success: false, error: `User with this ${field} already exists` }, 409);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 12);

  // Create user
  const [user] = await db.insert(users).values({
    email,
    username,
    passwordHash,
    displayName: displayName || username,
  }).returning();

  // Generate tokens
  const accessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin ?? false,
  });

  const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id);
  const tokenHash = await hashToken(refreshToken);

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
      },
      accessToken,
      refreshToken,
    },
  }, 201);
});

// POST /auth/login
auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');

  // Find user
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  if (user.isBanned) {
    return c.json({ success: false, error: 'Account is banned' }, 403);
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return c.json({ success: false, error: 'Invalid credentials' }, 401);
  }

  // Update last login
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  // Generate tokens
  const accessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin ?? false,
  });

  const { token: refreshToken, expiresAt } = await generateRefreshToken(user.id);
  const tokenHash = await hashToken(refreshToken);

  // Store refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  return c.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
      accessToken,
      refreshToken,
    },
  });
});

// POST /auth/refresh
auth.post('/refresh', zValidator('json', refreshSchema), async (c) => {
  const { refreshToken } = c.req.valid('json');

  // Verify refresh token
  const payload = await verifyToken(refreshToken);
  if (!payload || (payload as { type?: string }).type !== 'refresh') {
    return c.json({ success: false, error: 'Invalid refresh token' }, 401);
  }

  // Check if token exists and is not revoked
  const tokenHash = await hashToken(refreshToken);
  const storedToken = await db.query.refreshTokens.findFirst({
    where: (tokens, { and, eq, isNull }) =>
      and(eq(tokens.tokenHash, tokenHash), isNull(tokens.revokedAt)),
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    return c.json({ success: false, error: 'Refresh token expired or revoked' }, 401);
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, storedToken.userId),
  });

  if (!user || user.isBanned) {
    return c.json({ success: false, error: 'User not found or banned' }, 401);
  }

  // Revoke old refresh token
  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.id, storedToken.id));

  // Generate new tokens
  const accessToken = await generateAccessToken({
    sub: user.id,
    email: user.email,
    username: user.username,
    isAdmin: user.isAdmin ?? false,
  });

  const { token: newRefreshToken, expiresAt } = await generateRefreshToken(user.id);
  const newTokenHash = await hashToken(newRefreshToken);

  // Store new refresh token
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt,
  });

  return c.json({
    success: true,
    data: {
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

// POST /auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Revoke all refresh tokens for user
  await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.userId, userId!));

  return c.json({ success: true, message: 'Logged out successfully' });
});

// GET /auth/me
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId!),
  });

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      preferredGameSystems: user.preferredGameSystems,
      vrHeadset: user.vrHeadset,
      timezone: user.timezone,
      totalGamesPlayed: user.totalGamesPlayed,
      totalPlayTimeMinutes: user.totalPlayTimeMinutes,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
    },
  });
});

export default auth;
