/**
 * CatanHexUtils — Shared hex-grid math & constants
 *
 * Used by CatanBoard3D and all 3D sub-components (HexTile3D, Water3D,
 * Ports3D, Vertices3D, Edges3D) so the geometry stays consistent.
 */

import * as THREE from 'three';

// ============================================================================
// CONSTANTS
// ============================================================================

export const HEX_SIZE = 1.28;
export const HEX_GAP  = 0.04;

// ============================================================================
// COORDINATE CONVERSION
// ============================================================================

/** Convert axial (q, r) to flat-topped 3D world position. */
export function hexToWorld(q: number, r: number): [number, number, number] {
  const x = HEX_SIZE * (3 / 2) * q * (1 + HEX_GAP);
  const z = HEX_SIZE * Math.sqrt(3) * (r + q / 2) * (1 + HEX_GAP);
  return [x, 0, z];
}

// ============================================================================
// SHAPES
// ============================================================================

/** Flat-topped hex shape of given `size` (outer radius). */
export function createHexShape(size: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
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
// TERRAIN MATERIALS
// ============================================================================

export interface TerrainMat {
  base: string;
  top: string;
  emissive: string;
  height: number;
  roughness: number;
  metalness: number;
}

export const TERRAIN_MATS: Record<string, TerrainMat> = {
  forest:    { base: '#2E8B30', top: '#3CA03E', emissive: '#102E10', height: 0.12, roughness: 0.90, metalness: 0.0 },
  hills:     { base: '#C06030', top: '#D07840', emissive: '#2A1008', height: 0.18, roughness: 0.90, metalness: 0.0 },
  pasture:   { base: '#6BBF3A', top: '#7CD04A', emissive: '#142A08', height: 0.07, roughness: 0.92, metalness: 0.0 },
  fields:    { base: '#E8B830', top: '#F0C840', emissive: '#2A2008', height: 0.07, roughness: 0.90, metalness: 0.0 },
  mountains: { base: '#6A7E90', top: '#7E92A4', emissive: '#141C24', height: 0.25, roughness: 0.88, metalness: 0.0 },
  desert:    { base: '#DDB848', top: '#E8C860', emissive: '#2A2010', height: 0.05, roughness: 0.92, metalness: 0.0 },
};

// ============================================================================
// PROCEDURAL PBR TEXTURES — cached singletons
// ============================================================================

const _proceduralTextures: Record<string, THREE.CanvasTexture> = {};

export function getProceduralTexture(type: 'wood' | 'stone' | 'weatheredWood'): THREE.CanvasTexture {
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
        v = 110 + grain + (Math.random() > 0.98 ? -40 : 0);
      } else if (type === 'stone') {
        const noise1 = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 30;
        const noise2 = Math.random() * 50;
        v = 130 + noise1 + noise2;
      }

      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
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
// SEA FRAME POSITIONS — ring-3 hex neighbours (border tiles)
// ============================================================================

export const SEA_FRAME_POSITIONS: { q: number; r: number }[] = [
  {q:-3,r:0},{q:-2,r:-1},{q:-1,r:-2},{q:0,r:-3},{q:1,r:-3},{q:2,r:-3},
  {q:3,r:-3},{q:3,r:-2},{q:3,r:-1},{q:3,r:0},{q:2,r:1},{q:1,r:2},
  {q:0,r:3},{q:-1,r:3},{q:-2,r:3},{q:-3,r:3},{q:-3,r:2},{q:-3,r:1},
];

// ============================================================================
// HARBOUR DEFINITIONS
// ============================================================================

export interface HarborDef {
  hexA: { q: number; r: number };
  hexB: { q: number; r: number };
  type: string;
  label: string;
}

export const HARBOR_DEFS: HarborDef[] = [
  { hexA: {q:0,  r:-2}, hexB: {q:1,  r:-2}, type: '3:1',   label: '3:1'       },
  { hexA: {q:1,  r:-2}, hexB: {q:2,  r:-2}, type: 'wood',  label: 'Wood\n2:1'  },
  { hexA: {q:2,  r:-2}, hexB: {q:2,  r:-1}, type: '3:1',   label: '3:1'       },
  { hexA: {q:2,  r:-1}, hexB: {q:2,  r:0 }, type: 'ore',   label: 'Ore\n2:1'  },
  { hexA: {q:2,  r:0 }, hexB: {q:1,  r:1 }, type: 'wheat', label: 'Wheat\n2:1'},
  { hexA: {q:0,  r:2 }, hexB: {q:-1, r:2 }, type: '3:1',   label: '3:1'       },
  { hexA: {q:-1, r:2 }, hexB: {q:-2, r:2 }, type: 'brick', label: 'Brick\n2:1'},
  { hexA: {q:-2, r:1 }, hexB: {q:-2, r:0 }, type: 'sheep', label: 'Sheep\n2:1'},
  { hexA: {q:-2, r:0 }, hexB: {q:-1, r:-1}, type: '3:1',   label: '3:1'       },
];

export const HARBOR_COLORS: Record<string, string> = {
  '3:1':   '#C8960A',
  'wood':  '#2E7D32',
  'brick': '#C0360C',
  'sheep': '#4C8A28',
  'wheat': '#D49808',
  'ore':   '#485E6A',
};
