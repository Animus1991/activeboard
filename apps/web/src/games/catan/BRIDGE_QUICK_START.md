# Catan State Bridge — Quick Start Guide

## TL;DR

The Catan game now has a **unified state system** that bridges the legacy `GameState` with the AAA-grade `CatanMatchState`. Both models stay in sync automatically.

### Use the Hook

```typescript
import { useCatanUnifiedState } from './useCatanUnifiedState';

function MyComponent() {
  const { gameState, matchState, setGameState } = useCatanUnifiedState();
  
  // gameState: lightweight runtime state (for UI)
  // matchState: authoritative state (for persistence/backend)
  // Both stay in sync automatically
  
  return <div>{gameState.players[0].name}</div>;
}
```

---

## Common Tasks

### 1. Update Game State

```typescript
const { setGameState } = useCatanUnifiedState();

// Update and auto-sync to matchState
setGameState(prev => ({
  ...prev,
  currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
}));
```

### 2. Save Game to Storage

```typescript
const { matchState } = useCatanUnifiedState();

const saveGame = () => {
  // Save the authoritative state
  localStorage.setItem('catan_save', JSON.stringify(matchState));
};
```

### 3. Load Game from Storage

```typescript
const { setMatchState, validateConsistency } = useCatanUnifiedState();

const loadGame = () => {
  const saved = JSON.parse(localStorage.getItem('catan_save') || '{}');
  setMatchState(saved);
  
  // Validate after loading
  const errors = validateConsistency();
  if (errors.length > 0) {
    console.warn('Loaded state has issues:', errors);
  }
};
```

### 4. Sync to Backend

```typescript
const { matchState } = useCatanUnifiedState();

const syncToServer = async () => {
  const response = await fetch('/api/games/catan/sync', {
    method: 'POST',
    body: JSON.stringify({
      matchId: matchState.meta.matchId,
      state: matchState,
      sequence: matchState.log.sequence,
    }),
  });
  return response.json();
};
```

### 5. Check State Health

```typescript
const { validateConsistency, hasConsistencyErrors } = useCatanUnifiedState();

if (hasConsistencyErrors) {
  console.error('State is out of sync!');
  const errors = validateConsistency();
  console.error(errors);
}
```

### 6. Create Type-Safe IDs

```typescript
import { BrandedIds } from './CatanStateBridge';

const playerId = BrandedIds.playerId('player-0');
const matchId = BrandedIds.matchId(`match-${Date.now()}`);
const hexId = BrandedIds.hexId('hex-5');

// TypeScript prevents mixing types
const p: PlayerId = matchId; // ❌ Error!
```

---

## State Structure

### GameState (Runtime)

```typescript
{
  id: string;
  players: Player[];
  hexTiles: HexTile[];
  vertices: Vertex[];
  edges: Edge[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turn: number;
  diceRoll: [number, number] | null;
  robberHexId: number;
  // ... more fields
}
```

**Use for:** UI rendering, immediate gameplay, animations

### CatanMatchState (Authoritative)

```typescript
{
  meta: {
    matchId: MatchId;
    createdAt: UnixMs;
    gameVersion: string;
    playerOrder: PlayerId[];
    // ... more fields
  };
  rules: RulesConfigState;
  lifecycle: LifecycleState;
  board: BoardState;
  players: Record<PlayerId, PlayerState>;
  turn: TurnState;
  dice: DiceState;
  robber: RobberState;
  bank: BankState;
  developmentDeck: DevelopmentDeckState;
  specialCards: SpecialCardsState;
  trade: TradeState;
  build: BuildState;
  log: EventLogState;  // All events stored here
  projections: ProjectionState;
  render: RenderState;
  diagnostics: DiagnosticsState;
}
```

**Use for:** Persistence, backend sync, event sourcing, validation

---

## Type Conversions

### Terrain Types

| GameState | CatanMatchState |
|-----------|-----------------|
| `'forest'` | `'FOREST'` |
| `'hills'` | `'HILLS'` |
| `'pasture'` | `'PASTURE'` |
| `'fields'` | `'FIELDS'` |
| `'mountains'` | `'MOUNTAINS'` |
| `'desert'` | `'DESERT'` |

### Resource Types

| GameState | CatanMatchState |
|-----------|-----------------|
| `'wood'` | `'WOOD'` |
| `'brick'` | `'BRICK'` |
| `'sheep'` | `'SHEEP'` |
| `'wheat'` | `'WHEAT'` |
| `'ore'` | `'ORE'` |

### Development Card Types

| GameState | CatanMatchState |
|-----------|-----------------|
| `'knight'` | `'KNIGHT'` |
| `'victory-point'` | `'VICTORY_POINT'` |
| `'road-building'` | `'ROAD_BUILDING'` |
| `'year-of-plenty'` | `'YEAR_OF_PLENTY'` |
| `'monopoly'` | `'MONOPOLY'` |

### Game Phases

| GameState | CatanMatchState |
|-----------|-----------------|
| `'setup-settlement'` | `'SETUP_ROUND_1_PLACE_SETTLEMENT'` |
| `'setup-road'` | `'SETUP_ROUND_1_PLACE_ROAD'` |
| `'roll'` | `'TURN_ROLL_DICE'` |
| `'robber-move'` | `'TURN_MOVE_ROBBER'` |
| `'robber-steal'` | `'TURN_STEAL_RESOURCE'` |
| `'discard'` | `'TURN_HANDLE_SEVEN_DISCARDS'` |
| `'main'` | `'TURN_BUILD'` |
| `'trade'` | `'TURN_TRADE'` |
| `'build'` | `'TURN_BUILD'` |
| `'development-card'` | `'TURN_OPTIONAL_DEV_CARD'` |
| `'game-over'` | `'GAME_OVER'` |

---

## Troubleshooting

### "State is out of sync"

```typescript
const { validateConsistency, syncToMatchState, syncToGameState } = useCatanUnifiedState();

const errors = validateConsistency();
if (errors.length > 0) {
  console.error(errors);
  
  // Trust GameState (runtime)
  syncToMatchState();
  
  // OR trust MatchState (authoritative)
  syncToGameState();
}
```

### "Type 'string' is not assignable to type 'PlayerId'"

```typescript
// ❌ Wrong
const playerId: PlayerId = 'player-0';

// ✅ Right
import { BrandedIds } from './CatanStateBridge';
const playerId = BrandedIds.playerId('player-0');
```

### "Cannot read property 'name' of undefined"

```typescript
// ❌ Wrong (matchState uses branded IDs as keys)
const player = matchState.players['player-0'];

// ✅ Right
const playerId = BrandedIds.playerId('player-0');
const player = matchState.players[playerId];
```

### "Saved state doesn't load correctly"

```typescript
const { setMatchState, validateConsistency } = useCatanUnifiedState();

const loadGame = () => {
  const saved = JSON.parse(localStorage.getItem('catan_save') || '{}');
  
  // Always validate after loading
  setMatchState(saved);
  const errors = validateConsistency();
  
  if (errors.length > 0) {
    console.warn('Loaded state has issues:', errors);
    // Handle: reset, show error, etc.
  }
};
```

---

## Best Practices

### ✅ DO

- Use `useCatanUnifiedState()` in new code
- Read from `gameState` for UI rendering
- Read from `matchState` for persistence/backend
- Call `validateConsistency()` after loading state
- Use `BrandedIds` for type-safe IDs
- Update through `setGameState()` or `setMatchState()`

### ❌ DON'T

- Mutate state directly (`gameState.turn = 5`)
- Mix GameState and MatchState types
- Use string IDs without `BrandedIds`
- Forget to validate after loading
- Store GameState in localStorage (use MatchState)
- Assume both models are always in sync (validate!)

---

## File Locations

| File | Purpose |
|------|---------|
| `CatanStateBridge.ts` | Conversion, validation, type mapping |
| `useCatanUnifiedState.ts` | React hook for state management |
| `MIGRATION_GUIDE.md` | Detailed migration instructions |
| `BRIDGE_IMPLEMENTATION_SUMMARY.md` | Architecture and design |
| `BRIDGE_QUICK_START.md` | This file |

---

## Need Help?

1. **Quick question?** → Check this file
2. **How to migrate?** → Read `MIGRATION_GUIDE.md`
3. **Architecture details?** → Read `BRIDGE_IMPLEMENTATION_SUMMARY.md`
4. **Implementation details?** → Read `CatanStateBridge.ts` source code
5. **Hook API?** → Read `useCatanUnifiedState.ts` source code

---

## Examples

### Complete Component Example

```typescript
import { useCatanUnifiedState } from './useCatanUnifiedState';
import { BrandedIds } from './CatanStateBridge';

export function CatanGamePage() {
  const {
    gameState,
    matchState,
    setGameState,
    validateConsistency,
    hasConsistencyErrors,
  } = useCatanUnifiedState({
    vpToWin: 10,
    gameMode: 'VARIABLE_SETUP',
  });

  // Render UI from gameState
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  const handleRollDice = () => {
    setGameState(prev => ({
      ...prev,
      diceRoll: [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1],
    }));
    // Auto-syncs to matchState
  };

  const handleSaveGame = () => {
    // Save authoritative state
    localStorage.setItem('catan_save', JSON.stringify(matchState));
  };

  const handleLoadGame = () => {
    const saved = JSON.parse(localStorage.getItem('catan_save') || '{}');
    // Note: This would need to be wrapped in a proper load function
    // that updates matchState and validates
  };

  if (hasConsistencyErrors) {
    return <div>State consistency error! {validateConsistency().join(', ')}</div>;
  }

  return (
    <div>
      <h1>Catan Game</h1>
      <p>Current player: {currentPlayer.name}</p>
      <p>Turn: {gameState.turn}</p>
      <button onClick={handleRollDice}>Roll Dice</button>
      <button onClick={handleSaveGame}>Save Game</button>
    </div>
  );
}
```

---

**Last Updated:** April 2026  
**Status:** ✅ Production Ready  
**Breaking Changes:** None
