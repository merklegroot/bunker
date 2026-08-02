import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshBasicMaterial({ color });
}

/**
 * Low-poly person: head, torso, arms, legs, optional rifle.
 * Facing +Z locally after yaw (muzzle aims along -Z of gun, person faces +Z via rotation).
 * opts.female — softer proportions + longer hair (civilians).
 */
export function createPerson(palette, opts = {}) {
  const armed = opts.armed !== false;
  const female = !!opts.female;
  const {
    skin = 0xd4a574,
    shirt = 0x3dffb5,
    pants = 0x2a3540,
    boot = 0x1a2228,
    hair = 0x1c1410,
    gun = 0x2a3038,
  } = palette;

  const root = new THREE.Group();
  // Yaw around world up, then pitch — required so swim lean follows facing
  root.rotation.order = 'YXZ';
  const rig = {
    torso: null,
    head: null,
    lArm: null,
    rArm: null,
    lElbow: null,
    rElbow: null,
    lLeg: null,
    rLeg: null,
    gun: null,
    muzzle: null,
    machete: null,
    armed,
    female,
  };

  const torso = new THREE.Group();
  torso.position.y = 0.95;
  root.add(torso);
  rig.torso = torso;

  if (female) {
    // Hourglass-ish read without being extreme: bust → narrow waist → wider hips
    const bust = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.28, 0.34), mat(shirt));
    bust.position.y = 0.32;
    torso.add(bust);
    const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.28, 0.26), mat(shirt));
    waist.position.y = 0.06;
    torso.add(waist);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.32, 0.32), mat(pants));
    hips.position.y = -0.24;
    torso.add(hips);
  } else {
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), mat(shirt));
    chest.position.y = 0.2;
    torso.add(chest);
  }

  const head = new THREE.Group();
  head.position.y = female ? 0.64 : 0.72;
  torso.add(head);
  rig.head = head;
  // Face order: +x,-x,+y,-y,+z,-z — person faces +Z, so -Z is the back of the head
  const skinMat = mat(skin);
  const hairMat = mat(hair);
  const headSize = female ? 0.31 : 0.34;
  head.add(new THREE.Mesh(
    new THREE.BoxGeometry(headSize, female ? 0.33 : 0.36, headSize),
    [skinMat, skinMat, skinMat, skinMat, skinMat, hairMat],
  ));
  const hairTop = new THREE.Mesh(
    new THREE.BoxGeometry(female ? 0.33 : 0.36, female ? 0.12 : 0.14, female ? 0.33 : 0.36),
    hairMat,
  );
  hairTop.position.y = female ? 0.17 : 0.2;
  head.add(hairTop);

  if (female) {
    // Long hair down the back and over the shoulders
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.12), hairMat);
    hairBack.position.set(0, -0.32, -0.2);
    head.add(hairBack);
    const hairL = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.24), hairMat);
    hairL.position.set(-0.19, -0.28, -0.02);
    head.add(hairL);
    const hairR = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.24), hairMat);
    hairR.position.set(0.19, -0.28, -0.02);
    head.add(hairR);
    // Extra length at the tips / mid-back
    const hairTail = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.35, 0.1), hairMat);
    hairTail.position.set(0, -0.72, -0.18);
    head.add(hairTail);
  }

  const shoulderX = female ? 0.26 : 0.34;
  const armW = female ? 0.12 : 0.16;
  const mkArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, female ? 0.4 : 0.48, 0);
    torso.add(shoulder);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(armW, female ? 0.3 : 0.36, armW), mat(shirt));
    upper.position.y = female ? -0.15 : -0.18;
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = female ? -0.3 : -0.36;
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(new THREE.BoxGeometry(armW * 0.9, female ? 0.26 : 0.32, armW * 0.9), mat(shirt));
    forearm.position.y = female ? -0.13 : -0.16;
    elbow.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(female ? 0.11 : 0.15, female ? 0.11 : 0.15, female ? 0.11 : 0.15),
      mat(skin),
    );
    hand.position.y = female ? -0.3 : -0.36;
    elbow.add(hand);

    // Default slight bend so arms don't look locked
    elbow.rotation.x = -0.45;
    return { shoulder, elbow };
  };
  const left = mkArm(-1);
  const right = mkArm(1);
  rig.lArm = left.shoulder;
  rig.rArm = right.shoulder;
  rig.lElbow = left.elbow;
  rig.rElbow = right.elbow;

  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.08, -0.15, -0.05);
  right.elbow.add(gunRoot);
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

  // Machete (hidden unless an execution sequence draws it)
  const macheteRoot = new THREE.Group();
  macheteRoot.position.set(0.02, -0.34, 0.04);
  right.elbow.add(macheteRoot);
  rig.machete = macheteRoot;
  const mHandle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.07), mat(0x3a2818));
  mHandle.position.set(0, 0.02, 0);
  macheteRoot.add(mHandle);
  const mGuard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.08), mat(0x6a6050));
  mGuard.position.set(0, -0.08, 0);
  macheteRoot.add(mGuard);
  const mBlade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, 0.14), mat(0xb0b8c0));
  mBlade.position.set(0.01, -0.4, 0.02);
  macheteRoot.add(mBlade);
  macheteRoot.visible = false;

  const legX = female ? 0.13 : 0.14;
  const legW = female ? 0.17 : 0.2;
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * legX, 0.95, 0);
    root.add(pivot);
    // Thighs a touch fuller under wider hips
    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(female ? 0.19 : legW, female ? 0.44 : 0.5, female ? 0.2 : 0.22),
      mat(pants),
    );
    thigh.position.y = female ? -0.22 : -0.25;
    pivot.add(thigh);
    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(female ? 0.15 : legW * 0.9, female ? 0.4 : 0.45, female ? 0.16 : 0.2),
      mat(pants),
    );
    shin.position.y = female ? -0.62 : -0.68;
    pivot.add(shin);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(female ? 0.15 : 0.2, 0.1, female ? 0.26 : 0.32),
      mat(boot),
    );
    // Character faces +Z — toes point forward
    foot.position.set(0, female ? -0.84 : -0.92, female ? 0.08 : 0.1);
    pivot.add(foot);
    return pivot;
  };
  rig.lLeg = mkLeg(-1);
  rig.rLeg = mkLeg(1);

  if (female) {
    root.scale.set(0.93, 0.95, 0.93);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(female ? 0.36 : 0.42, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.05;
  shadow.renderOrder = 1;
  root.add(shadow);

  root.userData.rig = rig;
  root.userData.shadow = shadow;
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
  if (armed && rig.machete) rig.machete.visible = false;
  if (armed) {
    rig.rArm.rotation.x = -1.15;
    rig.rArm.rotation.z = 0;
    rig.lArm.rotation.x = -0.85;
    rig.lArm.rotation.z = 0.35;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.35;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.5;
  } else {
    rig.rArm.rotation.x = 0.15;
    rig.rArm.rotation.z = 0.08;
    rig.lArm.rotation.x = 0.15;
    rig.lArm.rotation.z = -0.08;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.45;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.45;
  }
}

/** Show/hide the sidearm machete (used in execution sequences). */
export function setMachete(root, drawn) {
  const rig = root.userData.rig;
  if (!rig?.machete) return;
  rig.machete.visible = !!drawn;
  if (drawn && rig.gun) rig.gun.visible = false;
}

export function animatePerson(root, dt, speed, sprinting, distressed = false, freezeArms = false, swimming = false) {
  const rig = root.userData.rig;
  if (!rig || !rig.lLeg || !rig.rLeg || !rig.lArm || !rig.rArm) return;

  // Punch owns the full body (legs, hips/torso, arms, head) — leave it alone
  if (freezeArms) return;

  if (swimming) {
    const stroking = speed > 0.08;
    const cadence = stroking ? 11 : 7;
    root.userData.walk += dt * cadence * (stroking ? Math.min(1.35, 0.55 + speed / 5) : 0.65);
    const phase = root.userData.walk;

    // Flutter kick (stays under the surface)
    const kick = stroking ? 0.55 : 0.22;
    rig.lLeg.rotation.x = Math.sin(phase * 1.85) * kick;
    rig.rLeg.rotation.x = Math.sin(phase * 1.85 + Math.PI) * kick;

    // Freestyle strokes — arms break the surface on the recovery
    const r = phase;
    const l = phase + Math.PI;
    rig.rArm.rotation.x = -0.35 + Math.sin(r) * 1.15;
    rig.lArm.rotation.x = -0.35 + Math.sin(l) * 1.15;
    rig.rArm.rotation.z = 0.15 + Math.max(0, Math.cos(r)) * 0.7;
    rig.lArm.rotation.z = -0.15 - Math.max(0, Math.cos(l)) * 0.7;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.4 - Math.max(0, Math.sin(r)) * 0.75;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.4 - Math.max(0, Math.sin(l)) * 0.75;

    // Keep torso low; lift/turn the head to breathe
    rig.torso.rotation.y = Math.sin(phase * 0.9) * 0.12;
    rig.torso.rotation.x = -0.06;
    rig.torso.position.y = 0.95 + Math.sin(phase * 2) * 0.03;
    if (rig.head) {
      rig.head.rotation.y = Math.sin(phase * 0.5) * 0.65;
      rig.head.rotation.x = 0.7 + Math.sin(phase) * 0.12;
    }
    if (root.userData.shadow) root.userData.shadow.visible = false;
    return;
  }

  if (root.userData.shadow) root.userData.shadow.visible = true;

  // Clear residual swim torso pitch when back on land
  if (rig.torso.rotation.x && Math.abs(rig.torso.rotation.x) < 0.25) {
    rig.torso.rotation.x = 0;
  }

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
    if (rig.rElbow) rig.rElbow.rotation.x = -0.6 + Math.sin(phase * 2.5) * 0.4;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.6 + Math.sin(phase * 2.1) * 0.4;
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
      if (rig.rElbow) rig.rElbow.rotation.x = -0.35;
      if (rig.lElbow) rig.lElbow.rotation.x = -0.5;
    } else {
      rig.rArm.rotation.x = 0.15 + Math.sin(phase) * amp * 0.7;
      rig.lArm.rotation.x = 0.15 + Math.sin(phase + Math.PI) * amp * 0.7;
      rig.rArm.rotation.z = 0.08;
      rig.lArm.rotation.z = -0.08;
      if (rig.rElbow) rig.rElbow.rotation.x = -0.45 - Math.sin(phase) * amp * 0.25;
      if (rig.lElbow) rig.lElbow.rotation.x = -0.45 - Math.sin(phase + Math.PI) * amp * 0.25;
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
    if (o.userData.skipTint || !o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m?.color) continue;
      if (m.userData._base == null) m.userData._base = m.color.getHex();
      m.color.setHex(hex ?? m.userData._base);
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
export function createHealthBar(opts = {}) {
  const root = new THREE.Group();
  root.position.y = opts.y ?? 2.15;

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

export function updateHealthBar(bar, hp, maxHp, parentYaw = 0, parentPitch = 0) {
  if (!bar) return;
  const ratio = Math.max(0, Math.min(1, hp / Math.max(0.001, maxHp)));
  const injured = hp < maxHp - 0.001 && hp > 0;
  bar.visible = injured;
  if (!injured) return;
  const fill = bar.userData.fill;
  const w = bar.userData.fillWidth;
  fill.scale.x = Math.max(0.001, ratio);
  fill.position.x = -w * 0.5 * (1 - ratio);
  fill.material.color.setHex(ratio > 0.5 ? 0x3dffb5 : ratio > 0.25 ? 0xffc24a : 0xff5a4a);
  // Counter body yaw/pitch so the bar stays readable under the angled camera
  bar.rotation.set(-0.6 - parentPitch, -parentYaw, 0);
}
