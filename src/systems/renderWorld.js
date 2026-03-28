import * as THREE from 'three';
import { TERRAIN_TYPES, DECOR_MODELS, GAME_CONFIG } from '../config.js';
import { loadDecorModel, loadUnitModel } from '../core/assets.js';
import { isTileInsideTerritory } from './world.js';

const terrainMaterials = new Map();
const hiddenTileMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });

function getTerrainMaterial(type) {
  if (terrainMaterials.has(type)) return terrainMaterials.get(type);
  const cfg = TERRAIN_TYPES[type];
  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: type === 'river' || type === 'water' ? .26 : .97,
    metalness: type === 'water' ? .05 : 0,
    emissive: type === 'water' ? 0x1f4f7a : 0x000000,
    emissiveIntensity: type === 'water' ? .14 : 0,
    transparent: true,
    opacity: type === 'water' ? .82 : .92,
  });
  terrainMaterials.set(type, mat);
  return mat;
}

function tint(color, amt) {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, amt);
  return c;
}

function seeded(tile, salt = 1) {
  const x = Math.sin(tile.q * 127.1 + tile.r * 311.7 + salt * 74.7) * 43758.5453123;
  return x - Math.floor(x);
}

function terrainColorForTile(tile) {
  const c = new THREE.Color(TERRAIN_TYPES[tile.type].color);
  c.offsetHSL(0, 0, tile.noise * 0.03);
  return c;
}

function createHiddenPickMesh(tile) {
  const geo = new THREE.CylinderGeometry(GAME_CONFIG.hexSize * 0.88, GAME_CONFIG.hexSize * 0.88, 0.25, 6);
  const mesh = new THREE.Mesh(geo, hiddenTileMaterial);
  mesh.position.set(tile.pos.x, tile.height + 0.14, tile.pos.z);
  mesh.rotation.y = Math.PI / 6;
  mesh.userData.tileId = tile.id;
  return mesh;
}

function buildTerrainSurface(state) {
  const size = 110;
  const seg = 120;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = [];
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    tmp.fromBufferAttribute(pos, i);
    let best = null;
    let bestD = Infinity;
    let second = null;
    let secondD = Infinity;
    for (const tile of state.map) {
      const dx = tmp.x - tile.pos.x;
      const dz = tmp.z - tile.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        second = best; secondD = bestD;
        best = tile; bestD = d;
      } else if (d < secondD) {
        second = tile; secondD = d;
      }
    }
    const w1 = 1 / Math.max(0.0001, bestD);
    const w2 = second ? 1 / Math.max(0.0001, secondD) : 0;
    const h = ((best?.height || 0) * w1 + (second?.height || 0) * w2) / (w1 + w2 || 1);
    pos.setY(i, h - 0.34);
    const c1 = terrainColorForTile(best || state.map[0]);
    const c2 = second ? terrainColorForTile(second) : c1.clone();
    c1.lerp(c2, 0.35);
    c1.offsetHSL(0, -0.03, -0.04);
    colors.push(c1.r, c1.g, c1.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.position.y = -0.02;
  return mesh;
}

function addDistantMountains(group) {
  group.clear();
  const fogMat = new THREE.MeshStandardMaterial({ color: 0x6a5d53, roughness: 1, transparent: true, opacity: .96 });
  for (let i = 0; i < 30; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const radius = 46 + (i % 4) * 4 + Math.random() * 3;
    const h = 10 + Math.random() * 14;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(5 + Math.random() * 5, h, 6 + Math.floor(Math.random() * 3)), fogMat.clone());
    mountain.position.set(Math.cos(angle) * radius, -1 + h / 2, Math.sin(angle) * radius);
    mountain.castShadow = true;
    group.add(mountain);
  }
}

function addMesh(group, tile, mesh) {
  tile.decorMeshes.push(mesh);
  group.add(mesh);
}

function addBushCluster(group, tile, pos, y, spread = 1) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x376d2a, roughness: 1 });
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(.18 + Math.random() * .12, 7, 7), mat);
    bush.scale.y = .8;
    bush.position.set(pos.x + (Math.random() - .5) * spread, y + .14, pos.z + (Math.random() - .5) * spread);
    bush.castShadow = true;
    addMesh(group, tile, bush);
  }
}

function addFlowerDots(group, tile, pos, y) {
  const colors = [0xf3d36b, 0xd7f0ff, 0xffb2b2];
  for (let i = 0; i < 6; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.03, 5, 5), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: .08 }));
    dot.position.set(pos.x + (Math.random() - .5) * 1.1, y + .12, pos.z + (Math.random() - .5) * 1.1);
    addMesh(group, tile, dot);
  }
}

function addTreeCluster(group, tile, pos, y, pine = false) {
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x714a24, roughness: 1 });
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const leafColor = pine ? 0x2b5e34 : (Math.random() > .55 ? 0x2f6d2d : 0x1f5120);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .72, 5), matTrunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.38 + Math.random() * .16, pine ? 1.28 : 1.05, 7), new THREE.MeshStandardMaterial({ color: leafColor, roughness: 1 }));
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(.28 + Math.random() * .1, pine ? .9 : .7, 7), new THREE.MeshStandardMaterial({ color: tint(leafColor, .08), roughness: 1 }));
    const ox = (Math.random() - .5) * 1.3;
    const oz = (Math.random() - .5) * 1.3;
    trunk.position.set(pos.x + ox, y + .38, pos.z + oz);
    crown.position.set(pos.x + ox, y + (pine ? 1.18 : 1.04), pos.z + oz);
    crown2.position.set(pos.x + ox, y + (pine ? 1.62 : 1.42), pos.z + oz);
    trunk.castShadow = crown.castShadow = crown2.castShadow = true;
    addMesh(group, tile, trunk); addMesh(group, tile, crown); addMesh(group, tile, crown2);
  }
}

function addRockCluster(group, tile, pos, y, golden = false) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(.2 + Math.random() * .18, 0),
      new THREE.MeshStandardMaterial({ color: golden ? 0xc9a44d : (Math.random() > .5 ? 0x8b8b8b : 0x6f706f), roughness: 1, emissive: golden ? 0x8b6822 : 0x000000, emissiveIntensity: golden ? .18 : 0 })
    );
    rock.position.set(pos.x + (Math.random() - .5) * 1.15, y + .12 + Math.random() * .18, pos.z + (Math.random() - .5) * 1.15);
    rock.scale.setScalar(.8 + Math.random() * 1.2);
    rock.castShadow = true;
    addMesh(group, tile, rock);
  }
}

function addGrassCluster(group, tile, pos, y, color = 0xc4c15f, density = 7) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (let i = 0; i < density; i++) {
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(.015, .03, .35 + Math.random() * .18, 4), mat);
    blade.position.set(pos.x + (Math.random() - .5) * 1.45, y + .14, pos.z + (Math.random() - .5) * 1.45);
    blade.rotation.z = (Math.random() - .5) * .24;
    addMesh(group, tile, blade);
  }
}

function addReedCluster(group, tile, pos, y) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9be71, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .48 + Math.random() * .2, 5), mat);
    reed.position.set(pos.x + (Math.random() - .5) * 1.2, y + .18, pos.z + (Math.random() - .5) * 1.2);
    addMesh(group, tile, reed);
  }
}

export function clearDecorOnTile(sceneCtx, tile) {
  if (!tile?.decorMeshes?.length) return;
  for (const mesh of tile.decorMeshes) sceneCtx.groups.decor.remove(mesh);
  tile.decorMeshes.length = 0;
}

export function renderTiles(sceneCtx, state) {
  const { groups } = sceneCtx;
  groups.terrain.clear();
  groups.tiles.clear();
  groups.decor.clear();
  groups.overlays.clear();
  addDistantMountains(groups.backdrop);

  groups.terrain.add(buildTerrainSurface(state));

  const ringGeo = new THREE.RingGeometry(state.territoryRadius - .2, state.territoryRadius + .12, 128);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: .16, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .08;
  ring.name = 'territory-ring';
  groups.overlays.add(ring);

  state.map.forEach((tile) => {
    tile.decorMeshes = [];
    const pickMesh = createHiddenPickMesh(tile);
    groups.tiles.add(pickMesh);
    tile.mesh = pickMesh;

    if (tile.type === 'forest') { addTreeCluster(groups.decor, tile, tile.pos, tile.height + .02, false); addBushCluster(groups.decor, tile, tile.pos, tile.height + .02, 1.2); addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0x9bb067, 4); }
    if (tile.type === 'rock') addRockCluster(groups.decor, tile, tile.pos, tile.height + .02, false);
    if (tile.type === 'hill') { addRockCluster(groups.decor, tile, tile.pos, tile.height + .02, false); if (Math.random() > .55) addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0xb0b768, 4); }
    if (tile.type === 'fertile') { addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0xcfce6a, 10); addFlowerDots(groups.decor, tile, tile.pos, tile.height + .02); }
    if (tile.type === 'grass') { addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0x9ab55b, 8); if (Math.random() > .55) addBushCluster(groups.decor, tile, tile.pos, tile.height + .02); }
    if (tile.type === 'river') { addReedCluster(groups.decor, tile, tile.pos, tile.height + .02); addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0xcccd79, 5); }
    if (tile.type === 'sacred') { addGrassCluster(groups.decor, tile, tile.pos, tile.height + .02, 0xe0d386, 5); addFlowerDots(groups.decor, tile, tile.pos, tile.height + .02); }
  });
}

export function updateTerritoryOverlay(sceneCtx, state) {
  const ring = sceneCtx.groups.overlays.getObjectByName('territory-ring');
  if (!ring) return;
  ring.geometry.dispose();
  ring.geometry = new THREE.RingGeometry(state.territoryRadius - .2, state.territoryRadius + .12, 128);
}

export function renderRoads(sceneCtx, state) {
  const { groups } = sceneCtx;
  groups.roads.clear();
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xd1b07d, roughness: 1 });
  state.roads.forEach((road) => {
    const a = state.mapIndex.get(road.a);
    const b = state.mapIndex.get(road.b);
    if (!a || !b) return;
    const p1 = new THREE.Vector3(a.pos.x, a.height + 0.03, a.pos.z);
    const p2 = new THREE.Vector3().lerpVectors(p1, new THREE.Vector3(b.pos.x, b.height + 0.03, b.pos.z), 0.5);
    p2.y += 0.02;
    const p3 = new THREE.Vector3(b.pos.x, b.height + 0.03, b.pos.z);
    const curve = new THREE.CatmullRomCurve3([p1, p2, p3]);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.12, 6, false), roadMat);
    mesh.receiveShadow = true;
    groups.roads.add(mesh);
  });
}

function decorChoices(tile) {
  const choices = [];
  const r1 = seeded(tile, 1);
  const r2 = seeded(tile, 2);
  const r3 = seeded(tile, 3);
  if (tile.type === 'forest') {
    choices.push(r1 > 0.45 ? 'pine' : 'trees');
    if (r2 > 0.48) choices.push('logs');
  } else if (tile.type === 'rock') {
    choices.push(r1 > 0.72 ? 'gold' : 'rocks');
    if (r2 > 0.5) choices.push('rocks');
  } else if (tile.type === 'hill') {
    choices.push(r1 > 0.76 ? 'gold' : 'rocks');
    if (r2 > 0.46) choices.push('logs');
  } else if (tile.type === 'fertile') {
    choices.push('crops');
    if (r2 > 0.4) choices.push('logs');
  } else if (tile.type === 'grass') {
    if (r1 > 0.58) choices.push('trees');
    if (r2 > 0.72) choices.push('logs');
  } else if (tile.type === 'river') {
    if (r1 > 0.42) choices.push('crops');
    if (r2 > 0.62) choices.push('trees');
  } else if (tile.type === 'sacred') {
    choices.push(r1 > 0.5 ? 'cleric' : 'wizard');
    if (r3 > 0.48) choices.push('trees');
  }
  return choices.slice(0, GAME_CONFIG.decorPerTileSoftCap || 4);
}

async function spawnDecorModel(sceneCtx, tile, key, slot = 0) {
  if (!key || tile.buildingId) return;
  const cfg = DECOR_MODELS[key];
  if (!cfg) return;
  const rand = seeded(tile, 3 + slot * 7);
  try {
    const root = cfg.root === 'units' ? 'units' : 'decor';
    const modelData = root === 'units' ? await loadUnitModel(cfg.file) : await loadDecorModel(cfg.file);
    const model = root === 'units' ? modelData.scene : modelData;
    if (!model) return;
    const scale = (cfg.scale || 0.7) * (0.84 + rand * 0.3);
    model.scale.setScalar(scale);
    model.rotation.y = rand * Math.PI * 2;
    const angle = rand * Math.PI * 2;
    const radius = slot === 0 ? 0.12 : 0.34 + slot * 0.12;
    model.position.set(
      tile.pos.x + Math.cos(angle) * radius,
      tile.height + (cfg.y || 0.02),
      tile.pos.z + Math.sin(angle) * radius
    );
    model.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; } });
    sceneCtx.groups.decor.add(model);
    tile.decorMeshes.push(model);
  } catch {}
}

export async function populateDecorModels(sceneCtx, state) {
  const tasks = [];
  state.map.forEach((tile) => {
    if (tile.buildingId || tile.type === 'water') return;
    const choices = decorChoices(tile);
    choices.forEach((c, idx) => {
      const densityRoll = seeded(tile, 11 + idx * 3);
      const minRoll = tile.type === 'forest' || tile.type === 'rock' || tile.type === 'hill' ? 0.06 : 1 - GAME_CONFIG.decorModelDensity;
      if (densityRoll < minRoll) return;
      tasks.push(spawnDecorModel(sceneCtx, tile, c, idx));
    });
  });
  await Promise.all(tasks);
}
