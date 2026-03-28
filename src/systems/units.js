import * as THREE from 'three';
import { UNITS } from '../config.js';
import { getCapital } from './buildings.js';
import { dist2 } from '../utils/helpers.js';

let unitId = 1;

function makeBanner(color) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .9, 5), new THREE.MeshStandardMaterial({ color: 0x5d4326, roughness: 1 }));
  pole.position.set(.22, .65, 0);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(.32, .24), new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: .9 }));
  cloth.position.set(.38, .8, 0);
  return [pole, cloth];
}

function makeUnitMesh(type) {
  const cfg = UNITS[type];
  const group = new THREE.Group();
  const friendly = !cfg.hostile;
  const mainColor = cfg.hostile ? 0xa53d31 : (type === 'worker' ? 0xd7b15f : 0xc8cdc9);
  const accentColor = cfg.hostile ? 0x672017 : 0x3a5a8f;

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.2, .52, 4, 8), new THREE.MeshStandardMaterial({ color: mainColor, roughness: .78, metalness: .08 }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 10), new THREE.MeshStandardMaterial({ color: 0xe1c29d, roughness: 1 }));
  body.castShadow = head.castShadow = true;
  head.position.y = .54;
  group.add(body, head);

  if (type === 'worker') {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(.24, .22, 8), new THREE.MeshStandardMaterial({ color: 0x9b6c2a, roughness: 1 }));
    hat.position.y = .72;
    const basket = new THREE.Mesh(new THREE.BoxGeometry(.16, .16, .22), new THREE.MeshStandardMaterial({ color: 0x7b5729, roughness: 1 }));
    basket.position.set(-.24, .14, -.06);
    basket.rotation.z = -.35;
    group.add(hat, basket);
  } else if (type === 'militia' || type === 'swordsman') {
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, .08, 8), new THREE.MeshStandardMaterial({ color: accentColor, roughness: 1 }));
    shield.rotation.z = Math.PI / 2;
    shield.position.set(-.24, .14, 0);
    const sword = new THREE.Mesh(new THREE.BoxGeometry(.05, .46, .05), new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: .45, metalness: .3 }));
    sword.position.set(.24, .18, 0);
    sword.rotation.z = -.15;
    group.add(shield, sword);
    makeBanner(friendly ? 0x466fb0 : 0x992b1d).forEach((x) => group.add(x));
  } else if (cfg.hostile) {
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(.4, .14, .32), new THREE.MeshStandardMaterial({ color: 0x552116, roughness: 1 }));
    shoulders.position.y = .24;
    const cape = new THREE.Mesh(new THREE.BoxGeometry(.28, .38, .05), new THREE.MeshStandardMaterial({ color: 0x5e1816, roughness: 1 }));
    cape.position.set(0, .04, -.12);
    group.add(shoulders, cape);
    if (type === 'raiderArcher') {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(.16, .02, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8b6030, roughness: 1 }));
      bow.rotation.z = Math.PI / 2;
      bow.position.set(.23, .25, 0);
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .34, 6), new THREE.MeshStandardMaterial({ color: 0x6a431d, roughness: 1 }));
      quiver.position.set(-.18, .16, -.12);
      quiver.rotation.z = -.4;
      group.add(bow, quiver);
    } else if (type === 'brute') {
      body.scale.set(1.18, 1.08, 1.18);
      const axe = new THREE.Mesh(new THREE.BoxGeometry(.06, .68, .06), new THREE.MeshStandardMaterial({ color: 0x6a4528, roughness: 1 }));
      axe.position.set(.26, .22, 0);
      axe.rotation.z = -.42;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(.2, .18, .05), new THREE.MeshStandardMaterial({ color: 0xb7b9bd, roughness: .5, metalness: .2 }));
      blade.position.set(.43, .5, 0);
      blade.rotation.z = -.42;
      group.add(axe, blade);
    } else {
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .72, 5), new THREE.MeshStandardMaterial({ color: 0x5d4326, roughness: 1 }));
      spear.position.set(.24, .26, 0);
      spear.rotation.z = -.38;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(.06, .18, 5), new THREE.MeshStandardMaterial({ color: 0xc5b58f, roughness: .6 }));
      spike.position.set(.37, .58, 0);
      spike.rotation.z = -.38;
      group.add(spear, spike);
    }
    makeBanner(0x8a2318).forEach((x) => group.add(x));
  }

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(.34, .46, 24),
    new THREE.MeshBasicMaterial({ color: cfg.hostile ? 0xff6f61 : 0xffd66b, transparent: true, opacity: .3, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -.42;
  group.add(ring);
  return group;
}

export function spawnUnit(sceneCtx, state, type, pos, target = null) {
  const cfg = UNITS[type];
  const entity = {
    id: `u-${unitId++}`,
    type,
    hp: cfg.hp,
    maxHp: cfg.hp,
    speed: cfg.speed,
    attack: cfg.attack,
    range: cfg.range,
    hostile: !!cfg.hostile,
    attackCooldown: 0,
    pos: new THREE.Vector3(pos.x, pos.y, pos.z),
    target,
    mode: target ? 'move' : 'idle',
    mesh: makeUnitMesh(type)
  };
  entity.mesh.position.copy(entity.pos);
  entity.mesh.position.y += .8;
  sceneCtx.groups.units.add(entity.mesh);
  state.units.push(entity);
  if (!entity.hostile) state.stats.armyUnits = state.units.filter((u) => !u.hostile && u.type !== 'worker').length;
  return entity;
}

export function queueTraining(building, type) {
  const cfg = UNITS[type];
  building.trainQueue.push({ type, progress: 0, trainTime: cfg.trainTime });
}

export function updateTraining(sceneCtx, state, dt, notify) {
  for (const building of state.buildings) {
    if (!building.trainQueue.length) continue;
    const current = building.trainQueue[0];
    current.progress += dt;
    if (current.progress >= current.trainTime) {
      const tile = state.mapIndex.get(building.tileId);
      const spawnPos = new THREE.Vector3(tile.pos.x + .8, tile.height, tile.pos.z + .8);
      const target = current.type === 'worker' ? null : getCapital(state) ? state.mapIndex.get(getCapital(state).tileId).pos.clone() : null;
      spawnUnit(sceneCtx, state, current.type, spawnPos, target);
      building.trainQueue.shift();
      notify(`${UNITS[current.type].name} готов`);
    }
  }
}

function nearestTarget(unit, state, predicate, maxDistance = Infinity) {
  let best = null;
  let bestD = Infinity;
  state.units.forEach((candidate) => {
    if (!predicate(candidate)) return;
    const d = dist2(unit.pos, candidate.pos);
    if (d < bestD && d <= maxDistance) {
      best = candidate;
      bestD = d;
    }
  });
  return { best, bestD };
}

export function updateUnits(sceneCtx, state, dt, notify) {
  const capital = getCapital(state);
  const capitalTile = capital ? state.mapIndex.get(capital.tileId) : null;
  for (let i = state.units.length - 1; i >= 0; i--) {
    const unit = state.units[i];
    unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);

    let targetPos = null;
    if (unit.hostile) {
      const { best: defender, bestD } = nearestTarget(unit, state, (u) => !u.hostile && u.type !== 'worker', unit.range > 2 ? 8 : 6);
      if (defender) {
        targetPos = defender.pos;
        if (bestD <= unit.range + .35 && unit.attackCooldown <= 0) {
          defender.hp -= unit.attack;
          unit.attackCooldown = 1.15;
        }
      } else if (capitalTile) {
        targetPos = capitalTile.pos;
      }
    } else if (unit.type !== 'worker') {
      const { best: enemy, bestD } = nearestTarget(unit, state, (u) => u.hostile, 8);
      if (enemy) {
        targetPos = enemy.pos;
        if (bestD <= unit.range + .35 && unit.attackCooldown <= 0) {
          enemy.hp -= unit.attack;
          unit.attackCooldown = .95;
        }
      } else if (capitalTile) {
        targetPos = capitalTile.pos;
      }
    }

    if (targetPos) {
      const dir = new THREE.Vector3().subVectors(targetPos, unit.pos);
      dir.y = 0;
      const len = dir.length();
      if (len > .18) {
        dir.normalize();
        unit.pos.addScaledVector(dir, unit.speed * dt);
        unit.mesh.lookAt(unit.pos.x + dir.x, unit.mesh.position.y, unit.pos.z + dir.z);
      }
    }

    unit.mesh.position.set(unit.pos.x, unit.pos.y + .8, unit.pos.z);

    if (unit.hp <= 0) {
      if (unit.hostile) {
        state.resources.prestige += 1.5;
        state.resources.threat = Math.max(0, state.resources.threat - .6);
        state.stats.raidsDefeated += 1;
      }
      sceneCtx.groups.units.remove(unit.mesh);
      state.units.splice(i, 1);
      continue;
    }

    if (unit.hostile && capitalTile && dist2(unit.pos, capitalTile.pos) < 1.8) {
      state.resources.gold = Math.max(0, state.resources.gold - 4);
      state.resources.food = Math.max(0, state.resources.food - 5);
      state.resources.stability = Math.max(0, state.resources.stability - 1.2);
      unit.hp = 0;
      notify('Налётчик прорвался к столице');
    }
  }
  state.stats.armyUnits = state.units.filter((u) => !u.hostile && u.type !== 'worker').length;
}

export function autoSpawnWorkers(sceneCtx, state, notify) {
  if (state.resources.workers >= state.resources.population) return;
  if (state.resources.population >= state.resources.populationCap) return;
  const capital = getCapital(state);
  if (!capital) return;
  const tile = state.mapIndex.get(capital.tileId);
  spawnUnit(sceneCtx, state, 'worker', new THREE.Vector3(tile.pos.x + .5, tile.height, tile.pos.z - .4));
  state.resources.workers += 1;
  state.resources.population += 1;
  notify('В столице появился новый рабочий');
}
