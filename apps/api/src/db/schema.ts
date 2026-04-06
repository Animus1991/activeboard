import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  jsonb,
  varchar,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// USERS & AUTHENTICATION
// ============================================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  
  // User preferences
  preferredGameSystems: jsonb('preferred_game_systems').$type<string[]>().default([]),
  vrHeadset: varchar('vr_headset', { length: 50 }), // quest3, quest3s, pcvr, none
  timezone: varchar('timezone', { length: 50 }),
  
  // Stats
  totalGamesPlayed: integer('total_games_played').default(0),
  totalPlayTimeMinutes: integer('total_play_time_minutes').default(0),
  
  // Status
  isVerified: boolean('is_verified').default(false),
  isAdmin: boolean('is_admin').default(false),
  isBanned: boolean('is_banned').default(false),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  usernameIdx: uniqueIndex('users_username_idx').on(table.username),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.userId),
  tokenIdx: index('refresh_tokens_token_idx').on(table.tokenHash),
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// WAITLIST (Phase 0 Validation)
// ============================================================================

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  
  // Validation survey data
  primaryInterest: varchar('primary_interest', { length: 50 }), // wargaming, rpg, boardgames, all
  currentPlatforms: jsonb('current_platforms').$type<string[]>().default([]), // tts, bga, roll20, none
  hasVrHeadset: boolean('has_vr_headset').default(false),
  vrHeadsetType: varchar('vr_headset_type', { length: 50 }),
  playFrequency: varchar('play_frequency', { length: 50 }), // daily, weekly, monthly, rarely
  biggestPainPoint: text('biggest_pain_point'),
  willingToPay: varchar('willing_to_pay', { length: 50 }), // yes, maybe, no
  
  // Referral tracking
  referralCode: varchar('referral_code', { length: 20 }).unique(),
  referredBy: varchar('referred_by', { length: 20 }),
  referralCount: integer('referral_count').default(0),
  
  // Status
  status: varchar('status', { length: 20 }).default('pending'), // pending, invited, converted
  priority: integer('priority').default(0), // Higher = earlier access
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  invitedAt: timestamp('invited_at'),
  convertedAt: timestamp('converted_at'),
}, (table) => ({
  emailIdx: uniqueIndex('waitlist_email_idx').on(table.email),
  referralCodeIdx: uniqueIndex('waitlist_referral_code_idx').on(table.referralCode),
  statusIdx: index('waitlist_status_idx').on(table.status),
}));

// ============================================================================
// GAME SYSTEMS (One Page Rules focus for MVP)
// ============================================================================

export const gameSystems = pgTable('game_systems', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  publisher: varchar('publisher', { length: 100 }),
  description: text('description'),
  
  // Game metadata
  minPlayers: integer('min_players').default(2),
  maxPlayers: integer('max_players').default(4),
  avgPlayTimeMinutes: integer('avg_play_time_minutes'),
  complexity: varchar('complexity', { length: 20 }), // simple, medium, complex
  
  // Content
  rulesUrl: text('rules_url'),
  iconUrl: text('icon_url'),
  coverImageUrl: text('cover_image_url'),
  
  // Status
  isActive: boolean('is_active').default(true),
  isFeatured: boolean('is_featured').default(false),
  releasePhase: varchar('release_phase', { length: 20 }).default('alpha'), // alpha, beta, stable
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: uniqueIndex('game_systems_slug_idx').on(table.slug),
}));

export const factions = pgTable('factions', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameSystemId: uuid('game_system_id').notNull().references(() => gameSystems.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  playstyle: text('playstyle'),
  iconUrl: text('icon_url'),
  colorPrimary: varchar('color_primary', { length: 7 }), // Hex color
  colorSecondary: varchar('color_secondary', { length: 7 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  gameSystemIdx: index('factions_game_system_idx').on(table.gameSystemId),
  slugIdx: uniqueIndex('factions_slug_idx').on(table.gameSystemId, table.slug),
}));

export const unitTypes = pgTable('unit_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  factionId: uuid('faction_id').notNull().references(() => factions.id, { onDelete: 'cascade' }),
  slug: varchar('slug', { length: 50 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Unit stats (OPR-style)
  pointsCost: integer('points_cost').default(0),
  quality: integer('quality'), // 2-6
  defense: integer('defense'), // 2-6
  modelCount: integer('model_count').default(1),
  
  // Equipment and abilities
  equipment: jsonb('equipment').$type<string[]>().default([]),
  specialRules: jsonb('special_rules').$type<string[]>().default([]),
  
  // 3D model reference
  modelAssetId: varchar('model_asset_id', { length: 100 }),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  factionIdx: index('unit_types_faction_idx').on(table.factionId),
}));

// ============================================================================
// ARMY LISTS
// ============================================================================

export const armyLists = pgTable('army_lists', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  gameSystemId: uuid('game_system_id').notNull().references(() => gameSystems.id),
  factionId: uuid('faction_id').notNull().references(() => factions.id),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  pointsLimit: integer('points_limit').default(1000),
  totalPoints: integer('total_points').default(0),
  
  isPublic: boolean('is_public').default(false),
  isFavorite: boolean('is_favorite').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('army_lists_user_idx').on(table.userId),
  gameSystemIdx: index('army_lists_game_system_idx').on(table.gameSystemId),
}));

export const armyListUnits = pgTable('army_list_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  armyListId: uuid('army_list_id').notNull().references(() => armyLists.id, { onDelete: 'cascade' }),
  unitTypeId: uuid('unit_type_id').notNull().references(() => unitTypes.id),
  
  quantity: integer('quantity').default(1),
  customName: varchar('custom_name', { length: 100 }),
  upgrades: jsonb('upgrades').$type<string[]>().default([]),
  notes: text('notes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  armyListIdx: index('army_list_units_army_list_idx').on(table.armyListId),
}));

// ============================================================================
// GAME ROOMS & SESSIONS
// ============================================================================

export const gameRooms = pgTable('game_rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 8 }).notNull().unique(),
  hostId: uuid('host_id').notNull().references(() => users.id),
  gameSystemId: uuid('game_system_id').notNull().references(() => gameSystems.id),
  
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  
  // Room settings
  maxPlayers: integer('max_players').default(4),
  pointsLimit: integer('points_limit').default(1000),
  isPrivate: boolean('is_private').default(true),
  password: varchar('password', { length: 100 }),
  
  // Room state
  status: varchar('status', { length: 20 }).default('waiting'), // waiting, ready, playing, finished, abandoned
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
}, (table) => ({
  codeIdx: uniqueIndex('game_rooms_code_idx').on(table.code),
  hostIdx: index('game_rooms_host_idx').on(table.hostId),
  statusIdx: index('game_rooms_status_idx').on(table.status),
}));

export const gameRoomPlayers = pgTable('game_room_players', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  armyListId: uuid('army_list_id').references(() => armyLists.id),
  
  // Player state
  isReady: boolean('is_ready').default(false),
  isConnected: boolean('is_connected').default(true),
  deviceType: varchar('device_type', { length: 20 }), // vr, pc, tablet
  
  // In-game state
  teamNumber: integer('team_number'),
  turnOrder: integer('turn_order'),
  
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
}, (table) => ({
  roomIdx: index('game_room_players_room_idx').on(table.roomId),
  userIdx: index('game_room_players_user_idx').on(table.userId),
  roomUserIdx: uniqueIndex('game_room_players_room_user_idx').on(table.roomId, table.userId),
}));

export const gameSessions = pgTable('game_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomId: uuid('room_id').notNull().references(() => gameRooms.id),
  
  // Game state
  currentTurn: integer('current_turn').default(1),
  currentPlayerId: uuid('current_player_id').references(() => users.id),
  gameState: jsonb('game_state').$type<Record<string, unknown>>().default({}),
  
  // Results
  winnerId: uuid('winner_id').references(() => users.id),
  endReason: varchar('end_reason', { length: 50 }), // completed, conceded, timeout, abandoned
  
  // Stats
  totalTurns: integer('total_turns'),
  durationMinutes: integer('duration_minutes'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
}, (table) => ({
  roomIdx: index('game_sessions_room_idx').on(table.roomId),
}));

// ============================================================================
// SOCIAL FEATURES
// ============================================================================

export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  friendId: uuid('friend_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 20 }).default('pending'), // pending, accepted, blocked
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acceptedAt: timestamp('accepted_at'),
}, (table) => ({
  userIdx: index('friendships_user_idx').on(table.userId),
  friendIdx: index('friendships_friend_idx').on(table.friendId),
  pairIdx: uniqueIndex('friendships_pair_idx').on(table.userId, table.friendId),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  armyLists: many(armyLists),
  hostedRooms: many(gameRooms),
  roomMemberships: many(gameRoomPlayers),
  friendshipsInitiated: many(friendships, { relationName: 'initiator' }),
  friendshipsReceived: many(friendships, { relationName: 'receiver' }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const gameSystemsRelations = relations(gameSystems, ({ many }) => ({
  factions: many(factions),
  armyLists: many(armyLists),
  gameRooms: many(gameRooms),
}));

export const factionsRelations = relations(factions, ({ one, many }) => ({
  gameSystem: one(gameSystems, {
    fields: [factions.gameSystemId],
    references: [gameSystems.id],
  }),
  unitTypes: many(unitTypes),
  armyLists: many(armyLists),
}));

export const unitTypesRelations = relations(unitTypes, ({ one, many }) => ({
  faction: one(factions, {
    fields: [unitTypes.factionId],
    references: [factions.id],
  }),
  armyListUnits: many(armyListUnits),
}));

export const armyListsRelations = relations(armyLists, ({ one, many }) => ({
  user: one(users, {
    fields: [armyLists.userId],
    references: [users.id],
  }),
  gameSystem: one(gameSystems, {
    fields: [armyLists.gameSystemId],
    references: [gameSystems.id],
  }),
  faction: one(factions, {
    fields: [armyLists.factionId],
    references: [factions.id],
  }),
  units: many(armyListUnits),
}));

export const armyListUnitsRelations = relations(armyListUnits, ({ one }) => ({
  armyList: one(armyLists, {
    fields: [armyListUnits.armyListId],
    references: [armyLists.id],
  }),
  unitType: one(unitTypes, {
    fields: [armyListUnits.unitTypeId],
    references: [unitTypes.id],
  }),
}));

export const gameRoomsRelations = relations(gameRooms, ({ one, many }) => ({
  host: one(users, {
    fields: [gameRooms.hostId],
    references: [users.id],
  }),
  gameSystem: one(gameSystems, {
    fields: [gameRooms.gameSystemId],
    references: [gameSystems.id],
  }),
  players: many(gameRoomPlayers),
  sessions: many(gameSessions),
}));

export const gameRoomPlayersRelations = relations(gameRoomPlayers, ({ one }) => ({
  room: one(gameRooms, {
    fields: [gameRoomPlayers.roomId],
    references: [gameRooms.id],
  }),
  user: one(users, {
    fields: [gameRoomPlayers.userId],
    references: [users.id],
  }),
  armyList: one(armyLists, {
    fields: [gameRoomPlayers.armyListId],
    references: [armyLists.id],
  }),
}));

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  room: one(gameRooms, {
    fields: [gameSessions.roomId],
    references: [gameRooms.id],
  }),
  currentPlayer: one(users, {
    fields: [gameSessions.currentPlayerId],
    references: [users.id],
    relationName: 'currentPlayer',
  }),
  winner: one(users, {
    fields: [gameSessions.winnerId],
    references: [users.id],
    relationName: 'winner',
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: 'initiator',
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: 'receiver',
  }),
}));
