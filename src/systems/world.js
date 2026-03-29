import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { GAME_CONFIG, TERRAIN_TYPES } from '../config.js';
import { tileKey } from '../utils/helpers.js';

const HEX_DIRS = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];

export function axialToWorld(q, r, size = GAME_CONFIG.hexSize) {
  return new THREE.Vector3(
    size * Math.sqrt(3) * (q + r / 2) * GAME_CONFIG.axialScaleX,
    0,
    size * 1.5 * r * GAME_CONFIG.axialScaleZ
  );
}

export function createHexShape(size = GAME_CONFIG.hexSize * 1.04) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 3 * i + Math.PI / 6;
    const x = Math.cos(angle) * size;
    const y = Math.sin(angle) * size;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function generateWorld(state) {
  const noise2D = createNoise2D();
  const radius = GAME_CONFIG.mapRadius;
  state.map.length = 0;
  state.mapIndex.clear();

  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > radius) continue;
      const pos = axialToWorld(q, r);
      const d = Math.hypot(pos.x, pos.z);
      const n1 = noise2D(q * .15, r * .15);
      const n2 = noise2D(q * .33 + 100, r * .33 + 100);
      const n3 = noise2D(q * .07 - 30, r * .07 + 47);
      let type = 'grass';
      let height = n1 * 0.35;

      if (Math.abs(q + r * .72 + n3 * .8) < 1.15 || (Math.abs(n2) < GAME_CONFIG.terrain.riverBand && d < 28)) {
        type = 'river';
        height = -.08 + n1 * .06;
      } else if (d > 31 && n1 < -.04) {
        type = 'water';
        height = GAME_CONFIG.terrain.waterLevel - 0.02 + n1 * .04;
      } else if (n1 > GAME_CONFIG.terrain.rockLevel * .5) {
        type = 'rock';
        height = 0.95 + n2 * .22;
      } else if (n1 > GAME_CONFIG.terrain.hillLevel * .5) {
        type = 'hill';
        height = 0.52 + n2 * .16;
      } else if (n2 < GAME_CONFIG.terrain.forestBand) {
        type = 'forest';
        height = 0.22 + n1 * .06;
      } else if (n2 > GAME_CONFIG.terrain.fertileBand) {
        type = 'fertile';
        height = 0.1 + n1 * .05;
      }
      if (d < 4.6 && type !== 'water') {
        type = 'sacred';
        height = 0.18;
      }
      const tile = {
        id: tileKey(q, r), q, r, type, pos, height,
        noise: n2,
        buildingId: null,
        roadLinks: new Set(),
        selected: false,
        mesh: null,
        decorMeshes: []
      };
      state.map.push(tile);
      state.mapIndex.set(tile.id, tile);
    }
  }
}

export function getTile(state, q, r) {
  return state.mapIndex.get(tileKey(q, r)) || null;
}

export function getNeighbors(state, tile) {
  return HEX_DIRS.map(([dq, dr]) => getTile(state, tile.q + dq, tile.r + dr)).filter(Boolean);
}

export function isTileInsideTerritory(state, tile) {
  return Math.hypot(tile.pos.x, tile.pos.z) <= state.territoryRadius;
}

export function terrainColor(type) {
  return TERRAIN_TYPES[type].color;
}
