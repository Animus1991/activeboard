# PART 8 — IMPLEMENTATION PROGRAM PLAN

## 1. Program mission

Ο στόχος δεν είναι απλώς:
* να φτιαχτεί “ένα ψηφιακό Catan”
* ούτε “ένα ωραίο 3D board”

Ο στόχος είναι να παραδοθεί ένα **production-capable vertical slice** μιας **AAA tabletop gaming infrastructure platform**, με πρώτο flagship game το Catan-like module, και με architecture που να επιτρέπει αργότερα:
* replay
* spectators
* AI augmentation
* telepresence
* additional game modules

Η σωστή στρατηγική υλοποίησης είναι:
**build the irreversible foundations first, then build the visible premium layer on top, then harden the system, then extend.**

---

# 2. Program structure

Το πρόγραμμα πρέπει να χωριστεί σε **9 workstreams** που τρέχουν παράλληλα αλλά με αυστηρές εξαρτήσεις.

## Workstream A — Core Domain & Rules Engine
* state tree, commands, events, reducers, validators, rule services, derived recompute, turn/lifecycle engine

## Workstream B — Board Topology & Geometry Engine
* canonical hex generation, vertex/edge generation, adjacency, token/harbor anchors, overlap prevention, geometry invariants

## Workstream C — Multiplayer Authoritative Runtime
* command gateway, room runtime, authoritative sync, event persistence, reconnect, session orchestration, sequence/checksum flow

## Workstream D — Projection / UI Contract Layer
* selectors, UI/interaction/render projections, feature completeness matrix, command-to-UI mapping

## Workstream E — Hyperreal Tabletop Render Pipeline
* terrain/token/harbor/piece visual systems, lighting/camera profiles, zoom fidelity, scene rebuild/diff logic

## Workstream F — Unity Client & Scene Runtime
* packet handlers, state cache, projection consumers, scene binding, render sync engine, HUD/input wiring

## Workstream G — Replay / Spectator / Analytics Backbone
* replay engine, event timeline, spectator filtering, replay archives, read models, metrics & logs

## Workstream H — Telepresence / Remote Presence R&D
* spatial video portals, multi-camera room capture, presence composition, VR hooks

## Workstream I — QA / Automation / Non-Regression
* scenario tests, invariants, feature completeness gates, replay determinism tests, sync/desync tests, visual acceptance checks

---

# 3. Team roles

### 1. Principal Architect / Technical Lead
### 2. Gameplay Systems Engineer
### 3. Multiplayer / Backend Engineer
### 4. Unity Client Engineer
### 5. Technical Artist / Rendering Engineer
### 6. UI/UX Product Engineer / Designer
### 7. QA / Test Automation Engineer
### 8. Telepresence / Realtime Media Engineer (Optional)
### 9. Product / Technical Producer (Optional)
### 10. Board Game Design QA Specialist (Optional)

---

# 4. Implementation phases

## Phase 0 — Truth Lock
Στόχος: να κλειδώσουν οι αλήθειες που αν αποφασιστούν λάθος αργότερα, θα προκαλέσουν ξήλωμα.

## Phase 1 — Domain Core
Στόχος: να χτιστεί το πραγματικό engine core.

## Phase 2 — Board Geometry Core
Στόχος: να λυθεί για πάντα η spatial αλήθεια του Catan board.

## Phase 3 — Multiplayer Runtime
Στόχος: να λειτουργεί authoritative online παιχνίδι.

## Phase 4 — UI / Projection Completion
Στόχος: να σταματήσει το “λειτουργίες υπάρχουν αλλά δεν φαίνονται / ή φαίνονται αλλά δεν δουλεύουν”.

## Phase 5 — Hyperreal Render Vertical Slice
Στόχος: να αποκτήσει το board premium, tactile, believable tabletop παρουσία.

## Phase 6 — Replay / Spectator / Analytics
Στόχος: να αποκτήσει platform-grade instrumentation.

## Phase 7 — Production Hardening
Στόχος: να κλείσουν operational and correctness risks.

## Phase 8 — Telepresence / Premium Presence Layer
Στόχος: να ξεκινήσει ο differentiator layer χωρίς να μολύνει το core.

---

# 5. Dependency graph

* **Phase 0 blocks everything**
* **Phase 1 depends on Phase 0**
* **Phase 2 depends on Phase 0 and partially on Phase 1**
* **Phase 3 depends on Phase 1**
* **Phase 4 depends on Phase 1 and 3**
* **Phase 5 depends on Phase 2 and 4**
* **Phase 6 depends on Phase 3**
* **Phase 7 depends on όλα τα προηγούμενα**
* **Phase 8 depends on 3, 4, 5, 6**

---

# 6. Build order — τι prototype first vs τι harden first

## Prototype first
1. Headless full game simulation
2. Canonical board geometry generator
3. Dice → production → robber branching flow
4. Build legality projection
5. Render vertical slice of one complete board state
6. Event-sourced replay rebuild
7. Basic public spectator view

## Harden first
1. Event sequencing
2. Board topology invariants
3. Reducer determinism
4. Validation pipeline correctness
5. Reconnect / snapshot rebuild
6. Projection consistency

---

# 7. Technical milestones
1. **Milestone 1** — Domain Truth Locked
2. **Milestone 2** — Headless Playable Core
3. **Milestone 3** — Canonical Board & Interaction Space
4. **Milestone 4** — Online Authoritative Match
5. **Milestone 5** — UI/Projection Completeness
6. **Milestone 6** — Premium Visual Vertical Slice
7. **Milestone 7** — Replay / Spectator Backbone
8. **Milestone 8** — Production Hardening Gate

---

# 8. Risk register
* **Risk 1** — Domain/UI/render drift (Critical)
* **Risk 2** — Board geometry drift (Critical)
* **Risk 3** — Reducer non-determinism (Critical)
* **Risk 4** — Runtime desync (Critical)
* **Risk 5** — Hyperreal visual ambition overwhelms readability (High)
* **Risk 6** — Telepresence contaminates core roadmap (High)
* **Risk 7** — Team builds too much too early (High)
* **Risk 8** — Replay/spectator hidden-info leakage (Critical)

---

# 9. Non-regression gates
* **Gate A** — Rules regression gate
* **Gate B** — Geometry regression gate
* **Gate C** — Determinism gate
* **Gate D** — Feature completeness gate
* **Gate E** — Visual regression gate
* **Gate F** — Sync/reconnect gate

---

# 10. Execution doctrine

1. Lock truth.
2. Build deterministic core.
3. Lock canonical geometry.
4. Make multiplayer authoritative.
5. Bind UI and render to semantic state.
6. Push premium visuals only on top of stable semantics.
7. Add replay/spectator/analytics.
8. Add telepresence and advanced platform differentiators.
