/**
 * TableForge Game Engine
 * Implements One Page Rules (OPR) Grimdark Future core mechanics
 * 
 * This is a simplified implementation for MVP - full rules would require
 * extensive unit data and special abilities.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface UnitStats {
  quality: number;      // Target number for Quality tests (2-6)
  defense: number;      // Target number for Defense saves (2-6)
  tough: number;        // Wounds before removal (1+)
  speed: number;        // Movement in inches
  weapons: Weapon[];
  specialRules: SpecialRule[];
}

export interface Weapon {
  name: string;
  range: number;        // 0 = melee
  attacks: number;      // Number of attack dice
  ap: number;           // Armor Piercing (modifies defense)
  specialRules: WeaponSpecialRule[];
}

export type WeaponSpecialRule = 
  | 'blast'             // +1 hit per model in unit
  | 'deadly'            // +1 damage per hit
  | 'rending'           // Unmodified 6 to hit = AP(4)
  | 'sniper'            // Pick target model
  | 'indirect'          // Ignore cover
  | 'reliable'          // Reroll 1s to hit
  | 'poison'            // Unmodified 6 to hit = auto-wound
  | 'lock-on'           // +1 to hit vs vehicles
  | 'furious'           // +1 attack on charge
  | 'impact'            // Extra hits on charge;

export type SpecialRule =
  | 'fearless'          // Ignore morale
  | 'fast'              // +2" movement
  | 'slow'              // -2" movement
  | 'flying'            // Ignore terrain
  | 'stealth'           // -1 to be hit at range
  | 'tough'             // Extra wounds
  | 'regeneration'      // Heal wounds
  | 'hero'              // Can join units
  | 'strider'           // Ignore difficult terrain
  | 'ambush'            // Deploy from reserve
  | 'scout';            // Free move at start

export interface GameUnit {
  id: string;
  name: string;
  playerId: string;
  stats: UnitStats;
  currentWounds: number;
  position: { x: number; y: number };
  hasActivated: boolean;
  hasMoved: boolean;
  hasShot: boolean;
  hasCharged: boolean;
  hasFought: boolean;
  isInMelee: boolean;
  morale: 'steady' | 'shaken' | 'routed';
}

export interface GameState {
  id: string;
  turn: number;
  phase: GamePhase;
  activePlayerId: string;
  players: GamePlayer[];
  units: GameUnit[];
  objectivePoints: ObjectivePoint[];
  gameLog: GameLogEntry[];
  diceResults: DiceResult[];
}

export type GamePhase = 
  | 'deployment'
  | 'round-start'
  | 'activation'
  | 'melee'
  | 'morale'
  | 'round-end'
  | 'game-over';

export interface GamePlayer {
  id: string;
  name: string;
  faction: string;
  victoryPoints: number;
  commandPoints: number;
}

export interface ObjectivePoint {
  id: string;
  position: { x: number; y: number };
  controlledBy: string | null;
  pointsValue: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  playerName: string;
  action: string;
  details?: Record<string, unknown>;
}

export interface DiceResult {
  id: string;
  playerId: string;
  type: 'quality' | 'defense' | 'morale';
  dice: number[];
  target: number;
  successes: number;
  timestamp: number;
}

// ============================================================================
// DICE ROLLING
// ============================================================================

export function rollD6(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

export function countSuccesses(dice: number[], target: number): number {
  return dice.filter(d => d >= target).length;
}

export function rollQualityTest(
  attacks: number, 
  quality: number, 
  modifiers: { rerollOnes?: boolean; bonus?: number } = {}
): { dice: number[]; successes: number; rerolled?: number[] } {
  let dice = rollD6(attacks);
  const target = Math.max(2, Math.min(6, quality - (modifiers.bonus || 0)));
  
  let rerolled: number[] | undefined;
  if (modifiers.rerollOnes) {
    const ones = dice.filter(d => d === 1);
    if (ones.length > 0) {
      rerolled = rollD6(ones.length);
      dice = [...dice.filter(d => d !== 1), ...rerolled];
    }
  }
  
  return {
    dice,
    successes: countSuccesses(dice, target),
    rerolled,
  };
}

export function rollDefenseTest(
  wounds: number,
  defense: number,
  ap: number
): { dice: number[]; saves: number; damageDealt: number } {
  const dice = rollD6(wounds);
  const modifiedDefense = Math.min(6, defense + ap);
  const saves = countSuccesses(dice, modifiedDefense);
  
  return {
    dice,
    saves,
    damageDealt: wounds - saves,
  };
}

export function rollMoraleTest(
  casualties: number,
  quality: number
): { dice: number[]; passed: boolean } {
  const dice = rollD6(1);
  // Need to roll equal or under casualties on D6, but also pass quality
  const passed = dice[0] >= quality || dice[0] > casualties;
  
  return { dice, passed };
}

// ============================================================================
// DISTANCE & MOVEMENT
// ============================================================================

export function calculateDistance(
  from: { x: number; y: number },
  to: { x: number; y: number }
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function isInRange(
  attacker: GameUnit,
  target: GameUnit,
  weapon: Weapon
): boolean {
  if (weapon.range === 0) {
    // Melee - must be in base contact (within 1")
    return calculateDistance(attacker.position, target.position) <= 1;
  }
  return calculateDistance(attacker.position, target.position) <= weapon.range;
}

export function canMove(unit: GameUnit, distance: number): boolean {
  if (unit.hasActivated || unit.hasMoved) return false;
  if (unit.isInMelee) return false;
  
  let maxMove = unit.stats.speed;
  if (unit.stats.specialRules.includes('fast')) maxMove += 2;
  if (unit.stats.specialRules.includes('slow')) maxMove -= 2;
  
  return distance <= maxMove;
}

export function canCharge(unit: GameUnit, target: GameUnit): boolean {
  if (unit.hasActivated || unit.hasCharged) return false;
  if (unit.isInMelee) return false;
  
  const distance = calculateDistance(unit.position, target.position);
  const chargeRange = 12; // Standard charge range
  
  return distance <= chargeRange;
}

// ============================================================================
// COMBAT RESOLUTION
// ============================================================================

export interface AttackResult {
  attacker: GameUnit;
  target: GameUnit;
  weapon: Weapon;
  hitRoll: { dice: number[]; successes: number };
  defenseRoll: { dice: number[]; saves: number; damageDealt: number };
  woundsInflicted: number;
  targetDestroyed: boolean;
}

export function resolveAttack(
  attacker: GameUnit,
  target: GameUnit,
  weapon: Weapon,
  isCharging: boolean = false
): AttackResult {
  // Calculate attacks
  let attacks = weapon.attacks;
  if (isCharging && weapon.specialRules.includes('furious')) {
    attacks += 1;
  }
  
  // Hit roll
  let hitBonus = 0;
  if (target.stats.specialRules.includes('stealth') && weapon.range > 0) {
    hitBonus -= 1;
  }
  
  const hitRoll = rollQualityTest(attacks, attacker.stats.quality, {
    rerollOnes: weapon.specialRules.includes('reliable'),
    bonus: hitBonus,
  });
  
  // Check for special hit effects
  let wounds = hitRoll.successes;
  
  // Rending: 6s to hit become AP(4)
  const rendingHits = weapon.specialRules.includes('rending') 
    ? hitRoll.dice.filter(d => d === 6).length 
    : 0;
  
  // Calculate AP
  let ap = weapon.ap;
  
  // Defense roll for non-rending hits
  const normalWounds = wounds - rendingHits;
  let totalDamage = 0;
  
  if (normalWounds > 0) {
    const normalDefense = rollDefenseTest(normalWounds, target.stats.defense, ap);
    totalDamage += normalDefense.damageDealt;
  }
  
  // Rending hits at AP(4)
  if (rendingHits > 0) {
    const rendingDefense = rollDefenseTest(rendingHits, target.stats.defense, 4);
    totalDamage += rendingDefense.damageDealt;
  }
  
  // Apply deadly
  if (weapon.specialRules.includes('deadly') && totalDamage > 0) {
    totalDamage += hitRoll.successes; // +1 per original hit
  }
  
  // Apply damage
  const newWounds = Math.max(0, target.currentWounds - totalDamage);
  const targetDestroyed = newWounds === 0;
  
  return {
    attacker,
    target,
    weapon,
    hitRoll,
    defenseRoll: { dice: [], saves: 0, damageDealt: totalDamage },
    woundsInflicted: totalDamage,
    targetDestroyed,
  };
}

// ============================================================================
// GAME STATE MANAGEMENT
// ============================================================================

export function createInitialGameState(
  players: { id: string; name: string; faction: string }[],
  units: GameUnit[]
): GameState {
  return {
    id: generateId(),
    turn: 0,
    phase: 'deployment',
    activePlayerId: players[0]?.id || '',
    players: players.map(p => ({
      ...p,
      victoryPoints: 0,
      commandPoints: 3,
    })),
    units,
    objectivePoints: [],
    gameLog: [],
    diceResults: [],
  };
}

export function advancePhase(state: GameState): GameState {
  const phases: GamePhase[] = [
    'deployment',
    'round-start',
    'activation',
    'melee',
    'morale',
    'round-end',
  ];
  
  const currentIndex = phases.indexOf(state.phase);
  
  if (state.phase === 'round-end') {
    // Start new round
    return {
      ...state,
      turn: state.turn + 1,
      phase: 'round-start',
      units: state.units.map(u => ({
        ...u,
        hasActivated: false,
        hasMoved: false,
        hasShot: false,
        hasCharged: false,
        hasFought: false,
      })),
    };
  }
  
  if (state.phase === 'deployment' && state.turn === 0) {
    return {
      ...state,
      turn: 1,
      phase: 'round-start',
    };
  }
  
  return {
    ...state,
    phase: phases[currentIndex + 1] || 'game-over',
  };
}

export function activateUnit(state: GameState, unitId: string): GameState {
  return {
    ...state,
    units: state.units.map(u => 
      u.id === unitId ? { ...u, hasActivated: true } : u
    ),
  };
}

export function moveUnit(
  state: GameState, 
  unitId: string, 
  newPosition: { x: number; y: number }
): GameState {
  return {
    ...state,
    units: state.units.map(u => 
      u.id === unitId 
        ? { ...u, position: newPosition, hasMoved: true } 
        : u
    ),
  };
}

export function applyDamage(
  state: GameState,
  unitId: string,
  damage: number
): GameState {
  return {
    ...state,
    units: state.units.map(u => {
      if (u.id !== unitId) return u;
      const newWounds = Math.max(0, u.currentWounds - damage);
      return { ...u, currentWounds: newWounds };
    }).filter(u => u.currentWounds > 0), // Remove destroyed units
  };
}

export function addLogEntry(
  state: GameState,
  playerId: string,
  playerName: string,
  action: string,
  details?: Record<string, unknown>
): GameState {
  return {
    ...state,
    gameLog: [
      ...state.gameLog,
      {
        id: generateId(),
        timestamp: Date.now(),
        playerId,
        playerName,
        action,
        details,
      },
    ],
  };
}

export function checkVictoryConditions(state: GameState): {
  gameOver: boolean;
  winner: string | null;
  reason: string;
} {
  // Check if one player has no units
  const playerUnits = state.players.map(p => ({
    playerId: p.id,
    unitCount: state.units.filter(u => u.playerId === p.id).length,
  }));
  
  const eliminatedPlayers = playerUnits.filter(p => p.unitCount === 0);
  
  if (eliminatedPlayers.length === state.players.length - 1) {
    const winner = playerUnits.find(p => p.unitCount > 0);
    return {
      gameOver: true,
      winner: winner?.playerId || null,
      reason: 'All enemy units destroyed',
    };
  }
  
  // Check turn limit (5 turns standard)
  if (state.turn >= 5 && state.phase === 'round-end') {
    const scores = state.players.map(p => ({
      playerId: p.id,
      score: p.victoryPoints,
    }));
    
    scores.sort((a, b) => b.score - a.score);
    
    if (scores[0].score > scores[1]?.score) {
      return {
        gameOver: true,
        winner: scores[0].playerId,
        reason: 'Victory points',
      };
    }
    
    return {
      gameOver: true,
      winner: null,
      reason: 'Draw',
    };
  }
  
  return { gameOver: false, winner: null, reason: '' };
}

// ============================================================================
// HELPERS
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ============================================================================
// SAMPLE UNIT DATA (OPR Grimdark Future)
// ============================================================================

export const SAMPLE_UNITS: Record<string, UnitStats> = {
  'battle-brother': {
    quality: 3,
    defense: 4,
    tough: 1,
    speed: 6,
    weapons: [
      { name: 'Rifle', range: 24, attacks: 1, ap: 1, specialRules: [] },
      { name: 'CCW', range: 0, attacks: 1, ap: 0, specialRules: [] },
    ],
    specialRules: ['fearless'],
  },
  'battle-brother-sergeant': {
    quality: 3,
    defense: 4,
    tough: 1,
    speed: 6,
    weapons: [
      { name: 'Pistol', range: 12, attacks: 1, ap: 1, specialRules: [] },
      { name: 'Power Sword', range: 0, attacks: 2, ap: 2, specialRules: [] },
    ],
    specialRules: ['fearless', 'hero'],
  },
  'heavy-weapons-brother': {
    quality: 3,
    defense: 4,
    tough: 1,
    speed: 6,
    weapons: [
      { name: 'Heavy Machinegun', range: 36, attacks: 3, ap: 1, specialRules: ['reliable'] },
      { name: 'CCW', range: 0, attacks: 1, ap: 0, specialRules: [] },
    ],
    specialRules: ['fearless'],
  },
  'assault-brother': {
    quality: 3,
    defense: 4,
    tough: 1,
    speed: 6,
    weapons: [
      { name: 'Pistol', range: 12, attacks: 1, ap: 1, specialRules: [] },
      { name: 'Chainsword', range: 0, attacks: 2, ap: 1, specialRules: ['rending'] },
    ],
    specialRules: ['fearless', 'fast'],
  },
  'robot-grunt': {
    quality: 5,
    defense: 5,
    tough: 1,
    speed: 5,
    weapons: [
      { name: 'Gauss Rifle', range: 24, attacks: 1, ap: 2, specialRules: [] },
      { name: 'Metal Claws', range: 0, attacks: 1, ap: 0, specialRules: [] },
    ],
    specialRules: ['regeneration'],
  },
  'robot-destroyer': {
    quality: 5,
    defense: 4,
    tough: 3,
    weapons: [
      { name: 'Heavy Gauss', range: 36, attacks: 2, ap: 3, specialRules: ['deadly'] },
      { name: 'Metal Claws', range: 0, attacks: 2, ap: 1, specialRules: [] },
    ],
    speed: 5,
    specialRules: ['regeneration', 'tough'],
  },
};

export default {
  rollD6,
  countSuccesses,
  rollQualityTest,
  rollDefenseTest,
  rollMoraleTest,
  calculateDistance,
  isInRange,
  canMove,
  canCharge,
  resolveAttack,
  createInitialGameState,
  advancePhase,
  activateUnit,
  moveUnit,
  applyDamage,
  addLogEntry,
  checkVictoryConditions,
  SAMPLE_UNITS,
};
