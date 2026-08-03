import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const WATERCRAFT_BASE = '/assets/kenney/watercraft/';
const NATURE_BASE = '/assets/kenney/nature/';

const BOAT_FILES = {
  rowSmall: 'boat-row-small.glb',
  rowLarge: 'boat-row-large.glb',
  fishing: 'boat-fishing-small.glb',
  sail: 'boat-sail-a.glb',
};

/** Extra yaw so each mesh's bow points at local −Z (toward beach at group yaw 0). */
const BOAT_BOW_YAW = {
  rowSmall: Math.PI / 2, // 90° from the shared π default
  rowLarge: Math.PI,
  fishing: Math.PI,
  sail: Math.PI,
};

const PALM_FILES = {
  palm: 'tree_palm.glb',
  palmBend: 'tree_palmBend.glb',
  palmShort: 'tree_palmShort.glb',
  palmTall: 'tree_palmTall.glb',
  palmDetailed: 'tree_palmDetailedShort.glb',
};

/** Nature Kit palms ship with stylized teal/peach; recolor toward Mediterranean greens. */
const PALM_RECOLOR = {
  leaf: 0x2f7a3e,
  leafAlt: 0x3d8a4a,
  bark: 0x6a4a28,
  barkAlt: 0x7a5530,
};

/** Convert lit Kenney materials to MeshBasic so they read in our unlit scene. */
function toUnlit(root, { recolorPalm = false } = {}) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const srcList = Array.isArray(o.material) ? o.material : [o.material];
    const next = srcList.map((m, i) => {
      const map = m.map || m.emissiveMap || null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
        map.needsUpdate = true;
      }

      let color = map ? 0xffffff : (m.color ? m.color.getHex() : 0xffffff);
      if (recolorPalm) {
        const name = (m.name || '').toLowerCase();
        if (name.includes('leaf')) color = i % 2 ? PALM_RECOLOR.leafAlt : PALM_RECOLOR.leaf;
        else if (name.includes('wood') || name.includes('bark') || name.includes('trunk')) {
          color = PALM_RECOLOR.bark;
        } else {
          // Fallback by luminance of original: warm → bark, cool → leaf
          const c = m.color || new THREE.Color(color);
          color = c.g > c.r ? PALM_RECOLOR.leaf : PALM_RECOLOR.barkAlt;
        }
      }

      const basic = new THREE.MeshBasicMaterial({
        color,
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

/** Sit on y=0, center XZ; store size metadata. */
function normalizePiece(scene, opts = {}) {
  toUnlit(scene, opts);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  scene.position.x -= center.x;
  scene.position.z -= center.z;
  scene.position.y -= box.min.y;

  const wrap = new THREE.Group();
  wrap.add(scene);
  wrap.userData.size = size.clone();
  wrap.userData.height = size.y;
  wrap.userData.footprint = Math.max(size.x, size.z);
  wrap.updateMatrixWorld(true);
  return wrap;
}

/**
 * Sit on y=0, center XZ, scale longest axis to targetLength.
 * `bowYaw` aligns the mesh bow to local −Z.
 */
function normalizeBoatTemplate(scene, { targetLength = 3.1, bowYaw = Math.PI } = {}) {
  toUnlit(scene);

  let box = new THREE.Box3().setFromObject(scene);
  let size = box.getSize(new THREE.Vector3());

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
  wrap.rotation.y = bowYaw;

  wrap.updateMatrixWorld(true);
  return wrap;
}

function pickKey(keys, salt = 0) {
  const i = Math.abs(Math.floor(salt * 17.13)) % keys.length;
  return keys[i];
}

/**
 * Kenney Watercraft Kit + Nature Kit palms (CC0)
 * https://kenney.nl/assets/watercraft-kit
 * https://kenney.nl/assets/nature-kit
 */
export class KenneyAssets {
  constructor() {
    this.ready = false;
    this.natureReady = false;
    this._templates = {};
    this._palms = {};
  }

  async load() {
    const loader = new GLTFLoader();

    // —— Boats ——
    loader.setPath(WATERCRAFT_BASE);
    loader.setResourcePath(WATERCRAFT_BASE);
    await Promise.all(Object.entries(BOAT_FILES).map(async ([key, file]) => {
      const gltf = await loader.loadAsync(file);
      const targetLen = key === 'rowSmall' ? 2.6
        : key === 'sail' ? 3.4
          : key === 'fishing' ? 3.0
            : 3.2;
      this._templates[key] = normalizeBoatTemplate(gltf.scene, {
        targetLength: targetLen,
        bowYaw: BOAT_BOW_YAW[key] ?? Math.PI,
      });
    }));
    this.ready = true;

    // —— Palms only (Nature Kit) ——
    loader.setPath(NATURE_BASE);
    loader.setResourcePath(NATURE_BASE);
    await Promise.all(Object.entries(PALM_FILES).map(async ([key, file]) => {
      const gltf = await loader.loadAsync(file);
      this._palms[key] = normalizePiece(gltf.scene, { recolorPalm: true });
    }));
    this.natureReady = Object.keys(this._palms).length > 0;
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
    g.add(template.clone(true));

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

  /** Place a Kenney palm at (x,z). Returns group or null. */
  clonePalm(x, z, scale = 1) {
    if (!this.natureReady) return null;
    const keys = Object.keys(this._palms);
    const key = pickKey(keys, x * 3 + z * 7);
    const tmpl = this._palms[key];
    if (!tmpl) return null;

    const g = tmpl.clone(true);
    const targetH = 3.2 * scale;
    const s = targetH / (tmpl.userData.height || 1);
    g.scale.setScalar(s);
    g.position.set(x, 0, z);
    g.rotation.y = (x * 1.7 + z) * 0.35;
    g.userData.kenneyPalm = true;
    g.userData.phase = x + z;
    return g;
  }
}
