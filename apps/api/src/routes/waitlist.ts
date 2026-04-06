import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { waitlistEntries } from '../db/schema.js';
import { generateReferralCode } from '../types.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { AppVariables } from '../types.js';

const waitlist = new Hono<{ Variables: AppVariables }>();

// Validation schemas
const joinWaitlistSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100).optional(),
  primaryInterest: z.enum(['wargaming', 'rpg', 'boardgames', 'all']).optional(),
  currentPlatforms: z.array(z.string()).optional(),
  hasVrHeadset: z.boolean().optional(),
  vrHeadsetType: z.string().optional(),
  playFrequency: z.enum(['daily', 'weekly', 'monthly', 'rarely']).optional(),
  biggestPainPoint: z.string().max(1000).optional(),
  willingToPay: z.enum(['yes', 'maybe', 'no']).optional(),
  referredBy: z.string().optional(),
});

// POST /waitlist - Join the waitlist
waitlist.post('/', zValidator('json', joinWaitlistSchema), async (c) => {
  const data = c.req.valid('json');

  // Check if already on waitlist
  const existing = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.email, data.email),
  });

  if (existing) {
    return c.json({
      success: true,
      message: 'You are already on the waitlist!',
      data: {
        position: existing.priority,
        referralCode: existing.referralCode,
      },
    });
  }

  // Calculate priority based on survey completion and referral
  let priority = 0;
  if (data.primaryInterest === 'wargaming') priority += 10; // Target segment
  if (data.hasVrHeadset) priority += 5;
  if (data.willingToPay === 'yes') priority += 5;
  if (data.biggestPainPoint && data.biggestPainPoint.length > 50) priority += 3;

  // Handle referral
  if (data.referredBy) {
    const referrer = await db.query.waitlistEntries.findFirst({
      where: eq(waitlistEntries.referralCode, data.referredBy),
    });

    if (referrer) {
      priority += 2;
      // Increment referrer's count and priority
      await db.update(waitlistEntries)
        .set({
          referralCount: sql`${waitlistEntries.referralCount} + 1`,
          priority: sql`${waitlistEntries.priority} + 3`,
        })
        .where(eq(waitlistEntries.id, referrer.id));
    }
  }

  // Generate unique referral code
  let referralCode = generateReferralCode();
  let attempts = 0;
  while (attempts < 5) {
    const existingCode = await db.query.waitlistEntries.findFirst({
      where: eq(waitlistEntries.referralCode, referralCode),
    });
    if (!existingCode) break;
    referralCode = generateReferralCode();
    attempts++;
  }

  // Create entry
  const [entry] = await db.insert(waitlistEntries).values({
    email: data.email,
    name: data.name,
    primaryInterest: data.primaryInterest,
    currentPlatforms: data.currentPlatforms || [],
    hasVrHeadset: data.hasVrHeadset,
    vrHeadsetType: data.vrHeadsetType,
    playFrequency: data.playFrequency,
    biggestPainPoint: data.biggestPainPoint,
    willingToPay: data.willingToPay,
    referralCode,
    referredBy: data.referredBy,
    priority,
  }).returning();

  return c.json({
    success: true,
    message: 'Welcome to the TableForge waitlist!',
    data: {
      position: priority,
      referralCode: entry.referralCode,
      referralLink: `https://tableforge.gg/waitlist?ref=${entry.referralCode}`,
    },
  }, 201);
});

// GET /waitlist/stats - Public stats
waitlist.get('/stats', async (c) => {
  const result = await db.select({
    total: sql<number>`count(*)`,
    wargamers: sql<number>`count(*) filter (where ${waitlistEntries.primaryInterest} = 'wargaming')`,
    withVr: sql<number>`count(*) filter (where ${waitlistEntries.hasVrHeadset} = true)`,
    willingToPay: sql<number>`count(*) filter (where ${waitlistEntries.willingToPay} = 'yes')`,
  }).from(waitlistEntries);

  const stats = result[0];

  return c.json({
    success: true,
    data: {
      totalSignups: Number(stats.total),
      wargamerPercentage: stats.total > 0 ? Math.round((Number(stats.wargamers) / Number(stats.total)) * 100) : 0,
      vrOwnershipPercentage: stats.total > 0 ? Math.round((Number(stats.withVr) / Number(stats.total)) * 100) : 0,
    },
  });
});

// GET /waitlist/check/:email - Check waitlist status
waitlist.get('/check/:email', async (c) => {
  const email = c.req.param('email');

  const entry = await db.query.waitlistEntries.findFirst({
    where: eq(waitlistEntries.email, email),
  });

  if (!entry) {
    return c.json({ success: true, data: { onWaitlist: false } });
  }

  return c.json({
    success: true,
    data: {
      onWaitlist: true,
      status: entry.status,
      referralCode: entry.referralCode,
      referralCount: entry.referralCount,
      priority: entry.priority,
    },
  });
});

// Admin routes
waitlist.use('/admin/*', authMiddleware, adminMiddleware);

// GET /waitlist/admin/entries - List all entries (admin)
waitlist.get('/admin/entries', async (c) => {
  const entries = await db.query.waitlistEntries.findMany({
    orderBy: (entries, { desc }) => [desc(entries.priority), desc(entries.createdAt)],
  });

  return c.json({
    success: true,
    data: entries,
  });
});

// POST /waitlist/admin/invite/:id - Send invite (admin)
waitlist.post('/admin/invite/:id', async (c) => {
  const id = c.req.param('id');

  const [updated] = await db.update(waitlistEntries)
    .set({
      status: 'invited',
      invitedAt: new Date(),
    })
    .where(eq(waitlistEntries.id, id))
    .returning();

  if (!updated) {
    return c.json({ success: false, error: 'Entry not found' }, 404);
  }

  // TODO: Send actual invite email

  return c.json({
    success: true,
    message: 'Invite sent',
    data: updated,
  });
});

export default waitlist;
