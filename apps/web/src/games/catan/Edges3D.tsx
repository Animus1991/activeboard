/**
 * Edges3D — Road models and edge build markers.
 *
 * Exports:
 *  - Road3D          — weathered wood plank road between two vertices
 *  - EdgeBuildMarker — glowing capsule indicator for valid road placement
 */

import { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { getProceduralTexture } from './CatanHexUtils';

// ============================================================================
// ROAD 3D — plank road between two vertex positions
// ============================================================================

export interface Road3DProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

export function Road3D({ from, to, color }: Road3DProps) {
  const [hovered, setHovered] = useState(false);
  const weatheredWood = useMemo(() => getProceduralTexture('weatheredWood'), []);
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.max(from[1], to[1]) + 0.03;
  const midZ = (from[2] + to[2]) / 2;
  const length = Math.sqrt((to[0] - from[0]) ** 2 + (to[2] - from[2]) ** 2);
  const angle = Math.atan2(to[2] - from[2], to[0] - from[0]);

  const darkColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.65);
    return '#' + c.getHexString();
  }, [color]);

  return (
    <group position={[midX, midY, midZ]} rotation={[0, -angle, 0]}>
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
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[length * 0.88, 0.02, 0.10]} />
        <meshStandardMaterial color={darkColor} roughness={0.90} metalness={0.0} />
      </mesh>
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
// EDGE BUILD MARKER — glowing indicator for valid road placement
// ============================================================================

export interface EdgeBuildMarkerProps {
  position: [number, number, number];
  rotation: number;
  length: number;
  edgeId: string;
  onClick: (id: string) => void;
}

export function EdgeBuildMarker({ position, rotation, length, edgeId, onClick }: EdgeBuildMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime * 2.5;
    const pulse = 1.0 + Math.sin(t * 1.5) * 0.12;
    meshRef.current.scale.set(1, hovered ? pulse * 1.3 : pulse, hovered ? pulse * 1.3 : pulse);
    meshRef.current.position.y = position[1] + Math.sin(t) * 0.04;
  });

  return (
    <group position={position} rotation={[0, -rotation, 0]}>
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

      <pointLight
        color="#FFA500"
        intensity={hovered ? 1.2 : 0.3}
        distance={2}
        decay={2}
      />

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
