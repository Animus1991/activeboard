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

// PBR terrain materials — rich physical board colours with subtle emissive depth
const TERRAIN_MATS: Record<string, { base: string; top: string; emissive: string; height: number; roughness: number; metalness: number }> = {
  forest:    { base: '#14401A', top: '#1C5420', emissive: '#041A06', height: 0.15, roughness: 0.92, metalness: 0.0 },
  hills:     { base: '#7A2810', top: '#9C3218', emissive: '#1A0800', height: 0.24, roughness: 0.88, metalness: 0.02 },
  pasture:   { base: '#2E7C20', top: '#3C9028', emissive: '#061A04', height: 0.09, roughness: 0.94, metalness: 0.0 },
  fields:    { base: '#9A6A08', top: '#B88010', emissive: '#1A1200', height: 0.08, roughness: 0.90, metalness: 0.0 },
  mountains: { base: '#3A444E', top: '#4E5868', emissive: '#0A0E14', height: 0.38, roughness: 0.78, metalness: 0.08 },
  desert:    { base: '#9A7428', top: '#B88C38', emissive: '#1A1408', height: 0.06, roughness: 0.95, metalness: 0.0 },
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

function buildTerrainTexture(terrain: string): THREE.CanvasTexture {
  const S = 768;
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
    // Multi-layer forest floor
    const bg = c.createRadialGradient(cx, cy * 0.7, 0, cx, cy, S * 0.56);
    bg.addColorStop(0, '#2C6A14'); bg.addColorStop(0.5, '#1E5010'); bg.addColorStop(1, '#0C2806');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Dappled light
    const dapple = c.createRadialGradient(cx - 60, cy - 90, 20, cx - 60, cy - 90, 200);
    dapple.addColorStop(0, 'rgba(120,180,40,0.22)'); dapple.addColorStop(1, 'rgba(40,80,10,0)');
    c.fillStyle = dapple; c.fillRect(0, 0, S, S);
    // Leaf litter / moss patches outside safe
    const mossPts = _scatterPoints(cx, cy, SAFE, 18, 40, S);
    mossPts.forEach(([mx, my]) => {
      const r = 15 + Math.random() * 25;
      const g = c.createRadialGradient(mx, my, 0, mx, my, r);
      g.addColorStop(0, `rgba(${50 + Math.random() * 40},${100 + Math.random() * 40},20,0.35)`);
      g.addColorStop(1, 'rgba(30,60,10,0)');
      c.fillStyle = g; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill();
    });
    // Trees at 8 positions outside safe
    const treePts: [number, number, number][] = [
      [cx - 200, cy - 80, 82], [cx + 190, cy - 75, 76], [cx - 200, cy + 100, 70],
      [cx + 195, cy + 95, 74], [cx - 70, cy + 230, 64], [cx + 75, cy + 235, 62],
      [cx - 140, cy - 190, 58], [cx + 130, cy - 195, 60],
    ];
    treePts.forEach(([tx, ty, sz]) => drawTree(c, tx, ty, sz));
    // Shadow under trees
    treePts.forEach(([tx, ty, sz]) => {
      c.fillStyle = 'rgba(0,20,0,0.18)';
      c.beginPath(); c.ellipse(tx, ty + sz * 0.35, sz * 0.5, sz * 0.18, 0, 0, Math.PI * 2); c.fill();
    });
    _applyNoiseOverlay(c, S, 0.06, true);
    _applyHexVignette(c, cx, cy, S, 0.30);

  } else if (terrain === 'hills') {
    const bg = c.createLinearGradient(0, 0, S * 0.3, S);
    bg.addColorStop(0, '#C85020'); bg.addColorStop(0.5, '#A03010'); bg.addColorStop(1, '#6A1C08');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Warm highlight
    const hl = c.createRadialGradient(cx - 50, cy - 80, 10, cx - 50, cy - 80, S * 0.45);
    hl.addColorStop(0, 'rgba(240,130,70,0.42)'); hl.addColorStop(1, 'rgba(200,90,40,0)');
    c.fillStyle = hl; c.fillRect(0, 0, S, S);
    // Rolling hill contours
    const hillPts: [number, number, number, number, string][] = [
      [cx, cy - SAFE - 70, 260, 100, 'rgba(180,70,25,0.35)'],
      [cx - 100, cy + SAFE + 50, 220, 85, 'rgba(150,50,15,0.30)'],
      [cx + 110, cy + SAFE + 70, 200, 75, 'rgba(140,45,12,0.28)'],
    ];
    hillPts.forEach(([hx, hy, rw, rh, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(hx, hy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Brick/clay deposits at edges
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const bx = S * 0.18 + col * (S * 0.12) + (row % 2) * (S * 0.06);
        const by = cy + SAFE + 15 + row * (S * 0.04);
        if (by > S * 0.90) break;
        c.fillStyle = `rgba(80,20,0,${0.25 + Math.random() * 0.15})`;
        c.fillRect(bx, by, S * 0.09, S * 0.028);
        c.strokeStyle = 'rgba(255,120,50,0.25)'; c.lineWidth = 1;
        c.strokeRect(bx, by, S * 0.09, S * 0.028);
      }
    }
    _applyNoiseOverlay(c, S, 0.07, true);
    _applyHexVignette(c, cx, cy, S, 0.32);

  } else if (terrain === 'pasture') {
    const bg = c.createLinearGradient(0, 0, 0, S);
    bg.addColorStop(0, '#78B838'); bg.addColorStop(0.6, '#4C9818'); bg.addColorStop(1, '#2A7010');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Gentle rolling hills at edges
    const rollHills: [number, number, number, number, string][] = [
      [cx - 80, cy + SAFE + 80, 250, 95, '#5CA822'],
      [cx + 90, cy + SAFE + 95, 220, 85, '#4E9A1A'],
      [cx, cy - SAFE - 60, 280, 70, '#68B430'],
    ];
    rollHills.forEach(([hx, hy, rw, rh, col]) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(hx, hy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
    });
    // Rustic fence at edge
    const fy = cy + SAFE + 25;
    c.fillStyle = '#6A4C0C'; c.fillRect(S * 0.15, fy, S * 0.70, S * 0.012);
    const fencePosts = [0.18, 0.32, 0.50, 0.68, 0.82];
    fencePosts.forEach(fx => {
      c.fillStyle = '#6A4C0C'; c.fillRect(S * fx, fy - S * 0.03, S * 0.014, S * 0.07);
    });
    // Fluffy sheep blobs at corners — pure wool, no faces
    const sheepPts = _scatterPoints(cx, cy, SAFE * 1.1, 5, S * 0.12, S);
    sheepPts.forEach(([sx, sy]) => {
      c.fillStyle = 'rgba(248,248,245,0.90)';
      c.beginPath(); c.ellipse(sx, sy, S * 0.045, S * 0.032, Math.random() * 0.3, 0, Math.PI * 2); c.fill();
      for (let k = 0; k < 5; k++) {
        const dx = (Math.random() - 0.5) * S * 0.05;
        const dy = (Math.random() - 0.5) * S * 0.035;
        c.fillStyle = 'rgba(255,255,255,0.80)';
        c.beginPath(); c.arc(sx + dx, sy + dy, S * 0.018, 0, Math.PI * 2); c.fill();
      }
      // Shadow
      c.fillStyle = 'rgba(0,40,0,0.12)';
      c.beginPath(); c.ellipse(sx, sy + S * 0.03, S * 0.04, S * 0.012, 0, 0, Math.PI * 2); c.fill();
    });
    _applyNoiseOverlay(c, S, 0.05, true);
    _applyHexVignette(c, cx, cy, S, 0.25);

  } else if (terrain === 'fields') {
    const bg = c.createLinearGradient(0, 0, S * 0.2, S);
    bg.addColorStop(0, '#E8B820'); bg.addColorStop(0.5, '#C48A0C'); bg.addColorStop(1, '#7A5200');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Golden light glow
    const glow = c.createRadialGradient(cx, cy * 0.7, 20, cx, cy * 0.7, S * 0.4);
    glow.addColorStop(0, 'rgba(255,220,80,0.30)'); glow.addColorStop(1, 'rgba(255,200,50,0)');
    c.fillStyle = glow; c.fillRect(0, 0, S, S);
    // Dense wheat stalks — skip centre safe zone
    for (let row = 0; row < 12; row++) {
      const ry = S * 0.06 + row * (S * 0.075);
      for (let col = 0; col < 12; col++) {
        const wx = S * 0.04 + col * (S * 0.08) + (row % 2) * (S * 0.04);
        const dx = wx - cx, dy = ry - cy;
        if (dx * dx + dy * dy < SAFE * SAFE * 0.85) continue;
        // Stalk
        const sway = Math.sin(wx * 0.03) * 4;
        c.strokeStyle = `rgba(140,100,10,${0.5 + Math.random() * 0.3})`;
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(wx, ry + S * 0.035); c.lineTo(wx + sway, ry - S * 0.035); c.stroke();
        // Wheat head
        c.fillStyle = `rgba(${200 + Math.random() * 40},${150 + Math.random() * 30},${20 + Math.random() * 20},0.9)`;
        c.beginPath(); c.ellipse(wx + sway, ry - S * 0.042, S * 0.006, S * 0.022, sway * 0.03, 0, Math.PI * 2); c.fill();
        // Grain kernels
        for (let k = 0; k < 3; k++) {
          c.fillStyle = 'rgba(230,180,30,0.7)';
          c.beginPath();
          c.ellipse(wx + sway + (k % 2 === 0 ? -3 : 3), ry - S * 0.03 - k * (S * 0.012),
            S * 0.005, S * 0.01, k % 2 === 0 ? -0.3 : 0.3, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
    _applyNoiseOverlay(c, S, 0.06, true);
    _applyHexVignette(c, cx, cy, S, 0.28);

  } else if (terrain === 'mountains') {
    const bg = c.createLinearGradient(0, S * 0.85, 0, 0);
    bg.addColorStop(0, '#283038'); bg.addColorStop(0.4, '#485868'); bg.addColorStop(1, '#728898');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Major peaks
    const peaks: [number, number, number, number, string][] = [
      [cx - 140, cy - SAFE - 30, 110, 290, '#4C5C68'],
      [cx + 130, cy - SAFE - 20, 100, 270, '#425260'],
      [cx, cy - SAFE - 60, 120, 320, '#566A7C'],
    ];
    peaks.forEach(([px, py, pw, ph, col]) => {
      // Mountain body
      c.fillStyle = col;
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - pw, py + ph * 0.55); c.lineTo(px + pw, py + ph * 0.55); c.closePath(); c.fill();
      // Shadow face
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px + pw * 0.1, py + ph * 0.55); c.lineTo(px + pw, py + ph * 0.55); c.closePath(); c.fill();
      // Snow cap
      c.fillStyle = '#E4ECF4';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - pw * 0.28, py + ph * 0.16); c.lineTo(px + pw * 0.28, py + ph * 0.16); c.closePath(); c.fill();
      // Snow highlight
      c.fillStyle = 'rgba(255,255,255,0.6)';
      c.beginPath(); c.moveTo(px, py); c.lineTo(px - pw * 0.14, py + ph * 0.08); c.lineTo(px + pw * 0.10, py + ph * 0.10); c.closePath(); c.fill();
    });
    // Rock striations at base
    c.strokeStyle = 'rgba(160,185,210,0.30)'; c.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      const sx = cx - 120 + Math.random() * 240;
      const sy = cy + 40 + Math.random() * 120;
      const dx = sx - cx, dy = sy - cy;
      if (dx * dx + dy * dy < SAFE * SAFE) continue;
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(sx + 30 + Math.random() * 40, sy + 20 + Math.random() * 30);
      c.stroke();
    }
    _applyNoiseOverlay(c, S, 0.08, false);
    _applyHexVignette(c, cx, cy, S, 0.35);

  } else if (terrain === 'desert') {
    const bg = c.createLinearGradient(0, 0, S * 0.3, S);
    bg.addColorStop(0, '#E4C058'); bg.addColorStop(0.5, '#C09828'); bg.addColorStop(1, '#907018');
    c.fillStyle = bg; c.fillRect(0, 0, S, S);
    // Heat haze glow
    const heat = c.createRadialGradient(cx, cy * 0.6, 20, cx, cy * 0.6, S * 0.38);
    heat.addColorStop(0, 'rgba(255,240,160,0.28)'); heat.addColorStop(1, 'rgba(255,230,140,0)');
    c.fillStyle = heat; c.fillRect(0, 0, S, S);
    // Sand dunes with shadows at edges
    const dunePts: [number, number, number, number, string, string][] = [
      [cx - 90, cy + SAFE + 70, 260, 80, '#CCA838', 'rgba(140,90,20,0.25)'],
      [cx + 100, cy + SAFE + 90, 240, 70, '#BFA030', 'rgba(130,80,15,0.22)'],
      [cx, cy + SAFE + 120, 300, 60, '#B49828', 'rgba(120,75,10,0.20)'],
      [cx + 50, cy - SAFE - 40, 200, 55, '#D0AC40', 'rgba(140,90,20,0.18)'],
    ];
    dunePts.forEach(([dx, dy, rw, rh, col, shadow]) => {
      c.fillStyle = col;
      c.beginPath(); c.ellipse(dx, dy, rw, rh, 0, Math.PI, 0); c.closePath(); c.fill();
      c.fillStyle = shadow;
      c.beginPath(); c.ellipse(dx + 20, dy + 8, rw * 0.8, rh * 0.5, 0, 0, Math.PI); c.closePath(); c.fill();
    });
    // Cacti at corners
    const cactusPts = _scatterPoints(cx, cy, SAFE * 1.3, 3, S * 0.15, S);
    cactusPts.forEach(([tx, ty]) => {
      c.fillStyle = '#2A6428';
      c.beginPath(); c.roundRect(tx - S * 0.012, ty - S * 0.08, S * 0.024, S * 0.10, 4); c.fill();
      c.beginPath(); c.roundRect(tx - S * 0.045, ty - S * 0.04, S * 0.032, S * 0.012, 3); c.fill();
      c.beginPath(); c.roundRect(tx - S * 0.045, ty - S * 0.06, S * 0.012, S * 0.028, 3); c.fill();
      c.beginPath(); c.roundRect(tx + S * 0.01, ty - S * 0.05, S * 0.032, S * 0.012, 3); c.fill();
      c.beginPath(); c.roundRect(tx + S * 0.018, ty - S * 0.07, S * 0.012, S * 0.028, 3); c.fill();
    });
    // Wind ripples in sand
    c.strokeStyle = 'rgba(180,140,50,0.20)'; c.lineWidth = 1.5;
    for (let i = 0; i < 12; i++) {
      const ry = S * 0.15 + i * (S * 0.06);
      c.beginPath();
      c.moveTo(S * 0.1, ry);
      for (let x = S * 0.1; x < S * 0.9; x += 8) {
        c.lineTo(x, ry + Math.sin(x * 0.04 + i) * 4);
      }
      c.stroke();
    }
    _applyNoiseOverlay(c, S, 0.05, true);
    _applyHexVignette(c, cx, cy, S, 0.22);
  }

  c.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
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
  const seam      = useMemo(() => createHexShape(HEX_SIZE * 1.003), []);
  const extrudeSettings = useMemo(() => ({
    depth: mat.height,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 2,
  }), [mat.height]);
  const seamSettings = useMemo(() => ({
    depth: mat.height + 0.01,
    bevelEnabled: false,
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
          roughness={isRocky ? 0.6 : 0.8}
          metalness={isRocky ? 0.15 : 0.0}
          roughnessMap={isRocky ? stoneRoughness : undefined}
          bumpMap={isRocky ? stoneRoughness : undefined}
          bumpScale={isRocky ? 0.02 : 0}
          emissive={mat.emissive}
          emissiveIntensity={0.12}
          clearcoat={isRocky ? 0.1 : 0}
          clearcoatRoughness={0.4}
          onBeforeCompile={onBeforeCompile}
        />
      </mesh>

      {/* Number token — premium embossed coin */}
      {hex.number && !hex.hasRobber && (() => {
        const hot = hex.number === 6 || hex.number === 8;
        return (
          <group position={[0, mat.height + 0.08, 0]}>
            {/* Contact shadow — soft, wide */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
              <circleGeometry args={[0.60, 36]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.28} />
            </mesh>
            {/* Bronze rim ring — metallic edge band */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} castShadow>
              <cylinderGeometry args={[0.52, 0.52, 0.06, 44]} />
              <meshStandardMaterial
                color={hot ? '#8A5A20' : '#7A6830'}
                roughness={0.35}
                metalness={0.55}
                emissive={hot ? '#3A1800' : '#1A1000'}
                emissiveIntensity={0.10}
              />
            </mesh>
            {/* Token disc body — thick, raised, matte parchment */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
              <cylinderGeometry args={[0.48, 0.48, 0.055, 44]} />
              <meshStandardMaterial
                color={hot ? '#F5E4CC' : '#F0DFA0'}
                roughness={0.72}
                metalness={0.0}
                emissive={hot ? '#180808' : '#080400'}
                emissiveIntensity={hot ? 0.06 : 0.02}
              />
            </mesh>
            {/* Inner recessed circle — gives depth */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.028, 0]}>
              <ringGeometry args={[0.32, 0.44, 36]} />
              <meshStandardMaterial
                color={hot ? '#E8D0B0' : '#E0D090'}
                roughness={0.80}
                metalness={0.0}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Number — bold, larger for hot numbers */}
            <Text
              position={[0, 0.072, -0.04]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={hot ? 0.46 : 0.38}
              color={hot ? '#B80808' : '#28160C'}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.020}
              outlineColor={hot ? '#500000' : '#1A0A00'}
              fontWeight={700}
            >
              {String(hex.number)}
            </Text>
            {/* Probability pips — larger dots */}
            <Text
              position={[0, 0.072, 0.20]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.08}
              color={hot ? '#B80808' : '#5A3C18'}
              anchorX="center"
              anchorY="middle"
            >
              {'●'.repeat(getProbDots(hex.number))}
            </Text>
          </group>
        );
      })()}

      {/* Robber — chess-piece style dark figurine */}
      {hex.hasRobber && (
        <group position={[0, mat.height + 0.02, 0]}>
          {/* Ground shadow aura */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
            <circleGeometry args={[0.38, 32]} />
            <meshBasicMaterial color="#000000" transparent opacity={0.35} />
          </mesh>
          {/* Broad base */}
          <mesh position={[0, 0.04, 0]} castShadow>
            <cylinderGeometry args={[0.20, 0.24, 0.08, 16]} />
            <meshStandardMaterial color="#0A0A0A" roughness={0.35} metalness={0.55} />
          </mesh>
          {/* Body — tapered capsule */}
          <mesh position={[0, 0.26, 0]} castShadow>
            <capsuleGeometry args={[0.12, 0.32, 8, 16]} />
            <meshStandardMaterial color="#0E0E0E" roughness={0.38} metalness={0.50} emissive="#080008" emissiveIntensity={0.15} />
          </mesh>
          {/* Head */}
          <mesh position={[0, 0.56, 0]} castShadow>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color="#0C0C0C" roughness={0.35} metalness={0.50} />
          </mesh>
          {/* Hood / pointed cap */}
          <mesh position={[0, 0.68, 0]} castShadow>
            <coneGeometry args={[0.10, 0.18, 12]} />
            <meshStandardMaterial color="#100008" roughness={0.50} metalness={0.30} />
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
// PROCEDURAL PBR TEXTURES
// ============================================================================

const _proceduralTextures: Record<string, THREE.CanvasTexture> = {};

function getProceduralTexture(type: 'wood' | 'stone' | 'weatheredWood'): THREE.CanvasTexture {
  if (_proceduralTextures[type]) return _proceduralTextures[type];
  
  const S = 256;
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
    // City: large keep + round tower + side wing — painted miniature style
    return (
      <group position={position}>
        {/* Contact shadow */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[0.30, 24]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.30} />
        </mesh>
        {/* Foundation slab */}
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.04, 0.24]} />
          <meshStandardMaterial color="#3A3028" roughness={0.92} metalness={0.0} />
        </mesh>
        {/* Main keep */}
        <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 0.28, 0.18]} />
          <meshStandardMaterial color={color} roughness={0.75} metalness={0.08} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.008} />
        </mesh>
        {/* Keep peaked roof */}
        <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[0.17, 0.12, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.85} metalness={0.05} roughnessMap={woodTex} />
        </mesh>
        {/* Round tower */}
        <mesh position={[0.12, 0.22, 0.06]} castShadow receiveShadow>
          <cylinderGeometry args={[0.07, 0.08, 0.40, 12]} />
          <meshStandardMaterial color={color} roughness={0.72} metalness={0.10} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
        </mesh>
        {/* Tower conical roof */}
        <mesh position={[0.12, 0.46, 0.06]} castShadow>
          <coneGeometry args={[0.09, 0.10, 12]} />
          <meshStandardMaterial color={roofColor} roughness={0.80} metalness={0.05} />
        </mesh>
        {/* Tower battlements — tiny boxes on top */}
        {[0, Math.PI/2, Math.PI, Math.PI*1.5].map((a, i) => (
          <mesh key={i} position={[0.12 + Math.cos(a)*0.065, 0.42, 0.06 + Math.sin(a)*0.065]} castShadow>
            <boxGeometry args={[0.025, 0.04, 0.025]} />
            <meshStandardMaterial color={color} roughness={0.80} metalness={0.08} />
          </mesh>
        ))}
        {/* Side wing */}
        <mesh position={[-0.10, 0.10, -0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.16, 0.14]} />
          <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.006} />
        </mesh>
        {/* Side wing roof */}
        <mesh position={[-0.10, 0.21, -0.02]} rotation={[0, 0, 0]} castShadow>
          <coneGeometry args={[0.10, 0.08, 4]} />
          <meshStandardMaterial color={roofColor} roughness={0.85} />
        </mesh>
        {/* Door */}
        <mesh position={[0, 0.06, 0.092]}>
          <boxGeometry args={[0.04, 0.07, 0.005]} />
          <meshStandardMaterial color="#2A1808" roughness={0.95} />
        </mesh>
        {/* Windows — tiny bright squares */}
        {[[0.06, 0.18, 0.092], [-0.06, 0.18, 0.092], [0, 0.22, 0.092]].map(([wx, wy, wz], i) => (
          <mesh key={`w${i}`} position={[wx, wy, wz]}>
            <boxGeometry args={[0.022, 0.025, 0.003]} />
            <meshStandardMaterial color="#FFE880" emissive="#FFD040" emissiveIntensity={0.50} roughness={0.3} />
          </mesh>
        ))}
      </group>
    );
  }

  // Settlement: cozy cottage with chimney — painted miniature style
  return (
    <group position={position}>
      {/* Contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <circleGeometry args={[0.20, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>
      {/* Foundation */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.20, 0.03, 0.16]} />
        <meshStandardMaterial color="#3A3028" roughness={0.92} metalness={0.0} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 0.10, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.16, 0.17, 0.13]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.08} roughnessMap={stoneTex} bumpMap={stoneTex} bumpScale={0.008} />
      </mesh>
      {/* Peaked roof */}
      <mesh position={[0, 0.23, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.14, 0.10, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.82} metalness={0.05} roughnessMap={woodTex} bumpMap={woodTex} bumpScale={0.004} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.05, 0.25, -0.03]} castShadow>
        <boxGeometry args={[0.03, 0.08, 0.03]} />
        <meshStandardMaterial color="#4A3020" roughness={0.90} metalness={0.0} />
      </mesh>
      {/* Chimney smoke (tiny translucent sphere) */}
      <mesh position={[0.05, 0.32, -0.03]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshBasicMaterial color="#888888" transparent opacity={0.15} />
      </mesh>
      {/* Door */}
      <mesh position={[0, 0.05, 0.067]}>
        <boxGeometry args={[0.035, 0.06, 0.004]} />
        <meshStandardMaterial color="#2A1808" roughness={0.95} />
      </mesh>
      {/* Window */}
      <mesh position={[0.05, 0.13, 0.067]}>
        <boxGeometry args={[0.022, 0.025, 0.003]} />
        <meshStandardMaterial color="#FFE880" emissive="#FFD040" emissiveIntensity={0.40} roughness={0.3} />
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
          roughness={0.75}
          metalness={0.08}
          roughnessMap={weatheredWood}
          bumpMap={weatheredWood}
          bumpScale={0.006}
          emissive={color}
          emissiveIntensity={hovered ? 0.55 : 0.06}
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
  const deepRef = useRef<THREE.Mesh>(null);
  const foamRef = useRef<THREE.Mesh>(null);
  const causticsRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    // Animate deep ocean colour with slow tidal breathing
    if (deepRef.current) {
      const mat = deepRef.current.material as THREE.MeshStandardMaterial;
      const phase = t * 0.06;
      mat.color.setRGB(
        0.018 + Math.sin(phase) * 0.006,
        0.10 + Math.sin(phase + 1.2) * 0.015,
        0.42 + Math.sin(phase + 2.5) * 0.035,
      );
      mat.emissiveIntensity = 0.08 + Math.sin(phase * 1.5) * 0.025;
    }

    // Animate foam opacity like breaking waves
    if (foamRef.current) {
      const foamMat = foamRef.current.material as THREE.MeshStandardMaterial;
      foamMat.opacity = 0.18 + Math.sin(t * 0.4) * 0.06 + Math.sin(t * 1.1) * 0.04;
    }

    // Subtle caustics shimmer
    if (causticsRef.current) {
      const causticMat = causticsRef.current.material as THREE.MeshStandardMaterial;
      causticMat.opacity = 0.06 + Math.sin(t * 0.8 + 1.5) * 0.03;
      causticsRef.current.rotation.z = t * 0.012;
    }
  });

  return (
    <>
      {/* Layer 1: Deep ocean base — dark, slightly metallic, fills to table edge */}
      <mesh ref={deepRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]} receiveShadow>
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

      {/* Layer 3: Shallow coastal water — turquoise-blue, lighter */}
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

      {/* Layer 4: Foam / surf ring — animated white froth at coastline */}
      <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.016, 0]}>
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

      {/* Layer 5: Caustic shimmer overlay — very subtle rotating bright ring */}
      <mesh ref={causticsRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
        <ringGeometry args={[6.0, 9.5, 80]} />
        <meshStandardMaterial
          color="#A0D0F0"
          roughness={0.05}
          metalness={0.60}
          transparent
          opacity={0.06}
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

function Die3D({ value, position, rotSeed }: { value: number; position: [number, number, number]; rotSeed: number }) {
  const groupRef = useRef<THREE.Group>(null);

  // Gentle idle wobble
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime + rotSeed;
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.02 + rotSeed;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.5) * 0.003;
  });

  // Standard die: value on TOP face (+Y). Opposite faces sum to 7.
  // We show pips on all 6 faces with correct standard die layout
  const topVal = value;
  const bottomVal = 7 - value;
  // Standard die: 1 front, 2 left, 3 top → rotations to get 'value' on top
  // For simplicity we show pips on top (+Y) and front (+Z) only. The die body implies the rest.

  return (
    <group ref={groupRef} position={position}>
      {/* Die body — rounded ivory cube */}
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
      {/* Edge bevel illusion — slightly larger transparent dark box */}
      <mesh>
        <boxGeometry args={[0.25, 0.25, 0.25]} />
        <meshStandardMaterial color="#C8B898" roughness={0.8} metalness={0.0} transparent opacity={0.08} />
      </mesh>
      {/* Pips on top face (+Y) */}
      <DiePips value={topVal} faceNormal={[0, 1, 0]} />
      {/* Pips on front face (+Z) for depth — use a plausible value */}
      <DiePips value={Math.max(1, Math.min(6, (topVal + 1) % 6 + 1))} faceNormal={[0, 0, 1]} />
      {/* Pips on right face (+X) */}
      <DiePips value={bottomVal > 3 ? bottomVal - 3 : bottomVal + 2} faceNormal={[1, 0, 0]} />
    </group>
  );
}

function Dice3DPair({ diceRoll }: { diceRoll: [number, number] | null }) {
  if (!diceRoll) return null;
  return (
    <group position={[3.8, 0.20, 3.8]}>
      {/* Contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
        <circleGeometry args={[0.50, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
      <Die3D value={diceRoll[0]} position={[-0.18, 0, 0]} rotSeed={0.3} />
      <Die3D value={diceRoll[1]} position={[0.20, 0, 0.06]} rotSeed={1.7} />
    </group>
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
      <GlobalAnimController />

      {/* ══════════════════════════════════════════════════════════════════
          CINEMATIC LIGHTING RIG — warm museum-gallery tabletop feel
          7 light sources for depth, drama, and realistic PBR response
          ══════════════════════════════════════════════════════════════════ */}
      {/* Ambient: very low, warm, prevents pure-black shadows */}
      <ambientLight intensity={0.28} color="#F0E0C8" />

      {/* KEY — warm golden overhead, primary shadow caster */}
      <directionalLight
        position={[6, 28, 5]}
        intensity={1.8}
        color="#FFF4E0"
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

      {/* FILL — cool blue opposite side, lifts shadow detail */}
      <directionalLight position={[-12, 16, -10]} intensity={0.35} color="#A0BCD8" />

      {/* RIM — subtle warm-violet back-light for silhouette separation */}
      <directionalLight position={[0, 8, -22]} intensity={0.22} color="#D0B8E0" />

      {/* WARM BOUNCE — simulates table surface light reflection upward */}
      <pointLight position={[0, 1.5, 0]} intensity={0.55} color="#FFD090" distance={20} decay={2} />

      {/* OVERHEAD SPOT — focused pool of warm light on board centre */}
      <spotLight
        position={[0, 24, 0]}
        angle={0.42}
        penumbra={0.6}
        intensity={1.2}
        color="#FFF0D8"
        distance={40}
        decay={1.8}
        castShadow={false}
      />

      {/* LEFT ACCENT — cool side kick for depth + color contrast */}
      <pointLight position={[-14, 5, 2]} intensity={0.20} color="#90A8C8" distance={22} decay={2} />

      {/* RIGHT WARM ACCENT — adds warmth asymmetry */}
      <pointLight position={[12, 4, -3]} intensity={0.16} color="#E8C888" distance={20} decay={2} />

      {/* Camera */}
      <PerspectiveCamera makeDefault position={[0, 19, 4.5]} fov={38} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={5} maxDistance={28} maxPolarAngle={Math.PI / 2.1} minPolarAngle={0.10} />

      {/* Background */}
      <color attach="background" args={['#07101E']} />
      <fog attach="fog" args={['#07101E', 20, 38]} />

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

export default function CatanBoard3D({ 
  gameState, onHexClick, onVertexClick, onEdgeClick
}: CatanBoard3DProps) {
  return (
    <div className="w-full h-full bg-black overflow-hidden">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2.5]}
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
