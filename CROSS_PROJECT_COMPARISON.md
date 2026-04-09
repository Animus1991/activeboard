# Cross-Project Comparison: TableForge vs Active Board AI Studio

## Executive Summary

Both projects implement a 3D Settlers of Catan board game using **React Three Fiber + Three.js + Zustand + TailwindCSS**. They share the same domain but differ fundamentally in **architecture maturity**, **visual pipeline**, **feature set**, and **technology choices**. Each has distinct strengths that the other lacks. This document maps every axis of comparison and concludes with a concrete **cross-pollination plan**.

---

## 1. Architecture & State Management

### TableForge (TF)
| Aspect | Detail |
|--------|--------|
| **State** | `CatanEngine.ts` (1424 lines) — pure-function engine with immutable state transforms. `CatanStateTree.ts` — formal event-driven type system (`CatanMatchState`, `CatanDomainEvent`, `CatanCommand`). |
| **Pipeline** | Commands → Validation → Domain Events → Reducers → Projections → Render/UI sync. Full DDD folder structure (`domain/`, `application/`, `infrastructure/`, `projections/`, `selectors/`, `render/`). |
| **Projections** | `CatanProjections.ts` (453 lines) — 5 pure projection types: `GameplayProjection`, `UIProjection`, `BuildLegalTargets`, `RenderDirtyFlags`, resource helpers. |
| **Reducer** | `reduceCatanEvent.ts` — typed event dispatcher with individual handlers per event type. |
| **Store** | Zustand used only at the UI boundary in `CatanGamePage.tsx`; engine is pure-function. |
| **Networking** | `roomRuntime.ts`, `serverContracts.ts` — formal interfaces for `MatchRoomRuntime`, `ConnectedPlayerSession`, spectator view packets. Uses Liveblocks. |

### Active Board AI Studio (ABAS)
| Aspect | Detail |
|--------|--------|
| **State** | Single monolithic `store.ts` (1702 lines) — Zustand store with **all** game logic, AI, UI state, and side effects inlined. |
| **Pipeline** | Direct mutation: UI calls `store.rollDice()` → inline validation + state mutation + side effects (sounds, animations, AI triggers) — all in one function. |
| **Projections** | None explicit. UI reads raw state directly via `useGameStore` selectors. |
| **Reducer** | No reducer pattern. Each action method (`rollDice`, `placePiece`, etc.) mutates state via `set()`. |
| **Store** | Zustand is the **single architectural layer** — it IS the engine, the validator, the reducer, and the UI connector. |
| **Networking** | Dummy WebSocket (`wss://echo.websocket.org`) for "sync" placeholder. `react-use-websocket` dependency. `simple-peer` in deps but unused. |

### 🎯 Verdict
**TF wins on architecture rigor** — proper separation of concerns, event sourcing, pure functions, testability.
**ABAS wins on simplicity and rapid iteration** — everything in one file means fast prototyping.

---

## 2. Type System & Domain Model

### TableForge
- `CatanEngine.ts`: `HexTile`, `Vertex`, `Edge`, `Building`, `Road`, `Player`, `GameState`, `GamePhase` (11 phases), `GameLogEntry`, `TradeOffer` with status enum.
- `CatanStateTree.ts`: `CatanMatchState` (meta, rules, lifecycle, dice, bank, specialCards, robberExt, render), `LifecyclePhase` enum (12 phases), `CatanCommand` union, `CatanDomainEvent` union, `RenderDirtyFlags`, `FEATURE_MATRIX`, `DEFAULT_RULES`.
- **Strong** — typed identifiers (`PlayerId`, `HexId`, `VertexId`, `EdgeId`, `HarborId`), resource maps, explicit costs.

### Active Board AI Studio
- `types.ts`: `Hex`, `Node`, `Edge`, `Player`, `GameState`, `DiceState`, `TradeOffer`, `ChatMessage`, `GameAction`, `ScenarioStep`, `FeatureMatrixRow`.
- Enums: `TerrainType`, `ResourceType`, `PieceType`, `DevCardType`, `TurnPhase` (10 phases), `Difficulty`, `BoardSize`, `PendingActionType`.
- `Vec3`, `Transform3D` — **3D spatial types embedded in domain model** (world positions on Hex, Node, Edge).
- **Strength**: `FeatureMatrixRow` — explicit completeness tracking contract type.
- **Weakness**: `GameAction.payload: any`, `pendingAction.data?: any` — loose typing.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | `Transform3D` and `Vec3` on domain entities. TF currently computes world positions only at render time. Having them on the domain model enables spatial AI and physics. |
| **ABAS → TF** | `Difficulty` + `BoardSize` enums — TF has no difficulty/board-size selector. |
| **ABAS → TF** | `FeatureMatrixRow` contract type — formalize feature completeness. |
| **TF → ABAS** | Typed identifiers (`PlayerId`, `HexId`, etc.) — replace raw strings. |
| **TF → ABAS** | Formal event/command unions — replace `any` payloads. |
| **TF → ABAS** | `LifecyclePhase` (12 granular phases) — ABAS `TurnPhase` conflates phases. |

---

## 3. Board Topology & Geometry

### TableForge
- Standard Catan board: hardcoded `STANDARD_TERRAIN` array (19 hexes), `STANDARD_NUMBERS`, axial coordinate generation.
- Hex geometry: `HEX_SIZE = 1.28`, `HEX_GAP = 0.04`, extruded shapes with bevel, procedural canvas textures (768px).
- Harbors: 9 standard harbors with typed `HarborType`.

### Active Board AI Studio
- **Parameterized** board generation: `generateTopology(radius)` supports radius 1/2/3.
- **Backtracking constraint solver** for terrain placement (no same terrain adjacent) and token placement (no adjacent 6/8).
- Hex size: unit 1.0, `1.732 * (q + r/2)` spacing.
- Harbors: assigned to coastal nodes dynamically with proper 2:1/3:1 distribution.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | Parameterized board generation with variable radius (Small/Medium/Large). |
| **ABAS → TF** | Backtracking constraint solver for terrain + token adjacency validation. |
| **TF → ABAS** | Higher-quality hex geometry (beveled extrusions, gap spacing, procedural textures). |
| **TF → ABAS** | Typed `HarborType` instead of string labels. |

---

## 4. 3D Rendering & Visual Quality

### TableForge (`CatanBoard3D.tsx` — 63KB)
- **Lighting**: 7-light cinematic rig (key/fill/rim/bounce/spot/2 accents), 4096 shadow map.
- **Terrain**: Procedural 768px canvas textures per biome (detailed oil-painting style per terrain type).
- **Number Tokens**: Premium embossed coin — bronze metallic rim, parchment disc, recessed inner circle, bold serif typography, probability pips.
- **Buildings**: Detailed settlements (foundation + walls + peaked roof + chimney + door + window + contact shadow); cities (keep + tower + battlements + wing + 3 windows).
- **Roads**: Wide planks with side rail posts, dark underside bed.
- **Ocean**: 5-layer animated water (deep/mid/shallow/foam/caustics).
- **Sea Frame**: Per-tile color variation, gold trim border.
- **Harbors**: Dark stone base + coloured top, wooden pier/dock, pile posts, bollards.
- **Table**: Walnut cylinder body + veneer top + green felt inlay + brass edge.
- **Dice**: 3D dice with embossed pips, idle wobble animation.
- **Renderer**: ACES Filmic tone mapping, sRGB output, DPR 2.5.

### Active Board AI Studio (`HexTile.tsx` + `Tabletop.tsx` + components — ~50KB)
- **Lighting**: Ambient + directional (4096 shadow) + point + spot — simpler 4-light setup.
- **Terrain**: **Full 3D terrain elements** per biome:
  - Forest: 24 multi-layered cone trees with trunks.
  - Mountains: 5 peaks with snow caps and rock debris.
  - Hills: 8 randomized mounds + 14 rocks.
  - Fields: 60 wheat stalks + 6 furrows.
  - Pasture: 45 grass clumps + 25 flowers + 3 sheep (with heads!).
  - Desert: Dunes + cactus.
  - Water: Custom shader with vertex displacement waves + foam particles.
- **Custom Shaders**: `three-custom-shader-material` for animated wind on Forest/Fields/Pasture and water displacement.
- **Post-processing**: Full `EffectComposer` pipeline — Bloom, Depth of Field, Vignette, Noise, SMAA.
- **Physics**: `@react-three/rapier` — dice thrown with actual rigid body physics, gravity, bounce.
- **Environment**: `<Environment preset="apartment" />` for HDR reflections.
- **VR/XR**: `@react-three/xr` integration with `VRButton`.
- **Number Tokens**: Physical cylinder with PBR material + text overlay.
- **Buildings**: Detailed meshes (settlement: foundation + body + door with gold handle + layered cone roof + chimney; city: 2-tier base + keep + 4 watchtowers with cone roofs + arched gate).
- **Contact Shadows**: `<ContactShadows>` with high resolution (1024).
- **Canvas Overlay**: CSS texture overlay for painterly feel.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | **3D terrain elements** (trees, mountains, sheep, wheat, cacti) — TF uses only flat canvas textures on hex surfaces. Adding 3D props would massively increase immersion. |
| **ABAS → TF** | **Post-processing pipeline** (Bloom + DoF + Vignette + SMAA) — TF has none. |
| **ABAS → TF** | **Physics-based dice** via Rapier — TF dice are static meshes with wobble animation. Real physics dice rolling is dramatically more engaging. |
| **ABAS → TF** | **HDR Environment map** (`<Environment preset="..."/>`) for realistic reflections. |
| **ABAS → TF** | **Custom vertex shaders** for wind animation on vegetation and water displacement. |
| **ABAS → TF** | **VR/XR support** (`@react-three/xr`) — TF has `UnityEmbed.tsx` but no native WebXR. |
| **TF → ABAS** | **Procedural canvas textures** (768px painted-style terrain) — ABAS hex surfaces are plain colored. |
| **TF → ABAS** | **Premium number tokens** with bronze rim, recessed circle, serif typography. |
| **TF → ABAS** | **Cinematic 7-light rig** with warm/cool contrast, rim lights, accent spots. |
| **TF → ABAS** | **Table surface** (walnut + felt inlay + brass edge) — ABAS table is a flat brown plane. |
| **TF → ABAS** | **ACES Filmic tone mapping + sRGB output** for color accuracy. |

---

## 5. AI Opponents

### TableForge (`useCatanAI.ts` — 408 lines)
- Separate hook, uses **pure engine functions** (no direct state mutation).
- 3 difficulty levels: Beginner, Standard, Expert.
- Node scoring: pip probability + resource diversity + harbor bonus.
- Strategic decision tree: city upgrade → settlement → dev card → road → bank trade.
- Uses exported engine functions: `getValidSettlementVertices`, `getValidRoadEdges`, etc.

### Active Board AI Studio (`store.ts::aiTurn` — ~300 lines inline)
- Inlined inside the Zustand store as `aiTurn: async ()`.
- 3 difficulties with `aggression` scaling.
- Same node scoring strategy (pip-based).
- **Richer** decision tree:
  - Pre-roll Knight play (Expert).
  - Multi-action loop (keeps building/trading until no actions remain).
  - Road pathfinding toward best settlement spot.
  - Strategic dev card play (Knight when robber is on player's hex, Monopoly for missing resource, YoP for goal resources).
  - Bank trade with harbor awareness.
  - **Player trade proposals** to human (with AI evaluation of incoming trades!).
  - Expert refuses trades with leader near victory.
  - `getTradeOfferRating` for trade evaluation.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | Multi-action loop AI (multiple builds per turn). |
| **ABAS → TF** | Pre-roll Knight play logic. |
| **ABAS → TF** | AI trade proposals to human + incoming trade evaluation. |
| **ABAS → TF** | `getTradeOfferRating` — rate trade offers as good/fair/bad. |
| **TF → ABAS** | Extract AI into separate module (not inline in store) for testability. |
| **TF → ABAS** | Use pure engine functions instead of `get()` / `set()` side effects. |

---

## 6. UI / HUD System

### TableForge (`CatanGamePage.tsx` — 50KB)
- `ActionPanel` — phase-aware action buttons (roll, build, trade, dev cards).
- `PlayerPanel` — VP breakdown (🏠×N 🏙×N 🛤+2 ⚔+2 ⭐×N).
- `ResourcePanel` — maritime trade rates (2:1/3:1/4:1) per resource + affordability badges.
- `CatanDice.tsx` — 2D animated dice with Framer Motion.
- `CatanTradePanel.tsx` — dedicated trade panel.
- `CatanLobby.tsx` — lobby/setup screen.
- Production log overlay after each roll.
- Turn banner with lifecycle phase label.
- Uses Radix UI primitives (dialog, tabs, tooltips, etc.).

### Active Board AI Studio (`HUD.tsx` — 85KB)
- **Massive** single-file HUD with:
  - Lobby screen (difficulty, board size, tutorial, player count).
  - Tutorial system (step-by-step guidance with highlights).
  - Resource display with 3D resource icons (`Resource3D.tsx`).
  - Dice result overlay with animated display.
  - Discard panel.
  - Trade panel (bank + player-to-player with AI evaluation ratings).
  - Dev card hand with play buttons.
  - Game log with timestamps.
  - **Chat system** (in-game messaging).
  - **Rules reference** with search.
  - **Replay system** (play/pause/step through action history).
  - **Leaderboard** with VP tracking.
  - **Zoom controls** (+ / - / fit).
  - **Layout mode** (drag presence panels in 3D space).
  - **Dice history** chart.
  - **Transaction history** (resource flow log).
  - **Save/Load** to localStorage.
  - **Keyboard shortcuts** (WASD camera movement).
  - VP sparkle celebration animation.
  - Hand limit warning.
  - Resource gain notifications (floating +resource badges).
  - Sound effects integration.
  - Motion animations throughout.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | Tutorial system with step-by-step guidance. |
| **ABAS → TF** | In-game chat/messaging system. |
| **ABAS → TF** | Rules reference panel with search. |
| **ABAS → TF** | Replay system (action log playback). |
| **ABAS → TF** | Dice history chart. |
| **ABAS → TF** | Save/Load game to localStorage. |
| **ABAS → TF** | Zoom controls in HUD. |
| **ABAS → TF** | Resource gain floating notifications. |
| **ABAS → TF** | `Resource3D.tsx` — 3D resource models for UI. |
| **ABAS → TF** | Trade offer rating indicator (good/fair/bad). |
| **ABAS → TF** | Keyboard camera controls (WASD). |
| **TF → ABAS** | VP breakdown per player (buildings + roads + army + cards). |
| **TF → ABAS** | Maritime trade rates display (2:1/3:1/4:1 per resource). |
| **TF → ABAS** | Affordability badges on resources. |
| **TF → ABAS** | Production log (which resources each player got per roll). |
| **TF → ABAS** | Split HUD into smaller components (85KB single file is unmaintainable). |

---

## 7. Telepresence / Multiplayer

### TableForge
- `CatanPresence.tsx` (395 lines) — Full WebRTC implementation:
  - Full mesh peer connections (≤4 players).
  - Signalling via Liveblocks storage.
  - Video + audio per-player with toggle controls.
  - Graceful degradation (invisible until remote streams arrive).
  - Typed `SignalMessage` protocol (offer/answer/ice-candidate/join/leave).
  - `PeerState` tracking per connection.
- `roomRuntime.ts` — Server-side room management contracts (session tracking, spectator packets, room lifecycle).
- Liveblocks integration for real-time state sync.

### Active Board AI Studio
- `PresencePanel.tsx` (217 lines) — **Spatial** presence panels in 3D:
  - Floating panels positioned in 3D space around the table.
  - `PivotControls` for draggable layout.
  - getUserMedia for webcam/mic.
  - Scanline CRT effect overlay.
  - Canvas texture overlay for painterly look.
  - `PositionalAudio` for spatial sound.
  - Latency indicator ("LIVE" / "120ms").
- Dummy WebSocket — no actual multiplayer sync.
- `simple-peer` in deps but unused.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | **Spatial 3D presence panels** with PivotControls — TF panels are 2D overlays. Having 3D holographic player cards around the table is far more immersive. |
| **ABAS → TF** | `PositionalAudio` for spatial sound from player positions. |
| **ABAS → TF** | Scanline / CRT visual effects on video feeds. |
| **ABAS → TF** | Layout mode — let users drag panels in 3D space. |
| **TF → ABAS** | Actual WebRTC peer-to-peer implementation. |
| **TF → ABAS** | Liveblocks integration for real-time state sync. |
| **TF → ABAS** | Room management contracts (session tracking, spectator system). |

---

## 8. Sound System

### TableForge (`useCatanSounds.ts`)
- Hook-based sound with `use-sound`.
- Dice roll sound URL.
- Build/trade/card sounds.

### Active Board AI Studio
- `useSoundEffects.ts` — reactive hook listening to state changes.
- `store.playSound()` — imperative sound trigger from store actions.
- 7 sound categories: click, dice, card, build, trade, robber, celebration.
- External Mixkit sound URLs.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | Celebration sound on VP gain. |
| **ABAS → TF** | Robber-specific sound effect. |
| **ABAS → TF** | Reactive sound hooks that auto-play on state changes. |

---

## 9. Resource Animations

### TableForge
- No 3D resource flow animations.
- Static 2D resource panels.

### Active Board AI Studio
- `ResourceFlow.tsx` — **3D animated resource tokens** that fly in arcs from hex → player panel.
- Per-resource 3D models (log cylinder, brick box, wool sphere, wheat stalk, ore dodecahedron).
- Cubic ease-in-out interpolation with arc height.
- Spinning + scaling during flight.
- Point light glow on each flying resource.
- `Resource3D.tsx` — Mini Canvas renderers for 3D resource icons in HUD.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | `ResourceFlow.tsx` — 3D resource flight animations (huge visual impact). |
| **ABAS → TF** | `Resource3D.tsx` — 3D resource models for UI panels. |
| **ABAS → TF** | Resource gain notification system. |

---

## 10. Technology Stack Comparison

| Feature | TableForge | Active Board AI Studio |
|---------|-----------|----------------------|
| **React** | 18.3 | 19.0 |
| **Three.js** | 0.170 | 0.183 |
| **R3F** | 8.15 | 9.5 |
| **Drei** | 9.102 | 10.7 |
| **Zustand** | 4.5 | 5.0 |
| **Physics** | ❌ | ✅ @react-three/rapier |
| **Post-processing** | ✅ (dep, unused) | ✅ (Bloom, DoF, Vignette, SMAA) |
| **XR/VR** | ✅ (dep, basic) | ✅ VRButton + XR store |
| **Custom Shaders** | ❌ | ✅ three-custom-shader-material |
| **Framer Motion** | ✅ framer-motion | ✅ motion (v12) |
| **Sound** | use-sound | use-sound |
| **Routing** | react-router-dom | ❌ (SPA) |
| **Forms** | react-hook-form + zod | ❌ |
| **UI Primitives** | Radix UI (8 packages) | ❌ |
| **Real-time** | Liveblocks | react-use-websocket (stub) |
| **AI** | ❌ (local only) | @google/genai in deps |
| **Monorepo** | ✅ pnpm + turborepo | ❌ (single package) |
| **TailwindCSS** | v3.4 | v4.1 |
| **TypeScript** | 5.4 | 5.8 |

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **ABAS → TF** | Upgrade to React 19, R3F 9, Three 0.183, Drei 10.7, Zustand 5. |
| **ABAS → TF** | Add `@react-three/rapier` for physics-based dice. |
| **ABAS → TF** | Add `three-custom-shader-material` for wind/water shaders. |
| **ABAS → TF** | Enable post-processing pipeline (Bloom, DoF, Vignette). |
| **ABAS → TF** | Upgrade TailwindCSS to v4. |
| **ABAS → TF** | Add `@google/genai` for AI coach / game suggestions. |
| **TF → ABAS** | Add monorepo structure (pnpm workspaces + turborepo). |
| **TF → ABAS** | Add Radix UI for accessible UI primitives. |
| **TF → ABAS** | Add react-router-dom for multi-page (lobby → game → replay). |
| **TF → ABAS** | Add react-hook-form + zod for form validation. |
| **TF → ABAS** | Add Liveblocks for real multiplayer. |

---

## 11. Documentation & Testing

### TableForge
- `ARCHITECTURE_DECISIONS.md`, `ENGINEERING_BACKLOG.md`, `FULL_STACK_AUDIT.md`, `GAME_STATUS.md`, `IMPLEMENTATION_ROADMAP.md`, `PLATFORM_ARCHITECTURE.md` (44KB!), `PRIORITY_RISK_MATRIX.md`.
- `tests/scenario/scenarioRunner.ts` — test framework.
- Domain folder structure implies testability.

### Active Board AI Studio
- `INVESTIGATION.md` — concise workstream map, dependency map, truth-lock documents, visual benchmarks, telepresence feasibility matrix, production pipeline.
- `types.ts::ScenarioStep` + `ScenarioContext` — test contract types defined but no tests implemented.
- `metadata.json` for project metadata.

### 🎯 Cross-Pollination
| From | To | What |
|------|----|------|
| **TF → ABAS** | Full documentation suite (architecture, backlog, roadmap, audit). |
| **TF → ABAS** | Scenario runner test framework. |
| **ABAS → TF** | `INVESTIGATION.md` — visual benchmark analysis and telepresence feasibility matrix. |
| **ABAS → TF** | `FeatureMatrixRow` — formalize which features have full pipeline coverage. |

---

## 12. Prioritized Cross-Pollination Plan

### Phase 1: High-Impact Visual Upgrades (ABAS → TF)
1. **3D terrain elements** — Trees, mountains, sheep, wheat, cacti on hex tiles.
2. **Post-processing pipeline** — Bloom + DoF + Vignette + SMAA.
3. **Physics-based dice** — Replace static dice with Rapier rigid bodies.
4. **Resource flow animations** — 3D tokens flying hex → player.
5. **Custom wind shaders** — Animated vegetation on Forest/Fields/Pasture.
6. **HDR environment map** — `<Environment preset="apartment"/>`.

### Phase 2: UX Features (ABAS → TF)
7. **Tutorial system** — Step-by-step guidance for new players.
8. **In-game chat** — Text messaging between players.
9. **Rules reference** — Searchable rules panel.
10. **Save/Load** — localStorage game persistence.
11. **Replay system** — Action log playback.
12. **Dice history chart** — Visual dice distribution.
13. **Resource gain notifications** — Floating +resource badges.
14. **Trade offer ratings** — AI evaluates trade fairness.
15. **Keyboard camera controls** — WASD movement.

### Phase 3: AI Improvements (ABAS → TF)
16. **Multi-action AI loop** — AI takes all possible actions per turn.
17. **Pre-roll Knight logic** — Expert AI plays Knight before rolling.
18. **AI trade proposals** — AI proposes trades to human player.
19. **Trade evaluation** — `getTradeOfferRating` function.

### Phase 4: Architecture Improvements (TF → ABAS)
20. **Event-driven architecture** — Commands → Events → Reducers pipeline.
21. **Pure-function engine** — Extract game logic from store.
22. **Typed identifiers** — Replace raw strings with branded types.
23. **Projection layer** — Derive UI state from authoritative state.
24. **Component decomposition** — Split 85KB HUD into 10+ focused components.
25. **Monorepo structure** — pnpm workspaces + turborepo.

### Phase 5: Infrastructure (TF → ABAS)
26. **Real multiplayer** — Liveblocks or equivalent.
27. **WebRTC telepresence** — Actual peer connections.
28. **Room management** — Session tracking, spectator support.
29. **Routing** — Multi-page navigation.
30. **Radix UI** — Accessible UI primitives.

### Phase 6: Board Generation (ABAS → TF)
31. **Variable board sizes** — Small/Medium/Large radius.
32. **Constraint solver** — Backtracking terrain/token placement.
33. **Board randomization** — In-lobby board configuration.

### Phase 7: Immersion (ABAS → TF)
34. **3D spatial presence panels** — Holographic player cards in 3D space.
35. **Spatial audio** — PositionalAudio from player positions.
36. **VR/XR support** — Native WebXR with VRButton.
37. **3D resource models in HUD** — Mini Canvas renders per resource.

---

## Summary Table

| Category | TF Advantage | ABAS Advantage |
|----------|-------------|----------------|
| **Architecture** | ⭐⭐⭐⭐⭐ Event-driven DDD | ⭐⭐ Simple monolithic |
| **Type Safety** | ⭐⭐⭐⭐⭐ Formal types | ⭐⭐⭐ Good enums, some `any` |
| **3D Terrain** | ⭐⭐⭐ Painted textures | ⭐⭐⭐⭐⭐ Full 3D props |
| **Lighting** | ⭐⭐⭐⭐⭐ 7-light cinematic | ⭐⭐⭐ 4-light basic |
| **Post-Processing** | ⭐ None active | ⭐⭐⭐⭐⭐ Full pipeline |
| **Physics** | ⭐ None | ⭐⭐⭐⭐⭐ Rapier |
| **Shaders** | ⭐ None | ⭐⭐⭐⭐ Wind + water |
| **AI Quality** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Multi-action + trade |
| **UI Features** | ⭐⭐⭐ Core | ⭐⭐⭐⭐⭐ Massive HUD |
| **Multiplayer** | ⭐⭐⭐⭐⭐ Liveblocks + WebRTC | ⭐ Stub |
| **Projections** | ⭐⭐⭐⭐⭐ 5 projection types | ⭐ None |
| **Testing** | ⭐⭐⭐ Framework exists | ⭐⭐ Types only |
| **Documentation** | ⭐⭐⭐⭐⭐ Extensive | ⭐⭐⭐ Concise |
| **Board Generation** | ⭐⭐ Fixed | ⭐⭐⭐⭐⭐ Parameterized |
| **Resource Animations** | ⭐ None | ⭐⭐⭐⭐⭐ 3D flights |
| **Telepresence UX** | ⭐⭐⭐ 2D panels | ⭐⭐⭐⭐⭐ 3D spatial |
| **VR/XR** | ⭐⭐ Basic | ⭐⭐⭐⭐ XR store |
| **Token Quality** | ⭐⭐⭐⭐⭐ Premium coins | ⭐⭐ Basic cylinders |
| **Table Surface** | ⭐⭐⭐⭐⭐ Walnut + felt | ⭐⭐ Flat plane |

**The ideal product is TF's architecture + projections + multiplayer + docs combined with ABAS's 3D terrain + physics + post-processing + shaders + AI + HUD features + resource animations + spatial presence.**
