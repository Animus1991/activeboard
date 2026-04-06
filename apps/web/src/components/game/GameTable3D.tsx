import { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  Grid, 
  Environment, 
  PerspectiveCamera,
  Html,
} from '@react-three/drei';
import * as THREE from 'three';

// Types
interface GamePiece {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  isSelected: boolean;
  ownerId: string;
}

interface TerrainPiece {
  id: string;
  type: 'ruin' | 'crater' | 'forest' | 'building' | 'barricade' | 'hill';
  position: [number, number, number];
  scale: [number, number, number];
}

interface GameTable3DProps {
  pieces: GamePiece[];
  terrain: TerrainPiece[];
  onPieceSelect: (pieceId: string | null) => void;
  onPieceMove: (pieceId: string, position: [number, number, number]) => void;
  selectedPieceId: string | null;
  isTableMode?: boolean; // Touch table vs remote view
  showMeasurements?: boolean;
}

// Individual game piece (miniature)
function Miniature({ 
  piece, 
  isSelected, 
  onSelect,
  onMove,
}: { 
  piece: GamePiece; 
  isSelected: boolean;
  onSelect: () => void;
  onMove: (position: [number, number, number]) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<THREE.Vector3 | null>(null);
  const { camera, gl } = useThree();

  // Drag and drop logic
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!meshRef.current || !dragOffset) return;

      // Convert screen coordinates to world coordinates
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // Intersect with ground plane (y=0)
      const planeNormal = new THREE.Vector3(0, 1, 0);
      const plane = new THREE.Plane(planeNormal, 0);
      const intersection = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, intersection);

      if (intersection) {
        const newPosition: [number, number, number] = [
          intersection.x - dragOffset.x,
          0,
          intersection.z - dragOffset.z
        ];
        meshRef.current.position.set(...newPosition);
        onMove(newPosition);
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragOffset(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragOffset, camera, gl, onMove]);

  // Hover effect
  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isDragging ? 1.2 : (hovered || isSelected ? 1.1 : 1);
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.1
      );
    }
  });

  return (
    <group position={piece.position}>
      {/* Base */}
      <mesh
        ref={meshRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            // Shift+click for selection
            onSelect();
          } else {
            // Regular click starts dragging
            setIsDragging(true);
            const clickPoint = e.point.clone();
            const piecePosition = new THREE.Vector3(...piece.position);
            setDragOffset(clickPoint.sub(piecePosition));
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            onSelect();
          }
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        {/* Simple cylinder as placeholder for miniature */}
        <cylinderGeometry args={[0.3, 0.35, 0.1, 16]} />
        <meshStandardMaterial 
          color={piece.color} 
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Body (simple representation) */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.6, 8, 16]} />
        <meshStandardMaterial 
          color={piece.color}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#00ff00" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Name label */}
      {(hovered || isSelected) && (
        <Html
          position={[0, 1.2, 0]}
          center
          distanceFactor={10}
          style={{
            background: 'rgba(0,0,0,0.8)',
            padding: '4px 8px',
            borderRadius: '4px',
            color: 'white',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {piece.name}
        </Html>
      )}
    </group>
  );
}

// Terrain piece
function Terrain({ terrain }: { terrain: TerrainPiece }) {
  const getTerrainGeometry = () => {
    switch (terrain.type) {
      case 'ruin':
        return <boxGeometry args={[2, 1.5, 2]} />;
      case 'crater':
        return <cylinderGeometry args={[1.5, 2, 0.5, 16]} />;
      case 'forest':
        return <coneGeometry args={[1, 3, 8]} />;
      case 'building':
        return <boxGeometry args={[3, 2.5, 3]} />;
      case 'barricade':
        return <boxGeometry args={[3, 0.8, 0.3]} />;
      case 'hill':
        return <sphereGeometry args={[2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />;
      default:
        return <boxGeometry args={[1, 1, 1]} />;
    }
  };

  const getTerrainColor = () => {
    switch (terrain.type) {
      case 'ruin': return '#6b7280';
      case 'crater': return '#44403c';
      case 'forest': return '#166534';
      case 'building': return '#78716c';
      case 'barricade': return '#57534e';
      case 'hill': return '#65a30d';
      default: return '#9ca3af';
    }
  };

  return (
    <mesh
      position={terrain.position}
      scale={terrain.scale}
      castShadow
      receiveShadow
    >
      {getTerrainGeometry()}
      <meshStandardMaterial 
        color={getTerrainColor()}
        roughness={0.9}
        metalness={0.1}
      />
    </mesh>
  );
}

// Measurement tool line
function MeasurementLine({ 
  start, 
  end 
}: { 
  start: [number, number, number]; 
  end: [number, number, number];
}) {
  const points = [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ];
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
  
  // Calculate distance in inches (assuming 1 unit = 1 inch)
  const distance = new THREE.Vector3(...start).distanceTo(new THREE.Vector3(...end));

  return (
    <group>
      <primitive object={new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#ffff00', linewidth: 2 }))} />
      <Html
        position={[
          (start[0] + end[0]) / 2,
          (start[1] + end[1]) / 2 + 0.5,
          (start[2] + end[2]) / 2,
        ]}
        center
        style={{
          background: 'rgba(255,255,0,0.9)',
          padding: '2px 6px',
          borderRadius: '4px',
          color: 'black',
          fontSize: '14px',
          fontWeight: 'bold',
        }}
      >
        {distance.toFixed(1)}"
      </Html>
    </group>
  );
}


// Game board surface
function GameBoard() {
  return (
    <group>
      {/* Main board surface */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.05, 0]}
        receiveShadow
      >
        <planeGeometry args={[48, 48]} />
        <meshStandardMaterial 
          color="#2d4a3e"
          roughness={0.8}
        />
      </mesh>

      {/* Grid overlay */}
      <Grid
        args={[48, 48]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#3f5f4f"
        sectionSize={6}
        sectionThickness={1}
        sectionColor="#4a7a5a"
        fadeDistance={100}
        fadeStrength={1}
        position={[0, 0.01, 0]}
      />

      {/* Board edge */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[50, 0.2, 50]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>
    </group>
  );
}

// Camera controller for different modes
function CameraController({ isTableMode }: { isTableMode: boolean }) {
  const { camera } = useThree();

  useFrame(() => {
    if (isTableMode) {
      // Top-down view for touch table
      camera.position.lerp(new THREE.Vector3(0, 40, 0.1), 0.05);
      camera.lookAt(0, 0, 0);
    }
  });

  return null;
}

// Main component
export function GameTable3D({
  pieces,
  terrain,
  onPieceSelect,
  onPieceMove: _onPieceMove,
  selectedPieceId,
  isTableMode = false,
  showMeasurements: _showMeasurements = true,
}: GameTable3DProps) {
  const [measurementStart, setMeasurementStart] = useState<[number, number, number] | null>(null);
  const [measurementEnd, setMeasurementEnd] = useState<[number, number, number] | null>(null);

  // These will be used in future implementation
  void _onPieceMove;
  void _showMeasurements;
  void setMeasurementStart;
  void setMeasurementEnd;

  return (
    <div className="w-full h-full">
      <Canvas
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        {/* Camera */}
        <PerspectiveCamera
          makeDefault
          position={isTableMode ? [0, 40, 0.1] : [20, 20, 20]}
          fov={isTableMode ? 60 : 50}
        />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={50}
          shadow-camera-left={-30}
          shadow-camera-right={30}
          shadow-camera-top={30}
          shadow-camera-bottom={-30}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.3} />

        {/* Environment */}
        <Environment preset="warehouse" />

        {/* Game board */}
        <GameBoard />

        {/* Terrain */}
        {terrain.map((t) => (
          <Terrain key={t.id} terrain={t} />
        ))}

        {/* Game pieces */}
        {pieces.map((piece) => (
          <Miniature
            key={piece.id}
            piece={piece}
            isSelected={piece.id === selectedPieceId}
            onSelect={() => onPieceSelect(piece.id)}
            onMove={(position) => _onPieceMove(piece.id, position)}
          />
        ))}

        {/* Measurement line */}
        {measurementStart && measurementEnd && (
          <MeasurementLine start={measurementStart} end={measurementEnd} />
        )}

        {/* Controls - disabled for table mode or when dragging */}
        {!isTableMode && (
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            maxPolarAngle={Math.PI / 2.1}
            minDistance={5}
            maxDistance={60}
            enabled={!pieces.some(p => p.isSelected)} // Disable when piece is selected for dragging
          />
        )}

        {/* Camera controller */}
        <CameraController isTableMode={isTableMode} />
      </Canvas>
    </div>
  );
}

export default GameTable3D;
