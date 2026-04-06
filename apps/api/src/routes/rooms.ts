import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, or, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { gameRooms, gameRoomPlayers, gameSystems } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { generateRoomCode } from '../types.js';
import type { AppVariables } from '../types.js';

const rooms = new Hono<{ Variables: AppVariables }>();

// All routes require authentication
rooms.use('*', authMiddleware);

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  gameSystemId: z.string().uuid(),
  maxPlayers: z.number().min(2).max(8).default(4),
  pointsLimit: z.number().min(100).max(10000).default(1000),
  isPrivate: z.boolean().default(true),
  password: z.string().max(100).optional(),
});

const joinRoomSchema = z.object({
  password: z.string().optional(),
});

// GET /rooms - List user's rooms
rooms.get('/', async (c) => {
  const userId = c.get('userId')!;

  // Get rooms where user is host or player
  const userRooms = await db.query.gameRoomPlayers.findMany({
    where: and(
      eq(gameRoomPlayers.userId, userId),
      isNull(gameRoomPlayers.leftAt)
    ),
    with: {
      room: {
        with: {
          host: true,
          gameSystem: true,
          players: {
            where: isNull(gameRoomPlayers.leftAt),
            with: {
              user: true,
            },
          },
        },
      },
    },
  });

  const roomsData = userRooms.map(rp => ({
    ...rp.room,
    isHost: rp.room.hostId === userId,
    myStatus: {
      isReady: rp.isReady,
      deviceType: rp.deviceType,
    },
  }));

  return c.json({
    success: true,
    data: roomsData,
  });
});

// POST /rooms - Create a new room
rooms.post('/', zValidator('json', createRoomSchema), async (c) => {
  const userId = c.get('userId')!;
  const data = c.req.valid('json');

  // Verify game system exists
  const gameSystem = await db.query.gameSystems.findFirst({
    where: eq(gameSystems.id, data.gameSystemId),
  });

  if (!gameSystem) {
    return c.json({ success: false, error: 'Game system not found' }, 404);
  }

  // Generate unique room code
  let code = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.query.gameRooms.findFirst({
      where: eq(gameRooms.code, code),
    });
    if (!existing) break;
    code = generateRoomCode();
    attempts++;
  }

  // Create room
  const [room] = await db.insert(gameRooms).values({
    code,
    hostId: userId,
    gameSystemId: data.gameSystemId,
    name: data.name,
    description: data.description,
    maxPlayers: data.maxPlayers,
    pointsLimit: data.pointsLimit,
    isPrivate: data.isPrivate,
    password: data.password,
    status: 'waiting',
  }).returning();

  // Add host as first player
  await db.insert(gameRoomPlayers).values({
    roomId: room.id,
    userId,
    isReady: false,
    isConnected: true,
    turnOrder: 1,
  });

  return c.json({
    success: true,
    data: {
      ...room,
      gameSystem,
    },
  }, 201);
});

// GET /rooms/code/:code - Get room by code
rooms.get('/code/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.code, code),
    with: {
      host: true,
      gameSystem: true,
      players: {
        where: isNull(gameRoomPlayers.leftAt),
        with: {
          user: true,
          armyList: true,
        },
      },
    },
  });

  if (!room) {
    return c.json({ success: false, error: 'Room not found' }, 404);
  }

  // Don't expose password
  const { password, ...roomData } = room;

  return c.json({
    success: true,
    data: {
      ...roomData,
      hasPassword: !!password,
    },
  });
});

// GET /rooms/:id - Get room details
rooms.get('/:id', async (c) => {
  const id = c.req.param('id');

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, id),
    with: {
      host: true,
      gameSystem: true,
      players: {
        where: isNull(gameRoomPlayers.leftAt),
        with: {
          user: true,
          armyList: true,
        },
      },
    },
  });

  if (!room) {
    return c.json({ success: false, error: 'Room not found' }, 404);
  }

  const { password, ...roomData } = room;

  return c.json({
    success: true,
    data: {
      ...roomData,
      hasPassword: !!password,
    },
  });
});

// POST /rooms/:id/join - Join a room
rooms.post('/:id/join', zValidator('json', joinRoomSchema), async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;
  const { password } = c.req.valid('json');

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, id),
    with: {
      players: {
        where: isNull(gameRoomPlayers.leftAt),
      },
    },
  });

  if (!room) {
    return c.json({ success: false, error: 'Room not found' }, 404);
  }

  if (room.status !== 'waiting') {
    return c.json({ success: false, error: 'Room is not accepting players' }, 400);
  }

  if (room.players.length >= (room.maxPlayers ?? 4)) {
    return c.json({ success: false, error: 'Room is full' }, 400);
  }

  // Check password
  if (room.password && room.password !== password) {
    return c.json({ success: false, error: 'Invalid password' }, 401);
  }

  // Check if already in room
  const existingPlayer = room.players.find(p => p.userId === userId);
  if (existingPlayer) {
    return c.json({ success: false, error: 'Already in this room' }, 400);
  }

  // Add player
  const [player] = await db.insert(gameRoomPlayers).values({
    roomId: room.id,
    userId,
    isReady: false,
    isConnected: true,
    turnOrder: room.players.length + 1,
  }).returning();

  return c.json({
    success: true,
    message: 'Joined room successfully',
    data: player,
  });
});

// POST /rooms/:id/leave - Leave a room
rooms.post('/:id/leave', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, id),
  });

  if (!room) {
    return c.json({ success: false, error: 'Room not found' }, 404);
  }

  // If host leaves, close the room
  if (room.hostId === userId) {
    await db.update(gameRooms)
      .set({ status: 'abandoned', finishedAt: new Date() })
      .where(eq(gameRooms.id, id));

    await db.update(gameRoomPlayers)
      .set({ leftAt: new Date() })
      .where(eq(gameRoomPlayers.roomId, id));

    return c.json({
      success: true,
      message: 'Room closed',
    });
  }

  // Mark player as left
  await db.update(gameRoomPlayers)
    .set({ leftAt: new Date() })
    .where(and(
      eq(gameRoomPlayers.roomId, id),
      eq(gameRoomPlayers.userId, userId)
    ));

  return c.json({
    success: true,
    message: 'Left room successfully',
  });
});

// POST /rooms/:id/ready - Toggle ready status
rooms.post('/:id/ready', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;

  const player = await db.query.gameRoomPlayers.findFirst({
    where: and(
      eq(gameRoomPlayers.roomId, id),
      eq(gameRoomPlayers.userId, userId),
      isNull(gameRoomPlayers.leftAt)
    ),
  });

  if (!player) {
    return c.json({ success: false, error: 'Not in this room' }, 404);
  }

  const [updated] = await db.update(gameRoomPlayers)
    .set({ isReady: !player.isReady })
    .where(eq(gameRoomPlayers.id, player.id))
    .returning();

  return c.json({
    success: true,
    data: { isReady: updated.isReady },
  });
});

// POST /rooms/:id/start - Start the game (host only)
rooms.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const userId = c.get('userId')!;

  const room = await db.query.gameRooms.findFirst({
    where: eq(gameRooms.id, id),
    with: {
      players: {
        where: isNull(gameRoomPlayers.leftAt),
      },
    },
  });

  if (!room) {
    return c.json({ success: false, error: 'Room not found' }, 404);
  }

  if (room.hostId !== userId) {
    return c.json({ success: false, error: 'Only the host can start the game' }, 403);
  }

  if (room.players.length < 2) {
    return c.json({ success: false, error: 'Need at least 2 players to start' }, 400);
  }

  const allReady = room.players.every(p => p.isReady || p.userId === userId);
  if (!allReady) {
    return c.json({ success: false, error: 'Not all players are ready' }, 400);
  }

  // Update room status
  const [updated] = await db.update(gameRooms)
    .set({ status: 'playing', startedAt: new Date() })
    .where(eq(gameRooms.id, id))
    .returning();

  return c.json({
    success: true,
    message: 'Game started!',
    data: updated,
  });
});

export default rooms;
