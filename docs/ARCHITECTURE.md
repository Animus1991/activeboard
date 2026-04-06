# TableForge — Complete System Architecture

## Executive Summary

**TableForge** is a B2B hybrid digital tabletop platform for board game venues (cafés, stores, clubs) with remote player participation via PC and optional VR.

### Core Insight
The problem is NOT "play board games online" — that's solved.
The problem IS: **"My game group has someone who can't be here physically, but we still want to play TOGETHER at the venue."**

This is a **hybrid presence problem**, not a game-access problem.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TABLEFORGE PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   TOUCH TABLE   │  │   REMOTE PC     │  │   REMOTE VR     │             │
│  │   (Venue)       │  │   (Home)        │  │   (Home)        │             │
│  │                 │  │                 │  │                 │             │
│  │  React + R3F    │  │  React + R3F    │  │  React + WebXR  │             │
│  │  Touch Controls │  │  Mouse/Keyboard │  │  Hand Tracking  │             │
│  │  Top-Down View  │  │  Orbit Camera   │  │  Immersive View │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
│           └────────────────────┼────────────────────┘                       │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   REAL-TIME SYNC      │                               │
│                    │   (Liveblocks/WS)     │                               │
│                    │                       │                               │
│                    │  • Game State (CRDT)  │                               │
│                    │  • Player Presence    │                               │
│                    │  • Voice Chat         │                               │
│                    └───────────┬───────────┘                               │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   BACKEND API         │                               │
│                    │   (Hono + Drizzle)    │                               │
│                    │                       │                               │
│                    │  • Auth (JWT)         │                               │
│                    │  • Game Systems       │                               │
│                    │  • Army Lists         │                               │
│                    │  • Venues (B2B)       │                               │
│                    │  • Sessions/History   │                               │
│                    └───────────┬───────────┘                               │
│                                │                                            │
│                    ┌───────────▼───────────┐                               │
│                    │   DATABASE            │                               │
│                    │   (Neon PostgreSQL)   │                               │
│                    └───────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Client Applications

### 1.1 Touch Table Client (Venue)

**Purpose**: Primary interface for co-located players at venues

**Technology**:
- React 18 + TypeScript
- React Three Fiber (3D rendering)
- Touch-optimized controls
- Top-down camera (fixed)

**Features**:
- Multi-touch support (4+ simultaneous touches)
- Large UI elements for finger interaction
- Automatic player position detection
- Spectator mode for walk-ups

**Hardware Requirements**:
- 55"+ 4K display (horizontal orientation)
- Multi-touch overlay (10+ touch points)
- Windows/Linux PC with GPU
- Stable internet connection

### 1.2 Remote PC Client

**Purpose**: Home players joining venue sessions

**Technology**:
- Same React codebase
- Orbit camera controls
- Mouse/keyboard input
- Picture-in-picture video

**Features**:
- 3D perspective view
- Chat integration
- Voice chat (LiveKit)
- Spectator mode

### 1.3 Remote VR Client (Phase 2)

**Purpose**: Premium immersive experience for remote players

**Technology**:
- WebXR via React Three Fiber
- @react-three/xr
- Hand tracking
- Spatial audio

**Features**:
- First-person tabletop view
- Hand-based piece manipulation
- Spatial voice positioning
- Avatar presence

---

## Layer 2: Real-Time Synchronization

### 2.1 State Synchronization (Liveblocks)

**Why Liveblocks**:
- CRDT-based conflict resolution
- Built-in presence system
- React hooks integration
- Scales automatically

**State Structure**:
```typescript
type GameRoomStorage = {
  // Metadata
  gameId: string;
  gameSystemId: string;
  turnNumber: number;
  currentPlayerId: string;
  phase: 'setup' | 'deployment' | 'playing' | 'ended';
  
  // Board state
  pieces: Record<string, GamePiece>;
  terrain: Record<string, TerrainPiece>;
  
  // Ephemeral
  diceRolls: DiceRoll[];
  measurements: Record<string, MeasurementLine>;
  
  // Log
  gameLog: GameLogEntry[];
};
```

**Presence Structure**:
```typescript
type PlayerPresence = {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedPieceId: string | null;
  isReady: boolean;
  deviceType: 'touch-table' | 'pc' | 'vr' | 'mobile';
};
```

### 2.2 Voice Chat (LiveKit)

**Why LiveKit**:
- WebRTC-based
- Spatial audio support
- Low latency
- Self-hostable option

**Integration**:
```typescript
// Voice rooms tied to game rooms
const voiceRoomId = `tableforge-voice-${gameRoomId}`;
```

### 2.3 Alternative: Self-Hosted WebSocket

For cost control or data sovereignty:
```typescript
// Hono WebSocket upgrade
app.get('/ws/game/:roomId', upgradeWebSocket((c) => ({
  onOpen(event, ws) { /* join room */ },
  onMessage(event, ws) { /* handle action */ },
  onClose(event, ws) { /* leave room */ },
})));
```

---

## Layer 3: Backend API

### 3.1 Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Framework | Hono | Fast, type-safe, edge-ready |
| ORM | Drizzle | Type-safe, lightweight |
| Database | Neon PostgreSQL | Serverless, scalable |
| Auth | JWT + bcrypt | Simple, stateless |
| Validation | Zod | Runtime type checking |

### 3.2 API Structure

```
/api
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /refresh
│   └── GET /me
│
├── /games
│   ├── GET /systems
│   ├── GET /systems/:id
│   ├── GET /systems/:id/factions
│   └── GET /systems/:id/units
│
├── /armies
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   └── DELETE /:id
│
├── /rooms
│   ├── GET /
│   ├── POST /
│   ├── GET /:code
│   ├── POST /:code/join
│   ├── POST /:code/leave
│   └── POST /:code/start
│
├── /venues (B2B)
│   ├── GET /
│   ├── POST /
│   ├── GET /:id
│   ├── PUT /:id
│   ├── GET /:id/tables
│   ├── GET /:id/sessions
│   └── GET /:id/analytics
│
└── /admin
    ├── GET /users
    ├── GET /venues
    └── GET /stats
```

### 3.3 Database Schema (Key Tables)

```sql
-- Users & Auth
users (id, email, username, password_hash, role, created_at)
refresh_tokens (id, user_id, token, expires_at)

-- Game Content
game_systems (id, name, slug, description, rules_version)
factions (id, system_id, name, description)
unit_types (id, faction_id, name, stats_json, points_cost)

-- Army Building
army_lists (id, user_id, system_id, faction_id, name, points_limit)
army_units (id, army_id, unit_type_id, quantity, options_json)

-- Game Sessions
game_rooms (id, code, host_id, system_id, status, settings_json)
game_room_players (room_id, user_id, army_id, team, is_ready)
game_sessions (id, room_id, started_at, ended_at, winner_id, log_json)

-- B2B: Venues
venues (id, owner_id, name, slug, address, subscription_tier)
venue_tables (id, venue_id, name, hardware_id, status)
venue_sessions (id, table_id, room_id, started_at, ended_at)
```

---

## Layer 4: Game Engine

### 4.1 Game State Machine

```typescript
type GamePhase = 
  | 'lobby'
  | 'army_selection'
  | 'deployment'
  | 'playing'
  | 'ended';

type TurnPhase =
  | 'command'
  | 'movement'
  | 'shooting'
  | 'melee'
  | 'morale';

interface GameEngine {
  // State
  getState(): GameState;
  
  // Actions
  movePiece(pieceId: string, to: Position): Result;
  attack(attackerId: string, targetId: string): AttackResult;
  rollDice(count: number, type: DiceType): number[];
  endPhase(): void;
  endTurn(): void;
  
  // Validation
  canMove(pieceId: string, to: Position): boolean;
  canAttack(attackerId: string, targetId: string): boolean;
  getValidMoves(pieceId: string): Position[];
  
  // Queries
  measureDistance(from: Position, to: Position): number;
  checkLineOfSight(from: Position, to: Position): boolean;
}
```

### 4.2 Rules Engine (OPR Example)

```typescript
// One Page Rules - Grimdark Future
const OPRRules = {
  phases: ['activation'],
  
  activation: {
    actions: 3,
    actionTypes: ['move', 'shoot', 'charge', 'hold'],
  },
  
  movement: {
    infantry: 6, // inches
    cavalry: 9,
    vehicle: 12,
  },
  
  combat: {
    hit: (quality: number, roll: number) => roll >= quality,
    wound: (ap: number, defense: number, roll: number) => 
      roll >= Math.max(2, defense - ap),
  },
  
  morale: {
    shaken: (casualties: number, total: number) => 
      casualties >= Math.ceil(total / 2),
  },
};
```

---

## Layer 5: 3D Rendering

### 5.1 Scene Structure

```typescript
<Canvas>
  {/* Camera */}
  <PerspectiveCamera />
  <CameraController mode={deviceType} />
  
  {/* Lighting */}
  <ambientLight />
  <directionalLight castShadow />
  
  {/* Environment */}
  <Environment preset="warehouse" />
  
  {/* Game Board */}
  <GameBoard size={[48, 48]} />
  <Grid />
  
  {/* Terrain */}
  {terrain.map(t => <TerrainPiece key={t.id} {...t} />)}
  
  {/* Miniatures */}
  {pieces.map(p => <Miniature key={p.id} {...p} />)}
  
  {/* Tools */}
  <MeasurementTool />
  <LineOfSightTool />
  
  {/* Player Cursors */}
  {otherPlayers.map(p => <PlayerCursor key={p.id} {...p} />)}
  
  {/* Controls */}
  <OrbitControls enabled={!isTableMode} />
</Canvas>
```

### 5.2 Asset Pipeline

```
/public/assets
├── /models
│   ├── /miniatures
│   │   ├── infantry_base.glb
│   │   ├── cavalry_base.glb
│   │   └── vehicle_base.glb
│   └── /terrain
│       ├── ruin_01.glb
│       ├── forest_01.glb
│       └── building_01.glb
├── /textures
│   ├── board_grass.jpg
│   ├── board_desert.jpg
│   └── board_urban.jpg
└── /audio
    ├── dice_roll.mp3
    └── piece_move.mp3
```

---

## Layer 6: B2B Venue System

### 6.1 Venue Dashboard

```
/venue/:slug/dashboard
├── Overview (active tables, today's sessions)
├── Tables (manage hardware, status)
├── Sessions (history, analytics)
├── Customers (regulars, bookings)
├── Content (enabled games, custom rules)
├── Settings (branding, hours, pricing)
└── Billing (subscription, usage)
```

### 6.2 Subscription Tiers

| Tier | Price | Tables | Features |
|------|-------|--------|----------|
| Starter | €49/mo | 1 | Basic, 5 remote players |
| Pro | €99/mo | 3 | Analytics, 15 remote |
| Enterprise | €199/mo | Unlimited | White-label, API |

### 6.3 Revenue Streams

1. **B2B SaaS** — Venue subscriptions
2. **B2B2C** — Remote player passes (€9.99/mo)
3. **Marketplace** — Publisher content (rev share)
4. **Hardware** — Touch table bundles (optional)

---

## Layer 7: Security & Compliance

### 7.1 Authentication Flow

```
1. User registers/logs in → JWT issued
2. JWT stored in httpOnly cookie
3. API validates JWT on each request
4. Refresh token rotation every 7 days
5. WebSocket auth via token in connection params
```

### 7.2 Authorization Levels

| Role | Permissions |
|------|-------------|
| Guest | View public rooms, spectate |
| Player | Join rooms, create armies |
| VenueStaff | Manage venue tables |
| VenueOwner | Full venue control |
| Admin | Platform administration |

### 7.3 Data Protection

- GDPR compliance for EU venues
- Data encryption at rest (Neon)
- TLS for all connections
- No PII in game logs

---

## Deployment Architecture

### Production Stack

```
┌─────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                         │
│                   (CDN + DDoS + WAF)                   │
└─────────────────────────┬───────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   VERCEL        │ │  FLY.IO     │ │   LIVEBLOCKS    │
│   (Frontend)    │ │  (API)      │ │   (Real-time)   │
│                 │ │             │ │                 │
│   React SPA     │ │   Hono      │ │   CRDT Sync     │
│   Static Assets │ │   WebSocket │ │   Presence      │
└────────┬────────┘ └──────┬──────┘ └─────────────────┘
         │                 │
         │                 ▼
         │         ┌─────────────────┐
         │         │   NEON          │
         │         │   (PostgreSQL)  │
         │         └─────────────────┘
         │
         ▼
┌─────────────────┐
│   CLOUDFLARE R2 │
│   (Assets/CDN)  │
└─────────────────┘
```

### Cost Estimation (MVP)

| Service | Tier | Cost/mo |
|---------|------|---------|
| Vercel | Pro | $20 |
| Fly.io | 2x shared-cpu | $10 |
| Neon | Launch | $19 |
| Liveblocks | Starter | $25 |
| LiveKit | Starter | $0 (self-host) |
| Cloudflare | Free | $0 |
| **Total** | | **~$74/mo** |

---

## Development Phases

### Phase 0: Validation (2 weeks)
- [ ] Interview 20+ venue owners
- [ ] Clickable prototype
- [ ] 5 LOIs (Letters of Intent)

### Phase 1: Core MVP (8 weeks)
- [ ] Touch table client
- [ ] PC remote client
- [ ] Real-time sync
- [ ] 1 game system (OPR)
- [ ] Basic venue dashboard

### Phase 2: VR + Expansion (12 weeks)
- [ ] WebXR VR client
- [ ] 2-3 more game systems
- [ ] Spatial voice
- [ ] Army list builder
- [ ] Tournament mode

### Phase 3: Platform (6 months)
- [ ] Publisher portal
- [ ] Marketplace
- [ ] Analytics dashboard
- [ ] API for integrations

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Venues don't adopt | High | Critical | Start with wargaming clubs |
| Content licensing blocked | High | Critical | Start with open games (OPR) |
| Touch tables too expensive | Medium | High | Support any large display |
| WebXR too limited | Medium | Medium | Can pivot to native Quest |
| BGA/TTS add hybrid | Medium | High | Move fast, lock partnerships |

---

## Success Metrics

### Phase 1 (MVP)
- 10 venue signups
- 50 active remote players
- 30% D7 retention
- <5 min setup time

### Phase 2 (Growth)
- 50 venues
- 500 remote players
- 3+ game systems
- €10K MRR

### Phase 3 (Scale)
- 200+ venues
- 5000+ players
- Publisher partnerships
- €100K MRR

---

## Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Venue signups (6 mo) | <10 | Pivot or kill |
| D30 retention | <10% | Diagnose UX |
| Remote usage | <30% sessions | Hybrid not valued |
| Setup time | >10 min | Simplify |
| Venue churn | >15%/mo | Value not delivered |
