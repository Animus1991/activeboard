/**
 * CatanPlacementHighlight.tsx
 * AAA Production Placement Highlighting System.
 * Renders real-time visual feedback for valid/invalid building placements.
 * Event-driven, performant, and mobile-friendly.
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CatanEventBus } from './CatanEventBus';
import { BuildingType } from './CatanEngine';

// Helper function to convert hex coordinates to world coordinates
const hexToWorld = (q: number, r: number): [number, number, number] => {
  const size = 1.0; // HEX_SIZE from CatanBoard3D
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const z = size * (3 / 2 * r);
  return [x, 0, z];
};

interface PlacementHighlightProps {
  type: BuildingType;
  positionId: string;
  isValid: boolean;
  visible: boolean;
}

// Material definitions for valid/invalid states
const VALID_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#10b981', // emerald-500
  transparent: true,
  opacity: 0.6,
  emissive: '#10b981',
  emissiveIntensity: 0.2,
  roughness: 0.4,
  metalness: 0.1,
});

const INVALID_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ef4444', // red-500
  transparent: true,
  opacity: 0.4,
  emissive: '#ef4444',
  emissiveIntensity: 0.1,
  roughness: 0.6,
  metalness: 0.0,
});


// Geometry cache for performance
const geometryCache = new Map<string, THREE.BufferGeometry>();

function getOrCreateGeometry(type: BuildingType): THREE.BufferGeometry {
  if (geometryCache.has(type)) {
    return geometryCache.get(type)!;
  }

  let geometry: THREE.BufferGeometry;

  switch (type) {
    case 'settlement':
      // Small pyramid shape for settlement preview
      geometry = new THREE.ConeGeometry(0.15, 0.3, 6);
      break;
    case 'city':
      // Larger cube shape for city preview
      geometry = new THREE.BoxGeometry(0.25, 0.35, 0.25);
      break;
    case 'road':
      // Thin elongated box for road preview
      geometry = new THREE.BoxGeometry(0.8, 0.02, 0.08);
      break;
    default:
      geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  }

  geometryCache.set(type, geometry);
  return geometry;
}

/**
 * Individual placement highlight mesh with animation
 */
function PlacementHighlightMesh({ type, isValid, visible }: PlacementHighlightProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    return isValid ? VALID_MATERIAL : INVALID_MATERIAL;
  }, [isValid]);

  const geometry = useMemo(() => getOrCreateGeometry(type), [type]);

  // Position calculation based on type
  const position = useMemo(() => {
    // For now, return a default position - this will be updated by the parent component
    return [0, 0.5, 0] as [number, number, number];
  }, []);

  // Rotation animation for visual feedback
  useFrame((state) => {
    if (!meshRef.current || !visible) return;

    // Gentle floating animation
    const time = state.clock.getElapsedTime();
    meshRef.current.position.y = position[1] + Math.sin(time * 2) * 0.05;
    
    // Subtle rotation for road previews
    if (type === 'road') {
      meshRef.current.rotation.z = Math.sin(time * 1.5) * 0.05;
    }
  });

  // Pulse effect when valid
  useFrame((state) => {
    if (!meshRef.current || !visible || !isValid) return;

    const time = state.clock.getElapsedTime();
    const pulse = 1 + Math.sin(time * 3) * 0.1;
    meshRef.current.scale.setScalar(pulse);
  });

  if (!visible) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

/**
 * Container for all placement highlights with event-driven updates
 */
interface PlacementHighlightSystemProps {
  buildMode: { active: BuildingType | null; playerId: string | null };
  validVertexIds: string[];
  validEdgeIds: string[];
  vertices: Array<{ id: string; position: { q: number; r: number } }>;
  edges: Array<{ id: string; vertexIds: [string, string] }>;
}

export function PlacementHighlightSystem({
  buildMode,
  validVertexIds,
  validEdgeIds,
  vertices,
  edges,
}: PlacementHighlightSystemProps) {
  // Track hover state for interaction feedback
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Event-driven hover updates
  useEffect(() => {
    const unsubscribe = CatanEventBus.on('PLACEMENT_PREVIEW', ({ valid, positionId }) => {
      setHoveredId(valid ? positionId : null);
    });

    return unsubscribe;
  }, []);

  // Memoized vertex highlights
  const vertexHighlights = useMemo(() => {
    if (!buildMode.active || (buildMode.active !== 'settlement' && buildMode.active !== 'city')) {
      return [];
    }

    return vertices
      .filter(vertex => validVertexIds.includes(vertex.id))
      .map(vertex => {
        const pos = hexToWorld(vertex.position.q, vertex.position.r);
        return {
          id: vertex.id,
          type: buildMode.active!,
          position: [pos[0], 0.5, pos[2]] as [number, number, number],
          isValid: true,
          visible: true,
          isHovered: hoveredId === vertex.id,
        };
      });
  }, [buildMode.active, validVertexIds, vertices, hoveredId]);

  // Memoized edge highlights
  const edgeHighlights = useMemo(() => {
    if (!buildMode.active || buildMode.active !== 'road') {
      return [];
    }

    return edges
      .filter(edge => validEdgeIds.includes(edge.id))
      .map(edge => {
        // Calculate edge center position
        const v1 = vertices.find(v => v.id === edge.vertexIds[0]);
        const v2 = vertices.find(v => v.id === edge.vertexIds[1]);
        
        if (!v1 || !v2) return null;

        const pos1 = hexToWorld(v1.position.q, v1.position.r);
        const pos2 = hexToWorld(v2.position.q, v2.position.r);
        
        const center = [
          (pos1[0] + pos2[0]) / 2,
          0.1,
          (pos1[2] + pos2[2]) / 2,
        ] as [number, number, number];

        // Calculate rotation for road alignment
        const angle = Math.atan2(pos2[2] - pos1[2], pos2[0] - pos1[0]);

        return {
          id: edge.id,
          type: 'road' as BuildingType,
          position: center,
          rotation: [0, angle + Math.PI / 2, 0] as [number, number, number],
          isValid: true,
          visible: true,
          isHovered: hoveredId === edge.id,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        type: BuildingType;
        position: [number, number, number];
        rotation?: [number, number, number];
        isValid: boolean;
        visible: boolean;
        isHovered: boolean;
      }>;
  }, [buildMode.active, validEdgeIds, edges, vertices, hoveredId]);

  // Combine all highlights with proper typing
  const allHighlights = useMemo(() => {
    return [...vertexHighlights, ...edgeHighlights] as Array<{
      id: string;
      type: BuildingType;
      position: [number, number, number];
      rotation?: [number, number, number];
      isValid: boolean;
      visible: boolean;
      isHovered: boolean;
    }>;
  }, [vertexHighlights, edgeHighlights]);

  return (
    <group>
      {allHighlights.map(highlight => (
        <group key={highlight.id}>
          <PlacementHighlightMesh
            type={highlight.type}
            positionId={highlight.id}
            isValid={highlight.isHovered ? true : highlight.isValid}
            visible={highlight.visible}
          />
          {/* Apply rotation for road highlights */}
          {highlight.type === 'road' && highlight.rotation && (
            <group 
              position={highlight.position} 
              rotation={[highlight.rotation[0], highlight.rotation[1], highlight.rotation[2]]}
            >
              <PlacementHighlightMesh
                type={highlight.type}
                positionId={highlight.id}
                isValid={highlight.isHovered ? true : highlight.isValid}
                visible={false} // Mesh is handled by parent group
              />
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

/**
 * Hook to handle placement preview events
 */
export function usePlacementPreview() {
  const previewPlacement = useCallback((positionId: string, isValid: boolean) => {
    CatanEventBus.dispatch({
      type: 'PLACEMENT_PREVIEW',
      payload: { valid: isValid, positionId }
    });
  }, []);

  const clearPreview = useCallback(() => {
    CatanEventBus.dispatch({
      type: 'PLACEMENT_PREVIEW',
      payload: { valid: false, positionId: '' }
    });
  }, []);

  return { previewPlacement, clearPreview };
}
