/**
 * TableForge - Tournament Manager Component
 * Complete tournament/event system for venues
 */

import { useState } from 'react';
import { 
  Trophy, Calendar, Users, Clock, 
  Plus, Edit, Play, Pause,
  ChevronRight, Award, Target, Swords,
  CheckCircle, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================================================
// TYPES
// ============================================================================

export type TournamentFormat = 'single-elimination' | 'double-elimination' | 'round-robin' | 'swiss';
export type TournamentStatus = 'draft' | 'registration' | 'in-progress' | 'completed' | 'cancelled';

export interface Tournament {
  id: string;
  name: string;
  game: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  currentParticipants: number;
  entryFee: number;
  prizePool: number;
  startDate: string;
  startTime: string;
  registrationDeadline: string;
  rounds: TournamentRound[];
  participants: TournamentParticipant[];
  description: string;
}

export interface TournamentRound {
  id: string;
  number: number;
  name: string;
  matches: TournamentMatch[];
  status: 'pending' | 'in-progress' | 'completed';
}

export interface TournamentMatch {
  id: string;
  roundId: string;
  player1Id: string | null;
  player2Id: string | null;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  winnerId: string | null;
  status: 'pending' | 'in-progress' | 'completed';
  scheduledTime: string | null;
  tableId: string | null;
}

export interface TournamentParticipant {
  id: string;
  name: string;
  email: string;
  registeredAt: string;
  seed: number | null;
  wins: number;
  losses: number;
  isCheckedIn: boolean;
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockTournaments: Tournament[] = [
  {
    id: '1',
    name: 'Weekly Monopoly Championship',
    game: 'Monopoly',
    format: 'single-elimination',
    status: 'in-progress',
    maxParticipants: 16,
    currentParticipants: 16,
    entryFee: 10,
    prizePool: 120,
    startDate: '2024-01-20',
    startTime: '14:00',
    registrationDeadline: '2024-01-19',
    description: 'Weekly championship with prizes for top 3!',
    participants: Array.from({ length: 16 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Player ${i + 1}`,
      email: `player${i + 1}@example.com`,
      registeredAt: '2024-01-15',
      seed: i + 1,
      wins: Math.floor(Math.random() * 3),
      losses: Math.floor(Math.random() * 2),
      isCheckedIn: true,
    })),
    rounds: [
      {
        id: 'r1',
        number: 1,
        name: 'Round of 16',
        status: 'completed',
        matches: Array.from({ length: 8 }, (_, i) => ({
          id: `m1-${i}`,
          roundId: 'r1',
          player1Id: `p${i * 2 + 1}`,
          player2Id: `p${i * 2 + 2}`,
          player1Name: `Player ${i * 2 + 1}`,
          player2Name: `Player ${i * 2 + 2}`,
          player1Score: Math.random() > 0.5 ? 1 : 0,
          player2Score: Math.random() > 0.5 ? 1 : 0,
          winnerId: `p${i * 2 + 1}`,
          status: 'completed' as const,
          scheduledTime: '14:00',
          tableId: `table-${i + 1}`,
        })),
      },
      {
        id: 'r2',
        number: 2,
        name: 'Quarterfinals',
        status: 'in-progress',
        matches: Array.from({ length: 4 }, (_, i) => ({
          id: `m2-${i}`,
          roundId: 'r2',
          player1Id: `p${i * 4 + 1}`,
          player2Id: `p${i * 4 + 3}`,
          player1Name: `Player ${i * 4 + 1}`,
          player2Name: `Player ${i * 4 + 3}`,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          status: i < 2 ? 'in-progress' as const : 'pending' as const,
          scheduledTime: '16:00',
          tableId: i < 2 ? `table-${i + 1}` : null,
        })),
      },
    ],
  },
  {
    id: '2',
    name: 'Catan Masters League',
    game: 'Catan',
    format: 'round-robin',
    status: 'registration',
    maxParticipants: 12,
    currentParticipants: 8,
    entryFee: 15,
    prizePool: 150,
    startDate: '2024-01-25',
    startTime: '18:00',
    registrationDeadline: '2024-01-24',
    description: 'Monthly league with round-robin format.',
    participants: Array.from({ length: 8 }, (_, i) => ({
      id: `cp${i + 1}`,
      name: `Catan Player ${i + 1}`,
      email: `catan${i + 1}@example.com`,
      registeredAt: '2024-01-18',
      seed: null,
      wins: 0,
      losses: 0,
      isCheckedIn: false,
    })),
    rounds: [],
  },
];

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: TournamentStatus }) {
  const styles = {
    'draft': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    'registration': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'in-progress': 'bg-green-500/20 text-green-400 border-green-500/30',
    'completed': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'cancelled': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status]}`}>
      {status.replace('-', ' ').toUpperCase()}
    </span>
  );
}

function FormatBadge({ format }: { format: TournamentFormat }) {
  const labels = {
    'single-elimination': 'Single Elim',
    'double-elimination': 'Double Elim',
    'round-robin': 'Round Robin',
    'swiss': 'Swiss',
  };
  
  return (
    <span className="px-2 py-1 text-xs font-medium rounded bg-purple-500/20 text-purple-400">
      {labels[format]}
    </span>
  );
}

function TournamentCard({ 
  tournament, 
  onView, 
  onEdit 
}: { 
  tournament: Tournament; 
  onView: () => void;
  onEdit: () => void;
}) {
  return (
    <Card className="bg-slate-800/50 border-slate-700 hover:border-purple-500/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              {tournament.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>{tournament.game}</span>
              <span>•</span>
              <FormatBadge format={tournament.format} />
            </CardDescription>
          </div>
          <StatusBadge status={tournament.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Users className="h-4 w-4 text-blue-400" />
            {tournament.currentParticipants}/{tournament.maxParticipants} players
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="h-4 w-4 text-green-400" />
            {tournament.startDate}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Clock className="h-4 w-4 text-orange-400" />
            {tournament.startTime}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Award className="h-4 w-4 text-yellow-400" />
            €{tournament.prizePool} prize
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={onView}
          >
            <ChevronRight className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onEdit}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BracketMatch({ match }: { match: TournamentMatch }) {
  const getStatusIcon = () => {
    switch (match.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'in-progress':
        return <Play className="h-4 w-4 text-blue-400" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700 min-w-[200px]">
      <div className="flex items-center justify-between mb-2">
        {getStatusIcon()}
        {match.scheduledTime && (
          <span className="text-xs text-slate-400">{match.scheduledTime}</span>
        )}
      </div>
      
      <div className={`flex items-center justify-between p-2 rounded ${
        match.winnerId === match.player1Id ? 'bg-green-500/20' : 'bg-slate-700/50'
      }`}>
        <span className="text-sm text-white">{match.player1Name || 'TBD'}</span>
        <span className="text-sm font-bold text-white">{match.player1Score}</span>
      </div>
      
      <div className="text-center text-xs text-slate-500 py-1">vs</div>
      
      <div className={`flex items-center justify-between p-2 rounded ${
        match.winnerId === match.player2Id ? 'bg-green-500/20' : 'bg-slate-700/50'
      }`}>
        <span className="text-sm text-white">{match.player2Name || 'TBD'}</span>
        <span className="text-sm font-bold text-white">{match.player2Score}</span>
      </div>
    </div>
  );
}

function TournamentBracket({ tournament }: { tournament: Tournament }) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 p-4 min-w-max">
        {tournament.rounds.map((round) => (
          <div key={round.id} className="flex flex-col gap-4">
            <h4 className="text-sm font-semibold text-slate-400 text-center">
              {round.name}
            </h4>
            <div className="flex flex-col gap-4 justify-around h-full">
              {round.matches.map((match) => (
                <BracketMatch key={match.id} match={match} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipantsList({ participants }: { participants: TournamentParticipant[] }) {
  return (
    <div className="space-y-2">
      {participants.map((participant, index) => (
        <div 
          key={participant.id}
          className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg"
        >
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs flex items-center justify-center font-bold">
              {participant.seed || index + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{participant.name}</p>
              <p className="text-xs text-slate-400">{participant.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-green-400">{participant.wins}W</p>
              <p className="text-sm text-red-400">{participant.losses}L</p>
            </div>
            {participant.isCheckedIn ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-400" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateTournamentDialog({ onClose }: { onClose: () => void }) {
  return (
    <DialogContent className="bg-slate-800 border-slate-700 max-w-2xl">
      <DialogHeader>
        <DialogTitle>Create Tournament</DialogTitle>
        <DialogDescription>
          Set up a new tournament or event for your venue.
        </DialogDescription>
      </DialogHeader>
      
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tournament Name</Label>
            <Input 
              placeholder="Weekly Championship" 
              className="bg-slate-700 border-slate-600" 
            />
          </div>
          <div className="space-y-2">
            <Label>Game</Label>
            <Select>
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Select game" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monopoly">Monopoly</SelectItem>
                <SelectItem value="catan">Catan</SelectItem>
                <SelectItem value="codenames">Codenames</SelectItem>
                <SelectItem value="risk">Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Format</Label>
            <Select>
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single-elimination">Single Elimination</SelectItem>
                <SelectItem value="double-elimination">Double Elimination</SelectItem>
                <SelectItem value="round-robin">Round Robin</SelectItem>
                <SelectItem value="swiss">Swiss</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Max Participants</Label>
            <Select>
              <SelectTrigger className="bg-slate-700 border-slate-600">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 players</SelectItem>
                <SelectItem value="16">16 players</SelectItem>
                <SelectItem value="32">32 players</SelectItem>
                <SelectItem value="64">64 players</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" className="bg-slate-700 border-slate-600" />
          </div>
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input type="time" className="bg-slate-700 border-slate-600" />
          </div>
          <div className="space-y-2">
            <Label>Registration Deadline</Label>
            <Input type="date" className="bg-slate-700 border-slate-600" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Entry Fee (€)</Label>
            <Input type="number" min="0" defaultValue="0" className="bg-slate-700 border-slate-600" />
          </div>
          <div className="space-y-2">
            <Label>Prize Pool (€)</Label>
            <Input type="number" min="0" defaultValue="0" className="bg-slate-700 border-slate-600" />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Description</Label>
          <Input 
            placeholder="Tournament description..." 
            className="bg-slate-700 border-slate-600" 
          />
        </div>
        
        <div className="flex gap-2 pt-4">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700">
            Create Tournament
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TournamentManager() {
  const [tournaments] = useState<Tournament[]>(mockTournaments);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bracket' | 'participants'>('bracket');

  if (selectedTournament) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedTournament(null)}
              className="mb-2"
            >
              ← Back to Tournaments
            </Button>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Trophy className="h-7 w-7 text-yellow-400" />
              {selectedTournament.name}
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={selectedTournament.status} />
              <FormatBadge format={selectedTournament.format} />
              <span className="text-slate-400">{selectedTournament.game}</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            {selectedTournament.status === 'registration' && (
              <Button className="bg-green-600 hover:bg-green-700">
                <Play className="h-4 w-4 mr-2" />
                Start Tournament
              </Button>
            )}
            {selectedTournament.status === 'in-progress' && (
              <Button variant="outline">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}
            <Button variant="outline">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4 text-center">
              <Users className="h-6 w-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {selectedTournament.currentParticipants}/{selectedTournament.maxParticipants}
              </p>
              <p className="text-xs text-slate-400">Participants</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4 text-center">
              <Target className="h-6 w-6 text-green-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {selectedTournament.rounds.filter(r => r.status === 'completed').length}/{selectedTournament.rounds.length}
              </p>
              <p className="text-xs text-slate-400">Rounds Complete</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4 text-center">
              <Swords className="h-6 w-6 text-red-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {selectedTournament.rounds.flatMap(r => r.matches).filter(m => m.status === 'completed').length}
              </p>
              <p className="text-xs text-slate-400">Matches Played</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-4 text-center">
              <Award className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">€{selectedTournament.prizePool}</p>
              <p className="text-xs text-slate-400">Prize Pool</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700 pb-2">
          <Button
            variant={activeTab === 'bracket' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('bracket')}
            className={activeTab === 'bracket' ? 'bg-purple-600' : ''}
          >
            <Target className="h-4 w-4 mr-2" />
            Bracket
          </Button>
          <Button
            variant={activeTab === 'participants' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('participants')}
            className={activeTab === 'participants' ? 'bg-purple-600' : ''}
          >
            <Users className="h-4 w-4 mr-2" />
            Participants
          </Button>
        </div>

        {/* Content */}
        {activeTab === 'bracket' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Tournament Bracket</CardTitle>
            </CardHeader>
            <CardContent>
              <TournamentBracket tournament={selectedTournament} />
            </CardContent>
          </Card>
        )}

        {activeTab === 'participants' && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle>Participants</CardTitle>
              <CardDescription>
                {selectedTournament.participants.filter(p => p.isCheckedIn).length} checked in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ParticipantsList participants={selectedTournament.participants} />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Trophy className="h-7 w-7 text-yellow-400" />
            Tournaments & Events
          </h2>
          <p className="text-slate-400 mt-1">
            Manage tournaments, leagues, and special events
          </p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Tournament
            </Button>
          </DialogTrigger>
          <CreateTournamentDialog onClose={() => setIsCreateOpen(false)} />
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-white">{tournaments.length}</p>
            <p className="text-sm text-slate-400">Total Tournaments</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-green-400">
              {tournaments.filter(t => t.status === 'in-progress').length}
            </p>
            <p className="text-sm text-slate-400">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-blue-400">
              {tournaments.filter(t => t.status === 'registration').length}
            </p>
            <p className="text-sm text-slate-400">Open Registration</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">
              €{tournaments.reduce((sum, t) => sum + t.prizePool, 0)}
            </p>
            <p className="text-sm text-slate-400">Total Prizes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tournament Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tournaments.map(tournament => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            onView={() => setSelectedTournament(tournament)}
            onEdit={() => {}}
          />
        ))}
      </div>
    </div>
  );
}
