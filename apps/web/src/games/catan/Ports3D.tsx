/**
 * Ports3D — Harbour port indicators on the ocean border.
 *
 * 9 standard Catan harbours with coloured hex bases, wooden piers,
 * bollard posts, and billboard labels.
 */

import { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

import { hexToWorld, getProceduralTexture, HARBOR_DEFS, HARBOR_COLORS } from './CatanHexUtils';

const RESOURCE_ICONS: Record<string, string> = {
  wood: '🌲',
  brick: '🧱',
  sheep: '🐑',
  wheat: '🌾',
  ore: '⛏️',
};

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function Ports3D() {
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
            {/* Harbor hex base */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, -0.01, 0]} receiveShadow>
              <extrudeGeometry args={[harborHex, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }]} />
              <meshStandardMaterial color="#2A2018" roughness={0.85} metalness={0.05} />
            </mesh>
            {/* Coloured top */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, 0.05, 0]}>
              <shapeGeometry args={[harborHex]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} emissive={color} emissiveIntensity={0.12} />
            </mesh>

            {/* Label — resource icon + large ratio */}
            <Billboard position={[0, 0.50, 0]}>
              {/* Background panel */}
              <mesh position={[0, 0, -0.01]}>
                <planeGeometry args={[harbor.type === '3:1' ? 0.65 : 0.90, harbor.type === '3:1' ? 0.40 : 0.58]} />
                <meshBasicMaterial
                  color={harbor.type === '3:1' ? '#2A2018' : color}
                  transparent
                  opacity={0.85}
                  side={THREE.DoubleSide}
                />
              </mesh>
              {/* Border */}
              <mesh position={[0, 0, -0.009]}>
                <planeGeometry args={[harbor.type === '3:1' ? 0.70 : 0.95, harbor.type === '3:1' ? 0.45 : 0.63]} />
                <meshBasicMaterial color="#D4AF37" transparent opacity={0.9} side={THREE.DoubleSide} />
              </mesh>
              {harbor.type !== '3:1' && (
                <Text
                  position={[0, 0.10, 0]}
                  fontSize={0.15}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="middle"
                  fontWeight={700}
                >
                  {RESOURCE_ICONS[harbor.type] || ''} {harbor.type.charAt(0).toUpperCase() + harbor.type.slice(1)}
                </Text>
              )}
              <Text
                position={[0, harbor.type === '3:1' ? 0 : -0.10, 0]}
                fontSize={harbor.type === '3:1' ? 0.28 : 0.22}
                color="#FFD700"
                anchorX="center"
                anchorY="middle"
                fontWeight={900}
                outlineWidth={0.02}
                outlineColor="#000000"
              >
                {harbor.type === '3:1' ? '3:1' : '2:1'}
              </Text>
            </Billboard>

            {/* Wooden pier */}
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

            {/* Pier support piles */}
            {[-0.20, 0, 0.20].map((off, pi) => {
              const perpX = Math.cos(pierAngle + Math.PI / 2) * off;
              const perpZ = Math.sin(pierAngle + Math.PI / 2) * off;
              return (
                <group key={pi}>
                  <mesh position={[-nx * 0.50 + perpX, -0.01, -nz * 0.50 + perpZ]} castShadow>
                    <cylinderGeometry args={[0.022, 0.028, 0.18, 8]} />
                    <meshStandardMaterial color="#2A1808" roughness={0.95} metalness={0.0} />
                  </mesh>
                  <mesh position={[-nx * 0.50 + perpX, 0.07, -nz * 0.50 + perpZ]}>
                    <sphereGeometry args={[0.026, 8, 8]} />
                    <meshStandardMaterial color="#1A1008" roughness={0.90} />
                  </mesh>
                </group>
              );
            })}

            {/* Bollard posts */}
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
