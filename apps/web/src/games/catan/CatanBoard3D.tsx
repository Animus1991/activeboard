/**
 * TableForge — Catan 3D Board
 * Premium 3D hex board with terrain-specific PBR materials,
 * 3D settlements/cities/roads, orbital camera, lighting
 */

import { useRef, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import {
  type GameState,
  type HexTile,
  type Vertex,
  type Edge,
  TERRAIN_RESOURCES,
} from './CatanEngine';

// ============================================================================
// TERRAIN MATERIALS — PBR-style colors per terrain type
// ============================================================================

// Colors matched to REAL physical Catan board (bright, saturated, vivid)
const TERRAIN_MATS: Record<string, { base: string; top: string; accent: string; height: number }> = {
  forest:    { base: '#2D8C2D', top: '#3DA83D', accent: '#4EC04E', height: 0.12 },  // Vivid green
  hills:     { base: '#C4602A', top: '#D47030', accent: '#E08040', height: 0.18 },  // Warm terracotta/brick
  pasture:   { base: '#6DBB45', top: '#85D060', accent: '#9AE075', height: 0.06 },  // Light bright green
  fields:    { base: '#E8B820', top: '#F0C830', accent: '#F8D840', height: 0.05 },  // Golden yellow
  mountains: { base: '#7A8A7A', top: '#909E90', accent: '#A0B0A0', height: 0.30 },  // Grey-green mountain
  desert:    { base: '#E0C070', top: '#ECD088', accent: '#F0D898', height: 0.03 },  // Sandy beige
};

// Hex layout — larger tiles, tighter spacing like real board
const HEX_SIZE = 1.25;
const HEX_GAP = 0.02;

// Convert axial (q,r) to 3D position
function hexToWorld(q: number, r: number): [number, number, number] {
  const x = HEX_SIZE * (3 / 2 * q) * (1 + HEX_GAP);
  const z = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) * (1 + HEX_GAP);
  return [x, 0, z];
}

// Create hex shape
function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// ============================================================================
// HEX TILE — 3D terrain tile
// ============================================================================

interface HexTile3DProps {
  hex: HexTile;
  onHexClick?: (hexId: number) => void;
}

function HexTile3D({ hex, onHexClick }: HexTile3DProps) {
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => hexToWorld(hex.position.q, hex.position.r), [hex.position]);
  const mat = TERRAIN_MATS[hex.terrain] || TERRAIN_MATS.desert;

  const hexShape = useMemo(() => createHexShape(HEX_SIZE), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.03,
    bevelSegments: 2,
  }), [mat.height]);

  return (
    <group position={[pos[0], 0, pos[2]]}>
      {/* Hex base — extruded terrain */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        onClick={() => onHexClick?.(hex.id)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <extrudeGeometry args={[hexShape, extrudeSettings]} />
        <meshStandardMaterial
          color={mat.base}
          roughness={0.85}
          metalness={0.02}
          emissive={hovered ? '#333' : '#000'}
          emissiveIntensity={hovered ? 0.2 : 0}
        />
      </mesh>

      {/* Top surface — slightly lighter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.005, 0]}>
        <shapeGeometry args={[hexShape]} />
        <meshStandardMaterial color={mat.top} roughness={0.9} />
      </mesh>

      {/* Terrain decoration — small features per type */}
      <TerrainDecoration terrain={hex.terrain} height={mat.height} />

      {/* Number token — large, prominent, matching real Catan */}
      {hex.number && !hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          {/* Token disc — cream colored, prominent */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.06, 32]} />
            <meshStandardMaterial
              color="#F5E6C8"
              roughness={0.5}
              metalness={0.02}
            />
          </mesh>
          {/* Token rim — darker edge */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42, 0.015, 8, 32]} />
            <meshStandardMaterial color="#8B7355" roughness={0.6} />
          </mesh>
          {/* Number — large and bold */}
          <Text
            position={[0, 0.06, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.30}
            color={hex.number === 6 || hex.number === 8 ? '#C62828' : '#2E1A08'}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor={hex.number === 6 || hex.number === 8 ? '#8B0000' : '#5D4037'}
          >
            {String(hex.number)}
          </Text>
          {/* Probability dots — larger */}
          <Text
            position={[0, 0.06, 0.22]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.07}
            color={hex.number === 6 || hex.number === 8 ? '#C62828' : '#6D4C41'}
            anchorX="center"
            anchorY="middle"
          >
            {'●'.repeat(getProbDots(hex.number))}
          </Text>
        </group>
      )}

      {/* Robber */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          {/* Robber body */}
          <mesh position={[0, 0.2, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.25, 4, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Robber head */}
          <mesh position={[0, 0.48, 0]} castShadow>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.3} />
          </mesh>
          {/* Red eyes glow */}
          <mesh position={[0.04, 0.48, 0.08]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#FF0000" />
          </mesh>
          <mesh position={[-0.04, 0.48, 0.08]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshBasicMaterial color="#FF0000" />
          </mesh>
        </group>
      )}
    </group>
  );
}

function getProbDots(n: number): number {
  const dots: Record<number, number> = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 };
  return dots[n] || 0;
}

// ============================================================================
// TERRAIN DECORATION — Small 3D features per terrain type
// ============================================================================

function TerrainDecoration({ terrain, height }: { terrain: string; height: number }) {
  const y = height + 0.01;

  switch (terrain) {
    case 'forest':
      return (
        <group position={[0, y, 0]}>
          {/* Trees */}
          {[[-0.3, 0.2], [0.25, -0.15], [0, 0.35], [-0.2, -0.3], [0.35, 0.25]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.12, 0]} castShadow>
                <coneGeometry args={[0.08, 0.25, 6]} />
                <meshStandardMaterial color="#1B5E20" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.025, 0.08, 4]} />
                <meshStandardMaterial color="#4E342E" roughness={0.9} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'mountains':
      return (
        <group position={[0, y, 0]}>
          {/* Mountain peaks */}
          {[[-0.15, 0], [0.2, 0.1], [0, -0.2]].map(([x, z], i) => (
            <group key={i}>
              <mesh position={[x, 0.15, z]} castShadow>
                <coneGeometry args={[0.18, 0.35, 5]} />
                <meshStandardMaterial color="#546E7A" roughness={0.9} />
              </mesh>
              {/* Snow cap */}
              <mesh position={[x, 0.3, z]}>
                <coneGeometry args={[0.08, 0.1, 5]} />
                <meshStandardMaterial color="#ECEFF1" roughness={0.5} />
              </mesh>
            </group>
          ))}
        </group>
      );
    case 'hills':
      return (
        <group position={[0, y, 0]}>
          {/* Brick kiln */}
          <mesh position={[0, 0.06, 0]} castShadow>
            <boxGeometry args={[0.15, 0.12, 0.1]} />
            <meshStandardMaterial color="#8D6E37" roughness={0.8} />
          </mesh>
          {/* Small hills */}
          {[[0.3, 0.1], [-0.25, -0.2]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.04, z]} castShadow>
              <sphereGeometry args={[0.12, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#A0522D" roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case 'pasture':
      return (
        <group position={[0, y, 0]}>
          {/* Sheep (simplified) */}
          {[[-0.2, 0.15], [0.15, -0.1], [0.3, 0.25]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.04, 0]} castShadow>
                <sphereGeometry args={[0.05, 6, 6]} />
                <meshStandardMaterial color="#F5F5F5" roughness={0.9} />
              </mesh>
              <mesh position={[0.03, 0.06, 0]}>
                <sphereGeometry args={[0.025, 6, 6]} />
                <meshStandardMaterial color="#212121" roughness={0.8} />
              </mesh>
            </group>
          ))}
          {/* Stone fence */}
          <mesh position={[0, 0.02, -0.35]} castShadow>
            <boxGeometry args={[0.6, 0.04, 0.03]} />
            <meshStandardMaterial color="#9E9E9E" roughness={0.9} />
          </mesh>
        </group>
      );
    case 'fields':
      return (
        <group position={[0, y, 0]}>
          {/* Wheat stalks (simplified as thin cones) */}
          {Array.from({ length: 12 }, (_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const r = 0.25 + (i % 3) * 0.1;
            return (
              <mesh key={i} position={[Math.cos(angle) * r, 0.05, Math.sin(angle) * r]} castShadow>
                <cylinderGeometry args={[0.005, 0.01, 0.12, 3]} />
                <meshStandardMaterial color="#F9A825" roughness={0.9} />
              </mesh>
            );
          })}
        </group>
      );
    case 'desert':
      return (
        <group position={[0, y, 0]}>
          {/* Sand dune */}
          <mesh position={[0.2, 0.03, 0]} castShadow>
            <sphereGeometry args={[0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#E8C878" roughness={0.95} />
          </mesh>
          {/* Cactus */}
          <mesh position={[-0.2, 0.08, 0.1]} castShadow>
            <cylinderGeometry args={[0.02, 0.025, 0.16, 6]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.8} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

// ============================================================================
// BUILDING — 3D settlement or city on a vertex
// ============================================================================

interface Building3DProps {
  position: [number, number, number];
  type: 'settlement' | 'city';
  color: string;
}

function Building3D({ position, type, color }: Building3DProps) {
  if (type === 'city') {
    return (
      <group position={position}>
        {/* City — larger stone building with tower */}
        <mesh position={[0, 0.12, 0]} castShadow>
          <boxGeometry args={[0.18, 0.24, 0.15]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
        </mesh>
        {/* Tower */}
        <mesh position={[0.06, 0.22, 0]} castShadow>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
          <meshStandardMaterial color={color} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Roof */}
        <mesh position={[0, 0.28, 0]} castShadow>
          <coneGeometry args={[0.14, 0.1, 4]} />
          <meshStandardMaterial color="#5D4037" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={position}>
      {/* Settlement — small cottage */}
      <mesh position={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[0.12, 0.16, 0.1]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 0.19, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.1, 0.08, 4]} />
        <meshStandardMaterial color="#795548" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ============================================================================
// ROAD — 3D road between two vertices
// ============================================================================

interface Road3DProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

function Road3D({ from, to, color }: Road3DProps) {
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.max(from[1], to[1]) + 0.02;
  const midZ = (from[2] + to[2]) / 2;
  const length = Math.sqrt((to[0] - from[0]) ** 2 + (to[2] - from[2]) ** 2);
  const angle = Math.atan2(to[2] - from[2], to[0] - from[0]);

  return (
    <mesh position={[midX, midY, midZ]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[length, 0.04, 0.06]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
    </mesh>
  );
}

// ============================================================================
// VERTEX HELPERS
// ============================================================================

function getVertexWorldPos(vertex: Vertex, hexTiles: HexTile[]): [number, number, number] | null {
  const centers = vertex.hexIds
    .map(id => hexTiles.find(h => h.id === id))
    .filter(Boolean)
    .map(h => hexToWorld(h!.position.q, h!.position.r));
  if (centers.length === 0) return null;
  const x = centers.reduce((s, c) => s + c[0], 0) / centers.length;
  const z = centers.reduce((s, c) => s + c[2], 0) / centers.length;
  return [x, 0.15, z];
}

// ============================================================================
// OCEAN — Animated water surrounding the board
// ============================================================================

function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      const t = state.clock.elapsedTime * 0.15;
      mat.color.setRGB(0.05 + Math.sin(t) * 0.02, 0.2 + Math.sin(t + 1) * 0.03, 0.6 + Math.sin(t + 2) * 0.04);
    }
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
      <circleGeometry args={[10, 48]} />
      <meshStandardMaterial color="#1976D2" roughness={0.2} metalness={0.08} />
    </mesh>
  );
}

// ============================================================================
// BOARD CONTENT — Full 3D scene
// ============================================================================

interface BoardContentProps {
  gameState: GameState;
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

function BoardContent({ gameState, onHexClick, onVertexClick, onEdgeClick }: BoardContentProps) {
  const getPlayerColor = (playerId: string): string => {
    return gameState.players.find(p => p.id === playerId)?.color || '#888';
  };

  return (
    <>
      {/* Lighting — bright and warm, like a well-lit table */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[8, 15, 6]} intensity={1.0} castShadow shadow-mapSize={[2048, 2048]} color="#FFFAF0" />
      <directionalLight position={[-5, 10, -4]} intensity={0.3} color="#E0E8F0" />
      <pointLight position={[0, 6, 0]} intensity={0.15} color="#FFFACD" />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 10, 7]} fov={50} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={5} maxDistance={20} maxPolarAngle={Math.PI / 2.2} minPolarAngle={0.2} />

      {/* Background */}
      <color attach="background" args={['#0A1628']} />
      <fog attach="fog" args={['#0A1628', 15, 30]} />

      {/* Table surface */}
      <mesh position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[14, 14, 0.3, 48]} />
        <meshStandardMaterial color="#3E2723" roughness={0.9} metalness={0.02} />
      </mesh>

      {/* Ocean */}
      <Ocean />

      {/* Hex tiles */}
      {gameState.hexTiles.map(hex => (
        <HexTile3D key={hex.id} hex={hex} onHexClick={onHexClick} />
      ))}

      {/* Roads */}
      {gameState.edges.filter(e => e.road).map(edge => {
        const v1 = gameState.vertices.find(v => v.id === edge.vertexIds[0]);
        const v2 = gameState.vertices.find(v => v.id === edge.vertexIds[1]);
        if (!v1 || !v2) return null;
        const p1 = getVertexWorldPos(v1, gameState.hexTiles);
        const p2 = getVertexWorldPos(v2, gameState.hexTiles);
        if (!p1 || !p2) return null;
        return <Road3D key={edge.id} from={p1} to={p2} color={getPlayerColor(edge.road!.playerId)} />;
      })}

      {/* Buildings */}
      {gameState.vertices.filter(v => v.building).map(vertex => {
        const pos = getVertexWorldPos(vertex, gameState.hexTiles);
        if (!pos) return null;
        return (
          <Building3D
            key={vertex.id}
            position={pos}
            type={vertex.building!.type}
            color={getPlayerColor(vertex.building!.playerId)}
          />
        );
      })}

      {/* Clickable vertices (when in build mode) */}
      {onVertexClick && gameState.vertices.filter(v => !v.building).map(vertex => {
        const pos = getVertexWorldPos(vertex, gameState.hexTiles);
        if (!pos) return null;
        return (
          <mesh
            key={`vclick-${vertex.id}`}
            position={pos}
            onClick={(e) => { e.stopPropagation(); onVertexClick(vertex.id); }}
          >
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        );
      })}

      {/* Clickable edges (when in build mode) */}
      {onEdgeClick && gameState.edges.filter(e => !e.road).map(edge => {
        const v1 = gameState.vertices.find(v => v.id === edge.vertexIds[0]);
        const v2 = gameState.vertices.find(v => v.id === edge.vertexIds[1]);
        if (!v1 || !v2) return null;
        const p1 = getVertexWorldPos(v1, gameState.hexTiles);
        const p2 = getVertexWorldPos(v2, gameState.hexTiles);
        if (!p1 || !p2) return null;
        const midX = (p1[0] + p2[0]) / 2;
        const midZ = (p1[2] + p2[2]) / 2;
        const length = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[2] - p1[2]) ** 2);
        const angle = Math.atan2(p2[2] - p1[2], p2[0] - p1[0]);
        return (
          <mesh
            key={`eclick-${edge.id}`}
            position={[midX, 0.12, midZ]}
            rotation={[0, -angle, 0]}
            onClick={(e) => { e.stopPropagation(); onEdgeClick(edge.id); }}
          >
            <boxGeometry args={[length, 0.06, 0.08]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

interface CatanBoard3DProps {
  gameState: GameState;
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export default function CatanBoard3D({ gameState, onHexClick, onVertexClick, onEdgeClick }: CatanBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <BoardContent
            gameState={gameState}
            onHexClick={onHexClick}
            onVertexClick={onVertexClick}
            onEdgeClick={onEdgeClick}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
