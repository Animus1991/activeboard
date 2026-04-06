/**
 * TableForge - Monopoly Game Engine
 * Complete implementation of classic Monopoly rules
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type PropertyColor = 
  | 'brown' | 'lightBlue' | 'pink' | 'orange' 
  | 'red' | 'yellow' | 'green' | 'darkBlue'
  | 'railroad' | 'utility' | 'special';

export type SpaceType = 
  | 'property' | 'railroad' | 'utility' 
  | 'chance' | 'community-chest' | 'tax'
  | 'go' | 'jail' | 'free-parking' | 'go-to-jail';

export interface PropertySpace {
  id: number;
  name: string;
  type: 'property';
  color: PropertyColor;
  price: number;
  rent: number[];        // [base, 1house, 2houses, 3houses, 4houses, hotel]
  houseCost: number;
  mortgageValue: number;
}

export interface RailroadSpace {
  id: number;
  name: string;
  type: 'railroad';
  color: 'railroad';
  price: number;
  rent: number[];        // [1owned, 2owned, 3owned, 4owned]
  mortgageValue: number;
}

export interface UtilitySpace {
  id: number;
  name: string;
  type: 'utility';
  color: 'utility';
  price: number;
  mortgageValue: number;
}

export interface SpecialSpace {
  id: number;
  name: string;
  type: SpaceType;
  color: 'special';
  taxAmount?: number;
}

export type BoardSpace = PropertySpace | RailroadSpace | UtilitySpace | SpecialSpace;

export interface Player {
  id: string;
  name: string;
  color: string;
  money: number;
  position: number;
  properties: number[];
  inJail: boolean;
  jailTurns: number;
  getOutOfJailCards: number;
  isBankrupt: boolean;
  isAI: boolean;
}

export interface Property {
  spaceId: number;
  ownerId: string | null;
  houses: number;        // 0-4 houses, 5 = hotel
  isMortgaged: boolean;
}

export interface ChanceCard {
  id: number;
  text: string;
  action: CardAction;
}

export interface CommunityChestCard {
  id: number;
  text: string;
  action: CardAction;
}

export type CardAction = 
  | { type: 'collect'; amount: number }
  | { type: 'pay'; amount: number }
  | { type: 'payEach'; amount: number }
  | { type: 'collectEach'; amount: number }
  | { type: 'move'; position: number }
  | { type: 'moveBack'; spaces: number }
  | { type: 'goToJail' }
  | { type: 'getOutOfJail' }
  | { type: 'repairs'; perHouse: number; perHotel: number }
  | { type: 'moveToNearest'; spaceType: 'railroad' | 'utility' }
  | { type: 'advance'; to: string };

export interface GameState {
  id: string;
  players: Player[];
  properties: Property[];
  currentPlayerIndex: number;
  phase: GamePhase;
  diceRoll: [number, number] | null;
  doublesCount: number;
  chanceCards: number[];
  communityChestCards: number[];
  freeParking: number;
  houses: number;
  hotels: number;
  turnNumber: number;
  winner: string | null;
  log: GameLogEntry[];
  pendingAction: PendingAction | null;
}

export type GamePhase = 
  | 'waiting'
  | 'roll'
  | 'moving'
  | 'landed'
  | 'buy-decision'
  | 'auction'
  | 'card-action'
  | 'pay-rent'
  | 'jail-decision'
  | 'trade'
  | 'build'
  | 'end-turn'
  | 'bankrupt'
  | 'game-over';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  playerId: string;
  message: string;
  type: 'move' | 'buy' | 'rent' | 'card' | 'jail' | 'bankrupt' | 'build' | 'trade' | 'system';
}

export interface PendingAction {
  type: 'pay' | 'auction' | 'card' | 'trade';
  data: Record<string, unknown>;
}

export interface TradeOffer {
  fromPlayerId: string;
  toPlayerId: string;
  offerMoney: number;
  offerProperties: number[];
  requestMoney: number;
  requestProperties: number[];
}

export interface AuctionState {
  propertyId: number;
  currentBid: number;
  currentBidderId: string | null;
  participants: string[];
  passedPlayers: string[];
}

// ============================================================================
// BOARD DATA
// ============================================================================

export const BOARD_SPACES: BoardSpace[] = [
  // Row 1 (Bottom)
  { id: 0, name: 'GO', type: 'go', color: 'special' },
  { id: 1, name: 'Mediterranean Avenue', type: 'property', color: 'brown', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, mortgageValue: 30 },
  { id: 2, name: 'Community Chest', type: 'community-chest', color: 'special' },
  { id: 3, name: 'Baltic Avenue', type: 'property', color: 'brown', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, mortgageValue: 30 },
  { id: 4, name: 'Income Tax', type: 'tax', color: 'special', taxAmount: 200 },
  { id: 5, name: 'Reading Railroad', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { id: 6, name: 'Oriental Avenue', type: 'property', color: 'lightBlue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 7, name: 'Chance', type: 'chance', color: 'special' },
  { id: 8, name: 'Vermont Avenue', type: 'property', color: 'lightBlue', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, mortgageValue: 50 },
  { id: 9, name: 'Connecticut Avenue', type: 'property', color: 'lightBlue', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, mortgageValue: 60 },
  
  // Row 2 (Left side going up)
  { id: 10, name: 'Jail / Just Visiting', type: 'jail', color: 'special' },
  { id: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 12, name: 'Electric Company', type: 'utility', color: 'utility', price: 150, mortgageValue: 75 },
  { id: 13, name: 'States Avenue', type: 'property', color: 'pink', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, mortgageValue: 70 },
  { id: 14, name: 'Virginia Avenue', type: 'property', color: 'pink', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, mortgageValue: 80 },
  { id: 15, name: 'Pennsylvania Railroad', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { id: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 17, name: 'Community Chest', type: 'community-chest', color: 'special' },
  { id: 18, name: 'Tennessee Avenue', type: 'property', color: 'orange', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, mortgageValue: 90 },
  { id: 19, name: 'New York Avenue', type: 'property', color: 'orange', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, mortgageValue: 100 },
  
  // Row 3 (Top)
  { id: 20, name: 'Free Parking', type: 'free-parking', color: 'special' },
  { id: 21, name: 'Kentucky Avenue', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 22, name: 'Chance', type: 'chance', color: 'special' },
  { id: 23, name: 'Indiana Avenue', type: 'property', color: 'red', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, mortgageValue: 110 },
  { id: 24, name: 'Illinois Avenue', type: 'property', color: 'red', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, mortgageValue: 120 },
  { id: 25, name: 'B&O Railroad', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { id: 26, name: 'Atlantic Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 27, name: 'Ventnor Avenue', type: 'property', color: 'yellow', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, mortgageValue: 130 },
  { id: 28, name: 'Water Works', type: 'utility', color: 'utility', price: 150, mortgageValue: 75 },
  { id: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, mortgageValue: 140 },
  
  // Row 4 (Right side going down)
  { id: 30, name: 'Go To Jail', type: 'go-to-jail', color: 'special' },
  { id: 31, name: 'Pacific Avenue', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 32, name: 'North Carolina Avenue', type: 'property', color: 'green', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, mortgageValue: 150 },
  { id: 33, name: 'Community Chest', type: 'community-chest', color: 'special' },
  { id: 34, name: 'Pennsylvania Avenue', type: 'property', color: 'green', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, mortgageValue: 160 },
  { id: 35, name: 'Short Line', type: 'railroad', color: 'railroad', price: 200, rent: [25, 50, 100, 200], mortgageValue: 100 },
  { id: 36, name: 'Chance', type: 'chance', color: 'special' },
  { id: 37, name: 'Park Place', type: 'property', color: 'darkBlue', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, mortgageValue: 175 },
  { id: 38, name: 'Luxury Tax', type: 'tax', color: 'special', taxAmount: 100 },
  { id: 39, name: 'Boardwalk', type: 'property', color: 'darkBlue', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, mortgageValue: 200 },
];

export const CHANCE_CARDS: ChanceCard[] = [
  { id: 1, text: 'Advance to GO. Collect $200.', action: { type: 'move', position: 0 } },
  { id: 2, text: 'Advance to Illinois Avenue. If you pass GO, collect $200.', action: { type: 'advance', to: 'Illinois Avenue' } },
  { id: 3, text: 'Advance to St. Charles Place. If you pass GO, collect $200.', action: { type: 'advance', to: 'St. Charles Place' } },
  { id: 4, text: 'Advance to nearest Utility. If unowned, you may buy it. If owned, pay 10x dice roll.', action: { type: 'moveToNearest', spaceType: 'utility' } },
  { id: 5, text: 'Advance to nearest Railroad. Pay owner twice the rental.', action: { type: 'moveToNearest', spaceType: 'railroad' } },
  { id: 6, text: 'Bank pays you dividend of $50.', action: { type: 'collect', amount: 50 } },
  { id: 7, text: 'Get Out of Jail Free.', action: { type: 'getOutOfJail' } },
  { id: 8, text: 'Go Back 3 Spaces.', action: { type: 'moveBack', spaces: 3 } },
  { id: 9, text: 'Go to Jail. Do not pass GO. Do not collect $200.', action: { type: 'goToJail' } },
  { id: 10, text: 'Make general repairs: $25 per house, $100 per hotel.', action: { type: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 11, text: 'Pay poor tax of $15.', action: { type: 'pay', amount: 15 } },
  { id: 12, text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', action: { type: 'advance', to: 'Reading Railroad' } },
  { id: 13, text: 'Advance to Boardwalk.', action: { type: 'advance', to: 'Boardwalk' } },
  { id: 14, text: 'You have been elected Chairman of the Board. Pay each player $50.', action: { type: 'payEach', amount: 50 } },
  { id: 15, text: 'Your building loan matures. Collect $150.', action: { type: 'collect', amount: 150 } },
  { id: 16, text: 'You have won a crossword competition. Collect $100.', action: { type: 'collect', amount: 100 } },
];

export const COMMUNITY_CHEST_CARDS: CommunityChestCard[] = [
  { id: 1, text: 'Advance to GO. Collect $200.', action: { type: 'move', position: 0 } },
  { id: 2, text: 'Bank error in your favor. Collect $200.', action: { type: 'collect', amount: 200 } },
  { id: 3, text: "Doctor's fees. Pay $50.", action: { type: 'pay', amount: 50 } },
  { id: 4, text: 'From sale of stock you get $50.', action: { type: 'collect', amount: 50 } },
  { id: 5, text: 'Get Out of Jail Free.', action: { type: 'getOutOfJail' } },
  { id: 6, text: 'Go to Jail. Do not pass GO. Do not collect $200.', action: { type: 'goToJail' } },
  { id: 7, text: 'Grand Opera Night. Collect $50 from every player.', action: { type: 'collectEach', amount: 50 } },
  { id: 8, text: 'Holiday fund matures. Receive $100.', action: { type: 'collect', amount: 100 } },
  { id: 9, text: 'Income tax refund. Collect $20.', action: { type: 'collect', amount: 20 } },
  { id: 10, text: 'It is your birthday. Collect $10 from every player.', action: { type: 'collectEach', amount: 10 } },
  { id: 11, text: 'Life insurance matures. Collect $100.', action: { type: 'collect', amount: 100 } },
  { id: 12, text: 'Hospital fees. Pay $100.', action: { type: 'pay', amount: 100 } },
  { id: 13, text: 'School fees. Pay $50.', action: { type: 'pay', amount: 50 } },
  { id: 14, text: 'Receive $25 consultancy fee.', action: { type: 'collect', amount: 25 } },
  { id: 15, text: 'You are assessed for street repairs: $40 per house, $115 per hotel.', action: { type: 'repairs', perHouse: 40, perHotel: 115 } },
  { id: 16, text: 'You have won second prize in a beauty contest. Collect $10.', action: { type: 'collect', amount: 10 } },
  { id: 17, text: 'You inherit $100.', action: { type: 'collect', amount: 100 } },
];

export const COLOR_GROUPS: Record<PropertyColor, number[]> = {
  brown: [1, 3],
  lightBlue: [6, 8, 9],
  pink: [11, 13, 14],
  orange: [16, 18, 19],
  red: [21, 23, 24],
  yellow: [26, 27, 29],
  green: [31, 32, 34],
  darkBlue: [37, 39],
  railroad: [5, 15, 25, 35],
  utility: [12, 28],
  special: [],
};

export const PLAYER_COLORS = [
  '#e74c3c', // Red
  '#3498db', // Blue
  '#2ecc71', // Green
  '#f1c40f', // Yellow
  '#9b59b6', // Purple
  '#e67e22', // Orange
  '#1abc9c', // Teal
  '#34495e', // Dark Gray
];

// ============================================================================
// GAME ENGINE
// ============================================================================

export function createInitialGameState(playerNames: string[]): GameState {
  const players: Player[] = playerNames.map((name, index) => ({
    id: `player-${index}`,
    name,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    money: 1500,
    position: 0,
    properties: [],
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    isBankrupt: false,
    isAI: false,
  }));

  const properties: Property[] = BOARD_SPACES
    .filter(s => s.type === 'property' || s.type === 'railroad' || s.type === 'utility')
    .map(s => ({
      spaceId: s.id,
      ownerId: null,
      houses: 0,
      isMortgaged: false,
    }));

  return {
    id: generateId(),
    players,
    properties,
    currentPlayerIndex: 0,
    phase: 'roll',
    diceRoll: null,
    doublesCount: 0,
    chanceCards: shuffle([...Array(CHANCE_CARDS.length).keys()]),
    communityChestCards: shuffle([...Array(COMMUNITY_CHEST_CARDS.length).keys()]),
    freeParking: 0,
    houses: 32,
    hotels: 12,
    turnNumber: 1,
    winner: null,
    log: [],
    pendingAction: null,
  };
}

export function rollDice(): [number, number] {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
}

export function isDoubles(dice: [number, number]): boolean {
  return dice[0] === dice[1];
}

export function getCurrentPlayer(state: GameState): Player {
  return state.players[state.currentPlayerIndex];
}

export function getSpace(spaceId: number): BoardSpace {
  return BOARD_SPACES[spaceId];
}

export function getProperty(state: GameState, spaceId: number): Property | undefined {
  return state.properties.find(p => p.spaceId === spaceId);
}

export function getPropertyOwner(state: GameState, spaceId: number): Player | null {
  const property = getProperty(state, spaceId);
  if (!property || !property.ownerId) return null;
  return state.players.find(p => p.id === property.ownerId) || null;
}

export function ownsColorGroup(state: GameState, playerId: string, color: PropertyColor): boolean {
  const groupSpaces = COLOR_GROUPS[color];
  return groupSpaces.every(spaceId => {
    const property = getProperty(state, spaceId);
    return property?.ownerId === playerId;
  });
}

export function countOwnedInGroup(state: GameState, playerId: string, color: PropertyColor): number {
  const groupSpaces = COLOR_GROUPS[color];
  return groupSpaces.filter(spaceId => {
    const property = getProperty(state, spaceId);
    return property?.ownerId === playerId;
  }).length;
}

export function calculateRent(
  state: GameState,
  spaceId: number,
  diceRoll?: [number, number]
): number {
  const space = getSpace(spaceId);
  const property = getProperty(state, spaceId);
  
  if (!property || !property.ownerId || property.isMortgaged) return 0;

  if (space.type === 'property') {
    const propSpace = space as PropertySpace;
    const ownsGroup = ownsColorGroup(state, property.ownerId, propSpace.color);
    
    if (property.houses === 0) {
      // Double rent for monopoly with no houses
      return ownsGroup ? propSpace.rent[0] * 2 : propSpace.rent[0];
    }
    return propSpace.rent[property.houses];
  }

  if (space.type === 'railroad') {
    const railSpace = space as RailroadSpace;
    const ownedCount = countOwnedInGroup(state, property.ownerId, 'railroad');
    return railSpace.rent[ownedCount - 1];
  }

  if (space.type === 'utility') {
    const ownedCount = countOwnedInGroup(state, property.ownerId, 'utility');
    const diceTotal = diceRoll ? diceRoll[0] + diceRoll[1] : 7;
    return ownedCount === 1 ? diceTotal * 4 : diceTotal * 10;
  }

  return 0;
}

export function canBuildHouse(state: GameState, playerId: string, spaceId: number): boolean {
  const space = getSpace(spaceId);
  if (space.type !== 'property') return false;
  
  const propSpace = space as PropertySpace;
  const property = getProperty(state, spaceId);
  const player = state.players.find(p => p.id === playerId);
  
  if (!property || !player) return false;
  if (property.ownerId !== playerId) return false;
  if (property.isMortgaged) return false;
  if (property.houses >= 5) return false; // Already has hotel
  if (state.houses === 0 && property.houses < 4) return false;
  if (state.hotels === 0 && property.houses === 4) return false;
  if (player.money < propSpace.houseCost) return false;
  if (!ownsColorGroup(state, playerId, propSpace.color)) return false;
  
  // Check even building rule
  const groupSpaces = COLOR_GROUPS[propSpace.color];
  const minHouses = Math.min(...groupSpaces.map(id => {
    const prop = getProperty(state, id);
    return prop?.houses || 0;
  }));
  
  return property.houses <= minHouses;
}

export function canSellHouse(state: GameState, playerId: string, spaceId: number): boolean {
  const space = getSpace(spaceId);
  if (space.type !== 'property') return false;
  
  const propSpace = space as PropertySpace;
  const property = getProperty(state, spaceId);
  
  if (!property) return false;
  if (property.ownerId !== playerId) return false;
  if (property.houses === 0) return false;
  
  // Check even building rule (must sell from highest first)
  const groupSpaces = COLOR_GROUPS[propSpace.color];
  const maxHouses = Math.max(...groupSpaces.map(id => {
    const prop = getProperty(state, id);
    return prop?.houses || 0;
  }));
  
  return property.houses >= maxHouses;
}

export function canMortgage(state: GameState, playerId: string, spaceId: number): boolean {
  const property = getProperty(state, spaceId);
  if (!property) return false;
  if (property.ownerId !== playerId) return false;
  if (property.isMortgaged) return false;
  if (property.houses > 0) return false;
  
  return true;
}

export function canUnmortgage(state: GameState, playerId: string, spaceId: number): boolean {
  const space = getSpace(spaceId);
  const property = getProperty(state, spaceId);
  const player = state.players.find(p => p.id === playerId);
  
  if (!property || !player) return false;
  if (property.ownerId !== playerId) return false;
  if (!property.isMortgaged) return false;
  
  const mortgageValue = (space as PropertySpace | RailroadSpace | UtilitySpace).mortgageValue;
  const unmortgageCost = Math.floor(mortgageValue * 1.1);
  
  return player.money >= unmortgageCost;
}

// ============================================================================
// GAME ACTIONS
// ============================================================================

export function performRoll(state: GameState): GameState {
  const player = getCurrentPlayer(state);
  if (player.inJail) {
    return { ...state, phase: 'jail-decision' };
  }

  const dice = rollDice();
  const doubles = isDoubles(dice);
  let newState: GameState = { ...state, diceRoll: dice };

  if (doubles) {
    newState.doublesCount++;
    if (newState.doublesCount >= 3) {
      // Three doubles = go to jail
      return goToJail(newState, player.id);
    }
  } else {
    newState.doublesCount = 0;
  }

  newState = addLog(newState, player.id, `rolled ${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}`, 'move');
  return movePlayer(newState, player.id, dice[0] + dice[1]);
}

export function movePlayer(state: GameState, playerId: string, spaces: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const oldPosition = player.position;
  let newPosition = (oldPosition + spaces) % 40;
  
  // Handle negative movement (Go Back 3 Spaces)
  if (spaces < 0) {
    newPosition = (oldPosition + spaces + 40) % 40;
  }

  const passedGo = spaces > 0 && newPosition < oldPosition;
  
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    position: newPosition,
    money: passedGo ? player.money + 200 : player.money,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    phase: 'landed',
  };

  if (passedGo) {
    newState = addLog(newState, playerId, 'passed GO and collected $200', 'move');
  }

  return handleLanding(newState, playerId);
}

export function moveToPosition(state: GameState, playerId: string, position: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const oldPosition = player.position;
  const passedGo = position < oldPosition && position !== 10; // Don't collect for jail

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    position,
    money: passedGo ? player.money + 200 : player.money,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    phase: 'landed',
  };

  if (passedGo) {
    newState = addLog(newState, playerId, 'passed GO and collected $200', 'move');
  }

  return handleLanding(newState, playerId);
}

export function handleLanding(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const space = getSpace(player.position);
  
  let newState = addLog(state, playerId, `landed on ${space.name}`, 'move');

  switch (space.type) {
    case 'property':
    case 'railroad':
    case 'utility': {
      const property = getProperty(newState, space.id);
      if (!property?.ownerId) {
        // Unowned - offer to buy
        return { ...newState, phase: 'buy-decision' };
      } else if (property.ownerId !== playerId && !property.isMortgaged) {
        // Owned by someone else - pay rent
        return { ...newState, phase: 'pay-rent' };
      }
      return { ...newState, phase: 'end-turn' };
    }
    
    case 'chance':
      return drawChanceCard(newState, playerId);
    
    case 'community-chest':
      return drawCommunityChestCard(newState, playerId);
    
    case 'tax': {
      const taxSpace = space as SpecialSpace;
      return payTax(newState, playerId, taxSpace.taxAmount || 0);
    }
    
    case 'go-to-jail':
      return goToJail(newState, playerId);
    
    case 'free-parking':
      // House rule: collect free parking money
      if (newState.freeParking > 0) {
        const playerIndex = newState.players.findIndex(p => p.id === playerId);
        const updatedPlayers = [...newState.players];
        updatedPlayers[playerIndex] = {
          ...updatedPlayers[playerIndex],
          money: updatedPlayers[playerIndex].money + newState.freeParking,
        };
        newState = addLog(newState, playerId, `collected $${newState.freeParking} from Free Parking`, 'system');
        return { ...newState, players: updatedPlayers, freeParking: 0, phase: 'end-turn' };
      }
      return { ...newState, phase: 'end-turn' };
    
    default:
      return { ...newState, phase: 'end-turn' };
  }
}

export function buyProperty(state: GameState, playerId: string): GameState {
  const player = state.players.find(p => p.id === playerId)!;
  const space = getSpace(player.position);
  
  if (space.type !== 'property' && space.type !== 'railroad' && space.type !== 'utility') {
    return state;
  }

  const price = (space as PropertySpace | RailroadSpace | UtilitySpace).price;
  if (player.money < price) {
    return state; // Can't afford
  }

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const propertyIndex = state.properties.findIndex(p => p.spaceId === space.id);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    money: player.money - price,
    properties: [...player.properties, space.id],
  };

  const updatedProperties = [...state.properties];
  updatedProperties[propertyIndex] = {
    ...updatedProperties[propertyIndex],
    ownerId: playerId,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
    phase: 'end-turn',
  };

  return addLog(newState, playerId, `bought ${space.name} for $${price}`, 'buy');
}

export function declinePurchase(state: GameState): GameState {
  // Start auction
  const player = getCurrentPlayer(state);
  const space = getSpace(player.position);
  
  return {
    ...state,
    phase: 'auction',
    pendingAction: {
      type: 'auction',
      data: {
        propertyId: space.id,
        currentBid: 0,
        currentBidderId: null,
        participants: state.players.filter(p => !p.isBankrupt).map(p => p.id),
        passedPlayers: [],
      },
    },
  };
}

export function payRent(state: GameState, payerId: string): GameState {
  const payer = state.players.find(p => p.id === payerId)!;
  const space = getSpace(payer.position);
  const owner = getPropertyOwner(state, space.id);
  
  if (!owner) return { ...state, phase: 'end-turn' };

  const rent = calculateRent(state, space.id, state.diceRoll || undefined);
  
  const payerIndex = state.players.findIndex(p => p.id === payerId);
  const ownerIndex = state.players.findIndex(p => p.id === owner.id);

  const updatedPlayers = [...state.players];
  
  if (payer.money >= rent) {
    updatedPlayers[payerIndex] = { ...payer, money: payer.money - rent };
    updatedPlayers[ownerIndex] = { ...owner, money: owner.money + rent };
    
    let newState: GameState = {
      ...state,
      players: updatedPlayers,
      phase: 'end-turn',
    };
    
    return addLog(newState, payerId, `paid $${rent} rent to ${owner.name}`, 'rent');
  } else {
    // Can't afford - need to mortgage/sell or go bankrupt
    return {
      ...state,
      phase: 'bankrupt',
      pendingAction: {
        type: 'pay',
        data: { amount: rent, toPlayerId: owner.id },
      },
    };
  }
}

export function goToJail(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    position: 10,
    inJail: true,
    jailTurns: 0,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    doublesCount: 0,
    phase: 'end-turn',
  };

  return addLog(newState, playerId, 'went to Jail!', 'jail');
}

export function payJailFine(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  
  if (player.money < 50) return state;

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    money: player.money - 50,
    inJail: false,
    jailTurns: 0,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    freeParking: state.freeParking + 50,
    phase: 'roll',
  };

  return addLog(newState, playerId, 'paid $50 to get out of Jail', 'jail');
}

export function useGetOutOfJailCard(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  
  if (player.getOutOfJailCards < 1) return state;

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    getOutOfJailCards: player.getOutOfJailCards - 1,
    inJail: false,
    jailTurns: 0,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    phase: 'roll',
  };

  return addLog(newState, playerId, 'used Get Out of Jail Free card', 'jail');
}

export function rollForJail(state: GameState, playerId: string): GameState {
  const dice = rollDice();
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];

  let newState: GameState = { ...state, diceRoll: dice };
  newState = addLog(newState, playerId, `rolled ${dice[0]} + ${dice[1]} in Jail`, 'jail');

  if (isDoubles(dice)) {
    // Got out with doubles
    const updatedPlayers = [...newState.players];
    updatedPlayers[playerIndex] = {
      ...player,
      inJail: false,
      jailTurns: 0,
    };
    newState = { ...newState, players: updatedPlayers };
    newState = addLog(newState, playerId, 'rolled doubles and got out of Jail!', 'jail');
    return movePlayer(newState, playerId, dice[0] + dice[1]);
  }

  // Didn't roll doubles
  const updatedPlayers = [...newState.players];
  updatedPlayers[playerIndex] = {
    ...player,
    jailTurns: player.jailTurns + 1,
  };

  if (player.jailTurns >= 2) {
    // Third turn - must pay and move
    if (player.money >= 50) {
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        money: player.money - 50,
        inJail: false,
        jailTurns: 0,
      };
      newState = { ...newState, players: updatedPlayers, freeParking: newState.freeParking + 50 };
      newState = addLog(newState, playerId, 'paid $50 after 3 turns in Jail', 'jail');
      return movePlayer(newState, playerId, dice[0] + dice[1]);
    } else {
      // Can't pay - bankrupt
      return { ...newState, players: updatedPlayers, phase: 'bankrupt' };
    }
  }

  return { ...newState, players: updatedPlayers, phase: 'end-turn' };
}

export function drawChanceCard(state: GameState, playerId: string): GameState {
  const cardIndex = state.chanceCards[0];
  const card = CHANCE_CARDS[cardIndex];
  
  const newChanceCards = [...state.chanceCards.slice(1), cardIndex];
  
  let newState: GameState = {
    ...state,
    chanceCards: newChanceCards,
  };

  newState = addLog(newState, playerId, `drew Chance: "${card.text}"`, 'card');
  return executeCardAction(newState, playerId, card.action);
}

export function drawCommunityChestCard(state: GameState, playerId: string): GameState {
  const cardIndex = state.communityChestCards[0];
  const card = COMMUNITY_CHEST_CARDS[cardIndex];
  
  const newCommunityChestCards = [...state.communityChestCards.slice(1), cardIndex];
  
  let newState: GameState = {
    ...state,
    communityChestCards: newCommunityChestCards,
  };

  newState = addLog(newState, playerId, `drew Community Chest: "${card.text}"`, 'card');
  return executeCardAction(newState, playerId, card.action);
}

export function executeCardAction(state: GameState, playerId: string, action: CardAction): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];
  const updatedPlayers = [...state.players];

  switch (action.type) {
    case 'collect':
      updatedPlayers[playerIndex] = { ...player, money: player.money + action.amount };
      return { ...state, players: updatedPlayers, phase: 'end-turn' };

    case 'pay':
      if (player.money >= action.amount) {
        updatedPlayers[playerIndex] = { ...player, money: player.money - action.amount };
        return { ...state, players: updatedPlayers, freeParking: state.freeParking + action.amount, phase: 'end-turn' };
      }
      return { ...state, phase: 'bankrupt', pendingAction: { type: 'pay', data: { amount: action.amount } } };

    case 'payEach': {
      const otherPlayers = state.players.filter(p => p.id !== playerId && !p.isBankrupt);
      const totalPay = action.amount * otherPlayers.length;
      if (player.money >= totalPay) {
        updatedPlayers[playerIndex] = { ...player, money: player.money - totalPay };
        otherPlayers.forEach(op => {
          const idx = updatedPlayers.findIndex(p => p.id === op.id);
          updatedPlayers[idx] = { ...updatedPlayers[idx], money: updatedPlayers[idx].money + action.amount };
        });
        return { ...state, players: updatedPlayers, phase: 'end-turn' };
      }
      return { ...state, phase: 'bankrupt' };
    }

    case 'collectEach': {
      const otherPlayers = state.players.filter(p => p.id !== playerId && !p.isBankrupt);
      let totalCollect = 0;
      otherPlayers.forEach(op => {
        const idx = updatedPlayers.findIndex(p => p.id === op.id);
        const payment = Math.min(action.amount, updatedPlayers[idx].money);
        updatedPlayers[idx] = { ...updatedPlayers[idx], money: updatedPlayers[idx].money - payment };
        totalCollect += payment;
      });
      updatedPlayers[playerIndex] = { ...player, money: player.money + totalCollect };
      return { ...state, players: updatedPlayers, phase: 'end-turn' };
    }

    case 'move':
      return moveToPosition(state, playerId, action.position);

    case 'moveBack':
      return movePlayer(state, playerId, -action.spaces);

    case 'goToJail':
      return goToJail(state, playerId);

    case 'getOutOfJail':
      updatedPlayers[playerIndex] = { ...player, getOutOfJailCards: player.getOutOfJailCards + 1 };
      return { ...state, players: updatedPlayers, phase: 'end-turn' };

    case 'repairs': {
      let totalCost = 0;
      state.properties.forEach(prop => {
        if (prop.ownerId === playerId) {
          if (prop.houses === 5) {
            totalCost += action.perHotel;
          } else {
            totalCost += prop.houses * action.perHouse;
          }
        }
      });
      if (player.money >= totalCost) {
        updatedPlayers[playerIndex] = { ...player, money: player.money - totalCost };
        return { ...state, players: updatedPlayers, freeParking: state.freeParking + totalCost, phase: 'end-turn' };
      }
      return { ...state, phase: 'bankrupt' };
    }

    case 'advance': {
      const targetSpace = BOARD_SPACES.find(s => s.name === action.to);
      if (targetSpace) {
        return moveToPosition(state, playerId, targetSpace.id);
      }
      return { ...state, phase: 'end-turn' };
    }

    case 'moveToNearest': {
      const currentPos = player.position;
      let nearestPos = -1;
      let minDistance = 41;

      BOARD_SPACES.forEach(space => {
        if (space.type === action.spaceType) {
          const distance = (space.id - currentPos + 40) % 40;
          if (distance > 0 && distance < minDistance) {
            minDistance = distance;
            nearestPos = space.id;
          }
        }
      });

      if (nearestPos >= 0) {
        return moveToPosition(state, playerId, nearestPos);
      }
      return { ...state, phase: 'end-turn' };
    }

    default:
      return { ...state, phase: 'end-turn' };
  }
}

export function payTax(state: GameState, playerId: string, amount: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];

  if (player.money >= amount) {
    const updatedPlayers = [...state.players];
    updatedPlayers[playerIndex] = { ...player, money: player.money - amount };
    let newState: GameState = {
      ...state,
      players: updatedPlayers,
      freeParking: state.freeParking + amount,
      phase: 'end-turn',
    };
    return addLog(newState, playerId, `paid $${amount} tax`, 'system');
  }

  return {
    ...state,
    phase: 'bankrupt',
    pendingAction: { type: 'pay', data: { amount } },
  };
}

export function buildHouse(state: GameState, playerId: string, spaceId: number): GameState {
  if (!canBuildHouse(state, playerId, spaceId)) return state;

  const space = getSpace(spaceId) as PropertySpace;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const propertyIndex = state.properties.findIndex(p => p.spaceId === spaceId);
  const property = state.properties[propertyIndex];

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    money: updatedPlayers[playerIndex].money - space.houseCost,
  };

  const updatedProperties = [...state.properties];
  const isHotel = property.houses === 4;
  updatedProperties[propertyIndex] = {
    ...property,
    houses: property.houses + 1,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
    houses: isHotel ? state.houses + 4 : state.houses - 1,
    hotels: isHotel ? state.hotels - 1 : state.hotels,
  };

  const buildType = isHotel ? 'hotel' : 'house';
  return addLog(newState, playerId, `built a ${buildType} on ${space.name}`, 'build');
}

export function sellHouse(state: GameState, playerId: string, spaceId: number): GameState {
  if (!canSellHouse(state, playerId, spaceId)) return state;

  const space = getSpace(spaceId) as PropertySpace;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const propertyIndex = state.properties.findIndex(p => p.spaceId === spaceId);
  const property = state.properties[propertyIndex];

  const sellPrice = Math.floor(space.houseCost / 2);
  const isHotel = property.houses === 5;

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    money: updatedPlayers[playerIndex].money + sellPrice,
  };

  const updatedProperties = [...state.properties];
  updatedProperties[propertyIndex] = {
    ...property,
    houses: property.houses - 1,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
    houses: isHotel ? state.houses - 4 : state.houses + 1,
    hotels: isHotel ? state.hotels + 1 : state.hotels,
  };

  const buildType = isHotel ? 'hotel' : 'house';
  return addLog(newState, playerId, `sold a ${buildType} on ${space.name} for $${sellPrice}`, 'build');
}

export function mortgageProperty(state: GameState, playerId: string, spaceId: number): GameState {
  if (!canMortgage(state, playerId, spaceId)) return state;

  const space = getSpace(spaceId) as PropertySpace | RailroadSpace | UtilitySpace;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const propertyIndex = state.properties.findIndex(p => p.spaceId === spaceId);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    money: updatedPlayers[playerIndex].money + space.mortgageValue,
  };

  const updatedProperties = [...state.properties];
  updatedProperties[propertyIndex] = {
    ...updatedProperties[propertyIndex],
    isMortgaged: true,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
  };

  return addLog(newState, playerId, `mortgaged ${space.name} for $${space.mortgageValue}`, 'system');
}

export function unmortgageProperty(state: GameState, playerId: string, spaceId: number): GameState {
  if (!canUnmortgage(state, playerId, spaceId)) return state;

  const space = getSpace(spaceId) as PropertySpace | RailroadSpace | UtilitySpace;
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const propertyIndex = state.properties.findIndex(p => p.spaceId === spaceId);

  const unmortgageCost = Math.floor(space.mortgageValue * 1.1);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    money: updatedPlayers[playerIndex].money - unmortgageCost,
  };

  const updatedProperties = [...state.properties];
  updatedProperties[propertyIndex] = {
    ...updatedProperties[propertyIndex],
    isMortgaged: false,
  };

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
  };

  return addLog(newState, playerId, `unmortgaged ${space.name} for $${unmortgageCost}`, 'system');
}

export function declareBankruptcy(state: GameState, playerId: string, creditorId?: string): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  const player = state.players[playerIndex];

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    isBankrupt: true,
    money: 0,
    properties: [],
  };

  let updatedProperties = [...state.properties];

  if (creditorId) {
    // Transfer properties to creditor
    const creditorIndex = updatedPlayers.findIndex(p => p.id === creditorId);
    const transferredProps: number[] = [];
    
    updatedProperties = updatedProperties.map(prop => {
      if (prop.ownerId === playerId) {
        transferredProps.push(prop.spaceId);
        return { ...prop, ownerId: creditorId, houses: 0 };
      }
      return prop;
    });

    updatedPlayers[creditorIndex] = {
      ...updatedPlayers[creditorIndex],
      money: updatedPlayers[creditorIndex].money + player.money,
      properties: [...updatedPlayers[creditorIndex].properties, ...transferredProps],
    };
  } else {
    // Return properties to bank
    updatedProperties = updatedProperties.map(prop => {
      if (prop.ownerId === playerId) {
        return { ...prop, ownerId: null, houses: 0, isMortgaged: false };
      }
      return prop;
    });
  }

  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
  };

  newState = addLog(newState, playerId, 'declared bankruptcy!', 'bankrupt');

  // Check for winner
  const activePlayers = newState.players.filter(p => !p.isBankrupt);
  if (activePlayers.length === 1) {
    newState = {
      ...newState,
      winner: activePlayers[0].id,
      phase: 'game-over',
    };
    newState = addLog(newState, activePlayers[0].id, 'won the game!', 'system');
  } else {
    newState = endTurn(newState);
  }

  return newState;
}

export function endTurn(state: GameState): GameState {
  // Check for doubles (roll again)
  if (state.diceRoll && isDoubles(state.diceRoll) && state.doublesCount < 3) {
    const player = getCurrentPlayer(state);
    if (!player.inJail) {
      return { ...state, phase: 'roll', diceRoll: null };
    }
  }

  // Move to next player
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  
  // Skip bankrupt players
  while (state.players[nextIndex].isBankrupt) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: 'roll',
    diceRoll: null,
    doublesCount: 0,
    turnNumber: nextIndex === 0 ? state.turnNumber + 1 : state.turnNumber,
    pendingAction: null,
  };
}

// ============================================================================
// HELPERS
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
// AUCTION SYSTEM
// ============================================================================

export function placeBid(state: GameState, bidderId: string, amount: number): GameState {
  if (state.phase !== 'auction' || !state.pendingAction) return state;
  const auction = state.pendingAction.data as unknown as AuctionState;
  
  const bidder = state.players.find(p => p.id === bidderId);
  if (!bidder || bidder.isBankrupt) return state;
  if (amount <= auction.currentBid) return state;  // Must bid higher
  if (amount > bidder.money) return state;  // Can't bid more than you have
  if (auction.passedPlayers.includes(bidderId)) return state;  // Already passed
  
  const newAuction: AuctionState = {
    ...auction,
    currentBid: amount,
    currentBidderId: bidderId,
  };
  
  let newState: GameState = {
    ...state,
    pendingAction: { type: 'auction', data: newAuction as unknown as Record<string, unknown> },
  };
  
  return addLog(newState, bidderId, `bid $${amount}`, 'buy');
}

export function passAuction(state: GameState, playerId: string): GameState {
  if (state.phase !== 'auction' || !state.pendingAction) return state;
  const auction = state.pendingAction.data as unknown as AuctionState;
  
  if (auction.passedPlayers.includes(playerId)) return state;
  
  const newPassedPlayers = [...auction.passedPlayers, playerId];
  const remainingBidders = auction.participants.filter(id => !newPassedPlayers.includes(id));
  
  // If only one bidder remains (or zero), auction ends
  if (remainingBidders.length <= 1) {
    const winnerId = auction.currentBidderId;
    if (winnerId && auction.currentBid > 0) {
      // Winner buys the property
      const winnerIndex = state.players.findIndex(p => p.id === winnerId);
      const updatedPlayers = [...state.players];
      updatedPlayers[winnerIndex] = {
        ...updatedPlayers[winnerIndex],
        money: updatedPlayers[winnerIndex].money - auction.currentBid,
        properties: [...updatedPlayers[winnerIndex].properties, auction.propertyId],
      };
      
      const updatedProperties = state.properties.map(p =>
        p.spaceId === auction.propertyId ? { ...p, ownerId: winnerId } : p
      );
      
      const space = getSpace(auction.propertyId);
      let newState: GameState = {
        ...state,
        players: updatedPlayers,
        properties: updatedProperties,
        phase: 'end-turn',
        pendingAction: null,
      };
      return addLog(newState, winnerId, `won auction for ${space.name} at $${auction.currentBid}`, 'buy');
    } else {
      // No one bid — property remains unowned
      return { ...state, phase: 'end-turn', pendingAction: null };
    }
  }
  
  const newAuction: AuctionState = {
    ...auction,
    passedPlayers: newPassedPlayers,
  };
  
  return {
    ...state,
    pendingAction: { type: 'auction', data: newAuction as unknown as Record<string, unknown> },
  };
}

// ============================================================================
// TRADE SYSTEM
// ============================================================================

export function proposeTrade(state: GameState, offer: TradeOffer): GameState {
  const from = state.players.find(p => p.id === offer.fromPlayerId);
  const to = state.players.find(p => p.id === offer.toPlayerId);
  if (!from || !to || from.isBankrupt || to.isBankrupt) return state;
  
  // Validate from player has what they're offering
  if (from.money < offer.offerMoney) return state;
  if (!offer.offerProperties.every(pid => from.properties.includes(pid))) return state;
  
  return {
    ...state,
    phase: 'trade',
    pendingAction: {
      type: 'trade',
      data: offer as unknown as Record<string, unknown>,
    },
  };
}

export function acceptTrade(state: GameState): GameState {
  if (state.phase !== 'trade' || !state.pendingAction) return state;
  const offer = state.pendingAction.data as unknown as TradeOffer;
  
  const fromIndex = state.players.findIndex(p => p.id === offer.fromPlayerId);
  const toIndex = state.players.findIndex(p => p.id === offer.toPlayerId);
  const from = state.players[fromIndex];
  const to = state.players[toIndex];
  
  // Validate both sides can still fulfill the trade
  if (from.money < offer.offerMoney || to.money < offer.requestMoney) return state;
  if (!offer.offerProperties.every(pid => from.properties.includes(pid))) return state;
  if (!offer.requestProperties.every(pid => to.properties.includes(pid))) return state;
  
  const updatedPlayers = [...state.players];
  
  // Transfer money
  updatedPlayers[fromIndex] = {
    ...from,
    money: from.money - offer.offerMoney + offer.requestMoney,
    properties: [
      ...from.properties.filter(p => !offer.offerProperties.includes(p)),
      ...offer.requestProperties,
    ],
  };
  updatedPlayers[toIndex] = {
    ...to,
    money: to.money - offer.requestMoney + offer.offerMoney,
    properties: [
      ...to.properties.filter(p => !offer.requestProperties.includes(p)),
      ...offer.offerProperties,
    ],
  };
  
  // Update property ownership
  const updatedProperties = state.properties.map(p => {
    if (offer.offerProperties.includes(p.spaceId)) return { ...p, ownerId: offer.toPlayerId };
    if (offer.requestProperties.includes(p.spaceId)) return { ...p, ownerId: offer.fromPlayerId };
    return p;
  });
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    properties: updatedProperties,
    phase: 'end-turn',
    pendingAction: null,
  };
  
  return addLog(newState, offer.fromPlayerId, `traded with ${to.name}`, 'trade');
}

export function declineTrade(state: GameState): GameState {
  if (state.phase !== 'trade') return state;
  return { ...state, phase: 'end-turn', pendingAction: null };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  createInitialGameState,
  rollDice,
  isDoubles,
  getCurrentPlayer,
  getSpace,
  getProperty,
  getPropertyOwner,
  ownsColorGroup,
  countOwnedInGroup,
  calculateRent,
  canBuildHouse,
  canSellHouse,
  canMortgage,
  canUnmortgage,
  performRoll,
  movePlayer,
  moveToPosition,
  handleLanding,
  buyProperty,
  declinePurchase,
  payRent,
  goToJail,
  payJailFine,
  useGetOutOfJailCard,
  rollForJail,
  drawChanceCard,
  drawCommunityChestCard,
  executeCardAction,
  payTax,
  buildHouse,
  sellHouse,
  mortgageProperty,
  unmortgageProperty,
  declareBankruptcy,
  placeBid,
  passAuction,
  proposeTrade,
  acceptTrade,
  declineTrade,
  endTurn,
  BOARD_SPACES,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  COLOR_GROUPS,
  PLAYER_COLORS,
};
