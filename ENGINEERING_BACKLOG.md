# PART 9 — ENGINEERING EXECUTION BACKLOG

## 1. Delivery doctrine
1. **Rules first**
2. **Canonical board geometry second**
3. **Authoritative multiplayer third**
4. **Projection/UI/render binding fourth**
5. **Hyperreal polish only after semantic truth is stable**

---

# 2. Backlog structure

## Epic 1 — Domain Foundation
**Goal:** Να κλειδώσει η ενιαία domain truth του Catan engine.
* 1.1 State tree
* 1.2 Commands
* 1.3 Events
* 1.4 Reducer skeleton
* 1.5 Shared utilities/types
* 1.6 Domain invariants

## Epic 2 — Canonical Board Geometry
**Goal:** Να λυθεί οριστικά το πρόβλημα geometry/anchors/overlap.
* 2.1 Hex math
* 2.2 Vertex/edge generation
* 2.3 Adjacency generation
* 2.4 Harbor and token anchors
* 2.5 Geometry integrity checks

## Epic 3 — Rules Engine & Game Flow
**Goal:** Να μπορεί να τρέξει full match headless.
* 3.1 Setup phase
* 3.2 Dice and production
* 3.3 Robber flow
* 3.4 Build flow
* 3.5 Trade flow
* 3.6 Development cards
* 3.7 Special cards / scoring / victory

## Epic 4 — Authoritative Runtime & Multiplayer
**Goal:** Να γίνει πραγματικό online authoritative παιχνίδι.
* 4.1 Room runtime
* 4.2 Command dispatch
* 4.3 Event persistence
* 4.4 Snapshots
* 4.5 Reconnect
* 4.6 Checksums/desync safety

## Epic 5 — Selectors / Projections / UI Contracts
**Goal:** Να σταματήσει το drift μεταξύ state, UI και interactions.
* 5.1 Base selectors
* 5.2 Gameplay selectors
* 5.3 UI projections
* 5.4 Interaction projections
* 5.5 Feature completeness matrix

## Epic 6 — Unity Client / Scene Runtime / Render Sync
**Goal:** Να δέσει ο Unity client με το authoritative engine.
* 6.1 Client sync cache
* 6.2 Packet handlers
* 6.3 Scene runtime
* 6.4 Render binding builder
* 6.5 Render diff/apply
* 6.6 HUD integration

## Epic 7 — Hyperreal Tabletop Visual System
**Goal:** Να αποκτήσει το board premium, φυσική, αναγνώσιμη tabletop παρουσία.
* 7.1 Terrain materials
* 7.2 Number token system
* 7.3 Harbor system
* 7.4 Piece visual family
* 7.5 Lighting/camera
* 7.6 Zoom fidelity / visual QA

## Epic 8 — Replay / Spectator / Analytics
**Goal:** Να αποκτήσει platform-grade replayability and observability.
* 8.1 Replay engine
* 8.2 Replay indexing
* 8.3 Spectator filtering
* 8.4 Match summary projections
* 8.5 Analytics/logging

## Epic 9 — QA / Non-Regression / Invariants
**Goal:** Να γίνει production-safe.
* 9.1 Scenario DSL
* 9.2 Headless rules tests
* 9.3 Geometry tests
* 9.4 Sync/reconnect tests
* 9.5 Feature completeness gates
* 9.6 Visual regression gates

## Epic 10 — Telepresence / AI Extension Layer
**Goal:** Να μπουν οι differentiators χωρίς να σπάσει το core.
* 10.1 Presence abstraction
* 10.2 Video portal prototypes
* 10.3 AI interfaces
* 10.4 Coach/commentator/replay analyst hooks

---

# 3. Sprint order (Wave Sequence)

## Sprint Wave 1 — Truth + Domain
* Epic 1
* Epic 2 (μέχρι adjacency and geometry invariants)
* Epic 9 (scenario DSL foundation)

## Sprint Wave 2 — Operational Headless Core
* υπόλοιπο Epic 2
* Epic 3
* ενίσχυση Epic 9

## Sprint Wave 3 — Authoritative Runtime
* Epic 4
* μέρος Epic 8 (event store/read model foundations)
* μέρος Epic 9 (reconnect/rebuild tests)

## Sprint Wave 4 — Projection / UI / Client Wiring
* Epic 5
* Epic 6

## Sprint Wave 5 — Hyperreal Visual Vertical Slice
* Epic 7
* visual QA μέρος του Epic 9

## Sprint Wave 6 — Replay / Spectator / Analytics
* υπόλοιπο Epic 8

## Sprint Wave 7 — Hardening
* υπόλοιπο Epic 9

## Sprint Wave 8 — Differentiators
* Epic 10
