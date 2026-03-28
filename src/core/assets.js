import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getModelCandidates } from '../data/modelPaths.js';

const loader = new GLTFLoader();
const cache = new Map();

async function loadFirst(paths) {
  let lastError = null;
  for (const path of paths) {
    try {
      const gltf = await loader.loadAsync(path);
      return { scene: gltf.scene, path };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Model not found');
}

function prepareScene(scene) {
  scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      obj.frustumCulled = true;
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          m.depthWrite = true;
          if ('envMapIntensity' in m) m.envMapIntensity = 0.65;
        });
      } else if (obj.material) {
        obj.material.depthWrite = true;
        if ('envMapIntensity' in obj.material) obj.material.envMapIntensity = 0.65;
      }
    }
  });
  return scene;
}

async function loadModel(filename, root = 'buildings') {
  if (!filename) return null;
  const key = `${root}:${filename}`;
  if (cache.has(key)) return cache.get(key).clone(true);
  const { scene } = await loadFirst(getModelCandidates(filename, root));
  prepareScene(scene);
  cache.set(key, scene);
  return scene.clone(true);
}

export function loadBuildingModel(filename) {
  return loadModel(filename, 'buildings');
}

export function loadDecorModel(filename) {
  return loadModel(filename, 'decor');
}

export function loadUnitModel(filename) {
  return loadModel(filename, 'units');
}

export function makeFallbackMesh(color = 0xb4873e) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1, 1.2),
    new THREE.MeshStandardMaterial({ color, roughness: .86, metalness: .06 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return group;
}
