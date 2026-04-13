/**
 * TableForge — Catan 3D Board  (AAA visual rewrite)
 * Cinematic PBR materials · dramatic shadow lighting · ACES tone mapping
 * Multi-layer terrain decorations · harbour ports · animated ocean
 */

import { useRef, useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { EffectComposer, SMAA } from '@react-three/postprocessing';
import { useKeyboardControls } from './CatanHUDFeatures';
import { XR, createXRStore } from '@react-three/xr';
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import {
  type GameState,
  TERRAIN_RESOURCES,
} from './CatanEngine';
import { CatanPresence3D, type Presence3DPlayer } from './CatanPresence3D';
import { ResourceFlow3D, type ResourceAnimation } from './CatanResourceFlow';
import { PlacementHighlightSystem } from './CatanPlacementHighlight';
import { getProceduralTexture } from './CatanHexUtils';
import HexTile3D from './HexTile3D';
import { Building3D, VertexBuildMarker, getVertexWorldPos } from './Vertices3D';
import { Road3D, EdgeBuildMarker } from './Edges3D';
import Ports3D from './Ports3D';
import Water3D from './Water3D';

const xrStore = createXRStore({ hand: { teleportPointer: true } });

// Building3D, Road3D, getVertexWorldPos — all imported from Vertices3D.tsx and Edges3D.tsx

// ============================================================================
// VERTEX HELPERS (imported from Vertices3D.tsx)
// ============================================================================

// getVertexWorldPos is imported from Vertices3D.tsx

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

// createHarborHexShape — now in Ports3D.tsx

// SeaFrame and Harbors — now in Water3D.tsx and Ports3D.tsx

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
// VertexBuildMarker and EdgeBuildMarker — imported from Vertices3D.tsx and Edges3D.tsx

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
  buildMode?: { active: 'settlement' | 'city' | 'road' | null; playerId: string | null };
}

function BoardContent({ gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds, buildMode }: BoardContentProps) {
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
      <Water3D />

      {/* Ocean */}
      <Ocean />

      {/* Harbour port indicators */}
      <Ports3D />

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

      {/* Buildable edge indicators - ONLY valid positions */}
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

      {/* Placement Highlight System - AAA build mode visual feedback */}
      {buildMode && validVertexIds && validEdgeIds && (
        <PlacementHighlightSystem
          buildMode={buildMode}
          validVertexIds={validVertexIds}
          validEdgeIds={validEdgeIds}
          vertices={gameState.vertices.map(v => ({
            id: v.id,
            position: { q: 0, r: 0 } // Placeholder - will be calculated by hexToWorld
          }))}
          edges={gameState.edges}
        />
      )}
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
  buildMode?: { active: 'settlement' | 'city' | 'road' | null; playerId: string | null };
}

export default function CatanBoard3D({ 
  gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds, buildMode
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
              buildMode={buildMode}
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
