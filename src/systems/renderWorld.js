import * as THREE from 'three';
import { TERRAIN_TYPES } from '../config.js';
import { createHexShape, isTileInsideTerritory } from './world.js';

const terrainMaterials = new Map();
const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x2a170d, roughness: 1, metalness: 0 });

function getTerrainMaterial(type) {
  if (terrainMaterials.has(type)) return terrainMaterials.get(type);
  const cfg = TERRAIN_TYPES[type];
  const mat = new THREE.MeshStandardMaterial({
    color: cfg.color,
    roughness: type === 'river' || type === 'water' ? .24 : .9,
    metalness: type === 'water' ? .08 : 0,
    emissive: type === 'water' ? 0x12304c : 0x000000,
    emissiveIntensity: type === 'water' ? .18 : 0
  });
  terrainMaterials.set(type, mat);
  return mat;
}

function tint(color, amt) {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, amt);
  return c;
}

function makeHexMesh(shape, tile) {
  const depth = tile.type === 'water' ? .38 : .7 + Math.max(0, tile.height * .08);
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .028, bevelSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(tile.pos.x, tile.height - depth, tile.pos.z);
  const mesh = new THREE.Mesh(geo, [edgeMaterial, getTerrainMaterial(tile.type)]);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.tileId = tile.id;
  mesh.rotation.y = tile.noise * .04;
  return mesh;
}

function addBushCluster(group, pos, y) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x376d2a, roughness: 1 });
  for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
    const bush = new THREE.Mesh(new THREE.SphereGeometry(.18 + Math.random() * .12, 7, 7), mat);
    bush.scale.y = .8;
    bush.position.set(pos.x + (Math.random() - .5) * 1.0, y + .14, pos.z + (Math.random() - .5) * 1.0);
    bush.castShadow = true;
    group.add(bush);
  }
}

function addFlowerDots(group, pos, y) {
  const colors = [0xf3d36b, 0xd7f0ff, 0xffb2b2];
  for (let i = 0; i < 6; i++) {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.03, 5, 5), new THREE.MeshStandardMaterial({ color: colors[i % colors.length], emissive: colors[i % colors.length], emissiveIntensity: .08 }));
    dot.position.set(pos.x + (Math.random() - .5) * 1.1, y + .12, pos.z + (Math.random() - .5) * 1.1);
    group.add(dot);
  }
}

function addTreeCluster(group, pos, y) {
  const matTrunk = new THREE.MeshStandardMaterial({ color: 0x714a24, roughness: 1 });
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const leafColor = Math.random() > .55 ? 0x2f6d2d : 0x1f5120;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.08, .11, .72, 5), matTrunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(.38 + Math.random() * .16, 1.05, 7), new THREE.MeshStandardMaterial({ color: leafColor, roughness: 1 }));
    const crown2 = new THREE.Mesh(new THREE.ConeGeometry(.28 + Math.random() * .1, .7, 7), new THREE.MeshStandardMaterial({ color: tint(leafColor, .08), roughness: 1 }));
    const ox = (Math.random() - .5) * 1.3;
    const oz = (Math.random() - .5) * 1.3;
    trunk.position.set(pos.x + ox, y + .38, pos.z + oz);
    crown.position.set(pos.x + ox, y + 1.04, pos.z + oz);
    crown2.position.set(pos.x + ox, y + 1.42, pos.z + oz);
    trunk.castShadow = crown.castShadow = crown2.castShadow = true;
    group.add(trunk, crown, crown2);
  }
}

function addRockCluster(group, pos, y) {
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(.2 + Math.random() * .18, 0),
      new THREE.MeshStandardMaterial({ color: Math.random() > .5 ? 0x8b8b8b : 0x6f706f, roughness: 1 })
    );
    rock.position.set(pos.x + (Math.random() - .5) * 1.15, y + .12 + Math.random() * .18, pos.z + (Math.random() - .5) * 1.15);
    rock.scale.setScalar(.8 + Math.random() * 1.2);
    rock.castShadow = true;
    group.add(rock);
  }
}

function addGrassCluster(group, pos, y, color = 0xc4c15f) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
  for (let i = 0; i < 7; i++) {
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(.015, .03, .35 + Math.random() * .18, 4), mat);
    blade.position.set(pos.x + (Math.random() - .5) * 1.45, y + .14, pos.z + (Math.random() - .5) * 1.45);
    blade.rotation.z = (Math.random() - .5) * .24;
    group.add(blade);
  }
}

function addReedCluster(group, pos, y) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9be71, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const reed = new THREE.Mesh(new THREE.CylinderGeometry(.02, .03, .48 + Math.random() * .2, 5), mat);
    reed.position.set(pos.x + (Math.random() - .5) * 1.2, y + .18, pos.z + (Math.random() - .5) * 1.2);
    group.add(reed);
  }
}

function addDistantMountains(group) {
  group.clear();
  const fogMat = new THREE.MeshStandardMaterial({ color: 0x4f453d, roughness: 1, transparent: true, opacity: .94 });
  for (let i = 0; i < 28; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const radius = 44 + (i % 3) * 4 + Math.random() * 3;
    const h = 10 + Math.random() * 12;
    const mountain = new THREE.Mesh(
      new THREE.ConeGeometry(5 + Math.random() * 5, h, 6 + Math.floor(Math.random() * 3)),
      fogMat.clone()
    );
    mountain.position.set(Math.cos(angle) * radius, -1 + h / 2, Math.sin(angle) * radius);
    mountain.castShadow = true;
    group.add(mountain);
  }
}

export function renderTiles(sceneCtx, state) {
  const { groups } = sceneCtx;
  groups.tiles.clear();
  groups.decor.clear();
  groups.overlays.clear();
  addDistantMountains(groups.backdrop);

  const shape = createHexShape();
  const ringGeo = new THREE.RingGeometry(state.territoryRadius - .14, state.territoryRadius + .18, 128);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: .12, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = .08;
  groups.overlays.add(ring);

  state.map.forEach((tile) => {
    const mesh = makeHexMesh(shape, tile);
    groups.tiles.add(mesh);
    tile.mesh = mesh;

    const topGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.44, 1.52, 6),
      new THREE.MeshBasicMaterial({ color: isTileInsideTerritory(state, tile) ? 0xf0d078 : 0x65492b, transparent: true, opacity: isTileInsideTerritory(state, tile) ? .035 : .012, side: THREE.DoubleSide })
    );
    topGlow.rotation.x = -Math.PI / 2;
    topGlow.position.set(tile.pos.x, tile.height + .05, tile.pos.z);
    groups.overlays.add(topGlow);

    if (tile.type === 'forest') { addTreeCluster(groups.decor, tile.pos, tile.height + .02); addBushCluster(groups.decor, tile.pos, tile.height + .02); }
    if (tile.type === 'rock' || tile.type === 'hill') addRockCluster(groups.decor, tile.pos, tile.height + .02);
    if (tile.type === 'fertile') { addGrassCluster(groups.decor, tile.pos, tile.height + .02, 0xcfce6a); addFlowerDots(groups.decor, tile.pos, tile.height + .02); }
    if (tile.type === 'grass') { addGrassCluster(groups.decor, tile.pos, tile.height + .02, 0x9ab55b); if (Math.random() > .55) addBushCluster(groups.decor, tile.pos, tile.height + .02); }
    if (tile.type === 'river') addReedCluster(groups.decor, tile.pos, tile.height + .02);
  });
}

export function renderRoads(sceneCtx, state) {
  const { groups } = sceneCtx;
  groups.roads.clear();
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xb6915d, roughness: 1 });
  state.roads.forEach((road) => {
    const a = state.mapIndex.get(road.a);
    const b = state.mapIndex.get(road.b);
    if (!a || !b) return;
    const dir = new THREE.Vector3().subVectors(b.pos, a.pos);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(.54, .04, len), roadMat);
    mesh.position.set((a.pos.x + b.pos.x) / 2, ((a.height + b.height) / 2) + .08, (a.pos.z + b.pos.z) / 2);
    mesh.lookAt(b.pos.x, mesh.position.y, b.pos.z);
    mesh.rotateY(Math.PI);
    mesh.receiveShadow = true;
    groups.roads.add(mesh);
  });
}
