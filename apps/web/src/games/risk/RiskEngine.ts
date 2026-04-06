/**
 * TableForge - Risk Game Engine
 * Complete implementation of Risk rules with world domination
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ContinentName = 
  | 'north-america' | 'south-america' | 'europe' 
  | 'africa' | 'asia' | 'australia';

export interface Territory {
  id: string;
  name: string;
  continent: ContinentName;
  neighbors: string[];
  armies: number;
  ownerId: string | null;
  position: { x: number; y: number };
}

export interface Continent {
  id: ContinentName;
  name: string;
  bonus: number;
  territories: string[];
  color: string;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  cards: Card[];
  territoriesOwned: number;
  armiesDeployed: number;
  isEliminated: boolean;
  conqueredThisTurn: boolean;
}

export interface Card {
  id: string;
  territoryId: string | null;  // null for wild cards
  type: 'infantry' | 'cavalry' | 'artillery' | 'wild';
}

export interface GameState {
  id: string;
  players: Player[];
  territories: Territory[];
  continents: Continent[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turn: number;
  reinforcements: number;
  selectedTerritory: string | null;
  attackingFrom: string | null;
  attackingTo: string | null;
  lastDiceRoll: DiceRoll | null;
  cardDeck: Card[];
  tradedSets: number;
  winner: string | null;
  log: GameLogEntry[];
}

export type GamePhase = 
  | 'setup-claim'
  | 'setup-reinforce'
  | 'reinforce'
  | 'attack'
  | 'fortify'
  | 'game-over';

export interface DiceRoll {
  attacker: number[];
  defender: number[];
  attackerLosses: number;
  defenderLosses: number;
}

export interface GameLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  message: string;
  type: 'attack' | 'reinforce' | 'fortify' | 'card' | 'system';
}

// ============================================================================
// CONTINENT DATA
// ============================================================================

export const CONTINENTS: Continent[] = [
  {
    id: 'north-america',
    name: 'North America',
    bonus: 5,
    territories: ['alaska', 'northwest-territory', 'greenland', 'alberta', 'ontario', 'quebec', 'western-us', 'eastern-us', 'central-america'],
    color: '#FFD700',
  },
  {
    id: 'south-america',
    name: 'South America',
    bonus: 2,
    territories: ['venezuela', 'peru', 'brazil', 'argentina'],
    color: '#FF6347',
  },
  {
    id: 'europe',
    name: 'Europe',
    bonus: 5,
    territories: ['iceland', 'scandinavia', 'great-britain', 'northern-europe', 'western-europe', 'southern-europe', 'ukraine'],
    color: '#4169E1',
  },
  {
    id: 'africa',
    name: 'Africa',
    bonus: 3,
    territories: ['north-africa', 'egypt', 'east-africa', 'congo', 'south-africa', 'madagascar'],
    color: '#8B4513',
  },
  {
    id: 'asia',
    name: 'Asia',
    bonus: 7,
    territories: ['ural', 'siberia', 'yakutsk', 'kamchatka', 'irkutsk', 'mongolia', 'japan', 'afghanistan', 'china', 'middle-east', 'india', 'siam'],
    color: '#228B22',
  },
  {
    id: 'australia',
    name: 'Australia',
    bonus: 2,
    territories: ['indonesia', 'new-guinea', 'western-australia', 'eastern-australia'],
    color: '#9932CC',
  },
];

// ============================================================================
// TERRITORY DATA
// ============================================================================

export const TERRITORIES: Omit<Territory, 'armies' | 'ownerId'>[] = [
  // North America
  { id: 'alaska', name: 'Alaska', continent: 'north-america', neighbors: ['northwest-territory', 'alberta', 'kamchatka'], position: { x: 50, y: 80 } },
  { id: 'northwest-territory', name: 'Northwest Territory', continent: 'north-america', neighbors: ['alaska', 'alberta', 'ontario', 'greenland'], position: { x: 120, y: 70 } },
  { id: 'greenland', name: 'Greenland', continent: 'north-america', neighbors: ['northwest-territory', 'ontario', 'quebec', 'iceland'], position: { x: 280, y: 50 } },
  { id: 'alberta', name: 'Alberta', continent: 'north-america', neighbors: ['alaska', 'northwest-territory', 'ontario', 'western-us'], position: { x: 100, y: 120 } },
  { id: 'ontario', name: 'Ontario', continent: 'north-america', neighbors: ['northwest-territory', 'alberta', 'western-us', 'eastern-us', 'quebec', 'greenland'], position: { x: 160, y: 130 } },
  { id: 'quebec', name: 'Quebec', continent: 'north-america', neighbors: ['ontario', 'eastern-us', 'greenland'], position: { x: 220, y: 130 } },
  { id: 'western-us', name: 'Western US', continent: 'north-america', neighbors: ['alberta', 'ontario', 'eastern-us', 'central-america'], position: { x: 100, y: 180 } },
  { id: 'eastern-us', name: 'Eastern US', continent: 'north-america', neighbors: ['western-us', 'ontario', 'quebec', 'central-america'], position: { x: 170, y: 200 } },
  { id: 'central-america', name: 'Central America', continent: 'north-america', neighbors: ['western-us', 'eastern-us', 'venezuela'], position: { x: 130, y: 260 } },
  
  // South America
  { id: 'venezuela', name: 'Venezuela', continent: 'south-america', neighbors: ['central-america', 'peru', 'brazil'], position: { x: 180, y: 310 } },
  { id: 'peru', name: 'Peru', continent: 'south-america', neighbors: ['venezuela', 'brazil', 'argentina'], position: { x: 170, y: 380 } },
  { id: 'brazil', name: 'Brazil', continent: 'south-america', neighbors: ['venezuela', 'peru', 'argentina', 'north-africa'], position: { x: 230, y: 370 } },
  { id: 'argentina', name: 'Argentina', continent: 'south-america', neighbors: ['peru', 'brazil'], position: { x: 190, y: 460 } },
  
  // Europe
  { id: 'iceland', name: 'Iceland', continent: 'europe', neighbors: ['greenland', 'scandinavia', 'great-britain'], position: { x: 350, y: 80 } },
  { id: 'scandinavia', name: 'Scandinavia', continent: 'europe', neighbors: ['iceland', 'great-britain', 'northern-europe', 'ukraine'], position: { x: 420, y: 80 } },
  { id: 'great-britain', name: 'Great Britain', continent: 'europe', neighbors: ['iceland', 'scandinavia', 'northern-europe', 'western-europe'], position: { x: 360, y: 140 } },
  { id: 'northern-europe', name: 'Northern Europe', continent: 'europe', neighbors: ['scandinavia', 'great-britain', 'western-europe', 'southern-europe', 'ukraine'], position: { x: 420, y: 150 } },
  { id: 'western-europe', name: 'Western Europe', continent: 'europe', neighbors: ['great-britain', 'northern-europe', 'southern-europe', 'north-africa'], position: { x: 370, y: 210 } },
  { id: 'southern-europe', name: 'Southern Europe', continent: 'europe', neighbors: ['western-europe', 'northern-europe', 'ukraine', 'north-africa', 'egypt', 'middle-east'], position: { x: 430, y: 200 } },
  { id: 'ukraine', name: 'Ukraine', continent: 'europe', neighbors: ['scandinavia', 'northern-europe', 'southern-europe', 'ural', 'afghanistan', 'middle-east'], position: { x: 490, y: 130 } },
  
  // Africa
  { id: 'north-africa', name: 'North Africa', continent: 'africa', neighbors: ['western-europe', 'southern-europe', 'egypt', 'east-africa', 'congo', 'brazil'], position: { x: 380, y: 300 } },
  { id: 'egypt', name: 'Egypt', continent: 'africa', neighbors: ['southern-europe', 'north-africa', 'east-africa', 'middle-east'], position: { x: 450, y: 280 } },
  { id: 'east-africa', name: 'East Africa', continent: 'africa', neighbors: ['egypt', 'north-africa', 'congo', 'south-africa', 'madagascar', 'middle-east'], position: { x: 470, y: 350 } },
  { id: 'congo', name: 'Congo', continent: 'africa', neighbors: ['north-africa', 'east-africa', 'south-africa'], position: { x: 430, y: 380 } },
  { id: 'south-africa', name: 'South Africa', continent: 'africa', neighbors: ['congo', 'east-africa', 'madagascar'], position: { x: 440, y: 450 } },
  { id: 'madagascar', name: 'Madagascar', continent: 'africa', neighbors: ['east-africa', 'south-africa'], position: { x: 510, y: 430 } },
  
  // Asia
  { id: 'ural', name: 'Ural', continent: 'asia', neighbors: ['ukraine', 'siberia', 'china', 'afghanistan'], position: { x: 550, y: 100 } },
  { id: 'siberia', name: 'Siberia', continent: 'asia', neighbors: ['ural', 'yakutsk', 'irkutsk', 'mongolia', 'china'], position: { x: 600, y: 70 } },
  { id: 'yakutsk', name: 'Yakutsk', continent: 'asia', neighbors: ['siberia', 'kamchatka', 'irkutsk'], position: { x: 660, y: 50 } },
  { id: 'kamchatka', name: 'Kamchatka', continent: 'asia', neighbors: ['yakutsk', 'irkutsk', 'mongolia', 'japan', 'alaska'], position: { x: 720, y: 70 } },
  { id: 'irkutsk', name: 'Irkutsk', continent: 'asia', neighbors: ['siberia', 'yakutsk', 'kamchatka', 'mongolia'], position: { x: 640, y: 110 } },
  { id: 'mongolia', name: 'Mongolia', continent: 'asia', neighbors: ['siberia', 'irkutsk', 'kamchatka', 'japan', 'china'], position: { x: 650, y: 160 } },
  { id: 'japan', name: 'Japan', continent: 'asia', neighbors: ['kamchatka', 'mongolia'], position: { x: 730, y: 170 } },
  { id: 'afghanistan', name: 'Afghanistan', continent: 'asia', neighbors: ['ukraine', 'ural', 'china', 'india', 'middle-east'], position: { x: 540, y: 180 } },
  { id: 'china', name: 'China', continent: 'asia', neighbors: ['ural', 'siberia', 'mongolia', 'afghanistan', 'india', 'siam'], position: { x: 620, y: 210 } },
  { id: 'middle-east', name: 'Middle East', continent: 'asia', neighbors: ['ukraine', 'southern-europe', 'egypt', 'east-africa', 'afghanistan', 'india'], position: { x: 500, y: 250 } },
  { id: 'india', name: 'India', continent: 'asia', neighbors: ['middle-east', 'afghanistan', 'china', 'siam'], position: { x: 580, y: 280 } },
  { id: 'siam', name: 'Siam', continent: 'asia', neighbors: ['india', 'china', 'indonesia'], position: { x: 630, y: 310 } },
  
  // Australia
  { id: 'indonesia', name: 'Indonesia', continent: 'australia', neighbors: ['siam', 'new-guinea', 'western-australia'], position: { x: 650, y: 380 } },
  { id: 'new-guinea', name: 'New Guinea', continent: 'australia', neighbors: ['indonesia', 'eastern-australia', 'western-australia'], position: { x: 720, y: 370 } },
  { id: 'western-australia', name: 'Western Australia', continent: 'australia', neighbors: ['indonesia', 'new-guinea', 'eastern-australia'], position: { x: 680, y: 450 } },
  { id: 'eastern-australia', name: 'Eastern Australia', continent: 'australia', neighbors: ['new-guinea', 'western-australia'], position: { x: 740, y: 450 } },
];

export const PLAYER_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22'];

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateCardDeck(): Card[] {
  const cards: Card[] = [];
  const types: Card['type'][] = ['infantry', 'cavalry', 'artillery'];
  
  TERRITORIES.forEach((territory, index) => {
    cards.push({
      id: `card-${territory.id}`,
      territoryId: territory.id,
      type: types[index % 3],
    });
  });
  
  // Add 2 wild cards
  cards.push({ id: 'wild-1', territoryId: null, type: 'wild' });
  cards.push({ id: 'wild-2', territoryId: null, type: 'wild' });
  
  return shuffle(cards);
}

export function createInitialGameState(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    cards: [],
    territoriesOwned: 0,
    armiesDeployed: 0,
    isEliminated: false,
    conqueredThisTurn: false,
  }));

  // Initialize territories
  const territories: Territory[] = TERRITORIES.map(t => ({
    ...t,
    armies: 0,
    ownerId: null,
  }));

  // Randomly distribute territories
  const shuffledTerritories = shuffle([...territories]);
  shuffledTerritories.forEach((territory, index) => {
    const playerIndex = index % players.length;
    territory.ownerId = players[playerIndex].id;
    territory.armies = 1;
    players[playerIndex].territoriesOwned++;
  });

  // Calculate initial reinforcements based on player count
  const initialArmies = getInitialArmies(players.length);
  players.forEach(player => {
    player.armiesDeployed = player.territoriesOwned;
  });

  return {
    id: generateId(),
    players,
    territories: shuffledTerritories,
    continents: CONTINENTS,
    currentPlayerIndex: 0,
    phase: 'setup-reinforce',
    turn: 0,
    reinforcements: initialArmies - players[0].territoriesOwned,
    selectedTerritory: null,
    attackingFrom: null,
    attackingTo: null,
    lastDiceRoll: null,
    cardDeck: generateCardDeck(),
    tradedSets: 0,
    winner: null,
    log: [],
  };
}

function getInitialArmies(playerCount: number): number {
  switch (playerCount) {
    case 2: return 40;
    case 3: return 35;
    case 4: return 30;
    case 5: return 25;
    case 6: return 20;
    default: return 30;
  }
}

// ============================================================================
// GAME HELPERS
// ============================================================================

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getTerritory(state: GameState, territoryId: string): Territory | undefined {
  return state.territories.find(t => t.id === territoryId);
}

export function getPlayerTerritories(state: GameState, playerId: string): Territory[] {
  return state.territories.filter(t => t.ownerId === playerId);
}

export function calculateReinforcements(state: GameState, playerId: string): number {
  const playerTerritories = getPlayerTerritories(state, playerId);
  
  // Base reinforcements: territories / 3, minimum 3
  let reinforcements = Math.max(3, Math.floor(playerTerritories.length / 3));
  
  // Continent bonuses
  CONTINENTS.forEach(continent => {
    const continentTerritories = state.territories.filter(t => t.continent === continent.id);
    const ownedInContinent = continentTerritories.filter(t => t.ownerId === playerId);
    
    if (ownedInContinent.length === continentTerritories.length) {
      reinforcements += continent.bonus;
    }
  });
  
  return reinforcements;
}

export function canAttack(state: GameState, fromId: string, toId: string): boolean {
  const from = getTerritory(state, fromId);
  const to = getTerritory(state, toId);
  const currentPlayer = getCurrentPlayer(state);
  
  if (!from || !to) return false;
  if (from.ownerId !== currentPlayer.id) return false;
  if (to.ownerId === currentPlayer.id) return false;
  if (from.armies < 2) return false;
  if (!from.neighbors.includes(toId)) return false;
  
  return true;
}

export function canFortify(state: GameState, fromId: string, toId: string): boolean {
  const from = getTerritory(state, fromId);
  const to = getTerritory(state, toId);
  const currentPlayer = getCurrentPlayer(state);
  
  if (!from || !to) return false;
  if (from.ownerId !== currentPlayer.id) return false;
  if (to.ownerId !== currentPlayer.id) return false;
  if (from.armies < 2) return false;
  if (fromId === toId) return false;
  
  // Check if territories are connected through owned territories
  return areTerritoriesConnected(state, fromId, toId, currentPlayer.id);
}

function areTerritoriesConnected(state: GameState, fromId: string, toId: string, playerId: string): boolean {
  const visited = new Set<string>();
  const queue = [fromId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    
    const territory = getTerritory(state, current);
    if (!territory) continue;
    
    territory.neighbors.forEach(neighborId => {
      const neighbor = getTerritory(state, neighborId);
      if (neighbor && neighbor.ownerId === playerId && !visited.has(neighborId)) {
        queue.push(neighborId);
      }
    });
  }
  
  return false;
}

// ============================================================================
// GAME ACTIONS
// ============================================================================

export function placeArmies(state: GameState, territoryId: string, count: number): GameState {
  const territory = getTerritory(state, territoryId);
  const currentPlayer = getCurrentPlayer(state);
  
  if (!territory || territory.ownerId !== currentPlayer.id) return state;
  if (count > state.reinforcements) return state;
  
  const territoryIndex = state.territories.findIndex(t => t.id === territoryId);
  const updatedTerritories = [...state.territories];
  updatedTerritories[territoryIndex] = {
    ...territory,
    armies: territory.armies + count,
  };
  
  const newReinforcements = state.reinforcements - count;
  
  let newState: GameState = {
    ...state,
    territories: updatedTerritories,
    reinforcements: newReinforcements,
  };
  
  newState = addLog(newState, currentPlayer.id, `placed ${count} armies in ${territory.name}`, 'reinforce');
  
  // Auto-advance phase if no more reinforcements
  if (newReinforcements === 0) {
    if (state.phase === 'setup-reinforce') {
      // Check if all players have placed initial armies
      const allPlayersReady = state.players.every(p => {
        const territories = getPlayerTerritories(state, p.id);
        return territories.reduce((sum, t) => sum + t.armies, 0) >= getInitialArmies(state.players.length);
      });
      
      if (allPlayersReady) {
        return { ...newState, phase: 'reinforce', turn: 1, reinforcements: calculateReinforcements(newState, currentPlayer.id) };
      }
      
      return advanceToNextPlayer(newState);
    }
    
    return { ...newState, phase: 'attack' };
  }
  
  return newState;
}

export function rollDice(attackerCount: number, defenderCount: number): DiceRoll {
  const attackerDice = Array.from({ length: Math.min(attackerCount, 3) }, () => 
    Math.floor(Math.random() * 6) + 1
  ).sort((a, b) => b - a);
  
  const defenderDice = Array.from({ length: Math.min(defenderCount, 2) }, () => 
    Math.floor(Math.random() * 6) + 1
  ).sort((a, b) => b - a);
  
  let attackerLosses = 0;
  let defenderLosses = 0;
  
  const comparisons = Math.min(attackerDice.length, defenderDice.length);
  for (let i = 0; i < comparisons; i++) {
    if (attackerDice[i] > defenderDice[i]) {
      defenderLosses++;
    } else {
      attackerLosses++;
    }
  }
  
  return {
    attacker: attackerDice,
    defender: defenderDice,
    attackerLosses,
    defenderLosses,
  };
}

export function attack(state: GameState, fromId: string, toId: string, attackerDice: number): GameState {
  if (!canAttack(state, fromId, toId)) return state;
  
  const from = getTerritory(state, fromId)!;
  const to = getTerritory(state, toId)!;
  const currentPlayer = getCurrentPlayer(state);
  
  const maxAttackerDice = Math.min(3, from.armies - 1);
  const actualAttackerDice = Math.min(attackerDice, maxAttackerDice);
  const defenderDice = Math.min(2, to.armies);
  
  const dice = rollDice(actualAttackerDice, defenderDice);
  
  const fromIndex = state.territories.findIndex(t => t.id === fromId);
  const toIndex = state.territories.findIndex(t => t.id === toId);
  
  const updatedTerritories = [...state.territories];
  updatedTerritories[fromIndex] = {
    ...from,
    armies: from.armies - dice.attackerLosses,
  };
  updatedTerritories[toIndex] = {
    ...to,
    armies: to.armies - dice.defenderLosses,
  };
  
  let newState: GameState = {
    ...state,
    territories: updatedTerritories,
    lastDiceRoll: dice,
    attackingFrom: fromId,
    attackingTo: toId,
  };
  
  newState = addLog(newState, currentPlayer.id, 
    `attacked ${to.name} from ${from.name} (${dice.attacker.join(',')} vs ${dice.defender.join(',')})`, 
    'attack'
  );
  
  // Check if territory was conquered
  if (updatedTerritories[toIndex].armies <= 0) {
    return conquerTerritory(newState, fromId, toId, actualAttackerDice);
  }
  
  return newState;
}

function conquerTerritory(state: GameState, fromId: string, toId: string, attackingArmies: number): GameState {
  const from = getTerritory(state, fromId)!;
  const to = getTerritory(state, toId)!;
  const currentPlayer = getCurrentPlayer(state);
  const defenderId = to.ownerId;
  
  const fromIndex = state.territories.findIndex(t => t.id === fromId);
  const toIndex = state.territories.findIndex(t => t.id === toId);
  
  const updatedTerritories = [...state.territories];
  const armiesToMove = Math.min(attackingArmies, from.armies - 1);
  
  updatedTerritories[fromIndex] = {
    ...from,
    armies: from.armies - armiesToMove,
  };
  updatedTerritories[toIndex] = {
    ...to,
    armies: armiesToMove,
    ownerId: currentPlayer.id,
  };
  
  // Update player territory counts
  const updatedPlayers = state.players.map(p => {
    if (p.id === currentPlayer.id) {
      return { ...p, territoriesOwned: p.territoriesOwned + 1, conqueredThisTurn: true };
    }
    if (p.id === defenderId) {
      const newCount = p.territoriesOwned - 1;
      return { ...p, territoriesOwned: newCount, isEliminated: newCount === 0 };
    }
    return p;
  });
  
  let newState: GameState = {
    ...state,
    territories: updatedTerritories,
    players: updatedPlayers,
  };
  
  newState = addLog(newState, currentPlayer.id, `conquered ${to.name}!`, 'attack');
  
  // Check for elimination - transfer cards
  const defender = updatedPlayers.find(p => p.id === defenderId);
  if (defender?.isEliminated) {
    const defenderCards = defender.cards;
    const currentPlayerIndex = updatedPlayers.findIndex(p => p.id === currentPlayer.id);
    updatedPlayers[currentPlayerIndex] = {
      ...updatedPlayers[currentPlayerIndex],
      cards: [...updatedPlayers[currentPlayerIndex].cards, ...defenderCards],
    };
    
    const defenderIndex = updatedPlayers.findIndex(p => p.id === defenderId);
    updatedPlayers[defenderIndex] = { ...updatedPlayers[defenderIndex], cards: [] };
    
    newState = { ...newState, players: updatedPlayers };
    newState = addLog(newState, currentPlayer.id, `eliminated ${defender.name}!`, 'system');
  }
  
  // Check for winner
  const activePlayers = newState.players.filter(p => !p.isEliminated);
  if (activePlayers.length === 1) {
    newState = { ...newState, winner: activePlayers[0].id, phase: 'game-over' };
    newState = addLog(newState, activePlayers[0].id, 'won the game!', 'system');
  }
  
  return newState;
}

export function endAttackPhase(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state);
  
  // Draw card if conquered territory this turn
  let newState = state;
  if (currentPlayer.conqueredThisTurn && state.cardDeck.length > 0) {
    const card = state.cardDeck[0];
    const playerIndex = state.players.findIndex(p => p.id === currentPlayer.id);
    const updatedPlayers = [...state.players];
    updatedPlayers[playerIndex] = {
      ...currentPlayer,
      cards: [...currentPlayer.cards, card],
    };
    
    newState = {
      ...state,
      players: updatedPlayers,
      cardDeck: state.cardDeck.slice(1),
    };
  }
  
  return { ...newState, phase: 'fortify', attackingFrom: null, attackingTo: null, lastDiceRoll: null };
}

export function fortify(state: GameState, fromId: string, toId: string, count: number): GameState {
  if (!canFortify(state, fromId, toId)) return state;
  
  const from = getTerritory(state, fromId)!;
  const to = getTerritory(state, toId)!;
  const currentPlayer = getCurrentPlayer(state);
  
  const maxMove = from.armies - 1;
  const actualMove = Math.min(count, maxMove);
  
  const fromIndex = state.territories.findIndex(t => t.id === fromId);
  const toIndex = state.territories.findIndex(t => t.id === toId);
  
  const updatedTerritories = [...state.territories];
  updatedTerritories[fromIndex] = { ...from, armies: from.armies - actualMove };
  updatedTerritories[toIndex] = { ...to, armies: to.armies + actualMove };
  
  let newState: GameState = {
    ...state,
    territories: updatedTerritories,
  };
  
  newState = addLog(newState, currentPlayer.id, `moved ${actualMove} armies from ${from.name} to ${to.name}`, 'fortify');
  
  return advanceToNextPlayer(newState);
}

export function skipFortify(state: GameState): GameState {
  return advanceToNextPlayer(state);
}

function advanceToNextPlayer(state: GameState): GameState {
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  
  // Skip eliminated players
  while (state.players[nextIndex].isEliminated) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }
  
  const nextPlayer = state.players[nextIndex];
  const reinforcements = calculateReinforcements(state, nextPlayer.id);
  
  // Reset conquered flag for current player
  const updatedPlayers = state.players.map((p, i) => 
    i === state.currentPlayerIndex ? { ...p, conqueredThisTurn: false } : p
  );
  
  return {
    ...state,
    players: updatedPlayers,
    currentPlayerIndex: nextIndex,
    phase: 'reinforce',
    turn: state.turn + 1,
    reinforcements,
    selectedTerritory: null,
    attackingFrom: null,
    attackingTo: null,
    lastDiceRoll: null,
  };
}

// ============================================================================
// CARD TRADING
// ============================================================================

const CARD_SET_VALUES = [4, 6, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

export function isValidCardSet(cards: Card[]): boolean {
  if (cards.length !== 3) return false;
  const types = cards.map(c => c.type);
  const wilds = types.filter(t => t === 'wild').length;
  const nonWild = types.filter(t => t !== 'wild');
  
  // All same type (+ wilds)
  if (new Set(nonWild).size <= 1) return true;
  // All different types (+ wilds fill in)
  if (new Set(nonWild).size + wilds >= 3 && new Set(nonWild).size === nonWild.length) return true;
  
  return false;
}

export function tradeCards(state: GameState, playerId: string, cardIndices: [number, number, number]): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  if (!player || state.phase !== 'reinforce') return state;
  
  const selectedCards = cardIndices.map(i => player.cards[i]).filter(Boolean);
  if (!isValidCardSet(selectedCards)) return state;
  
  // Calculate bonus armies
  const setIndex = Math.min(state.tradedSets, CARD_SET_VALUES.length - 1);
  let bonusArmies = CARD_SET_VALUES[setIndex];
  
  // Bonus 2 armies if any traded card matches a territory you own
  const matchingTerritory = selectedCards.find(c => 
    c.territoryId && state.territories.find(t => t.id === c.territoryId && t.ownerId === playerId)
  );
  if (matchingTerritory) bonusArmies += 2;
  
  // Remove cards from player, return to deck
  const remainingCards = player.cards.filter((_, i) => !cardIndices.includes(i));
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = { ...player, cards: remainingCards };
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    reinforcements: state.reinforcements + bonusArmies,
    tradedSets: state.tradedSets + 1,
    cardDeck: [...state.cardDeck, ...selectedCards],
  };
  
  return addLog(newState, playerId, `traded cards for ${bonusArmies} bonus armies`, 'card');
}

// ============================================================================
// HELPERS
// ============================================================================

function addLog(state: GameState, playerId: string, message: string, type: GameLogEntry['type']): GameState {
  const player = state.players.find(p => p.id === playerId);
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: generateId(),
        timestamp: Date.now(),
        playerId,
        message: `${player?.name || 'Unknown'} ${message}`,
        type,
      },
    ],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createInitialGameState,
  getCurrentPlayer,
  getTerritory,
  getPlayerTerritories,
  calculateReinforcements,
  canAttack,
  canFortify,
  isValidCardSet,
  tradeCards,
  placeArmies,
  rollDice,
  attack,
  endAttackPhase,
  fortify,
  skipFortify,
  CONTINENTS,
  TERRITORIES,
  PLAYER_COLORS,
};
