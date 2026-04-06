# TableForge — Architecture Decisions

## 1. Game Engine Architecture

Each board game is a **self-contained module** under `apps/web/src/games/<game>/`:

| Game | Engine File | Page File | Route |
|------|------------|-----------|-------|
| Catan | `CatanEngine.ts` | `CatanGamePage.tsx` | `/games/catan` |
| Monopoly | `MonopolyEngine.ts` + `MonopolyBoard3D.tsx` | `MonopolyGamePage.tsx` | `/games/monopoly` |
| Risk | `RiskEngine.ts` | `RiskGamePage.tsx` | `/games/risk` |
| Codenames | `CodenamesEngine.ts` | `CodenamesGamePage.tsx` | `/games/codenames` |

**Pattern**: Each engine is a pure TypeScript module exporting:
- `GameState` type
- `createInitialGameState(playerNames)` factory
- Immutable state transition functions (e.g. `performRoll`, `buyProperty`, `endTurn`)
- Query helpers (e.g. `getCurrentPlayer`, `canAttack`)

Game pages consume engines via `useState` + `useCallback`, keeping all game logic outside React.

## 2. Navigation Flow

```
Landing Page (/)
  ├─ "Try a Demo Game" → /games/codenames
  ├─ "Sign In" → /login
  └─ "Join Waitlist" → /waitlist

Dashboard (/dashboard) [auth required]
  ├─ Game Cards → /games/catan | /games/monopoly | /games/risk | /games/codenames
  ├─ Player Dashboard → /player
  ├─ Create Room → dialog → /game/:roomCode
  └─ Join Room → dialog → /game/:roomCode

Game Room (/game/:roomCode)
  └─ Game selection lobby → /games/<game>

Player Dashboard (/player)
  └─ Quick Match cards → /games/<game>

All game pages have ← Back to Dashboard navigation.
```

## 3. Presence Realism & Camera Strategy (VR)

### Decision: Camera-Mediated Presence
- **Local players** see the board from a fixed overhead or angled perspective
- **VR players** get a seated-at-table viewpoint with head tracking
- **Spectators** orbit freely around the board
- Camera mode is determined by device detection, not user choice

### Phase 1 (Current — MVP)
- 2D SVG boards for Catan, Risk, Codenames
- 3D board for Monopoly (react-three-fiber)
- All interaction via mouse/touch clicks
- No multiplayer sync yet (local hot-seat play)

### Phase 2 (Planned)
- WebSocket room sync via backend API
- Real-time game state broadcast
- Player presence indicators (who's connected, whose turn)

### Phase 3 (Future)
- WebXR integration for Quest 3
- 3D boards for all games
- Hand tracking for piece manipulation
- Spatial audio for dice rolls and card draws

## 4. VR Interaction Model

### Decision: Clarity-First Manual Manipulation
- Pieces are grabbed and placed deliberately (no physics throw)
- Snap-to-grid for settlements, roads, territories
- Dice: press button to roll (physics sim visual only, outcome is RNG)
- Cards: tap to flip/select (no physical card manipulation)

### Rationale
Prioritizing game correctness over physical realism. Players should never accidentally move pieces or trigger unintended actions.

## 5. Source of Truth

| Concern | Source of Truth |
|---------|----------------|
| Game rules & state | `*Engine.ts` files (pure TS) |
| UI layout & interaction | `*GamePage.tsx` files (React) |
| Auth & user data | Backend API (Hono + JWT) |
| Room management | Backend API (`/api/rooms/*`) |
| Real-time sync | Planned: WebSocket via backend |

## 6. Phased Decision Locking

| Decision | Status | Locked? |
|----------|--------|---------|
| 4 games: Catan, Monopoly, Risk, Codenames | Implemented | ✅ Locked |
| Pure TS game engines | Implemented | ✅ Locked |
| React + react-router-dom frontend | Implemented | ✅ Locked |
| Hono + JWT backend | Implemented | ✅ Locked |
| Local hot-seat play first | Implemented | ✅ Locked |
| WebSocket multiplayer | Planned | 🔓 Open |
| WebXR/VR integration | Planned | 🔓 Open |
| 3D boards for all games | Planned | 🔓 Open |
| AI opponents | Not started | 🔓 Open |

## 7. Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **3D**: react-three-fiber, @react-three/drei (Monopoly board, future VR)
- **Routing**: react-router-dom v6
- **State**: React useState (game state), React Query (API data)
- **Backend**: Hono, JWT auth, Drizzle ORM
- **Animation**: framer-motion (landing page)
