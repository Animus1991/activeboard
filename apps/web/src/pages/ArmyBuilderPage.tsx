import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Plus,
  Minus,
  Save,
  Trash2,
  Shield,
  Sword,
  Target,
  Heart,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

// Types
interface UnitType {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  minSize: number;
  maxSize: number;
  stats: {
    quality: number;
    defense: number;
    wounds: number;
    movement: number;
  };
  weapons: {
    name: string;
    range: number;
    attacks: number;
    ap: number;
  }[];
  specialRules: string[];
  keywords: string[];
}

interface Faction {
  id: string;
  name: string;
  description: string;
  color: string;
  units: UnitType[];
}

interface ArmyUnit {
  id: string;
  unitTypeId: string;
  quantity: number;
  options: Record<string, string>;
}

// ArmyList type for future API integration
type _ArmyList = {
  id: string;
  name: string;
  factionId: string;
  pointsLimit: number;
  units: ArmyUnit[];
};
void (0 as unknown as _ArmyList); // Suppress unused warning

// Mock data - One Page Rules Grimdark Future
const mockFactions: Faction[] = [
  {
    id: 'battle-brothers',
    name: 'Battle Brothers',
    description: 'Elite superhuman warriors in power armor',
    color: '#1e40af',
    units: [
      {
        id: 'bb-brothers',
        name: 'Battle Brothers',
        description: 'Standard infantry squad',
        pointsCost: 100,
        minSize: 5,
        maxSize: 10,
        stats: { quality: 4, defense: 4, wounds: 1, movement: 6 },
        weapons: [
          { name: 'Assault Rifle', range: 24, attacks: 1, ap: 0 },
          { name: 'CCW', range: 0, attacks: 1, ap: 0 },
        ],
        specialRules: ['Fearless'],
        keywords: ['Infantry', 'Battle Brothers'],
      },
      {
        id: 'bb-assault',
        name: 'Assault Brothers',
        description: 'Close combat specialists with jump packs',
        pointsCost: 120,
        minSize: 5,
        maxSize: 10,
        stats: { quality: 4, defense: 4, wounds: 1, movement: 9 },
        weapons: [
          { name: 'Pistol', range: 12, attacks: 1, ap: 0 },
          { name: 'Energy Sword', range: 0, attacks: 2, ap: 2 },
        ],
        specialRules: ['Fearless', 'Flying'],
        keywords: ['Infantry', 'Battle Brothers', 'Jump Pack'],
      },
      {
        id: 'bb-terminator',
        name: 'Terminator Brothers',
        description: 'Heavy assault infantry in tactical armor',
        pointsCost: 200,
        minSize: 5,
        maxSize: 5,
        stats: { quality: 4, defense: 2, wounds: 1, movement: 5 },
        weapons: [
          { name: 'Storm Bolter', range: 24, attacks: 2, ap: 0 },
          { name: 'Power Fist', range: 0, attacks: 2, ap: 4 },
        ],
        specialRules: ['Fearless', 'Tough(3)'],
        keywords: ['Infantry', 'Battle Brothers', 'Terminator'],
      },
      {
        id: 'bb-captain',
        name: 'Battle Captain',
        description: 'Heroic leader of the chapter',
        pointsCost: 95,
        minSize: 1,
        maxSize: 1,
        stats: { quality: 3, defense: 4, wounds: 3, movement: 6 },
        weapons: [
          { name: 'Master-Crafted Rifle', range: 24, attacks: 2, ap: 1 },
          { name: 'Power Sword', range: 0, attacks: 4, ap: 2 },
        ],
        specialRules: ['Fearless', 'Hero', 'Tough(3)'],
        keywords: ['Infantry', 'Battle Brothers', 'Hero'],
      },
      {
        id: 'bb-dreadnought',
        name: 'Dreadnought',
        description: 'Ancient warrior entombed in a walking sarcophagus',
        pointsCost: 170,
        minSize: 1,
        maxSize: 1,
        stats: { quality: 4, defense: 2, wounds: 6, movement: 6 },
        weapons: [
          { name: 'Assault Cannon', range: 24, attacks: 6, ap: 1 },
          { name: 'Power Fist', range: 0, attacks: 4, ap: 4 },
        ],
        specialRules: ['Fearless', 'Tough(6)'],
        keywords: ['Vehicle', 'Battle Brothers', 'Walker'],
      },
    ],
  },
  {
    id: 'orc-marauders',
    name: 'Orc Marauders',
    description: 'Brutal green-skinned warriors',
    color: '#166534',
    units: [
      {
        id: 'orc-boyz',
        name: 'Orc Boyz',
        description: 'Basic orc infantry mob',
        pointsCost: 65,
        minSize: 10,
        maxSize: 20,
        stats: { quality: 5, defense: 5, wounds: 1, movement: 6 },
        weapons: [
          { name: 'Slugga', range: 12, attacks: 1, ap: 0 },
          { name: 'Choppa', range: 0, attacks: 1, ap: 0 },
        ],
        specialRules: ['Furious'],
        keywords: ['Infantry', 'Orc'],
      },
      {
        id: 'orc-nobz',
        name: 'Orc Nobz',
        description: 'Elite orc warriors',
        pointsCost: 110,
        minSize: 5,
        maxSize: 10,
        stats: { quality: 5, defense: 4, wounds: 2, movement: 6 },
        weapons: [
          { name: 'Big Choppa', range: 0, attacks: 2, ap: 1 },
        ],
        specialRules: ['Furious', 'Tough(2)'],
        keywords: ['Infantry', 'Orc', 'Elite'],
      },
      {
        id: 'orc-warboss',
        name: 'Warboss',
        description: 'Mighty orc leader',
        pointsCost: 120,
        minSize: 1,
        maxSize: 1,
        stats: { quality: 4, defense: 4, wounds: 4, movement: 6 },
        weapons: [
          { name: 'Kustom Shoota', range: 18, attacks: 3, ap: 0 },
          { name: 'Power Klaw', range: 0, attacks: 4, ap: 3 },
        ],
        specialRules: ['Furious', 'Hero', 'Tough(4)'],
        keywords: ['Infantry', 'Orc', 'Hero'],
      },
      {
        id: 'orc-trukk',
        name: 'War Trukk',
        description: 'Fast transport vehicle',
        pointsCost: 85,
        minSize: 1,
        maxSize: 1,
        stats: { quality: 5, defense: 4, wounds: 4, movement: 12 },
        weapons: [
          { name: 'Big Shoota', range: 24, attacks: 3, ap: 0 },
        ],
        specialRules: ['Transport(12)', 'Fast'],
        keywords: ['Vehicle', 'Orc', 'Transport'],
      },
    ],
  },
];

export default function ArmyBuilderPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(null);
  const [armyName, setArmyName] = useState('My Army');
  const [pointsLimit, setPointsLimit] = useState(1000);
  const [armyUnits, setArmyUnits] = useState<ArmyUnit[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnitPanel, setShowUnitPanel] = useState(true);

  // Computed
  const selectedFaction = mockFactions.find(f => f.id === selectedFactionId);
  
  const totalPoints = useMemo(() => {
    if (!selectedFaction) return 0;
    return armyUnits.reduce((sum, unit) => {
      const unitType = selectedFaction.units.find(u => u.id === unit.unitTypeId);
      return sum + (unitType?.pointsCost || 0) * unit.quantity;
    }, 0);
  }, [armyUnits, selectedFaction]);

  const filteredUnits = useMemo(() => {
    if (!selectedFaction) return [];
    return selectedFaction.units.filter(unit =>
      unit.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [selectedFaction, searchQuery]);

  // Handlers
  const handleAddUnit = (unitType: UnitType) => {
    const existingUnit = armyUnits.find(u => u.unitTypeId === unitType.id);
    
    if (existingUnit) {
      // Increase quantity if already exists
      setArmyUnits(prev => prev.map(u => 
        u.unitTypeId === unitType.id 
          ? { ...u, quantity: u.quantity + 1 }
          : u
      ));
    } else {
      // Add new unit
      setArmyUnits(prev => [...prev, {
        id: `army-unit-${Date.now()}`,
        unitTypeId: unitType.id,
        quantity: 1,
        options: {},
      }]);
    }

    toast({
      title: 'Unit Added',
      description: `${unitType.name} added to army`,
    });
  };

  const handleRemoveUnit = (armyUnitId: string) => {
    setArmyUnits(prev => prev.filter(u => u.id !== armyUnitId));
  };

  const handleChangeQuantity = (armyUnitId: string, delta: number) => {
    setArmyUnits(prev => prev.map(u => {
      if (u.id !== armyUnitId) return u;
      const newQuantity = Math.max(1, u.quantity + delta);
      return { ...u, quantity: newQuantity };
    }));
  };

  const handleSaveArmy = () => {
    // In real implementation, save to API
    toast({
      title: 'Army Saved',
      description: `${armyName} (${totalPoints}pts) saved successfully`,
    });
  };

  const handleStartGame = () => {
    if (armyUnits.length === 0) {
      toast({
        title: 'No Units',
        description: 'Add at least one unit to your army',
        variant: 'destructive',
      });
      return;
    }
    navigate('/dashboard');
  };

  // Faction selection view
  if (!selectedFactionId) {
    return (
      <div className="min-h-screen bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Army Builder</h1>
            <p className="text-slate-400">Select a faction to begin building your army</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockFactions.map(faction => (
              <Card
                key={faction.id}
                className="bg-slate-800 border-slate-700 cursor-pointer hover:border-slate-500 transition-colors"
                onClick={() => setSelectedFactionId(faction.id)}
              >
                <CardHeader>
                  <div
                    className="w-12 h-12 rounded-lg mb-3 flex items-center justify-center"
                    style={{ backgroundColor: faction.color }}
                  >
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <CardTitle className="text-white">{faction.name}</CardTitle>
                  <CardDescription className="text-slate-400">
                    {faction.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">
                    {faction.units.length} unit types available
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Army builder view
  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left Panel - Unit Catalog */}
      <div className={`${showUnitPanel ? 'w-96' : 'w-0'} bg-slate-800 border-r border-slate-700 flex flex-col transition-all overflow-hidden`}>
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ backgroundColor: selectedFaction?.color }}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">{selectedFaction?.name}</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedFactionId(null)}
              className="text-slate-400"
            >
              Change
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredUnits.map(unit => (
            <Card
              key={unit.id}
              className="bg-slate-700 border-slate-600 cursor-pointer hover:border-slate-500 transition-colors"
              onClick={() => handleAddUnit(unit)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-white">{unit.name}</h3>
                    <p className="text-xs text-slate-400">{unit.description}</p>
                  </div>
                  <span className="text-emerald-400 font-bold">{unit.pointsCost}pts</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-2">
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Quality</div>
                    <div className="text-sm font-medium text-white">{unit.stats.quality}+</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Defense</div>
                    <div className="text-sm font-medium text-white">{unit.stats.defense}+</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Wounds</div>
                    <div className="text-sm font-medium text-white">{unit.stats.wounds}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Move</div>
                    <div className="text-sm font-medium text-white">{unit.stats.movement}"</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1">
                  {unit.keywords.map(keyword => (
                    <span
                      key={keyword}
                      className="text-xs px-2 py-0.5 bg-slate-600 text-slate-300 rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Toggle Panel Button */}
      <button
        onClick={() => setShowUnitPanel(!showUnitPanel)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-slate-700 p-2 rounded-r-lg border border-l-0 border-slate-600 text-slate-400 hover:text-white transition-colors"
        style={{ left: showUnitPanel ? '384px' : '0' }}
      >
        {showUnitPanel ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Content - Army List */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Input
                value={armyName}
                onChange={(e) => setArmyName(e.target.value)}
                className="w-64 bg-slate-700 border-slate-600 text-white text-lg font-semibold"
              />
              <div className="flex items-center gap-2">
                <Label className="text-slate-400">Points Limit:</Label>
                <Input
                  type="number"
                  value={pointsLimit}
                  onChange={(e) => setPointsLimit(parseInt(e.target.value) || 0)}
                  className="w-24 bg-slate-700 border-slate-600 text-white"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`text-2xl font-bold ${totalPoints > pointsLimit ? 'text-red-400' : 'text-emerald-400'}`}>
                {totalPoints} / {pointsLimit} pts
              </div>
              <Button onClick={handleSaveArmy} variant="outline" className="border-slate-600">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleStartGame} className="bg-emerald-600 hover:bg-emerald-700">
                Start Game
              </Button>
            </div>
          </div>
        </div>

        {/* Army Units */}
        <div className="flex-1 overflow-y-auto p-6">
          {armyUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Shield className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">No units in your army</p>
              <p className="text-sm">Click on units in the left panel to add them</p>
            </div>
          ) : (
            <div className="space-y-4">
              {armyUnits.map(armyUnit => {
                const unitType = selectedFaction?.units.find(u => u.id === armyUnit.unitTypeId);
                if (!unitType) return null;

                const unitPoints = unitType.pointsCost * armyUnit.quantity;

                return (
                  <Card key={armyUnit.id} className="bg-slate-800 border-slate-700">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: selectedFaction?.color }}
                          >
                            <Shield className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-white text-lg">{unitType.name}</h3>
                            <p className="text-sm text-slate-400">{unitType.description}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Stats */}
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-slate-400">
                              <Target className="w-4 h-4" />
                              <span>{unitType.stats.quality}+</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              <Shield className="w-4 h-4" />
                              <span>{unitType.stats.defense}+</span>
                            </div>
                            <div className="flex items-center gap-1 text-slate-400">
                              <Heart className="w-4 h-4" />
                              <span>{unitType.stats.wounds}</span>
                            </div>
                          </div>

                          {/* Quantity */}
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeQuantity(armyUnit.id, -1)}
                              disabled={armyUnit.quantity <= 1}
                              className="border-slate-600"
                            >
                              <Minus className="w-4 h-4" />
                            </Button>
                            <span className="w-8 text-center text-white font-medium">
                              {armyUnit.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangeQuantity(armyUnit.id, 1)}
                              className="border-slate-600"
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>

                          {/* Points */}
                          <div className="w-24 text-right">
                            <span className="text-emerald-400 font-bold text-lg">{unitPoints}pts</span>
                          </div>

                          {/* Remove */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUnit(armyUnit.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Weapons */}
                      <div className="mt-4 pt-4 border-t border-slate-700">
                        <div className="flex flex-wrap gap-4">
                          {unitType.weapons.map((weapon, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm text-slate-400">
                              <Sword className="w-4 h-4" />
                              <span className="text-slate-300">{weapon.name}</span>
                              {weapon.range > 0 && <span>{weapon.range}"</span>}
                              <span>A{weapon.attacks}</span>
                              {weapon.ap > 0 && <span className="text-amber-400">AP({weapon.ap})</span>}
                            </div>
                          ))}
                        </div>
                        {unitType.specialRules.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {unitType.specialRules.map(rule => (
                              <span
                                key={rule}
                                className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded"
                              >
                                {rule}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-4 border-t border-slate-700 bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-slate-400">
              {armyUnits.length} unit{armyUnits.length !== 1 ? 's' : ''} •{' '}
              {armyUnits.reduce((sum, u) => sum + u.quantity, 0)} model{armyUnits.reduce((sum, u) => sum + u.quantity, 0) !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-4">
              {totalPoints > pointsLimit && (
                <span className="text-red-400 text-sm">
                  {totalPoints - pointsLimit} points over limit!
                </span>
              )}
              <div className="w-64 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${totalPoints > pointsLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, (totalPoints / pointsLimit) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
