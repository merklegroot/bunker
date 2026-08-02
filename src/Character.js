import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function shade(hex, amount) {
  const c = new THREE.Color(hex);
  if (amount >= 0) c.offsetHSL(0, 0, Math.min(0.35, amount));
  else c.offsetHSL(0, 0, Math.max(-0.45, amount));
  return c.getHex();
}

function box(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
}

function capsule(r, len, color, segs = 5) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.02, len), 2, segs), mat(color));
}

function sphere(r, color, w = 6, h = 5) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat(color));
}

function cyl(rt, rb, h, color, segs = 6) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segs), mat(color));
}

/**
 * Low-poly person with readable silhouette, face, and clothing detail.
 * Facing +Z locally after yaw.
 * opts.female — softer proportions + longer hair (civilians).
 * opts.muscular — broader chest, thicker limbs (leader).
 * opts.bald — no hair cap / back hair (skin all around the head).
 */
export function createPerson(palette, opts = {}) {
  const armed = opts.armed !== false;
  const female = !!opts.female;
  const muscular = !!opts.muscular && !female;
  const bald = !!opts.bald;
  const {
    skin = 0xd4a574,
    shirt = 0x3dffb5,
    pants = 0x2a3540,
    boot = 0x1a2228,
    hair = 0x1c1410,
    gun = 0x2a3038,
  } = palette;

  const skinDeep = shade(skin, -0.08);
  const skinLight = shade(skin, 0.06);
  const shirtDeep = shade(shirt, -0.1);
  const pantsDeep = shade(pants, -0.12);
  const hairDeep = shade(hair, -0.08);

  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const torsoBaseY = muscular ? 1.05 : female ? 0.92 : 0.96;
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
    muscular,
    bald,
    torsoBaseY,
  };

  const torso = new THREE.Group();
  torso.position.y = torsoBaseY;
  root.add(torso);
  rig.torso = torso;

  // —— Torso / clothing ——
  if (female) {
    const bust = box(0.46, 0.26, 0.32, shirt);
    bust.position.y = 0.34;
    torso.add(bust);
    const bustCurve = sphere(0.13, shade(shirt, 0.04), 5, 4);
    bustCurve.scale.set(1.55, 0.85, 1.15);
    bustCurve.position.set(0, 0.34, 0.08);
    torso.add(bustCurve);
    const waist = box(0.34, 0.26, 0.24, shirtDeep);
    waist.position.y = 0.1;
    torso.add(waist);
    const hips = box(0.54, 0.3, 0.3, pants);
    hips.position.y = -0.2;
    torso.add(hips);
    const hipCurve = capsule(0.14, 0.12, pants, 5);
    hipCurve.rotation.z = Math.PI / 2;
    hipCurve.scale.set(1, 1.6, 1.1);
    hipCurve.position.set(0, -0.22, 0);
    torso.add(hipCurve);
  } else if (muscular) {
    const traps = box(0.82, 0.22, 0.36, shirt);
    traps.position.y = 0.52;
    torso.add(traps);
    const deltsL = sphere(0.16, shirt, 5, 4);
    deltsL.position.set(-0.38, 0.42, 0);
    torso.add(deltsL);
    const deltsR = sphere(0.16, shirt, 5, 4);
    deltsR.position.set(0.38, 0.42, 0);
    torso.add(deltsR);
    const chest = box(0.7, 0.48, 0.38, shirt);
    chest.position.y = 0.18;
    torso.add(chest);
    const pecL = sphere(0.14, shade(shirt, 0.05), 5, 4);
    pecL.scale.set(1.2, 0.75, 0.7);
    pecL.position.set(-0.16, 0.28, 0.16);
    torso.add(pecL);
    const pecR = sphere(0.14, shade(shirt, 0.05), 5, 4);
    pecR.scale.set(1.2, 0.75, 0.7);
    pecR.position.set(0.16, 0.28, 0.16);
    torso.add(pecR);
    const abs = box(0.48, 0.34, 0.28, skin);
    abs.position.y = -0.2;
    torso.add(abs);
    // Abs suggestion
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        const pad = box(0.14, 0.08, 0.04, skinDeep);
        pad.position.set(col === 0 ? -0.09 : 0.09, -0.06 - row * 0.1, 0.14);
        torso.add(pad);
      }
    }
  } else {
    const shoulders = box(0.62, 0.16, 0.3, shirt);
    shoulders.position.y = 0.5;
    torso.add(shoulders);
    const chest = box(0.52, 0.58, 0.3, shirt);
    chest.position.y = 0.2;
    torso.add(chest);
    const mid = box(0.48, 0.2, 0.28, shirtDeep);
    mid.position.y = -0.12;
    torso.add(mid);
  }

  // Collar / neckline
  const collar = box(
    female ? 0.28 : muscular ? 0.36 : 0.3,
    0.06,
    female ? 0.26 : muscular ? 0.32 : 0.28,
    shade(shirt, 0.08),
  );
  collar.position.y = female ? 0.48 : muscular ? 0.62 : 0.56;
  torso.add(collar);

  // Belt
  const belt = box(
    female ? 0.5 : muscular ? 0.56 : 0.5,
    0.07,
    female ? 0.32 : muscular ? 0.34 : 0.3,
    shade(pants, -0.2),
  );
  belt.position.y = female ? -0.06 : muscular ? -0.38 : -0.22;
  torso.add(belt);
  const buckle = box(0.1, 0.08, 0.04, 0xc4b080);
  buckle.position.set(0, belt.position.y, female ? 0.17 : muscular ? 0.18 : 0.16);
  torso.add(buckle);

  // Neck
  const neck = cyl(
    female ? 0.07 : muscular ? 0.12 : 0.09,
    female ? 0.08 : muscular ? 0.13 : 0.1,
    female ? 0.14 : muscular ? 0.16 : 0.15,
    skin,
    6,
  );
  neck.position.y = female ? 0.56 : muscular ? 0.72 : 0.64;
  torso.add(neck);

  // —— Head + face ——
  const head = new THREE.Group();
  head.position.y = female ? 0.72 : muscular ? 0.9 : 0.8;
  torso.add(head);
  rig.head = head;

  const headR = female ? 0.155 : muscular ? 0.19 : 0.17;
  const skull = sphere(headR, skin, 7, 6);
  skull.scale.set(0.95, female ? 1.05 : 1.08, 1.0);
  head.add(skull);

  // Jaw / chin
  const jaw = box(
    female ? 0.2 : muscular ? 0.28 : 0.24,
    female ? 0.12 : muscular ? 0.16 : 0.14,
    female ? 0.18 : muscular ? 0.22 : 0.2,
    skinDeep,
  );
  jaw.position.set(0, female ? -0.12 : -0.14, 0.04);
  head.add(jaw);

  // Ears
  const earL = sphere(female ? 0.035 : 0.042, skinDeep, 4, 3);
  earL.position.set(-(headR * 0.92), 0.02, 0);
  head.add(earL);
  const earR = sphere(female ? 0.035 : 0.042, skinDeep, 4, 3);
  earR.position.set(headR * 0.92, 0.02, 0);
  head.add(earR);

  // Brows
  const browY = female ? 0.06 : 0.07;
  const brow = box(female ? 0.22 : 0.26, 0.03, 0.04, bald ? skinDeep : hairDeep);
  brow.position.set(0, browY, headR * 0.72);
  head.add(brow);

  // Eyes
  const eyeY = female ? 0.02 : 0.03;
  const eyeZ = headR * 0.78;
  const mkEye = (sx) => {
    const white = box(0.07, 0.05, 0.03, 0xf2f0ea);
    white.position.set(sx * 0.07, eyeY, eyeZ);
    head.add(white);
    const pupil = box(0.035, 0.035, 0.025, 0x1a1410);
    pupil.position.set(sx * 0.07, eyeY, eyeZ + 0.015);
    head.add(pupil);
  };
  mkEye(-1);
  mkEye(1);

  // Nose
  const nose = box(
    female ? 0.04 : 0.055,
    female ? 0.06 : 0.08,
    female ? 0.05 : 0.07,
    skinLight,
  );
  nose.position.set(0, female ? -0.02 : -0.02, headR * 0.9);
  head.add(nose);

  // Mouth
  const mouth = box(female ? 0.1 : 0.12, 0.025, 0.03, shade(skin, -0.18));
  mouth.position.set(0, female ? -0.1 : -0.12, headR * 0.75);
  head.add(mouth);

  // Hair — full cap so the scalp never peeks through the crown
  if (!bald) {
    const hairCap = sphere(headR * 1.08, hair, 7, 6);
    hairCap.scale.set(1.02, female ? 0.85 : 0.78, 1.04);
    hairCap.position.y = female ? 0.04 : 0.05;
    head.add(hairCap);
    // Solid crown plate (closes any low-poly sphere gap on top)
    const crown = box(headR * 1.5, female ? 0.1 : 0.12, headR * 1.5, hair);
    crown.position.y = female ? 0.14 : 0.15;
    head.add(crown);
    // Forelock / fringe
    const fringe = box(female ? 0.28 : 0.3, female ? 0.08 : 0.07, 0.1, hair);
    fringe.position.set(0, female ? 0.08 : 0.09, headR * 0.55);
    head.add(fringe);
    // Back of head coverage
    const hairNape = box(headR * 1.6, female ? 0.16 : 0.18, 0.1, hairDeep);
    hairNape.position.set(0, female ? -0.02 : 0, -headR * 0.7);
    head.add(hairNape);
    // Sideburns / temples
    const sideL = box(0.07, 0.16, 0.12, hairDeep);
    sideL.position.set(-headR * 0.88, -0.02, 0.02);
    head.add(sideL);
    const sideR = box(0.07, 0.16, 0.12, hairDeep);
    sideR.position.set(headR * 0.88, -0.02, 0.02);
    head.add(sideR);
  } else {
    // Bald shine patch
    const shine = sphere(headR * 0.35, shade(skin, 0.12), 4, 3);
    shine.position.set(0.04, 0.1, 0.02);
    head.add(shine);
  }

  if (female) {
    const hairBack = box(0.3, 0.9, 0.12, hair);
    hairBack.position.set(0, -0.35, -0.18);
    head.add(hairBack);
    const hairL = capsule(0.055, 0.55, hair, 4);
    hairL.position.set(-0.16, -0.28, -0.02);
    head.add(hairL);
    const hairR = capsule(0.055, 0.55, hair, 4);
    hairR.position.set(0.16, -0.28, -0.02);
    head.add(hairR);
    const hairTail = sphere(0.1, hairDeep, 5, 4);
    hairTail.scale.set(1.4, 1.8, 1);
    hairTail.position.set(0, -0.78, -0.16);
    head.add(hairTail);
  }

  // —— Arms ——
  const shoulderX = female ? 0.28 : muscular ? 0.46 : 0.36;
  const armR = female ? 0.055 : muscular ? 0.1 : 0.07;
  const mkArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * shoulderX, female ? 0.44 : muscular ? 0.55 : 0.5, 0);
    torso.add(shoulder);

    // Shoulder joint
    const ball = sphere(armR * 1.15, shirt, 5, 4);
    ball.position.set(0, 0, 0);
    shoulder.add(ball);

    const upperLen = female ? 0.22 : muscular ? 0.3 : 0.26;
    const upper = capsule(armR, upperLen, shirt, 5);
    upper.position.y = -(upperLen * 0.5 + armR * 0.3);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -(upperLen + armR * 0.55);
    shoulder.add(elbow);

    const joint = sphere(armR * 0.95, skin, 4, 3);
    elbow.add(joint);

    const foreLen = female ? 0.2 : muscular ? 0.26 : 0.24;
    // Short sleeves: forearm is skin
    const forearm = capsule(armR * 0.9, foreLen, skin, 5);
    forearm.position.y = -(foreLen * 0.5 + armR * 0.2);
    elbow.add(forearm);

    // Sleeve cuff
    const cuff = cyl(armR * 1.05, armR * 1.05, 0.06, shirtDeep, 5);
    cuff.position.y = -0.02;
    elbow.add(cuff);

    const hand = new THREE.Group();
    hand.position.y = -(foreLen + armR * 0.55);
    elbow.add(hand);
    const palm = box(
      female ? 0.09 : muscular ? 0.14 : 0.11,
      female ? 0.1 : muscular ? 0.14 : 0.12,
      female ? 0.06 : muscular ? 0.09 : 0.07,
      skin,
    );
    hand.add(palm);
    const thumb = box(
      female ? 0.035 : 0.045,
      female ? 0.06 : 0.07,
      female ? 0.035 : 0.045,
      skinDeep,
    );
    thumb.position.set(side * 0.05, 0.02, 0.03);
    thumb.rotation.z = side * 0.5;
    hand.add(thumb);

    elbow.rotation.x = -0.45;
    return { shoulder, elbow };
  };
  const left = mkArm(-1);
  const right = mkArm(1);
  rig.lArm = left.shoulder;
  rig.rArm = right.shoulder;
  rig.lElbow = left.elbow;
  rig.rElbow = right.elbow;

  // —— Gun ——
  const gunRoot = new THREE.Group();
  gunRoot.position.set(0.08, -0.12, -0.05);
  right.elbow.add(gunRoot);
  rig.gun = gunRoot;

  const stock = box(0.1, 0.14, 0.28, gun);
  stock.position.set(0, 0, 0.06);
  gunRoot.add(stock);
  const barrel = box(0.08, 0.08, 0.55, 0x4a5560);
  barrel.position.set(0, 0.02, -0.32);
  gunRoot.add(barrel);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -0.62);
  gunRoot.add(muzzle);
  rig.muzzle = muzzle;

  // —— Machete ——
  const macheteRoot = new THREE.Group();
  macheteRoot.position.set(0.02, muscular ? -0.36 : -0.32, 0.04);
  right.elbow.add(macheteRoot);
  rig.machete = macheteRoot;
  const mHandle = box(0.07, 0.16, 0.07, 0x3a2818);
  mHandle.position.set(0, 0.02, 0);
  macheteRoot.add(mHandle);
  const mGuard = box(0.14, 0.04, 0.08, 0x6a6050);
  mGuard.position.set(0, -0.08, 0);
  macheteRoot.add(mGuard);
  const mBlade = box(0.05, muscular ? 0.68 : 0.58, muscular ? 0.16 : 0.14, 0xb0b8c0);
  mBlade.position.set(0.01, muscular ? -0.46 : -0.4, 0.02);
  macheteRoot.add(mBlade);
  const macheteTip = new THREE.Object3D();
  macheteTip.position.set(0.01, muscular ? -0.82 : -0.72, 0.02);
  macheteRoot.add(macheteTip);
  rig.macheteTip = macheteTip;
  macheteRoot.visible = false;

  // —— Legs ——
  const legX = female ? 0.14 : muscular ? 0.18 : 0.15;
  const thighR = female ? 0.09 : muscular ? 0.13 : 0.1;
  const mkLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * legX, torsoBaseY, 0);
    root.add(pivot);

    const thighLen = female ? 0.32 : muscular ? 0.38 : 0.36;
    const thigh = capsule(
      female ? 0.095 : muscular ? 0.135 : thighR,
      thighLen,
      pants,
      5,
    );
    thigh.position.y = -(thighLen * 0.5 + 0.04);
    pivot.add(thigh);

    const knee = sphere(thighR * 0.85, pantsDeep, 4, 3);
    knee.position.y = -(thighLen + 0.06);
    pivot.add(knee);

    const shinLen = female ? 0.3 : muscular ? 0.36 : 0.34;
    const shin = capsule(
      female ? 0.075 : muscular ? 0.105 : 0.085,
      shinLen,
      pantsDeep,
      5,
    );
    shin.position.y = -(thighLen + 0.1 + shinLen * 0.5);
    pivot.add(shin);

    // Boot
    const bootH = 0.16;
    const bootMesh = box(
      female ? 0.14 : muscular ? 0.22 : 0.18,
      bootH,
      female ? 0.28 : muscular ? 0.36 : 0.32,
      boot,
    );
    const footY = -(thighLen + shinLen + 0.22);
    bootMesh.position.set(0, footY, female ? 0.06 : 0.08);
    pivot.add(bootMesh);
    const toe = box(
      female ? 0.12 : muscular ? 0.18 : 0.15,
      0.08,
      female ? 0.12 : 0.14,
      shade(boot, 0.06),
    );
    toe.position.set(0, footY - 0.02, female ? 0.18 : 0.22);
    pivot.add(toe);

    return pivot;
  };
  rig.lLeg = mkLeg(-1);
  rig.rLeg = mkLeg(1);

  if (female) {
    root.scale.set(0.94, 0.96, 0.94);
  } else if (muscular) {
    root.scale.set(1.16, 1.2, 1.16);
  }

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(female ? 0.34 : muscular ? 0.52 : 0.4, 20),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
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

function torsoY(rig) {
  return rig.torsoBaseY ?? 0.95;
}

export function animatePerson(root, dt, speed, sprinting, distressed = false, freezeArms = false, swimming = false) {
  const rig = root.userData.rig;
  if (!rig || !rig.lLeg || !rig.rLeg || !rig.lArm || !rig.rArm) return;

  // Punch owns the full body (legs, hips/torso, arms, head) — leave it alone
  if (freezeArms) return;

  const baseY = torsoY(rig);

  if (swimming) {
    const stroking = speed > 0.08;
    const cadence = stroking ? 11 : 7;
    root.userData.walk += dt * cadence * (stroking ? Math.min(1.35, 0.55 + speed / 5) : 0.65);
    const phase = root.userData.walk;

    const kick = stroking ? 0.55 : 0.22;
    rig.lLeg.rotation.x = Math.sin(phase * 1.85) * kick;
    rig.rLeg.rotation.x = Math.sin(phase * 1.85 + Math.PI) * kick;

    const r = phase;
    const l = phase + Math.PI;
    rig.rArm.rotation.x = -0.35 + Math.sin(r) * 1.15;
    rig.lArm.rotation.x = -0.35 + Math.sin(l) * 1.15;
    rig.rArm.rotation.z = 0.15 + Math.max(0, Math.cos(r)) * 0.7;
    rig.lArm.rotation.z = -0.15 - Math.max(0, Math.cos(l)) * 0.7;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.4 - Math.max(0, Math.sin(r)) * 0.75;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.4 - Math.max(0, Math.sin(l)) * 0.75;

    rig.torso.rotation.y = Math.sin(phase * 0.9) * 0.12;
    rig.torso.rotation.x = -0.06;
    rig.torso.position.y = baseY + Math.sin(phase * 2) * 0.03;
    if (rig.head) {
      rig.head.rotation.y = Math.sin(phase * 0.5) * 0.65;
      rig.head.rotation.x = 0.7 + Math.sin(phase) * 0.12;
    }
    if (root.userData.shadow) root.userData.shadow.visible = false;
    return;
  }

  if (root.userData.shadow) root.userData.shadow.visible = true;

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
    rig.rArm.rotation.x = -1.6 + Math.sin(phase * 3.1) * 0.9;
    rig.lArm.rotation.x = -1.4 + Math.sin(phase * 2.7 + 1.2) * 0.9;
    rig.rArm.rotation.z = 0.55 + Math.sin(phase * 2.2) * 0.45;
    rig.lArm.rotation.z = -0.55 + Math.sin(phase * 2.4 + 0.8) * 0.45;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.6 + Math.sin(phase * 2.5) * 0.4;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.6 + Math.sin(phase * 2.1) * 0.4;
    if (rig.head) rig.head.rotation.y = Math.sin(phase * 2.8) * 0.45;
    if (rig.head) rig.head.rotation.x = Math.sin(phase * 3.5) * 0.2;
    rig.torso.rotation.y = Math.sin(phase * 1.6) * 0.22;
    rig.torso.position.y = baseY + Math.abs(Math.sin(phase * 2)) * 0.08;
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
    rig.torso.position.y = baseY + (moving ? Math.abs(Math.sin(phase)) * 0.04 : 0);
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
  bar.rotation.set(-0.6 - parentPitch, -parentYaw, 0);
}
