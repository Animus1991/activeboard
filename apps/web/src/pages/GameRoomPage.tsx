import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Map, Landmark, Globe, MessageSquare, ArrowLeft, Gamepad2, ArrowRight
} from 'lucide-react';
// Button kept for future room management features

const GAME_OPTIONS = [
  {
    id: 'catan',
    name: 'Settlers of Catan',
    description: 'Trade resources, build settlements, race to 10 VP',
    icon: Map,
    route: '/games/catan',
    color: 'from-orange-500 to-red-600',
    players: '3-4',
  },
  {
    id: 'monopoly',
    name: 'Monopoly',
    description: 'Buy properties, build houses & hotels, bankrupt opponents',
    icon: Landmark,
    route: '/games/monopoly',
    color: 'from-red-500 to-red-700',
    players: '2-4',
  },
  {
    id: 'risk',
    name: 'Risk',
    description: 'Deploy armies, attack territories, conquer the world',
    icon: Globe,
    route: '/games/risk',
    color: 'from-red-600 to-orange-600',
    players: '2-6',
  },
  {
    id: 'codenames',
    name: 'Codenames',
    description: 'Team word guessing with spymasters and operatives',
    icon: MessageSquare,
    route: '/games/codenames',
    color: 'from-purple-500 to-pink-600',
    players: '4+',
  },
];

export default function GameRoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="p-2 rounded-lg hover:bg-slate-700 transition-colors" title="Back to Dashboard">
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </Link>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Game Room</h1>
                <p className="text-xs text-slate-400">Room Code: {roomCode}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Game Selection */}
      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Choose a Game</h2>
          <p className="text-slate-400 text-lg">
            Select which game to play in room <span className="text-purple-400 font-mono font-bold">{roomCode}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {GAME_OPTIONS.map((game) => {
            const Icon = game.icon;
            return (
              <button
                key={game.id}
                onClick={() => navigate(game.route)}
                className="group bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/50 rounded-xl p-8 text-left transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="flex items-start gap-5">
                  <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.color}`}>
                    <Icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-slate-400 text-sm mb-3">{game.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded">
                        {game.players} players
                      </span>
                      <span className="text-purple-400 text-sm flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                        Play <ArrowRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
