import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WATERCRAFT_BASE = '/assets/kenney/watercraft/';

const BOAT_FILES = {
  rowSmall: 'boat-row-small.glb',
  rowLarge: 'boat-row-large.glb',
  fishing: 'boat-fishing-small.glb',
  sail: 'boat-sail-a.glb',
};

/** Convert lit Kenney materials to MeshBasic so they read in our unlit scene. */
function toUnlit(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const srcList = Array.isArray(o.material) ? o.material : [o.material];
    const next = srcList.map((m) => {
      // Kenney packs use baseColorTexture → .map after GLTFLoader
      const map = m.map || m.emissiveMap || null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      } else {
        console.warn('[Kenney] mesh missing colormap', o.name || o.uuid);
      }
      const basic = new THREE.MeshBasicMaterial({
        color: map ? 0xffffff : (m.color ? m.color.clone() : new THREE.Color(0xffffff)),
        map,
        transparent: !!m.transparent,
        opacity: m.opacity ?? 1,
        side: THREE.DoubleSide,
        depthWrite: m.depthWrite !== false,
      });
      m.dispose?.();
      return basic;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

/**
 * Sit on y=0, center XZ, scale longest axis to targetLength.
 * Kenney watercraft bow faces local +Z in these files; game boats use local −Z as bow,
 * so we rotate π around Y.
 */
function normalizeBoatTemplate(scene, targetLength = 3.1) {
  toUnlit(scene);

  let box = new THREE.Box3().setFromObject(scene);
  let size = box.getSize(new THREE.Vector3());

  // Prefer length along Z
  if (size.x > size.z * 1.15) {
    scene.rotation.y += Math.PI / 2;
    scene.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(scene);
    size = box.getSize(new THREE.Vector3());
  }

  const center = box.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box.min.y;

  const wrap = new THREE.Group();
  wrap.add(scene);

  const len = Math.max(size.x, size.z) || 1;
  wrap.scale.setScalar(targetLength / len);
  // Kenney bow faces local +Z; game treats local −Z as bow (toward beach at yaw 0)
  wrap.rotation.y = Math.PI;

  wrap.updateMatrixWorld(true);
  return wrap;
}

/**
 * Kenney Watercraft Kit (CC0) — https://kenney.nl/assets/watercraft-kit
 */
export class KenneyAssets {
  constructor() {
    this.ready = false;
    this._templates = {};
  }

  async load() {
    const loader = new GLTFLoader();
    loader.setPath(WATERCRAFT_BASE);
    // External colormap.png lives at .../Textures/colormap.png (GLB relative URI)
    loader.setResourcePath(WATERCRAFT_BASE);

    const entries = Object.entries(BOAT_FILES);
    await Promise.all(entries.map(async ([key, file]) => {
      const gltf = await loader.loadAsync(file);
      const targetLen = key === 'rowSmall' ? 2.6
        : key === 'sail' ? 3.4
          : key === 'fishing' ? 3.0
            : 3.2;
      this._templates[key] = normalizeBoatTemplate(gltf.scene, targetLen);
    }));
    this.ready = true;
    return this;
  }

  /** Clone a boat template into a fresh group, or null if not loaded. */
  cloneBoat({ raft = false, leader = false } = {}) {
    if (!this.ready) return null;
    let key;
    if (leader) key = 'sail';
    else if (raft) key = Math.random() < 0.5 ? 'rowSmall' : 'rowLarge';
    else key = Math.random() < 0.55 ? 'fishing' : 'rowLarge';

    const template = this._templates[key] || this._templates.rowSmall;
    if (!template) return null;

    const g = new THREE.Group();
    const model = template.clone(true);
    g.add(model);

    // Soft water contact disc (matches procedural boats)
    const wake = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 14),
      new THREE.MeshBasicMaterial({
        color: 0x0a2030,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.y = 0.03;
    wake.scale.set(0.7, 1.15, 1);
    g.add(wake);

    g.userData.kenney = key;
    return g;
  }
}
