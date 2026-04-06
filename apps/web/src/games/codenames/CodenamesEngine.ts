/**
 * TableForge - Codenames Game Engine
 * Complete implementation of Codenames rules
 */

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin';
export type Team = 'red' | 'blue';
export type Role = 'spymaster' | 'operative';

export interface WordCard {
  id: number;
  word: string;
  type: CardType;
  isRevealed: boolean;
}

export interface Player {
  id: string;
  name: string;
  team: Team;
  role: Role;
  isConnected: boolean;
}

export interface Clue {
  word: string;
  number: number;
  team: Team;
  guessesRemaining: number;
}

export interface GameState {
  id: string;
  players: Player[];
  cards: WordCard[];
  currentTeam: Team;
  phase: GamePhase;
  currentClue: Clue | null;
  redScore: number;
  blueScore: number;
  redTotal: number;
  blueTotal: number;
  winner: Team | null;
  startingTeam: Team;
  log: GameLogEntry[];
}

export type GamePhase = 
  | 'setup'
  | 'give-clue'
  | 'guess'
  | 'game-over';

export interface GameLogEntry {
  id: string;
  timestamp: number;
  team: Team;
  message: string;
  type: 'clue' | 'guess' | 'system';
}

// ============================================================================
// WORD LIST
// ============================================================================

export const WORD_LIST: string[] = [
  // Original Codenames words
  'AFRICA', 'AGENT', 'AIR', 'ALIEN', 'ALPS', 'AMAZON', 'AMBULANCE', 'AMERICA',
  'ANGEL', 'ANTARCTICA', 'APPLE', 'ARM', 'ATLANTIS', 'AUSTRALIA', 'AZTEC',
  'BACK', 'BALL', 'BAND', 'BANK', 'BAR', 'BARK', 'BAT', 'BATTERY', 'BEACH',
  'BEAR', 'BEAT', 'BED', 'BEIJING', 'BELL', 'BELT', 'BERLIN', 'BERMUDA',
  'BERRY', 'BILL', 'BLOCK', 'BOARD', 'BOLT', 'BOMB', 'BOND', 'BOOM', 'BOOT',
  'BOTTLE', 'BOW', 'BOX', 'BRIDGE', 'BRUSH', 'BUCK', 'BUFFALO', 'BUG',
  'BUGLE', 'BUTTON', 'CALF', 'CANADA', 'CAP', 'CAPITAL', 'CAR', 'CARD',
  'CARROT', 'CASINO', 'CAST', 'CAT', 'CELL', 'CENTAUR', 'CENTER', 'CHAIR',
  'CHANGE', 'CHARGE', 'CHECK', 'CHEST', 'CHICK', 'CHINA', 'CHOCOLATE',
  'CHURCH', 'CIRCLE', 'CLIFF', 'CLOAK', 'CLUB', 'CODE', 'COLD', 'COMIC',
  'COMPOUND', 'CONCERT', 'CONDUCTOR', 'CONTRACT', 'COOK', 'COPPER', 'COTTON',
  'COURT', 'COVER', 'CRANE', 'CRASH', 'CRICKET', 'CROSS', 'CROWN', 'CYCLE',
  'CZECH', 'DANCE', 'DATE', 'DAY', 'DEATH', 'DECK', 'DEGREE', 'DIAMOND',
  'DICE', 'DINOSAUR', 'DISEASE', 'DOCTOR', 'DOG', 'DRAFT', 'DRAGON', 'DRESS',
  'DRILL', 'DROP', 'DUCK', 'DWARF', 'EAGLE', 'EGYPT', 'EMBASSY', 'ENGINE',
  'ENGLAND', 'EUROPE', 'EYE', 'FACE', 'FAIR', 'FALL', 'FAN', 'FENCE', 'FIELD',
  'FIGHTER', 'FIGURE', 'FILE', 'FILM', 'FIRE', 'FISH', 'FLUTE', 'FLY', 'FOOT',
  'FORCE', 'FOREST', 'FORK', 'FRANCE', 'GAME', 'GAS', 'GENIUS', 'GERMANY',
  'GHOST', 'GIANT', 'GLASS', 'GLOVE', 'GOLD', 'GRACE', 'GRASS', 'GREECE',
  'GREEN', 'GROUND', 'HAM', 'HAND', 'HAWK', 'HEAD', 'HEART', 'HELICOPTER',
  'HIMALAYAS', 'HOLE', 'HOLLYWOOD', 'HONEY', 'HOOD', 'HOOK', 'HORN', 'HORSE',
  'HOSPITAL', 'HOTEL', 'ICE', 'ICE CREAM', 'INDIA', 'IRON', 'IVORY', 'JACK',
  'JAM', 'JET', 'JUPITER', 'KANGAROO', 'KETCHUP', 'KEY', 'KID', 'KING', 'KIWI',
  'KNIFE', 'KNIGHT', 'LAB', 'LAP', 'LASER', 'LAWYER', 'LEAD', 'LEMON', 'LEPRECHAUN',
  'LIFE', 'LIGHT', 'LIMOUSINE', 'LINE', 'LINK', 'LION', 'LITTER', 'LOCH NESS',
  'LOCK', 'LOG', 'LONDON', 'LUCK', 'MAIL', 'MAMMOTH', 'MAPLE', 'MARBLE', 'MARCH',
  'MASS', 'MATCH', 'MERCURY', 'MEXICO', 'MICROSCOPE', 'MILLIONAIRE', 'MINE',
  'MINT', 'MISSILE', 'MODEL', 'MOLE', 'MOON', 'MOSCOW', 'MOUNT', 'MOUSE',
  'MOUTH', 'MUG', 'NAIL', 'NEEDLE', 'NET', 'NEW YORK', 'NIGHT', 'NINJA', 'NOTE',
  'NOVEL', 'NURSE', 'NUT', 'OCTOPUS', 'OIL', 'OLIVE', 'OLYMPUS', 'OPERA',
  'ORANGE', 'ORGAN', 'PALM', 'PAN', 'PANTS', 'PAPER', 'PARACHUTE', 'PARK',
  'PART', 'PASS', 'PASTE', 'PENGUIN', 'PHOENIX', 'PIANO', 'PIE', 'PILOT',
  'PIN', 'PIPE', 'PIRATE', 'PISTOL', 'PIT', 'PITCH', 'PLANE', 'PLASTIC',
  'PLATE', 'PLATYPUS', 'PLAY', 'PLOT', 'POINT', 'POISON', 'POLE', 'POLICE',
  'POOL', 'PORT', 'POST', 'POUND', 'PRESS', 'PRINCESS', 'PUMPKIN', 'PUPIL',
  'PYRAMID', 'QUEEN', 'RABBIT', 'RACKET', 'RAY', 'REVOLUTION', 'RING', 'ROBIN',
  'ROBOT', 'ROCK', 'ROME', 'ROOT', 'ROSE', 'ROULETTE', 'ROUND', 'ROW', 'RULER',
  'SATELLITE', 'SATURN', 'SCALE', 'SCHOOL', 'SCIENTIST', 'SCORPION', 'SCREEN',
  'SCUBA DIVER', 'SEAL', 'SERVER', 'SHADOW', 'SHAKESPEARE', 'SHARK', 'SHIP',
  'SHOE', 'SHOP', 'SHOT', 'SINK', 'SKYSCRAPER', 'SLIP', 'SLUG', 'SMUGGLER',
  'SNOW', 'SNOWMAN', 'SOCK', 'SOLDIER', 'SOUL', 'SOUND', 'SPACE', 'SPELL',
  'SPIDER', 'SPIKE', 'SPINE', 'SPOT', 'SPRING', 'SPY', 'SQUARE', 'STADIUM',
  'STAFF', 'STAR', 'STATE', 'STICK', 'STOCK', 'STRAW', 'STREAM', 'STRIKE',
  'STRING', 'SUB', 'SUIT', 'SUPERHERO', 'SWING', 'SWITCH', 'TABLE', 'TABLET',
  'TAG', 'TAIL', 'TAP', 'TEACHER', 'TELESCOPE', 'TEMPLE', 'THIEF', 'THUMB',
  'TICK', 'TIE', 'TIME', 'TOKYO', 'TOOTH', 'TORCH', 'TOWER', 'TRACK', 'TRAIN',
  'TRIANGLE', 'TRIP', 'TRUNK', 'TUBE', 'TURKEY', 'UNDERTAKER', 'UNICORN',
  'VACUUM', 'VAN', 'VET', 'WAKE', 'WALL', 'WAR', 'WASHER', 'WASHINGTON',
  'WATCH', 'WATER', 'WAVE', 'WEB', 'WELL', 'WHALE', 'WHIP', 'WIND', 'WITCH',
  'WORM', 'YARD'
];

// ============================================================================
// GAME INITIALIZATION
// ============================================================================

function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export function createInitialGameState(playerNames: string[]): GameState {
  // Randomly select 25 words
  const selectedWords = shuffle(WORD_LIST).slice(0, 25);
  
  // Randomly determine starting team
  const startingTeam: Team = Math.random() < 0.5 ? 'red' : 'blue';
  
  // Create card types: starting team gets 9, other gets 8, 7 neutral, 1 assassin
  const cardTypes: CardType[] = [
    ...Array(startingTeam === 'red' ? 9 : 8).fill('red'),
    ...Array(startingTeam === 'blue' ? 9 : 8).fill('blue'),
    ...Array(7).fill('neutral'),
    'assassin',
  ];
  
  const shuffledTypes = shuffle(cardTypes);
  
  const cards: WordCard[] = selectedWords.map((word, index) => ({
    id: index,
    word,
    type: shuffledTypes[index],
    isRevealed: false,
  }));

  // Assign players to teams and roles
  const shuffledPlayers = shuffle([...playerNames]);
  const players: Player[] = shuffledPlayers.map((name, index) => {
    const team: Team = index % 2 === 0 ? 'red' : 'blue';
    const role: Role = index < 2 ? 'spymaster' : 'operative';
    return {
      id: `player-${index}`,
      name,
      team,
      role,
      isConnected: true,
    };
  });

  return {
    id: generateId(),
    players,
    cards,
    currentTeam: startingTeam,
    phase: 'give-clue',
    currentClue: null,
    redScore: 0,
    blueScore: 0,
    redTotal: startingTeam === 'red' ? 9 : 8,
    blueTotal: startingTeam === 'blue' ? 9 : 8,
    winner: null,
    startingTeam,
    log: [],
  };
}

// ============================================================================
// GAME HELPERS
// ============================================================================

export function getTeamPlayers(state: GameState, team: Team): Player[] {
  return state.players.filter(p => p.team === team);
}

export function getSpymaster(state: GameState, team: Team): Player | undefined {
  return state.players.find(p => p.team === team && p.role === 'spymaster');
}

export function getOperatives(state: GameState, team: Team): Player[] {
  return state.players.filter(p => p.team === team && p.role === 'operative');
}

export function getUnrevealedCards(state: GameState): WordCard[] {
  return state.cards.filter(c => !c.isRevealed);
}

export function getTeamCards(state: GameState, team: Team): WordCard[] {
  return state.cards.filter(c => c.type === team);
}

export function getRemainingCards(state: GameState, team: Team): number {
  return state.cards.filter(c => c.type === team && !c.isRevealed).length;
}

// ============================================================================
// GAME ACTIONS
// ============================================================================

export function isValidClue(state: GameState, word: string): boolean {
  const upperWord = word.toUpperCase().trim();
  if (upperWord.length === 0) return false;
  // Clue cannot be a word on the board
  if (state.cards.some(c => c.word.toUpperCase() === upperWord)) return false;
  // Clue must be a single word (no spaces, except for compound words)
  if (upperWord.includes(' ') && !upperWord.match(/^[A-Z]+-[A-Z]+$/)) return false;
  return true;
}

export function giveClue(state: GameState, word: string, number: number): GameState {
  if (state.phase !== 'give-clue') return state;
  if (!isValidClue(state, word)) return state;
  if (number < 0) return state;
  
  const clue: Clue = {
    word: word.toUpperCase().trim(),
    number,
    team: state.currentTeam,
    // number=0 means "unlimited" guesses (but still max 1 extra), number>0 means number+1 guesses
    guessesRemaining: number === 0 ? 25 : number + 1,
  };

  let newState: GameState = {
    ...state,
    currentClue: clue,
    phase: 'guess',
  };

  return addLog(newState, state.currentTeam, `Spymaster gave clue: "${word}" for ${number}`, 'clue');
}

export function makeGuess(state: GameState, cardId: number): GameState {
  if (state.phase !== 'guess' || !state.currentClue) return state;
  
  const cardIndex = state.cards.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return state;
  
  const card = state.cards[cardIndex];
  if (card.isRevealed) return state;

  // Reveal the card
  const updatedCards = [...state.cards];
  updatedCards[cardIndex] = { ...card, isRevealed: true };

  let newState: GameState = {
    ...state,
    cards: updatedCards,
  };

  newState = addLog(newState, state.currentTeam, `Guessed "${card.word}"`, 'guess');

  // Check what type of card was revealed
  if (card.type === 'assassin') {
    // Game over - other team wins
    const winner: Team = state.currentTeam === 'red' ? 'blue' : 'red';
    newState = {
      ...newState,
      winner,
      phase: 'game-over',
    };
    return addLog(newState, winner, `${winner.toUpperCase()} team wins! (Assassin revealed)`, 'system');
  }

  // Update scores
  if (card.type === 'red') {
    newState = { ...newState, redScore: newState.redScore + 1 };
  } else if (card.type === 'blue') {
    newState = { ...newState, blueScore: newState.blueScore + 1 };
  }

  // Check for win condition
  if (newState.redScore >= newState.redTotal) {
    newState = { ...newState, winner: 'red', phase: 'game-over' };
    return addLog(newState, 'red', 'RED team wins! All agents found!', 'system');
  }
  if (newState.blueScore >= newState.blueTotal) {
    newState = { ...newState, winner: 'blue', phase: 'game-over' };
    return addLog(newState, 'blue', 'BLUE team wins! All agents found!', 'system');
  }

  // Check if guess was correct
  if (card.type === state.currentTeam) {
    // Correct guess - can continue guessing
    const updatedClue = {
      ...state.currentClue,
      guessesRemaining: state.currentClue.guessesRemaining - 1,
    };

    if (updatedClue.guessesRemaining <= 0) {
      // Used all guesses, end turn
      return endTurn(newState);
    }

    return { ...newState, currentClue: updatedClue };
  } else {
    // Wrong guess - end turn
    return endTurn(newState);
  }
}

export function passTurn(state: GameState): GameState {
  if (state.phase !== 'guess') return state;
  
  let newState = addLog(state, state.currentTeam, 'Passed turn', 'system');
  return endTurn(newState);
}

export function endTurn(state: GameState): GameState {
  const nextTeam: Team = state.currentTeam === 'red' ? 'blue' : 'red';
  
  return {
    ...state,
    currentTeam: nextTeam,
    currentClue: null,
    phase: 'give-clue',
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function addLog(state: GameState, team: Team, message: string, type: GameLogEntry['type']): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: generateId(),
        timestamp: Date.now(),
        team,
        message,
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
  getTeamPlayers,
  getSpymaster,
  getOperatives,
  getUnrevealedCards,
  getTeamCards,
  getRemainingCards,
  isValidClue,
  giveClue,
  makeGuess,
  passTurn,
  endTurn,
  WORD_LIST,
};
