# TableForge

**VR-First Remote Wargaming Platform**

Play miniature wargames with friends anywhere in the world. No physical table required. No painting mandatory. Just pure tactical gameplay in immersive VR.

## 🎯 Vision

TableForge is a VR-first platform for playing miniature wargames remotely. Starting with One Page Rules (Grimdark Future), we're building the ultimate virtual tabletop experience for wargamers.

### Key Features (Planned)

- **VR-First Experience** - Designed for Quest 3 and PC VR headsets
- **Remote Multiplayer** - Play with friends across the globe in real-time
- **One Page Rules Support** - Starting with Grimdark Future
- **Army Builder** - Build and save army lists with automatic point calculations
- **Hybrid Play** - Mix VR, PC, and shared-screen players in the same game
- **Dice Physics** - Satisfying dice rolling with realistic physics

## 🛠 Tech Stack

### Backend (`apps/api`)
- **Hono** - Fast, lightweight web framework
- **Drizzle ORM** - Type-safe database toolkit
- **PostgreSQL** - Production-ready database
- **JWT** - Secure authentication with refresh tokens
- **Zod** - Runtime validation

### Frontend (`apps/web`)
- **Vite** - Fast build tool
- **React 18** - UI library
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first styling
- **shadcn/ui** - High-quality UI components
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Framer Motion** - Animations

### Monorepo
- **pnpm** - Fast, disk-efficient package manager
- **Turborepo** - High-performance build system

## 📁 Project Structure

```
tableforge/
├── apps/
│   ├── api/                 # Backend API (Hono + Drizzle)
│   │   ├── src/
│   │   │   ├── db/          # Database schema, migrations, seeds
│   │   │   ├── middleware/  # Auth middleware
│   │   │   ├── routes/      # API routes
│   │   │   └── index.ts     # Server entry point
│   │   └── drizzle/         # Generated migrations
│   └── web/                 # Frontend (Vite + React)
│       └── src/
│           ├── components/  # UI components
│           ├── contexts/    # React contexts
│           ├── lib/         # Utilities and API client
│           └── pages/       # Page components
├── packages/                # Shared packages (future)
├── package.json             # Root package.json
├── pnpm-workspace.yaml      # pnpm workspaces config
└── turbo.json               # Turborepo config
```

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (local or cloud like Neon/Supabase)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tableforge.git
cd tableforge
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env

# Edit apps/api/.env with your database URL and JWT secret
```

4. Set up the database:
```bash
# Generate migrations
pnpm --filter @tableforge/api db:generate

# Run migrations
pnpm --filter @tableforge/api db:migrate

# Seed initial data (optional)
pnpm --filter @tableforge/api db:seed
```

5. Start development servers:
```bash
pnpm dev
```

This will start:
- API server at http://localhost:3001
- Web app at http://localhost:5173

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/me` - Get current user

### Waitlist
- `POST /api/waitlist` - Join waitlist
- `GET /api/waitlist/stats` - Get waitlist statistics
- `GET /api/waitlist/check/:email` - Check waitlist status

### Game Systems
- `GET /api/games/systems` - List all game systems
- `GET /api/games/systems/:slug` - Get game system with factions
- `GET /api/games/factions/:id` - Get faction with units
- `GET /api/games/units/:id` - Get unit details

### Game Rooms
- `GET /api/rooms` - List user's rooms
- `POST /api/rooms` - Create new room
- `GET /api/rooms/:id` - Get room details
- `GET /api/rooms/code/:code` - Get room by code
- `POST /api/rooms/:id/join` - Join room
- `POST /api/rooms/:id/leave` - Leave room
- `POST /api/rooms/:id/ready` - Toggle ready status
- `POST /api/rooms/:id/start` - Start game (host only)

## 🎮 Supported Game Systems

### Phase 1 (MVP)
- **One Page Rules: Grimdark Future** - Sci-fi skirmish wargame

### Future Phases
- One Page Rules: Age of Fantasy
- Other indie/open game systems

## 🗺 Roadmap

### Phase 0: Validation (Current)
- [x] Landing page with value proposition
- [x] Waitlist with survey data collection
- [x] Basic authentication system
- [ ] User interviews and validation

### Phase 1: Foundation
- [ ] VR client for Quest 3 (Unity/Godot)
- [ ] Real-time multiplayer with WebSockets
- [ ] Basic game table with unit placement
- [ ] Dice rolling with physics

### Phase 2: Core Gameplay
- [ ] Army builder with OPR data
- [ ] Turn tracking and game state
- [ ] Measurement tools
- [ ] Line of sight checking

### Phase 3: Polish
- [ ] PC client
- [ ] Shared-screen hybrid mode
- [ ] Social features (friends, matchmaking)
- [ ] Replay system

## 🤝 Contributing

TableForge is currently in early development. If you're interested in contributing, please reach out!

## 📄 License

MIT License - see LICENSE file for details.

---

**TableForge** - Your Wargaming Table, Anywhere in VR
