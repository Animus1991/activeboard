/**
 * TableForge — Catan 3D Board  (AAA visual rewrite)
 * Cinematic PBR materials · dramatic shadow lighting · ACES tone mapping
 * Multi-layer terrain decorations · harbour ports · animated ocean
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, ContactShadows, Billboard } from '@react-three/drei';
import { EffectComposer, SMAA } from '@react-three/postprocessing';
import { useKeyboardControls } from './CatanHUDFeatures';
import { XR, createXRStore } from '@react-three/xr';
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import {
  type GameState,
  type HexTile,
  type Vertex,
  TERRAIN_RESOURCES,
} from './CatanEngine';
import { CatanPresence3D, type Presence3DPlayer } from './CatanPresence3D';
import { ResourceFlow3D, type ResourceAnimation } from './CatanResourceFlow';

const xrStore = createXRStore({ hand: { teleportPointer: true } });

// ============================================================================
// TERRAIN MATERIALS — PBR-style colors per terrain type
// ============================================================================

// Storybook terrain materials — warm hand-painted matte gouache feel (Disney classics)
const TERRAIN_MATS: Record<string, { base: string; top: string; emissive: string; height: number; roughness: number; metalness: number }> = {
  forest:    { base: '#2E8B30', top: '#3CA03E', emissive: '#102E10', height: 0.12, roughness: 0.90, metalness: 0.0 },
  hills:     { base: '#C06030', top: '#D07840', emissive: '#2A1008', height: 0.18, roughness: 0.90, metalness: 0.0 },
  pasture:   { base: '#6BBF3A', top: '#7CD04A', emissive: '#142A08', height: 0.07, roughness: 0.92, metalness: 0.0 },
  fields:    { base: '#E8B830', top: '#F0C840', emissive: '#2A2008', height: 0.07, roughness: 0.90, metalness: 0.0 },
  mountains: { base: '#6A7E90', top: '#7E92A4', emissive: '#141C24', height: 0.25, roughness: 0.88, metalness: 0.0 },
  desert:    { base: '#DDB848', top: '#E8C860', emissive: '#2A2010', height: 0.05, roughness: 0.92, metalness: 0.0 },
};

const HEX_SIZE = 1.28;
const HEX_GAP = 0.04;

// ============================================================================
// SEA FRAME — ring-3 positions (all hex-neighbours of island boundary not on island)
// Computed as: all (q,r) adjacent to any island hex but not in HEX_POSITIONS
// ============================================================================
const SEA_FRAME_POSITIONS: { q: number; r: number }[] = [
  {q:-3,r:0},{q:-2,r:-1},{q:-1,r:-2},{q:0,r:-3},{q:1,r:-3},{q:2,r:-3},
  {q:3,r:-3},{q:3,r:-2},{q:3,r:-1},{q:3,r:0},{q:2,r:1},{q:1,r:2},
  {q:0,r:3},{q:-1,r:3},{q:-2,r:3},{q:-3,r:3},{q:-3,r:2},{q:-3,r:1},
];

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
  // Flat-Topped exact math
  const x = HEX_SIZE * (3 / 2) * q * (1 + HEX_GAP);
  const z = HEX_SIZE * Math.sqrt(3) * (r + q / 2) * (1 + HEX_GAP);
  return [x, 0, z];
}

// Create hex shape
function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Flat-topped starts at 0 degrees
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const z = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  }
  shape.closePath();
  return shape;
}

// ============================================================================
// 3D NUMBER TOKEN (Billboard with Flip Animation)
// ============================================================================

function AnimatedNumberToken3D({ hex, height }: { hex: HexTile; height: number }) {
  const hot = hex.number === 6 || hex.number === 8;
  const probDots = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 }[hex.number!] || 0;

  return (
    <group position={[0, height + 0.20, 0]}>
      {/* Floating soft shadow directly on the hex surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
        <circleGeometry args={[0.35, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      {/* Front Side (Number) statically facing camera via Billboard but no flip animation */}
      <Billboard follow={true}>
        <group>
          {/* Base disc */}
          <mesh>
            <circleGeometry args={[0.38, 32]} />
            <meshStandardMaterial color={hot ? '#FFF5E0' : '#FEFCF5'} roughness={0.5} side={THREE.FrontSide} />
          </mesh>
          {/* Border */}
          <mesh position={[0, 0, 0.005]}>
            <ringGeometry args={[0.34, 0.38, 32]} />
            <meshStandardMaterial color={hot ? '#C04040' : '#8A7A60'} side={THREE.FrontSide} />
          </mesh>
          {/* Number Text */}
          <Text
            position={[0, 0.06, 0.01]}
            fontSize={0.4}
            color={hot ? '#CC0000' : '#1A1A1A'}
            anchorX="center"
            anchorY="middle"
            fontWeight={hot ? 900 : 700}
          >
            {String(hex.number)}
          </Text>
          {/* Probability dots */}
          <Text
            position={[0, -0.16, 0.01]}
            fontSize={0.10}
            color={hot ? '#CC0000' : '#555555'}
            anchorX="center"
            anchorY="middle"
          >
            {'•'.repeat(probDots)}
          </Text>
        </group>
      </Billboard>
    </group>
  );
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
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  }), [mat.height]);

  // Wind effect and stone roughness removed for clarity

  return (
    <group position={[pos[0], 0, pos[2]]}>
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
          roughness={mat.roughness}
          metalness={mat.metalness}
          emissive={hovered ? '#4A3000' : mat.emissive}
          emissiveIntensity={hovered ? 0.5 : 0.15}
        />
      </mesh>

      {/* Top surface — elevated above extrude body to prevent z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.012, 0]} receiveShadow>
        <shapeGeometry args={[hexShape]} />
        <meshStandardMaterial
          color={mat.top}
          roughness={0.85}
          metalness={0.0}
          emissive={mat.emissive}
          emissiveIntensity={0.18}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* 3D Terrain props — trees, mountains, rocks etc. */}
      {TERRAIN_PROPS[hex.terrain] && (
        <group position={[0, mat.height + 0.01, 0]}>
          {(() => { const Comp = TERRAIN_PROPS[hex.terrain]; return <Comp />; })()}
        </group>
      )}

      {/* Number token — Billboard flip animation from letter to number */}
      {hex.number && !hex.hasRobber && (
        <AnimatedNumberToken3D hex={hex} height={mat.height} />
      )}

      {/* Robber — storybook dark wood figurine */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          {/* Warm shadow aura */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <meshBasicMaterial color="#1A0800" transparent opacity={0.28} />
          </mesh>
          {/* Broad base — dark walnut wood */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.20, 0.24, 0.08, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.94} metalness={0.0} />
          </mesh>
          {/* Body — tapered, matte painted */}
          <mesh position={[0, 0.26, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.32, 12, 20]} />
            <meshStandardMaterial color="#201410" roughness={0.96} metalness={0.0} emissive="#080404" emissiveIntensity={0.08} />
          </mesh>
          {/* Head — smooth sphere */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.11, 20, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.96} metalness={0.0} />
          </mesh>
          {/* Hood / pointed cap */}
          <mesh position={[0, 0.68, 0]} castShadow>
            <coneGeometry args={[0.10, 0.18, 16]} />
            <meshStandardMaterial color="#18080A" roughness={0.96} metalness={0.0} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ============================================================================
// 3D TERRAIN PROPS — volumetric decorations on hex surfaces
// ============================================================================

function ForestProps() {
  const trees = useMemo(() =>
    Array.from({ length: 12 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.65 + Math.random() * 0.35;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: (0.5 + Math.random() * 0.4) * 2.7,
        rotation: Math.random() * Math.PI,
      };
    }),
  []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale} rotation={[0, t.rotation, 0]}>
          {/* Smooth trunk — warm brown wood */}
          <mesh castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.014, 0.022, 0.22, 12]} />
            <meshStandardMaterial color="#4A2E14" roughness={0.96} />
          </mesh>
          {/* Smooth foliage layers — rounded, soft, hand-painted feel */}
          <mesh castShadow position={[0, 0.28, 0]}>
            <coneGeometry args={[0.14, 0.36, 16]} />
            <meshStandardMaterial color="#1E5814" roughness={0.96} />
          </mesh>
          <mesh castShadow position={[0, 0.38, 0]} scale={0.78}>
            <coneGeometry args={[0.11, 0.30, 16]} />
            <meshStandardMaterial color="#2C7820" roughness={0.96} />
          </mesh>
          <mesh castShadow position={[0, 0.46, 0]} scale={0.56}>
            <coneGeometry args={[0.09, 0.24, 16]} />
            <meshStandardMaterial color="#389428" roughness={0.96} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MountainProps() {
  const peaks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        s: (0.12 + Math.random() * 0.06) * 2.7,
        rot: [Math.random(), Math.random(), Math.random()] as [number, number, number]
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, p.s * 0.7, p.z]}>
          {/* Main mountain rock - low poly sphere */}
          <mesh scale={p.s} rotation={p.rot} castShadow receiveShadow>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#586878" roughness={0.9} flatShading />
          </mesh>
          {/* Snow cap - slightly smaller icosphere offset upwards */}
          {p.s > 0.12 && (
            <mesh position={[0, p.s * 0.65, 0]} scale={p.s * 0.65} rotation={p.rot}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading emissive="#DDDDDD" emissiveIntensity={0.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function HillsProps() {
  const bricks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 3,
        rot: [0, Math.random() * Math.PI, 0] as [number, number, number],
        col: ['#B85428', '#A04018', '#C86438'][Math.floor(Math.random() * 3)],
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {bricks.map((b, i) => (
        <mesh key={i} position={[b.x, 0.04 * b.scale, b.z]} scale={b.scale} rotation={b.rot} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
          <meshStandardMaterial color={b.col} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function FieldsProps() {
  const stalks = useMemo(() =>
    Array.from({ length: 240 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.60 + Math.random() * 0.40;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotX: (Math.random() - 0.5) * 0.3,
        rotZ: (Math.random() - 0.5) * 0.3,
        scaleY: (0.5 + Math.random() * 0.5) * 3,
        col: Math.random() > 0.4 ? '#E8B830' : '#F0C840',
      };
    }),
  []);
  return (
    <group>
      {stalks.map((s, i) => (
        <mesh key={i} position={[s.x, 0.08 * s.scaleY, s.z]} rotation={[s.rotX, 0, s.rotZ]} castShadow>
          <cylinderGeometry args={[0.005, 0.008, 0.16 * s.scaleY, 4]} />
          <meshStandardMaterial color={s.col} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function PastureProps() {
  const sheep = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rot: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {sheep.map((s, i) => (
        <group key={`sh${i}`} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]} scale={1.4 * 2.7}>
          {/* Body */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.04, 0]} castShadow>
            <capsuleGeometry args={[0.035, 0.05, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.97} flatShading />
          </mesh>
          {/* Head */}
          <mesh position={[0.05, 0.06, 0]} castShadow>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.9} flatShading />
          </mesh>
          {/* Legs */}
          {[-0.02, 0.02].map((lx, li) => 
            [-0.015, 0.015].map((lz, lji) => (
              <mesh key={`l${li}${lji}`} position={[lx, 0.02, lz]} castShadow>
                <cylinderGeometry args={[0.005, 0.005, 0.04, 4]} />
                <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}

function DesertProps() {
  return (
    <group>
      {/* Smooth sand dune mounds */}
      <mesh position={[0.7, 0.03 * 3, 0.4]} rotation={[0.08, 0.2, 0.08]} scale={3} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#E8C860" roughness={0.9} />
      </mesh>
      <mesh position={[-0.4, 0.02 * 3, -0.6]} rotation={[0.1, -0.2, 0.05]} scale={3} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#DDB848" roughness={0.9} />
      </mesh>
      <mesh position={[-0.6, 0.01 * 3, 0.3]} rotation={[0, 0.4, 0]} scale={3} castShadow>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#F0C840" roughness={0.9} />
      </mesh>
    </group>
  );
}

const TERRAIN_PROPS: Record<string, React.FC> = {
  forest: ForestProps,
  mountains: MountainProps,
  hills: HillsProps,
  fields: FieldsProps,
  pasture: PastureProps,
  desert: DesertProps,
};

// ============================================================================
// PROCEDURAL PBR TEXTURES
// ============================================================================

const _proceduralTextures: Record<string, THREE.CanvasTexture> = {};

function getProceduralTexture(type: 'wood' | 'stone' | 'weatheredWood'): THREE.CanvasTexture {
  if (_proceduralTextures[type]) return _proceduralTextures[type];
  
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let v = 255;
      
      if (type === 'wood') {
        const grain = Math.sin(x * 0.15 + Math.sin(y * 0.02) * 5) * 20 + Math.random() * 15;
        v = 150 + grain;
      } else if (type === 'weatheredWood') {
        const grain = Math.sin(x * 0.18 + Math.sin(y * 0.04) * 8) * 30 + Math.random() * 25;
        v = 110 + grain + (Math.random() > 0.98 ? -40 : 0); // Adding deep cracks/imperfections
      } else if (type === 'stone') {
        const noise1 = Math.sin(x*0.1)*Math.cos(y*0.1) * 30;
        const noise2 = Math.random() * 50;
        v = 130 + noise1 + noise2;
      }

      data[i] = v;
      data[i+1] = v;
      data[i+2] = v;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  _proceduralTextures[type] = tex;
  return tex;
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
  const woodTex = useMemo(() => getProceduralTexture('wood'), []);
  const stoneTex = useMemo(() => getProceduralTexture('stone'), []);
  // Darken player color for roof/accents
  const roofColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.55);
    return '#' + c.getHexString();
  }, [color]);

  if (type === 'city') {
    // City: storybook castle miniature — matte hand-painted wood/clay feel
    return (
      <group position={position}>
        {/* Warm contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.30, 24]} />
          <meshBasicMaterial color="#1A0C00" transparent opacity={0.24} />
        </mesh>
        {/* Foundation slab — warm stone */}
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.24]} />
          <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
        </mesh>
        {/* Main keep — matte painted */}
        <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.28, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
        </mesh>
        {/* Keep peaked roof — matte clay */}
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.17, 0.12, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} />
        </mesh>
        {/* Round tower — smooth painted cylinder */}
        <mesh position={[0.12, 0.22, 0.06]} castShadow receiveShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.40, 16]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        {/* Tower conical roof */}
        <mesh position={[0.12, 0.46, 0.06]} castShadow>
          <coneGeometry args={[0.09, 0.10, 16]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} />
        </mesh>
        {/* Tower battlements */}
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((a, i) => (
          <mesh key={i} position={[0.12 + Math.cos(a)*0.065, 0.42, 0.06 + Math.sin(a)*0.065]} castShadow>
            <boxGeometry args={[0.025, 0.04, 0.025]} />
            <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} />
          </mesh>
        ))}
        {/* Side wing */}
        <mesh position={[-0.10, 0.10, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.16, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        {/* Side wing roof */}
        <mesh position={[-0.10, 0.21, -0.02]} rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[0.10, 0.08, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} />
        </mesh>
        {/* Door — warm wood */}
        <mesh position={[0, 0.06, 0.092]}>
          <boxGeometry args={[0.04, 0.07, 0.005]} />
          <meshStandardMaterial color="#3A2010" roughness={0.97} />
        </mesh>
        {/* Windows — warm candlelight glow */}
        {[[0.06, 0.18, 0.092], [-0.06, 0.18, 0.092], [0, 0.22, 0.092]].map(([wx, wy, wz], i) => (
          <mesh key={`w${i}`} position={[wx, wy, wz]}>
            <boxGeometry args={[0.022, 0.025, 0.003]} />
            <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.40} roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  // Settlement: storybook cozy cottage — matte hand-painted miniature
  return (
    <group position={position}>
      {/* Warm contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.20, 20]} />
        <meshBasicMaterial color="#1A0C00" transparent opacity={0.22} />
      </mesh>
      {/* Foundation — warm stone */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.20, 0.03, 0.16]} />
        <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
      </mesh>
      {/* Walls — matte painted */}
      <mesh position={[0, 0.10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.17, 0.13]} />
        <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
      </mesh>
      {/* Peaked roof — matte clay */}
      <mesh position={[0, 0.23, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.14, 0.10, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} bumpMap={woodTex} bumpScale={0.003} />
      </mesh>
      {/* Chimney — warm brick */}
      <mesh position={[0.05, 0.25, -0.03]} castShadow>
        <boxGeometry args={[0.03, 0.08, 0.03]} />
        <meshStandardMaterial color="#5A3828" roughness={0.96} metalness={0.0} />
      </mesh>
      {/* Chimney smoke */}
      <mesh position={[0.05, 0.32, -0.03]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#A09888" transparent opacity={0.12} />
      </mesh>
      {/* Door — warm wood */}
      <mesh position={[0, 0.05, 0.067]}>
        <boxGeometry args={[0.035, 0.06, 0.004]} />
        <meshStandardMaterial color="#3A2010" roughness={0.97} />
      </mesh>
      {/* Window — warm candlelight */}
      <mesh position={[0.05, 0.13, 0.067]}>
        <boxGeometry args={[0.022, 0.025, 0.003]} />
        <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.35} roughness={0.5} />
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
  const [hovered, setHovered] = useState(false);
  const weatheredWood = useMemo(() => getProceduralTexture('weatheredWood'), []);
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.max(from[1], to[1]) + 0.03;
  const midZ = (from[2] + to[2]) / 2;
  const length = Math.sqrt((to[0] - from[0]) ** 2 + (to[2] - from[2]) ** 2);
  const angle = Math.atan2(to[2] - from[2], to[0] - from[0]);

  // Darken colour for road bed
  const darkColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.65);
    return '#' + c.getHexString();
  }, [color]);

  return (
    <group position={[midX, midY, midZ]} rotation={[0, -angle, 0]}>
      {/* Main road plank — wider, taller for visibility */}
      <mesh
        castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[length * 0.92, 0.05, 0.09]} />
        <meshStandardMaterial
          color={color}
          roughness={0.94}
          metalness={0.0}
          roughnessMap={weatheredWood}
          bumpMap={weatheredWood}
          bumpScale={0.004}
          emissive={color}
          emissiveIntensity={hovered ? 0.45 : 0.05}
        />
      </mesh>
      {/* Dark underside bed — gives depth illusion */}
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[length * 0.88, 0.02, 0.10]} />
        <meshStandardMaterial color={darkColor} roughness={0.90} metalness={0.0} />
      </mesh>
      {/* Side rail posts at ends */}
      {[-length * 0.40, length * 0.40].map((ox, i) => (
        <mesh key={i} position={[ox, 0.045, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.014, 0.07, 6]} />
          <meshStandardMaterial color={darkColor} roughness={0.88} metalness={0.05} />
        </mesh>
      ))}
    </group>
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

const _windUniforms = { time: { value: 0 } };

function GlobalAnimController() {
  useFrame(({ clock }) => {
    _windUniforms.time.value = clock.elapsedTime;
  });
  return null;
}

function Ocean() {
  return (
    <>
      {/* Layer 1: Deep ocean base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <circleGeometry args={[14.5, 80]} />
        <meshStandardMaterial
          color="#1A4878"
          roughness={0.12}
          metalness={0.20}
          emissive="#0A2848"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Layer 2: Mid-depth teal transition ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.022, 0]}>
        <ringGeometry args={[7.5, 14.5, 80]} />
        <meshStandardMaterial
          color="#1E5888"
          roughness={0.14}
          metalness={0.18}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Layer 3: Shallow coastal water — turquoise-blue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.019, 0]}>
        <ringGeometry args={[5.8, 7.8, 80]} />
        <meshStandardMaterial
          color="#2888B0"
          roughness={0.18}
          metalness={0.12}
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Layer 4: Static foam ring — no animation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.016, 0]}>
        <ringGeometry args={[5.4, 5.9, 80]} />
        <meshStandardMaterial
          color="#C8D8E8"
          roughness={0.90}
          metalness={0.0}
          transparent
          opacity={0.20}
          emissive="#607080"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

// ============================================================================
// HARBORS — Port indicators on the ocean border
// ============================================================================

// Build a flat hexagonal harbour tile shape
function createHarborHexShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function SeaFrame() {
  const hexShape = useMemo(() => createHexShape(HEX_SIZE * 0.99), []);
  const borderShape = useMemo(() => createHexShape(HEX_SIZE * 1.002), []);
  const extSettings = useMemo(() => ({ depth: 0.08, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2 }), []);
  const borderSettings = useMemo(() => ({ depth: 0.085, bevelEnabled: false }), []);
  return (
    <>
      {SEA_FRAME_POSITIONS.map((pos, i) => {
        const [wx, , wz] = hexToWorld(pos.q, pos.r);
        // Vary colour slightly per tile for organic look
        const hueShift = (i * 7) % 18;
        const r = 0.10 + hueShift * 0.002;
        const g = 0.32 + hueShift * 0.004;
        const b = 0.55 + hueShift * 0.006;
        return (
          <group key={i} position={[wx, -0.010, wz]}>
            {/* Gold trim border beneath sea tile */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
              <extrudeGeometry args={[borderShape, borderSettings]} />
              <meshStandardMaterial color="#6A5020" roughness={0.45} metalness={0.50} emissive="#2A1808" emissiveIntensity={0.10} />
            </mesh>
            {/* Sea tile body */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <extrudeGeometry args={[hexShape, extSettings]} />
              <meshStandardMaterial
                color={new THREE.Color(r, g, b)}
                roughness={0.22}
                metalness={0.28}
                emissive={new THREE.Color(r * 0.3, g * 0.3, b * 0.3)}
                emissiveIntensity={0.15}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Harbors() {
  const harborHex = useMemo(() => createHarborHexShape(0.72), []);
  const woodTex = useMemo(() => getProceduralTexture('weatheredWood'), []);
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
        const px = midX + nx * 1.55;
        const pz = midZ + nz * 1.55;
        const color = HARBOR_COLORS[harbor.type];
        const pierAngle = -Math.atan2(nz, nx);
        const hexRot = pierAngle;

        return (
          <group key={i} position={[px, 0.04, pz]}>
            {/* Harbor hex base — dark stone foundation */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, -0.01, 0]} receiveShadow>
              <extrudeGeometry args={[harborHex, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }]} />
              <meshStandardMaterial color="#2A2018" roughness={0.85} metalness={0.05} />
            </mesh>
            {/* Harbor hex coloured top — resource indicator surface */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, 0.05, 0]}>
              <shapeGeometry args={[harborHex]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} emissive={color} emissiveIntensity={0.12} />
            </mesh>

            {/* Label — billboard so it always faces camera */}
            <Billboard position={[0, 0.45, 0]}>
              <Text
                fontSize={0.24}
                color="#FFFFFF"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.04}
                outlineColor="#000000"
                fontWeight={700}
                maxWidth={1.5}
                textAlign="center"
                lineHeight={1.2}
              >
                {harbor.label}
              </Text>
            </Billboard>

            {/* Wooden pier/dock extending toward island */}
            <mesh
              position={[-nx * 0.50, 0.03, -nz * 0.50]}
              rotation={[0, pierAngle, 0]}
              castShadow receiveShadow
            >
              <boxGeometry args={[0.55, 0.035, 0.14]} />
              <meshStandardMaterial
                color="#3A2210"
                roughness={0.88}
                metalness={0.02}
                roughnessMap={woodTex}
                bumpMap={woodTex}
                bumpScale={0.005}
              />
            </mesh>

            {/* Pier support piles — dark wood cylinders driven into water */}
            {[-0.20, 0, 0.20].map((off, pi) => {
              const perpX = Math.cos(pierAngle + Math.PI / 2) * off;
              const perpZ = Math.sin(pierAngle + Math.PI / 2) * off;
              return (
                <group key={pi}>
                  {/* Main pile */}
                  <mesh position={[-nx * 0.50 + perpX, -0.01, -nz * 0.50 + perpZ]} castShadow>
                    <cylinderGeometry args={[0.022, 0.028, 0.18, 8]} />
                    <meshStandardMaterial color="#2A1808" roughness={0.95} metalness={0.0} />
                  </mesh>
                  {/* Pile cap */}
                  <mesh position={[-nx * 0.50 + perpX, 0.07, -nz * 0.50 + perpZ]}>
                    <sphereGeometry args={[0.026, 8, 8]} />
                    <meshStandardMaterial color="#1A1008" roughness={0.90} />
                  </mesh>
                </group>
              );
            })}

            {/* Bollard posts at harbor tile edge */}
            {[-0.30, 0.30].map((off, bi) => {
              const bpx = Math.cos(pierAngle + Math.PI / 2) * off;
              const bpz = Math.sin(pierAngle + Math.PI / 2) * off;
              return (
                <mesh key={`b${bi}`} position={[bpx, 0.08, bpz]} castShadow>
                  <cylinderGeometry args={[0.025, 0.030, 0.10, 8]} />
                  <meshStandardMaterial color="#4A3818" roughness={0.90} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </>
  );
}

// ============================================================================
// 3D DICE PAIR — physical dice sitting on the board near the edge
// ============================================================================

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function DiePips({ value, faceNormal }: { value: number; faceNormal: [number, number, number] }) {
  const pips = PIP_LAYOUTS[value] || [];
  const spacing = 0.065;
  const pipR = 0.018;

  // Determine local up and right axes for the face
  const [nx, ny, nz] = faceNormal;
  let upVec: [number, number, number], rightVec: [number, number, number];
  if (Math.abs(ny) > 0.5) {
    upVec = [0, 0, ny > 0 ? -1 : 1];
    rightVec = [1, 0, 0];
  } else if (Math.abs(nx) > 0.5) {
    upVec = [0, 1, 0];
    rightVec = [0, 0, nx > 0 ? -1 : 1];
  } else {
    upVec = [0, 1, 0];
    rightVec = [nz > 0 ? 1 : -1, 0, 0];
  }

  return (
    <>
      {pips.map(([col, row], i) => {
        const ox = col * spacing;
        const oy = row * spacing;
        return (
          <mesh
            key={i}
            position={[
              nx * 0.13 + rightVec[0] * ox + upVec[0] * oy,
              ny * 0.13 + rightVec[1] * ox + upVec[1] * oy,
              nz * 0.13 + rightVec[2] * ox + upVec[2] * oy,
            ]}
          >
            <sphereGeometry args={[pipR, 8, 8]} />
            <meshStandardMaterial color="#181818" roughness={0.3} metalness={0.1} />
          </mesh>
        );
      })}
    </>
  );
}

// Rotation quaternions to put each value on the +Y face of a standard die
const VALUE_TO_ROTATION: Record<number, [number, number, number, number]> = {
  1: [0, 0, -0.7071, 0.7071],   // +X up → value 1 top
  2: [0.7071, 0, 0, 0.7071],    // +Z up → value 2 top
  3: [0, 0, 0, 1],              // +Y up → value 3 top (identity)
  4: [1, 0, 0, 0],              // -Y up → value 4 top (180° around X)
  5: [-0.7071, 0, 0, 0.7071],   // -Z up → value 5 top
  6: [0, 0, 0.7071, 0.7071],    // -X up → value 6 top
};

function PhysicsDie({ value, startPos, seed }: { value: number; startPos: [number, number, number]; seed: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const settled = useRef(false);
  const timer = useRef(0);

  useFrame((_, delta) => {
    if (!bodyRef.current || settled.current) return;
    timer.current += delta;

    // After 2s, force settle to correct rotation
    if (timer.current > 2.0) {
      const quat = VALUE_TO_ROTATION[value] || VALUE_TO_ROTATION[3];
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] }, true);
      settled.current = true;
      return;
    }

    // Check if velocity is near zero → snap
    const vel = bodyRef.current.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    if (timer.current > 0.8 && speed < 0.05) {
      const quat = VALUE_TO_ROTATION[value] || VALUE_TO_ROTATION[3];
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] }, true);
      settled.current = true;
    }
  });

  const topVal = value;
  const bottomVal = 7 - value;

  return (
    <RigidBody
      ref={bodyRef}
      position={startPos}
      rotation={[seed * 2.1, seed * 3.7, seed * 1.3]}
      linearVelocity={[(Math.random() - 0.5) * 1.5, -2, (Math.random() - 0.5) * 1.5]}
      angularVelocity={[(Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15]}
      restitution={0.3}
      friction={0.8}
      colliders="cuboid"
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial
          color="#F5F0E8"
          roughness={0.55}
          metalness={0.02}
          emissive="#201808"
          emissiveIntensity={0.03}
        />
      </mesh>
      <DiePips value={topVal} faceNormal={[0, 1, 0]} />
      <DiePips value={Math.max(1, Math.min(6, (topVal + 1) % 6 + 1))} faceNormal={[0, 0, 1]} />
      <DiePips value={bottomVal > 3 ? bottomVal - 3 : bottomVal + 2} faceNormal={[1, 0, 0]} />
    </RigidBody>
  );
}

function Dice3DPair({ diceRoll }: { diceRoll: [number, number] | null }) {
  if (!diceRoll) return null;

  // Use a key based on values to re-trigger physics on each new roll
  const rollKey = `${diceRoll[0]}-${diceRoll[1]}-${Date.now()}`;

  return (
    <group position={[3.8, 0, 3.8]}>
      {/* Invisible floor for dice to land on */}
      <Physics gravity={[0, -9.81, 0]} key={rollKey}>
        <RigidBody type="fixed" position={[0, -0.02, 0]}>
          <mesh>
            <boxGeometry args={[2, 0.04, 2]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </RigidBody>
        <PhysicsDie value={diceRoll[0]} startPos={[-0.2, 1.8, 0]} seed={0.3} />
        <PhysicsDie value={diceRoll[1]} startPos={[0.2, 2.1, 0.06]} seed={1.7} />
      </Physics>
      {/* Contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[0.50, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 3D SPATIAL PRESENCE — holographic player nameplates around the board
// ============================================================================

const SEAT_POSITIONS: [number, number, number][] = [
  [0,    0.6, -12.5],  // North
  [12.5, 0.6,  0],     // East
  [0,    0.6,  12.5],  // South
  [-12.5,0.6,  0],     // West
];

interface PlayerNameplate3DProps {
  name: string;
  color: string;
  vp: number;
  isActive: boolean;
  position: [number, number, number];
}

function PlayerNameplate3D({ name, color, vp, isActive, position }: PlayerNameplate3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2) * 0.06;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Billboard so it always faces camera */}
      <group>
        {/* Glowing backdrop panel */}
        <mesh>
          <planeGeometry args={[2.8, 0.9]} />
          <meshStandardMaterial
            color="#0A0A1A"
            transparent
            opacity={0.75}
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>

        {/* Color accent bar (left side) */}
        <mesh position={[-1.25, 0, 0.005]}>
          <planeGeometry args={[0.12, 0.75]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Active turn glow ring */}
        {isActive && (
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[3.0, 1.1]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} />
          </mesh>
        )}

        {/* Player name */}
        <Text
          position={[-0.3, 0.12, 0.02]}
          fontSize={0.22}
          color="white"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          maxWidth={2}
        >
          {name}
        </Text>

        {/* VP badge */}
        <group position={[1.0, 0.12, 0.02]}>
          <mesh>
            <circleGeometry args={[0.18, 24]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.18}
            color="white"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {`${vp}`}
          </Text>
        </group>

        {/* Scanline effect overlay */}
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[2.8, 0.9]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.03}
            wireframe
          />
        </mesh>

        {/* Bottom accent line */}
        <mesh position={[0, -0.38, 0.005]}>
          <planeGeometry args={[2.6, 0.015]} />
          <meshBasicMaterial color={color} transparent opacity={isActive ? 0.9 : 0.4} />
        </mesh>
      </group>

      {/* Small point light for local glow */}
      <pointLight
        color={color}
        intensity={isActive ? 0.6 : 0.15}
        distance={3}
        decay={2}
      />
    </group>
  );
}

// ============================================================================
// SPATIAL AMBIENCE — 3D positioned ambient audio cues
// ============================================================================

function SpatialAmbience() {
  const listenerRef = useRef<THREE.AudioListener | null>(null);
  const oceanRef = useRef<THREE.PositionalAudio | null>(null);
  const windRef = useRef<THREE.PositionalAudio | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useFrame(({ camera }) => {
    if (!listenerRef.current) {
      const listener = new THREE.AudioListener();
      camera.add(listener);
      listenerRef.current = listener;

      // Ocean ambient — positioned at sea frame edge
      const oceanAudio = new THREE.PositionalAudio(listener);
      oceanAudio.position.set(0, 0.2, 13);
      oceanAudio.setRefDistance(8);
      oceanAudio.setRolloffFactor(1.5);
      oceanAudio.setVolume(0.12);
      oceanRef.current = oceanAudio;

      // Wind ambient — positioned above board center
      const windAudio = new THREE.PositionalAudio(listener);
      windAudio.position.set(0, 4, 0);
      windAudio.setRefDistance(12);
      windAudio.setRolloffFactor(1);
      windAudio.setVolume(0.08);
      windRef.current = windAudio;

      setAudioReady(true);
    }
  });

  // Ambient sounds are placeholder-ready — actual audio buffers
  // would be loaded from CDN when the user enables spatial audio.
  // For now we just set up the 3D audio infrastructure.

  return audioReady ? (
    <>
      {/* Visual indicator for spatial audio anchor points (debug) */}
      <mesh position={[0, 0.2, 13]} visible={false}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="#00AAFF" />
      </mesh>
    </>
  ) : null;
}

function PlayerPresence3D({ gameState }: { gameState: GameState }) {
  return (
    <>
      {gameState.players.map((player, i) => {
        const seat = SEAT_POSITIONS[i % SEAT_POSITIONS.length];
        const isActive = i === gameState.currentPlayerIndex;
        return (
          <PlayerNameplate3D
            key={player.id}
            name={player.name}
            color={player.color}
            vp={player.victoryPoints}
            isActive={isActive}
            position={seat}
          />
        );
      })}
    </>
  );
}

// ============================================================================
// BUILD MARKERS — Animated pulsing indicators for buildable spots
// ============================================================================

function VertexBuildMarker({ position, vertexId, onClick, color }: {
  position: [number, number, number];
  vertexId: string;
  onClick: (id: string) => void;
  color: string;
}) {
  const dotRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!dotRef.current) return;
    const t = clock.elapsedTime;
    // Subtle vertical bob
    dotRef.current.position.y = position[1] + 0.12 + Math.sin(t * 1.5) * 0.02;
    // Subtle pulse
    const pulse = 1.0 + Math.sin(t * 1.2) * 0.05;
    dotRef.current.scale.setScalar(hovered ? pulse * 1.2 : pulse);
  });

  return (
    <group>
      {/* Diamond indicator — bright, visible, pulsing */}
      <mesh
        ref={dotRef}
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[position[0], position[1] + 0.12, position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(vertexId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <circleGeometry args={[0.14, 4]} />
        <meshBasicMaterial color={hovered ? '#FFFFFF' : color} />
      </mesh>

      {/* Glow ring around diamond */}
      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[position[0], position[1] + 0.11, position[2]]}
      >
        <ringGeometry args={[0.14, 0.22, 4]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.9 : 0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Invisible larger click target */}
      <mesh
        position={[position[0], position[1] + 0.12, position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(vertexId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        visible={false}
      >
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

function EdgeBuildMarker({ position, rotation, length, edgeId, onClick }: {
  position: [number, number, number];
  rotation: number;
  length: number;
  edgeId: string;
  onClick: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime * 2.5;
    const pulse = 1.0 + Math.sin(t * 1.5) * 0.12;
    meshRef.current.scale.set(1, hovered ? pulse * 1.3 : pulse, hovered ? pulse * 1.3 : pulse);
    // Gentle vertical bob
    meshRef.current.position.y = position[1] + Math.sin(t) * 0.04;
  });

  return (
    <group position={position} rotation={[0, -rotation, 0]}>
      {/* Road indicator — glowing capsule along the edge */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(edgeId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
      >
        <boxGeometry args={[length * 0.85, 0.12, 0.16]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFA500'}
          emissive={hovered ? '#FFD700' : '#FF6600'}
          emissiveIntensity={hovered ? 1.0 : 0.45}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* End caps — small spheres at each end for visual clarity */}
      <mesh position={[length * 0.40, 0, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFD700'}
          emissive="#FF8C00"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[-length * 0.40, 0, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFD700'}
          emissive="#FF8C00"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Glow light — subtle */}
      <pointLight
        color="#FFA500"
        intensity={hovered ? 1.2 : 0.3}
        distance={2}
        decay={2}
      />

      {/* Large invisible click target */}
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); onClick(edgeId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <boxGeometry args={[length * 0.92, 0.4, 0.4]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

// ============================================================================
// BOARD CONTENT — Full 3D scene
// ============================================================================

interface BoardContentProps {
  gameState: GameState;
  presencePlayers?: Presence3DPlayer[];
  resourceAnimations?: ResourceAnimation[];
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  validVertexIds?: string[];
  validEdgeIds?: string[];
}

function BoardContent({ gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds }: BoardContentProps) {
  const orbitRef = useRef<any>(null);
  useKeyboardControls(orbitRef);

  const getPlayerColor = (playerId: string): string => {
    return gameState.players.find(p => p.id === playerId)?.color || '#888';
  };

  return (
    <>
      <GlobalAnimController />

      {/* ══════════════════════════════════════════════════════════════════
          CINEMATIC LIGHTING RIG — warm museum-gallery tabletop feel
          7 light sources for depth, drama, and realistic PBR response
          ══════════════════════════════════════════════════════════════════ */}
      {/* Ambient: warm golden fill so nothing is black */}
      <ambientLight intensity={0.7} color="#FFF5E8" />

      {/* KEY — bright warm overhead sun */}
      <directionalLight
        position={[6, 28, 5]}
        intensity={2.2}
        color="#FFF0D0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.00015}
        shadow-normalBias={0.02}
      />

      {/* FILL — cool blue from opposite side to balance warm key */}
      <directionalLight position={[-8, 16, -6]} intensity={0.8} color="#C0D8FF" />

      {/* RIM — subtle backlight for edge definition */}
      <directionalLight position={[0, 10, -14]} intensity={0.5} color="#FFE0B0" />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 19, 4.5]} fov={38} />
      <OrbitControls ref={orbitRef} enablePan enableZoom enableRotate minDistance={5} maxDistance={28} maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.10} />

      {/* Background — warm dark brown like a wooden game table room */}
      <color attach="background" args={['#1A1008']} />

      {/* High-res contact shadows — soft diffuse ground shadows */}
      <ContactShadows
        position={[0, -0.025, 0]}
        opacity={0.35}
        scale={30}
        blur={2.5}
        far={8}
        resolution={1024}
        color="#000000"
      />

      {/* Post-processing — clean anti-aliasing only, no bloom/DoF/fog */}
      <EffectComposer multisampling={8}>
        <SMAA />
      </EffectComposer>

      {/* ══ WALNUT TABLE SURFACE ══ */}
      {/* Main table body — warm walnut */}
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <cylinderGeometry args={[17, 17.2, 0.50, 80]} />
        <meshStandardMaterial
          color="#3A2210"
          roughness={0.72}
          metalness={0.06}
          roughnessMap={getProceduralTexture('wood')}
          bumpMap={getProceduralTexture('wood')}
          bumpScale={0.005}
          emissive="#140A04"
          emissiveIntensity={0.15}
        />
      </mesh>
      {/* Table top surface — lighter walnut veneer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.029, 0]} receiveShadow>
        <circleGeometry args={[17, 80]} />
        <meshStandardMaterial
          color="#4A2C14"
          roughness={0.68}
          metalness={0.08}
          roughnessMap={getProceduralTexture('wood')}
          bumpMap={getProceduralTexture('wood')}
          bumpScale={0.003}
          emissive="#1A0C04"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Felt inlay ring — dark green gaming felt under the board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.027, 0]} receiveShadow>
        <ringGeometry args={[0.5, 10.5, 80]} />
        <meshStandardMaterial color="#0C2810" roughness={0.98} metalness={0.0} emissive="#020A04" emissiveIntensity={0.08} />
      </mesh>
      {/* Brass edge band — thin metallic ring at table lip */}
      <mesh position={[0, -0.06, 0]}>
        <torusGeometry args={[17.1, 0.035, 8, 120]} />
        <meshStandardMaterial color="#8A6820" roughness={0.30} metalness={0.70} emissive="#3A2800" emissiveIntensity={0.15} />
      </mesh>

      {/* Sea frame — ring of 18 sea tiles bordering the island */}
      <SeaFrame />

      {/* Ocean */}
      <Ocean />

      {/* Harbour port indicators */}
      <Harbors />

      {/* 3D Dice pair on the board */}
      <Dice3DPair diceRoll={gameState.diceRoll ?? null} />

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

      {/* 3D Spatial Presence — holographic player nameplates around the board */}
      <PlayerPresence3D gameState={gameState} />

      {/* 3D Video Presence Panels — webcam feeds floating in 3D scene */}
      {presencePlayers && presencePlayers.length > 0 && (
        <CatanPresence3D players={presencePlayers} />
      )}

      {/* 3D Resource Flow — animated tokens flying hex → player */}
      {resourceAnimations && resourceAnimations.length > 0 && (
        <ResourceFlow3D animations={resourceAnimations} />
      )}

      {/* Spatial Ambience — 3D positioned ambient audio infrastructure */}
      <SpatialAmbience />

      {/* Buildable vertex indicators — ONLY valid positions */}
      {onVertexClick && validVertexIds && validVertexIds.length > 0 && gameState.vertices
        .filter(v => validVertexIds.includes(v.id))
        .map(vertex => {
          const pos = getVertexWorldPos(vertex, gameState.hexTiles);
          if (!pos) return null;

          // Get color from adjacent hex resource type
          const adjacentHex = gameState.hexTiles.find(h => vertex.hexIds.includes(h.id));
          const resource = adjacentHex ? TERRAIN_RESOURCES[adjacentHex.terrain] : null;
          const resourceColors: Record<string, string> = {
            wood: '#22c55e',
            brick: '#ef4444',
            sheep: '#84cc16',
            wheat: '#eab308',
            ore: '#64748b',
          };
          const color = resource ? resourceColors[resource] : '#FFD700';

          return (
            <VertexBuildMarker
              key={`vbuild-${vertex.id}`}
              position={pos}
              vertexId={vertex.id}
              onClick={onVertexClick}
              color={color}
            />
          );
      })}

      {/* Buildable edge indicators — ONLY valid positions */}
      {onEdgeClick && validEdgeIds && validEdgeIds.length > 0 && gameState.edges
        .filter(e => validEdgeIds.includes(e.id))
        .map(edge => {
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
            <EdgeBuildMarker
              key={`ebuild-${edge.id}`}
              position={[midX, 0.12, midZ] as [number, number, number]}
              rotation={angle}
              length={length}
              edgeId={edge.id}
              onClick={onEdgeClick}
            />
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
  presencePlayers?: Presence3DPlayer[];
  resourceAnimations?: ResourceAnimation[];
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  validVertexIds?: string[];
  validEdgeIds?: string[];
}

export default function CatanBoard3D({ 
  gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds
}: CatanBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.6,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
          precision: 'highp',
        }}
        dpr={[1.5, 2]}
      >
        <XR store={xrStore}>
          <Suspense fallback={null}>
            <BoardContent
              gameState={gameState}
              presencePlayers={presencePlayers}
              resourceAnimations={resourceAnimations}
              onHexClick={onHexClick}
              onVertexClick={onVertexClick}
              onEdgeClick={onEdgeClick}
              validVertexIds={validVertexIds}
              validEdgeIds={validEdgeIds}
            />
          </Suspense>
        </XR>
      </Canvas>

      {/* Canvas overlay — painterly texture feel (like ABAS) */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.008] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* VR Entry Button — only visible on WebXR-capable devices */}
      <button
        onClick={() => xrStore.enterVR()}
        className="absolute bottom-3 left-3 z-20 px-3 py-1.5 bg-indigo-700/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg backdrop-blur-sm border border-indigo-500/40 shadow-lg transition-all opacity-60 hover:opacity-100"
        title="Enter VR (requires WebXR headset)"
      >
        🥽 Enter VR
      </button>
    </div>
  );
}
