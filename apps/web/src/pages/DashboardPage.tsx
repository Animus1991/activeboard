import { useState, useEffect } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Gamepad2, Plus, Users, LogOut, Loader2, Map, Landmark, MessageSquare, Globe, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { rooms, games, type GameSystem } from '@/lib/api';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout, isLoading, login } = useAuth();
  const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  const [isJoinRoomOpen, setIsJoinRoomOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [gameSystems, setGameSystems] = useState<GameSystem[]>([]);
  const [selectedGameSystem, setSelectedGameSystem] = useState<string>('');
  const [roomName, setRoomName] = useState('');
  const [isLoadingSystems, setIsLoadingSystems] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Load game systems when create room dialog opens
  useEffect(() => {
    if (isCreateRoomOpen && gameSystems.length === 0) {
      setIsLoadingSystems(true);
      games.listSystems()
        .then((systems) => {
          setGameSystems(systems);
          if (systems.length > 0) {
            setSelectedGameSystem(systems[0].id);
          }
        })
        .catch((err) => {
          console.error('Failed to load game systems:', err);
          // Use fallback mock data if API fails
          const mockSystems: GameSystem[] = [
            { id: 'mock-1', slug: 'grimdark-future', name: 'Grimdark Future', publisher: 'One Page Rules', minPlayers: 2, maxPlayers: 4 },
            { id: 'mock-2', slug: 'age-of-fantasy', name: 'Age of Fantasy', publisher: 'One Page Rules', minPlayers: 2, maxPlayers: 4 },
          ];
          setGameSystems(mockSystems);
          setSelectedGameSystem(mockSystems[0].id);
        })
        .finally(() => setIsLoadingSystems(false));
    }
  }, [isCreateRoomOpen, gameSystems.length]);

  const handleCreateRoom = async () => {
    if (!selectedGameSystem || !roomName.trim()) return;
    
    setIsCreating(true);
    try {
      const room = await rooms.create({
        name: roomName.trim(),
        gameSystemId: selectedGameSystem,
        maxPlayers: 4,
        pointsLimit: 1000,
        isPrivate: false,
      });
      setIsCreateRoomOpen(false);
      setRoomName('');
      navigate(`/lobby/${room.code}`);
    } catch (err) {
      console.error('Failed to create room:', err);
      // Fallback: create room with random code for demo
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      setIsCreateRoomOpen(false);
      setRoomName('');
      navigate(`/lobby/${code}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = () => {
    if (roomCode.trim()) {
      setIsJoinRoomOpen(false);
      navigate(`/lobby/${roomCode.trim().toUpperCase()}`);
    }
  };

  // Auto-login with mock user if not authenticated (prevents redirect to login from game pages)
  useEffect(() => {
    if (!isLoading && !user) {
      login('guest@tableforge.dev', 'guest').catch(() => {});
    }
  }, [isLoading, user, login]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Gamepad2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-bold">TableForge</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.displayName || user.username}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Ready to roll some dice? Start or join a game below.
          </p>
        </div>

        {/* Available Games */}
        <div className="mb-8">
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Play a Game
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card 
              className="cursor-pointer transition-all hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] border-orange-500/30"
              onClick={() => navigate('/games/catan')}
            >
              <CardContent className="p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 mb-4">
                  <Map className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-lg">Settlers of Catan</h3>
                <p className="text-sm text-muted-foreground mt-1">Trade, build, settle. Hex board with resources, robber, and development cards.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded">3-4 players</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Strategy</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-orange-500 hover:text-orange-400">
                  Play Now <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] border-red-500/30"
              onClick={() => navigate('/games/monopoly')}
            >
              <CardContent className="p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 mb-4">
                  <Landmark className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-lg">Monopoly</h3>
                <p className="text-sm text-muted-foreground mt-1">Buy properties, build houses & hotels, bankrupt opponents. 3D board.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">2-4 players</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Classic</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-red-500 hover:text-red-400">
                  Play Now <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] border-blue-500/30"
              onClick={() => navigate('/games/risk')}
            >
              <CardContent className="p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-orange-600 mb-4">
                  <Globe className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-lg">Risk</h3>
                <p className="text-sm text-muted-foreground mt-1">Conquer the world. Deploy armies, attack territories, dominate continents.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">2-6 players</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">War</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-blue-500 hover:text-blue-400">
                  Play Now <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer transition-all hover:bg-muted/50 hover:shadow-lg hover:scale-[1.02] border-purple-500/30"
              onClick={() => navigate('/games/codenames')}
            >
              <CardContent className="p-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4">
                  <MessageSquare className="h-7 w-7 text-white" />
                </div>
                <h3 className="font-bold text-lg">Codenames</h3>
                <p className="text-sm text-muted-foreground mt-1">Team word guessing. Spymaster gives clues, operatives guess cards.</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded">4+ players</span>
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Party</span>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-purple-500 hover:text-purple-400">
                  Play Now <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Card 
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate('/player')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <Trophy className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Player Dashboard</h3>
                <p className="text-sm text-muted-foreground">Stats, matchmaking & friends</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => setIsCreateRoomOpen(true)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Create Room</h3>
                <p className="text-sm text-muted-foreground">Private game with friends</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => setIsJoinRoomOpen(true)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Join Room</h3>
                <p className="text-sm text-muted-foreground">Enter room code</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                {user.totalGamesPlayed || 0}
              </CardTitle>
              <CardDescription>Games Played</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">
                {user.totalPlayTimeMinutes
                  ? `${Math.floor(user.totalPlayTimeMinutes / 60)}h`
                  : '0h'}
              </CardTitle>
              <CardDescription>Total Play Time</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold">4</CardTitle>
              <CardDescription>Available Games</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>

      {/* Create Room Dialog */}
      <Dialog open={isCreateRoomOpen} onOpenChange={setIsCreateRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Room</DialogTitle>
            <DialogDescription>
              Start a new game room. A unique code will be generated for others to join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium">Room Name</label>
              <Input
                placeholder="My Game Room"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Game System</label>
              {isLoadingSystems ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedGameSystem}
                  onChange={(e) => setSelectedGameSystem(e.target.value)}
                >
                  {gameSystems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name} {system.publisher ? `(${system.publisher})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <Button 
              className="w-full" 
              onClick={handleCreateRoom}
              disabled={isCreating || !roomName.trim() || !selectedGameSystem}
            >
              {isCreating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                'Create Room'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Room Dialog */}
      <Dialog open={isJoinRoomOpen} onOpenChange={setIsJoinRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Join Room</DialogTitle>
            <DialogDescription>
              Enter the room code to join an existing game.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Enter room code (e.g., ABC123)"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            />
            <Button 
              className="w-full" 
              onClick={handleJoinRoom}
              disabled={!roomCode.trim()}
            >
              Join Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
