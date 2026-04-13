/**
 * Water3D — Ocean layers and sea-frame border tiles.
 *
 * Exports:
 *  - Water3D (default) — combines Ocean + SeaFrame into one group
 */

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';

import { hexToWorld, createHexShape, HEX_SIZE, SEA_FRAME_POSITIONS } from './CatanHexUtils';

// ============================================================================
// SEA FRAME — ring of 18 hex tiles bordering the island
// ============================================================================

function SeaFrame() {
  const hexShape = useMemo(() => createHexShape(HEX_SIZE * 0.99), []);
  const borderShape = useMemo(() => createHexShape(HEX_SIZE * 1.002), []);
  const extSettings = useMemo(() => ({ depth: 0.08, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2 }), []);
  const borderSettings = useMemo(() => ({ depth: 0.085, bevelEnabled: false }), []);

  return (
    <>
      {SEA_FRAME_POSITIONS.map((pos, i) => {
        const [wx, , wz] = hexToWorld(pos.q, pos.r);
        const hueShift = (i * 7) % 18;
        const r = 0.10 + hueShift * 0.002;
        const g = 0.32 + hueShift * 0.004;
        const b = 0.55 + hueShift * 0.006;
        return (
          <group key={i} position={[wx, -0.010, wz]}>
            {/* Gold trim border */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
              <extrudeGeometry args={[borderShape, borderSettings]} />
              <meshStandardMaterial color="#6A5020" roughness={0.45} metalness={0.50} emissive="#2A1808" emissiveIntensity={0.10} />
            </mesh>
            {/* Sea tile body */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <extrudeGeometry args={[hexShape, extSettings]} />
              <meshStandardMaterial
                color={new THREE.Color(r, g, b)}
                roughness={0.22}
                metalness={0.28}
                emissive={new THREE.Color(r * 0.3, g * 0.3, b * 0.3)}
                emissiveIntensity={0.15}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ============================================================================
// OCEAN — multi-layer water disc surrounding the board
// ============================================================================

// ============================================================================
// ANIMATED OCEAN SHADER — vertex displacement + color shifting
// ============================================================================

const OCEAN_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv2;
  varying float vElevation;

  void main() {
    vUv2 = uv;
    vec3 pos = position;
    float wave1 = sin(pos.x * 1.5 + uTime * 0.8) * 0.06;
    float wave2 = sin(pos.y * 2.0 + uTime * 0.6) * 0.04;
    float wave3 = sin((pos.x + pos.y) * 3.0 + uTime * 1.2) * 0.02;
    float elevation = wave1 + wave2 + wave3;
    vElevation = elevation;
    csm_Position = pos + normal * elevation;
  }
`;

const OCEAN_FRAGMENT = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv2;
  varying float vElevation;

  void main() {
    vec3 deepColor = vec3(0.10, 0.28, 0.47);
    vec3 shallowColor = vec3(0.16, 0.53, 0.69);
    vec3 foamColor = vec3(0.78, 0.85, 0.91);

    float depth = length(vUv2 - 0.5) * 2.0;
    vec3 color = mix(shallowColor, deepColor, depth);

    float foamLine = smoothstep(0.03, 0.06, vElevation);
    color = mix(color, foamColor, foamLine * 0.3);

    float shimmer = sin(vUv2.x * 40.0 + uTime * 2.0) * sin(vUv2.y * 40.0 + uTime * 1.5);
    color += vec3(shimmer * 0.02);

    csm_DiffuseColor = vec4(color, 0.85);
  }
`;

function AnimatedOceanSurface() {
  const material = useMemo(() => {
    return new CustomShaderMaterial({
      baseMaterial: THREE.MeshStandardMaterial,
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
      },
      transparent: true,
      roughness: 0.15,
      metalness: 0.25,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame(({ clock }) => {
    if (material.uniforms.uTime) {
      material.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.012, 0]} receiveShadow material={material}>
      <circleGeometry args={[14.5, 128, 0, Math.PI * 2]} />
    </mesh>
  );
}

function Ocean() {
  return (
    <>
      {/* Layer 1: Deep ocean base (static fallback) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.030, 0]} receiveShadow>
        <circleGeometry args={[14.5, 80]} />
        <meshStandardMaterial
          color="#1A4878"
          roughness={0.12}
          metalness={0.20}
          emissive="#0A2848"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Animated shader ocean surface */}
      <AnimatedOceanSurface />

      {/* Layer 3: Shallow coastal water */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.008, 0]}>
        <ringGeometry args={[5.8, 7.8, 80]} />
        <meshStandardMaterial
          color="#2888B0"
          roughness={0.18}
          metalness={0.12}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Layer 4: Static foam ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <ringGeometry args={[5.4, 5.9, 80]} />
        <meshStandardMaterial
          color="#C8D8E8"
          roughness={0.90}
          metalness={0.0}
          transparent
          opacity={0.20}
          emissive="#607080"
          emissiveIntensity={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function Water3D() {
  return (
    <group>
      <SeaFrame />
      <Ocean />
    </group>
  );
}
