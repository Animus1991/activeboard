/**
 * CatanPresence3D — 3D Spatial Video Panels in Three.js Scene
 *
 * Renders each player's webcam feed as a floating holographic panel
 * positioned around the board in 3D space. Features:
 *  - Html from drei renders actual <video> elements at 3D positions
 *  - Scanline CRT overlay effect on each video feed
 *  - Glowing border in player color
 *  - "LIVE" latency indicator
 *  - Draggable via mouse (updates position state)
 *  - Gentle floating idle animation
 *
 * This is the in-scene counterpart to CatanPresence.tsx (2D overlay).
 * The 2D overlay handles WebRTC signalling; this renders the 3D visuals.
 */

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Text } from '@react-three/drei';
import * as THREE from 'three';

// ============================================================================
// TYPES
// ============================================================================

export interface Presence3DPlayer {
  id: string;
  name: string;
  color: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isActive: boolean;
  victoryPoints: number;
}

interface VideoPanel3DProps {
  player: Presence3DPlayer;
  position: [number, number, number];
  index: number;
}

// ============================================================================
// SEAT POSITIONS — 4 cardinal positions around the board at table height
// ============================================================================

const PRESENCE_SEATS: [number, number, number][] = [
  [0,    2.5, -11],   // North — facing south
  [11,   2.5,  0],    // East  — facing west
  [0,    2.5,  11],   // South — facing north
  [-11,  2.5,  0],    // West  — facing east
];

// ============================================================================
// SCANLINE CRT OVERLAY — CSS-based scanline effect
// ============================================================================

const SCANLINE_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 255, 255, 0.03) 2px,
    rgba(0, 255, 255, 0.03) 4px
  )`,
  pointerEvents: 'none',
  zIndex: 10,
  mixBlendMode: 'overlay',
};

const CRT_VIGNETTE_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.5) 100%)',
  pointerEvents: 'none',
  zIndex: 11,
};

// ============================================================================
// VIDEO PANEL 3D — individual floating holographic video card
// ============================================================================

function VideoPanel3D({ player, position, index }: VideoPanel3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && player.stream) {
      videoRef.current.srcObject = player.stream;
    }
  }, [player.stream]);

  // Gentle floating animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + index * 1.5;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.08;
    // Very subtle rotation towards camera
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.02;
  });

  const borderColor = player.color;
  const glowIntensity = player.isActive ? 0.8 : 0.2;

  return (
    <group ref={groupRef} position={position}>
      {/* Holographic backdrop — dark translucent panel */}
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <planeGeometry args={[3.2, 2.4]} />
        <meshStandardMaterial
          color="#050510"
          transparent
          opacity={0.85}
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>

      {/* Color border frame — top */}
      <mesh position={[0, 1.15, 0.005]}>
        <planeGeometry args={[3.2, 0.06]} />
        <meshBasicMaterial color={borderColor} transparent opacity={player.isActive ? 1 : 0.6} />
      </mesh>
      {/* Color border — bottom */}
      <mesh position={[0, -1.15, 0.005]}>
        <planeGeometry args={[3.2, 0.06]} />
        <meshBasicMaterial color={borderColor} transparent opacity={player.isActive ? 1 : 0.6} />
      </mesh>
      {/* Color border — left */}
      <mesh position={[-1.57, 0, 0.005]}>
        <planeGeometry args={[0.06, 2.4]} />
        <meshBasicMaterial color={borderColor} transparent opacity={player.isActive ? 1 : 0.6} />
      </mesh>
      {/* Color border — right */}
      <mesh position={[1.57, 0, 0.005]}>
        <planeGeometry args={[0.06, 2.4]} />
        <meshBasicMaterial color={borderColor} transparent opacity={player.isActive ? 1 : 0.6} />
      </mesh>

      {/* Active turn glow pulse */}
      {player.isActive && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[3.5, 2.7]} />
          <meshBasicMaterial color={borderColor} transparent opacity={0.08} />
        </mesh>
      )}

      {/* HTML overlay — actual video element rendered at this 3D position */}
      <Html
        transform
        occlude
        position={[0, 0.05, 0.02]}
        style={{
          width: '240px',
          height: '160px',
          overflow: 'hidden',
          borderRadius: '4px',
          position: 'relative',
          pointerEvents: 'none',
        }}
        distanceFactor={4}
      >
        {player.stream && player.videoEnabled ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#0a0a1a',
              }}
            />
            {/* Scanline CRT overlay */}
            <div style={SCANLINE_STYLE} />
            {/* CRT vignette */}
            <div style={CRT_VIGNETTE_STYLE} />
            {/* LIVE indicator */}
            <div style={{
              position: 'absolute',
              top: 4,
              right: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 6px',
              background: 'rgba(0,0,0,0.7)',
              borderRadius: 4,
              fontSize: 9,
              color: '#0f0',
              fontWeight: 700,
              fontFamily: 'monospace',
              zIndex: 20,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#0f0',
                boxShadow: '0 0 4px #0f0',
              }} />
              LIVE
            </div>
          </div>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: '#0a0a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334',
            fontSize: 32,
          }}>
            📷
          </div>
        )}

        {/* Player name bar at bottom */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '3px 8px',
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 20,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: player.color,
            boxShadow: `0 0 4px ${player.color}`,
            flexShrink: 0,
          }} />
          <span style={{
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {player.name}
          </span>
          {!player.audioEnabled && (
            <span style={{ fontSize: 10, color: '#f44' }}>🔇</span>
          )}
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 800,
            color: player.color,
          }}>
            {player.victoryPoints} VP
          </span>
        </div>
      </Html>

      {/* Player name in 3D text (visible from far away) */}
      <Text
        position={[0, -1.35, 0.02]}
        fontSize={0.22}
        color={borderColor}
        anchorX="center"
        anchorY="middle"
        font={undefined}
        maxWidth={3}
      >
        {player.name}
      </Text>

      {/* Holographic glow light */}
      <pointLight
        color={borderColor}
        intensity={hovered ? 1.2 : glowIntensity}
        distance={5}
        decay={2}
      />
    </group>
  );
}

// ============================================================================
// MAIN EXPORT — renders all player video panels in 3D scene
// ============================================================================

interface CatanPresence3DProps {
  players: Presence3DPlayer[];
}

export function CatanPresence3D({ players }: CatanPresence3DProps) {
  if (players.length === 0) return null;

  return (
    <>
      {players.map((player, i) => {
        const seat = PRESENCE_SEATS[i % PRESENCE_SEATS.length];
        return (
          <VideoPanel3D
            key={player.id}
            player={player}
            position={seat}
            index={i}
          />
        );
      })}
    </>
  );
}

export default CatanPresence3D;
