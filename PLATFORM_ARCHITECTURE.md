# TableForge — Unified Premium Tabletop Platform Architecture

## Production-Grade Engine & Platform Blueprint
### Version 1.0 — Comprehensive Design Document

---

# SECTION 1 — PLATFORM VISION AND ARCHITECTURAL PHILOSOPHY

## 1.1 What This Is

TableForge is **one platform with one engine, one shell, and multiple game modules deployed inside it**. It is NOT four separate games with a shared login. It is a unified tabletop ecosystem where:

- The engine is a single codebase with game-agnostic core systems
- Each game is a **rules module + presentation module** that plugs into the engine
- The platform shell (accounts, rooms, social, commerce) wraps everything
- Players experience one coherent product with multiple game experiences inside

## 1.2 Priority Hierarchy (Ordered)

1. **Rules integrity** — The engine must never allow an illegal game state
2. **UX readability** — Players must always understand what is happening
3. **Visual realism** — Premium feel that justifies the platform
4. **Social presence** — Multiplayer must feel like sitting at a table together
5. **Extensibility** — Adding game 5, 6, 7 must not require rewriting the engine
6. **Simulation purity** — Game mechanics must match physical tabletop faithfully

## 1.3 Anti-Pattern Prevention

The architecture prevents two failure modes:

**Over-generalization hell**: Prevented by the rule that shared abstractions must be justified by at least 2 games using them identically. If only one game needs something, it stays game-specific until proven otherwise.

**Per-game duplication chaos**: Prevented by the rule that any system touching networking, state sync, visibility, session management, or platform identity MUST use the shared layer. No game is allowed to implement its own WebSocket handling or auth flow.

## 1.4 Core Design Principles

1. **State is king** — All game logic operates on authoritative state objects. Presentation reads state. Interaction submits commands. Nothing else.
2. **Commands, not mutations** — Players never mutate state directly. They submit validated commands that the rules engine processes.
3. **Visibility is a first-class concern** — Every piece of state has explicit visibility rules. No data leaks by default.
4. **Presentation is a projection** — The 3D scene, HUD, and UI are all projections of state. They never own truth.
5. **Games are plugins** — A game provides: rules module, board config, content schema, presentation adapter. Everything else comes from the platform.

---

# SECTION 2 — SYSTEM BOUNDARIES: SHARED VS GAME-SPECIFIC

## Classification Table

| Domain | Classification | Justification |
|--------|---------------|---------------|
| Account system | **Fully shared** | One account across all games |
| Identity/profile | **Fully shared** | Cross-game player identity, stats, preferences |
| Lobby/room creation | **Fully shared** | Same room model, same invite flow, game type is a parameter |
| Invites/friends | **Fully shared** | Social graph is game-agnostic |
| Chat/voice | **Fully shared** | Same WebRTC/WebSocket infrastructure, game-specific channels are config |
| Matchmaking | **Partially shared** | Queue infrastructure shared, matching criteria game-specific |
| Spectator/replay | **Partially shared** | Replay infrastructure shared, replay UI needs game-specific renderers |
| Event log | **Fully shared** | Shared event bus, game-specific event types registered as plugins |
| Analytics | **Fully shared** | Same pipeline, game-specific event schemas |
| Save/resume | **Wrapper-shared** | Save/load infrastructure shared, serialized state is game-specific |
| Authoritative state | **Wrapper-shared** | State container/sync shared, state schema game-specific |
| Phase/turn management | **Partially shared** | Phase machine framework shared, phase definitions game-specific |
| Rules validation | **Mostly game-specific** | Validation framework shared (command → validate → apply), rules are game-specific |
| Board geometry | **Wrapper-shared** | Spatial abstraction layer shared (graph nodes, edges, zones), concrete geometry game-specific |
| Piece system | **Wrapper-shared** | Piece registry shared, piece types/behaviors game-specific |
| Hidden information | **Fully shared** | Visibility system is generic — roles, permissions, field-level visibility |
| Permissions | **Fully shared** | Role-based permission framework applies to all games |
| Negotiation | **Partially shared** | Offer/accept/counter framework shared, offer content game-specific |
| Auctions | **Partially shared** | Auction engine shared (bid/pass/timer), what's auctioned game-specific |
| Trading | **Partially shared** | Trade framework shared (propose/accept/counter), tradeable items game-specific |
| Team roles | **Wrapper-shared** | Team/role system shared, role definitions game-specific (spymaster, etc.) |
| Randomization/dice/decks | **Fully shared** | Deterministic RNG, dice roller, deck shuffler are game-agnostic |
| Card systems | **Wrapper-shared** | Card container/deck/hand shared, card types game-specific |
| Map systems | **Mostly game-specific** | Hex grids, territory graphs, board loops are structurally different |
| Property ownership | **Fully game-specific** | Only Monopoly-type needs this |
| Resource economy | **Partially shared** | Resource container shared, production rules game-specific |
| Attack/combat | **Fully game-specific** | Only Risk-type needs dice combat resolution |
| Clue/word systems | **Fully game-specific** | Only Codenames-type needs linguistic clue validation |
| UI shell | **Fully shared** | Navigation, settings, pre-game screens |
| HUD primitives | **Partially shared** | Player ribbon, turn indicator, timer shared; game-specific panels not |
| Camera system | **Fully shared** | Orbit/zoom/pan with game-specific presets |
| Animation system | **Fully shared** | Tweening, transitions, particle triggers shared; animations game-specific |
| Visual effect triggers | **Wrapper-shared** | Effect system shared, specific effects game-specific |
| Asset loading | **Fully shared** | Same loader pipeline, different assets per game |
| Content configuration | **Wrapper-shared** | Config schema framework shared, schemas game-specific |
| Tutorial system | **Partially shared** | Tutorial framework shared (step/highlight/tooltip), content game-specific |
| Bots/AI | **Mostly game-specific** | Bot framework shared (turn taking, timer), strategy fully game-specific |
| Monetization | **Fully shared** | Same entitlement system |
| Moderation | **Fully shared** | Same report/ban/mute system |
| Hybrid local/remote | **Fully shared** | Seat assignment, input routing shared |

---

# SECTION 3 — CORE ENGINE LAYERS

```
┌─────────────────────────────────────────────────┐
│              PLATFORM SHELL                      │
│  (accounts, friends, rooms, discovery, commerce) │
├─────────────────────────────────────────────────┤
│              GAME MODULE LAYER                   │
│  (game-hex-economy, game-conquest, game-property,│
│   game-word-clue)                                │
├─────────────────────────────────────────────────┤
│              PRESENTATION LAYER                  │
│  (3D renderer, camera, HUD, animations, effects) │
├─────────────────────────────────────────────────┤
│              INTERACTION LAYER                   │
│  (input handling, selection, drag, commands)      │
├─────────────────────────────────────────────────┤
│              UI FRAMEWORK LAYER                  │
│  (shared components, panels, modals, overlays)   │
├─────────────────────────────────────────────────┤
│              SOCIAL LAYER                        │
│  (chat, voice, emotes, negotiation, teams)       │
├─────────────────────────────────────────────────┤
│              RULES FRAMEWORK LAYER               │
│  (command processor, phase machine, validation)  │
├─────────────────────────────────────────────────┤
│              STATE ENGINE LAYER                  │
│  (state container, visibility, sync, persistence)│
├─────────────────────────────────────────────────┤
│              BOARD/SPATIAL LAYER                 │
│  (graph model, zones, slots, adjacency, pieces)  │
├─────────────────────────────────────────────────┤
│              NETWORKING LAYER                    │
│  (WebSocket, state sync, reconnect, spectator)   │
├─────────────────────────────────────────────────┤
│              REPLAY / ANALYTICS LAYER            │
│  (event log, replay timeline, telemetry)         │
├─────────────────────────────────────────────────┤
│              CONTENT / CONFIG LAYER              │
│  (asset pipeline, content schemas, localization) │
└─────────────────────────────────────────────────┘
```

### Layer Rules

| Layer | Owns | May Know | Must Not Know |
|-------|------|----------|---------------|
| Platform Shell | User accounts, rooms, social graph | Which games exist | Game rules, board state |
| Game Module | Rules, content schema, game-specific UI | State engine API, board API | Networking details, other games |
| Presentation | 3D scene, camera, visual objects | State (read-only), board geometry | Rules logic, networking |
| Interaction | User input, selection state | Presentation objects, command API | State internals, rules |
| State Engine | Canonical game state, history | Nothing (pure data) | Presentation, UI, networking |
| Rules Framework | Command validation, phase transitions | State (read/write) | Presentation, networking |
| Networking | WebSocket connections, message routing | State serialization format | Rules, presentation |
| Replay | Event timeline, playback | State snapshots, events | Rules logic, presentation |

**Dependency direction is strictly downward.** Upper layers depend on lower layers, never the reverse. Game modules may reach across to the social layer and presentation layer but never directly to networking.

---

# SECTION 4 — GAME STATE ARCHITECTURE

## 4.1 Canonical State Model

```typescript
interface GameMatch<TGameState> {
  // Identity
  matchId: string;
  gameType: GameType; // 'catan' | 'risk' | 'monopoly' | 'codenames'
  
  // Lifecycle
  status: 'lobby' | 'setup' | 'playing' | 'paused' | 'finished';
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  
  // Players
  seats: Seat[];
  currentSeatIndex: number;
  
  // Phase/Turn
  phase: string; // Game-specific phase enum
  turn: number;
  phaseData: Record<string, unknown>; // Transient phase-specific data
  
  // Timers
  turnTimer: TimerState | null;
  phaseTimer: TimerState | null;
  
  // Game-specific state (opaque to engine)
  gameState: TGameState;
  
  // Randomization
  rngSeed: number;
  rngCounter: number;
  
  // History
  commandLog: Command[];
  version: number;
}

interface Seat {
  seatIndex: number;
  playerId: string | null; // null = bot or empty
  displayName: string;
  color: string;
  team: string | null;
  role: string | null;
  isConnected: boolean;
  isEliminated: boolean;
  privateState: Record<string, unknown>; // Only visible to this seat
}
```

## 4.2 State Sync Model: Hybrid Event Sourcing

The engine uses **deterministic command processing with periodic snapshots**:

1. All player actions are submitted as **Commands** (typed, serializable)
2. The server validates and applies each command deterministically
3. The resulting state delta is broadcast to clients based on **visibility rules**
4. Every N commands (configurable), a full snapshot is taken for reconnect/replay
5. Clients maintain a local state copy updated via deltas

```
Client A → Command → Server validates → Apply to state → 
  → Filter by visibility → Delta to Client A (full)
  → Filter by visibility → Delta to Client B (filtered)
  → Filter by visibility → Delta to Spectators (public only)
```

## 4.3 Hidden Information Representation

State fields are tagged with visibility annotations:

```typescript
interface VisibilityPolicy {
  type: 'public' | 'private' | 'team' | 'role' | 'custom';
  visibleTo?: string[]; // seat indices or role names
  revealOn?: string; // event that reveals this field
}
```

Example: In Codenames, the card grid's `type` field (red/blue/neutral/assassin) has:
- `{ type: 'role', visibleTo: ['spymaster'] }` during play
- Switches to `{ type: 'public' }` when revealed

Example: In Catan, a player's development cards have:
- `{ type: 'private', visibleTo: [ownerSeatIndex] }`

The state sync layer reads these policies and strips invisible fields before sending to each client.

## 4.4 Reconnect Strategy

1. Client reconnects with `matchId` + `lastSeenVersion`
2. Server sends snapshot closest to `lastSeenVersion`
3. Then sends remaining command deltas
4. Client replays deltas to catch up
5. Visibility-filtered throughout

## 4.5 State Versioning & Migration

- Each game module declares a `stateSchemaVersion`
- When rules/content change, a migration function transforms old state → new state
- Snapshots store the schema version they were created with
- Replays of old matches use the rules version that was active at match time

---

# SECTION 5 — RULES ENGINE / PHASE ENGINE / TURN ENGINE

## 5.1 Command Model

```typescript
interface Command {
  id: string;
  type: string; // e.g., 'ROLL_DICE', 'BUILD_SETTLEMENT', 'ATTACK_TERRITORY'
  seatIndex: number;
  timestamp: number;
  payload: Record<string, unknown>;
}

interface CommandResult {
  valid: boolean;
  error?: string;
  stateChanges: StateChange[];
  events: GameEvent[];
  nextPhase?: string;
}
```

## 5.2 Rules Module Interface

Every game implements this interface:

```typescript
interface RulesModule<TState> {
  // State initialization
  createInitialState(config: GameConfig, seats: Seat[]): TState;
  
  // Command processing
  getValidCommands(state: GameMatch<TState>, seatIndex: number): CommandType[];
  validateCommand(state: GameMatch<TState>, command: Command): ValidationResult;
  applyCommand(state: GameMatch<TState>, command: Command): CommandResult;
  
  // Phase management
  getPhaseConfig(phase: string): PhaseConfig;
  onPhaseEnter(state: GameMatch<TState>, phase: string): StateChange[];
  onPhaseExit(state: GameMatch<TState>, phase: string): StateChange[];
  
  // Win condition
  checkWinCondition(state: GameMatch<TState>): WinResult | null;
  
  // Timer handling
  onTimerExpired(state: GameMatch<TState>, timerId: string): CommandResult;
  
  // Bot interface
  getBotCommand(state: GameMatch<TState>, seatIndex: number, difficulty: string): Command;
}
```

## 5.3 Phase Machine

```typescript
interface PhaseConfig {
  name: string;
  activeSeat: number | 'all' | 'team';
  allowedCommands: string[];
  timer?: { seconds: number; onExpire: 'skip' | 'random' | 'forfeit' };
  autoAdvance?: { when: string; to: string };
  subPhases?: PhaseConfig[];
}
```

### How each game maps to the phase machine:

**Catan**: `setup-settlement → setup-road → [repeat] → roll → (discard → robber-move → robber-steal) | main → end-turn`

**Risk**: `setup-claim → setup-reinforce → reinforce → attack → fortify → [next player]`

**Monopoly**: `roll → moving → landed → (buy-decision | auction | pay-rent | card-action | jail-decision) → build → trade → end-turn`

**Codenames**: `give-clue → guess → [repeat or switch team] → game-over`

## 5.4 Multi-Player Simultaneous Response

For phases where multiple players must respond (e.g., Catan discard on 7, Codenames team discussion):

```typescript
interface PendingResponses {
  requiredSeats: number[];
  receivedResponses: Map<number, Command>;
  timeout: number;
  onAllReceived: string; // next phase
  onTimeout: string; // fallback action
}
```

---

# SECTION 6 — BOARD MODELING AND SPATIAL REPRESENTATION

## 6.1 Unified Board Abstraction

All four games use boards, but structurally different. The shared abstraction is a **spatial graph**:

```typescript
interface BoardGraph {
  nodes: BoardNode[];
  edges: BoardEdge[];
  zones: BoardZone[];
}

interface BoardNode {
  id: string;
  type: string; // 'hex', 'territory', 'property-space', 'word-card'
  position: { x: number; y: number; z?: number };
  metadata: Record<string, unknown>;
  adjacentNodeIds: string[];
  containedObjectIds: string[];
}

interface BoardEdge {
  id: string;
  nodeIds: [string, string];
  type: string; // 'road-slot', 'border', 'connection'
  metadata: Record<string, unknown>;
}

interface BoardZone {
  id: string;
  name: string;
  nodeIds: string[];
  type: string; // 'continent', 'color-group', 'team-area'
  metadata: Record<string, unknown>;
}
```

## 6.2 Game-Specific Board Implementations

| Game | Nodes | Edges | Zones |
|------|-------|-------|-------|
| **Catan** | Hex tiles (19) + Vertices (54) | Road slots (72) | Harbors, resource groups |
| **Risk** | Territories (42) | Borders (adjacencies) | Continents (6) |
| **Monopoly** | Spaces (40) in cycle | Sequential movement path | Color groups (8), railroads, utilities |
| **Codenames** | Word cards (25) in grid | None needed | Team assignments (hidden) |

## 6.3 Coordinate Systems

- **Catan**: Axial hex coordinates `(q, r)` for tiles, vertex/edge indices
- **Risk**: Abstract graph (no geometric coordinates needed for rules; 2D positions for rendering)
- **Monopoly**: Linear index 0-39 in a cycle
- **Codenames**: Grid coordinates `(row, col)` in 5×5

The rendering layer maps these abstract coordinates to 3D positions.

---

# SECTION 7 — HIDDEN INFORMATION / PERMISSION / ROLE VISIBILITY SYSTEM

## 7.1 Visibility Framework

```typescript
type Visibility = 
  | { type: 'public' }
  | { type: 'hidden' } // No one sees it
  | { type: 'owner'; seatIndex: number }
  | { type: 'team'; teamId: string }
  | { type: 'role'; roleId: string }
  | { type: 'seats'; seatIndices: number[] }
  | { type: 'conditional'; condition: string };
```

## 7.2 Per-Game Visibility Maps

| Data | Catan | Risk | Monopoly | Codenames |
|------|-------|------|----------|-----------|
| Hand/cards | Owner only | Owner only | Public (count), owner (detail) | N/A |
| Dev cards | Owner only | N/A | N/A | N/A |
| Board state | Public | Public | Public | Public (words), Role-based (types) |
| Victory points | Partially hidden (VP cards) | Public | Public | Public |
| Resource counts | Public (count), owner (detail) | N/A | Public (money) | N/A |
| Card grid types | N/A | N/A | N/A | Spymaster only |

## 7.3 Anti-Leak Guarantees

- Server NEVER sends hidden data to unauthorized clients
- State sync uses per-seat filtered projections
- Spectators receive public-only projection
- Stream-safe mode further restricts (delays reveals)
- All visibility decisions are auditable in server logs

---

# SECTION 8 — PLAYER INTERACTION MODEL

## 8.1 Shared Interaction Grammar

```typescript
type InteractionType =
  | 'select-node'      // Click a board position
  | 'select-object'    // Click a piece/card
  | 'drag-drop'        // Move something
  | 'confirm-action'   // Confirm button
  | 'cancel-action'    // Cancel/back
  | 'submit-text'      // Enter text (clue)
  | 'submit-number'    // Enter number (bid, army count)
  | 'offer-trade'      // Complex multi-item offer
  | 'respond-offer'    // Accept/reject/counter
  | 'toggle-option'    // Settings, preferences
```

## 8.2 Input Abstraction

```typescript
interface InputEvent {
  source: 'mouse' | 'touch' | 'keyboard' | 'controller' | 'vr-pointer';
  type: 'tap' | 'drag-start' | 'drag-move' | 'drag-end' | 'hover' | 'long-press';
  target: { type: string; id: string } | null;
  position: { screen: [number, number]; world?: [number, number, number] };
}
```

The interaction layer translates raw input into game commands:
1. Raw input → InputEvent
2. InputEvent + current phase → candidate Command
3. Candidate Command → Rules validation
4. Valid → Submit to server
5. Invalid → Show error feedback

---

# SECTION 9 — UI/UX SYSTEM ARCHITECTURE

## 9.1 Shared UI Components

| Component | Used By | Description |
|-----------|---------|-------------|
| `PlayerRibbon` | All | Horizontal bar showing all players, current turn indicator |
| `TurnIndicator` | All | Whose turn + phase name |
| `ActionTray` | All | Context-sensitive action buttons |
| `EventLog` | All | Scrollable game event history |
| `TimerDisplay` | All | Turn/phase countdown |
| `ChatPanel` | All | Text chat with channels |
| `EmoteBar` | All | Quick reaction emotes |
| `ConfirmDialog` | All | Are you sure? pattern |
| `CardPopup` | Catan, Monopoly, Risk | Detailed card/property view |
| `TradePanel` | Catan, Monopoly | Offer/counter-offer UI |
| `DiceDisplay` | Catan, Risk, Monopoly | 3D dice result |
| `AuctionPanel` | Monopoly | Bid/pass/timer |
| `ClueInput` | Codenames | Word + number submission |
| `SettingsOverlay` | All | Graphics, audio, controls |
| `TutorialOverlay` | All | Step-by-step guidance |

## 9.2 Full-Screen Layout Pattern (All Games)

```
┌──────────────────────────────────────────────────────────────┐
│ [Floating Header Bar - game name, turn info, back button]    │
├──────┬───────────────────────────────────────┬───────────────┤
│      │                                       │               │
│ Left │         FULL-SCREEN BOARD             │    Right      │
│Panel │     (3D or 2D game board fills        │    Panel      │
│      │      entire viewport)                 │               │
│      │                                       │               │
│      │                                       │               │
├──────┴───────────────────────────────────────┴───────────────┤
│ [Optional Bottom Bar - resources, hand, quick actions]        │
└──────────────────────────────────────────────────────────────┘
```

All panels use glassmorphism: `bg-black/50 backdrop-blur-md border border-white/10`

---

# SECTION 10 — 3D RENDERING / CAMERA / TABLETOP PRESENTATION

## 10.1 Shared Renderer Architecture

One React Three Fiber Canvas instance per game, with shared:
- **Camera system**: Orbital controls with game-specific presets (distance, angle, limits)
- **Lighting rig**: Configurable warm/cool/dramatic presets per game
- **Table surface**: Wooden table base beneath all game boards
- **Material library**: PBR materials for wood, metal, plastic, fabric, paper
- **Post-processing**: Optional bloom, SSAO, fog per game config

## 10.2 Per-Game Camera Presets

| Game | Default View | Min Zoom | Max Zoom | Rotation |
|------|-------------|----------|----------|----------|
| Catan | 30° from vertical | 8 | 25 | Free |
| Risk | 35° from vertical | 10 | 50 | Free |
| Monopoly | 40° from vertical | 5 | 20 | Free |
| Codenames | Top-down (80°) | 5 | 15 | Limited |

## 10.3 Visual Realism Philosophy

**Stylized premium board-game aesthetic** — not photorealistic, not cartoonish.

Think: premium Kickstarter deluxe edition quality.
- Rich wood grain on table surfaces
- Metallic sheen on game pieces
- Soft shadows with warm ambient light
- Subtle depth-of-field when focusing
- Clean, readable text overlays
- Smooth 60fps animations

---

# SECTION 11 — MULTIPLAYER / NETWORKING / SESSION ARCHITECTURE

## 11.1 Architecture: Authoritative Server

```
Client A ──┐
Client B ──┼──→ WebSocket Server ──→ Game Instance (Rules + State)
Client C ──┘         │
                     ├──→ Filtered state → Client A
                     ├──→ Filtered state → Client B
                     └──→ Filtered state → Client C
```

## 11.2 Session Lifecycle

```
CREATE_ROOM → CONFIGURE → SEATS_FILL → START_GAME → 
  PLAYING → (PAUSE?) → GAME_OVER → REMATCH? → CLEANUP
```

## 11.3 Reconnect Protocol

1. Client sends `RECONNECT { matchId, playerId, lastVersion }`
2. Server validates player belongs to match
3. Server sends `SNAPSHOT { state, version }` (visibility-filtered)
4. Server sends `DELTA_BATCH { deltas[] }` for missed updates
5. Client resumes from current state

## 11.4 Latency Tolerance

Turn-based games are naturally latency-tolerant. Commands are queued and processed server-side. The only time-sensitive element is timers, which run server-side with client display sync.

---

# SECTION 12 — SOCIAL / NEGOTIATION / COMMUNICATION

## 12.1 Shared Social Systems

| System | Implementation | Game-Specific Customization |
|--------|---------------|---------------------------|
| Text chat | Shared WebSocket channel | Game-specific channels (team, trade) |
| Voice | WebRTC (shared infrastructure) | Team-only voice in Codenames |
| Emotes | Shared emote picker + animations | Game-themed emote packs |
| Trade offers | Shared offer/accept/counter framework | Catan: resources. Monopoly: properties+cash |
| Diplomacy | Shared private messaging | Risk: alliance proposals |
| Reactions | Shared reaction system | Game-specific trigger moments |

## 12.2 Negotiation Framework

```typescript
interface NegotiationOffer {
  id: string;
  type: 'trade' | 'alliance' | 'ceasefire' | 'custom';
  fromSeat: number;
  toSeat: number | null; // null = public offer
  offering: OfferContent; // Game-specific
  requesting: OfferContent; // Game-specific
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  expiresAt: number;
  counterOfferId: string | null;
}
```

---

# SECTION 13 — AI / ANALYTICS / ASSIST LAYERS

## 13.1 Bot Architecture

```typescript
interface BotModule<TState> {
  difficulty: 'beginner' | 'intermediate' | 'expert';
  selectCommand(state: GameMatch<TState>, seatIndex: number, validCommands: Command[]): Command;
  evaluateTradeOffer(state: GameMatch<TState>, offer: NegotiationOffer): 'accept' | 'reject' | NegotiationOffer;
  getThinkingDelay(): number; // Simulate human-like delay
}
```

## 13.2 Assist Systems (Non-Intrusive)

- **Probability overlays**: Show dice/resource probabilities on hover (toggle-able)
- **Legal move highlighting**: Show valid placement positions
- **Trade fairness indicator**: Rough value comparison (optional)
- **Clue legality checker**: Warn if clue might be illegal (Codenames)
- **Win probability**: Post-game analytics only (never during play)

Principle: **Help players understand, never play for them.**

---

# SECTION 14 — REPLAY / EVENT LOG / TELEMETRY

## 14.1 Event Taxonomy

```typescript
interface GameEvent {
  id: string;
  timestamp: number;
  type: string;
  seatIndex: number | null;
  visibility: Visibility;
  data: Record<string, unknown>;
}
```

Categories:
- **Game events**: Roll, build, attack, trade, clue, guess
- **Social events**: Chat, emote, offer, accept
- **System events**: Connect, disconnect, timeout, phase change
- **Analytics events**: Decision time, hover patterns, undo attempts

## 14.2 Replay System

- Full command log enables deterministic replay
- Replay viewer shows state at any point in time
- Visibility toggles: watch as player X, as spectator, as omniscient
- Speed controls: 1x, 2x, 4x, step-by-step

---

# SECTION 15 — CONTENT PIPELINE / ASSET PIPELINE

## 15.1 Game Configuration Schema

Each game defines its content in declarative JSON/YAML:

```yaml
# Example: Risk territory config
territories:
  - id: alaska
    name: "Alaska"
    continent: north-america
    neighbors: [northwest-territory, alberta, kamchatka]
    position: { x: 55, y: 75 }
    biome: tundra
```

## 15.2 Content Types

| Content Type | Format | Authored By |
|-------------|--------|-------------|
| Board layouts | JSON graph definitions | Designers |
| Card decks | JSON card definitions | Designers |
| Word packs | Text files / JSON arrays | Designers / Community |
| Visual themes | Asset bundles (textures, models) | Artists |
| Rule variants | JSON rule overrides | Designers |
| Localization | i18n JSON files | Translators |
| Tutorial scripts | JSON step sequences | Designers |

---

# SECTION 16 — BACKEND SERVICES

## Service Architecture

```
┌─────────────┐  ┌──────────────┐  ┌──────────────┐
│ Auth Service │  │ Profile Svc  │  │ Social Svc   │
│ (JWT, OAuth) │  │ (stats, prefs)│  │ (friends,    │
│              │  │              │  │  presence)    │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └────────┬────────┴────────┬────────┘
                │                 │
        ┌───────▼───────┐  ┌─────▼──────────┐
        │ Room/Session  │  │ Game Instance  │
        │ Service       │  │ Service        │
        │ (create, join,│  │ (rules engine, │
        │  configure)   │  │  state, cmds)  │
        └───────┬───────┘  └─────┬──────────┘
                │                │
        ┌───────▼────────────────▼──────────┐
        │         WebSocket Gateway          │
        │  (connection mgmt, routing,        │
        │   state sync, reconnect)           │
        └───────┬───────────────────────────┘
                │
        ┌───────▼───────┐  ┌────────────────┐
        │ Replay/Store  │  │ Analytics      │
        │ Service       │  │ Pipeline       │
        └───────────────┘  └────────────────┘
```

---

# SECTION 17 — PLATFORM SHELL

## 17.1 Cross-Game Features

- **Unified account**: Email/OAuth login, one profile across all games
- **Player profile**: Avatar, display name, per-game stats, achievements
- **Friends list**: Add/remove/block, online status, invite to room
- **Room browser**: Filter by game type, player count, status
- **Private rooms**: Room codes for friend groups
- **Quick play**: Matchmake into a game with bots/strangers
- **Game launcher**: Visual selection of the 4 games
- **Settings**: Global audio/graphics/controls + per-game overrides

---

# SECTION 18 — HYBRID LOCAL + REMOTE ARCHITECTURE

## 18.1 What to build now vs later

| Capability | When | Justification |
|-----------|------|---------------|
| Remote multiplayer (PC) | **Now** | Core product |
| Hot-seat local play | **Now** | Easy, valuable for demos |
| Shared screen mode | **Phase 2** | Venue/party use case |
| Touch table support | **Phase 3** | Specialized hardware |
| VR hooks (input adapter) | **Phase 2** | Keep interface clean for it |
| Camera-fed presence | **Phase 4+** | R&D complexity |
| Venue admin dashboard | **Phase 3** | B2B feature |

## 18.2 Engine Preparation

The engine already separates input handling from game logic:
- Input → Command → Server → State → Presentation
- This pipeline works identically whether input comes from mouse, touch, VR controller, or venue tablet
- Adding new input sources requires only writing new input adapters, not changing game logic

---

# SECTION 19 — QUALITY / TESTING / VALIDATION

## 19.1 Test Categories

| Category | What It Tests | Automation |
|----------|--------------|------------|
| Rules unit tests | Every legal/illegal command per game | Full |
| State transition tests | Phase advancement, turn cycling | Full |
| Visibility tests | Hidden info never leaks | Full |
| Sync tests | Client/server state match | Full |
| Replay fidelity | Replay produces identical state | Full |
| Determinism tests | Same seed + commands = same result | Full |
| Disconnect tests | Reconnect recovers correctly | Integration |
| Timer tests | Timeouts trigger correct fallbacks | Integration |
| UI state tests | HUD reflects state accurately | E2E |
| Abuse tests | Rapid commands, malformed data | Fuzz |

---

# SECTION 20 — PERFORMANCE / SCALABILITY

## 20.1 Performance Budgets

| Metric | Budget |
|--------|--------|
| Frame rate | 60fps on mid-range hardware |
| State sync latency | < 100ms for turn-based |
| 3D scene triangles | < 500K per game |
| Memory (client) | < 512MB |
| Bundle size (initial) | < 5MB, lazy-load game modules |
| WebSocket messages | < 10/sec during play |
| Server: matches per instance | 100+ concurrent |

## 20.2 Live Ops

- **Feature flags**: Enable/disable features per game without deployment
- **Content hot-reload**: New word packs, card decks without code changes
- **Server rolling updates**: Zero-downtime deployments
- **Client version check**: Force reload on breaking changes
- **Error tracking**: Sentry/similar for crash diagnostics
- **Analytics dashboard**: Player counts, game durations, drop rates

---

# SECTION 21 — ENGINE PACKAGE STRUCTURE

```
packages/
├── @tableforge/platform-shell        # Accounts, rooms, friends, launcher
├── @tableforge/core-state           # State container, visibility, sync
├── @tableforge/rules-framework      # Command processor, phase machine
├── @tableforge/board-model          # Spatial graph, zones, pieces
├── @tableforge/interaction-core     # Input handling, selection, commands
├── @tableforge/render-core          # Three.js setup, camera, lighting, materials
├── @tableforge/ui-shared            # Shared React components, glassmorphism panels
├── @tableforge/social-core          # Chat, voice, emotes, negotiation
├── @tableforge/replay-core          # Event log, replay timeline
├── @tableforge/analytics-core       # Telemetry, event tracking
├── @tableforge/content-sdk          # Content loading, schemas, localization
├── @tableforge/networking           # WebSocket, state sync, reconnect
│
├── @tableforge/game-catan           # Catan rules, board, content, UI adapter
├── @tableforge/game-risk            # Risk rules, board, content, UI adapter
├── @tableforge/game-monopoly        # Monopoly rules, board, content, UI adapter
├── @tableforge/game-codenames       # Codenames rules, board, content, UI adapter
│
├── @tableforge/server-gateway       # WebSocket gateway, routing
├── @tableforge/server-game-instance # Game instance runner, rules execution
├── @tableforge/server-auth          # Authentication, JWT
├── @tableforge/server-social        # Friends, presence, moderation
└── @tableforge/server-storage       # Persistence, replay storage
```

### Package Dependency Rules

- `game-*` packages may depend on `core-*`, `rules-framework`, `board-model`, `ui-shared`, `render-core`
- `game-*` packages MUST NOT depend on each other
- `core-*` packages MUST NOT depend on `game-*` packages
- `server-*` packages may depend on `core-*` and `rules-framework`
- `platform-shell` depends on `ui-shared` and `networking`

---

# SECTION 22 — CROSS-GAME SHARED UX DESIGN LANGUAGE

## 22.1 Visual Standards

- **Background**: Dark theme (slate-900 to black gradient)
- **Panels**: Glassmorphism (`bg-black/50 backdrop-blur-md border border-white/10`)
- **Typography**: White primary, slate-400 secondary, game-color accents
- **Accent colors**: Each game has a signature color (Catan=orange, Risk=red, Monopoly=purple, Codenames=pink)
- **Interactive elements**: Rounded corners, hover glow, press feedback
- **Animations**: 200ms transitions, ease-out, no excessive motion

## 22.2 Information Density Policy

- **Always visible**: Current player, phase, available actions
- **On demand**: Detailed stats, history, settings
- **Contextual**: Build options only during build phase, trade UI only during trade
- **Minimized**: Logs, chat (expandable)

## 22.3 Accessibility

- Color-blind safe palettes (patterns in addition to colors)
- Screen reader labels on interactive elements
- Keyboard navigation support
- Configurable text size
- High contrast mode option

---

# SECTION 23 — GAME-SPECIFIC ADAPTER MODEL

## A. Catan (Hex Settlement / Resource Trade Strategy)

| Aspect | Implementation |
|--------|---------------|
| **Board model** | Hex grid (19 tiles) + vertex/edge graph |
| **Rules module** | CatanRulesModule: setup → roll → (discard/robber) → main → end-turn |
| **Custom state** | Resources per player, development cards, longest road, largest army |
| **Custom UI** | Resource panel, build cost reference, trade offer panel, robber placement |
| **Custom content** | Hex terrain types, number tokens, development card deck, harbor configs |
| **Hidden info** | Development cards (owner only), VP cards (owner only until win) |
| **Interaction** | Click vertex (settlement/city), click edge (road), click hex (robber) |
| **Shared systems used** | State engine, phase machine, negotiation framework, dice roller, deck shuffler |

## B. Risk (Global Conquest / Reinforcement / Diplomacy)

| Aspect | Implementation |
|--------|---------------|
| **Board model** | Territory graph (42 nodes) + continent zones |
| **Rules module** | RiskRulesModule: setup → reinforce → attack → fortify → next |
| **Custom state** | Armies per territory, ownership, cards, eliminated players |
| **Custom UI** | Army count displays, attack dice panel, fortify slider, card trade UI |
| **Custom content** | Territory definitions, continent bonuses, card deck, variant rules |
| **Hidden info** | Cards in hand (owner only), secret missions (variant) |
| **Interaction** | Click territory (select/attack/fortify), drag armies, dice roll |
| **Shared systems used** | State engine, phase machine, dice roller, deck shuffler, card system |

## C. Monopoly (Property Economy / Auction / Negotiation)

| Aspect | Implementation |
|--------|---------------|
| **Board model** | Cyclic graph (40 spaces) + property color groups |
| **Rules module** | MonopolyRulesModule: roll → move → land → (buy/auction/rent/card) → build/trade → end |
| **Custom state** | Cash per player, property ownership, houses/hotels, jail state |
| **Custom UI** | Property cards, financial summary, auction bidding, mortgage indicators |
| **Custom content** | Board spaces, chance/community cards, property values |
| **Hidden info** | Minimal (some card draws are private) |
| **Interaction** | Roll dice, buy/decline, bid, trade proposal, build houses |
| **Shared systems used** | State engine, phase machine, auction framework, negotiation, dice roller |

## D. Codenames (Word-Clue / Team Deduction)

| Aspect | Implementation |
|--------|---------------|
| **Board model** | 5×5 card grid |
| **Rules module** | CodenamesRulesModule: give-clue → guess → [repeat] → game-over |
| **Custom state** | Card types (hidden), revealed cards, current clue, scores |
| **Custom UI** | Card grid (two views: spymaster/operative), clue input, guess counter |
| **Custom content** | Word packs, custom word lists, language packs |
| **Hidden info** | Card types (spymaster only), clue thought process |
| **Interaction** | Type clue + number, click card to guess, pass turn |
| **Shared systems used** | State engine, phase machine, team/role system, visibility framework |

---

# SECTION 24 — WHAT MUST BE DECIDED FIRST

| Decision | Why Early | What Breaks If Late |
|----------|-----------|-------------------|
| **Authoritative state model** | Everything depends on how state flows | Rewriting state sync, visibility, replay |
| **Command/event model** | All game logic builds on this | Incompatible rules modules |
| **Visibility framework** | Hidden info is structural, not decorative | Security vulnerabilities, information leaks |
| **Phase machine interface** | All four games need it | Per-game phase hacks |
| **Board abstraction** | Rendering and rules both depend on it | Duplicated spatial logic |
| **Package boundaries** | Determines what can depend on what | Circular dependencies, build issues |
| **UI shell pattern** | Full-screen + floating panels must be consistent | Per-game UI chaos |
| **Networking protocol** | Command format, state sync format | Incompatible client/server |
| **Content schema format** | All game content authored in this format | Migration nightmares |
| **Replay strategy** | Affects state model, event model, storage | Can't add replay retroactively |

---

# SECTION 25 — RECOMMENDED PROMPT ORDER FOR CONTINUING

## Phase 1: Foundation (Architecture Lock)
1. Finalize `core-state` + `rules-framework` TypeScript interfaces
2. Finalize `board-model` abstraction with all 4 game types validated
3. Finalize `networking` protocol (command format, state sync, visibility filtering)
4. Finalize `ui-shared` component library + glassmorphism design system

## Phase 2: Per-Game Deep Design
5. Catan: Complete rules schema, state types, all edge cases, UI screen inventory
6. Risk: Complete rules schema, state types, all edge cases, UI screen inventory
7. Monopoly: Complete rules schema, state types, all edge cases, UI screen inventory
8. Codenames: Complete rules schema, state types, all edge cases, UI screen inventory

## Phase 3: Implementation Planning
9. Backend service architecture: API contracts, database schemas, WebSocket protocol
10. Frontend implementation: Component tree, state management, 3D scene architecture
11. Content pipeline: How to author boards, cards, word packs, themes
12. Testing strategy: Test matrix per game, integration test plan

## Phase 4: Visual & Polish
13. 3D rendering architecture: Materials, lighting, camera, animation system
14. Per-game visual design: Board materials, piece models, effect specifications
15. Audio design: Per-game soundscapes, UI sounds, music system
16. Accessibility and localization plan

## Phase 5: Production
17. Deployment architecture: CI/CD, staging, production, monitoring
18. Live ops: Feature flags, content deployment, analytics dashboards
19. Security audit: Anti-cheat, hidden info verification, abuse prevention
20. Performance optimization: Bundle splitting, LOD, network optimization

---

*This document is the architectural foundation for TableForge. All implementation work should reference this document to maintain coherence across the platform.*
