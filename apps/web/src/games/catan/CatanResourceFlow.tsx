/**
 * CatanResourceFlow — 3D Resource Animations + Mini Resource Models
 *
 * Ported from ABAS (active_board_ai_studio) and adapted to TF's pure-function
 * architecture. Two exported components:
 *
 * 1. ResourceFlow3D — Animates resource tokens flying in arcs from hex → player
 * 2. Resource3DIcon — Mini Canvas renderer for 3D resource icons in HUD
 *
 * Resource animations are driven by a simple state array managed externally.
 */

import { useRef, useState } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { Environment, Float } from '@react-three/drei';
import * as THREE from 'three';
import type { ResourceType } from './CatanEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface ResourceAnimation {
  id: string;
  resource: ResourceType;
  start: [number, number, number];     // hex world position
  end: [number, number, number];       // target position (e.g. player panel)
  startTime: number;                   // performance.now()
  duration: number;                    // ms
}

// ============================================================================
// RESOURCE MODELS — per-resource 3D geometry
// ============================================================================

const RESOURCE_COLORS: Record<ResourceType, { base: string; emissive: string; light: string }> = {
  wood:  { base: '#5A3310', emissive: '#1A0C00', light: '#8B5E3C' },
  brick: { base: '#C0360C', emissive: '#200800', light: '#E45830' },
  sheep: { base: '#F0F0F0', emissive: '#0A0A0A', light: '#B8E0A0' },
  wheat: { base: '#D4A520', emissive: '#1A1000', light: '#F0D060' },
  ore:   { base: '#485E6A', emissive: '#060C10', light: '#8090A0' },
};

function ResourceTokenModel({ resource }: { resource: ResourceType }) {
  const colors = RESOURCE_COLORS[resource];

  switch (resource) {
    case 'wood':
      return (
        <group>
          <mesh castShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.20, 8]} />
            <meshStandardMaterial color={colors.base} roughness={0.85} />
          </mesh>
          {/* Axe-cut texture ring */}
          <mesh position={[0, 0.10, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.015, 0.038, 12]} />
            <meshStandardMaterial color="#3A2008" roughness={0.95} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    case 'brick':
      return (
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.08, 0.10]} />
          <meshStandardMaterial color={colors.base} roughness={0.88} />
        </mesh>
      );
    case 'sheep':
      return (
        <group>
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
        <group>
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
        <mesh castShadow>
          <dodecahedronGeometry args={[0.07]} />
          <meshStandardMaterial color={colors.base} roughness={0.35} metalness={0.60} />
        </mesh>
      );
    default:
      return null;
  }
}

// ============================================================================
// RESOURCE ANIMATION — flying token with arc, spin, glow
// ============================================================================

function ResourceAnimationToken({ anim }: { anim: ResourceAnimation }) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const colors = RESOURCE_COLORS[anim.resource];
  const [done, setDone] = useState(false);

  useFrame(() => {
    if (!groupRef.current || done) return;
    const now = performance.now();
    const t = Math.min(1, (now - anim.startTime) / anim.duration);

    if (t >= 1) {
      setDone(true);
      groupRef.current.visible = false;
      return;
    }

    // Cubic ease-in-out
    const ease = t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Interpolate position with arc
    const x = anim.start[0] + (anim.end[0] - anim.start[0]) * ease;
    const z = anim.start[2] + (anim.end[2] - anim.start[2]) * ease;
    const arcHeight = 2.5 * Math.sin(t * Math.PI);
    const baseY = anim.start[1] + (anim.end[1] - anim.start[1]) * ease;
    const y = baseY + arcHeight;

    groupRef.current.position.set(x, y, z);

    // Spin
    groupRef.current.rotation.y = t * Math.PI * 4;

    // Scale: grow in, shrink out
    const scale = t < 0.1 ? t * 10 : t > 0.85 ? (1 - t) * 6.67 : 1;
    groupRef.current.scale.setScalar(Math.max(0.01, scale));

    // Point light intensity fading
    if (lightRef.current) {
      lightRef.current.intensity = (1 - t) * 0.8;
    }
  });

  if (done) return null;

  return (
    <group ref={groupRef}>
      <pointLight ref={lightRef} color={colors.light} intensity={0.8} distance={2} decay={2} />
      <ResourceTokenModel resource={anim.resource} />
    </group>
  );
}

// ============================================================================
// RESOURCE FLOW — renders all active animations
// ============================================================================

interface ResourceFlow3DProps {
  animations: ResourceAnimation[];
  onAnimationComplete?: (id: string) => void;
}

export function ResourceFlow3D({ animations }: ResourceFlow3DProps) {
  if (animations.length === 0) return null;
  return (
    <group>
      {animations.map(anim => (
        <ResourceAnimationToken key={anim.id} anim={anim} />
      ))}
    </group>
  );
}

// ============================================================================
// RESOURCE 3D ICON — Mini Canvas for HUD resource icons
// ============================================================================

interface Resource3DIconProps {
  resource: ResourceType;
  size?: number;
  className?: string;
}

export function Resource3DIcon({ resource, size = 40, className }: Resource3DIconProps) {
  return (
    <div style={{ width: size, height: size }} className={className}>
      <Canvas
        frameloop="demand"
        camera={{ position: [0, 0, 0.5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 3, 2]} intensity={1.2} />
        <Environment preset="apartment" background={false} />
        <Float speed={2} rotationIntensity={0.4} floatIntensity={0.2} floatingRange={[-0.02, 0.02]}>
          <ResourceTokenModel resource={resource} />
        </Float>
      </Canvas>
    </div>
  );
}

// ============================================================================
// HELPER — create animation entry
// ============================================================================

let _animIdCounter = 0;

export function createResourceAnimation(
  resource: ResourceType,
  start: [number, number, number],
  end: [number, number, number],
  duration = 1200,
): ResourceAnimation {
  return {
    id: `ranim-${++_animIdCounter}-${Date.now()}`,
    resource,
    start,
    end,
    startTime: performance.now(),
    duration,
  };
}
