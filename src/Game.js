import * as THREE from 'three';
import { Input } from './Input.js';
import {
  createPerson, animatePerson, muzzleWorld, setTint, clearTint, setArmed,
  createHealthBar, updateHealthBar,
} from './Character.js';
import {
  buildLevelSpec,
  buildLevelMeshes,
  resolveCircle,
  hasLineOfSight,
  segmentHitsWall,
} from './Level.js';

const WALK_SPEED = 5.2;
const RUN_SPEED = 8.2;
const MAX_STAMINA = 1;
const STAMINA_DRAIN = 0.26;
const STAMINA_REGEN = 0.34;
const STAMINA_REGEN_IDLE = 0.48;
const STAMINA_REGEN_DELAY = 0.65;
const STAMINA_EXHAUST_DELAY = 1.2;
const PLAYER_RADIUS = 0.4;
const BULLET_SPEED = 28;
const ENEMY_BULLET_SPEED = 11;
const FIRE_RATE = 0.16;
const MAX_HP = 6;
const VIEW_NEAR = 8;
const VIEW_FAR = 20;
const STAIRS_USE_RANGE = 1.35;
const BULLET_KNOCKBACK = 0.28;

const COL = {
  playerBullet: 0xe8f0f4,
  enemyBullet: 0xff6a4a,
  muzzle: 0xffc24a,
  gold: 0xffd24a,
  potion: 0x3dffb5,
  power: 0x7a9dff,
  blood: 0x8a3030,
};

const PLAYER_COLORS = {
  skin: 0xd4a574,
  shirt: 0xc45a2a,
  pants: 0x2a2420,
  boot: 0x151210,
  hair: 0x2a1e14,
  gun: 0x2a3038,
};

const ENEMY_KINDS = {
  slime: {
    name: 'slime',
    hp: 6,
    speed: 2.4,
    radius: 0.4,
    damage: 1,
    score: 8,
    aggro: 10,
    melee: true,
    shoot: false,
    colors: {
      skin: 0x5a9a4a, shirt: 0x3a7a3a, pants: 0x2a5a2a,
      boot: 0x1a3a1a, hair: 0x2a4a2a, gun: 0x2a3038,
    },
  },
  rat: {
    name: 'rat',
    hp: 4,
    speed: 5.2,
    radius: 0.32,
    damage: 1,
    score: 6,
    aggro: 12,
    melee: true,
    shoot: false,
    colors: {
      skin: 0x6a5a4a, shirt: 0x4a3a30, pants: 0x3a2e28,
      boot: 0x1a1410, hair: 0x2a2018, gun: 0x2a3038,
    },
  },
  goblin: {
    name: 'goblin',
    hp: 10,
    speed: 3.6,
    radius: 0.38,
    damage: 1,
    score: 15,
    aggro: 14,
    melee: true,
    shoot: true,
    shootRange: 11,
    fireRate: 1.4,
    colors: {
      skin: 0x5a8a3a, shirt: 0x4a3a28, pants: 0x2a2820,
      boot: 0x151410, hair: 0x1a2210, gun: 0x2a3038,
    },
  },
  skeleton: {
    name: 'skeleton',
    hp: 14,
    speed: 3.2,
    radius: 0.38,
    damage: 1,
    score: 22,
    aggro: 16,
    melee: false,
    shoot: true,
    shootRange: 14,
    fireRate: 1.1,
    colors: {
      skin: 0xd8d0c0, shirt: 0xc8c0b0, pants: 0xb0a898,
      boot: 0x908878, hair: 0xe8e0d0, gun: 0x4a4550,
    },
  },
  brute: {
    name: 'brute',
    hp: 28,
    speed: 2.6,
    radius: 0.5,
    damage: 2,
    score: 40,
    aggro: 12,
    melee: true,
    shoot: false,
    colors: {
      skin: 0x8a5040, shirt: 0x5a3028, pants: 0x3a2820,
      boot: 0x1a1210, hair: 0x2a1810, gun: 0x2a3038,
    },
  },
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function makeMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

function pickEnemyKind(depth) {
  const roll = Math.random();
  if (depth <= 1) return roll < 0.55 ? 'slime' : 'rat';
  if (depth === 2) {
    if (roll < 0.35) return 'slime';
    if (roll < 0.7) return 'rat';
    return 'goblin';
  }
  if (depth <= 4) {
    if (roll < 0.25) return 'rat';
    if (roll < 0.6) return 'goblin';
    if (roll < 0.85) return 'skeleton';
    return 'brute';
  }
  if (roll < 0.15) return 'goblin';
  if (roll < 0.5) return 'skeleton';
  if (roll < 0.8) return 'brute';
  return 'goblin';
}

function createFogMask(mapSize) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uOrigin: { value: new THREE.Vector2(0, 0) },
      uNear: { value: VIEW_NEAR },
      uFar: { value: VIEW_FAR },
      uDark: { value: new THREE.Color(0x08060a) },
    },
    vertexShader: /* glsl */`
      varying vec2 vWorldXZ;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldXZ = wp.xz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec2 uOrigin;
      uniform float uNear;
      uniform float uFar;
      uniform vec3 uDark;
      varying vec2 vWorldXZ;

      void main() {
        float dist = length(vWorldXZ - uOrigin);
        float fog = smoothstep(uNear, uFar, dist);
        float alpha = fog * 0.96;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uDark, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(mapSize * 1.6, mapSize * 1.6),
    mat,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.07, 0);
  mesh.renderOrder = 10;
  mesh.frustumCulled = false;
  return mesh;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.gold = 0;
    this.depth = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.fireCd = 0;
    this.damage = 2;
    this.fireRate = FIRE_RATE;
    this.nearStairs = false;

    this.bullets = [];
    this.enemies = [];
    this.items = [];
    this.fx = [];
    this._levelRoot = null;

    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._hit = new THREE.Vector3();
    this._aim = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
    this._moveSpeed = 0;
    this._pos = { x: 0, z: 0 };

    this.level = buildLevelSpec(1);

    this._initThree();
    this._levelRoot = new THREE.Group();
    this.world.add(this._levelRoot);
    buildLevelMeshes(this._levelRoot, this.level);
    this.fogMask = createFogMask(this.level.MAP);
    this.world.add(this.fogMask);
    this._buildPlayer();
    this._bindUi();
    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._last = performance.now();
    requestAnimationFrame((t) => this._frame(t));
  }

  _initThree() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x08060a, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 140);
    this._camOffset = new THREE.Vector3(0, 28, 20);
    this.camera.position.copy(this._camOffset);
    this.camera.lookAt(0, 0, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);
  }

  _buildPlayer() {
    this.player = createPerson(PLAYER_COLORS, { armed: true });
    this.world.add(this.player);
    this.player.position.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.playerAlive = true;
    this.sprinting = false;
  }

  _bindUi() {
    this.el = {
      overlay: document.getElementById('overlay'),
      title: document.getElementById('title'),
      subtitle: document.getElementById('subtitle'),
      startBtn: document.getElementById('startBtn'),
      resumeBtn: document.getElementById('resumeBtn'),
      restartBtn: document.getElementById('restartBtn'),
      finalScore: document.getElementById('finalScore'),
      score: document.getElementById('score'),
      floor: document.getElementById('floor'),
      gold: document.getElementById('gold'),
      enemies: document.getElementById('enemies'),
      hp: document.getElementById('hp'),
      stamina: document.getElementById('stamina'),
      staminaFill: document.getElementById('staminaFill'),
      prompt: document.getElementById('prompt'),
    };
    this.el.startBtn.addEventListener('click', () => this.start());
    this.el.resumeBtn.addEventListener('click', () => this.resume());
    this.el.restartBtn.addEventListener('click', () => this.start());
    this._renderHp();
    this._renderStamina();

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.paused) this.resume();
        else if (this.running && this.playerAlive) this.pause();
        return;
      }
      if ((e.code === 'KeyE' || e.code === 'Space') && this.running && !this.paused) {
        if (this.nearStairs) {
          e.preventDefault();
          this._descend();
        }
      }
    });
  }

  _showMenu({ title, subtitle, finalScore = null, mode }) {
    this.el.title.textContent = title;
    this.el.subtitle.textContent = subtitle;
    if (finalScore != null) {
      this.el.finalScore.textContent = finalScore;
      this.el.finalScore.classList.remove('hidden');
    } else {
      this.el.finalScore.classList.add('hidden');
    }

    const start = mode === 'title' || mode === 'end';
    const pause = mode === 'pause';
    this.el.startBtn.classList.toggle('hidden', !start);
    this.el.resumeBtn.classList.toggle('hidden', !pause);
    this.el.restartBtn.classList.toggle('hidden', !pause && mode !== 'end');
    if (mode === 'title') {
      this.el.startBtn.textContent = 'DESCEND';
      this.el.restartBtn.classList.add('hidden');
    } else if (mode === 'end') {
      this.el.startBtn.textContent = 'AGAIN';
      this.el.restartBtn.classList.add('hidden');
    }
    this.el.overlay.classList.add('on');
  }

  _clearEntities() {
    for (const b of this.bullets) this.world.remove(b.mesh);
    for (const e of this.enemies) this.world.remove(e.mesh);
    for (const it of this.items) this.world.remove(it.mesh);
    for (const f of this.fx) this.world.remove(f.mesh);
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.items.length = 0;
    this.fx.length = 0;
  }

  start() {
    this._clearEntities();

    this.score = 0;
    this.gold = 0;
    this.depth = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.damage = 2;
    this.fireRate = FIRE_RATE;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.fireCd = 0;
    this.nearStairs = false;
    this.paused = false;
    this.running = true;
    this.time = 0;
    this.playerAlive = true;
    this.player.visible = true;
    clearTint(this.player);

    this._loadFloor(1);

    this.input.keys.clear();
    this.input.mouse.down = false;
    this.el.overlay.classList.remove('on');
    this.el.finalScore.classList.add('hidden');
    this._renderHp();
    this._renderStamina();
    this._renderHud();
  }

  _loadFloor(depth) {
    this._clearEntities();
    this.depth = depth;
    this.level = buildLevelSpec(depth);
    buildLevelMeshes(this._levelRoot, this.level);

    this.world.remove(this.fogMask);
    this.fogMask = createFogMask(this.level.MAP);
    this.world.add(this.fogMask);

    this.player.position.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.player.rotation.y = 0;
    setArmed(this.player, true);

    const enemyCount = Math.min(28, 4 + depth * 3 + Math.floor(Math.random() * 3));
    const spots = [...this.level.spawnPoints];
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    for (let i = 0; i < enemyCount && i < spots.length; i++) {
      this._spawnEnemy(spots[i].x, spots[i].z, pickEnemyKind(depth));
    }

    const lootCount = Math.min(8, 2 + Math.floor(depth / 2) + Math.floor(Math.random() * 3));
    const lootSpots = [...this.level.lootPoints];
    for (let i = lootSpots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lootSpots[i], lootSpots[j]] = [lootSpots[j], lootSpots[i]];
    }
    for (let i = 0; i < lootCount && i < lootSpots.length; i++) {
      const roll = Math.random();
      let kind = 'gold';
      if (roll < 0.28) kind = 'potion';
      else if (roll < 0.4 && depth >= 2) kind = 'power';
      this._spawnItem(lootSpots[i].x, lootSpots[i].z, kind);
    }

    this.nearStairs = false;
    this._renderHud();
  }

  _descend() {
    if (!this.running || !this.playerAlive) return;
    this.score += 50 + this.depth * 10;
    this._spark(this.level.stairsPos.x, this.level.stairsPos.z, 0x4ad4ff, 16, 0.5, 0.8);
    this._loadFloor(this.depth + 1);
  }

  pause() {
    if (!this.running || !this.playerAlive || this.paused) return;
    this.paused = true;
    this.input.keys.clear();
    this.input.mouse.down = false;
    this._showMenu({
      title: 'PAUSED',
      subtitle: 'The depths can wait.',
      mode: 'pause',
    });
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.input.keys.clear();
    this.input.mouse.down = false;
    this.el.overlay.classList.remove('on');
  }

  gameOver() {
    this.running = false;
    this.paused = false;
    this.playerAlive = false;
    this.player.visible = false;
    this._showMenu({
      title: 'SLAIN',
      subtitle: 'Permadeath. The dungeon keeps your bones.',
      finalScore: `FLOOR  ${this.depth}   ·   GOLD  ${this.gold}   ·   SCORE  ${this.score}`,
      mode: 'end',
    });
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const viewH = 22;
    const viewW = viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
  }

  _aimPoint() {
    this._ray.setFromCamera(this.input._ndc, this.camera);
    if (this._ray.ray.intersectPlane(this._plane, this._hit)) {
      this._aim.copy(this._hit);
    }
    return this._aim;
  }

  _frame(now) {
    const dt = Math.min(0.033, (now - this._last) / 1000);
    this._last = now;
    if (this.paused) this._updateCamera();
    else if (this.running) this.update(dt);
    else this._idleFx(dt);
    this.render();
    requestAnimationFrame((t) => this._frame(t));
  }

  _idleFx(dt) {
    this.time += dt;
    this._updateFx(dt);
    animatePerson(this.player, dt, 0, false);
    const focus = new THREE.Vector3(
      this.level.playerSpawn.x + Math.sin(this.time * 0.2) * 1.5,
      0,
      this.level.playerSpawn.z + Math.cos(this.time * 0.15) * 1.5,
    );
    this.camera.position.set(
      focus.x + this._camOffset.x,
      this._camOffset.y,
      focus.z + this._camOffset.z,
    );
    this.camera.lookAt(focus);
    this._updateFogMask(focus.x, focus.z);
    if (this.level.stairsMesh) {
      this.level.stairsMesh.rotation.y = this.time * 0.6;
    }
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 4);

    if (this.playerAlive) this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateEnemies(dt);
    this._updateItems(dt);
    this._updateFx(dt);
    this._updateCamera();
    this._renderHud();

    if (this.level.stairsMesh) {
      this.level.stairsMesh.rotation.y = this.time * 0.8;
    }
  }

  _updateFogMask(x, z) {
    this.fogMask.material.uniforms.uOrigin.value.set(x, z);
  }

  _updateCamera() {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    let ox = this._camOffset.x;
    let oz = this._camOffset.z;
    if (this.shake > 0) {
      ox += (Math.random() - 0.5) * this.shake * 0.5;
      oz += (Math.random() - 0.5) * this.shake * 0.5;
    }
    this.camera.position.set(px + ox, this._camOffset.y, pz + oz);
    this.camera.lookAt(px, 0, pz);
    this._updateFogMask(px, pz);
  }

  _updatePlayer(dt) {
    const axis = this.input.axis();
    const moving = Math.hypot(axis.x, axis.y) > 0.01;
    const wantSprint = this.input.keys.has('ShiftLeft') || this.input.keys.has('ShiftRight');

    this.staminaRegenCd = Math.max(0, this.staminaRegenCd - dt);
    this.sprinting = wantSprint && moving && this.stamina > 0;
    if (this.sprinting) {
      this.stamina = Math.max(0, this.stamina - STAMINA_DRAIN * dt);
      this.staminaRegenCd = STAMINA_REGEN_DELAY;
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.sprinting = false;
        this.staminaRegenCd = STAMINA_EXHAUST_DELAY;
      }
    } else if (this.staminaRegenCd <= 0 && this.stamina < MAX_STAMINA) {
      const rate = moving ? STAMINA_REGEN : STAMINA_REGEN_IDLE;
      this.stamina = Math.min(MAX_STAMINA, this.stamina + rate * dt);
    }

    const speed = this.sprinting ? RUN_SPEED : WALK_SPEED;
    this.player.position.x += axis.x * speed * dt;
    this.player.position.z += axis.y * speed * dt;

    this._pos.x = this.player.position.x;
    this._pos.z = this.player.position.z;
    resolveCircle(this._pos, PLAYER_RADIUS, this.level.walls);
    this.player.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
    this.player.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);

    const aim = this._aimPoint();
    const dx = aim.x - this.player.position.x;
    const dz = aim.z - this.player.position.z;
    if (dx * dx + dz * dz > 0.001) {
      this.player.rotation.y = Math.atan2(dx, dz);
    }

    this._moveSpeed = moving ? speed : 0;
    animatePerson(this.player, dt, this._moveSpeed, this.sprinting);
    this._renderStamina();

    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.input.mouse.down && this.fireCd <= 0) {
      this._firePlayer(dx, dz);
      this.fireCd = this.fireRate;
    }

    const sd = Math.hypot(
      this.player.position.x - this.level.stairsPos.x,
      this.player.position.z - this.level.stairsPos.z,
    );
    this.nearStairs = sd < STAIRS_USE_RANGE;
    if (this.el.prompt) {
      this.el.prompt.classList.toggle('on', this.nearStairs);
    }
  }

  _firePlayer(aimX, aimZ) {
    const len = Math.hypot(aimX, aimZ) || 1;
    const dirX = aimX / len;
    const dirZ = aimZ / len;

    this.player.updateMatrixWorld(true);
    muzzleWorld(this.player, this._muzzle);

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.42),
      makeMat(COL.playerBullet),
    );
    mesh.position.copy(this._muzzle);
    mesh.rotation.y = Math.atan2(dirX, dirZ);
    this.world.add(mesh);

    this.bullets.push({
      mesh,
      vx: dirX * BULLET_SPEED,
      vz: dirZ * BULLET_SPEED,
      life: 1.1,
      team: 'player',
      r: 0.14,
      damage: this.damage,
    });

    this._spark(this._muzzle.x, this._muzzle.z, COL.muzzle, 3, 0.16, this._muzzle.y);
  }

  _spawnEnemy(x, z, kindKey) {
    const def = ENEMY_KINDS[kindKey] || ENEMY_KINDS.slime;
    const depthScale = 1 + (this.depth - 1) * 0.12;

    this._pos.x = x;
    this._pos.z = z;
    resolveCircle(this._pos, def.radius, this.level.walls);
    x = this._pos.x;
    z = this._pos.z;

    const mesh = createPerson(def.colors, { armed: !!def.shoot });
    setArmed(mesh, !!def.shoot);
    mesh.position.set(x, 0, z);
    if (kindKey === 'slime') mesh.scale.setScalar(0.85);
    if (kindKey === 'rat') mesh.scale.set(0.75, 0.65, 0.9);
    if (kindKey === 'brute') mesh.scale.setScalar(1.25);

    const hpBar = createHealthBar();
    mesh.add(hpBar);
    this.world.add(mesh);

    this.enemies.push({
      mesh,
      hpBar,
      kind: kindKey,
      r: def.radius * (kindKey === 'brute' ? 1.15 : 1),
      hp: Math.round(def.hp * depthScale),
      maxHp: Math.round(def.hp * depthScale),
      speed: def.speed + Math.random() * 0.3,
      damage: def.damage,
      score: def.score + this.depth * 2,
      aggro: def.aggro,
      melee: def.melee,
      shoot: def.shoot,
      shootRange: def.shootRange || 10,
      fireRate: def.fireRate || 1.2,
      hitFlash: 0,
      biteCd: 0.3 + Math.random() * 0.4,
      shootCd: 0.5 + Math.random(),
      wander: Math.random() * Math.PI * 2,
      alert: false,
    });
  }

  _spawnItem(x, z, kind) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let color = COL.gold;
    let geo;
    if (kind === 'gold') {
      color = COL.gold;
      geo = new THREE.BoxGeometry(0.35, 0.2, 0.35);
    } else if (kind === 'potion') {
      color = COL.potion;
      geo = new THREE.CylinderGeometry(0.14, 0.18, 0.45, 6);
    } else {
      color = COL.power;
      geo = new THREE.OctahedronGeometry(0.28, 0);
    }

    const mesh = new THREE.Mesh(geo, makeMat(color));
    mesh.position.y = kind === 'gold' ? 0.25 : 0.4;
    group.add(mesh);

    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.04;
    group.add(glow);

    this.world.add(group);
    this.items.push({
      mesh: group,
      bob: mesh,
      kind,
      r: 0.55,
      value: kind === 'gold' ? 5 + Math.floor(Math.random() * 8) + this.depth : 1,
      phase: Math.random() * Math.PI * 2,
    });
  }

  _updateItems(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.phase += dt * 2.5;
      if (it.bob) {
        it.bob.position.y = (it.kind === 'gold' ? 0.25 : 0.4) + Math.sin(it.phase) * 0.12;
        it.bob.rotation.y += dt * 1.8;
      }

      if (!this.playerAlive) continue;
      const d = Math.hypot(it.mesh.position.x - px, it.mesh.position.z - pz);
      if (d > it.r + PLAYER_RADIUS) continue;

      this._pickup(it);
      this.world.remove(it.mesh);
      this.items.splice(i, 1);
    }
  }

  _pickup(it) {
    if (it.kind === 'gold') {
      this.gold += it.value;
      this.score += it.value;
      this._spark(it.mesh.position.x, it.mesh.position.z, COL.gold, 8, 0.3, 0.5);
    } else if (it.kind === 'potion') {
      const heal = 2;
      this.hp = Math.min(this.maxHp, this.hp + heal);
      this._renderHp();
      this._spark(it.mesh.position.x, it.mesh.position.z, COL.potion, 10, 0.35, 0.6);
    } else if (it.kind === 'power') {
      this.damage = Math.min(6, this.damage + 1);
      this.fireRate = Math.max(0.09, this.fireRate - 0.015);
      this.score += 15;
      this._spark(it.mesh.position.x, it.mesh.position.z, COL.power, 12, 0.4, 0.7);
    }
  }

  _updateEnemies(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.biteCd = Math.max(0, e.biteCd - dt);
      e.shootCd = Math.max(0, e.shootCd - dt);

      if (e.hitFlash > 0) setTint(e.mesh, 0xffffff);
      else clearTint(e.mesh);

      const dx = px - e.mesh.position.x;
      const dz = pz - e.mesh.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const sees = this.playerAlive
        && dist < e.aggro
        && hasLineOfSight(e.mesh.position.x, e.mesh.position.z, px, pz, this.level.walls);

      if (sees) e.alert = true;
      if (!this.playerAlive) e.alert = false;

      let mx = 0;
      let mz = 0;
      let moveSpeed = 0;

      if (e.alert && this.playerAlive) {
        const nx = dx / dist;
        const nz = dz / dist;
        e.mesh.rotation.y = Math.atan2(nx, nz);

        const prefer = e.shoot ? (e.shootRange * 0.55) : 0.7;
        if (e.shoot && dist < prefer - 1.2) {
          mx = -nx;
          mz = -nz;
        } else if (dist > prefer + 0.4) {
          mx = nx;
          mz = nz;
        } else if (e.shoot) {
          mx = -nz;
          mz = nx;
        }

        if (e.shoot && e.shootCd <= 0 && dist < e.shootRange && sees) {
          e.shootCd = e.fireRate + Math.random() * 0.35;
          const spread = (Math.random() - 0.5) * 0.18;
          const c = Math.cos(spread);
          const s = Math.sin(spread);
          this._enemyShoot(e, nx * c - nz * s, nx * s + nz * c);
        }

        if (e.melee && e.biteCd <= 0 && dist < e.r + PLAYER_RADIUS + 0.35) {
          e.biteCd = 0.9 + Math.random() * 0.3;
          this._hurt(e.damage);
          this._spark(px, pz, COL.blood, 6, 0.28, 1.0);
        }
      } else {
        e.wander += dt * (0.6 + Math.random() * 0.4);
        mx = Math.sin(e.wander);
        mz = Math.cos(e.wander * 0.7);
        if (Math.hypot(mx, mz) > 0.1) {
          e.mesh.rotation.y = Math.atan2(mx, mz);
        }
      }

      // Separation
      for (let j = 0; j < this.enemies.length; j++) {
        if (j === i) continue;
        const o = this.enemies[j];
        const sx = e.mesh.position.x - o.mesh.position.x;
        const sz = e.mesh.position.z - o.mesh.position.z;
        const sd = Math.hypot(sx, sz);
        const min = e.r + o.r + 0.15;
        if (sd > 0 && sd < min) {
          mx += (sx / sd) * 1.5;
          mz += (sz / sd) * 1.5;
        }
      }

      const mLen = Math.hypot(mx, mz);
      if (mLen > 0.05) {
        mx /= mLen;
        mz /= mLen;
        moveSpeed = e.alert ? e.speed : e.speed * 0.35;
        e.mesh.position.x += mx * moveSpeed * dt;
        e.mesh.position.z += mz * moveSpeed * dt;
      }

      this._pos.x = e.mesh.position.x;
      this._pos.z = e.mesh.position.z;
      resolveCircle(this._pos, e.r, this.level.walls);
      e.mesh.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
      e.mesh.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);

      animatePerson(e.mesh, dt, moveSpeed, e.alert && moveSpeed > 3.5);
      updateHealthBar(e.hpBar, e.hp, e.maxHp, e.mesh.rotation.y);
    }
  }

  _enemyShoot(e, dx, dz) {
    e.mesh.updateMatrixWorld(true);
    muzzleWorld(e.mesh, this._muzzle);
    if (!e.shoot) {
      this._muzzle.set(e.mesh.position.x, 1.0, e.mesh.position.z);
    }

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      makeMat(COL.enemyBullet),
    );
    mesh.position.copy(this._muzzle);
    this.world.add(mesh);
    this.bullets.push({
      mesh,
      vx: dx * ENEMY_BULLET_SPEED,
      vz: dz * ENEMY_BULLET_SPEED,
      life: 1.8,
      team: 'enemy',
      r: 0.15,
      damage: e.damage,
    });
    this._spark(this._muzzle.x, this._muzzle.z, COL.enemyBullet, 2, 0.12, this._muzzle.y);
  }

  _knockback(mesh, radius, vx, vz, amount = BULLET_KNOCKBACK) {
    const len = Math.hypot(vx, vz) || 1;
    mesh.position.x += (vx / len) * amount;
    mesh.position.z += (vz / len) * amount;
    this._pos.x = mesh.position.x;
    this._pos.z = mesh.position.z;
    resolveCircle(this._pos, radius, this.level.walls);
    mesh.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
    mesh.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const prevX = b.mesh.position.x;
      const prevZ = b.mesh.position.z;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.z += b.vz * dt;
      b.life -= dt;

      const hitWall = segmentHitsWall(
        prevX, prevZ,
        b.mesh.position.x, b.mesh.position.z,
        this.level.walls,
        0.05,
      );

      const out = Math.abs(b.mesh.position.x) > this.level.HALF + 2
        || Math.abs(b.mesh.position.z) > this.level.HALF + 2
        || b.life <= 0
        || hitWall;

      if (out) {
        if (hitWall) this._spark(b.mesh.position.x, b.mesh.position.z, 0x6a6050, 3, 0.12, 1.0);
        this.world.remove(b.mesh);
        this.bullets.splice(i, 1);
        continue;
      }

      if (b.team === 'player') {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          const dx = b.mesh.position.x - e.mesh.position.x;
          const dz = b.mesh.position.z - e.mesh.position.z;
          if (dx * dx + dz * dz < (e.r + b.r) ** 2) {
            e.hp -= b.damage;
            e.hitFlash = 0.12;
            e.alert = true;
            this._knockback(e.mesh, e.r, b.vx, b.vz);
            this.world.remove(b.mesh);
            this.bullets.splice(i, 1);
            if (e.hp <= 0) this._killEnemy(j);
            break;
          }
        }
      } else if (b.team === 'enemy' && this.playerAlive) {
        const dx = b.mesh.position.x - this.player.position.x;
        const dz = b.mesh.position.z - this.player.position.z;
        if (dx * dx + dz * dz < (PLAYER_RADIUS + b.r) ** 2) {
          this._knockback(this.player, PLAYER_RADIUS, b.vx, b.vz, BULLET_KNOCKBACK * 0.7);
          this.world.remove(b.mesh);
          this.bullets.splice(i, 1);
          this._hurt(b.damage);
        }
      }
    }
  }

  _killEnemy(index) {
    const e = this.enemies[index];
    if (!e) return;
    this._spark(e.mesh.position.x, e.mesh.position.z, COL.blood, 14, 0.45, 1.0);
    // Chance to drop loot
    if (Math.random() < 0.22) {
      const kind = Math.random() < 0.7 ? 'gold' : (Math.random() < 0.7 ? 'potion' : 'power');
      this._spawnItem(e.mesh.position.x, e.mesh.position.z, kind);
    }
    this.world.remove(e.mesh);
    this.enemies.splice(index, 1);
    this.score += e.score;
  }

  _hurt(amount) {
    if (!this.playerAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.shake = Math.min(1.2, this.shake + 0.55);
    setTint(this.player, 0xffffff);
    setTimeout(() => { if (this.playerAlive) clearTint(this.player); }, 80);
    this._spark(this.player.position.x, this.player.position.z, COL.blood, 8, 0.32, 1.0);
    this._renderHp();
    if (this.hp <= 0) this.gameOver();
  }

  _spark(x, z, color, count, life, y = 0.4) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.1),
        makeMat(color),
      );
      mesh.position.set(x, y, z);
      this.world.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const s = 2 + Math.random() * 5;
      this.fx.push({
        mesh,
        vx: Math.cos(a) * s,
        vz: Math.sin(a) * s,
        vy: 1.5 + Math.random() * 3.5,
        life: life * (0.6 + Math.random() * 0.6),
        max: life,
      });
    }
  }

  _updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      f.mesh.position.x += f.vx * dt;
      f.mesh.position.z += f.vz * dt;
      f.mesh.position.y += f.vy * dt;
      f.vy -= 12 * dt;
      const t = Math.max(0, f.life / f.max);
      f.mesh.scale.setScalar(0.4 + t);
      f.mesh.material.opacity = t;
      f.mesh.material.transparent = true;
      if (f.life <= 0) {
        this.world.remove(f.mesh);
        this.fx.splice(i, 1);
      }
    }
  }

  _renderHp() {
    const bits = [];
    for (let i = 0; i < this.maxHp; i++) {
      bits.push(`<i class="${i < this.hp ? '' : 'empty'}"></i>`);
    }
    this.el.hp.innerHTML = bits.join('');
  }

  _renderStamina() {
    if (!this.el.stamina || !this.el.staminaFill) return;
    const pct = Math.round(clamp(this.stamina, 0, MAX_STAMINA) * 100);
    this.el.staminaFill.style.width = `${pct}%`;
    this.el.stamina.setAttribute('aria-valuenow', String(pct));
    this.el.stamina.classList.toggle('low', this.stamina > 0 && this.stamina <= 0.28);
    this.el.stamina.classList.toggle('empty', this.stamina <= 0);
    this.el.stamina.classList.toggle('winded', this.stamina <= 0 && this.staminaRegenCd > 0);
  }

  _renderHud() {
    if (this.el.score) this.el.score.textContent = String(this.score);
    if (this.el.floor) this.el.floor.textContent = String(this.depth);
    if (this.el.gold) this.el.gold.textContent = String(this.gold);
    if (this.el.enemies) this.el.enemies.textContent = String(this.enemies.length);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
