/**
 * Resource3D — Standalone 3D resource model components.
 *
 * Re-exports the per-resource token geometry from CatanResourceFlow and adds
 * larger decorative models suitable for board overlays, trade panels, and
 * victory celebrations.
 *
 * Exports:
 *  - ResourceToken3D      — small token model (re-export from CatanResourceFlow)
 *  - ResourceCard3D       — flat card with resource colour + 3D icon
 *  - RESOURCE_COLORS_3D   — shared colour palette
 */

import { useMemo } from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

import type { ResourceType } from './CatanEngine';

// ============================================================================
// COLOUR PALETTE
// ============================================================================

export const RESOURCE_COLORS_3D: Record<ResourceType, { base: string; emissive: string; light: string; accent: string }> = {
  wood:  { base: '#5A3310', emissive: '#1A0C00', light: '#8B5E3C', accent: '#22c55e' },
  brick: { base: '#C0360C', emissive: '#200800', light: '#E45830', accent: '#ef4444' },
  sheep: { base: '#F0F0F0', emissive: '#0A0A0A', light: '#B8E0A0', accent: '#84cc16' },
  wheat: { base: '#D4A520', emissive: '#1A1000', light: '#F0D060', accent: '#eab308' },
  ore:   { base: '#485E6A', emissive: '#060C10', light: '#8090A0', accent: '#94a3b8' },
};

const RESOURCE_LABEL: Record<ResourceType, string> = {
  wood: 'Wood', brick: 'Brick', sheep: 'Sheep', wheat: 'Wheat', ore: 'Ore',
};

// ============================================================================
// RESOURCE TOKEN 3D — small per-resource geometry
// ============================================================================

export function ResourceToken3D({ resource, scale = 1 }: { resource: ResourceType; scale?: number }) {
  const colors = RESOURCE_COLORS_3D[resource];

  switch (resource) {
    case 'wood':
      return (
        <group scale={scale}>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.20, 8]} />
            <meshStandardMaterial color={colors.base} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.10, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.015, 0.038, 12]} />
            <meshStandardMaterial color="#3A2008" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    case 'brick':
      return (
        <group scale={scale}>
          <mesh castShadow>
            <boxGeometry args={[0.15, 0.08, 0.10]} />
            <meshStandardMaterial color={colors.base} roughness={0.88} />
          </mesh>
        </group>
      );
    case 'sheep':
      return (
        <group scale={scale}>
          <mesh castShadow>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial color={colors.base} roughness={0.95} />
          </mesh>
          <mesh position={[0.06, 0.02, 0]} scale={0.4}>
            <sphereGeometry args={[0.07, 8, 8]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.90} />
          </mesh>
        </group>
      );
    case 'wheat':
      return (
        <group scale={scale}>
          <mesh castShadow>
            <boxGeometry args={[0.015, 0.20, 0.015]} />
            <meshStandardMaterial color={colors.base} roughness={0.50} />
          </mesh>
          <mesh position={[0, 0.12, 0]} castShadow>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshStandardMaterial color="#F0C840" roughness={0.40} />
          </mesh>
        </group>
      );
    case 'ore':
      return (
        <group scale={scale}>
          <mesh castShadow>
            <dodecahedronGeometry args={[0.07]} />
            <meshStandardMaterial color={colors.base} roughness={0.35} metalness={0.60} />
          </mesh>
        </group>
      );
    default:
      return null;
  }
}

// ============================================================================
// RESOURCE CARD 3D — flat card with icon + label (for HUD / trade overlays)
// ============================================================================

export interface ResourceCard3DProps {
  resource: ResourceType;
  count?: number;
  position?: [number, number, number];
  highlighted?: boolean;
}

export function ResourceCard3D({
  resource,
  count,
  position = [0, 0, 0],
  highlighted = false,
}: ResourceCard3DProps) {
  const colors = RESOURCE_COLORS_3D[resource];
  const borderColor = useMemo(() => {
    const c = new THREE.Color(colors.accent);
    if (highlighted) c.multiplyScalar(1.4);
    return '#' + c.getHexString();
  }, [colors.accent, highlighted]);

  return (
    <group position={position}>
      {/* Card background */}
      <mesh>
        <planeGeometry args={[0.8, 1.1]} />
        <meshStandardMaterial
          color="#1A1A2E"
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>

      {/* Coloured border */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[0.84, 1.14]} />
        <meshBasicMaterial color={borderColor} transparent opacity={highlighted ? 0.9 : 0.5} />
      </mesh>
      <mesh position={[0, 0, 0.003]}>
        <planeGeometry args={[0.76, 1.06]} />
        <meshStandardMaterial color="#1A1A2E" roughness={0.9} />
      </mesh>

      {/* Resource icon */}
      <group position={[0, 0.15, 0.02]} scale={2.5}>
        <ResourceToken3D resource={resource} />
      </group>

      {/* Resource label */}
      <Billboard position={[0, -0.32, 0.02]}>
        <Text
          fontSize={0.11}
          color={colors.accent}
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          {RESOURCE_LABEL[resource]}
        </Text>
      </Billboard>

      {/* Count badge */}
      {count !== undefined && count > 0 && (
        <group position={[0.28, 0.42, 0.03]}>
          <mesh>
            <circleGeometry args={[0.12, 16]} />
            <meshBasicMaterial color={colors.accent} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.12}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            fontWeight={900}
          >
            {String(count)}
          </Text>
        </group>
      )}

      {/* Highlight glow */}
      {highlighted && (
        <pointLight
          color={colors.accent}
          intensity={0.6}
          distance={2}
          decay={2}
        />
      )}
    </group>
  );
}
