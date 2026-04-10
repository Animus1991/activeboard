/**
 * TableForge — Catan 3D Board  (AAA visual rewrite)
 * Cinematic PBR materials · dramatic shadow lighting · ACES tone mapping
 * Multi-layer terrain decorations · harbour ports · animated ocean
 */

import { useRef, useState, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { EffectComposer, SMAA } from '@react-three/postprocessing';
import { useKeyboardControls } from './CatanHUDFeatures';
import { XR, createXRStore } from '@react-three/xr';
import { Physics, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import {
  type GameState,
  type HexTile,
  type Vertex,
  TERRAIN_RESOURCES,
} from './CatanEngine';
import { CatanPresence3D, type Presence3DPlayer } from './CatanPresence3D';
import { ResourceFlow3D, type ResourceAnimation } from './CatanResourceFlow';

const xrStore = createXRStore({ hand: { teleportPointer: true } });

// ============================================================================
// TERRAIN MATERIALS — PBR-style colors per terrain type
// ============================================================================

// Storybook terrain materials — warm hand-painted matte gouache feel (Disney classics)
const TERRAIN_MATS: Record<string, { base: string; top: string; emissive: string; height: number; roughness: number; metalness: number }> = {
  forest:    { base: '#1E5A22', top: '#2A6E2C', emissive: '#081E08', height: 0.15, roughness: 0.96, metalness: 0.0 },
  hills:     { base: '#A04520', top: '#C05C30', emissive: '#1C0A04', height: 0.24, roughness: 0.96, metalness: 0.0 },
  pasture:   { base: '#48962A', top: '#5AAC38', emissive: '#0C1E06', height: 0.09, roughness: 0.97, metalness: 0.0 },
  fields:    { base: '#C09018', top: '#D8A828', emissive: '#1E1604', height: 0.08, roughness: 0.96, metalness: 0.0 },
  mountains: { base: '#4A5C6E', top: '#5E7286', emissive: '#0C1018', height: 0.38, roughness: 0.94, metalness: 0.0 },
  desert:    { base: '#C09838', top: '#D8B050', emissive: '#1E1808', height: 0.06, roughness: 0.97, metalness: 0.0 },
};

const HEX_SIZE = 1.28;
const HEX_GAP = 0.04;

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

// Perlin-style noise helper for organic texture variation
function _fbmNoise(x: number, y: number, octaves = 4): number {
  let v = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * (Math.sin(x * freq * 1.7 + y * freq * 2.3) * 0.5 + 0.5);
    max += amp; amp *= 0.5; freq *= 2.1;
  }
  return v / max;
}

// Scatter helper — avoids centre safe zone
function _scatterPoints(cx: number, cy: number, safe: number, count: number, margin: number, S: number): [number, number][] {
  const pts: [number, number][] = [];
  let attempts = 0;
  while (pts.length < count && attempts < count * 10) {
    const px = margin + Math.random() * (S - margin * 2);
    const py = margin + Math.random() * (S - margin * 2);
    const dx = px - cx, dy = py - cy;
    if (dx * dx + dy * dy > safe * safe) pts.push([px, py]);
    attempts++;
  }
  return pts;
}

// Apply organic noise overlay to a canvas context
function _applyNoiseOverlay(c: CanvasRenderingContext2D, S: number, alpha: number, warm: boolean) {
  const imgData = c.getImageData(0, 0, S, S);
  const d = imgData.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const n = _fbmNoise(x * 0.015, y * 0.015, 3) * 2 - 1; // -1..+1
      const shift = n * alpha * 255;
      d[i]     = Math.max(0, Math.min(255, d[i] + shift * (warm ? 1.2 : 1)));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + shift));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + shift * (warm ? 0.8 : 1)));
    }
  }
  c.putImageData(imgData, 0, 0);
}

// Hex vignette — darken edges for depth
function _applyHexVignette(c: CanvasRenderingContext2D, cx: number, cy: number, S: number, intensity = 0.35) {
  const vg = c.createRadialGradient(cx, cy, S * 0.18, cx, cy, S * 0.50);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,0)');
  vg.addColorStop(1, `rgba(0,0,0,${intensity})`);
  c.fillStyle = vg;
  c.fillRect(0, 0, S, S);
}

// ── Disney Storybook watercolor helpers ───────────────────────────────────

// Soft wash — multiple semi-transparent radial blobs to simulate wet-on-wet
function _watercolorWash(c: CanvasRenderingContext2D, S: number, color: string, alpha: number, count = 12) {
  for (let i = 0; i < count; i++) {
    const px = S * 0.1 + Math.random() * S * 0.8;
    const py = S * 0.1 + Math.random() * S * 0.8;
    const r = S * (0.08 + Math.random() * 0.22);
    const g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, color.replace(')', `,${alpha * (0.6 + Math.random() * 0.4)})`).replace('rgb(', 'rgba('));
    g.addColorStop(0.6, color.replace(')', `,${alpha * 0.2})`).replace('rgb(', 'rgba('));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
  }
}

// Brushstroke texture — angled streaks that mimic gouache
function _brushStrokes(c: CanvasRenderingContext2D, S: number, color: string, alpha: number, count = 18) {
  c.save();
  c.globalAlpha = alpha;
  c.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const sx = Math.random() * S;
    const sy = Math.random() * S;
    const angle = -0.3 + Math.random() * 0.6; // slight diagonal
    const len = S * (0.06 + Math.random() * 0.18);
    const w = S * (0.008 + Math.random() * 0.025);
    c.strokeStyle = color;
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx + Math.cos(angle) * len, sy + Math.sin(angle) * len);
    c.stroke();
  }
  c.restore();
}

// Watercolor paper grain — warm-toned fine speckle
function _paperGrain(c: CanvasRenderingContext2D, S: number, intensity = 0.03) {
  const imgData = c.getImageData(0, 0, S, S);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const grain = (Math.random() - 0.5) * intensity * 255;
    d[i]     = Math.max(0, Math.min(255, d[i] + grain * 1.1));    // warm bias
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + grain * 0.95));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + grain * 0.8)); // reduce blue
  }
  c.putImageData(imgData, 0, 0);
}

// Golden-hour warm overlay — Disney storybook films always have warm tones
function _warmGlow(c: CanvasRenderingContext2D, S: number, strength = 0.08) {
  c.save();
  c.globalCompositeOperation = 'overlay';
  const g = c.createRadialGradient(S * 0.3, S * 0.3, 0, S * 0.5, S * 0.5, S * 0.6);
  g.addColorStop(0, `rgba(255,220,140,${strength})`);
  g.addColorStop(1, `rgba(180,120,40,${strength * 0.3})`);
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  c.restore();
}

function buildTerrainTexture(terrain: string): THREE.CanvasTexture {
  const S = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const c = canvas.getContext('2d')!;
  const cx = S / 2, cy = S / 2;
  const SAFE = S * 0.22; // proportional safe zone for number token

  c.save();
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    const px = cx + S * 0.47 * Math.cos(a), py = cy + S * 0.47 * Math.sin(a);
    i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
  }
  c.closePath(); c.clip();

  if (terrain === 'forest') {
    // Storybook forest — deep emerald watercolor washes like Sleeping Beauty backgrounds
    const bg = c.createRadialGradient(cx, cy * 0.65, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#3A7A28'); bg.addColorStop(0.4, '#265818'); bg.addColorStop(1, '#122A08');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered watercolor washes — multiple transparent layers build depth
    _watercolorWash(c, S, 'rgb(60,130,30)', 0.18, 10);
    _watercolorWash(c, S, 'rgb(20,80,10)', 0.12, 6);
    // Dappled sunlight pools — golden light filtering through canopy
    for (let i = 0; i < 5; i++) {
      const dx = cx + (Math.random() - 0.5) * S * 0.5;
      const dy = cy + (Math.random() - 0.5) * S * 0.5;
      const gr = c.createRadialGradient(dx, dy, 0, dx, dy, S * 0.08 + Math.random() * S * 0.06);
      gr.addColorStop(0, 'rgba(180,220,80,0.18)');
      gr.addColorStop(1, 'rgba(80,140,30,0)');
      c.fillStyle = gr; c.fillRect(0, 0, S, S);
    }
    // Moss patches — soft wet blobs
    const mossPts = _scatterPoints(cx, cy, SAFE, 14, 50, S);
    mossPts.forEach(([mx, my]) => {
      const r = 20 + Math.random() * 35;
      c.save(); c.globalAlpha = 0.3;
      const mg = c.createRadialGradient(mx, my, 0, mx, my, r);
      mg.addColorStop(0, '#4C9830'); mg.addColorStop(1, 'rgba(40,80,20,0)');
      c.fillStyle = mg; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
      c.restore();
    });
    // Hand-painted trees — soft, rounded, storybook silhouettes
    const treePts: [number, number, number][] = [
      [cx - 200, cy - 80, 82], [cx + 190, cy - 75, 76], [cx - 200, cy + 100, 70],
      [cx + 195, cy + 95, 74], [cx - 70, cy + 230, 64], [cx + 75, cy + 235, 62],
      [cx - 140, cy - 190, 58], [cx + 130, cy - 195, 60],
    ];
    treePts.forEach(([tx, ty, sz]) => drawTree(c, tx, ty, sz));
    treePts.forEach(([tx, ty, sz]) => {
      c.fillStyle = 'rgba(8,30,4,0.20)';
      c.beginPath(); c.ellipse(tx, ty + sz * 0.35, sz * 0.5, sz * 0.18, 0, 0, Math.PI * 2); c.fill();
    });
    // Simplified - no fancy effects for clarity

  } else if (terrain === 'hills') {
    // Storybook hills — warm terracotta watercolor like Disney's Bambi autumn scenes
    const bg = c.createRadialGradient(cx, cy * 0.6, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#D4713A'); bg.addColorStop(0.4, '#B85428'); bg.addColorStop(1, '#7A2C10');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered terracotta washes
    _watercolorWash(c, S, 'rgb(200,100,50)', 0.20, 10);
    _watercolorWash(c, S, 'rgb(160,60,20)', 0.14, 6);
    // Warm sunset highlight pool
    const hl = c.createRadialGradient(cx - 40, cy - 70, 10, cx - 40, cy - 70, S * 0.35);
    hl.addColorStop(0, 'rgba(255,180,100,0.30)'); hl.addColorStop(1, 'rgba(200,100,40,0)');
    c.fillStyle = hl; c.fillRect(0, 0, S, S);
    // Soft rolling hill contours — watercolor blobs
    const hillPts: [number, number, number, number, string][] = [
      [cx, cy - SAFE - 70, 260, 100, 'rgba(190,90,40,0.28)'],
      [cx - 100, cy + SAFE + 50, 220, 85, 'rgba(165,65,25,0.25)'],
      [cx + 110, cy + SAFE + 70, 200, 75, 'rgba(150,55,18,0.22)'],
    ];
    hillPts.forEach(([hx, hy, rw, rh, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(hx, hy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Soft clay patches
    const clayPts = _scatterPoints(cx, cy, SAFE * 1.1, 10, 60, S);
    clayPts.forEach(([bx, by]) => {
      const r = 18 + Math.random() * 28;
      c.save(); c.globalAlpha = 0.25 + Math.random() * 0.15;
      const cg = c.createRadialGradient(bx, by, 0, bx, by, r);
      cg.addColorStop(0, '#8A3818'); cg.addColorStop(1, 'rgba(100,40,10,0)');
      c.fillStyle = cg; c.beginPath(); c.arc(bx, by, r, 0, Math.PI * 2); c.fill();
      c.restore();
    });
    // Simplified - no fancy effects for clarity

  } else if (terrain === 'pasture') {
    // Storybook pasture — spring meadow watercolor like Disney's Fantasia pastoral scenes
    const bg = c.createRadialGradient(cx, cy * 0.7, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#8AC84A'); bg.addColorStop(0.4, '#5CA828'); bg.addColorStop(1, '#347818');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered meadow washes — bright spring greens
    _watercolorWash(c, S, 'rgb(120,200,60)', 0.16, 10);
    _watercolorWash(c, S, 'rgb(80,160,30)', 0.10, 6);
    // Gentle rolling hills at edges — soft watercolor arcs
    const rollHills: [number, number, number, number, string][] = [
      [cx - 80, cy + SAFE + 80, 250, 95, 'rgba(110,190,55,0.30)'],
      [cx + 90, cy + SAFE + 95, 220, 85, 'rgba(95,180,40,0.25)'],
      [cx, cy - SAFE - 60, 280, 70, 'rgba(125,200,65,0.28)'],
    ];
    rollHills.forEach(([hx, hy, rw, rh, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(hx, hy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Hand-painted rustic fence — soft brushstroke lines
    const fy = cy + SAFE + 25;
    c.save(); c.globalAlpha = 0.65;
    c.strokeStyle = '#7A5818'; c.lineWidth = S * 0.012; c.lineCap = 'round';
    c.beginPath(); c.moveTo(S * 0.15, fy); c.lineTo(S * 0.85, fy); c.stroke();
    [0.20, 0.35, 0.50, 0.65, 0.80].forEach(fx => {
      c.strokeStyle = '#6A4C0C'; c.lineWidth = S * 0.01;
      c.beginPath(); c.moveTo(S * fx, fy - S * 0.025); c.lineTo(S * fx, fy + S * 0.03); c.stroke();
    });
    c.restore();
    // Fluffy watercolor sheep — soft white blobs with warm shadows
    const sheepPts = _scatterPoints(cx, cy, SAFE * 1.1, 5, S * 0.12, S);
    sheepPts.forEach(([sx, sy]) => {
      // Body — soft circular wash
      const sg = c.createRadialGradient(sx, sy, 0, sx, sy, S * 0.04);
      sg.addColorStop(0, 'rgba(255,255,250,0.90)'); sg.addColorStop(0.7, 'rgba(245,240,230,0.60)'); sg.addColorStop(1, 'rgba(230,220,200,0)');
      c.fillStyle = sg; c.beginPath(); c.arc(sx, sy, S * 0.04, 0, Math.PI * 2); c.fill();
      // Warm shadow
      c.fillStyle = 'rgba(60,40,10,0.12)';
      c.beginPath(); c.ellipse(sx, sy + S * 0.028, S * 0.035, S * 0.010, 0, 0, Math.PI * 2); c.fill();
    });
    // Wildflower dots — soft small colour spots
    const flowerPts = _scatterPoints(cx, cy, SAFE, 20, 40, S);
    flowerPts.forEach(([fx2, fy2]) => {
      const flCol = ['rgba(255,220,60,0.5)', 'rgba(255,120,180,0.4)', 'rgba(180,130,255,0.35)', 'rgba(255,255,255,0.45)'][Math.floor(Math.random() * 4)];
      c.fillStyle = flCol;
      c.beginPath(); c.arc(fx2, fy2, 3 + Math.random() * 4, 0, Math.PI * 2); c.fill();
    });

  } else if (terrain === 'fields') {
    // Storybook wheat fields — golden harvest like Disney's Brother Bear autumn palette
    const bg = c.createRadialGradient(cx, cy * 0.65, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#F0C840'); bg.addColorStop(0.4, '#D4A020'); bg.addColorStop(1, '#8A6010');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered golden washes
    _watercolorWash(c, S, 'rgb(240,190,50)', 0.18, 10);
    _watercolorWash(c, S, 'rgb(200,140,20)', 0.12, 6);
    // Warm sunlight pool
    const glow = c.createRadialGradient(cx - 30, cy * 0.6, 10, cx, cy * 0.7, S * 0.35);
    glow.addColorStop(0, 'rgba(255,235,120,0.28)'); glow.addColorStop(1, 'rgba(255,210,60,0)');
    c.fillStyle = glow; c.fillRect(0, 0, S, S);
    // Impressionist wheat — soft curved strokes instead of rigid stalks
    c.save(); c.lineCap = 'round';
    for (let row = 0; row < 14; row++) {
      const ry = S * 0.05 + row * (S * 0.065);
      for (let col = 0; col < 14; col++) {
        const wx = S * 0.03 + col * (S * 0.07) + (row % 2) * (S * 0.035);
        const dx = wx - cx, dy = ry - cy;
        if (dx * dx + dy * dy < SAFE * SAFE * 0.85) continue;
        const sway = Math.sin(wx * 0.025 + row * 0.5) * 6;
        // Soft stalk stroke
        c.strokeStyle = `rgba(${150 + Math.random() * 40},${110 + Math.random() * 30},${15 + Math.random() * 15},${0.4 + Math.random() * 0.3})`;
        c.lineWidth = 1.5 + Math.random() * 1.5;
        c.beginPath();
        c.moveTo(wx, ry + S * 0.03);
        c.quadraticCurveTo(wx + sway * 0.5, ry, wx + sway, ry - S * 0.035);
        c.stroke();
        // Soft wheat head — elliptical blob
        c.fillStyle = `rgba(${220 + Math.random() * 35},${170 + Math.random() * 40},${30 + Math.random() * 20},0.75)`;
        c.beginPath(); c.ellipse(wx + sway, ry - S * 0.04, S * 0.005 + Math.random() * S * 0.003, S * 0.018, sway * 0.02, 0, Math.PI * 2); c.fill();
      }
    }
    c.restore();
    // Simplified - no fancy effects for clarity

  } else if (terrain === 'mountains') {
    // Storybook mountains — moody slate like Disney's Mulan/Fantasia Night on Bald Mountain
    const bg = c.createRadialGradient(cx, cy * 0.5, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#6A7A8A'); bg.addColorStop(0.4, '#4A5868'); bg.addColorStop(1, '#283040');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered cool washes — moody blues and slates
    _watercolorWash(c, S, 'rgb(80,100,130)', 0.16, 8);
    _watercolorWash(c, S, 'rgb(50,65,85)', 0.12, 6);
    // Hand-painted peaks — soft triangular forms with visible brushwork
    const peaks: [number, number, number, number][] = [
      [cx - 140, cy - SAFE - 30, 120, 300],
      [cx + 130, cy - SAFE - 20, 110, 280],
      [cx, cy - SAFE - 60, 130, 330],
    ];
    peaks.forEach(([px, py, pw, ph]) => {
      // Mountain body — layered washes for depth
      const mg1 = c.createLinearGradient(px - pw, py + ph * 0.55, px, py);
      mg1.addColorStop(0, 'rgba(60,75,95,0.8)'); mg1.addColorStop(1, 'rgba(90,110,135,0.6)');
      c.fillStyle = mg1;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - pw, py + ph * 0.55); c.lineTo(px + pw, py + ph * 0.55); c.closePath(); c.fill();
      // Shadow face — soft gradient not hard edge
      const sh = c.createLinearGradient(px, py, px + pw, py + ph * 0.55);
      sh.addColorStop(0, 'rgba(20,30,45,0.35)'); sh.addColorStop(1, 'rgba(20,30,45,0)');
      c.fillStyle = sh;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + pw * 0.15, py + ph * 0.55); c.lineTo(px + pw, py + ph * 0.55); c.closePath(); c.fill();
      // Snow cap — luminous white with soft edges
      const sg = c.createLinearGradient(px, py, px, py + ph * 0.18);
      sg.addColorStop(0, 'rgba(240,245,255,0.95)'); sg.addColorStop(1, 'rgba(200,215,235,0)');
      c.fillStyle = sg;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - pw * 0.30, py + ph * 0.18); c.lineTo(px + pw * 0.30, py + ph * 0.18); c.closePath(); c.fill();
    });
    // Soft rock texture strokes
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const sx = cx - 150 + Math.random() * 300;
      const sy = cy + 30 + Math.random() * 140;
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < SAFE * SAFE) continue;
      c.strokeStyle = `rgba(140,165,195,${0.15 + Math.random() * 0.15})`;
      c.lineWidth = 2 + Math.random() * 3;
      c.beginPath(); c.moveTo(sx, sy);
      c.quadraticCurveTo(sx + 20, sy + 10, sx + 30 + Math.random() * 40, sy + 15 + Math.random() * 25);
      c.stroke();
    }
    c.restore();
    // Simplified - no fancy effects for clarity

  } else if (terrain === 'desert') {
    // Storybook desert — warm amber like Disney's Aladdin/Lion King golden sands
    const bg = c.createRadialGradient(cx, cy * 0.55, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#F0D068'); bg.addColorStop(0.4, '#D4A838'); bg.addColorStop(1, '#9A7418');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Layered sand washes
    _watercolorWash(c, S, 'rgb(230,190,80)', 0.18, 10);
    _watercolorWash(c, S, 'rgb(200,150,50)', 0.12, 6);
    // Warm heat shimmer
    const heat = c.createRadialGradient(cx, cy * 0.55, 10, cx, cy * 0.6, S * 0.35);
    heat.addColorStop(0, 'rgba(255,240,170,0.22)'); heat.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = heat; c.fillRect(0, 0, S, S);
    // Soft watercolor dunes — overlapping elliptical washes
    const dunePts: [number, number, number, number][] = [
      [cx - 90, cy + SAFE + 70, 260, 85],
      [cx + 100, cy + SAFE + 90, 240, 75],
      [cx, cy + SAFE + 120, 300, 65],
      [cx + 50, cy - SAFE - 40, 200, 60],
    ];
    dunePts.forEach(([dx, dy, rw, rh]) => {
      // Dune body — gradient wash
      const dg = c.createRadialGradient(dx, dy - rh * 0.3, 0, dx, dy, rw * 0.6);
      dg.addColorStop(0, 'rgba(220,180,70,0.40)'); dg.addColorStop(1, 'rgba(180,140,40,0)');
      c.fillStyle = dg;
      c.beginPath(); c.ellipse(dx, dy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
      // Soft shadow wash
      c.fillStyle = 'rgba(130,85,20,0.15)';
      c.beginPath(); c.ellipse(dx + 15, dy + 6, rw * 0.7, rh * 0.4, 0, 0, Math.PI); c.closePath(); c.fill();
    });
    // Soft hand-painted cacti
    const cactusPts = _scatterPoints(cx, cy, SAFE * 1.3, 3, S * 0.15, S);
    cactusPts.forEach(([tx, ty]) => {
      c.save(); c.globalAlpha = 0.7; c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = '#2D6830'; c.lineWidth = S * 0.018;
      // Main trunk
      c.beginPath(); c.moveTo(tx, ty + S * 0.04); c.lineTo(tx, ty - S * 0.06); c.stroke();
      // Arms — curved
      c.lineWidth = S * 0.012;
      c.beginPath(); c.moveTo(tx - S * 0.02, ty - S * 0.01);
      c.quadraticCurveTo(tx - S * 0.04, ty - S * 0.02, tx - S * 0.04, ty - S * 0.045); c.stroke();
      c.beginPath(); c.moveTo(tx + S * 0.02, ty);
      c.quadraticCurveTo(tx + S * 0.035, ty - S * 0.01, tx + S * 0.035, ty - S * 0.035); c.stroke();
      c.restore();
    });
    // Soft wind ripple curves
    c.save(); c.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const ry = S * 0.15 + i * (S * 0.07);
      c.strokeStyle = `rgba(190,150,60,${0.12 + Math.random() * 0.08})`; c.lineWidth = 1 + Math.random();
      c.beginPath(); c.moveTo(S * 0.12, ry);
      for (let x = S * 0.12; x < S * 0.88; x += 12) {
        c.quadraticCurveTo(x + 6, ry + Math.sin(x * 0.03 + i) * 5, x + 12, ry + Math.sin((x + 12) * 0.03 + i) * 3);
      }
      c.stroke();
    }
    c.restore();
    // Simplified - no fancy effects for clarity
  }

  c.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
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
  // Flat-Topped exact math
  const x = HEX_SIZE * (3 / 2) * q * (1 + HEX_GAP);
  const z = HEX_SIZE * Math.sqrt(3) * (r + q / 2) * (1 + HEX_GAP);
  return [x, 0, z];
}

// Create hex shape
function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    // Flat-topped starts at 0 degrees
    const angle = (Math.PI / 3) * i;
    const x = size * Math.cos(angle);
    const z = size * Math.sin(angle);
    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
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
  const stoneRoughness = useMemo(() => getProceduralTexture('stone'), []);

  const hexShape  = useMemo(() => createHexShape(HEX_SIZE), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
  }), [mat.height]);

  const isRocky = hex.terrain === 'mountains' || hex.terrain === 'hills';
  const isWindy = hex.terrain === 'forest' || hex.terrain === 'fields' || hex.terrain === 'pasture';

  const onBeforeCompile = useMemo(() => {
    if (!isWindy) return undefined;
    return (shader: any) => {
      shader.uniforms.time = _windUniforms.time;
      shader.vertexShader = `
        uniform float time;
        ${shader.vertexShader}
      `.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        // Subtle wind swaying effect mapped to world position
        float sway = sin(position.x * 4.0 + time * 1.5) * cos(position.y * 4.0 + time * 1.2) * 0.015;
        transformed.z += sway;
        `
      );
    };
  }, [isWindy]);

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
          emissive={hovered ? '#2A1800' : mat.emissive}
          emissiveIntensity={hovered ? 0.35 : 0.06}
        />
      </mesh>

      {/* Top surface — illustrated terrain texture (like real Catan cardboard tile artwork) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, mat.height + 0.004, 0]} receiveShadow>
        <shapeGeometry args={[hexShape]} />
        <meshPhysicalMaterial
          map={getTerrainTexture(hex.terrain)}
          roughness={isRocky ? 0.88 : 0.95}
          metalness={0.0}
          roughnessMap={isRocky ? stoneRoughness : undefined}
          bumpMap={isRocky ? stoneRoughness : undefined}
          bumpScale={isRocky ? 0.015 : 0}
          emissive={mat.emissive}
          emissiveIntensity={0.10}
          clearcoat={0}
          clearcoatRoughness={0}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>

      {/* Number token — simplified for clarity */}
      {hex.number && !hex.hasRobber && (() => {
        const hot = hex.number === 6 || hex.number === 8;
        return (
          <group position={[0, mat.height + 0.08, 0]}>
            {/* Simple white background circle */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.45, 0.45, 0.04, 32]} />
              <meshStandardMaterial
                color={hot ? '#FF6B6B' : '#FFFFFF'}
                roughness={0.8}
                metalness={0.0}
              />
            </mesh>
            {/* Number — simplified for clarity */}
            <Text
              position={[0, 0.15, 0]}
              rotation={[0, 0, 0]}
              fontSize={0.35}
              color={hot ? '#000000' : '#000000'}
              anchorX="center"
              anchorY="middle"
              fontWeight={900}
            >
              {String(hex.number)}
            </Text>
          </group>
        );
      })()}

      {/* 3D Terrain Props — volumetric decorations on the hex surface */}
      {TERRAIN_PROPS[hex.terrain] && (() => {
        const PropComponent = TERRAIN_PROPS[hex.terrain];
        return (
          <group position={[0, mat.height + 0.005, 0]}>
            <PropComponent />
          </group>
        );
      })()}

      {/* Robber — storybook dark wood figurine */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          {/* Warm shadow aura */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <meshBasicMaterial color="#1A0800" transparent opacity={0.28} />
          </mesh>
          {/* Broad base — dark walnut wood */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.20, 0.24, 0.08, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.94} metalness={0.0} />
          </mesh>
          {/* Body — tapered, matte painted */}
          <mesh position={[0, 0.26, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.32, 12, 20]} />
            <meshStandardMaterial color="#201410" roughness={0.96} metalness={0.0} emissive="#080404" emissiveIntensity={0.08} />
          </mesh>
          {/* Head — smooth sphere */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.11, 20, 20]} />
            <meshStandardMaterial color="#1A1008" roughness={0.96} metalness={0.0} />
          </mesh>
          {/* Hood / pointed cap */}
          <mesh position={[0, 0.68, 0]} castShadow>
            <coneGeometry args={[0.10, 0.18, 16]} />
            <meshStandardMaterial color="#18080A" roughness={0.96} metalness={0.0} />
          </mesh>
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
// 3D TERRAIN PROPS — volumetric decorations on hex surfaces
// ============================================================================

function ForestProps() {
  const trees = useMemo(() =>
    Array.from({ length: 16 }).map(() => ({
      x: (Math.random() - 0.5) * 1.6,
      z: (Math.random() - 0.5) * 1.6,
      scale: 0.5 + Math.random() * 0.6,
      rotation: Math.random() * Math.PI,
    })).filter(t => t.x * t.x + t.z * t.z > 0.25),
  []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.scale} rotation={[0, t.rotation, 0]}>
          {/* Smooth trunk — warm brown wood */}
          <mesh castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.014, 0.022, 0.22, 12]} />
            <meshStandardMaterial color="#4A2E14" roughness={0.96} />
          </mesh>
          {/* Smooth foliage layers — rounded, soft, hand-painted feel */}
          <mesh castShadow position={[0, 0.28, 0]}>
            <coneGeometry args={[0.14, 0.36, 16]} />
            <meshStandardMaterial color="#1E5814" roughness={0.96} />
          </mesh>
          <mesh castShadow position={[0, 0.38, 0]} scale={0.78}>
            <coneGeometry args={[0.11, 0.30, 16]} />
            <meshStandardMaterial color="#2C7820" roughness={0.96} />
          </mesh>
          <mesh castShadow position={[0, 0.46, 0]} scale={0.56}>
            <coneGeometry args={[0.09, 0.24, 16]} />
            <meshStandardMaterial color="#389428" roughness={0.96} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function MountainProps() {
  const peaks = useMemo(() => [
    { x: 0.3, z: -0.2, sx: 0.7, sy: 1.0, sz: 0.7, rot: 0.2 },
    { x: -0.35, z: 0.25, sx: 0.5, sy: 0.7, sz: 0.5, rot: 0.8 },
    { x: 0.0, z: 0.4, sx: 0.4, sy: 0.5, sz: 0.4, rot: 1.2 },
    { x: -0.1, z: -0.45, sx: 0.35, sy: 0.45, sz: 0.35, rot: 0.5 },
  ], []);
  const rocks = useMemo(() =>
    Array.from({ length: 8 }).map(() => ({
      x: (Math.random() - 0.5) * 1.4,
      z: (Math.random() - 0.5) * 1.4,
      s: 0.03 + Math.random() * 0.04,
      r: [Math.random(), Math.random(), Math.random()] as [number, number, number],
    })).filter(r => r.x * r.x + r.z * r.z > 0.20),
  []);
  return (
    <group>
      {peaks.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]} scale={[p.sx, p.sy, p.sz]} rotation={[0, p.rot, 0]}>
          {/* Smooth mountain body — warm slate, painted feel */}
          <mesh castShadow position={[0, 0.30, 0]}>
            <coneGeometry args={[0.50, 0.65, 16]} />
            <meshStandardMaterial color="#586878" roughness={0.96} metalness={0.0} />
          </mesh>
          {/* Snow cap — soft luminous cream */}
          <mesh position={[0, 0.52, 0]} scale={[1.0, 0.30, 1.0]}>
            <coneGeometry args={[0.50, 0.65, 16]} />
            <meshStandardMaterial color="#F0EEF4" roughness={0.92} emissive="#E8E4F0" emissiveIntensity={0.06} />
          </mesh>
        </group>
      ))}
      {rocks.map((r, i) => (
        <mesh key={`r${i}`} position={[r.x, 0.02, r.z]} scale={r.s} rotation={r.r} castShadow>
          <dodecahedronGeometry />
          <meshStandardMaterial color="#3A404A" roughness={0.96} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

function HillsProps() {
  const mounds = useMemo(() =>
    Array.from({ length: 6 }).map(() => ({
      x: (Math.random() - 0.5) * 1.2,
      z: (Math.random() - 0.5) * 1.2,
      sx: 0.25 + Math.random() * 0.20,
      sy: 0.12 + Math.random() * 0.15,
      sz: 0.25 + Math.random() * 0.20,
      col: ['#8A5028', '#9A6038', '#704020'][Math.floor(Math.random() * 3)],
    })).filter(m => m.x * m.x + m.z * m.z > 0.18),
  []);
  const smallRocks = useMemo(() =>
    Array.from({ length: 10 }).map(() => ({
      x: (Math.random() - 0.5) * 1.3,
      z: (Math.random() - 0.5) * 1.3,
      s: 0.02 + Math.random() * 0.03,
    })).filter(r => r.x * r.x + r.z * r.z > 0.15),
  []);
  return (
    <group>
      {mounds.map((m, i) => (
        <mesh key={i} position={[m.x, m.sy * 0.5, m.z]} scale={[m.sx, m.sy, m.sz]} castShadow receiveShadow>
          <sphereGeometry args={[1, 24, 24]} />
          <meshStandardMaterial color={m.col} roughness={0.97} />
        </mesh>
      ))}
      {smallRocks.map((r, i) => (
        <mesh key={`hr${i}`} position={[r.x, 0.02, r.z]} scale={r.s} rotation={[Math.random(), Math.random(), 0]} castShadow>
          <dodecahedronGeometry />
          <meshStandardMaterial color={Math.random() > 0.5 ? '#5A4A3A' : '#4A3A2A'} roughness={0.96} metalness={0.0} />
        </mesh>
      ))}
    </group>
  );
}

function FieldsProps() {
  const stalks = useMemo(() =>
    Array.from({ length: 40 }).map(() => ({
      x: (Math.random() - 0.5) * 1.5,
      z: (Math.random() - 0.5) * 1.5,
      rot: Math.random() * Math.PI,
      scale: 0.5 + Math.random() * 0.5,
      col: Math.random() > 0.3 ? '#E0B830' : '#C89820',
    })).filter(s => s.x * s.x + s.z * s.z > 0.22),
  []);
  return (
    <group>
      {stalks.map((s, i) => (
        <mesh key={i} position={[s.x, 0.08, s.z]} rotation={[0, s.rot, 0]} scale={s.scale} castShadow>
          <boxGeometry args={[0.012, 0.16, 0.012]} />
          <meshStandardMaterial color={s.col} roughness={0.96} />
        </mesh>
      ))}
      {[-0.4, -0.15, 0.10, 0.35].map((x, i) => (
        <mesh key={`f${i}`} position={[x, 0.005, 0]} receiveShadow>
          <boxGeometry args={[0.04, 0.01, 1.2]} />
          <meshStandardMaterial color="#4A2C14" roughness={0.97} />
        </mesh>
      ))}
    </group>
  );
}

function PastureProps() {
  const grassClumps = useMemo(() =>
    Array.from({ length: 30 }).map(() => ({
      x: (Math.random() - 0.5) * 1.4,
      z: (Math.random() - 0.5) * 1.4,
      s: 0.04 + Math.random() * 0.08,
    })).filter(g => g.x * g.x + g.z * g.z > 0.20),
  []);
  const flowers = useMemo(() =>
    Array.from({ length: 16 }).map(() => ({
      x: (Math.random() - 0.5) * 1.3,
      z: (Math.random() - 0.5) * 1.3,
      col: ['#FFF8E0', '#FFD840', '#FF7098', '#A060D0'][Math.floor(Math.random() * 4)],
    })).filter(f => f.x * f.x + f.z * f.z > 0.20),
  []);
  const sheep = useMemo(() => [
    { x: 0.5, z: 0.3 }, { x: -0.4, z: -0.5 }, { x: 0.2, z: -0.6 },
  ], []);
  return (
    <group>
      {grassClumps.map((g, i) => (
        <mesh key={i} position={[g.x, g.s * 0.3, g.z]} scale={g.s}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial color="#5CB838" roughness={0.97} />
        </mesh>
      ))}
      {flowers.map((f, i) => (
        <mesh key={`fl${i}`} position={[f.x, 0.04, f.z]}>
          <sphereGeometry args={[0.018, 10, 10]} />
          <meshStandardMaterial color={f.col} roughness={0.96} emissive={f.col} emissiveIntensity={0.08} />
        </mesh>
      ))}
      {sheep.map((s, i) => (
        <group key={`sh${i}`} position={[s.x, 0.055, s.z]} scale={0.06}>
          <mesh castShadow>
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial color="#F8F4E8" roughness={0.97} />
          </mesh>
          <mesh position={[0.9, 0.4, 0]} scale={0.35}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#2A1A10" roughness={0.96} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DesertProps() {
  return (
    <group>
      {/* Smooth sand dune mounds */}
      <mesh position={[0.25, 0.03, 0.12]} rotation={[0.08, 0.2, 0.08]} castShadow>
        <sphereGeometry args={[0.30, 24, 24]} />
        <meshStandardMaterial color="#D8A030" roughness={0.97} />
      </mesh>
      <mesh position={[-0.30, 0.02, -0.20]} rotation={[-0.06, -0.3, 0]} castShadow>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#C08820" roughness={0.97} />
      </mesh>
      {/* Hand-painted cactus — smooth cylinders */}
      <group position={[0.12, 0.06, -0.35]} scale={0.4}>
        <mesh castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.18, 12]} />
          <meshStandardMaterial color="#2A7038" roughness={0.96} />
        </mesh>
        <mesh position={[0.04, 0.04, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.08, 12]} />
          <meshStandardMaterial color="#2A7038" roughness={0.96} />
        </mesh>
      </group>
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
// PROCEDURAL PBR TEXTURES
// ============================================================================

const _proceduralTextures: Record<string, THREE.CanvasTexture> = {};

function getProceduralTexture(type: 'wood' | 'stone' | 'weatheredWood'): THREE.CanvasTexture {
  if (_proceduralTextures[type]) return _proceduralTextures[type];
  
  const S = 512;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(S, S);
  const data = imgData.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      let v = 255;
      
      if (type === 'wood') {
        const grain = Math.sin(x * 0.15 + Math.sin(y * 0.02) * 5) * 20 + Math.random() * 15;
        v = 150 + grain;
      } else if (type === 'weatheredWood') {
        const grain = Math.sin(x * 0.18 + Math.sin(y * 0.04) * 8) * 30 + Math.random() * 25;
        v = 110 + grain + (Math.random() > 0.98 ? -40 : 0); // Adding deep cracks/imperfections
      } else if (type === 'stone') {
        const noise1 = Math.sin(x*0.1)*Math.cos(y*0.1) * 30;
        const noise2 = Math.random() * 50;
        v = 130 + noise1 + noise2;
      }

      data[i] = v;
      data[i+1] = v;
      data[i+2] = v;
      data[i+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  _proceduralTextures[type] = tex;
  return tex;
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
  const woodTex = useMemo(() => getProceduralTexture('wood'), []);
  const stoneTex = useMemo(() => getProceduralTexture('stone'), []);
  // Darken player color for roof/accents
  const roofColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.55);
    return '#' + c.getHexString();
  }, [color]);

  if (type === 'city') {
    // City: storybook castle miniature — matte hand-painted wood/clay feel
    return (
      <group position={position}>
        {/* Warm contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.30, 24]} />
          <meshBasicMaterial color="#1A0C00" transparent opacity={0.24} />
        </mesh>
        {/* Foundation slab — warm stone */}
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.24]} />
          <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
        </mesh>
        {/* Main keep — matte painted */}
        <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.28, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
        </mesh>
        {/* Keep peaked roof — matte clay */}
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.17, 0.12, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} />
        </mesh>
        {/* Round tower — smooth painted cylinder */}
        <mesh position={[0.12, 0.22, 0.06]} castShadow receiveShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.40, 16]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        {/* Tower conical roof */}
        <mesh position={[0.12, 0.46, 0.06]} castShadow>
          <coneGeometry args={[0.09, 0.10, 16]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} />
        </mesh>
        {/* Tower battlements */}
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((a, i) => (
          <mesh key={i} position={[0.12 + Math.cos(a)*0.065, 0.42, 0.06 + Math.sin(a)*0.065]} castShadow>
            <boxGeometry args={[0.025, 0.04, 0.025]} />
            <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} />
          </mesh>
        ))}
        {/* Side wing */}
        <mesh position={[-0.10, 0.10, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.16, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.004} />
        </mesh>
        {/* Side wing roof */}
        <mesh position={[-0.10, 0.21, -0.02]} rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[0.10, 0.08, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.96} />
        </mesh>
        {/* Door — warm wood */}
        <mesh position={[0, 0.06, 0.092]}>
          <boxGeometry args={[0.04, 0.07, 0.005]} />
          <meshStandardMaterial color="#3A2010" roughness={0.97} />
        </mesh>
        {/* Windows — warm candlelight glow */}
        {[[0.06, 0.18, 0.092], [-0.06, 0.18, 0.092], [0, 0.22, 0.092]].map(([wx, wy, wz], i) => (
          <mesh key={`w${i}`} position={[wx, wy, wz]}>
            <boxGeometry args={[0.022, 0.025, 0.003]} />
            <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.40} roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  // Settlement: storybook cozy cottage — matte hand-painted miniature
  return (
    <group position={position}>
      {/* Warm contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.20, 20]} />
        <meshBasicMaterial color="#1A0C00" transparent opacity={0.22} />
      </mesh>
      {/* Foundation — warm stone */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.20, 0.03, 0.16]} />
        <meshStandardMaterial color="#4A3C28" roughness={0.96} metalness={0.0} />
      </mesh>
      {/* Walls — matte painted */}
      <mesh position={[0, 0.10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.17, 0.13]} />
        <meshStandardMaterial color={color} roughness={0.94} metalness={0.0} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
      </mesh>
      {/* Peaked roof — matte clay */}
      <mesh position={[0, 0.23, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.14, 0.10, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.96} metalness={0.0} roughnessMap={woodTex} bumpMap={woodTex} bumpScale={0.003} />
      </mesh>
      {/* Chimney — warm brick */}
      <mesh position={[0.05, 0.25, -0.03]} castShadow>
        <boxGeometry args={[0.03, 0.08, 0.03]} />
        <meshStandardMaterial color="#5A3828" roughness={0.96} metalness={0.0} />
      </mesh>
      {/* Chimney smoke */}
      <mesh position={[0.05, 0.32, -0.03]}>
        <sphereGeometry args={[0.02, 12, 12]} />
        <meshBasicMaterial color="#A09888" transparent opacity={0.12} />
      </mesh>
      {/* Door — warm wood */}
      <mesh position={[0, 0.05, 0.067]}>
        <boxGeometry args={[0.035, 0.06, 0.004]} />
        <meshStandardMaterial color="#3A2010" roughness={0.97} />
      </mesh>
      {/* Window — warm candlelight */}
      <mesh position={[0.05, 0.13, 0.067]}>
        <boxGeometry args={[0.022, 0.025, 0.003]} />
        <meshStandardMaterial color="#FFE888" emissive="#FFD048" emissiveIntensity={0.35} roughness={0.5} />
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
  const [hovered, setHovered] = useState(false);
  const weatheredWood = useMemo(() => getProceduralTexture('weatheredWood'), []);
  const midX = (from[0] + to[0]) / 2;
  const midY = Math.max(from[1], to[1]) + 0.03;
  const midZ = (from[2] + to[2]) / 2;
  const length = Math.sqrt((to[0] - from[0]) ** 2 + (to[2] - from[2]) ** 2);
  const angle = Math.atan2(to[2] - from[2], to[0] - from[0]);

  // Darken colour for road bed
  const darkColor = useMemo(() => {
    const c = new THREE.Color(color);
    c.multiplyScalar(0.65);
    return '#' + c.getHexString();
  }, [color]);

  return (
    <group position={[midX, midY, midZ]} rotation={[0, -angle, 0]}>
      {/* Main road plank — wider, taller for visibility */}
      <mesh
        castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[length * 0.92, 0.05, 0.09]} />
        <meshStandardMaterial
          color={color}
          roughness={0.94}
          metalness={0.0}
          roughnessMap={weatheredWood}
          bumpMap={weatheredWood}
          bumpScale={0.004}
          emissive={color}
          emissiveIntensity={hovered ? 0.45 : 0.05}
        />
      </mesh>
      {/* Dark underside bed — gives depth illusion */}
      <mesh position={[0, -0.03, 0]}>
        <boxGeometry args={[length * 0.88, 0.02, 0.10]} />
        <meshStandardMaterial color={darkColor} roughness={0.90} metalness={0.0} />
      </mesh>
      {/* Side rail posts at ends */}
      {[-length * 0.40, length * 0.40].map((ox, i) => (
        <mesh key={i} position={[ox, 0.045, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.014, 0.07, 6]} />
          <meshStandardMaterial color={darkColor} roughness={0.88} metalness={0.05} />
        </mesh>
      ))}
    </group>
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

const _windUniforms = { time: { value: 0 } };

function GlobalAnimController() {
  useFrame(({ clock }) => {
    _windUniforms.time.value = clock.elapsedTime;
  });
  return null;
}

function Ocean() {
  return (
    <>
      {/* Layer 1: Deep ocean base — static dark blue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
        <circleGeometry args={[14.5, 80]} />
        <meshStandardMaterial
          color="#082850"
          roughness={0.08}
          metalness={0.28}
          emissive="#041430"
          emissiveIntensity={0.08}
        />
      </mesh>

      {/* Layer 2: Mid-depth teal transition ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.022, 0]}>
        <ringGeometry args={[7.5, 14.5, 80]} />
        <meshStandardMaterial
          color="#0C3A6E"
          roughness={0.10}
          metalness={0.25}
          transparent
          opacity={0.70}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Layer 3: Shallow coastal water — turquoise-blue */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.019, 0]}>
        <ringGeometry args={[5.8, 7.8, 80]} />
        <meshStandardMaterial
          color="#1A6898"
          roughness={0.14}
          metalness={0.18}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Layer 4: Static foam ring — no animation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.016, 0]}>
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
  const hexShape = useMemo(() => createHexShape(HEX_SIZE * 0.99), []);
  const borderShape = useMemo(() => createHexShape(HEX_SIZE * 1.002), []);
  const extSettings = useMemo(() => ({ depth: 0.08, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 0.014, bevelSegments: 2 }), []);
  const borderSettings = useMemo(() => ({ depth: 0.085, bevelEnabled: false }), []);
  return (
    <>
      {SEA_FRAME_POSITIONS.map((pos, i) => {
        const [wx, , wz] = hexToWorld(pos.q, pos.r);
        // Vary colour slightly per tile for organic look
        const hueShift = (i * 7) % 18;
        const r = 0.035 + hueShift * 0.001;
        const g = 0.16 + hueShift * 0.003;
        const b = 0.42 + hueShift * 0.005;
        return (
          <group key={i} position={[wx, -0.010, wz]}>
            {/* Gold trim border beneath sea tile */}
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

function Harbors() {
  const harborHex = useMemo(() => createHarborHexShape(0.72), []);
  const woodTex = useMemo(() => getProceduralTexture('weatheredWood'), []);
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
        const hexRot = pierAngle;

        return (
          <group key={i} position={[px, 0.04, pz]}>
            {/* Harbor hex base — dark stone foundation */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, -0.01, 0]} receiveShadow>
              <extrudeGeometry args={[harborHex, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }]} />
              <meshStandardMaterial color="#2A2018" roughness={0.85} metalness={0.05} />
            </mesh>
            {/* Harbor hex coloured top — resource indicator surface */}
            <mesh rotation={[-Math.PI / 2, hexRot, 0]} position={[0, 0.05, 0]}>
              <shapeGeometry args={[harborHex]} />
              <meshStandardMaterial color={color} roughness={0.55} metalness={0.08} emissive={color} emissiveIntensity={0.12} />
            </mesh>

            {/* Label — larger, bolder typography */}
            <Text
              position={[0, 0.08, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.16}
              color="#FFFFFF"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.028}
              outlineColor="#000000"
              fontWeight={700}
            >
              {harbor.label}
            </Text>

            {/* Wooden pier/dock extending toward island */}
            <mesh
              position={[-nx * 0.50, 0.03, -nz * 0.50]}
              rotation={[0, pierAngle, 0]}
              castShadow receiveShadow
            >
              <boxGeometry args={[0.55, 0.035, 0.14]} />
              <meshStandardMaterial
                color="#3A2210"
                roughness={0.88}
                metalness={0.02}
                roughnessMap={woodTex}
                bumpMap={woodTex}
                bumpScale={0.005}
              />
            </mesh>

            {/* Pier support piles — dark wood cylinders driven into water */}
            {[-0.20, 0, 0.20].map((off, pi) => {
              const perpX = Math.cos(pierAngle + Math.PI / 2) * off;
              const perpZ = Math.sin(pierAngle + Math.PI / 2) * off;
              return (
                <group key={pi}>
                  {/* Main pile */}
                  <mesh position={[-nx * 0.50 + perpX, -0.01, -nz * 0.50 + perpZ]} castShadow>
                    <cylinderGeometry args={[0.022, 0.028, 0.18, 8]} />
                    <meshStandardMaterial color="#2A1808" roughness={0.95} metalness={0.0} />
                  </mesh>
                  {/* Pile cap */}
                  <mesh position={[-nx * 0.50 + perpX, 0.07, -nz * 0.50 + perpZ]}>
                    <sphereGeometry args={[0.026, 8, 8]} />
                    <meshStandardMaterial color="#1A1008" roughness={0.90} />
                  </mesh>
                </group>
              );
            })}

            {/* Bollard posts at harbor tile edge */}
            {[-0.30, 0.30].map((off, bi) => {
              const bpx = Math.cos(pierAngle + Math.PI / 2) * off;
              const bpz = Math.sin(pierAngle + Math.PI / 2) * off;
              return (
                <mesh key={`b${bi}`} position={[bpx, 0.08, bpz]} castShadow>
                  <cylinderGeometry args={[0.025, 0.030, 0.10, 8]} />
                  <meshStandardMaterial color="#4A3818" roughness={0.90} />
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
// 3D DICE PAIR — physical dice sitting on the board near the edge
// ============================================================================

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

function DiePips({ value, faceNormal }: { value: number; faceNormal: [number, number, number] }) {
  const pips = PIP_LAYOUTS[value] || [];
  const spacing = 0.065;
  const pipR = 0.018;

  // Determine local up and right axes for the face
  const [nx, ny, nz] = faceNormal;
  let upVec: [number, number, number], rightVec: [number, number, number];
  if (Math.abs(ny) > 0.5) {
    upVec = [0, 0, ny > 0 ? -1 : 1];
    rightVec = [1, 0, 0];
  } else if (Math.abs(nx) > 0.5) {
    upVec = [0, 1, 0];
    rightVec = [0, 0, nx > 0 ? -1 : 1];
  } else {
    upVec = [0, 1, 0];
    rightVec = [nz > 0 ? 1 : -1, 0, 0];
  }

  return (
    <>
      {pips.map(([col, row], i) => {
        const ox = col * spacing;
        const oy = row * spacing;
        return (
          <mesh
            key={i}
            position={[
              nx * 0.13 + rightVec[0] * ox + upVec[0] * oy,
              ny * 0.13 + rightVec[1] * ox + upVec[1] * oy,
              nz * 0.13 + rightVec[2] * ox + upVec[2] * oy,
            ]}
          >
            <sphereGeometry args={[pipR, 8, 8]} />
            <meshStandardMaterial color="#181818" roughness={0.3} metalness={0.1} />
          </mesh>
        );
      })}
    </>
  );
}

// Rotation quaternions to put each value on the +Y face of a standard die
const VALUE_TO_ROTATION: Record<number, [number, number, number, number]> = {
  1: [0, 0, -0.7071, 0.7071],   // +X up → value 1 top
  2: [0.7071, 0, 0, 0.7071],    // +Z up → value 2 top
  3: [0, 0, 0, 1],              // +Y up → value 3 top (identity)
  4: [1, 0, 0, 0],              // -Y up → value 4 top (180° around X)
  5: [-0.7071, 0, 0, 0.7071],   // -Z up → value 5 top
  6: [0, 0, 0.7071, 0.7071],    // -X up → value 6 top
};

function PhysicsDie({ value, startPos, seed }: { value: number; startPos: [number, number, number]; seed: number }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const settled = useRef(false);
  const timer = useRef(0);

  useFrame((_, delta) => {
    if (!bodyRef.current || settled.current) return;
    timer.current += delta;

    // After 2s, force settle to correct rotation
    if (timer.current > 2.0) {
      const quat = VALUE_TO_ROTATION[value] || VALUE_TO_ROTATION[3];
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] }, true);
      settled.current = true;
      return;
    }

    // Check if velocity is near zero → snap
    const vel = bodyRef.current.linvel();
    const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    if (timer.current > 0.8 && speed < 0.05) {
      const quat = VALUE_TO_ROTATION[value] || VALUE_TO_ROTATION[3];
      bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      bodyRef.current.setRotation({ x: quat[0], y: quat[1], z: quat[2], w: quat[3] }, true);
      settled.current = true;
    }
  });

  const topVal = value;
  const bottomVal = 7 - value;

  return (
    <RigidBody
      ref={bodyRef}
      position={startPos}
      rotation={[seed * 2.1, seed * 3.7, seed * 1.3]}
      linearVelocity={[(Math.random() - 0.5) * 1.5, -2, (Math.random() - 0.5) * 1.5]}
      angularVelocity={[(Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15, (Math.random() - 0.5) * 15]}
      restitution={0.3}
      friction={0.8}
      colliders="cuboid"
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.24, 0.24]} />
        <meshStandardMaterial
          color="#F5F0E8"
          roughness={0.55}
          metalness={0.02}
          emissive="#201808"
          emissiveIntensity={0.03}
        />
      </mesh>
      <DiePips value={topVal} faceNormal={[0, 1, 0]} />
      <DiePips value={Math.max(1, Math.min(6, (topVal + 1) % 6 + 1))} faceNormal={[0, 0, 1]} />
      <DiePips value={bottomVal > 3 ? bottomVal - 3 : bottomVal + 2} faceNormal={[1, 0, 0]} />
    </RigidBody>
  );
}

function Dice3DPair({ diceRoll }: { diceRoll: [number, number] | null }) {
  if (!diceRoll) return null;

  // Use a key based on values to re-trigger physics on each new roll
  const rollKey = `${diceRoll[0]}-${diceRoll[1]}-${Date.now()}`;

  return (
    <group position={[3.8, 0, 3.8]}>
      {/* Invisible floor for dice to land on */}
      <Physics gravity={[0, -9.81, 0]} key={rollKey}>
        <RigidBody type="fixed" position={[0, -0.02, 0]}>
          <mesh>
            <boxGeometry args={[2, 0.04, 2]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </RigidBody>
        <PhysicsDie value={diceRoll[0]} startPos={[-0.2, 1.8, 0]} seed={0.3} />
        <PhysicsDie value={diceRoll[1]} startPos={[0.2, 2.1, 0.06]} seed={1.7} />
      </Physics>
      {/* Contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]}>
        <circleGeometry args={[0.50, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} />
      </mesh>
    </group>
  );
}

// ============================================================================
// 3D SPATIAL PRESENCE — holographic player nameplates around the board
// ============================================================================

const SEAT_POSITIONS: [number, number, number][] = [
  [0,    0.6, -12.5],  // North
  [12.5, 0.6,  0],     // East
  [0,    0.6,  12.5],  // South
  [-12.5,0.6,  0],     // West
];

interface PlayerNameplate3DProps {
  name: string;
  color: string;
  vp: number;
  isActive: boolean;
  position: [number, number, number];
}

function PlayerNameplate3D({ name, color, vp, isActive, position }: PlayerNameplate3DProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.2) * 0.06;
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Billboard so it always faces camera */}
      <group>
        {/* Glowing backdrop panel */}
        <mesh>
          <planeGeometry args={[2.8, 0.9]} />
          <meshStandardMaterial
            color="#0A0A1A"
            transparent
            opacity={0.75}
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>

        {/* Color accent bar (left side) */}
        <mesh position={[-1.25, 0, 0.005]}>
          <planeGeometry args={[0.12, 0.75]} />
          <meshBasicMaterial color={color} />
        </mesh>

        {/* Active turn glow ring */}
        {isActive && (
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[3.0, 1.1]} />
            <meshBasicMaterial color={color} transparent opacity={0.15} />
          </mesh>
        )}

        {/* Player name */}
        <Text
          position={[-0.3, 0.12, 0.02]}
          fontSize={0.22}
          color="white"
          anchorX="center"
          anchorY="middle"
          font={undefined}
          maxWidth={2}
        >
          {name}
        </Text>

        {/* VP badge */}
        <group position={[1.0, 0.12, 0.02]}>
          <mesh>
            <circleGeometry args={[0.18, 24]} />
            <meshBasicMaterial color={color} />
          </mesh>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.18}
            color="white"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {`${vp}`}
          </Text>
        </group>

        {/* Scanline effect overlay */}
        <mesh position={[0, 0, 0.003]}>
          <planeGeometry args={[2.8, 0.9]} />
          <meshBasicMaterial
            color="#00FFFF"
            transparent
            opacity={0.03}
            wireframe
          />
        </mesh>

        {/* Bottom accent line */}
        <mesh position={[0, -0.38, 0.005]}>
          <planeGeometry args={[2.6, 0.015]} />
          <meshBasicMaterial color={color} transparent opacity={isActive ? 0.9 : 0.4} />
        </mesh>
      </group>

      {/* Small point light for local glow */}
      <pointLight
        color={color}
        intensity={isActive ? 0.6 : 0.15}
        distance={3}
        decay={2}
      />
    </group>
  );
}

// ============================================================================
// SPATIAL AMBIENCE — 3D positioned ambient audio cues
// ============================================================================

function SpatialAmbience() {
  const listenerRef = useRef<THREE.AudioListener | null>(null);
  const oceanRef = useRef<THREE.PositionalAudio | null>(null);
  const windRef = useRef<THREE.PositionalAudio | null>(null);
  const [audioReady, setAudioReady] = useState(false);

  useFrame(({ camera }) => {
    if (!listenerRef.current) {
      const listener = new THREE.AudioListener();
      camera.add(listener);
      listenerRef.current = listener;

      // Ocean ambient — positioned at sea frame edge
      const oceanAudio = new THREE.PositionalAudio(listener);
      oceanAudio.position.set(0, 0.2, 13);
      oceanAudio.setRefDistance(8);
      oceanAudio.setRolloffFactor(1.5);
      oceanAudio.setVolume(0.12);
      oceanRef.current = oceanAudio;

      // Wind ambient — positioned above board center
      const windAudio = new THREE.PositionalAudio(listener);
      windAudio.position.set(0, 4, 0);
      windAudio.setRefDistance(12);
      windAudio.setRolloffFactor(1);
      windAudio.setVolume(0.08);
      windRef.current = windAudio;

      setAudioReady(true);
    }
  });

  // Ambient sounds are placeholder-ready — actual audio buffers
  // would be loaded from CDN when the user enables spatial audio.
  // For now we just set up the 3D audio infrastructure.

  return audioReady ? (
    <>
      {/* Visual indicator for spatial audio anchor points (debug) */}
      <mesh position={[0, 0.2, 13]} visible={false}>
        <sphereGeometry args={[0.1]} />
        <meshBasicMaterial color="#00AAFF" />
      </mesh>
    </>
  ) : null;
}

function PlayerPresence3D({ gameState }: { gameState: GameState }) {
  return (
    <>
      {gameState.players.map((player, i) => {
        const seat = SEAT_POSITIONS[i % SEAT_POSITIONS.length];
        const isActive = i === gameState.currentPlayerIndex;
        return (
          <PlayerNameplate3D
            key={player.id}
            name={player.name}
            color={player.color}
            vp={player.victoryPoints}
            isActive={isActive}
            position={seat}
          />
        );
      })}
    </>
  );
}

// ============================================================================
// BUILD MARKERS — Animated pulsing indicators for buildable spots
// ============================================================================

function VertexBuildMarker({ position, vertexId, onClick, color }: {
  position: [number, number, number];
  vertexId: string;
  onClick: (id: string) => void;
  color: string;
}) {
  const dotRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!dotRef.current) return;
    const t = clock.elapsedTime;
    // Subtle vertical bob
    dotRef.current.position.y = position[1] + 0.12 + Math.sin(t * 1.5) * 0.02;
    // Subtle pulse
    const pulse = 1.0 + Math.sin(t * 1.2) * 0.05;
    dotRef.current.scale.setScalar(hovered ? pulse * 1.2 : pulse);
  });

  return (
    <group>
      {/* Small dot colored by resource type */}
      <mesh
        ref={dotRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[position[0], position[1] + 0.12, position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(vertexId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <circleGeometry args={[0.04, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Smaller outline on hover - half size */}
      {hovered && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[position[0], position[1] + 0.12, position[2]]}
        >
          <ringGeometry args={[0.06, 0.08, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Invisible larger click target */}
      <mesh
        position={[position[0], position[1] + 0.12, position[2]]}
        onClick={(e) => { e.stopPropagation(); onClick(vertexId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        visible={false}
      >
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

function EdgeBuildMarker({ position, rotation, length, edgeId, onClick }: {
  position: [number, number, number];
  rotation: number;
  length: number;
  edgeId: string;
  onClick: (id: string) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime * 2.5;
    const pulse = 1.0 + Math.sin(t * 1.5) * 0.12;
    meshRef.current.scale.set(1, hovered ? pulse * 1.3 : pulse, hovered ? pulse * 1.3 : pulse);
    // Gentle vertical bob
    meshRef.current.position.y = position[1] + Math.sin(t) * 0.04;
  });

  return (
    <group position={position} rotation={[0, -rotation, 0]}>
      {/* Road indicator — glowing capsule along the edge */}
      <mesh
        ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(edgeId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        castShadow
      >
        <boxGeometry args={[length * 0.85, 0.12, 0.16]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFA500'}
          emissive={hovered ? '#FFD700' : '#FF6600'}
          emissiveIntensity={hovered ? 1.0 : 0.45}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* End caps — small spheres at each end for visual clarity */}
      <mesh position={[length * 0.40, 0, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFD700'}
          emissive="#FF8C00"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[-length * 0.40, 0, 0]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={hovered ? '#FFFFFF' : '#FFD700'}
          emissive="#FF8C00"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Glow light — subtle */}
      <pointLight
        color="#FFA500"
        intensity={hovered ? 1.2 : 0.3}
        distance={2}
        decay={2}
      />

      {/* Large invisible click target */}
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); onClick(edgeId); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <boxGeometry args={[length * 0.92, 0.4, 0.4]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}

// ============================================================================
// BOARD CONTENT — Full 3D scene
// ============================================================================

interface BoardContentProps {
  gameState: GameState;
  presencePlayers?: Presence3DPlayer[];
  resourceAnimations?: ResourceAnimation[];
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  validVertexIds?: string[];
  validEdgeIds?: string[];
}

function BoardContent({ gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds }: BoardContentProps) {
  const orbitRef = useRef<any>(null);
  useKeyboardControls(orbitRef);

  const getPlayerColor = (playerId: string): string => {
    return gameState.players.find(p => p.id === playerId)?.color || '#888';
  };

  return (
    <>
      <GlobalAnimController />

      {/* ══════════════════════════════════════════════════════════════════
          CINEMATIC LIGHTING RIG — warm museum-gallery tabletop feel
          7 light sources for depth, drama, and realistic PBR response
          ══════════════════════════════════════════════════════════════════ */}
      {/* Ambient: warm golden, like candlelight in a storybook cottage */}
      <ambientLight intensity={0.35} color="#F8E8D0" />

      {/* KEY — soft warm golden overhead (Disney golden-hour, not harsh) */}
      <directionalLight
        position={[6, 28, 5]}
        intensity={1.5}
        color="#FFE8C0"
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-far={60}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.00015}
        shadow-normalBias={0.02}
      />

      {/* Simplified lighting for clarity - no disco ball effect */}
      <ambientLight intensity={0.6} color="#FFFFFF" />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 19, 4.5]} fov={38} />
      <OrbitControls ref={orbitRef} enablePan enableZoom enableRotate minDistance={5} maxDistance={28} maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.10} />

      {/* Background */}
      <color attach="background" args={['#0A1628']} />

      {/* High-res contact shadows — soft diffuse ground shadows */}
      <ContactShadows
        position={[0, -0.025, 0]}
        opacity={0.35}
        scale={30}
        blur={2.5}
        far={8}
        resolution={1024}
        color="#000000"
      />

      {/* Post-processing — clean anti-aliasing only, no bloom/DoF/fog */}
      <EffectComposer multisampling={8}>
        <SMAA />
      </EffectComposer>

      {/* ══ WALNUT TABLE SURFACE ══ */}
      {/* Main table body — dark walnut with subtle sheen */}
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <cylinderGeometry args={[17, 17.2, 0.50, 80]} />
        <meshStandardMaterial
          color="#1A0D06"
          roughness={0.72}
          metalness={0.08}
          roughnessMap={getProceduralTexture('wood')}
          bumpMap={getProceduralTexture('wood')}
          bumpScale={0.005}
          emissive="#0A0400"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Table top surface — slightly lighter walnut veneer */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.029, 0]} receiveShadow>
        <circleGeometry args={[17, 80]} />
        <meshStandardMaterial
          color="#22140A"
          roughness={0.68}
          metalness={0.10}
          roughnessMap={getProceduralTexture('wood')}
          bumpMap={getProceduralTexture('wood')}
          bumpScale={0.003}
          emissive="#080400"
          emissiveIntensity={0.10}
        />
      </mesh>
      {/* Felt inlay ring — dark green gaming felt under the board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.027, 0]} receiveShadow>
        <ringGeometry args={[0.5, 10.5, 80]} />
        <meshStandardMaterial color="#0C2810" roughness={0.98} metalness={0.0} emissive="#020A04" emissiveIntensity={0.08} />
      </mesh>
      {/* Brass edge band — thin metallic ring at table lip */}
      <mesh position={[0, -0.06, 0]}>
        <torusGeometry args={[17.1, 0.035, 8, 120]} />
        <meshStandardMaterial color="#8A6820" roughness={0.30} metalness={0.70} emissive="#3A2800" emissiveIntensity={0.15} />
      </mesh>

      {/* Sea frame — ring of 18 sea tiles bordering the island */}
      <SeaFrame />

      {/* Ocean */}
      <Ocean />

      {/* Harbour port indicators */}
      <Harbors />

      {/* 3D Dice pair on the board */}
      <Dice3DPair diceRoll={gameState.diceRoll ?? null} />

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

      {/* 3D Spatial Presence — holographic player nameplates around the board */}
      <PlayerPresence3D gameState={gameState} />

      {/* 3D Video Presence Panels — webcam feeds floating in 3D scene */}
      {presencePlayers && presencePlayers.length > 0 && (
        <CatanPresence3D players={presencePlayers} />
      )}

      {/* 3D Resource Flow — animated tokens flying hex → player */}
      {resourceAnimations && resourceAnimations.length > 0 && (
        <ResourceFlow3D animations={resourceAnimations} />
      )}

      {/* Spatial Ambience — 3D positioned ambient audio infrastructure */}
      <SpatialAmbience />

      {/* Buildable vertex indicators — ONLY valid positions */}
      {onVertexClick && validVertexIds && validVertexIds.length > 0 && gameState.vertices
        .filter(v => validVertexIds.includes(v.id))
        .map(vertex => {
          const pos = getVertexWorldPos(vertex, gameState.hexTiles);
          if (!pos) return null;

          // Get color from adjacent hex resource type
          const adjacentHex = gameState.hexTiles.find(h => vertex.hexIds.includes(h.id));
          const resource = adjacentHex ? TERRAIN_RESOURCES[adjacentHex.terrain] : null;
          const resourceColors: Record<string, string> = {
            wood: '#22c55e',
            brick: '#ef4444',
            sheep: '#84cc16',
            wheat: '#eab308',
            ore: '#64748b',
          };
          const color = resource ? resourceColors[resource] : '#FFD700';

          return (
            <VertexBuildMarker
              key={`vbuild-${vertex.id}`}
              position={pos}
              vertexId={vertex.id}
              onClick={onVertexClick}
              color={color}
            />
          );
      })}

      {/* Buildable edge indicators — ONLY valid positions */}
      {onEdgeClick && validEdgeIds && validEdgeIds.length > 0 && gameState.edges
        .filter(e => validEdgeIds.includes(e.id))
        .map(edge => {
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
            <EdgeBuildMarker
              key={`ebuild-${edge.id}`}
              position={[midX, 0.12, midZ] as [number, number, number]}
              rotation={angle}
              length={length}
              edgeId={edge.id}
              onClick={onEdgeClick}
            />
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
  presencePlayers?: Presence3DPlayer[];
  resourceAnimations?: ResourceAnimation[];
  onHexClick?: (hexId: number) => void;
  onVertexClick?: (vertexId: string) => void;
  onEdgeClick?: (edgeId: string) => void;
  validVertexIds?: string[];
  validEdgeIds?: string[];
}

export default function CatanBoard3D({ 
  gameState, presencePlayers, resourceAnimations, onHexClick, onVertexClick, onEdgeClick, validVertexIds, validEdgeIds
}: CatanBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
          precision: 'highp',
        }}
        dpr={[1.5, 2]}
      >
        <XR store={xrStore}>
          <Suspense fallback={null}>
            <BoardContent
              gameState={gameState}
              presencePlayers={presencePlayers}
              resourceAnimations={resourceAnimations}
              onHexClick={onHexClick}
              onVertexClick={onVertexClick}
              onEdgeClick={onEdgeClick}
              validVertexIds={validVertexIds}
              validEdgeIds={validEdgeIds}
            />
          </Suspense>
        </XR>
      </Canvas>

      {/* Canvas overlay — painterly texture feel (like ABAS) */}
      <div
        className="absolute inset-0 pointer-events-none z-10 opacity-[0.008] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '256px 256px',
        }}
      />

      {/* VR Entry Button — only visible on WebXR-capable devices */}
      <button
        onClick={() => xrStore.enterVR()}
        className="absolute bottom-3 left-3 z-20 px-3 py-1.5 bg-indigo-700/80 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg backdrop-blur-sm border border-indigo-500/40 shadow-lg transition-all opacity-60 hover:opacity-100"
        title="Enter VR (requires WebXR headset)"
      >
        🥽 Enter VR
      </button>
    </div>
  );
}
