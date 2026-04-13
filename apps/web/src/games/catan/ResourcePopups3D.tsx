/**
 * ResourcePopups3D — Floating 3D text popups showing resource gains
 *
 * When a player gains resources (dice roll production), animated "+1 🌾"
 * style popups rise from the producing hex tile and fade out.
 * Driven by the store's productionLog / resourceFeedback entries.
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

import type { ResourceType } from './CatanEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface ResourcePopup3D {
  id: string;
  resource: ResourceType;
  amount: number;
  /** World-space origin (hex centre) */
  position: [number, number, number];
  /** performance.now() at creation */
  startTime: number;
  /** Popup lifetime in ms (default 2000) */
  duration?: number;
  /** Player colour for tint (optional) */
  playerColor?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RESOURCE_LABEL: Record<ResourceType, string> = {
  wood:  'Wood',
  brick: 'Brick',
  sheep: 'Sheep',
  wheat: 'Wheat',
  ore:   'Ore',
};

const RESOURCE_COLOR: Record<ResourceType, string> = {
  wood:  '#22c55e',
  brick: '#ef4444',
  sheep: '#84cc16',
  wheat: '#eab308',
  ore:   '#94a3b8',
};

const DEFAULT_DURATION = 2000;

// ============================================================================
// SINGLE POPUP — animated billboard that rises and fades
// ============================================================================

function PopupToken({ popup }: { popup: ResourcePopup3D }) {
  const groupRef = useRef<THREE.Group>(null);
  const [done, setDone] = useState(false);
  const duration = popup.duration ?? DEFAULT_DURATION;
  const color = popup.playerColor ?? RESOURCE_COLOR[popup.resource];

  useFrame(() => {
    if (!groupRef.current || done) return;
    const now = performance.now();
    const t = Math.min(1, (now - popup.startTime) / duration);

    if (t >= 1) {
      setDone(true);
      groupRef.current.visible = false;
      return;
    }

    // Rise upward
    const rise = t * 1.8;
    groupRef.current.position.set(
      popup.position[0],
      popup.position[1] + 0.5 + rise,
      popup.position[2],
    );

    // Fade out in last 40%
    const opacity = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
    // Scale: pop-in then steady
    const scale = t < 0.1 ? t * 10 : 1;
    groupRef.current.scale.setScalar(Math.max(0.01, scale));

    // Update text opacity via children
    groupRef.current.traverse((child) => {
      if ((child as THREE.Mesh).material) {
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        if (mat.opacity !== undefined) {
          mat.opacity = opacity;
          mat.transparent = true;
        }
      }
    });
  });

  if (done) return null;

  const label = `+${popup.amount} ${RESOURCE_LABEL[popup.resource]}`;

  return (
    <group ref={groupRef} position={popup.position}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Background pill */}
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[1.6, 0.5]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.65} />
        </mesh>

        {/* Coloured accent bar */}
        <mesh position={[-0.72, 0, 0.005]}>
          <planeGeometry args={[0.06, 0.4]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>

        {/* Text */}
        <Text
          position={[0.05, 0, 0.02]}
          fontSize={0.22}
          color={color}
          anchorX="center"
          anchorY="middle"
          fontWeight={800}
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}

// ============================================================================
// MAIN EXPORT — renders all active popups
// ============================================================================

export interface ResourcePopups3DProps {
  popups: ResourcePopup3D[];
}

export default function ResourcePopups3D({ popups }: ResourcePopups3DProps) {
  if (popups.length === 0) return null;
  return (
    <group>
      {popups.map(popup => (
        <PopupToken key={popup.id} popup={popup} />
      ))}
    </group>
  );
}

// ============================================================================
// HELPER — create popup entry
// ============================================================================

let _popupIdCounter = 0;

export function createResourcePopup(
  resource: ResourceType,
  amount: number,
  position: [number, number, number],
  playerColor?: string,
  duration = DEFAULT_DURATION,
): ResourcePopup3D {
  return {
    id: `rpop-${++_popupIdCounter}-${Date.now()}`,
    resource,
    amount,
    position,
    startTime: performance.now(),
    duration,
    playerColor,
  };
}
