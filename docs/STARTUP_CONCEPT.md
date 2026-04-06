# TableForge — Startup Concept Document

## One-Liner
**"Hybrid digital tabletop infrastructure for board game venues, with remote VR/PC participation"**

---

## The Insight

The problem is NOT "play board games online" — that's solved by BGA/TTS.

The problem IS: **"My game group has someone who can't be here physically, but we still want to play TOGETHER at the venue/home."**

This is a **hybrid presence problem**, not a game-access problem.

---

## The Wedge

### What We're NOT Building
- ❌ "Better Tabletop Simulator"
- ❌ "VR Board Game Arena"
- ❌ "All games for all devices"

### What We ARE Building
- ✅ **The digital table for board game venues**
- ✅ That allows **remote players to join** the same session
- ✅ With **VR as optional premium layer** for remote presence

---

## Target Market (Phase 1)

| Segment | Est. Size | Pain Level | WTP |
|---------|-----------|------------|-----|
| Board game cafés (EU/US) | ~5,000 | High — can't serve remote customers | €50-200/month |
| Wargaming clubs | ~2,000 | Very High — members relocate | €30-100/month |
| Board game stores with play space | ~10,000 | Medium | €30-100/month |

### Beachhead: Miniature Wargaming Venues
- **Highest pain**: Finding opponents for niche games is nearly impossible
- **Highest VR value**: 3D miniatures/terrain are the killer demo
- **Highest WTP**: Already spend €100+/month on hobby
- **Weakest competition**: No good solution exists

---

## Product Architecture

### The Hybrid Model

```
┌─────────────────────────────────────────────────────────────┐
│                        VENUE                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           TOUCH TABLE (55"+ display)                │   │
│  │                                                     │   │
│  │   Player A ──┐                                      │   │
│  │   Player B ──┼── Physical presence                  │   │
│  │   Player C ──┘   Touch interaction                  │   │
│  │                  See each other IRL                 │   │
│  │                  Natural social dynamics            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket sync
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │ Remote  │          │ Remote  │          │ Remote  │
   │ PC      │          │ VR      │          │ Mobile  │
   │ Player  │          │ Player  │          │ Specta- │
   │         │          │         │          │ tor     │
   └─────────┘          └─────────┘          └─────────┘
```

### Why This Works

1. **No CV/sensors needed** — The board IS digital (touch table)
2. **State sync is trivial** — Single source of truth
3. **Social dynamics preserved** — Local players see each other
4. **VR only where it adds value** — Remote presence, not local isolation

---

## Tech Stack

### Core Infrastructure (Already Built)
- **Backend**: Hono + Drizzle ORM + Neon PostgreSQL
- **Auth**: JWT-based
- **API**: RESTful, type-safe

### Real-Time Layer (To Build)
- **State Sync**: Liveblocks or PartyKit (CRDT-based)
- **Voice**: LiveKit (spatial audio capable)
- **Presence**: Built into Liveblocks

### Clients (To Build)
- **Touch Table**: React + React Three Fiber (web app)
- **PC Remote**: Same codebase, different layout
- **VR Remote**: WebXR via React Three Fiber (same codebase)
- **Mobile Spectator**: Simplified React view

### 3D Pipeline
- **Format**: GLTF/GLB
- **Rendering**: Three.js via React Three Fiber
- **Physics**: Rapier (WASM)

---

## MVP Feature Set

### Included
- [ ] Touch table client (web-based, 55"+ optimized)
- [ ] Remote PC client (same codebase)
- [ ] Real-time game state sync
- [ ] One game system: One Page Rules - Grimdark Future
- [ ] 3D board with terrain
- [ ] Unit placement and movement
- [ ] Dice rolling
- [ ] Measurement tools
- [ ] Line-of-sight checker
- [ ] Voice chat (non-spatial for MVP)
- [ ] Private game rooms
- [ ] Venue account system

### Excluded from MVP
- [ ] VR client (Phase 2)
- [ ] Multiple game systems (Phase 2)
- [ ] Spatial voice (Phase 2)
- [ ] Tournament mode (Phase 3)
- [ ] Publisher portal (Phase 3)
- [ ] Marketplace (Phase 4)

---

## Business Model

### Phase 1: B2B SaaS
| Tier | Price | Features |
|------|-------|----------|
| Starter | €49/month | 1 table, 5 concurrent remote players |
| Pro | €99/month | 3 tables, 15 concurrent, analytics |
| Enterprise | €199/month | Unlimited, white-label, API access |

### Phase 2: B2B2C
- Remote players can subscribe individually (€9.99/month)
- Revenue share with venues

### Phase 3: Marketplace
- Publishers list official games (rev share)
- Creators sell custom content

---

## Competitive Positioning

| Competitor | What They Do | Our Differentiation |
|------------|--------------|---------------------|
| Board Game Arena | Browser board games | We're venue-centric, hybrid |
| Tabletop Simulator | PC sandbox | We're touch-first, polished UX |
| Demeo | VR dungeon crawler | We're platform, not single game |
| Tilt Five | AR glasses | We're software, no hardware lock-in |

### Our Moat (Over Time)
1. **Venue network** — Partnerships with cafés/stores
2. **Hybrid UX** — Purpose-built for touch + remote
3. **Publisher relationships** — Official content deals
4. **Community** — Player accounts, history, rankings

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Venues don't adopt | High | Start with wargaming clubs (higher pain) |
| Touch tables too expensive | Medium | Support any large display + mouse/touch |
| Content licensing blocked | High | Start with open/indie games (OPR) |
| WebXR too limited for VR | Medium | Can pivot to native Quest app later |
| BGA/TTS add hybrid features | Medium | Move fast, lock in venue partnerships |

---

## Kill Criteria

| Signal | Threshold | Action |
|--------|-----------|--------|
| Venue signups after 6 months | < 20 | Pivot or kill |
| D30 retention | < 10% | Diagnose UX issues |
| Remote player usage | < 30% of sessions | Hybrid not valued |
| Average session length | < 20 min | Core experience broken |
| Venue churn | > 15%/month | Value not delivered |

---

## Phase Roadmap

### Phase 0: Validation (Current → 8 weeks)
- [ ] Interview 30+ venue owners
- [ ] Build clickable prototype
- [ ] Get 10 LOIs (Letters of Intent)
- [ ] Technical spike: touch + remote sync

### Phase 1: MVP (8 weeks)
- [ ] Touch table client
- [ ] PC remote client
- [ ] One game (OPR Grimdark Future)
- [ ] Real-time sync
- [ ] Voice chat
- [ ] Venue dashboard

### Phase 2: VR + Expansion (12 weeks)
- [ ] WebXR VR client
- [ ] 2-3 more game systems
- [ ] Spatial voice
- [ ] Player accounts + history

### Phase 3: Platform (6 months)
- [ ] Publisher portal
- [ ] Tournament system
- [ ] Analytics dashboard
- [ ] API for integrations

---

## Next Steps (Immediate)

1. **Add Liveblocks** for real-time sync
2. **Create shared 3D scene** with React Three Fiber
3. **Build game state engine** for OPR rules
4. **Implement touch controls** for table client
5. **Add WebSocket voice** via LiveKit
