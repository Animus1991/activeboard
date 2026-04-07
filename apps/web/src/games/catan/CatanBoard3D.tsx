/**
 * TableForge — Catan 3D Board  (AAA visual rewrite)
 * Cinematic PBR materials · dramatic shadow lighting · ACES tone mapping
 * Multi-layer terrain decorations · harbour ports · animated ocean
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  type GameState,
  type HexTile,
  type Vertex,
} from './CatanEngine';

// ============================================================================
// TERRAIN MATERIALS — PBR-style colors per terrain type
// ============================================================================

// PBR terrain materials — vivid physical board colours + emissive depth
const TERRAIN_MATS: Record<string, { base: string; top: string; emissive: string; height: number }> = {
  forest:    { base: '#1A5C1A', top: '#226622', emissive: '#061806', height: 0.14 },
  hills:     { base: '#A83818', top: '#C04820', emissive: '#3A0E06', height: 0.22 },
  pasture:   { base: '#4EA030', top: '#62B840', emissive: '#122C08', height: 0.08 },
  fields:    { base: '#D4980A', top: '#ECB010', emissive: '#483200', height: 0.07 },
  mountains: { base: '#505C64', top: '#687480', emissive: '#0C1418', height: 0.36 },
  desert:    { base: '#C8A040', top: '#DDB855', emissive: '#362C0C', height: 0.05 },
};

const HEX_SIZE = 1.28;
const HEX_GAP = 0.0;

// ============================================================================
// CANVAS TERRAIN TEXTURES — illustrated board-game style artwork per tile
// ============================================================================

function buildTerrainTexture(terrain: string): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const c = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;

  // Hex clip
  c.save();
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + S * 0.47 * Math.cos(a), py = cy + S * 0.47 * Math.sin(a);
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.clip();

  if (terrain === 'forest') {
    // Background gradient
    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, S * 0.52);
    bg.addColorStop(0, '#4A8C2A'); bg.addColorStop(1, '#1C4C0C');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Ground texture
    c.fillStyle = '#2E6818'; c.fillRect(0, 0, S, S);
    const floor = c.createRadialGradient(cx, cy + 60, 10, cx, cy, S * 0.5);
    floor.addColorStop(0, 'rgba(80,160,30,0.4)'); floor.addColorStop(1, 'rgba(20,80,0,0.0)');
    c.fillStyle = floor; c.fillRect(0, 0, S, S);
    // Draw 7 pine trees
    const treePos = [[cx,cy-60,90],[cx-110,cy+30,70],[cx+110,cy+20,72],[cx-60,cy+90,65],[cx+65,cy+85,62],[cx-130,cy-50,55],[cx+128,cy-40,58]] as [number,number,number][];
    treePos.forEach(([tx, ty, sz]) => {
      // Trunk
      c.fillStyle = '#4A2808';
      c.fillRect(tx - sz*0.07, ty + sz*0.3, sz*0.14, sz*0.35);
      // Three foliage layers
      [[0, 1.0, '#2E7010'], [sz*0.22, 0.78, '#3A8A18'], [sz*0.42, 0.56, '#4AA020']].forEach(([yOff, wm, col]) => {
        c.fillStyle = col as string;
        c.beginPath();
        c.moveTo(tx, ty - (sz as number) + (yOff as number));
        c.lineTo(tx - (sz as number) * (wm as number) * 0.55, ty + (yOff as number) * 0.6);
        c.lineTo(tx + (sz as number) * (wm as number) * 0.55, ty + (yOff as number) * 0.6);
        c.closePath(); c.fill();
        // Shadow side
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.beginPath();
        c.moveTo(tx, ty - (sz as number) + (yOff as number));
        c.lineTo(tx, ty + (yOff as number) * 0.6);
        c.lineTo(tx + (sz as number) * (wm as number) * 0.55, ty + (yOff as number) * 0.6);
        c.closePath(); c.fill();
      });
      // Snow tip
      c.fillStyle = 'rgba(240,248,255,0.82)';
      c.beginPath(); c.moveTo(tx, ty - sz); c.lineTo(tx - sz*0.09, ty - sz + sz*0.12); c.lineTo(tx + sz*0.09, ty - sz + sz*0.12); c.closePath(); c.fill();
    });
  } else if (terrain === 'hills') {
    // Terracotta background
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#D4602A'); bg.addColorStop(1, '#8C2C10');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Rolling clay hills
    [[cx-80,cy+60,180,120,'#C04820'],[cx+90,cy+80,160,110,'#B83A18'],[cx,cy+140,220,90,'#A83018']].forEach(([hx,hy,rw,rh,col]) => {
      c.fillStyle = col as string;
      c.beginPath(); c.ellipse(hx as number, hy as number, rw as number, rh as number, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Brick pattern on centre hill
    c.fillStyle = 'rgba(80,20,0,0.35)';
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const bx = 140 + col * 44 + (row % 2) * 22;
        const by = cy + 30 + row * 20;
        c.fillRect(bx, by, 38, 15);
        c.strokeStyle = '#FF8040'; c.lineWidth = 1; c.strokeRect(bx, by, 38, 15);
      }
    }
    // Light rays
    const ray = c.createRadialGradient(cx, cy - 80, 10, cx, cy - 80, 200);
    ray.addColorStop(0, 'rgba(255,200,100,0.25)'); ray.addColorStop(1, 'rgba(255,200,100,0)');
    c.fillStyle = ray; c.fillRect(0, 0, S, S);
  } else if (terrain === 'pasture') {
    // Bright green background
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#98CC50'); bg.addColorStop(1, '#3A8C18');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Rolling hills
    [[cx-60,cy+80,200,100,'#70B030'],[cx+80,cy+100,180,90,'#60A020'],[cx,cy+160,240,80,'#509018']].forEach(([hx,hy,rw,rh,col]) => {
      c.fillStyle = col as string;
      c.beginPath(); c.ellipse(hx as number, hy as number, rw as number, rh as number, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Fence
    c.fillStyle = '#8B6914'; c.fillRect(80, cy+30, S-160, 8);
    [100, 200, 310, 415].forEach(fx => { c.fillStyle='#8B6914'; c.fillRect(fx, cy+10, 10, 48); });
    // Sheep (4 fluffy white blobs)
    [[cx-80,cy-20],[cx+80,cy-10],[cx-30,cy+40],[cx+40,cy+50]].forEach(([sx,sy]) => {
      c.fillStyle = '#F5F5F5';
      // Body
      c.beginPath(); c.ellipse(sx as number, sy as number, 36, 26, 0, 0, Math.PI*2); c.fill();
      // Fleece bumps
      ['#FFFFFF','#EEEEEE'].forEach((fc, fi) => {
        c.fillStyle = fc;
        [[-18,-10],[0,-18],[18,-10],[-24,0],[24,0]].forEach(([dx,dy]) => {
          c.beginPath(); c.arc((sx as number)+dx, (sy as number)+dy+(fi*3), 14, 0, Math.PI*2); c.fill();
        });
      });
      // Head
      c.fillStyle = '#333333';
      c.beginPath(); c.arc((sx as number)+38, (sy as number)-4, 12, 0, Math.PI*2); c.fill();
      // Eye
      c.fillStyle = '#FFFFFF'; c.beginPath(); c.arc((sx as number)+42, (sy as number)-7, 4, 0, Math.PI*2); c.fill();
      c.fillStyle = '#000'; c.beginPath(); c.arc((sx as number)+43, (sy as number)-7, 2, 0, Math.PI*2); c.fill();
      // Legs
      c.fillStyle = '#888888'; c.strokeStyle='#666'; c.lineWidth=3;
      [[-16,22],[-6,22],[10,22],[20,22]].forEach(([lx,ly]) => { c.beginPath(); c.moveTo((sx as number)+lx,(sy as number)+16); c.lineTo((sx as number)+lx,(sy as number)+ly+16); c.stroke(); });
    });
  } else if (terrain === 'fields') {
    // Golden background
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#ECC030'); bg.addColorStop(0.6, '#C89010'); bg.addColorStop(1, '#8C5E00');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Rows of wheat
    for (let row = 0; row < 7; row++) {
      const ry = 80 + row * 60;
      for (let col = 0; col < 9; col++) {
        const wx = 40 + col * 52 + (row % 2) * 26;
        // Stalk
        c.strokeStyle = '#A87010'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(wx, ry+28); c.lineTo(wx, ry-28); c.stroke();
        // Grain head
        c.fillStyle = '#D4A000';
        c.beginPath(); c.ellipse(wx, ry-36, 5, 18, 0, 0, Math.PI*2); c.fill();
        // Grain segments
        c.fillStyle = '#ECC040';
        for (let k = 0; k < 4; k++) {
          c.beginPath(); c.ellipse(wx + (k%2===0?-4:4), ry-28-k*10, 5, 8, k%2===0?-0.4:0.4, 0, Math.PI*2); c.fill();
        }
      }
    }
    // Warm light overlay
    const glow = c.createRadialGradient(cx, cy-60, 20, cx, cy-60, 220);
    glow.addColorStop(0, 'rgba(255,220,80,0.30)'); glow.addColorStop(1, 'rgba(255,220,80,0)');
    c.fillStyle = glow; c.fillRect(0, 0, S, S);
  } else if (terrain === 'mountains') {
    // Rocky grey background
    const bg = c.createLinearGradient(0, S, 0, 0);
    bg.addColorStop(0, '#364048'); bg.addColorStop(1, '#8090A0');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Mountain peaks (back to front)
    const peaks = [[cx-100,cy+60,100,260,'#5A6870'],[cx+110,cy+50,90,240,'#506068'],[cx,cy+40,110,300,'#687880']] as [number,number,number,number,string][];
    peaks.forEach(([px,py,pw,ph,col]) => {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(px as number, py as number); c.lineTo((px as number)-(pw as number),(py as number)+(ph as number)*0.6); c.lineTo((px as number)+(pw as number),(py as number)+(ph as number)*0.6); c.closePath(); c.fill();
      // Shadow face
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath(); c.moveTo(px as number, py as number); c.lineTo(px as number, (py as number)+(ph as number)*0.6); c.lineTo((px as number)+(pw as number),(py as number)+(ph as number)*0.6); c.closePath(); c.fill();
      // Snow cap
      c.fillStyle = '#ECF2F8';
      c.beginPath(); c.moveTo(px as number, py as number);
      c.lineTo((px as number)-(pw as number)*0.36, (py as number)+(ph as number)*0.22);
      c.lineTo((px as number)+(pw as number)*0.36, (py as number)+(ph as number)*0.22);
      c.closePath(); c.fill();
      c.fillStyle = 'rgba(180,210,240,0.45)';
      c.beginPath(); c.moveTo(px as number, py as number);
      c.lineTo(px as number, (py as number)+(ph as number)*0.22);
      c.lineTo((px as number)+(pw as number)*0.36, (py as number)+(ph as number)*0.22);
      c.closePath(); c.fill();
    });
    // Ore vein hints
    c.strokeStyle = 'rgba(160,180,200,0.5)'; c.lineWidth = 3;
    [[cx-60,cy+120,cx-20,cy+160],[cx+40,cy+110,cx+80,cy+150],[cx-10,cy+150,cx+30,cy+190]].forEach(([x1,y1,x2,y2]) => {
      c.beginPath(); c.moveTo(x1 as number,y1 as number); c.lineTo(x2 as number,y2 as number); c.stroke();
    });
  } else if (terrain === 'desert') {
    // Sandy gradient
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#E8C870'); bg.addColorStop(1, '#B88030');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Sand dunes
    [[cx-60,cy+100,220,70,'#D4A840'],[cx+80,cy+140,200,60,'#C89030'],[cx,cy+180,260,55,'#BC8028']].forEach(([dx,dy,rw,rh,col]) => {
      c.fillStyle = col as string;
      c.beginPath(); c.ellipse(dx as number, dy as number, rw as number, rh as number, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Cactus
    [[cx-60,cy+20],[cx+70,cy+10]].forEach(([tx,ty]) => {
      c.fillStyle = '#3A7840';
      // Main stem
      c.beginPath(); c.roundRect((tx as number)-10,(ty as number)-60,20,80,6); c.fill();
      // Arms
      c.beginPath(); c.roundRect((tx as number)-34,(ty as number)-30,26,10,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)-34,(ty as number)-44,10,22,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)+10,(ty as number)-38,26,10,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)+16,(ty as number)-52,10,22,4); c.fill();
      // Ribs
      c.strokeStyle='rgba(30,80,30,0.4)'; c.lineWidth=2;
      for (let ri=0;ri<4;ri++){c.beginPath();c.moveTo((tx as number)-9,(ty as number)-55+ri*18);c.lineTo((tx as number)+9,(ty as number)-50+ri*18);c.stroke();}
    });
    // Heat shimmer
    const heat = c.createRadialGradient(cx, cy-40, 10, cx, cy-40, 180);
    heat.addColorStop(0,'rgba(255,240,160,0.28)'); heat.addColorStop(1,'rgba(255,240,160,0)');
    c.fillStyle=heat; c.fillRect(0,0,S,S);
  }

  c.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// Cache textures per terrain type (only 6 types total)
const TERRAIN_TEXTURES: Partial<Record<string, THREE.CanvasTexture>> = {};
function getTerrainTexture(terrain: string): THREE.CanvasTexture {
  if (!TERRAIN_TEXTURES[terrain]) TERRAIN_TEXTURES[terrain] = buildTerrainTexture(terrain);
  return TERRAIN_TEXTURES[terrain]!;
}

// Standard Catan harbour definitions — 9 ports, positioned between adjacent border hexes
const HARBOR_DEFS = [
  { hexA: {q:0,  r:-2}, hexB: {q:1,  r:-2}, type: '3:1',   label: '3:1'       },
  { hexA: {q:1,  r:-2}, hexB: {q:2,  r:-2}, type: 'wood',  label: 'Wood\n2:1'  },
  { hexA: {q:2,  r:-2}, hexB: {q:2,  r:-1}, type: '3:1',   label: '3:1'       },
  { hexA: {q:2,  r:-1}, hexB: {q:2,  r:0 }, type: 'ore',   label: 'Ore\n2:1'  },
  { hexA: {q:2,  r:0 }, hexB: {q:1,  r:1 }, type: 'wheat', label: 'Wheat\n2:1'},
  { hexA: {q:0,  r:2 }, hexB: {q:-1, r:2 }, type: '3:1',   label: '3:1'       },
  { hexA: {q:-1, r:2 }, hexB: {q:-2, r:2 }, type: 'brick', label: 'Brick\n2:1'},
  { hexA: {q:-2, r:1 }, hexB: {q:-2, r:0 }, type: 'sheep', label: 'Sheep\n2:1'},
  { hexA: {q:-2, r:0 }, hexB: {q:-1, r:-1}, type: '3:1',   label: '3:1'       },
] as const;

const HARBOR_COLORS: Record<string, string> = {
  '3:1':   '#C8960A',
  'wood':  '#2E7D32',
  'brick': '#C0360C',
  'sheep': '#4C8A28',
  'wheat': '#D49808',
  'ore':   '#485E6A',
};

// Convert axial (q,r) to 3D position
function hexToWorld(q: number, r: number): [number, number, number] {
  const x = HEX_SIZE * (3 / 2 * q) * (1 + HEX_GAP);
  const z = HEX_SIZE * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r) * (1 + HEX_GAP);
  return [x, 0, z];
}

// Create hex shape
function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size * Math.cos(angle);
    const y = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

// ============================================================================
// HEX TILE — 3D terrain tile
// ============================================================================

interface HexTile3DProps {
  hex: HexTile;
  onHexClick?: (hexId: number) => void;
}

function HexTile3D({ hex, onHexClick }: HexTile3DProps) {
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => hexToWorld(hex.position.q, hex.position.r), [hex.position]);
  const mat = TERRAIN_MATS[hex.terrain] || TERRAIN_MATS.desert;

  const hexShape  = useMemo(() => createHexShape(HEX_SIZE), []);
  const seam      = useMemo(() => createHexShape(HEX_SIZE * 1.018), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 3,
  }), [mat.height]);
  const seamSettings = useMemo(() => ({
    depth: mat.height + 0.01,
    bevelEnabled: false,
  }), [mat.height]);

  return (
    <group position={[pos[0], 0, pos[2]]}>
      {/* Dark seam border — renders behind body */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.004, 0]} receiveShadow>
        <extrudeGeometry args={[seam, seamSettings]} />
        <meshStandardMaterial color="#100C06" roughness={1} />
      </mesh>

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
          roughness={0.88}
          metalness={0.02}
          emissive={hovered ? '#442200' : mat.emissive}
          emissiveIntensity={hovered ? 0.5 : 0.35}
        />
      </mesh>

      {/* Top surface — illustrated terrain texture (like real Catan cardboard tile artwork) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.004, 0]} receiveShadow>
        <shapeGeometry args={[hexShape]} />
        <meshStandardMaterial
          map={getTerrainTexture(hex.terrain)}
          roughness={0.78}
          metalness={0.0}
          emissive={mat.emissive}
          emissiveIntensity={0.12}
        />
      </mesh>

      {/* Number token */}
      {hex.number && !hex.hasRobber && (() => {
        const hot = hex.number === 6 || hex.number === 8;
        return (
          <group position={[0, mat.height + 0.12, 0]}>
            {/* Drop shadow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
              <circleGeometry args={[0.50, 32]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.30} />
            </mesh>
            {/* Disc body */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.44, 0.46, 0.08, 32]} />
              <meshStandardMaterial
                color="#F0DCA8"
                roughness={0.52}
                metalness={0.0}
                emissive="#3C2400"
                emissiveIntensity={0.22}
              />
            </mesh>
            {/* Carved rim */}
            <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.445, 0.026, 8, 32]} />
              <meshStandardMaterial color="#5C3A14" roughness={0.72} />
            </mesh>
            {/* Number */}
            <Text
              position={[0, 0.09, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.36}
              color={hot ? '#C41818' : '#2A1604'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.020}
              outlineColor={hot ? '#6A0000' : '#4A2C08'}
            >
              {String(hex.number)}
            </Text>
            {/* Probability dots */}
            <Text
              position={[0, 0.09, 0.25]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.080}
              color={hot ? '#C41818' : '#7A5830'}
              anchorX="center"
              anchorY="middle"
            >
              {'●'.repeat(getProbDots(hex.number))}
            </Text>
          </group>
        );
      })()}

      {/* Robber */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.04, 0]}>
          <mesh position={[0, 0.22, 0]} castShadow>
            <capsuleGeometry args={[0.14, 0.30, 6, 12]} />
            <meshStandardMaterial color="#0E0E0E" roughness={0.45} metalness={0.45} emissive="#1A0000" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color="#0E0E0E" roughness={0.45} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0.68, 0]}>
            <coneGeometry args={[0.14, 0.14, 8]} />
            <meshStandardMaterial color="#1A0000" roughness={0.6} />
          </mesh>
          {([-0.055, 0.055] as number[]).map((ox, i) => (
            <mesh key={i} position={[ox, 0.565, 0.11]}>
              <sphereGeometry args={[0.028, 8, 8]} />
              <meshBasicMaterial color="#FF1800" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function getProbDots(n: number): number {
  const dots: Record<number, number> = { 2:1, 3:2, 4:3, 5:4, 6:5, 8:5, 9:4, 10:3, 11:2, 12:1 };
  return dots[n] || 0;
}


// ============================================================================
// BUILDING — 3D settlement or city on a vertex
// ============================================================================

interface Building3DProps {
  position: [number, number, number];
  type: 'settlement' | 'city';
  color: string;
}

function Building3D({ position, type, color }: Building3DProps) {
  if (type === 'city') {
    return (
      <group position={position}>
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.20, 0.28, 0.17]} />
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.22} />
        </mesh>
        <mesh position={[0.09, 0.27, 0]} castShadow>
          <boxGeometry args={[0.10, 0.16, 0.10]} />
          <meshStandardMaterial color={color} roughness={0.42} metalness={0.26} />
        </mesh>
        <mesh position={[0, 0.33, 0]} castShadow>
          <coneGeometry args={[0.16, 0.13, 4]} />
          <meshStandardMaterial color="#3E2208" roughness={0.82} />
        </mesh>
        <mesh position={[0.09, 0.38, 0]} castShadow>
          <coneGeometry args={[0.08, 0.09, 4]} />
          <meshStandardMaterial color="#3E2208" roughness={0.82} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={position}>
      <mesh position={[0, 0.09, 0]} castShadow>
        <boxGeometry args={[0.14, 0.18, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.14} />
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.12, 0.10, 4]} />
        <meshStandardMaterial color="#4A2C10" roughness={0.84} />
      </mesh>
    </group>
  );
}

// ============================================================================
// ROAD — 3D road between two vertices
// ============================================================================

interface Road3DProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

function Road3D({ from, to, color }: Road3DProps) {
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.max(from[1], to[1]) + 0.02;
  const midZ = (from[2] + to[2]) / 2;
  const length = Math.sqrt((to[0] - from[0]) ** 2 + (to[2] - from[2]) ** 2);
  const angle = Math.atan2(to[2] - from[2], to[0] - from[0]);

  return (
    <mesh position={[midX, midY, midZ]} rotation={[0, -angle, 0]} castShadow>
      <boxGeometry args={[length, 0.04, 0.06]} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.15} />
    </mesh>
  );
}

// ============================================================================
// VERTEX HELPERS
// ============================================================================

function getVertexWorldPos(vertex: Vertex, hexTiles: HexTile[]): [number, number, number] | null {
  const centers = vertex.hexIds
    .map(id => hexTiles.find(h => h.id === id))
    .filter(Boolean)
    .map(h => hexToWorld(h!.position.q, h!.position.r));
  if (centers.length === 0) return null;
  const x = centers.reduce((s, c) => s + c[0], 0) / centers.length;
  const z = centers.reduce((s, c) => s + c[2], 0) / centers.length;
  return [x, 0.15, z];
}

// ============================================================================
// OCEAN — Animated water surrounding the board
// ============================================================================

function Ocean() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    const t = clock.elapsedTime * 0.10;
    mat.color.setRGB(
      0.04 + Math.sin(t)        * 0.012,
      0.20 + Math.sin(t + 1.3)  * 0.022,
      0.62 + Math.sin(t + 2.6)  * 0.032,
    );
  });
  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[12, 72]} />
      <meshStandardMaterial color="#1565C0" roughness={0.14} metalness={0.14} />
    </mesh>
  );
}

// ============================================================================
// HARBORS — Port indicators on the ocean border
// ============================================================================

function Harbors() {
  return (
    <>
      {HARBOR_DEFS.map((harbor, i) => {
        const posA = hexToWorld(harbor.hexA.q, harbor.hexA.r);
        const posB = hexToWorld(harbor.hexB.q, harbor.hexB.r);
        const midX = (posA[0] + posB[0]) / 2;
        const midZ = (posA[2] + posB[2]) / 2;
        const len = Math.sqrt(midX * midX + midZ * midZ);
        const nx = len > 0 ? midX / len : 0;
        const nz = len > 0 ? midZ / len : 0;
        // Push outward from board centre into ocean
        const px = midX + nx * 1.6;
        const pz = midZ + nz * 1.6;
        const color = HARBOR_COLORS[harbor.type];
        // Pier angle: box default extends along X, rotate to align with inward direction
        const pierAngle = -Math.atan2(nz, nx);

        return (
          <group key={i} position={[px, 0.07, pz]}>
            {/* Platform */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.56, 0.56, 0.06, 28]} />
              <meshStandardMaterial color={color} roughness={0.58} metalness={0.10} emissive={color} emissiveIntensity={0.18} />
            </mesh>
            {/* Outer black ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.56, 0.038, 8, 28]} />
              <meshStandardMaterial color="#0A0A0A" roughness={0.9} />
            </mesh>
            {/* Inner white ring accent */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
              <ringGeometry args={[0.46, 0.50, 28]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.28} side={THREE.DoubleSide} />
            </mesh>
            {/* Label — large, bold, readable */}
            <Text
              position={[0, 0.075, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.022}
              outlineColor="#000000"
            >
              {harbor.label}
            </Text>
            {/* Pier plank */}
            <mesh position={[-nx * 0.90, -0.01, -nz * 0.90]} rotation={[0, pierAngle, 0]} castShadow>
              <boxGeometry args={[0.13, 0.055, 1.80]} />
              <meshStandardMaterial color="#5A3618" roughness={0.92} />
            </mesh>
            {/* Pier rail */}
            <mesh position={[-nx * 0.90, 0.010, -nz * 0.90 - 0.05]} rotation={[0, pierAngle, 0]}>
              <boxGeometry args={[0.09, 0.014, 1.70]} />
              <meshStandardMaterial color="#7A4E28" roughness={0.88} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// ============================================================================
// BOARD CONTENT — Full 3D scene
// ============================================================================

interface BoardContentProps {
  gameState: GameState;
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

function BoardContent({ gameState, onHexClick, onVertexClick, onEdgeClick }: BoardContentProps) {
  const getPlayerColor = (playerId: string): string => {
    return gameState.players.find(p => p.id === playerId)?.color || '#888';
  };

  return (
    <>
      {/* === CINEMATIC LIGHTING RIG === */}
      {/* Soft warm ambient */}
      <ambientLight intensity={0.40} color="#DDD4C0" />
      {/* Key light — warm, hard shadows, high position */}
      <directionalLight
        position={[10, 20, 8]}
        intensity={1.6}
        color="#FFF4E0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={50}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      {/* Cool fill from opposite side */}
      <directionalLight position={[-9, 13, -7]} intensity={0.38} color="#C0D0EC" />
      {/* Rim / back light */}
      <directionalLight position={[0, 5, -16]} intensity={0.22} color="#D0C8FF" />
      {/* Warm centre point glow */}
      <pointLight position={[0, 9, 0]} intensity={0.55} color="#FFE8A0" distance={22} decay={2} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 16, 6]} fov={43} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={6} maxDistance={26} maxPolarAngle={Math.PI / 2.3} minPolarAngle={0.16} />

      {/* Background */}
      <color attach="background" args={['#07101E']} />
      <fog attach="fog" args={['#07101E', 20, 38]} />

      {/* Walnut table surface */}
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <cylinderGeometry args={[16, 16, 0.36, 72]} />
        <meshStandardMaterial
          color="#1E1008"
          roughness={0.86}
          metalness={0.06}
          emissive="#0C0600"
          emissiveIntensity={0.20}
        />
      </mesh>

      {/* Ocean */}
      <Ocean />

      {/* Harbour port indicators */}
      <Harbors />

      {/* Hex tiles */}
      {gameState.hexTiles.map(hex => (
        <HexTile3D key={hex.id} hex={hex} onHexClick={onHexClick} />
      ))}

      {/* Roads */}
      {gameState.edges.filter(e => e.road).map(edge => {
        const v1 = gameState.vertices.find(v => v.id === edge.vertexIds[0]);
        const v2 = gameState.vertices.find(v => v.id === edge.vertexIds[1]);
        if (!v1 || !v2) return null;
        const p1 = getVertexWorldPos(v1, gameState.hexTiles);
        const p2 = getVertexWorldPos(v2, gameState.hexTiles);
        if (!p1 || !p2) return null;
        return <Road3D key={edge.id} from={p1} to={p2} color={getPlayerColor(edge.road!.playerId)} />;
      })}

      {/* Buildings */}
      {gameState.vertices.filter(v => v.building).map(vertex => {
        const pos = getVertexWorldPos(vertex, gameState.hexTiles);
        if (!pos) return null;
        return (
          <Building3D
            key={vertex.id}
            position={pos}
            type={vertex.building!.type}
            color={getPlayerColor(vertex.building!.playerId)}
          />
        );
      })}

      {/* Clickable vertices (when in build mode) */}
      {onVertexClick && gameState.vertices.filter(v => !v.building).map(vertex => {
        const pos = getVertexWorldPos(vertex, gameState.hexTiles);
        if (!pos) return null;
        return (
          <mesh
            key={`vclick-${vertex.id}`}
            position={pos}
            onClick={(e) => { e.stopPropagation(); onVertexClick(vertex.id); }}
          >
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} transparent opacity={0.8} />
          </mesh>
        );
      })}

      {/* Clickable edges (when in build mode) */}
      {onEdgeClick && gameState.edges.filter(e => !e.road).map(edge => {
        const v1 = gameState.vertices.find(v => v.id === edge.vertexIds[0]);
        const v2 = gameState.vertices.find(v => v.id === edge.vertexIds[1]);
        if (!v1 || !v2) return null;
        const p1 = getVertexWorldPos(v1, gameState.hexTiles);
        const p2 = getVertexWorldPos(v2, gameState.hexTiles);
        if (!p1 || !p2) return null;
        const midX = (p1[0] + p2[0]) / 2;
        const midZ = (p1[2] + p2[2]) / 2;
        const length = Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[2] - p1[2]) ** 2);
        const angle = Math.atan2(p2[2] - p1[2], p2[0] - p1[0]);
        return (
          <mesh
            key={`eclick-${edge.id}`}
            position={[midX, 0.12, midZ]}
            rotation={[0, -angle, 0]}
            onClick={(e) => { e.stopPropagation(); onEdgeClick(edge.id); }}
          >
            <boxGeometry args={[length, 0.06, 0.08]} />
            <meshBasicMaterial color="#FFD700" transparent opacity={0.4} />
          </mesh>
        );
      })}
    </>
  );
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

interface CatanBoard3DProps {
  gameState: GameState;
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
}

export default function CatanBoard3D({ gameState, onHexClick, onVertexClick, onEdgeClick }: CatanBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <BoardContent
            gameState={gameState}
            onHexClick={onHexClick}
            onVertexClick={onVertexClick}
            onEdgeClick={onEdgeClick}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
