import { useState, useEffect, useCallback } from 'react';
import { Canvas, ThreeEvent } from '@react-three/fiber';
import { createXRStore, XR } from '@react-three/xr';
import { Sky, Text } from '@react-three/drei';

// Create XR store for VR session management
const xrStore = createXRStore({
  depthSensing: false,
  foveation: 1,
});

// Types
interface GamePiece {
  id: string;
  unitTypeId: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  ownerId: string;
  isSelected: boolean;
  stats: {
    wounds: number;
    maxWounds: number;
  };
}

interface PlayerPresence {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedPieceId: string | null;
  isReady: boolean;
  deviceType: 'touch-table' | 'pc' | 'vr' | 'mobile';
}

interface VRGameRoomProps {
  roomCode: string;
  pieces: GamePiece[];
  players: PlayerPresence[];
  currentPlayerId: string | null;
  myPlayerId: string | null;
  onPieceMove?: (pieceId: string, position: { x: number; y: number; z: number }) => void;
  onPieceSelect?: (pieceId: string | null) => void;
  onRollDice?: (count: number) => void;
}

// VR Table Surface
function VRTable() {
  return (
    <group position={[0, 0.8, 0]}>
      {/* Table top */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[2.4, 0.05, 1.8]} />
        <meshStandardMaterial color="#2d4a3e" roughness={0.8} />
      </mesh>
      
      {/* Table legs */}
      {[[-1.1, -0.4, -0.8], [1.1, -0.4, -0.8], [-1.1, -0.4, 0.8], [1.1, -0.4, 0.8]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.8]} />
          <meshStandardMaterial color="#4a3728" />
        </mesh>
      ))}
      
      {/* Grid lines on table */}
      <gridHelper 
        args={[2.2, 22, '#1a3a2a', '#1a3a2a']} 
        position={[0, 0.03, 0]} 
        rotation={[0, 0, 0]}
      />
    </group>
  );
}

// VR Miniature (clickable)
function VRMiniature({ 
  piece, 
  isMyTurn,
  onSelect,
}: { 
  piece: GamePiece;
  isMyTurn: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isMyTurn) {
      onSelect();
    }
  }, [isMyTurn, onSelect]);

  // Base color based on owner
  const baseColor = piece.isSelected ? '#ffcc00' : (hovered ? '#66aaff' : '#3366cc');
  
  return (
    <group 
      position={[
        piece.position.x, 
        piece.position.y + 0.85, // Offset for table height
        piece.position.z
      ]}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Base */}
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.035, 0.01, 16]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Body */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <capsuleGeometry args={[0.02, 0.05, 8, 16]} />
        <meshStandardMaterial 
          color={baseColor}
          emissive={piece.isSelected ? '#ffcc00' : '#000000'}
          emissiveIntensity={piece.isSelected ? 0.3 : 0}
        />
      </mesh>
      
      {/* Name label (visible in VR) */}
      <Text
        position={[0, 0.12, 0]}
        fontSize={0.02}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.002}
        outlineColor="black"
      >
        {piece.name}
      </Text>
      
      {/* Health bar */}
      {piece.stats.maxWounds > 0 && (
        <group position={[0, 0.1, 0]}>
          <mesh>
            <planeGeometry args={[0.05, 0.008]} />
            <meshBasicMaterial color="#333333" />
          </mesh>
          <mesh position={[-(0.05 - 0.05 * (piece.stats.wounds / piece.stats.maxWounds)) / 2, 0, 0.001]}>
            <planeGeometry args={[0.05 * (piece.stats.wounds / piece.stats.maxWounds), 0.006]} />
            <meshBasicMaterial color={piece.stats.wounds > piece.stats.maxWounds / 2 ? '#00ff00' : '#ff0000'} />
          </mesh>
        </group>
      )}
      
      {/* Selection ring */}
      {piece.isSelected && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.04, 0.05, 32]} />
          <meshBasicMaterial color="#ffcc00" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// VR Player Avatar (shows other players)
function VRPlayerAvatar({ player }: { player: PlayerPresence }) {
  // Position avatars around the table
  const angle = Math.random() * Math.PI * 2;
  const distance = 1.5;
  
  return (
    <group position={[Math.cos(angle) * distance, 1.2, Math.sin(angle) * distance]}>
      {/* Head */}
      <mesh>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={player.color} />
      </mesh>
      
      {/* Name tag */}
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.08}
        color="white"
        anchorX="center"
        anchorY="bottom"
        outlineWidth={0.004}
        outlineColor="black"
      >
        {player.name}
      </Text>
      
      {/* Device indicator */}
      <Text
        position={[0, -0.2, 0]}
        fontSize={0.04}
        color="#aaaaaa"
        anchorX="center"
        anchorY="top"
      >
        {player.deviceType === 'vr' ? '🥽 VR' : 
         player.deviceType === 'touch-table' ? '📱 Table' : 
         player.deviceType === 'pc' ? '💻 PC' : '📱 Mobile'}
      </Text>
    </group>
  );
}

// VR Dice (clickable)
function VRDice({ 
  onRoll,
  position = [0.8, 1.1, 0] as [number, number, number]
}: { 
  onRoll: (count: number) => void;
  position?: [number, number, number];
}) {
  const [hovered, setHovered] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [rotation, setRotation] = useState([0, 0, 0]);
  
  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setRotation([
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
        ]);
      }, 50);
      
      const timeout = setTimeout(() => {
        setRolling(false);
        clearInterval(interval);
      }, 1000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [rolling]);
  
  const handleRoll = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!rolling) {
      setRolling(true);
      onRoll(1);
    }
  }, [rolling, onRoll]);
  
  return (
    <group 
      position={position}
      onClick={handleRoll}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh 
        rotation={rotation as [number, number, number]}
        scale={hovered ? 1.2 : 1}
      >
        <boxGeometry args={[0.05, 0.05, 0.05]} />
        <meshStandardMaterial 
          color={rolling ? '#ff6600' : (hovered ? '#ffcc00' : '#ffffff')}
        />
      </mesh>
      
      <Text
        position={[0, 0.06, 0]}
        fontSize={0.02}
        color="white"
        anchorX="center"
      >
        Roll D6
      </Text>
    </group>
  );
}

// VR UI Panel (floating menu)
function VRUIPanel({ 
  roomCode,
  currentPlayerId,
  myPlayerId,
  players,
}: {
  roomCode: string;
  currentPlayerId: string | null;
  myPlayerId: string | null;
  players: PlayerPresence[];
}) {
  const isMyTurn = currentPlayerId === myPlayerId;
  const currentPlayer = players.find(p => p.id === currentPlayerId);
  
  return (
    <group position={[-1.2, 1.5, -0.5]} rotation={[0, Math.PI / 4, 0]}>
      {/* Panel background */}
      <mesh>
        <planeGeometry args={[0.5, 0.4]} />
        <meshBasicMaterial color="#1a1a2e" transparent opacity={0.9} />
      </mesh>
      
      {/* Room code */}
      <Text
        position={[0, 0.15, 0.01]}
        fontSize={0.03}
        color="#888888"
        anchorX="center"
      >
        Room: {roomCode}
      </Text>
      
      {/* Turn indicator */}
      <Text
        position={[0, 0.08, 0.01]}
        fontSize={0.04}
        color={isMyTurn ? '#00ff00' : '#ffffff'}
        anchorX="center"
      >
        {isMyTurn ? "YOUR TURN" : `${currentPlayer?.name || 'Waiting'}...`}
      </Text>
      
      {/* Player list */}
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.025}
        color="#aaaaaa"
        anchorX="center"
      >
        Players: {players.length}
      </Text>
      
      {players.slice(0, 4).map((player, i) => (
        <Text
          key={player.id}
          position={[0, -0.05 - i * 0.04, 0.01]}
          fontSize={0.02}
          color={player.id === currentPlayerId ? '#ffcc00' : '#666666'}
          anchorX="center"
        >
          {player.name} ({player.deviceType})
        </Text>
      ))}
    </group>
  );
}

// VR Environment
function VREnvironment() {
  return (
    <>
      <Sky sunPosition={[100, 20, 100]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[0, 3, 0]} intensity={0.5} />
      
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#2a2a3a" />
      </mesh>
      
      {/* Walls (subtle) */}
      <mesh position={[0, 2, -5]}>
        <planeGeometry args={[20, 4]} />
        <meshStandardMaterial color="#1a1a2a" />
      </mesh>
    </>
  );
}

// Main VR Scene
function VRScene({
  roomCode,
  pieces,
  players,
  currentPlayerId,
  myPlayerId,
  onPieceSelect,
  onRollDice,
}: Omit<VRGameRoomProps, 'onPieceMove'>) {
  const isMyTurn = currentPlayerId === myPlayerId;
  
  return (
    <>
      <VREnvironment />
      <VRTable />
      
      {/* Render pieces */}
      {pieces.map(piece => (
        <VRMiniature
          key={piece.id}
          piece={piece}
          isMyTurn={isMyTurn}
          onSelect={() => onPieceSelect?.(piece.id)}
        />
      ))}
      
      {/* Render other players */}
      {players
        .filter(p => p.id !== myPlayerId)
        .map(player => (
          <VRPlayerAvatar key={player.id} player={player} />
        ))}
      
      {/* Dice */}
      <VRDice onRoll={(count) => onRollDice?.(count)} />
      
      {/* UI Panel */}
      <VRUIPanel
        roomCode={roomCode}
        currentPlayerId={currentPlayerId}
        myPlayerId={myPlayerId}
        players={players}
      />
    </>
  );
}

// Main VR Game Room Component
export default function VRGameRoom(props: VRGameRoomProps) {
  const [vrSupported, setVrSupported] = useState(false);
  
  useEffect(() => {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then(setVrSupported);
    }
  }, []);

  const handleEnterVR = useCallback(() => {
    xrStore.enterVR();
  }, []);
  
  return (
    <div className="relative w-full h-full">
      {/* VR Button */}
      <div className="absolute top-4 right-4 z-10">
        <button 
          onClick={handleEnterVR}
          disabled={!vrSupported}
          className="px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-500 text-white font-bold rounded-lg shadow-lg transition-colors"
        >
          {vrSupported ? '🥽 Enter VR' : 'VR Not Supported'}
        </button>
      </div>
      
      {/* VR Support indicator */}
      {!vrSupported && (
        <div className="absolute top-4 left-4 z-10 bg-yellow-500/90 text-black px-4 py-2 rounded-lg">
          ⚠️ WebXR not supported - viewing in desktop mode
        </div>
      )}
      
      {/* 3D Canvas with XR */}
      <Canvas
        shadows
        camera={{ position: [0, 2, 3], fov: 60 }}
        gl={{ antialias: true }}
      >
        <XR store={xrStore}>
          <VRScene {...props} />
        </XR>
      </Canvas>
    </div>
  );
}
