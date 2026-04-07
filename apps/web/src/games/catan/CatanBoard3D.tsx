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
  forest:    { base: '#1A4E14', top: '#1E5A18', emissive: '#000000', height: 0.14 },
  hills:     { base: '#8C2E10', top: '#A83418', emissive: '#000000', height: 0.22 },
  pasture:   { base: '#3E8A24', top: '#4EA030', emissive: '#000000', height: 0.08 },
  fields:    { base: '#B07A08', top: '#C88C0C', emissive: '#000000', height: 0.07 },
  mountains: { base: '#424E58', top: '#566070', emissive: '#000000', height: 0.36 },
  desert:    { base: '#A88030', top: '#C09840', emissive: '#000000', height: 0.05 },
};

const HEX_SIZE = 1.28;
const HEX_GAP = 0.0;

// ============================================================================
// CANVAS TERRAIN TEXTURES — illustrated board-game style artwork per tile
// ============================================================================

// Helper: draw a pine tree silhouette with no eyes/faces
function drawTree(c: CanvasRenderingContext2D, tx: number, ty: number, sz: number) {
  c.fillStyle = '#3B1E08';
  c.fillRect(tx - sz*0.07, ty + sz*0.28, sz*0.14, sz*0.30);
  [['#1A5C10', 1.0, 0], ['#226E14', 0.76, sz*0.20], ['#2E8418', 0.54, sz*0.38]].forEach(([col, wm, yOff]) => {
    c.fillStyle = col as string;
    c.beginPath();
    c.moveTo(tx, ty - sz + (yOff as number));
    c.lineTo(tx - sz*(wm as number)*0.54, ty + (yOff as number)*0.55);
    c.lineTo(tx + sz*(wm as number)*0.54, ty + (yOff as number)*0.55);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.16)';
    c.beginPath();
    c.moveTo(tx, ty - sz + (yOff as number));
    c.lineTo(tx, ty + (yOff as number)*0.55);
    c.lineTo(tx + sz*(wm as number)*0.54, ty + (yOff as number)*0.55);
    c.closePath(); c.fill();
  });
  c.fillStyle = 'rgba(235,245,255,0.75)';
  c.beginPath(); c.moveTo(tx, ty-sz); c.lineTo(tx-sz*0.08,ty-sz+sz*0.11); c.lineTo(tx+sz*0.08,ty-sz+sz*0.11); c.closePath(); c.fill();
}

function buildTerrainTexture(terrain: string): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const c = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;
  // CLEAR CENTRE RADIUS — kept free of decoration so number token reads cleanly
  const SAFE = 115; // px radius around centre that stays decoration-free

  c.save();
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + S * 0.47 * Math.cos(a), py = cy + S * 0.47 * Math.sin(a);
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.clip();

  if (terrain === 'forest') {
    const bg = c.createRadialGradient(cx, cy, 0, cx, cy, S*0.52);
    bg.addColorStop(0,'#3A7C1A'); bg.addColorStop(1,'#183C08');
    c.fillStyle = bg; c.fillRect(0,0,S,S);
    // Forest floor
    c.fillStyle='rgba(20,60,0,0.30)'; c.fillRect(0,0,S,S);
    // Trees ONLY outside safe radius — 6 corner positions
    const treePts:([number,number,number])[] = [
      [cx-155,cy-60,74],[cx+148,cy-55,68],[cx-155,cy+80,62],
      [cx+150,cy+75,66],[cx-50,cy+178,58],[cx+55,cy+182,56]
    ];
    treePts.forEach(([tx,ty,sz]) => drawTree(c, tx, ty, sz));
    // Subtle ground moss
    c.fillStyle='rgba(60,130,20,0.18)'; c.fillRect(0,0,S,S);

  } else if (terrain === 'hills') {
    const bg = c.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#D05828'); bg.addColorStop(1,'#7C2408');
    c.fillStyle=bg; c.fillRect(0,0,S,S);
    // Clay hilltop highlight
    const hl = c.createRadialGradient(cx-40,cy-60,10,cx-40,cy-60,190);
    hl.addColorStop(0,'rgba(220,110,60,0.50)'); hl.addColorStop(1,'rgba(220,110,60,0)');
    c.fillStyle=hl; c.fillRect(0,0,S,S);
    // Brick rows pushed to lower-edge zone
    c.fillStyle='rgba(60,15,0,0.40)';
    for(let row=0;row<4;row++){
      for(let col=0;col<5;col++){
        const bx=130+col*50+(row%2)*25, by=cy+SAFE+10+row*22;
        if(by>S*0.88) break;
        c.fillRect(bx,by,42,16);
        c.strokeStyle='rgba(255,100,40,0.35)'; c.lineWidth=1; c.strokeRect(bx,by,42,16);
      }
    }
    // Rolling hill silhouette top-edge
    c.fillStyle='rgba(180,60,20,0.30)';
    c.beginPath(); c.ellipse(cx,cy-SAFE-50,200,80,0,Math.PI,0); c.closePath(); c.fill();

  } else if (terrain === 'pasture') {
    const bg = c.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#88C040'); bg.addColorStop(1,'#349010');
    c.fillStyle=bg; c.fillRect(0,0,S,S);
    // Rolling hill shapes at edges only
    [[cx-60,cy+SAFE+60,200,80,'#5AA020'],[cx+70,cy+SAFE+75,180,70,'#4A9018']] .forEach(([hx,hy,rw,rh,col]) => {
      c.fillStyle=col as string;
      c.beginPath(); c.ellipse(hx as number,hy as number,rw as number,rh as number,0,Math.PI,0); c.closePath(); c.fill();
    });
    // Fence at bottom edge — well below safe zone
    const fy = cy+SAFE+20;
    c.fillStyle='#7A5C10'; c.fillRect(80,fy,S-160,7);
    [100,190,295,400].forEach(fx=>{ c.fillStyle='#7A5C10'; c.fillRect(fx,fy-16,9,40); });
    // Sheep as pure wool blobs (NO heads, NO eyes) pushed to corners
    [[cx-168,cy-80],[cx+155,cy-70],[cx-150,cy+140],[cx+145,cy+130]].forEach(([sx,sy]) => {
      c.fillStyle='rgba(245,245,240,0.92)';
      c.beginPath(); c.ellipse(sx as number,sy as number,28,20,0,0,Math.PI*2); c.fill();
      [[-14,-8],[0,-16],[14,-8],[-20,2],[20,2]].forEach(([dx,dy]) => {
        c.fillStyle='#FFFFFF';
        c.beginPath(); c.arc((sx as number)+dx,(sy as number)+dy,12,0,Math.PI*2); c.fill();
      });
    });

  } else if (terrain === 'fields') {
    const bg = c.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#EAC028'); bg.addColorStop(0.7,'#C08808'); bg.addColorStop(1,'#7A4E00');
    c.fillStyle=bg; c.fillRect(0,0,S,S);
    // Wheat rows — skip centre safe zone
    for(let row=0;row<8;row++){
      const ry=60+row*52;
      for(let col=0;col<9;col++){
        const wx=36+col*52+(row%2)*26;
        const dx=wx-cx, dy=ry-cy;
        if(dx*dx+dy*dy < SAFE*SAFE*0.85) continue; // skip centre
        c.strokeStyle='#8C6008'; c.lineWidth=2.5;
        c.beginPath(); c.moveTo(wx,ry+22); c.lineTo(wx,ry-22); c.stroke();
        c.fillStyle='#C89000';
        c.beginPath(); c.ellipse(wx,ry-28,4,14,0,0,Math.PI*2); c.fill();
        c.fillStyle='#E0AA10';
        for(let k=0;k<3;k++){
          c.beginPath(); c.ellipse(wx+(k%2===0?-3:3),ry-22-k*8,4,7,k%2===0?-0.35:0.35,0,Math.PI*2); c.fill();
        }
      }
    }
    const glow=c.createRadialGradient(cx,cy-40,20,cx,cy-40,200);
    glow.addColorStop(0,'rgba(255,215,70,0.28)'); glow.addColorStop(1,'rgba(255,215,70,0)');
    c.fillStyle=glow; c.fillRect(0,0,S,S);

  } else if (terrain === 'mountains') {
    const bg = c.createLinearGradient(0,S*0.8,0,0);
    bg.addColorStop(0,'#303840'); bg.addColorStop(1,'#788898');
    c.fillStyle=bg; c.fillRect(0,0,S,S);
    // 3 peaks — tips above safe zone, bases spread to edges
    ([
      [cx-110,cy-SAFE-20,88,230,'#566470'],
      [cx+105,cy-SAFE-10,82,210,'#4C5C68'],
      [cx,   cy-SAFE-50,96,250,'#607080'],
    ] as [number,number,number,number,string][]).forEach(([px,py,pw,ph,col]) => {
      c.fillStyle=col;
      c.beginPath(); c.moveTo(px,py); c.lineTo(px-pw,py+ph*0.55); c.lineTo(px+pw,py+ph*0.55); c.closePath(); c.fill();
      c.fillStyle='rgba(0,0,0,0.20)';
      c.beginPath(); c.moveTo(px,py); c.lineTo(px,py+ph*0.55); c.lineTo(px+pw,py+ph*0.55); c.closePath(); c.fill();
      c.fillStyle='#E8F0F8';
      c.beginPath(); c.moveTo(px,py); c.lineTo(px-pw*0.32,py+ph*0.18); c.lineTo(px+pw*0.32,py+ph*0.18); c.closePath(); c.fill();
    });
    c.strokeStyle='rgba(150,175,200,0.45)'; c.lineWidth=3;
    [[cx-70,cy+80,cx-30,cy+120],[cx+30,cy+70,cx+70,cy+110]].forEach(([x1,y1,x2,y2])=>{
      c.beginPath(); c.moveTo(x1 as number,y1 as number); c.lineTo(x2 as number,y2 as number); c.stroke();
    });

  } else if (terrain === 'desert') {
    const bg = c.createLinearGradient(0,0,0,S);
    bg.addColorStop(0,'#E6C460'); bg.addColorStop(1,'#A87020');
    c.fillStyle=bg; c.fillRect(0,0,S,S);
    // Dunes pushed to edge
    [[cx-70,cy+SAFE+55,210,65,'#CCA030'],[cx+85,cy+SAFE+70,195,55,'#BC9020'],[cx,cy+SAFE+100,240,50,'#B08018']].forEach(([dx,dy,rw,rh,col])=>{
      c.fillStyle=col as string;
      c.beginPath(); c.ellipse(dx as number,dy as number,rw as number,rh as number,0,Math.PI,0); c.closePath(); c.fill();
    });
    // Cactus at corners, no eyes
    [[cx-155,cy+30],[cx+148,cy+20]].forEach(([tx,ty])=>{
      c.fillStyle='#2E6830';
      c.beginPath(); c.roundRect((tx as number)-9,(ty as number)-55,18,72,5); c.fill();
      c.beginPath(); c.roundRect((tx as number)-32,(ty as number)-26,24,9,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)-32,(ty as number)-40,9,20,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)+8,(ty as number)-34,24,9,4); c.fill();
      c.beginPath(); c.roundRect((tx as number)+14,(ty as number)-48,9,20,4); c.fill();
    });
    const heat=c.createRadialGradient(cx,cy-30,10,cx,cy-30,170);
    heat.addColorStop(0,'rgba(255,238,150,0.26)'); heat.addColorStop(1,'rgba(255,238,150,0)');
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

// ============================================================================
// SEA FRAME — ring-3 positions (all hex-neighbours of island boundary not on island)
// Computed as: all (q,r) adjacent to any island hex but not in HEX_POSITIONS
// ============================================================================
const SEA_FRAME_POSITIONS: { q: number; r: number }[] = [
  {q:-3,r:0},{q:-2,r:-1},{q:-1,r:-2},{q:0,r:-3},{q:1,r:-3},{q:2,r:-3},
  {q:3,r:-3},{q:3,r:-2},{q:3,r:-1},{q:3,r:0},{q:2,r:1},{q:1,r:2},
  {q:0,r:3},{q:-1,r:3},{q:-2,r:3},{q:-3,r:3},{q:-3,r:2},{q:-3,r:1},
];

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
          roughness={0.90}
          metalness={0.01}
          emissive={hovered ? '#2A1800' : '#000000'}
          emissiveIntensity={hovered ? 0.35 : 0}
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
          <group position={[0, mat.height + 0.08, 0]}>
            {/* Contact shadow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
              <circleGeometry args={[0.56, 32]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.22} />
            </mesh>
            {/* Flat cardboard token disc — h=0.04, equal radii = no trapezoid dome */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.50, 0.50, 0.042, 40]} />
              <meshStandardMaterial
                color={hot ? '#F2E0C8' : '#EDD99A'}
                roughness={0.62}
                metalness={0.0}
                emissive="#000000"
                emissiveIntensity={0}
              />
            </mesh>
            {/* Number */}
            <Text
              position={[0, 0.066, -0.06]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={hot ? 0.44 : 0.36}
              color={hot ? '#AA0808' : '#28160C'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.016}
              outlineColor={hot ? '#4A0000' : '#2A1400'}
            >
              {String(hex.number)}
            </Text>
            {/* Probability pips */}
            <Text
              position={[0, 0.066, 0.18]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.072}
              color={hot ? '#AA0808' : '#5A3C18'}
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
    const t = clock.elapsedTime * 0.08;
    mat.color.setRGB(
      0.02 + Math.sin(t)       * 0.008,
      0.16 + Math.sin(t+1.4)   * 0.018,
      0.54 + Math.sin(t+2.7)   * 0.028,
    );
    mat.emissiveIntensity = 0.06 + Math.sin(t*1.3) * 0.02;
  });
  return (
    <>
      {/* Deep ocean base */}
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <circleGeometry args={[13, 72]} />
        <meshStandardMaterial color="#0D448A" roughness={0.12} metalness={0.22} emissive="#061840" emissiveIntensity={0.06} />
      </mesh>
      {/* Shallow coastal lighter ring near island edges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.020, 0]}>
        <ringGeometry args={[6.8, 8.8, 72]} />
        <meshStandardMaterial color="#1565C0" roughness={0.18} metalness={0.15} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

// ============================================================================
// HARBORS — Port indicators on the ocean border
// ============================================================================

// Build a flat hexagonal harbour tile shape
function createHarborHexShape(r: number): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const x = r * Math.cos(a), y = r * Math.sin(a);
    i === 0 ? s.moveTo(x, y) : s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function SeaFrame() {
  const hexShape = useMemo(() => createHexShape(HEX_SIZE * 0.995), []);
  const extSettings = useMemo(() => ({ depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }), []);
  return (
    <>
      {SEA_FRAME_POSITIONS.map((pos, i) => {
        const [wx, , wz] = hexToWorld(pos.q, pos.r);
        return (
          <mesh key={i} position={[wx, -0.008, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <extrudeGeometry args={[hexShape, extSettings]} />
            <meshStandardMaterial
              color="#0E3870"
              roughness={0.28}
              metalness={0.24}
              emissive="#041428"
              emissiveIntensity={0.18}
            />
          </mesh>
        );
      })}
    </>
  );
}

function Harbors() {
  const harborHex = useMemo(() => createHarborHexShape(0.68), []);
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
        const px = midX + nx * 1.55;
        const pz = midZ + nz * 1.55;
        const color = HARBOR_COLORS[harbor.type];
        const pierAngle = -Math.atan2(nz, nx);
        // Rotate hex tile so a flat edge faces toward the island
        const hexRot = pierAngle + Math.PI / 6;

        return (
          <group key={i} position={[px, 0.04, pz]}>
            {/* Harbour frame tile body — hex tile matching the board language */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} castShadow receiveShadow>
              <extrudeGeometry args={[harborHex, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.018, bevelSize: 0.018, bevelSegments: 2 }]} />
              <meshStandardMaterial color={color} roughness={0.62} metalness={0.06} emissive="#000000" emissiveIntensity={0} />
            </mesh>
            {/* Label */}
            <Text
              position={[0, 0.10, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.025}
              outlineColor="#000000"
            >
              {harbor.label}
            </Text>
            {/* Mooring posts — slim vertical cylinders, no planks */}
            {[-0.18, 0, 0.18].map((off, pi) => {
              const perpX = Math.cos(pierAngle + Math.PI/2) * off;
              const perpZ = Math.sin(pierAngle + Math.PI/2) * off;
              return (
                <mesh key={pi} position={[-nx*0.55 + perpX, 0.06, -nz*0.55 + perpZ]} castShadow>
                  <cylinderGeometry args={[0.028, 0.032, 0.14, 8]} />
                  <meshStandardMaterial color="#3A2208" roughness={0.96} />
                </mesh>
              );
            })}
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
      {/* Premium tabletop lighting rig */}
      <ambientLight intensity={0.52} color="#E8DDD0" />
      {/* Key: warm overhead, hard shadows */}
      <directionalLight
        position={[8, 22, 6]}
        intensity={1.45}
        color="#FFF8EC"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={55}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0003}
      />
      {/* Fill: cool, soft, opposite side */}
      <directionalLight position={[-10, 14, -8]} intensity={0.32} color="#B8CCE8" />
      {/* Rim: subtle purple-blue from behind */}
      <directionalLight position={[0, 6, -18]} intensity={0.16} color="#C8C0F8" />
      {/* Warm centre bounce — gentle, no overbright */}
      <pointLight position={[0, 10, 0]} intensity={0.42} color="#FFE4A0" distance={24} decay={2} />
      {/* Side accent for depth */}
      <pointLight position={[-12, 6, 0]} intensity={0.18} color="#A0B8D0" distance={20} decay={2} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 19, 4.5]} fov={38} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={5} maxDistance={28} maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.10} />

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

      {/* Sea frame — ring of 18 sea tiles bordering the island */}
      <SeaFrame />

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
