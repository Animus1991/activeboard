# TableForge - Full-Stack Architecture Audit

## Executive Summary

This document provides a comprehensive audit of the TableForge VR wargaming platform, mapping all frontend screens to backend endpoints, identifying connectivity issues, and documenting the current state of the application.

---

## 1. Project Overview

| Component | Technology | Port | Status |
|-----------|------------|------|--------|
| Frontend | React + Vite + Three.js | 5173 | ✅ Running |
| Backend | Hono + Drizzle ORM | 3001 | ✅ Running |
| Database | PostgreSQL (Neon) | - | ✅ Connected |
| WebSocket | ws | 3001 | ✅ Available |

---

## 2. Frontend Routes Inventory

### Public Routes (No Auth Required)

| Route | Page Component | Purpose | Status |
|-------|----------------|---------|--------|
| `/` | `LandingPage` | Marketing landing page | ✅ Working |
| `/waitlist` | `WaitlistPage` | Waitlist signup form | ✅ Working |
| `/login` | `LoginPage` | User authentication | ✅ Working |
| `/register` | `RegisterPage` | User registration | ✅ Working |

### Protected Routes (Auth Required)

| Route | Page Component | Purpose | Status |
|-------|----------------|---------|--------|
| `/dashboard` | `DashboardPage` | Main user dashboard | ✅ Working |
| `/player` | `PlayerDashboardPage` | B2C player stats/history | ✅ Working |
| `/venue` | `VenueDashboardPage` | B2B venue management | ✅ Working |
| `/army-builder` | `ArmyBuilderPage` | Army list builder | ✅ Working |
| `/game/:roomCode` | `GameRoomPage` | 3D game table | ✅ Working |

### Game-Specific Routes

| Route | Page Component | Purpose | Status |
|-------|----------------|---------|--------|
| `/games/monopoly` | `MonopolyGamePage` | Monopoly game | ✅ Working |
| `/games/catan` | `CatanGamePage` | Catan game | ✅ Working |
| `/games/codenames` | `CodenamesGamePage` | Codenames game | ✅ Working |
| `/games/risk` | `RiskGamePage` | Risk game | ✅ Working |

---

## 3. Backend API Endpoints Inventory

### Authentication (`/api/auth`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/register` | User registration | ❌ |
| POST | `/api/auth/login` | User login | ❌ |
| POST | `/api/auth/logout` | User logout | ✅ |
| POST | `/api/auth/refresh` | Refresh tokens | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |

### Waitlist (`/api/waitlist`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/waitlist` | Join waitlist | ❌ |
| GET | `/api/waitlist/stats` | Get waitlist stats | ❌ |
| GET | `/api/waitlist/check/:email` | Check waitlist status | ❌ |

### Games (`/api/games`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/games/systems` | List game systems | ❌ |
| GET | `/api/games/systems/:slug` | Get game system details | ❌ |
| GET | `/api/games/factions/:id` | Get faction with units | ❌ |
| GET | `/api/games/units/:id` | Get unit type details | ❌ |

### Rooms (`/api/rooms`)

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/rooms` | List user's rooms | ✅ |
| POST | `/api/rooms` | Create new room | ✅ |
| GET | `/api/rooms/code/:code` | Get room by code | ✅ |
| GET | `/api/rooms/:id` | Get room details | ✅ |
| POST | `/api/rooms/:id/join` | Join a room | ✅ |
| POST | `/api/rooms/:id/leave` | Leave a room | ✅ |
| POST | `/api/rooms/:id/ready` | Toggle ready status | ✅ |
| POST | `/api/rooms/:id/start` | Start the game | ✅ |

### Health Check

| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/` | API info | ❌ |
| GET | `/health` | Health check | ❌ |

---

## 4. Screen-to-Endpoint Mapping

### LandingPage (`/`)
- **API Calls**: None
- **Navigation**: `/waitlist`, `/login`
- **Status**: ✅ Complete

### WaitlistPage (`/waitlist`)
- **API Calls**: 
  - `POST /api/waitlist` - Join waitlist
  - `GET /api/waitlist/stats` - Get stats
- **Navigation**: `/`, `/login`
- **Status**: ✅ Complete

### LoginPage (`/login`)
- **API Calls**: 
  - `POST /api/auth/login` - Authenticate user
- **Navigation**: `/register`, `/dashboard`
- **Status**: ✅ Complete

### RegisterPage (`/register`)
- **API Calls**: 
  - `POST /api/auth/register` - Create account
- **Navigation**: `/login`, `/dashboard`
- **Status**: ✅ Complete

### DashboardPage (`/dashboard`)
- **API Calls**: 
  - `GET /api/auth/me` - Get user info (via AuthContext)
  - `GET /api/games/systems` - Load game systems for room creation
  - `POST /api/rooms` - Create new room
- **Navigation**: `/game/:code`, `/army-builder`, `/player`, `/`
- **Status**: ✅ Complete (Fixed in this session)

### PlayerDashboardPage (`/player`)
- **API Calls**: 
  - `GET /api/auth/me` - Get user info (via AuthContext)
- **Navigation**: `/`, `/dashboard`
- **Mock Data**: Game history, friends, matchmaking queues
- **Status**: ⚠️ Partial (uses mock data, backend endpoints needed)

### GameRoomPage (`/game/:roomCode`)
- **API Calls**: 
  - `GET /api/rooms/code/:code` - Get room details
- **WebSocket**: `ws://localhost:3001/ws/game` - Real-time sync
- **Navigation**: `/dashboard`
- **Status**: ⚠️ Partial (3D table works, needs real-time sync)

### ArmyBuilderPage (`/army-builder`)
- **API Calls**: 
  - `GET /api/games/systems` - List game systems
  - `GET /api/games/factions/:id` - Get faction units
- **Navigation**: `/dashboard`
- **Status**: ✅ Complete

### VenueDashboardPage (`/venue`)
- **API Calls**: None (mock data)
- **Navigation**: `/dashboard`
- **Status**: ⚠️ Partial (B2B features need backend)

---

## 5. Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Login     │────▶│  /api/auth  │────▶│  JWT Token  │
│   Page      │     │   /login    │     │  Returned   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ AuthContext │◀────│ localStorage│◀────│ Store Token │
│   Updated   │     │   token     │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Protected  │────▶│ /api/auth/me│────▶│ User Data   │
│   Routes    │     │  (on load)  │     │  Fetched    │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Token Management
- **Access Token**: Stored in `localStorage.token`, expires in 15m
- **Refresh Token**: Stored in `localStorage.refreshToken`, expires in 7d
- **Mock Mode**: Falls back to mock user when backend unavailable

---

## 6. Issues Identified & Fixed

### Issue 1: 401 Unauthorized on `/api/auth/me`
- **Cause**: User not logged in, no token in localStorage
- **Solution**: This is expected behavior - AuthContext handles gracefully with mock fallback
- **Status**: ✅ Working as designed

### Issue 2: DashboardPage not using real API
- **Cause**: Room creation used random code instead of API
- **Solution**: Updated to call `POST /api/rooms` with game system selection
- **Status**: ✅ Fixed

### Issue 3: Missing navigation links
- **Cause**: Pages lacked proper navigation between each other
- **Solution**: Added Link components to PlayerDashboardPage header
- **Status**: ✅ Fixed

---

## 7. Button Functionality Audit

### LandingPage
| Button | Action | Status |
|--------|--------|--------|
| "Join Waitlist" | Navigate to `/waitlist` | ✅ |
| "Sign In" | Navigate to `/login` | ✅ |
| "Watch Demo" | No action (placeholder) | ⚠️ |

### DashboardPage
| Button | Action | Status |
|--------|--------|--------|
| "Create Room" | Opens dialog, calls API | ✅ Fixed |
| "Join Room" | Opens dialog, navigates to room | ✅ |
| "Army Builder" | Navigate to `/army-builder` | ✅ |
| "Recent Games" | Navigate to `/player` | ✅ |
| "Logout" | Calls logout, navigates to `/` | ✅ |

### PlayerDashboardPage
| Button | Action | Status |
|--------|--------|--------|
| "Join Queue" | Mock action (needs backend) | ⚠️ |
| "Add Friend" | Mock action (needs backend) | ⚠️ |
| "Play" (friend) | Mock action (needs backend) | ⚠️ |
| "Message" (friend) | Mock action (needs backend) | ⚠️ |

### GameRoomPage
| Button | Action | Status |
|--------|--------|--------|
| Dice Roller (1D6-6D6) | Rolls dice, shows results | ✅ |
| "End Turn" | Advances turn counter | ✅ |
| Mute/Unmute | Toggles audio state | ✅ |
| Chat | Opens chat panel | ✅ |
| Fullscreen | Toggles fullscreen | ✅ |
| Settings | No action (placeholder) | ⚠️ |

---

## 8. Vite Proxy Configuration

```typescript
// vite.config.ts
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
  },
}
```

**Status**: ✅ Correctly configured

---

## 9. Architecture Decisions

### VR Representation Strategy
**Recommendation**: Clarity-first VR
- Game state readability is prioritized
- 3D pieces with minimal animation
- Clear turn indicators and state visualization
- Spectacle/cinematic effects deferred to Phase 2+

### Camera Presence (Local ↔ Remote)
**Recommendation**: Optional enhancement, not MVP
- MVP: Avatar + spatial voice for presence
- Phase 2: Video panel option
- Phase 3+: Multi-camera/volumetric (if demand exists)

### Local Player Interaction
**Current**: Touch table mode detection
- Large screen + touch = table mode
- Otherwise = remote view mode
- Future: Dedicated touch table hardware support

### Source of Truth
**Architecture**: Server-authoritative
- All game state changes go through backend
- WebSocket broadcasts to all clients
- Conflict resolution on server side

---

## 10. Missing Features (Backlog)

### High Priority
- [ ] Real-time game state sync via WebSocket
- [ ] Friends system backend endpoints
- [ ] Matchmaking queue backend
- [ ] Game history persistence

### Medium Priority
- [ ] Venue management backend (B2B)
- [ ] Army list persistence
- [ ] Chat message persistence
- [ ] Notification system

### Low Priority
- [ ] Video call integration
- [ ] Spectator mode
- [ ] Tournament system
- [ ] Leaderboards

---

## 11. How to Test

### 1. Start Backend
```bash
cd apps/api
pnpm dev
```
Expected: Server running at http://localhost:3001

### 2. Start Frontend
```bash
cd apps/web
pnpm dev
```
Expected: App running at http://localhost:5173

### 3. Test Auth Flow
1. Go to http://localhost:5173/register
2. Create account
3. Should redirect to /dashboard
4. Verify user info displays correctly

### 4. Test Room Creation
1. On /dashboard, click "Create Room"
2. Enter room name, select game system
3. Click "Create Room"
4. Should navigate to /game/:code

---

## 12. TypeScript Status

```
Frontend: npx tsc --noEmit → Exit 0 ✅
Backend: npx tsc --noEmit → Exit 0 ✅
```

---

## 13. Conclusion

The TableForge platform has a solid foundation with:
- ✅ Complete authentication system
- ✅ Working frontend routing
- ✅ Backend API structure
- ✅ 3D game table rendering
- ✅ Vite proxy correctly configured

Areas needing work:
- ⚠️ Real-time multiplayer sync
- ⚠️ Social features (friends, matchmaking)
- ⚠️ B2B venue features
- ⚠️ Game state persistence

The 401 error seen in console is **expected behavior** when no user is logged in - the AuthContext handles this gracefully with mock fallback mode enabled.
