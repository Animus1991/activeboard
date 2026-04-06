/**
 * TableForge - Monopoly 3D Board Component
 * Full 3D rendering of the Monopoly board with React Three Fiber
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { 
  OrbitControls, 
  Text, 
  RoundedBox,
  PerspectiveCamera,
  Html
} from '@react-three/drei';
import * as THREE from 'three';
import { 
  BOARD_SPACES, 
  type GameState, 
  type BoardSpace,
  type PropertySpace,
  type Player,
  type Property,
  getProperty,
} from './MonopolyEngine';

// ============================================================================
// CONSTANTS
// ============================================================================

const BOARD_SIZE = 11;
const SPACE_SIZE = 1;
const BOARD_THICKNESS = 0.1;
const HOUSE_SIZE = 0.12;
const HOTEL_SIZE = 0.15;
const TOKEN_SIZE = 0.15;

const COLOR_MAP: Record<string, string> = {
  brown: '#8B4513',
  lightBlue: '#87CEEB',
  pink: '#FF69B4',
  orange: '#FFA500',
  red: '#FF0000',
  yellow: '#FFD700',
  green: '#228B22',
  darkBlue: '#00008B',
  railroad: '#4A4A4A',
  utility: '#808080',
  special: '#F5F5DC',
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface BoardSpaceProps {
  space: BoardSpace;
  position: [number, number, number];
  rotation: number;
  property?: Property;
  isCorner?: boolean;
}

function BoardSpaceMesh({ space, position, rotation, property, isCorner }: BoardSpaceProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const spaceWidth = isCorner ? SPACE_SIZE * 1.5 : SPACE_SIZE;
  const spaceDepth = isCorner ? SPACE_SIZE * 1.5 : SPACE_SIZE * 0.6;

  const colorBarHeight = 0.15;
  const hasColorBar = space.type === 'property' && space.color !== 'special';

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Base */}
      <mesh
        ref={meshRef}
        position={[0, BOARD_THICKNESS / 2, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[spaceWidth, BOARD_THICKNESS, spaceDepth]} />
        <meshStandardMaterial 
          color={hovered ? '#E8E8E8' : '#F5F5DC'} 
          roughness={0.8}
        />
      </mesh>

      {/* Color bar for properties */}
      {hasColorBar && (
        <mesh position={[0, BOARD_THICKNESS + 0.01, spaceDepth / 2 - colorBarHeight / 2]}>
          <boxGeometry args={[spaceWidth - 0.02, 0.02, colorBarHeight]} />
          <meshStandardMaterial 
            color={COLOR_MAP[space.color] || '#888888'} 
            roughness={0.5}
          />
        </mesh>
      )}

      {/* Property name */}
      <Text
        position={[0, BOARD_THICKNESS + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={isCorner ? 0.12 : 0.08}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        maxWidth={spaceWidth - 0.1}
      >
        {space.name}
      </Text>

      {/* Price for purchasable properties */}
      {(space.type === 'property' || space.type === 'railroad' || space.type === 'utility') && (
        <Text
          position={[0, BOARD_THICKNESS + 0.02, -spaceDepth / 2 + 0.1]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.06}
          color="#666666"
          anchorX="center"
          anchorY="middle"
        >
          ${(space as PropertySpace).price}
        </Text>
      )}

      {/* Houses/Hotel */}
      {property && property.houses > 0 && (
        <HousesDisplay 
          houses={property.houses} 
          position={[0, BOARD_THICKNESS + 0.05, spaceDepth / 2 - 0.2]}
          spaceWidth={spaceWidth}
        />
      )}

      {/* Mortgage indicator */}
      {property?.isMortgaged && (
        <mesh position={[0, BOARD_THICKNESS + 0.05, 0]}>
          <planeGeometry args={[spaceWidth * 0.8, spaceDepth * 0.8]} />
          <meshBasicMaterial color="#FF0000" opacity={0.3} transparent />
        </mesh>
      )}
    </group>
  );
}

interface HousesDisplayProps {
  houses: number;
  position: [number, number, number];
  spaceWidth: number;
}

function HousesDisplay({ houses, position, spaceWidth }: HousesDisplayProps) {
  if (houses === 5) {
    // Hotel
    return (
      <mesh position={position}>
        <boxGeometry args={[HOTEL_SIZE, HOTEL_SIZE, HOTEL_SIZE]} />
        <meshStandardMaterial color="#FF0000" roughness={0.5} />
      </mesh>
    );
  }

  // Houses
  const housePositions = [];
  const spacing = (spaceWidth - 0.2) / 4;
  const startX = -spaceWidth / 2 + 0.15;

  for (let i = 0; i < houses; i++) {
    housePositions.push(startX + i * spacing);
  }

  return (
    <group position={position}>
      {housePositions.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <boxGeometry args={[HOUSE_SIZE, HOUSE_SIZE, HOUSE_SIZE]} />
          <meshStandardMaterial color="#00AA00" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

interface PlayerTokenProps {
  player: Player;
  players: Player[];
  index: number;
}

function PlayerToken({ player, players, index }: PlayerTokenProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  // Position is calculated in useMemo, no state needed

  // Calculate position based on board space
  const position = useMemo(() => {
    const spacePos = getSpacePosition(player.position);
    
    // Offset for multiple players on same space
    const playersOnSpace = players.filter(p => p.position === player.position && !p.isBankrupt);
    const playerIndex = playersOnSpace.findIndex(p => p.id === player.id);
    const offsetX = (playerIndex % 2) * 0.2 - 0.1;
    const offsetZ = Math.floor(playerIndex / 2) * 0.2 - 0.1;

    return [
      spacePos[0] + offsetX,
      TOKEN_SIZE / 2 + BOARD_THICKNESS + 0.1,
      spacePos[2] + offsetZ,
    ] as [number, number, number];
  }, [player.position, players, index]);

  // Animate movement
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(
        new THREE.Vector3(...position),
        0.1
      );
      meshRef.current.rotation.y += 0.01;
    }
  });

  if (player.isBankrupt) return null;

  return (
    <mesh ref={meshRef} position={position}>
      <cylinderGeometry args={[TOKEN_SIZE, TOKEN_SIZE * 0.8, TOKEN_SIZE * 1.5, 8]} />
      <meshStandardMaterial 
        color={player.color} 
        roughness={0.3}
        metalness={0.5}
      />
    </mesh>
  );
}

interface DiceProps {
  values: [number, number] | null;
  rolling: boolean;
}

function Dice({ values, rolling }: DiceProps) {
  const dice1Ref = useRef<THREE.Mesh>(null);
  const dice2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (rolling) {
      if (dice1Ref.current) {
        dice1Ref.current.rotation.x += 0.3;
        dice1Ref.current.rotation.y += 0.2;
        dice1Ref.current.position.y = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.2;
      }
      if (dice2Ref.current) {
        dice2Ref.current.rotation.x += 0.25;
        dice2Ref.current.rotation.z += 0.3;
        dice2Ref.current.position.y = 1 + Math.sin(state.clock.elapsedTime * 10 + 1) * 0.2;
      }
    }
  });

  const diceSize = 0.3;

  return (
    <group position={[0, 0.5, 0]}>
      <RoundedBox
        ref={dice1Ref}
        args={[diceSize, diceSize, diceSize]}
        radius={0.03}
        position={[-0.25, 1, 0]}
      >
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </RoundedBox>
      <RoundedBox
        ref={dice2Ref}
        args={[diceSize, diceSize, diceSize]}
        radius={0.03}
        position={[0.25, 1, 0]}
      >
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </RoundedBox>

      {values && !rolling && (
        <Html position={[0, 1.5, 0]} center>
          <div className="bg-black/80 text-white px-3 py-1 rounded-lg text-lg font-bold">
            {values[0]} + {values[1]} = {values[0] + values[1]}
          </div>
        </Html>
      )}
    </group>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getSpacePosition(spaceId: number): [number, number, number] {
  const halfBoard = (BOARD_SIZE - 1) / 2;
  const cornerSize = SPACE_SIZE * 1.5;
  const regularSize = SPACE_SIZE;

  // Bottom row (0-10)
  if (spaceId <= 10) {
    if (spaceId === 0) {
      return [halfBoard * regularSize, 0, halfBoard * regularSize];
    }
    if (spaceId === 10) {
      return [-halfBoard * regularSize, 0, halfBoard * regularSize];
    }
    const x = halfBoard * regularSize - cornerSize / 2 - (spaceId - 0.5) * regularSize * 0.8;
    return [x, 0, halfBoard * regularSize];
  }

  // Left column (11-19)
  if (spaceId <= 19) {
    const z = halfBoard * regularSize - cornerSize / 2 - (spaceId - 10.5) * regularSize * 0.8;
    return [-halfBoard * regularSize, 0, z];
  }

  // Top row (20-30)
  if (spaceId <= 30) {
    if (spaceId === 20) {
      return [-halfBoard * regularSize, 0, -halfBoard * regularSize];
    }
    if (spaceId === 30) {
      return [halfBoard * regularSize, 0, -halfBoard * regularSize];
    }
    const x = -halfBoard * regularSize + cornerSize / 2 + (spaceId - 20.5) * regularSize * 0.8;
    return [x, 0, -halfBoard * regularSize];
  }

  // Right column (31-39)
  const z = -halfBoard * regularSize + cornerSize / 2 + (spaceId - 30.5) * regularSize * 0.8;
  return [halfBoard * regularSize, 0, z];
}

function getSpaceRotation(spaceId: number): number {
  if (spaceId <= 10) return 0;
  if (spaceId <= 19) return Math.PI / 2;
  if (spaceId <= 30) return Math.PI;
  return -Math.PI / 2;
}

// ============================================================================
// MAIN BOARD COMPONENT
// ============================================================================

interface MonopolyBoard3DProps {
  gameState: GameState;
  onSpaceClick?: (spaceId: number) => void;
  rolling?: boolean;
}

function BoardContent({ gameState, rolling }: MonopolyBoard3DProps) {
  const boardRef = useRef<THREE.Group>(null);

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.3} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[8, 12, 8]} fov={50} />
      <OrbitControls 
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={5}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.2}
      />

      {/* Sky/background color */}
      <color attach="background" args={['#1a1a2e']} />
      <fog attach="fog" args={['#1a1a2e', 15, 30]} />

      {/* Board base */}
      <group ref={boardRef}>
        {/* Main board surface */}
        <mesh position={[0, 0, 0]} receiveShadow>
          <boxGeometry args={[BOARD_SIZE + 1, BOARD_THICKNESS, BOARD_SIZE + 1]} />
          <meshStandardMaterial color="#C4A484" roughness={0.9} />
        </mesh>

        {/* Center area */}
        <mesh position={[0, BOARD_THICKNESS / 2 + 0.01, 0]}>
          <boxGeometry args={[BOARD_SIZE - 2, 0.01, BOARD_SIZE - 2]} />
          <meshStandardMaterial color="#E8DCC8" roughness={0.8} />
        </mesh>

        {/* Monopoly logo in center */}
        <Text
          position={[0, BOARD_THICKNESS + 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="#B22222"
          anchorX="center"
          anchorY="middle"
        >
          MONOPOLY
        </Text>

        {/* Board spaces */}
        {BOARD_SPACES.map((space, index) => {
          const isCorner = [0, 10, 20, 30].includes(index);
          const position = getSpacePosition(index);
          const rotation = getSpaceRotation(index);
          const property = getProperty(gameState, index);

          return (
            <BoardSpaceMesh
              key={space.id}
              space={space}
              position={position}
              rotation={rotation}
              property={property}
              isCorner={isCorner}
            />
          );
        })}

        {/* Player tokens */}
        {gameState.players.map((player, index) => (
          <PlayerToken
            key={player.id}
            player={player}
            players={gameState.players}
            index={index}
          />
        ))}

        {/* Dice */}
        <Dice values={gameState.diceRoll} rolling={rolling || false} />
      </group>

      {/* Table surface */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[30, 30]} />
        <meshStandardMaterial color="#2D5016" roughness={0.9} />
      </mesh>
    </>
  );
}

export default function MonopolyBoard3D(props: MonopolyBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <Canvas shadows gl={{ antialias: true }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <BoardContent {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
