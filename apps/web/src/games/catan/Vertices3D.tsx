/**
 * Vertices3D — Building models (settlement / city) and vertex build markers.
 *
 * Exports:
 *  - Building3D        — storybook settlement or castle city
 *  - VertexBuildMarker — pulsing diamond indicator for valid build sites
 *  - getVertexWorldPos — derive 3D position from vertex's adjacent hex centres
 */

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { type HexTile, type Vertex } from './CatanEngine';
import { hexToWorld, getProceduralTexture } from './CatanHexUtils';

// ============================================================================
// VERTEX WORLD POSITION
// ============================================================================

export function getVertexWorldPos(vertex: Vertex, hexTiles: HexTile[]): [number, number, number] | null {
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
// BUILDING 3D — settlement or city on a vertex
// ============================================================================

export interface Building3DProps {
  position: [number, number, number];
  type: 'settlement' | 'city';
  color: string;
}

export function Building3D({ position, type, color }: Building3DProps) {
  const woodTex = useMemo(() => getProceduralTexture('wood'), []);
  const stoneTex = useMemo(() => getProceduralTexture('stone'), []);
  const roofColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.55);
    return '#' + c.getHexString();
  }, [color]);

  if (type === 'city') {
    return (
      <group position={position}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.30, 24]} />
          <meshBasicMaterial color="#1A0C00" transparent opacity={0.24} />
        </mesh>
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.24]} />
          <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.28, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
        </mesh>
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.17, 0.12, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} />
        </mesh>
        <mesh position={[0.12, 0.22, 0.06]} castShadow receiveShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.40, 16]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        <mesh position={[0.12, 0.46, 0.06]} castShadow>
          <coneGeometry args={[0.09, 0.10, 16]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} />
        </mesh>
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((a, i) => (
          <mesh key={i} position={[0.12 + Math.cos(a)*0.065, 0.42, 0.06 + Math.sin(a)*0.065]} castShadow>
            <boxGeometry args={[0.025, 0.04, 0.025]} />
            <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} />
          </mesh>
        ))}
        <mesh position={[-0.10, 0.10, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.16, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        <mesh position={[-0.10, 0.21, -0.02]} castShadow>
          <coneGeometry args={[0.10, 0.08, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} />
        </mesh>
        <mesh position={[0, 0.06, 0.092]}>
          <boxGeometry args={[0.04, 0.07, 0.005]} />
          <meshStandardMaterial color="#3A2010" roughness={0.97} />
        </mesh>
        {[[0.06, 0.18, 0.092], [-0.06, 0.18, 0.092], [0, 0.22, 0.092]].map(([wx, wy, wz], i) => (
          <mesh key={`w${i}`} position={[wx, wy, wz]}>
            <boxGeometry args={[0.022, 0.025, 0.003]} />
            <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.40} roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  // Settlement
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.20, 20]} />
        <meshBasicMaterial color="#1A0C00" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.20, 0.03, 0.16]} />
        <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
      </mesh>
      <mesh position={[0, 0.10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.17, 0.13]} />
        <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
      </mesh>
      <mesh position={[0, 0.23, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.14, 0.10, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} bumpMap={woodTex} bumpScale={0.003} />
      </mesh>
      <mesh position={[0.05, 0.25, -0.03]} castShadow>
        <boxGeometry args={[0.03, 0.08, 0.03]} />
        <meshStandardMaterial color="#5A3828" roughness={0.96} metalness={0.0} />
      </mesh>
      <mesh position={[0.05, 0.32, -0.03]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#A09888" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 0.05, 0.067]}>
        <boxGeometry args={[0.035, 0.06, 0.004]} />
        <meshStandardMaterial color="#3A2010" roughness={0.97} />
      </mesh>
      <mesh position={[0.05, 0.13, 0.067]}>
        <boxGeometry args={[0.022, 0.025, 0.003]} />
        <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
    </group>
  );
}

// ============================================================================
// VERTEX BUILD MARKER — pulsing diamond for valid placement targets
// ============================================================================

export interface VertexBuildMarkerProps {
  position: [number, number, number];
  vertexId: string;
  onClick: (id: string) => void;
  color: string;
}

export function VertexBuildMarker({ position, vertexId, onClick, color }: VertexBuildMarkerProps) {
  const dotRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!dotRef.current) return;
    const t = clock.elapsedTime;
    dotRef.current.position.y = position[1] + 0.12 + Math.sin(t * 1.5) * 0.02;
    const pulse = 1.0 + Math.sin(t * 1.2) * 0.05;
    dotRef.current.scale.setScalar(hovered ? pulse * 1.2 : pulse);
  });

  return (
    <group>
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

      <mesh
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[position[0], position[1] + 0.11, position[2]]}
      >
        <ringGeometry args={[0.14, 0.22, 4]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.9 : 0.5} side={THREE.DoubleSide} />
      </mesh>

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
