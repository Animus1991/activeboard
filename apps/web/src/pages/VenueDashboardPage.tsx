import { useState } from 'react';
import { 
  Building2, 
  Monitor, 
  Users, 
  Calendar, 
  BarChart3, 
  Settings, 
  Plus,
  Play,
  Pause,
  Trash2,
  Edit,
  Eye,
  Clock,
  Gamepad2,
  TrendingUp,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Types
interface Table {
  id: string;
  name: string;
  status: 'available' | 'in-use' | 'maintenance' | 'reserved';
  currentGame: string | null;
  players: number;
  startTime: string | null;
  reservedBy: string | null;
  reservedUntil: string | null;
}

interface Reservation {
  id: string;
  tableId: string;
  tableName: string;
  customerName: string;
  customerEmail: string;
  date: string;
  startTime: string;
  endTime: string;
  players: number;
  game: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  notes: string;
}

interface GameSession {
  id: string;
  tableId: string;
  tableName: string;
  game: string;
  players: { name: string; type: 'local' | 'remote-pc' | 'remote-vr' }[];
  startTime: string;
  duration: number; // minutes
  status: 'active' | 'completed' | 'paused';
}

interface VenueStats {
  totalTables: number;
  activeTables: number;
  totalSessionsToday: number;
  totalPlayersToday: number;
  averageSessionDuration: number;
  remotePlayersPercent: number;
  revenueToday: number;
  popularGames: { name: string; sessions: number }[];
}

// Mock data
const mockTables: Table[] = [
  { id: '1', name: 'Table Alpha', status: 'in-use', currentGame: 'Grimdark Future', players: 4, startTime: '14:30', reservedBy: null, reservedUntil: null },
  { id: '2', name: 'Table Beta', status: 'available', currentGame: null, players: 0, startTime: null, reservedBy: null, reservedUntil: null },
  { id: '3', name: 'Table Gamma', status: 'reserved', currentGame: null, players: 0, startTime: null, reservedBy: 'John D.', reservedUntil: '18:00' },
  { id: '4', name: 'Table Delta', status: 'in-use', currentGame: 'Age of Fantasy', players: 6, startTime: '13:00', reservedBy: null, reservedUntil: null },
  { id: '5', name: 'Table Epsilon', status: 'maintenance', currentGame: null, players: 0, startTime: null, reservedBy: null, reservedUntil: null },
];

const mockReservations: Reservation[] = [
  { id: '1', tableId: '3', tableName: 'Table Gamma', customerName: 'John Doe', customerEmail: 'john@example.com', date: '2024-01-15', startTime: '16:00', endTime: '20:00', players: 4, game: 'Grimdark Future', status: 'confirmed', notes: 'Birthday party' },
  { id: '2', tableId: '1', tableName: 'Table Alpha', customerName: 'Jane Smith', customerEmail: 'jane@example.com', date: '2024-01-15', startTime: '20:00', endTime: '23:00', players: 6, game: 'Age of Fantasy', status: 'pending', notes: '' },
  { id: '3', tableId: '2', tableName: 'Table Beta', customerName: 'Bob Wilson', customerEmail: 'bob@example.com', date: '2024-01-16', startTime: '14:00', endTime: '18:00', players: 2, game: 'Warfleets', status: 'confirmed', notes: 'First time players' },
];

const mockSessions: GameSession[] = [
  { id: '1', tableId: '1', tableName: 'Table Alpha', game: 'Grimdark Future', players: [{ name: 'Alex', type: 'local' }, { name: 'Sam', type: 'local' }, { name: 'Chris', type: 'remote-pc' }, { name: 'Jordan', type: 'remote-vr' }], startTime: '14:30', duration: 90, status: 'active' },
  { id: '2', tableId: '4', tableName: 'Table Delta', game: 'Age of Fantasy', players: [{ name: 'Morgan', type: 'local' }, { name: 'Taylor', type: 'local' }, { name: 'Casey', type: 'local' }, { name: 'Riley', type: 'remote-pc' }, { name: 'Drew', type: 'remote-vr' }, { name: 'Quinn', type: 'remote-vr' }], startTime: '13:00', duration: 180, status: 'active' },
];

const mockStats: VenueStats = {
  totalTables: 5,
  activeTables: 2,
  totalSessionsToday: 8,
  totalPlayersToday: 32,
  averageSessionDuration: 145,
  remotePlayersPercent: 35,
  revenueToday: 480,
  popularGames: [
    { name: 'Grimdark Future', sessions: 12 },
    { name: 'Age of Fantasy', sessions: 8 },
    { name: 'Warfleets', sessions: 5 },
    { name: 'Double Tap', sessions: 3 },
  ],
};

// Status badge component
function StatusBadge({ status }: { status: Table['status'] }) {
  const styles = {
    'available': 'bg-green-500/20 text-green-400 border-green-500/30',
    'in-use': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'reserved': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'maintenance': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Table card component
function TableCard({ table, onViewSession }: { table: Table; onViewSession: (tableId: string) => void }) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5 text-purple-400" />
            {table.name}
          </CardTitle>
          <StatusBadge status={table.status} />
        </div>
      </CardHeader>
      <CardContent>
        {table.status === 'in-use' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Gamepad2 className="h-4 w-4" />
              {table.currentGame}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Users className="h-4 w-4" />
              {table.players} players
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Clock className="h-4 w-4" />
              Started at {table.startTime}
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full mt-2"
              onClick={() => onViewSession(table.id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View Session
            </Button>
          </div>
        )}
        
        {table.status === 'reserved' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <UserCheck className="h-4 w-4" />
              Reserved by {table.reservedBy}
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Clock className="h-4 w-4" />
              Until {table.reservedUntil}
            </div>
          </div>
        )}
        
        {table.status === 'available' && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Ready for new session</p>
            <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              Start Session
            </Button>
          </div>
        )}
        
        {table.status === 'maintenance' && (
          <div className="space-y-2">
            <p className="text-sm text-red-400">Under maintenance</p>
            <Button size="sm" variant="outline" className="w-full">
              Mark Available
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Stats card component
function StatsCard({ title, value, icon: Icon, trend, trendUp }: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  trendUp?: boolean;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
            {trend && (
              <p className={`text-xs ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
                {trendUp ? '↑' : '↓'} {trend}
              </p>
            )}
          </div>
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Icon className="h-6 w-6 text-purple-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Session row component
function SessionRow({ session }: { session: GameSession }) {
  const localPlayers = session.players.filter(p => p.type === 'local').length;
  const remotePlayers = session.players.filter(p => p.type !== 'local').length;
  
  return (
    <tr className="border-b border-slate-700">
      <td className="py-3 px-4">{session.tableName}</td>
      <td className="py-3 px-4">{session.game}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="text-green-400">{localPlayers} local</span>
          <span className="text-slate-500">|</span>
          <span className="text-blue-400">{remotePlayers} remote</span>
        </div>
      </td>
      <td className="py-3 px-4">{session.startTime}</td>
      <td className="py-3 px-4">{session.duration} min</td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 text-xs rounded-full ${
          session.status === 'active' ? 'bg-green-500/20 text-green-400' :
          session.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-slate-500/20 text-slate-400'
        }`}>
          {session.status}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost">
            <Eye className="h-4 w-4" />
          </Button>
          {session.status === 'active' && (
            <Button size="sm" variant="ghost">
              <Pause className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// Reservation row component
function ReservationRow({ reservation }: { reservation: Reservation }) {
  return (
    <tr className="border-b border-slate-700">
      <td className="py-3 px-4">{reservation.tableName}</td>
      <td className="py-3 px-4">{reservation.customerName}</td>
      <td className="py-3 px-4">{reservation.date}</td>
      <td className="py-3 px-4">{reservation.startTime} - {reservation.endTime}</td>
      <td className="py-3 px-4">{reservation.players}</td>
      <td className="py-3 px-4">{reservation.game}</td>
      <td className="py-3 px-4">
        <span className={`px-2 py-1 text-xs rounded-full ${
          reservation.status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
          reservation.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {reservation.status}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex gap-2">
          <Button size="sm" variant="ghost">
            <Edit className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-400">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// Main Dashboard Component
export default function VenueDashboardPage() {
  const [tables] = useState<Table[]>(mockTables);
  const [reservations] = useState<Reservation[]>(mockReservations);
  const [sessions] = useState<GameSession[]>(mockSessions);
  const [stats] = useState<VenueStats>(mockStats);
  const [_selectedTable, setSelectedTable] = useState<string | null>(null);
  void _selectedTable; // Used for future session view modal

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-xl font-bold text-white">TableForge Venue</h1>
                <p className="text-sm text-slate-400">Board Game Café Management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Reservation
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-800 border-slate-700">
                  <DialogHeader>
                    <DialogTitle>New Reservation</DialogTitle>
                    <DialogDescription>
                      Create a new table reservation for a customer.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Customer Name</Label>
                        <Input placeholder="John Doe" className="bg-slate-700 border-slate-600" />
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input type="email" placeholder="john@example.com" className="bg-slate-700 border-slate-600" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Table</Label>
                        <Select>
                          <SelectTrigger className="bg-slate-700 border-slate-600">
                            <SelectValue placeholder="Select table" />
                          </SelectTrigger>
                          <SelectContent>
                            {tables.filter(t => t.status === 'available').map(table => (
                              <SelectItem key={table.id} value={table.id}>{table.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Game</Label>
                        <Select>
                          <SelectTrigger className="bg-slate-700 border-slate-600">
                            <SelectValue placeholder="Select game" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grimdark">Grimdark Future</SelectItem>
                            <SelectItem value="fantasy">Age of Fantasy</SelectItem>
                            <SelectItem value="warfleets">Warfleets</SelectItem>
                            <SelectItem value="doubletap">Double Tap</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input type="date" className="bg-slate-700 border-slate-600" />
                      </div>
                      <div className="space-y-2">
                        <Label>Start Time</Label>
                        <Input type="time" className="bg-slate-700 border-slate-600" />
                      </div>
                      <div className="space-y-2">
                        <Label>End Time</Label>
                        <Input type="time" className="bg-slate-700 border-slate-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Number of Players</Label>
                      <Input type="number" min="2" max="10" defaultValue="4" className="bg-slate-700 border-slate-600" />
                    </div>
                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
                      Create Reservation
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCard 
            title="Active Tables" 
            value={`${stats.activeTables}/${stats.totalTables}`}
            icon={Monitor}
            trend="2 more than yesterday"
            trendUp={true}
          />
          <StatsCard 
            title="Sessions Today" 
            value={stats.totalSessionsToday}
            icon={Gamepad2}
            trend="+25% vs last week"
            trendUp={true}
          />
          <StatsCard 
            title="Players Today" 
            value={stats.totalPlayersToday}
            icon={Users}
            trend={`${stats.remotePlayersPercent}% remote`}
            trendUp={true}
          />
          <StatsCard 
            title="Revenue Today" 
            value={`€${stats.revenueToday}`}
            icon={DollarSign}
            trend="+12% vs yesterday"
            trendUp={true}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tables" className="space-y-4">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="tables" className="data-[state=active]:bg-purple-600">
              <Monitor className="h-4 w-4 mr-2" />
              Tables
            </TabsTrigger>
            <TabsTrigger value="sessions" className="data-[state=active]:bg-purple-600">
              <Play className="h-4 w-4 mr-2" />
              Active Sessions
            </TabsTrigger>
            <TabsTrigger value="reservations" className="data-[state=active]:bg-purple-600">
              <Calendar className="h-4 w-4 mr-2" />
              Reservations
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-purple-600">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Tables Tab */}
          <TabsContent value="tables">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.map(table => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  onViewSession={setSelectedTable}
                />
              ))}
              <Card className="bg-slate-800/30 border-slate-700 border-dashed flex items-center justify-center min-h-[200px] cursor-pointer hover:bg-slate-800/50 transition-colors">
                <div className="text-center">
                  <Plus className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                  <p className="text-slate-400">Add New Table</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle>Active Game Sessions</CardTitle>
                <CardDescription>Monitor and manage ongoing games</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-sm text-slate-400">
                        <th className="py-3 px-4">Table</th>
                        <th className="py-3 px-4">Game</th>
                        <th className="py-3 px-4">Players</th>
                        <th className="py-3 px-4">Started</th>
                        <th className="py-3 px-4">Duration</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {sessions.map(session => (
                        <SessionRow key={session.id} session={session} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reservations Tab */}
          <TabsContent value="reservations">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Reservations</CardTitle>
                    <CardDescription>Upcoming and pending reservations</CardDescription>
                  </div>
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Reservation
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700 text-left text-sm text-slate-400">
                        <th className="py-3 px-4">Table</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Players</th>
                        <th className="py-3 px-4">Game</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {reservations.map(reservation => (
                        <ReservationRow key={reservation.id} reservation={reservation} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Popular Games */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-purple-400" />
                    Popular Games
                  </CardTitle>
                  <CardDescription>Most played games this week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.popularGames.map((game, i) => (
                      <div key={game.name} className="flex items-center gap-4">
                        <span className="text-2xl font-bold text-slate-500 w-8">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium text-white">{game.name}</p>
                          <div className="w-full bg-slate-700 rounded-full h-2 mt-1">
                            <div 
                              className="bg-purple-500 h-2 rounded-full" 
                              style={{ width: `${(game.sessions / stats.popularGames[0].sessions) * 100}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-sm text-slate-400">{game.sessions} sessions</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Session Stats */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-400" />
                    Session Statistics
                  </CardTitle>
                  <CardDescription>Key metrics for your venue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Average Session Duration</span>
                        <span className="text-white font-medium">{stats.averageSessionDuration} min</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div className="bg-green-500 h-3 rounded-full" style={{ width: '72%' }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Remote Players</span>
                        <span className="text-white font-medium">{stats.remotePlayersPercent}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${stats.remotePlayersPercent}%` }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-400">Table Utilization</span>
                        <span className="text-white font-medium">{Math.round((stats.activeTables / stats.totalTables) * 100)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-3">
                        <div className="bg-purple-500 h-3 rounded-full" style={{ width: `${(stats.activeTables / stats.totalTables) * 100}%` }} />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Player Distribution</h4>
                      <div className="flex gap-4">
                        <div className="flex-1 text-center p-3 bg-slate-700/50 rounded-lg">
                          <p className="text-2xl font-bold text-green-400">{Math.round(stats.totalPlayersToday * (1 - stats.remotePlayersPercent / 100))}</p>
                          <p className="text-xs text-slate-400">Local Players</p>
                        </div>
                        <div className="flex-1 text-center p-3 bg-slate-700/50 rounded-lg">
                          <p className="text-2xl font-bold text-blue-400">{Math.round(stats.totalPlayersToday * (stats.remotePlayersPercent / 100) * 0.6)}</p>
                          <p className="text-xs text-slate-400">Remote PC</p>
                        </div>
                        <div className="flex-1 text-center p-3 bg-slate-700/50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-400">{Math.round(stats.totalPlayersToday * (stats.remotePlayersPercent / 100) * 0.4)}</p>
                          <p className="text-xs text-slate-400">Remote VR</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
