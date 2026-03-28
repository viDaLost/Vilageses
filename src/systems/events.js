import * as THREE from 'three';
import { rand } from '../utils/helpers.js';
import { WEATHER_TYPES } from '../config.js';
import { spawnUnit } from './units.js';

export function updateEnvironmentState(state, dt) {
  state.dayTime += dt;
  state.seasonTime += dt;
  state.worldTime += dt;
}

export function maybeChangeWeather(state) {
  const pool = ['clear', 'clear', 'rain', 'mist', 'dust'];
  state.weather = rand(pool);
}

export function updateEnemyWaves(sceneCtx, state, dt, notify) {
  state.enemyWaveTimer -= dt;
  if (state.enemyWaveTimer > 0) return;
  state.enemyWaveTimer = 50 + Math.random() * 18;
  if (!state.enemyCamps.length) return;
  const camp = rand(state.enemyCamps);
  const count = 1 + Math.floor(state.era + Math.random() * 2.4);
  const spawned = [];
  for (let i = 0; i < count; i++) {
    const p = camp.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 2.8, 0, (Math.random() - .5) * 2.8));
    let type = 'raider';
    if (state.era >= 1 && Math.random() > .55) type = 'raiderArcher';
    if (state.era >= 2 && Math.random() > .72) type = 'brute';
    spawned.push(type);
    spawnUnit(sceneCtx, state, type, p);
  }
  state.resources.threat = Math.min(100, state.resources.threat + 4 + count * 1.2);
  const archers = spawned.filter((t) => t === 'raiderArcher').length;
  const brutes = spawned.filter((t) => t === 'brute').length;
  notify(`Набег: ${count} врагов${archers ? `, лучники ${archers}` : ''}${brutes ? `, крушители ${brutes}` : ''}`);
}
