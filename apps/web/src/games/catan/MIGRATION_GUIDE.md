# Catan State Model Migration Guide

## Overview

The Catan game system has two state models:

1. **GameState** (CatanEngine.ts) — Lightweight, functional, runtime state
2. **CatanMatchState** (catanMatchState.ts) — AAA-grade, branded types, event-sourcing ready

This guide explains how to migrate from the legacy GameState to the unified state system without breaking existing code.

---

## Architecture

### The Bridge Layer

`CatanStateBridge.ts` provides bidirectional conversion between the two models:

```typescript
// Convert legacy GameState to AAA CatanMatchState
const matchState = CatanStateBridge.gameStateToMatchState(
  gameState,
  matchId,
  createdBy,
  'classic',
  10 // vpToWin
);

// Extract GameState from CatanMatchState (lossy)
const extracted = CatanStateBridge.matchStateToGameState(matchState);

// Validate consistency
const errors = CatanStateBridge.validateConsistency(gameState, matchState);
```

### The Unified Hook

`useCatanUnifiedState.ts` manages both models in sync:

```typescript
const {
  gameState,        // Runtime state (lightweight)
  setGameState,     // Update runtime state
  matchState,       // Authoritative state (AAA)
  setMatchState,    // Update authoritative state
  syncToMatchState, // Manual sync GameState → MatchState
  syncToGameState,  // Manual sync MatchState → GameState
  validateConsistency,
  hasConsistencyErrors,
  matchId,
  createdBy,
} = useCatanUnifiedState({
  vpToWin: 10,
  gameMode: 'classic',
});
```

---

## Migration Phases

### Phase 1: Coexistence (Current)

Both models exist in parallel. The bridge keeps them synchronized.

**What to do:**
- Use `useCatanUnifiedState()` in new code
- Existing code continues using `GameState` directly
- Both are kept in sync automatically

**Example:**

```typescript
// New code — use unified state
function CatanGamePageNew() {
  const { gameState, matchState, setGameState } = useCatanUnifiedState();
  
  // gameState is still the runtime state
  // matchState is the authoritative state
  // Both stay in sync
  
  return <CatanBoard gameState={gameState} />;
}

// Old code — still works
function CatanGamePageOld() {
  const [gameState, setGameState] = useState<GameState>(...);
  
  // No changes needed — this still works
  return <CatanBoard gameState={gameState} />;
}
```

### Phase 2: Gradual Adoption

Migrate components to use the unified hook incrementally.

**What to do:**
- Replace `useState<GameState>` with `useCatanUnifiedState()`
- Update components to read from `matchState` where appropriate
- Use `matchState` for persistence, backend sync, and event sourcing

**Example:**

```typescript
// Before
function PlayerPanel({ gameState, onUpdate }: Props) {
  return <div>{gameState.players[0].name}</div>;
}

// After — use unified state
function PlayerPanel() {
  const { gameState, matchState } = useCatanUnifiedState();
  
  // Use gameState for runtime UI
  // Use matchState for persistence/backend
  return <div>{gameState.players[0].name}</div>;
}
```

### Phase 3: Full Migration

Replace all GameState usage with CatanMatchState.

**What to do:**
- Remove all `useState<GameState>` declarations
- Use `useCatanUnifiedState()` exclusively
- Update all type signatures to use branded types
- Remove the bridge layer (it becomes internal)

**Example:**

```typescript
// After full migration
function CatanGamePage() {
  const { matchState, setMatchState } = useCatanUnifiedState();
  
  // matchState is now the single source of truth
  // All operations use branded types
  const activePlayer = matchState.players[matchState.turn.activePlayerId];
  
  return <CatanBoard matchState={matchState} />;
}
```

---

## Type System

### Branded Types

The new system uses branded types for type safety:

```typescript
type PlayerId = Brand<string, "PlayerId">;
type MatchId = Brand<string, "MatchId">;
type HexId = Brand<string, "HexId">;
type VertexId = Brand<string, "VertexId">;
type EdgeId = Brand<string, "EdgeId">;
```

### Creating Branded IDs

Use the `BrandedIds` helper:

```typescript
import { BrandedIds } from './CatanStateBridge';

const playerId = BrandedIds.playerId('player-0');
const matchId = BrandedIds.matchId(`match-${Date.now()}`);
const hexId = BrandedIds.hexId('hex-5');
```

### Type Conversion

The bridge handles type conversion automatically:

```typescript
// GameState uses simple strings
const gameState: GameState = {
  players: [{ id: 'player-0', ... }],
  ...
};

// CatanMatchState uses branded types
const matchState: CatanMatchState = {
  players: {
    ['player-0' as PlayerId]: { id: 'player-0' as PlayerId, ... }
  },
  ...
};

// Bridge converts automatically
const converted = CatanStateBridge.gameStateToMatchState(gameState, ...);
```

---

## Persistence & Backend Integration

### Saving State

Use `matchState` for persistence (it's the authoritative model):

```typescript
function useCatanPersistence() {
  const { matchState } = useCatanUnifiedState();
  
  const saveGame = () => {
    // Save matchState to localStorage or backend
    localStorage.setItem('catan_save', JSON.stringify(matchState));
  };
  
  const loadGame = () => {
    // Load matchState from localStorage or backend
    const saved = JSON.parse(localStorage.getItem('catan_save') || '{}');
    return saved as CatanMatchState;
  };
  
  return { saveGame, loadGame };
}
```

### Backend Sync

Use `matchState` for server communication:

```typescript
async function syncGameToServer(matchState: CatanMatchState) {
  // Send authoritative state to backend
  const response = await fetch('/api/games/catan/sync', {
    method: 'POST',
    body: JSON.stringify({
      matchId: matchState.meta.matchId,
      state: matchState,
      sequence: matchState.log.sequence,
    }),
  });
  
  return response.json();
}
```

### Event Sourcing

Use `matchState.log` for event sourcing:

```typescript
function getGameHistory(matchState: CatanMatchState) {
  // All events are stored in matchState.log
  return matchState.log.events.map(evt => ({
    sequence: evt.sequence,
    timestamp: evt.emittedAt,
    player: evt.causedByPlayerId,
    event: evt.event,
  }));
}
```

---

## Validation & Consistency

### Checking Consistency

Use the validation function to ensure both models stay in sync:

```typescript
const { gameState, matchState, validateConsistency } = useCatanUnifiedState();

// Check consistency
const errors = validateConsistency();
if (errors.length > 0) {
  console.error('State consistency errors:', errors);
  // Handle inconsistency (log, alert, etc.)
}
```

### Common Consistency Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Player count mismatch | GameState and MatchState have different player counts | Ensure both are updated together |
| Turn number mismatch | GameState.turn ≠ MatchState.turn.turnNumber | Use `syncToMatchState()` |
| Active player mismatch | Current player differs between models | Use `syncToGameState()` |

---

## Best Practices

### 1. Use the Unified Hook

Always use `useCatanUnifiedState()` in new code:

```typescript
// ✅ Good
const { gameState, matchState, setGameState } = useCatanUnifiedState();

// ❌ Avoid
const [gameState, setGameState] = useState<GameState>(...);
```

### 2. Read from the Right Model

- **GameState**: UI rendering, immediate gameplay
- **MatchState**: Persistence, backend sync, event sourcing

```typescript
// ✅ Good
function PlayerPanel() {
  const { gameState } = useCatanUnifiedState();
  return <div>{gameState.players[0].name}</div>; // UI
}

function SaveGame() {
  const { matchState } = useCatanUnifiedState();
  localStorage.setItem('save', JSON.stringify(matchState)); // Persistence
}

// ❌ Avoid mixing
function BadComponent() {
  const { gameState, matchState } = useCatanUnifiedState();
  // Don't use matchState for UI rendering
  return <div>{matchState.players['player-0'].displayName}</div>;
}
```

### 3. Keep Models in Sync

Always update through `setGameState()` or `setMatchState()`, never directly mutate:

```typescript
// ✅ Good
setGameState(prev => ({
  ...prev,
  currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
}));

// ❌ Avoid
gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
```

### 4. Validate on Load

When loading state from persistence, validate consistency:

```typescript
function loadGameFromStorage() {
  const { setMatchState, validateConsistency } = useCatanUnifiedState();
  
  const saved = JSON.parse(localStorage.getItem('save') || '{}');
  setMatchState(saved);
  
  const errors = validateConsistency();
  if (errors.length > 0) {
    console.warn('Loaded state has consistency issues:', errors);
  }
}
```

---

## Troubleshooting

### State is out of sync

**Problem:** GameState and MatchState have different values

**Solution:**
```typescript
const { syncToMatchState, syncToGameState, validateConsistency } = useCatanUnifiedState();

// Check what's wrong
const errors = validateConsistency();
console.error(errors);

// Sync to fix
if (errors.length > 0) {
  syncToMatchState(); // Trust GameState
  // or
  syncToGameState();  // Trust MatchState
}
```

### Type errors with branded IDs

**Problem:** `Type 'string' is not assignable to type 'PlayerId'`

**Solution:**
```typescript
import { BrandedIds } from './CatanStateBridge';

// ❌ Wrong
const playerId: PlayerId = 'player-0';

// ✅ Right
const playerId = BrandedIds.playerId('player-0');
```

### Persistence not working

**Problem:** Saved state doesn't load correctly

**Solution:**
```typescript
// Always save matchState (authoritative)
const { matchState } = useCatanUnifiedState();
localStorage.setItem('save', JSON.stringify(matchState));

// When loading, validate
const saved = JSON.parse(localStorage.getItem('save') || '{}');
const { setMatchState, validateConsistency } = useCatanUnifiedState();
setMatchState(saved);
validateConsistency();
```

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Coexistence | 2-4 weeks | ✅ Current |
| Phase 2: Gradual Adoption | 4-8 weeks | ⏳ Next |
| Phase 3: Full Migration | 2-4 weeks | 📋 Planned |

---

## Questions?

Refer to:
- `CatanStateBridge.ts` — Bridge implementation
- `useCatanUnifiedState.ts` — Hook implementation
- `domain/model/catanMatchState.ts` — Type definitions
- `CatanEngine.ts` — Legacy GameState types
