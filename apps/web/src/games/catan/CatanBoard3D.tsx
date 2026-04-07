/**
 * TableForge — Catan 3D Board  (AAA visual rewrite)
 * Cinematic PBR materials · dramatic shadow lighting · ACES tone mapping
 * Multi-layer terrain decorations · harbour ports · animated ocean
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  type GameState,
  type HexTile,
  type Vertex,
} from './CatanEngine';

// ============================================================================
// TERRAIN MATERIALS — PBR-style colors per terrain type
// ============================================================================

// PBR terrain materials — vivid physical board colours + emissive depth
const TERRAIN_MATS: Record<string, { base: string; top: string; emissive: string; height: number }> = {
  forest:    { base: '#1A5C1A', top: '#226622', emissive: '#061806', height: 0.14 },
  hills:     { base: '#A83818', top: '#C04820', emissive: '#3A0E06', height: 0.22 },
  pasture:   { base: '#4EA030', top: '#62B840', emissive: '#122C08', height: 0.08 },
  fields:    { base: '#D4980A', top: '#ECB010', emissive: '#483200', height: 0.07 },
  mountains: { base: '#505C64', top: '#687480', emissive: '#0C1418', height: 0.36 },
  desert:    { base: '#C8A040', top: '#DDB855', emissive: '#362C0C', height: 0.05 },
};

const HEX_SIZE = 1.28;
const HEX_GAP = 0.025;

// Standard Catan harbour definitions — 9 ports, positioned between adjacent border hexes
const HARBOR_DEFS = [
  { hexA: {q:0,  r:-2}, hexB: {q:1,  r:-2}, type: '3:1',   label: '3:1'       },
  { hexA: {q:1,  r:-2}, hexB: {q:2,  r:-2}, type: 'wood',  label: 'Wood\n2:1'  },
  { hexA: {q:2,  r:-2}, hexB: {q:2,  r:-1}, type: '3:1',   label: '3:1'       },
  { hexA: {q:2,  r:-1}, hexB: {q:2,  r:0 }, type: 'ore',   label: 'Ore\n2:1'  },
  { hexA: {q:2,  r:0 }, hexB: {q:1,  r:1 }, type: 'wheat', label: 'Wheat\n2:1'},
  { hexA: {q:0,  r:2 }, hexB: {q:-1, r:2 }, type: '3:1',   label: '3:1'       },
  { hexA: {q:-1, r:2 }, hexB: {q:-2, r:2 }, type: 'brick', label: 'Brick\n2:1'},
  { hexA: {q:-2, r:1 }, hexB: {q:-2, r:0 }, type: 'sheep', label: 'Sheep\n2:1'},
  { hexA: {q:-2, r:0 }, hexB: {q:-1, r:-1}, type: '3:1',   label: '3:1'       },
] as const;

const HARBOR_COLORS: Record<string, string> = {
  '3:1':   '#C8960A',
  'wood':  '#2E7D32',
  'brick': '#C0360C',
  'sheep': '#4C8A28',
  'wheat': '#D49808',
  'ore':   '#485E6A',
};

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

  const hexShape  = useMemo(() => createHexShape(HEX_SIZE), []);
  const seam      = useMemo(() => createHexShape(HEX_SIZE * 1.018), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  }), [mat.height]);
  const seamSettings = useMemo(() => ({
    depth: mat.height + 0.01,
    bevelEnabled: false,
  }), [mat.height]);

  return (
    <group position={[pos[0], 0, pos[2]]}>
      {/* Dark seam border — renders behind body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} receiveShadow>
        <extrudeGeometry args={[seam, seamSettings]} />
        <meshStandardMaterial color="#100C06" roughness={1} />
      </mesh>

      {/* Hex body */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => onHexClick?.(hex.id)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow receiveShadow
      >
        <extrudeGeometry args={[hexShape, extrudeSettings]} />
        <meshStandardMaterial
          color={mat.base}
          roughness={0.88}
          metalness={0.02}
          emissive={hovered ? '#442200' : mat.emissive}
          emissiveIntensity={hovered ? 0.5 : 0.35}
        />
      </mesh>

      {/* Top surface — slightly lighter + emissive */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.003, 0]} receiveShadow>
        <shapeGeometry args={[hexShape]} />
        <meshStandardMaterial color={mat.top} roughness={0.92} emissive={mat.emissive} emissiveIntensity={0.18} />
      </mesh>

      {/* Terrain decoration — small features per type */}
      <TerrainDecoration terrain={hex.terrain} height={mat.height} />

      {/* Number token */}
      {hex.number && !hex.hasRobber && (() => {
        const hot = hex.number === 6 || hex.number === 8;
        return (
          <group position={[0, mat.height + 0.12, 0]}>
            {/* Drop shadow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
              <circleGeometry args={[0.50, 32]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.30} />
            </mesh>
            {/* Disc body */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.44, 0.46, 0.08, 32]} />
              <meshStandardMaterial
                color="#F0DCA8"
                roughness={0.52}
                metalness={0.0}
                emissive="#3C2400"
                emissiveIntensity={0.22}
              />
            </mesh>
            {/* Carved rim */}
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.445, 0.026, 8, 32]} />
              <meshStandardMaterial color="#5C3A14" roughness={0.72} />
            </mesh>
            {/* Number */}
            <Text
              position={[0, 0.09, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.36}
              color={hot ? '#C41818' : '#2A1604'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.020}
              outlineColor={hot ? '#6A0000' : '#4A2C08'}
            >
              {String(hex.number)}
            </Text>
            {/* Probability dots */}
            <Text
              position={[0, 0.09, 0.25]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.080}
              color={hot ? '#C41818' : '#7A5830'}
              anchorX="center"
              anchorY="middle"
            >
              {'●'.repeat(getProbDots(hex.number))}
            </Text>
          </group>
        );
      })()}

      {/* Robber */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.04, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.30, 6, 12]} />
            <meshStandardMaterial color="#0E0E0E" roughness={0.45} metalness={0.45} emissive="#1A0000" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#0E0E0E" roughness={0.45} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <coneGeometry args={[0.14, 0.14, 8]} />
            <meshStandardMaterial color="#1A0000" roughness={0.6} />
          </mesh>
          {([-0.055, 0.055] as number[]).map((ox, i) => (
            <mesh key={i} position={[ox, 0.565, 0.11]}>
              <sphereGeometry args={[0.028, 8, 8]} />
              <meshBasicMaterial color="#FF1800" />
            </mesh>
          ))}
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
  const y = height + 0.02;

  switch (terrain) {
    case 'forest': {
      const trees: [number, number, number][] = [
        [-0.64, 0.22, 1.00], [0.60, -0.30, 1.15], [-0.24, -0.66, 0.90],
        [0.66, 0.34, 1.10], [-0.52, -0.50, 0.95], [0.08, 0.64, 1.05],
      ];
      return (
        <group position={[0, y, 0]}>
          {trees.map(([x, z, sc], i) => (
            <group key={i} position={[x, 0, z]} scale={[sc, sc, sc]}>
              <mesh position={[0, 0.07, 0]} castShadow>
                <cylinderGeometry args={[0.055, 0.075, 0.14, 6]} />
                <meshStandardMaterial color="#3B1E08" roughness={0.95} />
              </mesh>
              <mesh position={[0, 0.26, 0]} castShadow>
                <coneGeometry args={[0.24, 0.38, 7]} />
                <meshStandardMaterial color="#164E16" roughness={0.82} emissive="#041204" emissiveIntensity={0.35} />
              </mesh>
              <mesh position={[0, 0.50, 0]} castShadow>
                <coneGeometry args={[0.18, 0.32, 7]} />
                <meshStandardMaterial color="#1E6C1E" roughness={0.80} emissive="#051405" emissiveIntensity={0.35} />
              </mesh>
              <mesh position={[0, 0.70, 0]} castShadow>
                <coneGeometry args={[0.11, 0.24, 7]} />
                <meshStandardMaterial color="#268426" roughness={0.78} emissive="#062006" emissiveIntensity={0.35} />
              </mesh>
            </group>
          ))}
        </group>
      );
    }
    case 'mountains': {
      const peaks: [number, number, number][] = [
        [-0.52, -0.18, 0.90], [0.48, -0.26, 1.10],
        [0.05, 0.56, 1.25],   [-0.16, 0.24, 0.70],
      ];
      return (
        <group position={[0, y, 0]}>
          {peaks.map(([x, z, sc], i) => (
            <group key={i} scale={[sc, sc, sc]}>
              <mesh position={[x, 0.10, z]} castShadow>
                <coneGeometry args={[0.26, 0.58, 6]} />
                <meshStandardMaterial color="#6A7880" roughness={0.90} metalness={0.06} emissive="#0C1418" emissiveIntensity={0.32} />
              </mesh>
              <mesh position={[x, 0.34, z]}>
                <coneGeometry args={[0.10, 0.18, 6]} />
                <meshStandardMaterial color="#ECF0F4" roughness={0.38} emissive="#B0C4D8" emissiveIntensity={0.18} />
              </mesh>
            </group>
          ))}
        </group>
      );
    }
    case 'hills':
      return (
        <group position={[0, y, 0]}>
          {/* Brick kiln */}
          <mesh position={[0.52, 0.07, 0.08]} castShadow>
            <boxGeometry args={[0.24, 0.20, 0.18]} />
            <meshStandardMaterial color="#7A4E1A" roughness={0.80} emissive="#1C0800" emissiveIntensity={0.28} />
          </mesh>
          <mesh position={[0.52, 0.22, 0.08]} castShadow>
            <cylinderGeometry args={[0.046, 0.056, 0.16, 6]} />
            <meshStandardMaterial color="#4A2A0C" roughness={0.86} />
          </mesh>
          {[[-0.54, 0.38], [0.12, -0.58], [-0.18, 0.62]].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.056, z]} castShadow>
              <sphereGeometry args={[0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#A03418" roughness={0.88} emissive="#280A04" emissiveIntensity={0.28} />
            </mesh>
          ))}
        </group>
      );
    case 'pasture':
      return (
        <group position={[0, y, 0]}>
          {[[-0.62, 0.24], [0.52, -0.34], [0.30, 0.58], [-0.26, -0.60]].map(([x, z], i) => (
            <group key={i} position={[x, 0, z]}>
              <mesh position={[0, 0.062, 0]} castShadow>
                <sphereGeometry args={[0.076, 9, 9]} />
                <meshStandardMaterial color="#EEEEEE" roughness={0.90} emissive="#202020" emissiveIntensity={0.08} />
              </mesh>
              <mesh position={[0.062, 0.096, 0.026]}>
                <sphereGeometry args={[0.040, 8, 8]} />
                <meshStandardMaterial color="#D8D8D8" roughness={0.88} />
              </mesh>
              <mesh position={[0.090, 0.105, 0.060]}>
                <sphereGeometry args={[0.012, 6, 6]} />
                <meshBasicMaterial color="#111111" />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.026, -0.62]} castShadow>
            <boxGeometry args={[0.88, 0.05, 0.05]} />
            <meshStandardMaterial color="#888888" roughness={0.92} />
          </mesh>
          <mesh position={[-0.44, 0.026, -0.62]}>
            <cylinderGeometry args={[0.024, 0.028, 0.22, 5]} />
            <meshStandardMaterial color="#666666" roughness={0.9} />
          </mesh>
          <mesh position={[0.44, 0.026, -0.62]}>
            <cylinderGeometry args={[0.024, 0.028, 0.22, 5]} />
            <meshStandardMaterial color="#666666" roughness={0.9} />
          </mesh>
        </group>
      );
    case 'fields':
      return (
        <group position={[0, y, 0]}>
          {Array.from({ length: 22 }, (_, i) => {
            const angle = (i / 22) * Math.PI * 2;
            const r     = 0.50 + (i % 4) * 0.10;
            const h     = 0.15 + (i % 3) * 0.04;
            return (
              <group key={i} position={[Math.cos(angle) * r, 0, Math.sin(angle) * r]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.009, 0.014, h, 4]} />
                  <meshStandardMaterial color="#B88208" roughness={0.88} emissive="#3A2200" emissiveIntensity={0.32} />
                </mesh>
                <mesh position={[0, h / 2 + 0.046, 0]} castShadow>
                  <boxGeometry args={[0.028, 0.065, 0.014]} />
                  <meshStandardMaterial color="#D4A000" roughness={0.80} emissive="#4A2E00" emissiveIntensity={0.38} />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    case 'desert':
      return (
        <group position={[0, y, 0]}>
          {[[0.56, 0.08, 0.18], [-0.46, 0.42, 0.14], [0.18, -0.58, 0.20]].map(([x, z, r], i) => (
            <mesh key={i} position={[x, 0.045, z]} castShadow>
              <sphereGeometry args={[r, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#C8A030" roughness={0.96} emissive="#301C00" emissiveIntensity={0.22} />
            </mesh>
          ))}
          {/* Main cactus stem */}
          <mesh position={[-0.54, 0.13, -0.08]} castShadow>
            <cylinderGeometry args={[0.028, 0.036, 0.26, 7]} />
            <meshStandardMaterial color="#2A6838" roughness={0.74} emissive="#061408" emissiveIntensity={0.30} />
          </mesh>
          <mesh position={[-0.54, 0.28, -0.08]}>
            <sphereGeometry args={[0.052, 8, 8]} />
            <meshStandardMaterial color="#2A6838" roughness={0.74} emissive="#061408" emissiveIntensity={0.30} />
          </mesh>
          {/* Left arm */}
          <mesh position={[-0.64, 0.20, -0.08]} rotation={[0, 0, 1.1]} castShadow>
            <cylinderGeometry args={[0.020, 0.026, 0.14, 6]} />
            <meshStandardMaterial color="#2A6838" roughness={0.74} />
          </mesh>
          {/* Right arm */}
          <mesh position={[-0.44, 0.22, -0.08]} rotation={[0, 0, -1.3]} castShadow>
            <cylinderGeometry args={[0.018, 0.024, 0.12, 6]} />
            <meshStandardMaterial color="#2A6838" roughness={0.74} />
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
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.20, 0.28, 0.17]} />
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.22} />
        </mesh>
        <mesh position={[0.09, 0.27, 0]} castShadow>
          <boxGeometry args={[0.10, 0.16, 0.10]} />
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.26} />
        </mesh>
        <mesh position={[0, 0.33, 0]} castShadow>
          <coneGeometry args={[0.16, 0.13, 4]} />
          <meshStandardMaterial color="#3E2208" roughness={0.82} />
        </mesh>
        <mesh position={[0.09, 0.38, 0]} castShadow>
          <coneGeometry args={[0.08, 0.09, 4]} />
          <meshStandardMaterial color="#3E2208" roughness={0.82} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={position}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.12, 0.10, 4]} />
        <meshStandardMaterial color="#4A2C10" roughness={0.84} />
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
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const t = clock.elapsedTime * 0.10;
    mat.color.setRGB(
      0.04 + Math.sin(t)        * 0.012,
      0.20 + Math.sin(t + 1.3)  * 0.022,
      0.62 + Math.sin(t + 2.6)  * 0.032,
    );
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[12, 72]} />
      <meshStandardMaterial color="#1565C0" roughness={0.14} metalness={0.14} />
    </mesh>
  );
}

// ============================================================================
// HARBORS — Port indicators on the ocean border
// ============================================================================

function Harbors() {
  return (
    <>
      {HARBOR_DEFS.map((harbor, i) => {
        const posA = hexToWorld(harbor.hexA.q, harbor.hexA.r);
        const posB = hexToWorld(harbor.hexB.q, harbor.hexB.r);
        const midX = (posA[0] + posB[0]) / 2;
        const midZ = (posA[2] + posB[2]) / 2;
        const len = Math.sqrt(midX * midX + midZ * midZ);
        const nx = len > 0 ? midX / len : 0;
        const nz = len > 0 ? midZ / len : 0;
        // Push outward from board centre into ocean
        const px = midX + nx * 1.6;
        const pz = midZ + nz * 1.6;
        const color = HARBOR_COLORS[harbor.type];
        // Pier angle: box default extends along X, rotate to align with inward direction
        const pierAngle = -Math.atan2(nz, nx);

        return (
          <group key={i} position={[px, 0.07, pz]}>
            {/* Platform */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.56, 0.56, 0.06, 28]} />
              <meshStandardMaterial color={color} roughness={0.58} metalness={0.10} emissive={color} emissiveIntensity={0.18} />
            </mesh>
            {/* Outer black ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.56, 0.038, 8, 28]} />
              <meshStandardMaterial color="#0A0A0A" roughness={0.9} />
            </mesh>
            {/* Inner white ring accent */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
              <ringGeometry args={[0.46, 0.50, 28]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.28} side={THREE.DoubleSide} />
            </mesh>
            {/* Label — large, bold, readable */}
            <Text
              position={[0, 0.075, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.022}
              outlineColor="#000000"
            >
              {harbor.label}
            </Text>
            {/* Pier plank */}
            <mesh position={[-nx * 0.90, -0.01, -nz * 0.90]} rotation={[0, pierAngle, 0]} castShadow>
              <boxGeometry args={[0.13, 0.055, 1.80]} />
              <meshStandardMaterial color="#5A3618" roughness={0.92} />
            </mesh>
            {/* Pier rail */}
            <mesh position={[-nx * 0.90, 0.010, -nz * 0.90 - 0.05]} rotation={[0, pierAngle, 0]}>
              <boxGeometry args={[0.09, 0.014, 1.70]} />
              <meshStandardMaterial color="#7A4E28" roughness={0.88} />
            </mesh>
          </group>
        );
      })}
    </>
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
      {/* === CINEMATIC LIGHTING RIG === */}
      {/* Soft warm ambient */}
      <ambientLight intensity={0.40} color="#DDD4C0" />
      {/* Key light — warm, hard shadows, high position */}
      <directionalLight
        position={[10, 20, 8]}
        intensity={1.6}
        color="#FFF4E0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={50}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      {/* Cool fill from opposite side */}
      <directionalLight position={[-9, 13, -7]} intensity={0.38} color="#C0D0EC" />
      {/* Rim / back light */}
      <directionalLight position={[0, 5, -16]} intensity={0.22} color="#D0C8FF" />
      {/* Warm centre point glow */}
      <pointLight position={[0, 9, 0]} intensity={0.55} color="#FFE8A0" distance={22} decay={2} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 16, 6]} fov={43} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={6} maxDistance={26} maxPolarAngle={Math.PI / 2.3} minPolarAngle={0.16} />

      {/* Background */}
      <color attach="background" args={['#07101E']} />
      <fog attach="fog" args={['#07101E', 20, 38]} />

      {/* Walnut table surface */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <cylinderGeometry args={[16, 16, 0.36, 72]} />
        <meshStandardMaterial
          color="#1E1008"
          roughness={0.86}
          metalness={0.06}
          emissive="#0C0600"
          emissiveIntensity={0.20}
        />
      </mesh>

      {/* Ocean */}
      <Ocean />

      {/* Harbour port indicators */}
      <Harbors />

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
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        dpr={[1, 2]}
      >
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
