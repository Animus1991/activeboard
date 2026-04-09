/**
 * TableForge - Risk 3D World Map Board  
 * Physical board game on a war-room table with recognizable continent shapes,
 * territory markers, 3D army pieces, and interactive gameplay
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Text,
  PerspectiveCamera,
} from '@react-three/drei';
import * as THREE from 'three';
import { type GameState, type Territory, CONTINENTS } from './RiskEngine';

// ============================================================================
// FLAT MAP APPROACH — Like a real Risk board game on a table
// Territory positions map from engine 2D coords (0-800, 0-520) to 3D table
// ============================================================================

const CONTINENT_BG_COLORS: Record<string, string> = {
  'north-america': '#C4A240',  // Warm gold
  'south-america': '#B85C38',  // Terracotta
  'europe': '#4A7AB5',         // Steel blue
  'africa': '#7B5EA7',         // Purple
  'asia': '#4AAA60',           // Forest green
  'australia': '#C76B8A',      // Rose
};

const CONTINENT_LABEL_COLORS: Record<string, string> = {
  'north-america': '#FFD700',
  'south-america': '#FF6B6B',
  'europe': '#60A5FA',
  'africa': '#C084FC',
  'asia': '#4ADE80',
  'australia': '#F472B6',
};

// Scale from engine coords to 3D table
function toBoard(x: number, y: number): [number, number, number] {
  return [(x / 800) * 48 - 24, 0.12, (y / 520) * 30 - 15];
}

// ============================================================================
// TERRITORY PIECE — A colored game piece sitting on the board
// ============================================================================

interface TerritoryPieceProps {
  territory: Territory;
  playerColor: string;
  continentColor: string;
  isSelected: boolean;
  isAttackSource: boolean;
  isAttackTarget: boolean;
  onClick: () => void;
}

function TerritoryPiece({ territory, playerColor, continentColor, isSelected, isAttackSource, isAttackTarget, onClick }: TerritoryPieceProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => toBoard(territory.position.x, territory.position.y), [territory.position]);

  // Animate hover
  useFrame((_state) => {
    if (groupRef.current) {
      const lift = hovered ? 0.15 : isSelected ? 0.1 : 0;
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, pos[1] + lift, 0.1);
    }
  });

  const isHighlighted = isSelected || isAttackSource || isAttackTarget;
  const borderColor = isAttackTarget ? '#FF0000' : isAttackSource ? '#FFCC00' : isSelected ? '#FFFFFF' : continentColor;

  // Army type visual: 1-4 = infantry, 5-9 = cavalry, 10+ = cannon
  const armyType = territory.armies >= 10 ? 'artillery' : territory.armies >= 5 ? 'cavalry' : 'infantry';

  return (
    <group ref={groupRef} position={[pos[0], pos[1], pos[2]]}>
      {/* Continent background circle (always visible, shows which continent) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <circleGeometry args={[1.3, 24]} />
        <meshStandardMaterial color={continentColor} roughness={0.8} transparent opacity={0.4} />
      </mesh>

      {/* Highlight ring when selected/attacking */}
      {isHighlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <ringGeometry args={[0.85, 1.15, 32]} />
          <meshBasicMaterial color={borderColor} transparent opacity={isAttackTarget ? 0.9 : 0.7} />
        </mesh>
      )}

      {/* Main territory disc — player ownership color */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <cylinderGeometry args={[1.0, 1.0, 0.1, 24]} />
        <meshStandardMaterial
          color={playerColor}
          roughness={0.5}
          metalness={0.15}
          emissive={hovered ? playerColor : '#000000'}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>

      {/* Army figurine on top of disc */}
      <group position={[0, 0.06, 0]}>
        {armyType === 'infantry' && (
          <>
            {/* Soldier body */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <capsuleGeometry args={[0.08, 0.2, 4, 8]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.2} />
            </mesh>
            {/* Head */}
            <mesh position={[0, 0.38, 0]} castShadow>
              <sphereGeometry args={[0.07, 8, 8]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.2} />
            </mesh>
            {/* Weapon/rifle */}
            <mesh position={[0.06, 0.25, 0]} rotation={[0, 0, 0.3]} castShadow>
              <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
              <meshStandardMaterial color="#444" metalness={0.6} roughness={0.3} />
            </mesh>
          </>
        )}
        {armyType === 'cavalry' && (
          <>
            {/* Horse body */}
            <mesh position={[0, 0.12, 0]} castShadow>
              <boxGeometry args={[0.25, 0.15, 0.12]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.2} />
            </mesh>
            {/* Horse head */}
            <mesh position={[0.15, 0.2, 0]} rotation={[0, 0, 0.5]} castShadow>
              <boxGeometry args={[0.06, 0.12, 0.06]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.2} />
            </mesh>
            {/* Rider */}
            <mesh position={[0, 0.28, 0]} castShadow>
              <capsuleGeometry args={[0.05, 0.12, 4, 6]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.3} />
            </mesh>
          </>
        )}
        {armyType === 'artillery' && (
          <>
            {/* Cannon barrel */}
            <mesh position={[0.1, 0.1, 0]} rotation={[0, 0, 0.3]} castShadow>
              <cylinderGeometry args={[0.04, 0.06, 0.3, 8]} />
              <meshStandardMaterial color="#555" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Cannon base/carriage */}
            <mesh position={[0, 0.05, 0]} castShadow>
              <boxGeometry args={[0.2, 0.06, 0.12]} />
              <meshStandardMaterial color={playerColor} roughness={0.5} metalness={0.2} />
            </mesh>
            {/* Wheels */}
            <mesh position={[-0.08, 0.05, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
              <meshStandardMaterial color="#333" metalness={0.5} roughness={0.4} />
            </mesh>
            <mesh position={[-0.08, 0.05, -0.08]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.02, 8]} />
              <meshStandardMaterial color="#333" metalness={0.5} roughness={0.4} />
            </mesh>
          </>
        )}
      </group>

      {/* Army count — large, always visible */}
      <Text
        position={[0, 0.12, 0.7]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.4}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.05}
        outlineColor="#000"
        fontWeight="bold"
      >
        {String(territory.armies)}
      </Text>

      {/* Territory name — always visible, below the piece */}
      <Text
        position={[0, 0.02, -0.85]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.22}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000"
        fillOpacity={hovered ? 1 : 0.9}
      >
        {territory.name}
      </Text>
    </group>
  );
}

// ============================================================================
// CONNECTION LINES between neighboring territories
// ============================================================================

function ConnectionLines({ gameState }: { gameState: GameState }) {
  const lines = useMemo(() => {
    const result: { from: [number, number, number]; to: [number, number, number]; sameOwner: boolean }[] = [];
    gameState.territories.forEach(t => {
      t.neighbors.forEach(nid => {
        if (t.id > nid) return;
        const n = gameState.territories.find(x => x.id === nid);
        if (!n) return;
        if (Math.abs(t.position.x - n.position.x) > 400) return; // Skip wrap-around
        result.push({
          from: toBoard(t.position.x, t.position.y),
          to: toBoard(n.position.x, n.position.y),
          sameOwner: t.ownerId === n.ownerId && t.ownerId !== null,
        });
      });
    });
    return result;
  }, [gameState.territories]);

  return (
    <group>
      {lines.map((l, i) => {
        const pts = [new THREE.Vector3(l.from[0], 0.08, l.from[2]), new THREE.Vector3(l.to[0], 0.08, l.to[2])];
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        return (
          <primitive key={i} object={(() => {
            const mat = new THREE.LineBasicMaterial({ color: l.sameOwner ? '#6EE7B7' : '#374151', transparent: true, opacity: l.sameOwner ? 0.5 : 0.2 });
            return new THREE.Line(geo, mat);
          })()} />
        );
      })}
    </group>
  );
}

// ============================================================================
// CONTINENT NAME LABELS floating above the board
// ============================================================================

function ContinentLabels({ gameState }: { gameState: GameState }) {
  return (
    <group>
      {CONTINENTS.map(c => {
        const ts = gameState.territories.filter(t => t.continent === c.id);
        if (!ts.length) return null;
        const ax = ts.reduce((s, t) => s + t.position.x, 0) / ts.length;
        const ay = ts.reduce((s, t) => s + t.position.y, 0) / ts.length;
        const p = toBoard(ax, ay);
        return (
          <Text key={c.id} position={[p[0], 0.25, p[2] - 2.2]} rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.55} color={CONTINENT_LABEL_COLORS[c.id] || '#fff'}
            anchorX="center" anchorY="middle" fillOpacity={0.8}
            outlineWidth={0.04} outlineColor="#000"
          >
            {c.name} (+{c.bonus})
          </Text>
        );
      })}
    </group>
  );
}

// ============================================================================
// BOARD CONTENT — the full 3D scene
// ============================================================================

interface BoardContentProps {
  gameState: GameState;
  selectedTerritory: string | null;
  onTerritoryClick: (territoryId: string) => void;
}

function BoardContent({ gameState, selectedTerritory, onTerritoryClick }: BoardContentProps) {
  const getPlayerColor = (pid: string | null) => {
    if (!pid) return '#666666';
    return gameState.players.find(p => p.id === pid)?.color || '#666666';
  };

  return (
    <>
      {/* Warm directional lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 18, 8]} intensity={0.85} castShadow shadow-mapSize={[2048, 2048]} color="#FFF8E8" />
      <directionalLight position={[-8, 12, -5]} intensity={0.2} color="#B0C4DE" />

      {/* Camera — top-down angled view like looking at a board game */}
      <PerspectiveCamera makeDefault position={[0, 28, 12]} fov={45} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={10} maxDistance={50} maxPolarAngle={Math.PI / 2.3} minPolarAngle={0.1} />

      <color attach="background" args={['#12151C']} />
      <fog attach="fog" args={['#12151C', 35, 60]} />

      {/* === WAR ROOM TABLE === */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[56, 0.3, 38]} />
        <meshStandardMaterial color="#3B2314" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Board surface — printed map (flat) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[52, 34]} />
        <meshStandardMaterial color="#14283C" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Ocean grid lines for map feel */}
      <gridHelper args={[52, 26, '#1E3A5A', '#1E3A5A']} position={[0, 0.03, 0]} />

      {/* Brass table edge trim */}
      {[[-26.1, 0, 0], [26.1, 0, 0]].map(([x, , z], i) => (
        <mesh key={`ev${i}`} position={[x, 0, z]}>
          <boxGeometry args={[0.2, 0.25, 34.4]} />
          <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.65} />
        </mesh>
      ))}
      {[[0, 0, -17.1], [0, 0, 17.1]].map(([x, , z], i) => (
        <mesh key={`eh${i}`} position={[x, 0, z]}>
          <boxGeometry args={[52.4, 0.25, 0.2]} />
          <meshStandardMaterial color="#B8860B" roughness={0.3} metalness={0.65} />
        </mesh>
      ))}

      {/* Connection lines between territories */}
      <ConnectionLines gameState={gameState} />

      {/* Continent labels */}
      <ContinentLabels gameState={gameState} />

      {/* Territory game pieces */}
      {gameState.territories.map(territory => (
        <TerritoryPiece
          key={territory.id}
          territory={territory}
          playerColor={getPlayerColor(territory.ownerId)}
          continentColor={CONTINENT_BG_COLORS[territory.continent] || '#666'}
          isSelected={selectedTerritory === territory.id}
          isAttackSource={gameState.attackingFrom === territory.id}
          isAttackTarget={gameState.attackingTo === territory.id}
          onClick={() => onTerritoryClick(territory.id)}
        />
      ))}
    </>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

interface RiskBoard3DProps {
  gameState: GameState;
  selectedTerritory: string | null;
  onTerritoryClick: (territoryId: string) => void;
}

export default function RiskBoard3D({ gameState, selectedTerritory, onTerritoryClick }: RiskBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <BoardContent
            gameState={gameState}
            selectedTerritory={selectedTerritory}
            onTerritoryClick={onTerritoryClick}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
