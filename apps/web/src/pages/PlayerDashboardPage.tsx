/**
 * TableForge - B2C Player Dashboard
 * Complete player dashboard with game history, friends, matchmaking
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Trophy, Users, Gamepad2, Clock, 
  MessageSquare,
  UserPlus, Search, Bell, Settings, Crown,
  Swords, Target, Award, Zap,
  ChevronRight, Play, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
// API imports for future use when backend is connected
// import { rooms, type GameRoom } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

// ============================================================================
// TYPES
// ============================================================================

interface PlayerProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  level: number;
  xp: number;
  xpToNextLevel: number;
  rank: string;
  gamesPlayed: number;
  wins: number;
  favoriteGame: string;
  memberSince: string;
  achievements: Achievement[];
  stats: PlayerStats;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

interface PlayerStats {
  totalPlayTime: number; // hours
  longestSession: number; // minutes
  winRate: number;
  averageGameDuration: number;
  gamesThisWeek: number;
  currentStreak: number;
}

interface GameHistoryEntry {
  id: string;
  game: string;
  date: string;
  duration: number;
  players: string[];
  result: 'win' | 'loss' | 'draw';
  xpEarned: number;
}

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  status: 'online' | 'in-game' | 'offline';
  currentGame?: string;
  lastSeen?: string;
}

interface MatchmakingQueue {
  id: string;
  game: string;
  mode: string;
  playersInQueue: number;
  estimatedWait: string;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockProfile: PlayerProfile = {
  id: 'player-1',
  username: 'DragonSlayer42',
  displayName: 'Alex Chen',
  avatar: '🐉',
  level: 24,
  xp: 7850,
  xpToNextLevel: 10000,
  rank: 'Gold III',
  gamesPlayed: 156,
  wins: 89,
  favoriteGame: 'Monopoly',
  memberSince: '2023-06-15',
  achievements: [
    { id: '1', name: 'First Victory', description: 'Win your first game', icon: '🏆', unlockedAt: '2023-06-15', rarity: 'common' },
    { id: '2', name: 'Winning Streak', description: 'Win 5 games in a row', icon: '🔥', unlockedAt: '2023-07-20', rarity: 'rare' },
    { id: '3', name: 'Monopoly Master', description: 'Win 50 Monopoly games', icon: '🏠', unlockedAt: '2023-11-10', rarity: 'epic' },
    { id: '4', name: 'Social Butterfly', description: 'Add 25 friends', icon: '🦋', unlockedAt: '2023-09-05', rarity: 'rare' },
    { id: '5', name: 'Night Owl', description: 'Play a game after midnight', icon: '🦉', unlockedAt: '2023-08-12', rarity: 'common' },
    { id: '6', name: 'World Conqueror', description: 'Win Risk by controlling all territories', icon: '🌍', unlockedAt: '2024-01-05', rarity: 'legendary' },
  ],
  stats: {
    totalPlayTime: 245,
    longestSession: 180,
    winRate: 57,
    averageGameDuration: 65,
    gamesThisWeek: 8,
    currentStreak: 3,
  },
};

const mockGameHistory: GameHistoryEntry[] = [
  { id: '1', game: 'Monopoly', date: '2024-01-15', duration: 95, players: ['Alex', 'Sam', 'Jordan', 'Casey'], result: 'win', xpEarned: 150 },
  { id: '2', game: 'Catan', date: '2024-01-14', duration: 75, players: ['Alex', 'Morgan', 'Taylor'], result: 'loss', xpEarned: 50 },
  { id: '3', game: 'Risk', date: '2024-01-13', duration: 180, players: ['Alex', 'Riley', 'Drew', 'Quinn', 'Jordan'], result: 'win', xpEarned: 200 },
  { id: '4', game: 'Codenames', date: '2024-01-12', duration: 45, players: ['Alex', 'Sam', 'Casey', 'Morgan'], result: 'win', xpEarned: 100 },
  { id: '5', game: 'Monopoly', date: '2024-01-10', duration: 120, players: ['Alex', 'Taylor', 'Riley'], result: 'loss', xpEarned: 40 },
  { id: '6', game: 'Catan', date: '2024-01-08', duration: 90, players: ['Alex', 'Drew', 'Quinn', 'Jordan'], result: 'draw', xpEarned: 75 },
];

const mockFriends: Friend[] = [
  { id: '1', username: 'SamTheGreat', displayName: 'Sam Wilson', avatar: '🎮', status: 'online' },
  { id: '2', username: 'JordanPlays', displayName: 'Jordan Lee', avatar: '🎲', status: 'in-game', currentGame: 'Monopoly' },
  { id: '3', username: 'CaseyGamer', displayName: 'Casey Brown', avatar: '🎯', status: 'online' },
  { id: '4', username: 'MorganRPG', displayName: 'Morgan Davis', avatar: '⚔️', status: 'offline', lastSeen: '2 hours ago' },
  { id: '5', username: 'TaylorWins', displayName: 'Taylor Smith', avatar: '🏆', status: 'in-game', currentGame: 'Risk' },
  { id: '6', username: 'RileyQuest', displayName: 'Riley Johnson', avatar: '🗺️', status: 'offline', lastSeen: '1 day ago' },
];

const mockQueues: MatchmakingQueue[] = [
  { id: '1', game: 'Monopoly', mode: 'Classic 4-Player', playersInQueue: 12, estimatedWait: '~2 min' },
  { id: '2', game: 'Catan', mode: 'Standard', playersInQueue: 8, estimatedWait: '~3 min' },
  { id: '3', game: 'Codenames', mode: 'Teams', playersInQueue: 15, estimatedWait: '~1 min' },
  { id: '4', game: 'Risk', mode: 'World Domination', playersInQueue: 6, estimatedWait: '~5 min' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function ProfileHeader({ profile }: { profile: PlayerProfile }) {
  const xpPercent = (profile.xp / profile.xpToNextLevel) * 100;
  
  return (
    <Card className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border-purple-500/30">
      <CardContent className="pt-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-4xl">
              {profile.avatar}
            </div>
            <div className="absolute -bottom-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
              Lv.{profile.level}
            </div>
          </div>
          
          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-white">{profile.displayName}</h2>
              <span className="text-slate-400">@{profile.username}</span>
            </div>
            <div className="flex items-center gap-4 mb-3">
              <span className="flex items-center gap-1 text-yellow-400">
                <Crown className="w-4 h-4" />
                {profile.rank}
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300">{profile.gamesPlayed} games played</span>
              <span className="text-slate-400">•</span>
              <span className="text-green-400">{profile.wins} wins</span>
            </div>
            
            {/* XP Bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Level {profile.level}</span>
                <span>{profile.xp.toLocaleString()} / {profile.xpToNextLevel.toLocaleString()} XP</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-green-400">{profile.stats.winRate}%</p>
              <p className="text-xs text-slate-400">Win Rate</p>
            </div>
            <div className="text-center p-3 bg-slate-800/50 rounded-lg">
              <p className="text-2xl font-bold text-orange-400">{profile.stats.currentStreak}</p>
              <p className="text-xs text-slate-400">Win Streak</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatsGrid({ stats }: { stats: PlayerStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 text-center">
          <Clock className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.totalPlayTime}h</p>
          <p className="text-xs text-slate-400">Total Play Time</p>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 text-center">
          <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.gamesThisWeek}</p>
          <p className="text-xs text-slate-400">Games This Week</p>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 text-center">
          <Target className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.averageGameDuration}m</p>
          <p className="text-xs text-slate-400">Avg Game Duration</p>
        </CardContent>
      </Card>
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="pt-4 text-center">
          <Trophy className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-white">{stats.longestSession}m</p>
          <p className="text-xs text-slate-400">Longest Session</p>
        </CardContent>
      </Card>
    </div>
  );
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const rarityColors = {
    common: 'border-slate-500 bg-slate-800/50',
    rare: 'border-blue-500 bg-blue-900/30',
    epic: 'border-purple-500 bg-purple-900/30',
    legendary: 'border-yellow-500 bg-yellow-900/30',
  };
  
  return (
    <div className={`p-3 rounded-lg border ${rarityColors[achievement.rarity]}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{achievement.icon}</span>
        <div>
          <p className="font-semibold text-white">{achievement.name}</p>
          <p className="text-xs text-slate-400">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

function GameHistoryRow({ entry }: { entry: GameHistoryEntry }) {
  const resultColors = {
    win: 'text-green-400 bg-green-500/20',
    loss: 'text-red-400 bg-red-500/20',
    draw: 'text-yellow-400 bg-yellow-500/20',
  };
  
  return (
    <div className="flex items-center gap-4 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
      <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
        <Gamepad2 className="w-6 h-6 text-purple-400" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white">{entry.game}</p>
        <p className="text-xs text-slate-400">
          {entry.players.join(', ')} • {entry.duration} min
        </p>
      </div>
      <div className="text-right">
        <span className={`px-2 py-1 rounded text-xs font-semibold ${resultColors[entry.result]}`}>
          {entry.result.toUpperCase()}
        </span>
        <p className="text-xs text-slate-400 mt-1">{entry.date}</p>
      </div>
      <div className="text-right">
        <p className="text-green-400 font-semibold">+{entry.xpEarned} XP</p>
      </div>
    </div>
  );
}

function FriendCard({ friend }: { friend: Friend }) {
  const statusColors = {
    online: 'bg-green-500',
    'in-game': 'bg-blue-500',
    offline: 'bg-slate-500',
  };

  const handlePlayWithFriend = () => {
    // Navigate to dashboard to create a room with friend
    window.location.href = '/dashboard';
  };

  const handleMessageFriend = () => {
    // In real implementation, open chat or messages page
    alert(`Chat with ${friend.displayName} coming soon!`);
  };
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-colors">
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-lg">
          {friend.avatar}
        </div>
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-800 ${statusColors[friend.status]}`} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-white">{friend.displayName}</p>
        <p className="text-xs text-slate-400">
          {friend.status === 'in-game' ? `Playing ${friend.currentGame}` : 
           friend.status === 'online' ? 'Online' : 
           `Last seen ${friend.lastSeen}`}
        </p>
      </div>
      <div className="flex gap-2">
        {friend.status !== 'offline' && (
          <Button size="sm" variant="ghost" className="text-green-400" onClick={handlePlayWithFriend}>
            <Play className="w-4 h-4" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={handleMessageFriend}>
          <MessageSquare className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

const GAME_ROUTES: Record<string, string> = {
  'Monopoly': '/games/monopoly',
  'Catan': '/games/catan',
  'Codenames': '/games/codenames',
  'Risk': '/games/risk',
};

function MatchmakingCard({ queue, onPlay }: { queue: MatchmakingQueue; onPlay: (game: string) => void }) {
  const handleJoinQueue = () => {
    onPlay(queue.game);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors cursor-pointer">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-white">{queue.game}</h4>
            <p className="text-xs text-slate-400">{queue.mode}</p>
          </div>
          <Gamepad2 className="w-8 h-8 text-purple-400" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            <Users className="w-4 h-4 inline mr-1" />
            {queue.playersInQueue} in queue
          </span>
          <span className="text-green-400">{queue.estimatedWait}</span>
        </div>
        <Button className="w-full mt-3 bg-purple-600 hover:bg-purple-700" onClick={handleJoinQueue}>
          Join Queue
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function PlayerDashboardPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile>(mockProfile);
  const [gameHistory] = useState<GameHistoryEntry[]>(mockGameHistory);
  const [friends] = useState<Friend[]>(mockFriends);
  const [queues] = useState<MatchmakingQueue[]>(mockQueues);
  const [friendSearch, setFriendSearch] = useState('');

  // Load user profile when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Update profile with real user data
      setProfile(prev => ({
        ...prev,
        id: user.id,
        username: user.username,
        displayName: user.displayName || user.username,
        gamesPlayed: user.totalGamesPlayed || 0,
        stats: {
          ...prev.stats,
          totalPlayTime: Math.floor((user.totalPlayTimeMinutes || 0) / 60),
        },
      }));
    }
  }, [isAuthenticated, user]);

  const onlineFriends = friends.filter(f => f.status !== 'offline');
  const filteredFriends = friends.filter(f => 
    f.displayName.toLowerCase().includes(friendSearch.toLowerCase()) ||
    f.username.toLowerCase().includes(friendSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <Gamepad2 className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-xl font-bold text-white">TableForge</h1>
                <p className="text-sm text-slate-400">Player Dashboard</p>
              </div>
            </Link>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">3</span>
              </Button>
              <Button variant="ghost" size="sm">
                <Settings className="h-5 w-5" />
              </Button>
              <Link to="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  {profile.avatar}
                </div>
                <span className="text-white font-medium">{profile.displayName}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Profile Header */}
        <ProfileHeader profile={profile} />

        {/* Stats Grid */}
        <StatsGrid stats={profile.stats} />

        {/* Main Tabs */}
        <Tabs defaultValue="play" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="play" className="data-[state=active]:bg-purple-600">
              <Play className="h-4 w-4 mr-2" />
              Play Now
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-purple-600">
              <History className="h-4 w-4 mr-2" />
              Game History
            </TabsTrigger>
            <TabsTrigger value="friends" className="data-[state=active]:bg-purple-600">
              <Users className="h-4 w-4 mr-2" />
              Friends ({onlineFriends.length} online)
            </TabsTrigger>
            <TabsTrigger value="achievements" className="data-[state=active]:bg-purple-600">
              <Award className="h-4 w-4 mr-2" />
              Achievements
            </TabsTrigger>
          </TabsList>

          {/* Play Now Tab */}
          <TabsContent value="play">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Play */}
              <div className="lg:col-span-2">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Swords className="w-5 h-5 text-purple-400" />
                      Quick Match
                    </CardTitle>
                    <CardDescription>Jump into a game with other players</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {queues.map(queue => (
                        <MatchmakingCard key={queue.id} queue={queue} onPlay={(game) => {
                          const route = GAME_ROUTES[game];
                          if (route) navigate(route);
                        }} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Online Friends */}
              <div>
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-400" />
                      Online Friends
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {onlineFriends.slice(0, 5).map(friend => (
                      <FriendCard key={friend.id} friend={friend} />
                    ))}
                    {onlineFriends.length > 5 && (
                      <Button variant="ghost" className="w-full text-slate-400">
                        View all {onlineFriends.length} online
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Game History Tab */}
          <TabsContent value="history">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Recent Games</CardTitle>
                <CardDescription>Your game history and statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {gameHistory.map(entry => (
                  <GameHistoryRow key={entry.id} entry={entry} />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Friends Tab */}
          <TabsContent value="friends">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Friends</CardTitle>
                    <CardDescription>{friends.length} friends • {onlineFriends.length} online</CardDescription>
                  </div>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => alert('Add friend feature coming soon!')}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Friend
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input 
                      placeholder="Search friends..." 
                      className="pl-10 bg-slate-700 border-slate-600"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredFriends.map(friend => (
                    <FriendCard key={friend.id} friend={friend} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  Achievements
                </CardTitle>
                <CardDescription>{profile.achievements.length} unlocked</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {profile.achievements.map(achievement => (
                    <AchievementCard key={achievement.id} achievement={achievement} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
