# PART 11 — PRIORITY / RISK / OWNER MATRIX

Αυτό το έγγραφο αποτελεί το τελικό **Execution Blueprint**. Δεν λέει απλώς "τι" θα φτιαχτεί, αλλά υποδεικνύει το "πότε", "από ποιον", και "πόσο επικίνδυνο είναι αν καθυστερήσει ή γίνει λάθος".

## 1. Matrix Definition Framework

* **Priority:** 
  * **P0 (Critical Blocker):** Σταματάει όλη την ομάδα. Πρέπει να γίνει χθες.
  * **P1 (High):** Απαραίτητο για το τρέχον milestone.
  * **P2 (Medium):** Απαραίτητο για το release, αλλά δεν μπλοκάρει άμεσα άλλους.
  * **P3 (Low):** Πολύτιμο, αλλά deferrable αν πιεστεί ο χρόνος.
* **Architectural Criticality:** 
  * **HIGH:** Type-1 Decision (Irreversible). Αν γίνει λάθος, θέλει refactor μηνών.
  * **MEDIUM:** Type-2 Decision. Αν γίνει λάθος, διορθώνεται με τοπικό refactor.
  * **LOW:** Leaf node. Αλλάζει εύκολα (π.χ. ένα UI χρώμα).
* **Blocker Risk (BR):** Πόσα άλλα tickets εξαρτώνται από αυτό;
* **Owner Role:** Ο τελικός υπόλογος (Accountable), ανεξάρτητα από το ποιος γράφει τον κώδικα.

---

## 2. The Exhaustive Execution Matrix

### WAVE 1: FOUNDATIONS (SPRINT 1-2)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 1** | **DOMAIN FOUNDATION** | | | | | |
| 1.1.1 | Core Primitive & ID Types (`MatchId`, `HexId` κλπ) | Principal Architect | P0 | HIGH | HIGH | S1 |
| 1.1.2 | Root `CatanMatchState` Interface & Slices | Principal Architect | P0 | HIGH | HIGH | S1 |
| 1.1.3 | Board State Model (`HexState`, `VertexState` κλπ) | Gameplay Engineer | P0 | HIGH | HIGH | S1 |
| 1.2.1 | Define all Command Envelopes & Types | Principal Architect | P0 | HIGH | HIGH | S1 |
| 1.3.1 | Define all Domain Event Envelopes & Types | Principal Architect | P0 | HIGH | HIGH | S1 |
| 1.4.1 | Reducer Registry & Dispatch Skeleton | Backend Engineer | P0 | HIGH | HIGH | S1-S2 |
| 1.6.1 | Domain Invariants (piece limits, resource limits) | QA/Automation Eng. | P1 | MED | MED | S2 |
| **EPIC 2** | **CANONICAL BOARD GEOMETRY** | | | | | |
| 2.1.1 | Axial Hex Coordinate Math & World Transforms | Gameplay Engineer | P0 | HIGH | HIGH | S1 |
| 2.2.1 | Generate Canonical Shared Vertices (No dupes) | Gameplay Engineer | P0 | HIGH | HIGH | S1 |
| 2.2.2 | Generate Canonical Shared Edges (No dupes) | Gameplay Engineer | P0 | HIGH | HIGH | S1 |
| 2.3.1 | Adjacency Maps (`hexToVertices`, `edgeToEdges` κλπ) | Gameplay Engineer | P0 | HIGH | HIGH | S2 |
| 2.4.1 | Number Token & Harbor Anchors | Tech Artist | P1 | MED | MED | S2 |
| 2.5.1 | Geometry Integrity Test Suite (Overlap checks) | QA/Automation Eng. | P1 | MED | HIGH | S2 |
| **EPIC 9a**| **QA FOUNDATION** | | | | | |
| 9.1.1 | Implement Scenario Test DSL (Headless Runner) | QA/Automation Eng. | P0 | HIGH | HIGH | S2 |

---

### WAVE 2: OPERATIONAL HEADLESS CORE (SPRINT 3-4)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 3** | **RULES ENGINE & GAME FLOW** | | | | | |
| 3.1.1 | Setup Phase Turn Order & Snake Draft Logic | Gameplay Engineer | P1 | HIGH | HIGH | S3 |
| 3.1.2 | Initial Settlement/Road Placement Rules | Gameplay Engineer | P1 | HIGH | HIGH | S3 |
| 3.2.1 | Roll Validation & Dice Result Event | Gameplay Engineer | P1 | HIGH | HIGH | S3 |
| 3.2.3 | Production Rule Service & Bank Depletion | Gameplay Engineer | P1 | HIGH | HIGH | S3 |
| 3.3.1 | Seven Rolled / Discard Flow / Robber Move | Gameplay Engineer | P1 | HIGH | MED | S3 |
| 3.4.1 | Build Logic (Road, Settlement, City upgrades) | Gameplay Engineer | P1 | HIGH | HIGH | S4 |
| 3.5.1 | Trade Flow (Domestic & Maritime) | Backend Engineer | P1 | MED | MED | S4 |
| 3.6.1 | Dev Card Purchase & Execution Flow (Knight κλπ) | Gameplay Engineer | P2 | MED | LOW | S4 |
| 3.7.1 | Longest Road / Largest Army Algorithmic Graph | Gameplay Engineer | P1 | HIGH | LOW | S4 |
| 3.7.3 | VP Recompute & Win Detection | Gameplay Engineer | P1 | MED | MED | S4 |
| **EPIC 9b**| **QA RULES** | | | | | |
| 9.1.3 | Headless Full Turn Flow Scenario Tests | QA/Automation Eng. | P1 | MED | MED | S4 |

---

### WAVE 3: AUTHORITATIVE RUNTIME (SPRINT 5-6)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 4** | **AUTHORITATIVE RUNTIME & MULTIPLAYER** | | | | | |
| 4.1.1 | `MatchRoomRuntime` In-memory instance | Backend Engineer | P0 | HIGH | HIGH | S5 |
| 4.2.1 | Command Gateway & Validation Dispatcher | Backend Engineer | P0 | HIGH | HIGH | S5 |
| 4.3.1 | PostgreSQL Event Store Append | Backend Engineer | P0 | HIGH | HIGH | S5 |
| 4.4.1 | Snapshot Persistence & Periodic Saving | Backend Engineer | P1 | HIGH | MED | S6 |
| 4.4.3 | Deterministic Rebuild (Snapshot + Event apply) | Backend Engineer | P1 | HIGH | HIGH | S6 |
| 4.5.1 | Reconnect Protocol & State Catch-up | Backend Engineer | P1 | HIGH | MED | S6 |
| 4.6.1 | Deterministic Checksum Diagnostics (Anti-desync) | Backend Engineer | P2 | MED | LOW | S6 |

---

### WAVE 4: PROJECTIONS & CLIENT WIRING (SPRINT 7-8)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 5** | **SELECTORS & UI CONTRACTS** | | | | | |
| 5.1.1 | Base Selectors & Memoized Legality Selectors | UI/UX Engineer | P1 | MED | HIGH | S7 |
| 5.2.1 | UI Projections (Players, Actions, Resources, Dice) | UI/UX Engineer | P1 | MED | HIGH | S7 |
| 5.3.1 | Interaction Projections (Build Previews, Robber target) | UI/UX Engineer | P1 | MED | MED | S7 |
| **EPIC 6** | **CLIENT / SCENE RUNTIME (UNITY/WEB)** | | | | | |
| 6.1.1 | Client State Cache & Hydration Flow | Unity Client Eng. | P0 | HIGH | HIGH | S7 |
| 6.2.1 | Packet Handlers (Full Snapshot, Delta, Event Batch) | Unity Client Eng. | P0 | HIGH | HIGH | S7 |
| 6.3.1 | Scene Runtime Registries (Hex, Vertex, Edge matching) | Unity Client Eng. | P1 | HIGH | HIGH | S8 |
| 6.5.1 | Render Diff Engine (Apply state to 3D Scene safely) | Unity Client Eng. | P1 | HIGH | HIGH | S8 |
| 6.6.1 | Wire HUD Panels & Command Dispatch to UI | UI/UX Engineer | P1 | MED | LOW | S8 |

---

### WAVE 5: HYPERREAL VISUAL VERTICAL SLICE (SPRINT 9)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 7** | **HYPERREAL TABLETOP VISUAL SYSTEM** | | | | | |
| 7.1.1 | Terrain Material Bible (PBR Textures implementation) | Tech Artist | P2 | LOW | LOW | S9 |
| 7.2.1 | Number Token System (Readability, 6/8 differentiation)| Tech Artist | P2 | LOW | LOW | S9 |
| 7.3.1 | Harbor System Integration | Tech Artist | P2 | LOW | LOW | S9 |
| 7.4.1 | Piece Visuals (Wood/Stone 3D meshes) | Tech Artist | P2 | LOW | LOW | S9 |
| 7.5.1 | Lighting Profiles & Tactical/Orbit Cameras | Tech Artist | P2 | MED | LOW | S9 |

---

### WAVE 6: REPLAY, SPECTATOR & PLATFORM BACKBONE (SPRINT 10-11)

| ID | Ticket Name | Owner Role | Priority | Arch. Crit. | Blocker Risk | Sprint |
|:---|:---|:---|:---|:---|:---|:---|
| **EPIC 8** | **REPLAY / SPECTATOR / ANALYTICS** | | | | | |
| 8.1.1 | Replay Session Loader & Step Forward/Back | Backend Engineer | P2 | MED | LOW | S10 |
| 8.2.1 | Replay Key Moment Indexing (Turn boundaries) | Backend Engineer | P2 | MED | LOW | S10 |
| 8.3.1 | Public Spectator Filter (Hide private state/cards) | Principal Architect| P1 | HIGH | HIGH | S10 |
| 8.4.1 | Match Summary Read Model (Lobby projection) | Backend Engineer | P2 | MED | LOW | S11 |
| 8.5.1 | Structured Command Logs & Match Metrics | Backend Engineer | P2 | LOW | LOW | S11 |

---

## 3. How to use this Matrix daily

1. **Daily Standup:** Φιλτράρισμα βάσει **Owner Role** και **Blocker Risk = HIGH**. Κανείς δεν δουλεύει σε ένα `P2 / Blocker Risk LOW` ticket αν υπάρχει ανοιχτό `P0 / Blocker Risk HIGH` στο ίδιο Sprint.
2. **Architecture Reviews:** Οποιοδήποτε ticket έχει **Architectural Criticality = HIGH** ΑΠΑΙΤΕΙ Design Doc / RFC (Request For Comments) review από τον Principal Architect πριν γραφτεί γραμμή κώδικα. Δεν κάνουμε YOLO development σε Type-1 decisions.
3. **Sprint Planning:** Τα Sprints κόβονται ΚΑΘΕΤΑ. Δεν μπορείς να πάρεις το Ticket 6.5.1 (Render Diff) αν δεν έχει κλείσει το 1.4.1 (Reducers). H Matrix εξασφαλίζει Dependency-Driven Planning.
