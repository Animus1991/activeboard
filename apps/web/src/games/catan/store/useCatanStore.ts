/**
 * useCatanStore.ts — Unified Zustand Store for Catan
 *
 * Single source of truth: wraps the pure CatanEngine.ts rules engine
 * with Zustand state management + EventBus integration.
 *
 * Replaces:
 *   - Scattered useState() in CatanGamePage.tsx
 *   - CatanCommandDispatcher.ts (CQRS layer absorbed here)
 *   - CatanStateBridge.ts (no longer needed — single state model)
 *
 * Keeps:
 *   - CatanEngine.ts        — pure game-rule functions (unchanged)
 *   - CatanProjections.ts   — pure derivation functions (unchanged)
 *   - CatanEventBus.ts      — event bus singleton (unchanged)
 *   - useCatanAI.ts          — AI hook (consumes store via getState)
 *   - useCatanSounds.ts     — sound hook (consumes GameState slice)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import {
  type GameState,
  type ResourceType,
  type BoardSize,
  createInitialGameState,
  getCurrentPlayer,
  performRoll,
  buildSettlement,
  buildCity,
  buildRoad,
  buyDevelopmentCard,
  playKnight,
  playYearOfPlenty,
  playMonopoly,
  playRoadBuilding,
  buildFreeRoad,
  moveRobber,
  stealResource,
  discardResources,
  bankTrade,
  endTurn,
  advanceSetup,
  canBuildSettlement,
  canBuildCity,
  canBuildRoad,
  canBuyDevelopmentCard,
  getPlayerTradeRatio,
  getStealablePlayerIds,
  BUILDING_COSTS,
} from '../CatanEngine';

import { CatanEventBus } from '../CatanEventBus';
import { computeProduction, type ProductionEntry } from '../CatanProjections';

// ============================================================================
// TYPES
// ============================================================================

export type BuildModeType = 'settlement' | 'city' | 'road' | null;
export type CameraMode = 'tactical' | 'table' | 'inspect' | 'cinematic';
export type IntroPhase = 'shuffle' | 'letters' | 'numbers' | null;

/** 3D resource flow animation (matches beta's FlowingResource) */
export interface FlowingResource {
  id: string;
  type: ResourceType;
  startPos: [number, number, number];
  endPos: [number, number, number];
  progress: number;
}

/** Player trade offer lifecycle (matches beta's TradeOffer) */
export interface TradeOffer {
  give: Partial<Record<ResourceType, number>>;
  get: Partial<Record<ResourceType, number>>;
  status: 'DRAFT' | 'PROPOSED' | 'ACCEPTED' | 'REJECTED';
  partnerId?: string;
}

/** Resource feedback toast entry */
export interface ResourceFeedbackEntry {
  id: string;
  playerName: string;
  playerColor: string;
  resource: ResourceType;
  amount: number;
  timestamp: number;
}

/** Presence player for 3D panels */
export interface Presence3DPlayer {
  id: string;
  name: string;
  color: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isActive: boolean;
  victoryPoints: number;
}

/** Lobby configuration */
export interface LobbyConfig {
  players: Array<{ name: string; color: string; isAI: boolean }>;
  difficulty: 'beginner' | 'standard' | 'expert';
  boardSize?: BoardSize;
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface CatanStoreState {
  // ── Core game state (authoritative) ──────────────────────────────────────
  game: GameState;

  // ── Game config ──────────────────────────────────────────────────────────
  aiPlayerIds: string[];
  difficulty: 'beginner' | 'standard' | 'expert';
  humanPlayerIds: string[];

  // ── UI state ─────────────────────────────────────────────────────────────
  showLobby: boolean;
  buildMode: BuildModeType;
  cameraMode: CameraMode;
  rolling: boolean;
  rollKey: number;
  showTradePanel: boolean;
  showIntroAnimation: boolean;
  introPhase: IntroPhase;
  soundMuted: boolean;
  layoutMode: boolean;

  // ── HUD panel toggles ────────────────────────────────────────────────────
  showTutorial: boolean;
  showRules: boolean;
  showChat: boolean;
  showDiceHistory: boolean;
  showSaveLoad: boolean;
  showReplay: boolean;
  showLeaderboard: boolean;
  showTxLog: boolean;
  showSettings: boolean;

  // ── Carousel state ───────────────────────────────────────────────────────
  activeCarouselIndex: number;
  isCarouselOpen: boolean;

  // ── Trade state (beta pattern) ───────────────────────────────────────────
  activeTrade: TradeOffer | null;

  // ── Robber UI state ──────────────────────────────────────────────────────
  pendingRobberHexId: number | null;

  // ── Animation / 3D state ─────────────────────────────────────────────────
  resourceFlows: FlowingResource[];
  resourceFeedback: ResourceFeedbackEntry[];
  diceHistory: number[];
  productionLog: ProductionEntry[];

  // ── VP celebration ───────────────────────────────────────────────────────
  vpCelebration: { player: string; vp: number } | null;

  // ── Presence ─────────────────────────────────────────────────────────────
  presencePlayers: Presence3DPlayer[];
}

interface CatanStoreActions {
  // ── Game lifecycle ───────────────────────────────────────────────────────
  startGame: (config: LobbyConfig, multiplayerNames?: string[]) => void;
  newGame: () => void;
  setGame: (game: GameState) => void;

  // ── Dice ─────────────────────────────────────────────────────────────────
  rollDice: () => void;

  // ── Turn ─────────────────────────────────────────────────────────────────
  doEndTurn: () => void;

  // ── Setup ────────────────────────────────────────────────────────────────
  placeSetupSettlement: (vertexId: string) => void;
  placeSetupRoad: (edgeId: string) => void;

  // ── Building (main phase) ────────────────────────────────────────────────
  setBuildMode: (mode: BuildModeType) => void;
  buildAtVertex: (vertexId: string) => void;
  buildRoadAtEdge: (edgeId: string) => void;
  placeFreeRoad: (edgeId: string) => void;
  buyDevCard: () => void;

  // ── Dev cards ────────────────────────────────────────────────────────────
  doPlayKnight: () => void;
  doPlayYearOfPlenty: (r1: ResourceType, r2: ResourceType) => void;
  doPlayMonopoly: (resource: ResourceType) => void;
  doPlayRoadBuilding: () => void;

  // ── Robber ───────────────────────────────────────────────────────────────
  doMoveRobber: (hexId: number) => void;
  doStealResource: (targetPlayerId: string) => void;
  skipSteal: () => void;

  // ── Discard ──────────────────────────────────────────────────────────────
  doDiscard: (resources: Record<ResourceType, number>) => void;

  // ── Trade (bank) ─────────────────────────────────────────────────────────
  doBankTrade: (give: ResourceType, receive: ResourceType) => void;

  // ── Trade (player — beta pattern) ────────────────────────────────────────
  updateTradeDraft: (give: Partial<Record<ResourceType, number>>, get: Partial<Record<ResourceType, number>>) => void;
  proposeTradeDraft: () => void;
  cancelTrade: () => void;
  executeTrade: (partnerId: string) => void;

  // ── 3D Animation ─────────────────────────────────────────────────────────
  addResourceFlow: (flow: Omit<FlowingResource, 'id' | 'progress'>) => void;
  removeResourceFlow: (id: string) => void;
  addResourceFeedback: (entry: Omit<ResourceFeedbackEntry, 'id' | 'timestamp'>) => void;
  removeResourceFeedback: (id: string) => void;

  // ── UI toggles ───────────────────────────────────────────────────────────
  setShowLobby: (v: boolean) => void;
  setCameraMode: (mode: CameraMode) => void;
  setShowTradePanel: (v: boolean) => void;
  togglePanel: (panel: keyof Pick<CatanStoreState,
    'showTutorial' | 'showRules' | 'showChat' | 'showDiceHistory' |
    'showSaveLoad' | 'showReplay' | 'showLeaderboard' | 'showTxLog' | 'showSettings'
  >) => void;
  toggleSoundMuted: () => void;
  setCarouselIndex: (index: number) => void;
  toggleCarousel: () => void;

  // ── Presence ─────────────────────────────────────────────────────────────
  setPresencePlayers: (players: Presence3DPlayer[]) => void;

  // ── Persistence bridge ───────────────────────────────────────────────────
  loadState: (game: GameState) => void;
}

export type CatanStore = CatanStoreState & CatanStoreActions;

// ============================================================================
// HELPERS
// ============================================================================

function uid(): string {
  return Math.random().toString(36).substring(2, 10);
}

function emitPhaseChange(phase: string) {
  CatanEventBus.dispatch({ type: 'PHASE_CHANGED', payload: { newPhase: phase } });
}

function emitTurnChange(nextPlayerId: string, turnNumber: number) {
  CatanEventBus.dispatch({ type: 'TURN_CHANGED', payload: { nextPlayerId, turnNumber } });
}

// ============================================================================
// DEFAULT INITIAL STATE
// ============================================================================

const defaultGame = createInitialGameState(['Red', 'Blue', 'Orange', 'White']);

// ============================================================================
// STORE
// ============================================================================

export const useCatanStore = create<CatanStore>()(
  subscribeWithSelector((set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────────
    game: defaultGame,
    aiPlayerIds: [],
    difficulty: 'standard',
    humanPlayerIds: defaultGame.players.map(p => p.id),
    showLobby: true,
    buildMode: null,
    cameraMode: 'tactical',
    rolling: false,
    rollKey: 0,
    showTradePanel: false,
    showIntroAnimation: true,
    introPhase: 'shuffle',
    soundMuted: false,
    layoutMode: false,
    showTutorial: false,
    showRules: false,
    showChat: false,
    showDiceHistory: false,
    showSaveLoad: false,
    showReplay: false,
    showLeaderboard: false,
    showTxLog: false,
    showSettings: false,
    activeCarouselIndex: 0,
    isCarouselOpen: true,
    activeTrade: null,
    pendingRobberHexId: null,
    resourceFlows: [],
    resourceFeedback: [],
    diceHistory: [],
    productionLog: [],
    vpCelebration: null,
    presencePlayers: [],

    // ══════════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ══════════════════════════════════════════════════════════════════════════

    // ── Game lifecycle ─────────────────────────────────────────────────────

    startGame: (config, multiplayerNames) => {
      const playerNames = multiplayerNames?.length
        ? multiplayerNames
        : config.players.map(p => p.name);
      const initialState = createInitialGameState(playerNames, config.boardSize);
      const stateWithColors: GameState = {
        ...initialState,
        players: initialState.players.map((p, i) => ({
          ...p,
          color: config.players[i]?.color ?? p.color,
        })),
      };
      const aiIds = config.players
        .filter(p => p.isAI)
        .map((_, i) => stateWithColors.players[i]?.id)
        .filter((id): id is string => !!id);

      set({
        game: stateWithColors,
        aiPlayerIds: aiIds,
        difficulty: config.difficulty,
        humanPlayerIds: stateWithColors.players.filter(p => !aiIds.includes(p.id)).map(p => p.id),
        showLobby: false,
        buildMode: null,
        showIntroAnimation: true,
        introPhase: 'shuffle',
        diceHistory: [],
        productionLog: [],
        resourceFlows: [],
        resourceFeedback: [],
        activeTrade: null,
        pendingRobberHexId: null,
      });
    },

    newGame: () => set({ showLobby: true, buildMode: null }),

    setGame: (game) => {
      const prev = get().game;
      set({ game });
      if (prev.phase !== game.phase) emitPhaseChange(game.phase);
      if (prev.currentPlayerIndex !== game.currentPlayerIndex) {
        emitTurnChange(game.players[game.currentPlayerIndex].id, game.turn);
      }
    },

    // ── Dice ───────────────────────────────────────────────────────────────

    rollDice: () => {
      const { game, rolling } = get();
      if (rolling || game.phase !== 'roll') return;

      set({ rolling: true, rollKey: get().rollKey + 1, productionLog: [] });

      CatanEventBus.dispatch({
        type: 'DICE_ROLL_STARTED',
        payload: { player: getCurrentPlayer(game).id },
      });

      // Delayed state update for animation
      setTimeout(() => {
        const current = get().game;
        const next = performRoll(current);

        if (next.diceRoll) {
          const total = next.diceRoll[0] + next.diceRoll[1];
          const newHistory = [...get().diceHistory, total];

          CatanEventBus.dispatch({
            type: 'DICE_SETTLED',
            payload: { result: next.diceRoll as [number, number], total },
          });

          if (total !== 7) {
            const prod = computeProduction(current, total);
            // Emit resource gain events
            for (const entry of prod) {
              CatanEventBus.dispatch({
                type: 'RESOURCES_GAINED',
                payload: {
                  playerId: entry.playerId,
                  resources: { [entry.resource]: entry.amount },
                  source: 'dice',
                },
              });
            }
            // Build resource feedback entries
            const feedback: ResourceFeedbackEntry[] = prod.map(entry => {
              const player = next.players.find(p => p.id === entry.playerId);
              return {
                id: `rf-${uid()}`,
                playerName: entry.playerName,
                playerColor: player?.color ?? '#fff',
                resource: entry.resource,
                amount: entry.amount,
                timestamp: Date.now(),
              };
            });
            set({
              game: next,
              rolling: false,
              diceHistory: newHistory,
              productionLog: prod,
              resourceFeedback: [...get().resourceFeedback, ...feedback],
            });
          } else {
            // Rolled 7 — robber sequence
            set({
              game: next,
              rolling: false,
              diceHistory: newHistory,
              productionLog: [],
            });
          }
        } else {
          set({ game: next, rolling: false });
        }

        if (next.phase !== current.phase) emitPhaseChange(next.phase);
      }, 800);
    },

    // ── Turn ───────────────────────────────────────────────────────────────

    doEndTurn: () => {
      const { game } = get();
      const next = endTurn(game);
      set({ game: next, buildMode: null, activeTrade: null, pendingRobberHexId: null });
      emitTurnChange(next.players[next.currentPlayerIndex].id, next.turn);
      emitPhaseChange(next.phase);
    },

    // ── Setup ──────────────────────────────────────────────────────────────

    placeSetupSettlement: (vertexId) => {
      const { game } = get();
      if (game.phase !== 'setup-settlement') return;
      const playerId = getCurrentPlayer(game).id;
      const built = buildSettlement(game, playerId, vertexId);
      if (built === game) return;

      CatanEventBus.dispatch({
        type: 'BUILDING_PLACED',
        payload: { playerId, buildingType: 'settlement', positionId: vertexId },
      });

      // Setup round 2 resource feedback
      if (game.setupRound === 2) {
        const vertex = built.vertices.find(v => v.id === vertexId);
        if (vertex) {
          const resMap: Record<string, ResourceType> = {
            forest: 'wood', hills: 'brick', pasture: 'sheep', fields: 'wheat', mountains: 'ore',
          };
          const fb: ResourceFeedbackEntry[] = [];
          for (const hid of vertex.hexIds) {
            const hex = built.hexTiles.find(h => h.id === hid);
            const res = hex ? resMap[hex.terrain] : undefined;
            if (res) {
              fb.push({
                id: `rf-${uid()}`,
                playerName: getCurrentPlayer(game).name,
                playerColor: getCurrentPlayer(game).color,
                resource: res,
                amount: 1,
                timestamp: Date.now(),
              });
            }
          }
          if (fb.length) {
            set(s => ({ resourceFeedback: [...s.resourceFeedback, ...fb] }));
          }
        }
      }

      const advanced = advanceSetup(built);
      set({ game: advanced });
      if (built.phase !== advanced.phase) emitPhaseChange(advanced.phase);
    },

    placeSetupRoad: (edgeId) => {
      const { game } = get();
      if (game.phase !== 'setup-road') return;
      const playerId = getCurrentPlayer(game).id;
      const built = buildRoad(game, playerId, edgeId);
      if (built === game) return;

      CatanEventBus.dispatch({
        type: 'ROAD_PLACED',
        payload: { playerId, edgeId },
      });

      const advanced = advanceSetup(built);
      set({ game: advanced });
      if (built.phase !== advanced.phase) emitPhaseChange(advanced.phase);
    },

    // ── Building (main phase) ──────────────────────────────────────────────

    setBuildMode: (mode) => set({ buildMode: mode }),

    buildAtVertex: (vertexId) => {
      const { game, buildMode } = get();
      if (game.phase !== 'main') return;
      const pid = getCurrentPlayer(game).id;

      if (buildMode === 'settlement') {
        const next = buildSettlement(game, pid, vertexId);
        if (next !== game) {
          CatanEventBus.dispatch({
            type: 'BUILDING_PLACED',
            payload: { playerId: pid, buildingType: 'settlement', positionId: vertexId },
          });
          CatanEventBus.dispatch({
            type: 'RESOURCES_SPENT',
            payload: { playerId: pid, resources: BUILDING_COSTS.settlement },
          });
          set({ game: next, buildMode: null });
        }
      } else if (buildMode === 'city') {
        const next = buildCity(game, pid, vertexId);
        if (next !== game) {
          CatanEventBus.dispatch({
            type: 'BUILDING_PLACED',
            payload: { playerId: pid, buildingType: 'city', positionId: vertexId },
          });
          CatanEventBus.dispatch({
            type: 'RESOURCES_SPENT',
            payload: { playerId: pid, resources: BUILDING_COSTS.city },
          });
          set({ game: next, buildMode: null });
        }
      }
    },

    buildRoadAtEdge: (edgeId) => {
      const { game, buildMode } = get();
      if (game.phase !== 'main' || buildMode !== 'road') return;
      const pid = getCurrentPlayer(game).id;
      const next = buildRoad(game, pid, edgeId);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'ROAD_PLACED',
          payload: { playerId: pid, edgeId },
        });
        CatanEventBus.dispatch({
          type: 'RESOURCES_SPENT',
          payload: { playerId: pid, resources: BUILDING_COSTS.road },
        });
        set({ game: next, buildMode: null });
      }
    },

    placeFreeRoad: (edgeId) => {
      const { game } = get();
      if (game.freeRoadsRemaining <= 0) return;
      const pid = getCurrentPlayer(game).id;
      const next = buildFreeRoad(game, pid, edgeId);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'ROAD_PLACED',
          payload: { playerId: pid, edgeId },
        });
        set({ game: next });
      }
    },

    buyDevCard: () => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      if (!canBuyDevelopmentCard(game, pid)) return;
      const next = buyDevelopmentCard(game, pid);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'RESOURCES_SPENT',
          payload: { playerId: pid, resources: { sheep: 1, wheat: 1, ore: 1 } },
        });
        set({ game: next });
      }
    },

    // ── Dev cards ──────────────────────────────────────────────────────────

    doPlayKnight: () => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      const next = playKnight(game, pid);
      if (next !== game) {
        set({ game: next });
        emitPhaseChange(next.phase);
      }
    },

    doPlayYearOfPlenty: (r1, r2) => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      const next = playYearOfPlenty(game, pid, r1, r2);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'RESOURCES_GAINED',
          payload: {
            playerId: pid,
            resources: r1 === r2 ? { [r1]: 2 } : { [r1]: 1, [r2]: 1 },
            source: 'bank',
          },
        });
        set({ game: next });
      }
    },

    doPlayMonopoly: (resource) => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      const next = playMonopoly(game, pid, resource);
      if (next !== game) set({ game: next });
    },

    doPlayRoadBuilding: () => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      const next = playRoadBuilding(game, pid);
      if (next !== game) set({ game: next });
    },

    // ── Robber ─────────────────────────────────────────────────────────────

    doMoveRobber: (hexId) => {
      const { game } = get();
      if (game.phase !== 'robber-move') return;
      const next = moveRobber(game, hexId);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'ROBBER_MOVED',
          payload: { hexId },
        });
        set({ game: next, pendingRobberHexId: hexId });
        if (next.phase !== game.phase) emitPhaseChange(next.phase);
      }
    },

    doStealResource: (targetPlayerId) => {
      const { game } = get();
      if (game.phase !== 'robber-steal') return;
      const next = stealResource(game, targetPlayerId);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'ROBBER_MOVED',
          payload: { hexId: game.robberHexId, targetPlayerId },
        });
        set({ game: next, pendingRobberHexId: null });
        if (next.phase !== game.phase) emitPhaseChange(next.phase);
      }
    },

    skipSteal: () => {
      const { game } = get();
      // No valid steal targets — just end turn
      const next = endTurn(game);
      set({ game: next, pendingRobberHexId: null });
      emitTurnChange(next.players[next.currentPlayerIndex].id, next.turn);
      emitPhaseChange(next.phase);
    },

    // ── Discard ────────────────────────────────────────────────────────────

    doDiscard: (resources) => {
      const { game } = get();
      const discIdx = game.discardingPlayerIndex ?? 0;
      const playerId = game.players[discIdx]?.id;
      if (!playerId) return;
      const next = discardResources(game, playerId, resources);
      if (next !== game) {
        set({ game: next });
        if (next.phase !== game.phase) emitPhaseChange(next.phase);
      }
    },

    // ── Trade (bank) ───────────────────────────────────────────────────────

    doBankTrade: (give, receive) => {
      const { game } = get();
      const pid = getCurrentPlayer(game).id;
      const next = bankTrade(game, pid, give, receive);
      if (next !== game) {
        CatanEventBus.dispatch({
          type: 'RESOURCES_SPENT',
          payload: {
            playerId: pid,
            resources: { [give]: getPlayerTradeRatio(game, pid, give) },
          },
        });
        CatanEventBus.dispatch({
          type: 'RESOURCES_GAINED',
          payload: { playerId: pid, resources: { [receive]: 1 }, source: 'bank' },
        });
        set({ game: next });
      }
    },

    // ── Trade (player — beta pattern) ──────────────────────────────────────

    updateTradeDraft: (give, get_) =>
      set({ activeTrade: { give, get: get_, status: 'DRAFT' } }),

    proposeTradeDraft: () => {
      const { activeTrade } = get();
      if (!activeTrade) return;

      set({ activeTrade: { ...activeTrade, status: 'PROPOSED' } });

      CatanEventBus.dispatch({
        type: 'TRADE_PROPOSED',
        payload: { offerId: uid(), fromPlayer: getCurrentPlayer(get().game).id },
      });

      // AI auto-response simulation (same as beta)
      setTimeout(() => {
        const store = get();
        if (store.activeTrade?.status !== 'PROPOSED') return;
        // Simple check: pick first non-human player with resources
        const game = store.game;
        const pid = getCurrentPlayer(game).id;
        const candidates = game.players.filter(p => p.id !== pid && store.aiPlayerIds.includes(p.id));
        if (candidates.length === 0) return;

        const partner = candidates[0];
        let canAfford = true;
        for (const [res, amt] of Object.entries(store.activeTrade.get)) {
          if ((partner.resources[res as ResourceType] ?? 0) < (amt ?? 0)) {
            canAfford = false;
            break;
          }
        }

        if (canAfford && Math.random() > 0.3) {
          set({ activeTrade: { ...store.activeTrade!, status: 'ACCEPTED', partnerId: partner.id } });
        } else {
          set({ activeTrade: { ...store.activeTrade!, status: 'REJECTED' } });
        }
      }, 2000);
    },

    cancelTrade: () => set({ activeTrade: null }),

    executeTrade: (partnerId) => {
      const { game, activeTrade } = get();
      if (!activeTrade || activeTrade.status !== 'ACCEPTED') return;

      // Use CatanEngine's proposeTrade + acceptTrade for proper validation,
      // or do inline resource swap matching beta pattern
      const pid = getCurrentPlayer(game).id;
      const pIdx = game.players.findIndex(p => p.id === pid);
      const partnerIdx = game.players.findIndex(p => p.id === partnerId);
      if (pIdx === -1 || partnerIdx === -1) return;

      const updatedPlayers = [...game.players];
      const active = { ...updatedPlayers[pIdx], resources: { ...updatedPlayers[pIdx].resources } };
      const partner = { ...updatedPlayers[partnerIdx], resources: { ...updatedPlayers[partnerIdx].resources } };

      for (const [res, amt] of Object.entries(activeTrade.give)) {
        if (!amt) continue;
        active.resources[res as ResourceType] -= amt;
        partner.resources[res as ResourceType] += amt;
      }
      for (const [res, amt] of Object.entries(activeTrade.get)) {
        if (!amt) continue;
        active.resources[res as ResourceType] += amt;
        partner.resources[res as ResourceType] -= amt;
      }

      updatedPlayers[pIdx] = active;
      updatedPlayers[partnerIdx] = partner;

      set({
        game: { ...game, players: updatedPlayers },
        activeTrade: null,
      });
    },

    // ── 3D Animation ───────────────────────────────────────────────────────

    addResourceFlow: (flow) =>
      set(s => ({
        resourceFlows: [...s.resourceFlows, { ...flow, id: uid(), progress: 0 }],
      })),

    removeResourceFlow: (id) =>
      set(s => ({
        resourceFlows: s.resourceFlows.filter(f => f.id !== id),
      })),

    addResourceFeedback: (entry) =>
      set(s => ({
        resourceFeedback: [
          ...s.resourceFeedback,
          { ...entry, id: `rf-${uid()}`, timestamp: Date.now() },
        ],
      })),

    removeResourceFeedback: (id) =>
      set(s => ({
        resourceFeedback: s.resourceFeedback.filter(f => f.id !== id),
      })),

    // ── UI toggles ─────────────────────────────────────────────────────────

    setShowLobby: (v) => set({ showLobby: v }),
    setCameraMode: (mode) => set({ cameraMode: mode }),
    setShowTradePanel: (v) => set({ showTradePanel: v }),

    togglePanel: (panel) => set(s => ({ [panel]: !s[panel] })),
    toggleSoundMuted: () => set(s => ({ soundMuted: !s.soundMuted })),
    setCarouselIndex: (index) => set({ activeCarouselIndex: index }),
    toggleCarousel: () => set(s => ({ isCarouselOpen: !s.isCarouselOpen })),

    // ── Presence ───────────────────────────────────────────────────────────

    setPresencePlayers: (players) => set({ presencePlayers: players }),

    // ── Persistence ────────────────────────────────────────────────────────

    loadState: (game) => set({ game, buildMode: null, showLobby: false }),
  })),
);

// ============================================================================
// SELECTORS — lightweight derived-state hooks
// ============================================================================

/** Current active player */
export const useCurrentPlayer = () =>
  useCatanStore(s => getCurrentPlayer(s.game));

/** Game phase shorthand */
export const useGamePhase = () =>
  useCatanStore(s => s.game.phase);

/** Is it the human player's turn? */
export const useIsHumanTurn = () =>
  useCatanStore(s => {
    const current = getCurrentPlayer(s.game);
    return s.humanPlayerIds.includes(current.id);
  });

/** Valid build targets for current player + mode */
export const useValidBuildTargets = () =>
  useCatanStore(s => {
    const { game, buildMode } = s;
    const pid = getCurrentPlayer(game).id;
    const isSetup = game.phase === 'setup-settlement';

    if (buildMode === 'city') {
      return {
        vertexIds: game.vertices.filter(v => canBuildCity(game, pid, v.id)).map(v => v.id),
        edgeIds: [] as string[],
      };
    }

    const showVertices = buildMode === 'settlement' || game.phase === 'setup-settlement';
    const showEdges = buildMode === 'road' || game.phase === 'setup-road' || game.freeRoadsRemaining > 0;

    return {
      vertexIds: showVertices
        ? game.vertices.filter(v => canBuildSettlement(game, pid, v.id, isSetup)).map(v => v.id)
        : [],
      edgeIds: showEdges
        ? game.edges.filter(e => canBuildRoad(game, pid, e.id, game.phase === 'setup-road')).map(e => e.id)
        : [],
    };
  });

/** Stealable player IDs at current robber position */
export const useStealCandidates = () =>
  useCatanStore(s => {
    if (s.game.phase !== 'robber-steal') return [];
    return getStealablePlayerIds(s.game, s.game.robberHexId, getCurrentPlayer(s.game).id);
  });
