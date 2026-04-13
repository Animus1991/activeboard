/**
 * HexTile3D — Single hex terrain tile with PBR materials,
 * volumetric terrain decorations, number token, and robber figurine.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { type HexTile } from './CatanEngine';
import { hexToWorld, createHexShape, HEX_SIZE, TERRAIN_MATS } from './CatanHexUtils';

// ============================================================================
// TERRAIN DECORATIONS — volumetric props per terrain type
// ============================================================================

function ForestProps() {
  const COUNT = 12;
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const cone1Ref = useRef<THREE.InstancedMesh>(null);
  const cone2Ref = useRef<THREE.InstancedMesh>(null);
  const cone3Ref = useRef<THREE.InstancedMesh>(null);

  const trees = useMemo(() =>
    Array.from({ length: COUNT }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.65 + Math.random() * 0.35;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: (0.5 + Math.random() * 0.4) * 2.7,
        rotation: Math.random() * Math.PI,
      };
    }),
  []);

  // Set instance matrices after mount (refs must be populated)
  useEffect(() => {
    if (!trunkRef.current || !cone1Ref.current || !cone2Ref.current || !cone3Ref.current) return;
    const dummy = new THREE.Object3D();
    trees.forEach((t, i) => {
      // Trunk
      dummy.position.set(t.x, 0.08 * t.scale, t.z);
      dummy.scale.setScalar(t.scale);
      dummy.rotation.set(0, t.rotation, 0);
      dummy.updateMatrix();
      trunkRef.current!.setMatrixAt(i, dummy.matrix);

      // Cone layer 1
      dummy.position.set(t.x, 0.28 * t.scale, t.z);
      dummy.updateMatrix();
      cone1Ref.current!.setMatrixAt(i, dummy.matrix);

      // Cone layer 2
      dummy.scale.setScalar(t.scale * 0.78);
      dummy.position.set(t.x, 0.38 * t.scale, t.z);
      dummy.updateMatrix();
      cone2Ref.current!.setMatrixAt(i, dummy.matrix);

      // Cone layer 3
      dummy.scale.setScalar(t.scale * 0.56);
      dummy.position.set(t.x, 0.46 * t.scale, t.z);
      dummy.updateMatrix();
      cone3Ref.current!.setMatrixAt(i, dummy.matrix);
    });
    trunkRef.current.instanceMatrix.needsUpdate = true;
    cone1Ref.current.instanceMatrix.needsUpdate = true;
    cone2Ref.current.instanceMatrix.needsUpdate = true;
    cone3Ref.current.instanceMatrix.needsUpdate = true;
  }, [trees]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, COUNT]} castShadow>
        <cylinderGeometry args={[0.014, 0.022, 0.22, 8]} />
        <meshStandardMaterial color="#4A2E14" roughness={0.96} />
      </instancedMesh>
      <instancedMesh ref={cone1Ref} args={[undefined, undefined, COUNT]} castShadow>
        <coneGeometry args={[0.14, 0.36, 8]} />
        <meshStandardMaterial color="#1E5814" roughness={0.96} />
      </instancedMesh>
      <instancedMesh ref={cone2Ref} args={[undefined, undefined, COUNT]} castShadow>
        <coneGeometry args={[0.11, 0.30, 8]} />
        <meshStandardMaterial color="#2C7820" roughness={0.96} />
      </instancedMesh>
      <instancedMesh ref={cone3Ref} args={[undefined, undefined, COUNT]} castShadow>
        <coneGeometry args={[0.09, 0.24, 8]} />
        <meshStandardMaterial color="#389428" roughness={0.96} />
      </instancedMesh>
    </group>
  );
}

function MountainProps() {
  const peaks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        s: (0.12 + Math.random() * 0.06) * 2.85,
        rot: [Math.random(), Math.random(), Math.random()] as [number, number, number]
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, p.s * 0.7, p.z]}>
          <mesh scale={p.s} rotation={p.rot} castShadow receiveShadow>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#586878" roughness={0.9} flatShading />
          </mesh>
          {p.s > 0.12 && (
            <mesh position={[0, p.s * 0.65, 0]} scale={p.s * 0.65} rotation={p.rot}>
              <icosahedronGeometry args={[1, 0]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.9} flatShading emissive="#DDDDDD" emissiveIntensity={0.2} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function HillsProps() {
  const bricks = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        scale: 3,
        rot: [0, Math.random() * Math.PI, 0] as [number, number, number],
        col: ['#B85428', '#A04018', '#C86438'][Math.floor(Math.random() * 3)],
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {bricks.map((b, i) => (
        <mesh key={i} position={[b.x, 0.04 * b.scale, b.z]} scale={b.scale} rotation={b.rot} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.08, 0.06]} />
          <meshStandardMaterial color={b.col} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function FieldsProps() {
  const GOLDEN_COUNT = 288;
  const LIGHT_COUNT = 192;
  const goldenRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.InstancedMesh>(null);

  const stalks = useMemo(() => {
    const golden: { x: number; z: number; rotX: number; rotZ: number; scaleY: number }[] = [];
    const light: typeof golden = [];
    for (let i = 0; i < GOLDEN_COUNT + LIGHT_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.60 + Math.random() * 0.40;
      const s = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rotX: (Math.random() - 0.5) * 0.3,
        rotZ: (Math.random() - 0.5) * 0.3,
        scaleY: (0.5 + Math.random() * 0.5) * 3,
      };
      if (i < GOLDEN_COUNT) golden.push(s); else light.push(s);
    }
    return { golden, light };
  }, []);

  // Set instance matrices after mount (refs must be populated)
  useEffect(() => {
    if (!goldenRef.current || !lightRef.current) return;
    const dummy = new THREE.Object3D();
    stalks.golden.forEach((s, i) => {
      dummy.position.set(s.x, 0.08 * s.scaleY, s.z);
      dummy.rotation.set(s.rotX, 0, s.rotZ);
      dummy.scale.set(1, s.scaleY, 1);
      dummy.updateMatrix();
      goldenRef.current!.setMatrixAt(i, dummy.matrix);
    });
    stalks.light.forEach((s, i) => {
      dummy.position.set(s.x, 0.08 * s.scaleY, s.z);
      dummy.rotation.set(s.rotX, 0, s.rotZ);
      dummy.scale.set(1, s.scaleY, 1);
      dummy.updateMatrix();
      lightRef.current!.setMatrixAt(i, dummy.matrix);
    });
    goldenRef.current.instanceMatrix.needsUpdate = true;
    lightRef.current.instanceMatrix.needsUpdate = true;
  }, [stalks]);

  return (
    <group>
      <instancedMesh ref={goldenRef} args={[undefined, undefined, GOLDEN_COUNT]} castShadow>
        <cylinderGeometry args={[0.005, 0.008, 0.16, 4]} />
        <meshStandardMaterial color="#E8B830" roughness={0.9} flatShading />
      </instancedMesh>
      <instancedMesh ref={lightRef} args={[undefined, undefined, LIGHT_COUNT]} castShadow>
        <cylinderGeometry args={[0.005, 0.008, 0.16, 4]} />
        <meshStandardMaterial color="#F0C840" roughness={0.9} flatShading />
      </instancedMesh>
    </group>
  );
}

function PastureProps() {
  const sheep = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + (Math.random() * 0.4 - 0.2);
      const radius = 0.65 + Math.random() * 0.25;
      arr.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        rot: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }, []);
  return (
    <group>
      {sheep.map((s, i) => (
        <group key={`sh${i}`} position={[s.x, 0, s.z]} rotation={[0, s.rot, 0]} scale={1.4 * 2.55}>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.04, 0]} castShadow>
            <capsuleGeometry args={[0.035, 0.05, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.97} flatShading />
          </mesh>
          <mesh position={[0.05, 0.06, 0]} castShadow>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1A1A1A" roughness={0.9} flatShading />
          </mesh>
          {[-0.02, 0.02].map((lx, li) => 
            [-0.015, 0.015].map((lz, lji) => (
              <mesh key={`l${li}${lji}`} position={[lx, 0.02, lz]} castShadow>
                <cylinderGeometry args={[0.005, 0.005, 0.04, 4]} />
                <meshStandardMaterial color="#1A1A1A" roughness={0.9} />
              </mesh>
            ))
          )}
        </group>
      ))}
    </group>
  );
}

function DesertProps() {
  const dunes = useMemo(() => {
    const R = 0.86; // flat-top hex inradius (≈ sqrt(3)/2 * size)
    // Compute the half-width of a flat-top hexagon at a given z
    function hexHalfWidth(z: number): number {
      const az = Math.abs(z);
      if (az > R) return 0;
      // Flat-top hex: top/bottom edges at ±R, corners at ±(R * 2/sqrt(3))
      // Width narrows linearly from full at z=0 to 0 at z=±R
      const hw = R * (1 - az / R) * 1.15; // ~1.15 factor for hex geometry
      return Math.min(hw, R);
    }

    const arr: { curve: THREE.CatmullRomCurve3; thickness: number; shade: string }[] = [];
    const rows = [-0.62, -0.46, -0.30, -0.14, 0.02, 0.18, 0.34, 0.50, 0.64];
    const shades = ['#C09338', '#B88530', '#A87422', '#C9A040', '#9A6A1E', '#B88530', '#C09338', '#A87422', '#C9A040'];

    rows.forEach((zBase, ri) => {
      const hw = hexHalfWidth(zBase);
      if (hw < 0.1) return; // skip rows too close to hex tip

      const pts: THREE.Vector3[] = [];
      const amplitude = 0.03 + (ri % 3) * 0.015;
      const freq = 1.8 + (ri % 2) * 0.6;
      const phase = ri * 1.7;
      const steps = 14;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = -hw + 2 * hw * t;
        const wave = Math.sin(t * Math.PI * freq + phase) * amplitude;
        const yLift = 0.003 + Math.sin(t * Math.PI) * 0.004;
        pts.push(new THREE.Vector3(x, yLift, zBase + wave));
      }

      if (pts.length >= 4) {
        arr.push({
          curve: new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5),
          thickness: 0.010 + (ri % 3) * 0.004,
          shade: shades[ri % shades.length],
        });
      }
    });
    return arr;
  }, []);

  return (
    <group>
      {dunes.map((d, i) => (
        <mesh key={`dune${i}`} receiveShadow>
          <tubeGeometry args={[d.curve, 24, d.thickness, 6, false]} />
          <meshStandardMaterial color={d.shade} roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

const TERRAIN_PROPS: Record<string, React.FC> = {
  forest: ForestProps,
  mountains: MountainProps,
  hills: HillsProps,
  fields: FieldsProps,
  pasture: PastureProps,
  desert: DesertProps,
};

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ============================================================================
// NUMBER TOKEN — Animated drop and flip with letter-to-number reveal
// ============================================================================

function AnimatedNumberToken3D({ hex, height }: { hex: HexTile; height: number }) {
  const hot = hex.number === 6 || hex.number === 8;
  const probDots = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 }[hex.number!] || 0;

  const tokenRef = useRef<THREE.Group>(null);
  const startTime = useRef(performance.now());
  const animDone = useRef(false);

  // Staggered timing based on alphabetical letter index
  const letterIndex = hex.letterToken ? hex.letterToken.charCodeAt(0) - 65 : 0;
  const dropDelay = 1.5 + letterIndex * 0.1;
  const dropDuration = 0.6;
  const flipDelay = 4.0 + letterIndex * 0.1;
  const flipDuration = 0.5;

  useFrame(() => {
    if (!tokenRef.current || animDone.current) return;

    const elapsed = (performance.now() - startTime.current) / 1000;

    // Phase 0: Before drop — hide above board
    if (elapsed < dropDelay) {
      tokenRef.current.position.y = 1.5;
      tokenRef.current.rotation.x = 0;
      return;
    }

    // Phase 1: Drop from above with easeOutBack
    if (elapsed < dropDelay + dropDuration) {
      const t = Math.min((elapsed - dropDelay) / dropDuration, 1);
      const eased = easeOutBack(t);
      tokenRef.current.position.y = (1 - eased) * 1.5;
      tokenRef.current.rotation.x = 0;
      return;
    }

    // Phase 2: Resting — showing letter
    if (elapsed < flipDelay) {
      tokenRef.current.position.y = 0;
      tokenRef.current.rotation.x = 0;
      return;
    }

    // Phase 3: Flip to reveal number — arcs upward during flip
    if (elapsed < flipDelay + flipDuration) {
      const t = Math.min((elapsed - flipDelay) / flipDuration, 1);
      const eased = easeInOutQuad(t);
      tokenRef.current.rotation.x = eased * Math.PI;
      tokenRef.current.position.y = Math.sin(eased * Math.PI) * 0.3;
      return;
    }

    // Phase 4: Done — lock final state, stop animating
    tokenRef.current.position.y = 0;
    tokenRef.current.rotation.x = Math.PI;
    animDone.current = true;
  });

  return (
    <group position={[0, height + 0.20, 0]}>
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.19, 0]}>
        <circleGeometry args={[0.35, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} />
      </mesh>

      <group ref={tokenRef}>
        {/* ── LETTER SIDE — faces up initially ── */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.38, 32]} />
          <meshStandardMaterial color="#E8D5B7" roughness={0.5} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
          <ringGeometry args={[0.34, 0.38, 32]} />
          <meshStandardMaterial color="#8B7355" />
        </mesh>
        <Text
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          fontSize={0.4}
          color="#1A1A1A"
          anchorX="center"
          anchorY="middle"
          fontWeight={700}
        >
          {hex.letterToken || '?'}
        </Text>

        {/* ── NUMBER SIDE — faces down initially, faces up after flip ── */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
          <circleGeometry args={[0.38, 32]} />
          <meshStandardMaterial color={hot ? '#FFF5E0' : '#FEFCF5'} roughness={0.5} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.006, 0]}>
          <ringGeometry args={[0.34, 0.38, 32]} />
          <meshStandardMaterial color={hot ? '#C04040' : '#8A7A60'} />
        </mesh>
        <Text
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          fontSize={0.4}
          color={hot ? '#CC0000' : '#1A1A1A'}
          anchorX="center"
          anchorY="middle"
          fontWeight={hot ? 900 : 700}
        >
          {String(hex.number)}
        </Text>
        <Text
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0.22]}
          fontSize={0.10}
          color={hot ? '#CC0000' : '#555555'}
          anchorX="center"
          anchorY="middle"
        >
          {'•'.repeat(probDots)}
        </Text>
      </group>
    </group>
  );
}

// ============================================================================
// MAIN EXPORT — HexTile3D
// ============================================================================

export interface HexTile3DProps {
  hex: HexTile;
  onHexClick?: (hexId: number) => void;
}

export default function HexTile3D({ hex, onHexClick }: HexTile3DProps) {
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => hexToWorld(hex.position.q, hex.position.r), [hex.position]);
  const mat = TERRAIN_MATS[hex.terrain] || TERRAIN_MATS.desert;

  const hexShape = useMemo(() => createHexShape(HEX_SIZE), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  }), [mat.height]);

  return (
    <group position={[pos[0], 0, pos[2]]}>
      {/* Hex body */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={() => onHexClick?.(hex.id)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow receiveShadow
      >
        <extrudeGeometry args={[hexShape, extrudeSettings]} />
        <meshStandardMaterial
          color={mat.base}
          roughness={mat.roughness}
          metalness={mat.metalness}
          emissive={hovered ? '#4A3000' : mat.emissive}
          emissiveIntensity={hovered ? 0.5 : 0.15}
        />
      </mesh>

      {/* Top surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.012, 0]} receiveShadow>
        <shapeGeometry args={[hexShape]} />
        <meshStandardMaterial
          color={mat.top}
          roughness={0.85}
          metalness={0.0}
          emissive={mat.emissive}
          emissiveIntensity={0.18}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>

      {/* 3D Terrain decorations */}
      {TERRAIN_PROPS[hex.terrain] && (
        <group position={[0, mat.height + 0.01, 0]}>
          {(() => { const Comp = TERRAIN_PROPS[hex.terrain]; return <Comp />; })()}
        </group>
      )}

      {/* Number token */}
      {hex.number && !hex.hasRobber && (
        <AnimatedNumberToken3D hex={hex} height={mat.height} />
      )}

      {/* Robber figurine */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <meshBasicMaterial color="#1A0800" transparent opacity={0.28} />
          </mesh>
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.20, 0.24, 0.08, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.94} metalness={0.0} />
          </mesh>
          <mesh position={[0, 0.26, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.32, 12, 20]} />
            <meshStandardMaterial color="#201410" roughness={0.96} metalness={0.0} emissive="#080404" emissiveIntensity={0.08} />
          </mesh>
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.11, 20, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.96} metalness={0.0} />
          </mesh>
          <mesh position={[0, 0.68, 0]} castShadow>
            <coneGeometry args={[0.10, 0.18, 16]} />
            <meshStandardMaterial color="#18080A" roughness={0.96} metalness={0.0} />
          </mesh>
        </group>
      )}
    </group>
  );
}
