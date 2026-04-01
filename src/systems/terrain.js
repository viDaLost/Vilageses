import * as THREE from "three";
import { createNoise2D } from "simplex-noise";
import { TERRAIN_TYPES, GAME_CONFIG } from "../config.js";

const raycaster = new THREE.Raycaster();
const down = new THREE.Vector3(0, -1, 0);
const noise2D = createNoise2D();

let terrainMesh = null;
let waterMesh = null;
let terrainMaterial = null;
let waterMaterial = null;

function makeCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function makeRepeatingTexture(drawFn, repeatX = 18, repeatY = 18) {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext('2d');
  drawFn(ctx, canvas.width, canvas.height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassTexture() {
  return makeRepeatingTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#86a95a');
    g.addColorStop(0.5, '#6c8f43');
    g.addColorStop(1, '#587332');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 3500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = 2 + Math.random() * 8;
      const sway = -1 + Math.random() * 2;
      const alpha = 0.04 + Math.random() * 0.07;
      ctx.strokeStyle = `rgba(${50 + Math.floor(Math.random() * 40)}, ${95 + Math.floor(Math.random() * 90)}, ${30 + Math.floor(Math.random() * 30)}, ${alpha})`;
      ctx.lineWidth = 0.7 + Math.random() * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y + len * 0.2);
      ctx.quadraticCurveTo(x + sway * 1.4, y - len * 0.4, x + sway, y - len);
      ctx.stroke();
    }

    for (let i = 0; i < 500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 2.5;
      ctx.fillStyle = `rgba(255, 235, 170, ${0.015 + Math.random() * 0.03})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 14, 14);
}

function makeGrassNormalTexture() {
  return makeRepeatingTexture((ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const c = 116 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${c},${c},255)`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 3 + Math.random() * 4);
    }
  }, 14, 14);
}

function makeWaterTexture() {
  return makeRepeatingTexture((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#78c9ee');
    g.addColorStop(0.45, '#4196c5');
    g.addColorStop(1, '#2d6f9d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1500; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const rw = 8 + Math.random() * 28;
      const rh = 1 + Math.random() * 2.6;
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.035})`;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 700; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(210,245,255,${0.02 + Math.random() * 0.03})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 6, 6);
}

function makeWaterNormalTexture() {
  return makeRepeatingTexture((ctx, w, h) => {
    ctx.fillStyle = 'rgb(128,128,255)';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      ctx.strokeStyle = `rgba(${120 + Math.floor(Math.random() * 20)}, ${120 + Math.floor(Math.random() * 20)}, 255, 0.35)`;
      ctx.lineWidth = 2 + Math.random() * 1.5;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 12) {
        const yy = y + Math.sin((x + y) * 0.07) * 2.2 + (Math.random() - 0.5) * 1.4;
        if (x === -10) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }, 6, 6);
}

function ensureTerrainMaterials() {
  if (!terrainMaterial) {
    terrainMaterial = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0.0,
      clearcoat: 0.0,
      map: makeGrassTexture(),
      normalMap: makeGrassNormalTexture(),
      normalScale: new THREE.Vector2(0.45, 0.45),
      envMapIntensity: 0.25
    });
  }
  if (!waterMaterial) {
    waterMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x7bc3ea,
      transparent: true,
      opacity: 0.86,
      roughness: 0.12,
      metalness: 0.04,
      clearcoat: 0.65,
      transmission: 0.0,
      reflectivity: 0.35,
      map: makeWaterTexture(),
      normalMap: makeWaterNormalTexture(),
      normalScale: new THREE.Vector2(0.55, 0.55),
      envMapIntensity: 0.55,
      depthWrite: false
    });
  }
}

function fbm(x, z, octaves = 4, persistence = 0.5, scale = 1.0) {
  let total = 0;
  let frequency = scale;
  let amplitude = 1;
  let maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise2D(x * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / Math.max(0.0001, maxValue);
}

function dominantTileAt(state, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const tile of state.map) {
    const dx = x - tile.pos.x;
    const dz = z - tile.pos.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = tile; }
  }
  return best;
}

function macroTerrain(x, z, tile) {
  const gentle = fbm(x, z, 4, 0.55, 0.014) * 0.28;
  const detail = fbm(x + 40, z - 10, 3, 0.45, 0.05) * 0.05;
  const ridge = Math.max(0, fbm(x - 120, z + 90, 3, 0.52, 0.018));
  if (!tile) return gentle + detail;
  if (tile.type === 'river') return -0.18 + detail * 0.3;
  if (tile.type === 'fertile' || tile.type === 'grass' || tile.type === 'forest' || tile.type === 'sacred') return gentle + detail;
  if (tile.type === 'hill') return 0.34 + ridge * 0.42 + detail;
  if (tile.type === 'rock') return 0.72 + ridge * 0.7 + detail * 0.7;
  return gentle + detail;
}

export function sampleTerrainHeightFromGrid(state, x, z) {
  const tile = dominantTileAt(state, x, z);
  const base = tile?.height || 0;
  return base + macroTerrain(x, z, tile);
}

function colorFor(type, h, x, z, steepness) {
  const baseColorHex = TERRAIN_TYPES[type]?.color || 0x6e8e45;
  const c = new THREE.Color(baseColorHex);
  const shade = fbm(x, z, 2, 0.5, 0.06);
  c.offsetHSL(0, 0.015 * shade, 0.06 * shade);
  if (type === 'river') {
    c.lerp(new THREE.Color(0x80caeb), 0.42);
  }
  if (steepness > 0.42 || type === 'rock') {
    c.lerp(new THREE.Color(0x8e8a82), Math.min(1, 0.4 + steepness));
  }
  if (type !== 'river' && h > 1.25) c.lerp(new THREE.Color(0xe8e3db), Math.min(1, (h - 1.25) * 0.6));
  if (type === 'fertile' || type === 'grass') {
    c.lerp(new THREE.Color(0xd8c69b), Math.max(0, Math.min(1, (0.05 - h) * 2.5)) * 0.35);
  }
  if (type === 'forest') {
    c.lerp(new THREE.Color(0x46642d), 0.18);
  }
  return c;
}

export function buildTerrain(sceneCtx, state) {
  const { groups } = sceneCtx;
  if (terrainMesh) groups.tiles.remove(terrainMesh);
  if (waterMesh) groups.tiles.remove(waterMesh);
  ensureTerrainMaterials();

  const size = GAME_CONFIG.mapRadius * GAME_CONFIG.hexSize * 8.2;
  const segments = 220;
  let geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const tile = dominantTileAt(state, x, z);
    let h = sampleTerrainHeightFromGrid(state, x, z);
    if (tile?.type === 'river') h = Math.min(h, GAME_CONFIG.terrain.waterLevel - 0.02 + fbm(x, z, 2, 0.5, 0.1) * 0.015);
    pos.setY(i, h);
  }

  geo.computeVertexNormals();
  const normals = geo.attributes.normal;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const steepness = 1 - Math.abs(normals.getY(i));
    const tile = dominantTileAt(state, x, z);
    const c = colorFor(tile?.type || 'grass', y, x, z, steepness);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  terrainMesh = new THREE.Mesh(geo, terrainMaterial);
  terrainMesh.receiveShadow = true;
  terrainMesh.castShadow = true;
  terrainMesh.name = 'terrain-mesh';
  groups.tiles.add(terrainMesh);

  let waterGeo = new THREE.PlaneGeometry(size, size, 120, 120);
  waterGeo.rotateX(-Math.PI / 2);
  const waterPos = waterGeo.attributes.position;
  for (let i = 0; i < waterPos.count; i++) {
    const x = waterPos.getX(i), z = waterPos.getZ(i);
    const tile = dominantTileAt(state, x, z);
    let visible = tile?.type === 'river' ? 1 : 0;
    visible *= Math.max(0, 1 - Math.min(1, (tile?.riverDistance || 99) / 6));
    const wave = noise2D(x * 0.08, z * 0.08) * 0.03 * visible;
    waterPos.setY(i, GAME_CONFIG.terrain.waterLevel + wave + (visible ? 0.026 : -8));
  }
  waterGeo.computeVertexNormals();
  waterMesh = new THREE.Mesh(waterGeo, waterMaterial);
  waterMesh.receiveShadow = true;
  waterMesh.renderOrder = 2;
  groups.tiles.add(waterMesh);

  state.map.forEach((tile) => { tile.surfaceY = sampleTerrainHeightFromGrid(state, tile.pos.x, tile.pos.z); });
  return terrainMesh;
}

export function updateTerrainVisuals(state, time = 0) {
  if (waterMaterial?.map) {
    waterMaterial.map.offset.x = (time * 0.0007) % 1;
    waterMaterial.map.offset.y = (time * 0.00035) % 1;
  }
  if (waterMaterial?.normalMap) {
    waterMaterial.normalMap.offset.x = (-time * 0.0009) % 1;
    waterMaterial.normalMap.offset.y = (time * 0.00045) % 1;
  }
  if (terrainMaterial?.map) {
    terrainMaterial.map.offset.x = Math.sin(time * 0.00005) * 0.01;
    terrainMaterial.map.offset.y = Math.cos(time * 0.00004) * 0.01;
  }
}

export function getTerrainPoint(x, z) {
  if (!terrainMesh) return new THREE.Vector3(x, 0, z);
  raycaster.set(new THREE.Vector3(x, 250, z), down);
  const hits = raycaster.intersectObject(terrainMesh, false);
  return hits.length ? hits[0].point.clone() : new THREE.Vector3(x, 0, z);
}

export function getTerrainY(x, z) { return getTerrainPoint(x, z).y; }
export function getTerrainMesh() { return terrainMesh; }
