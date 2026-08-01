import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshBasicMaterial({ color });
}

/**
 * Low-poly person: head, torso, arms, legs, optional rifle.
 * Facing +Z locally after yaw (muzzle aims along -Z of gun, person faces +Z via rotation).
 */
export function createPerson(palette, opts = {}) {
  const armed = opts.armed !== false;
  const {
    skin = 0xd4a574,
    shirt = 0x3dffb5,
    pants = 0x2a3540,
    boot = 0x1a2228,
    hair = 0x1c1410,
    gun = 0x2a3038,
  } = palette;

  const root = new THREE.Group();
  const rig = {
    torso: null,
    head: null,
    lArm: null,
    rArm: null,
    lLeg: null,
    rLeg: null,
    gun: null,
    muzzle: null,
    armed,
  };

  const torso = new THREE.Group();
  torso.position.y = 0.95;
  root.add(torso);
  rig.torso = torso;

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), mat(shirt));
  chest.position.y = 0.2;
  torso.add(chest);

  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  rig.head = head;
  head.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), mat(skin)));
  const hairMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), mat(hair));
  hairMesh.position.y = 0.2;
  head.add(hairMesh);

  const mkArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 0.48, 0);
    torso.add(pivot);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), mat(shirt));
    upper.position.y = -0.2;
    pivot.add(upper);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.14), mat(skin));
    hand.position.y = -0.46;
    pivot.add(hand);
    return pivot;
  };
  rig.lArm = mkArm(-1);
  rig.rArm = mkArm(1);

  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.08, -0.42, -0.05);
  rig.rArm.add(gunRoot);
  rig.gun = gunRoot;

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.28), mat(gun));
  stock.position.set(0, 0, 0.06);
  gunRoot.add(stock);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.55), mat(0x4a5560));
  barrel.position.set(0, 0.02, -0.32);
  gunRoot.add(barrel);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.62);
  gunRoot.add(muzzle);
  rig.muzzle = muzzle;

  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.14, 0.95, 0);
    root.add(pivot);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.22), mat(pants));
    thigh.position.y = -0.25;
    pivot.add(thigh);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.45, 0.2), mat(pants));
    shin.position.y = -0.68;
    pivot.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.32), mat(boot));
    foot.position.set(0, -0.92, -0.04);
    pivot.add(foot);
    return pivot;
  };
  rig.lLeg = mkLeg(-1);
  rig.rLeg = mkLeg(1);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  root.userData.rig = rig;
  root.userData.walk = 0;
  setArmed(root, armed);
  return root;
}

/** Show/hide rifle and snap to aim or idle arm pose. */
export function setArmed(root, armed) {
  const rig = root.userData.rig;
  if (!rig) return;
  rig.armed = armed;
  if (rig.gun) rig.gun.visible = armed;
  if (armed) {
    rig.rArm.rotation.x = -1.15;
    rig.lArm.rotation.x = -0.85;
    rig.lArm.rotation.z = 0.35;
  } else {
    rig.rArm.rotation.x = 0.15;
    rig.rArm.rotation.z = 0.08;
    rig.lArm.rotation.x = 0.15;
    rig.lArm.rotation.z = -0.08;
  }
}

export function animatePerson(root, dt, speed, sprinting, distressed = false) {
  const rig = root.userData.rig;
  if (!rig || !rig.lLeg || !rig.rLeg || !rig.lArm || !rig.rArm) return;

  const moving = speed > 0.15;
  const cadence = distressed ? 18 : sprinting ? 14 : 9;
  if (moving) root.userData.walk += dt * cadence * Math.min(1.6, speed / 4);
  else root.userData.walk *= Math.max(0, 1 - dt * 8);

  const phase = root.userData.walk;
  const amp = moving ? (distressed ? 1.05 : sprinting ? 0.85 : 0.55) : 0;

  rig.lLeg.rotation.x = Math.sin(phase) * amp;
  rig.rLeg.rotation.x = Math.sin(phase + Math.PI) * amp;

  if (distressed) {
    // Flailing / screaming panic
    rig.rArm.rotation.x = -1.6 + Math.sin(phase * 3.1) * 0.9;
    rig.lArm.rotation.x = -1.4 + Math.sin(phase * 2.7 + 1.2) * 0.9;
    rig.rArm.rotation.z = 0.55 + Math.sin(phase * 2.2) * 0.45;
    rig.lArm.rotation.z = -0.55 + Math.sin(phase * 2.4 + 0.8) * 0.45;
    if (rig.head) rig.head.rotation.y = Math.sin(phase * 2.8) * 0.45;
    if (rig.head) rig.head.rotation.x = Math.sin(phase * 3.5) * 0.2;
    rig.torso.rotation.y = Math.sin(phase * 1.6) * 0.22;
    rig.torso.position.y = 0.95 + Math.abs(Math.sin(phase * 2)) * 0.08;
  } else {
    if (rig.head) {
      rig.head.rotation.y = 0;
      rig.head.rotation.x = 0;
    }
    const bob = moving ? Math.sin(phase * 2) * 0.06 : 0;
    if (rig.armed) {
      rig.rArm.rotation.x = -1.15 + bob;
      rig.lArm.rotation.x = -0.85 + bob * 0.5;
      rig.lArm.rotation.z = 0.35;
      rig.rArm.rotation.z = 0;
    } else {
      rig.rArm.rotation.x = 0.15 + Math.sin(phase) * amp * 0.7;
      rig.lArm.rotation.x = 0.15 + Math.sin(phase + Math.PI) * amp * 0.7;
      rig.rArm.rotation.z = 0.08;
      rig.lArm.rotation.z = -0.08;
    }
    rig.torso.rotation.y = moving ? Math.sin(phase) * 0.06 : 0;
    rig.torso.position.y = 0.95 + (moving ? Math.abs(Math.sin(phase)) * 0.04 : 0);
  }
}

export function muzzleWorld(root, out) {
  const m = root.userData.rig?.muzzle;
  if (!m || !root.userData.rig?.armed) {
    out.copy(root.position);
    out.y = 1.1;
    return out;
  }
  m.getWorldPosition(out);
  return out;
}

export function setTint(root, hex) {
  root.traverse((o) => {
    if (o.userData.skipTint) return;
    if (o.isMesh && o.material && o.material.color && !o.userData._base) {
      o.userData._base = o.material.color.getHex();
    }
  });
  root.traverse((o) => {
    if (o.userData.skipTint) return;
    if (o.isMesh && o.material && o.material.color && o.userData._base != null) {
      o.material.color.setHex(hex ?? o.userData._base);
    }
  });
}

export function clearTint(root) {
  setTint(root, null);
}

const _detachPos = new THREE.Vector3();
const _detachQuat = new THREE.Quaternion();
const _detachScale = new THREE.Vector3();

/**
 * Rip head + limbs off a person into world-space groups (caller parents them).
 * Leaves the torso/stump on the original root.
 */
export function detachBodyParts(root, partNames = ['head', 'lArm', 'rArm', 'lLeg', 'rLeg']) {
  const rig = root.userData.rig;
  if (!rig) return [];
  root.updateMatrixWorld(true);
  const parts = [];
  for (const name of partNames) {
    const obj = rig[name];
    if (!obj) continue;
    obj.updateMatrixWorld(true);
    obj.matrixWorld.decompose(_detachPos, _detachQuat, _detachScale);
    if (obj.parent) obj.parent.remove(obj);
    obj.position.copy(_detachPos);
    obj.quaternion.copy(_detachQuat);
    obj.scale.copy(_detachScale);
    // Flatten nested pivot offsets so parts sit sensibly when tumbling
    obj.rotation.x += (Math.random() - 0.5) * 0.8;
    obj.rotation.z += (Math.random() - 0.5) * 1.2;
    rig[name] = null;
    parts.push({ name, mesh: obj });
  }
  return parts;
}

/** Flat HP bar above a figure. Hidden at full health. */
export function createHealthBar() {
  const root = new THREE.Group();
  root.position.y = 2.15;

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x0a0e12, depthTest: false }),
  );
  root.add(bg);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x3dffb5, depthTest: false }),
  );
  fill.position.z = 0.01;
  root.add(fill);

  bg.userData.skipTint = true;
  fill.userData.skipTint = true;
  root.userData.skipTint = true;
  root.visible = false;
  root.userData.fill = fill;
  root.userData.fillWidth = 0.84;
  root.renderOrder = 20;
  bg.renderOrder = 20;
  fill.renderOrder = 21;
  return root;
}

export function updateHealthBar(bar, hp, maxHp, parentYaw = 0) {
  if (!bar) return;
  const ratio = Math.max(0, Math.min(1, hp / maxHp));
  const injured = hp < maxHp && hp > 0;
  bar.visible = injured;
  if (!injured) return;
  const fill = bar.userData.fill;
  const w = bar.userData.fillWidth;
  fill.scale.x = Math.max(0.001, ratio);
  fill.position.x = -w * 0.5 * (1 - ratio);
  fill.material.color.setHex(ratio > 0.5 ? 0x3dffb5 : ratio > 0.25 ? 0xffc24a : 0xff5a4a);
  // Counter body yaw so the bar stays screen-aligned under the angled camera
  bar.rotation.set(-0.6, -parentYaw, 0);
}
