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
const FIRE_RATE = 0.22;
const MAX_HP = 6;
const VIEW_NEAR = 14;
const VIEW_FAR = 32;
const BULLET_KNOCKBACK = 0.28;
const START_AMMO = 24;
const BREACH_LIMIT = 12;
const AGGRO_DURATION = 6.5;
const WITNESS_RANGE = 11;
const PICKUP_RANGE = 1.6;
const THROW_SPEED = 16;
const MELEE_RANGE = 1.9;
const MELEE_COOLDOWN = 0.32;
const MELEE_ANIM = 0.2;
const MELEE_KNOCK_SPEED = 8.5;
const MELEE_KNOCK_DECAY = 7.5;
const PUNCH_LUNGE_SPEED = 6.2;
const PUNCH_LUNGE_DECAY = 10;
const PUNCH_STUN = 0.55;
const PUNCHES_TO_DOWN = 3;
const KNOCKDOWN_TIME = 1.6;
const COMBO_WINDOW = 1.8;

const COL = {
  playerBullet: 0xe8f0f4,
  muzzle: 0xffc24a,
  ammo: 0xd4a020,
  rock: 0x7a7060,
  blood: 0x8a3030,
  boat: 0x5a4030,
  raft: 0x8a7050,
  foam: 0xd0e4f0,
};

const PLAYER_COLORS = {
  skin: 0xc4a070,
  shirt: 0x2a4a6a,
  pants: 0x2a3038,
  boot: 0x1a1814,
  hair: 0x1c1410,
  gun: 0x2a3038,
};

const INVADER_KINDS = {
  runner: {
    name: 'runner',
    hp: 5,
    speed: 3.8,
    radius: 0.36,
    damage: 1,
    score: 10,
    colors: {
      skin: 0xb89060, shirt: 0x3a5a4a, pants: 0x2a2820,
      boot: 0x1a1410, hair: 0x1a120c, gun: 0x2a3038,
    },
  },
  sturdy: {
    name: 'sturdy',
    hp: 12,
    speed: 2.6,
    radius: 0.42,
    damage: 2,
    score: 18,
    colors: {
      skin: 0xa87850, shirt: 0x4a3a28, pants: 0x2a2420,
      boot: 0x151210, hair: 0x2a1a10, gun: 0x2a3038,
    },
  },
  sprinter: {
    name: 'sprinter',
    hp: 4,
    speed: 5.0,
    radius: 0.32,
    damage: 1,
    score: 14,
    colors: {
      skin: 0xc4a070, shirt: 0x5a2a2a, pants: 0x2a2030,
      boot: 0x1a1410, hair: 0x0e0a08, gun: 0x2a3038,
    },
  },
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function makeMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}
function randPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickInvaderKind(wave) {
  const roll = Math.random();
  if (wave <= 2) return roll < 0.7 ? 'runner' : 'sprinter';
  if (wave <= 5) {
    if (roll < 0.45) return 'runner';
    if (roll < 0.75) return 'sprinter';
    return 'sturdy';
  }
  if (roll < 0.35) return 'runner';
  if (roll < 0.65) return 'sprinter';
  return 'sturdy';
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
      uDark: { value: new THREE.Color(0x6a9aba) },
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
        float alpha = fog * 0.72;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uDark, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(mapSize * 1.8, mapSize * 1.8),
    mat,
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 2.5, 0);
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
    this.wave = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.fireCd = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.punchSide = 1; // 1 = right fist, -1 = left
    this.punchHand = 1;
    this.lungeX = 0;
    this.lungeZ = 0;
    this.damage = 2;
    this.fireRate = FIRE_RATE;
    this.ammo = START_AMMO;
    this.breached = 0;
    this.breachLimit = BREACH_LIMIT;
    this.held = null;
    this.nearPickup = null;

    this.bullets = [];
    this.enemies = [];
    this.items = [];
    this.boats = [];
    this.fx = [];
    this._levelRoot = null;

    this._waveTimer = 0;
    this._waveSpawning = false;
    this._toSpawn = 0;
    this._spawnCd = 0;
    this._waveClearDelay = 0;

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
    this.renderer.setClearColor(0x7ab0c8, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 160);
    this._camOffset = new THREE.Vector3(0, 32, 24);
    this.camera.position.copy(this._camOffset);
    this.camera.lookAt(0, 0, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);
  }

  _buildPlayer() {
    this.player = createPerson(PLAYER_COLORS, { armed: false });
    this.world.add(this.player);
    this.player.position.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.playerAlive = true;
    this.sprinting = false;
    this._heldMesh = null;
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
      wave: document.getElementById('wave'),
      ammo: document.getElementById('ammo'),
      breached: document.getElementById('breached'),
      enemies: document.getElementById('enemies'),
      hp: document.getElementById('hp'),
      stamina: document.getElementById('stamina'),
      staminaFill: document.getElementById('staminaFill'),
      prompt: document.getElementById('prompt'),
      held: document.getElementById('held'),
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
      if ((e.code === 'KeyE' || e.code === 'Space') && this.running && !this.paused && this.playerAlive) {
        e.preventDefault();
        this._interact();
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
      this.el.startBtn.textContent = 'DEFEND';
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
    for (const boat of this.boats) this.world.remove(boat.mesh);
    for (const f of this.fx) this.world.remove(f.mesh);
    this.bullets.length = 0;
    this.enemies.length = 0;
    this.items.length = 0;
    this.boats.length = 0;
    this.fx.length = 0;
    this._clearHeldVisual();
  }

  start() {
    this._clearEntities();

    this.score = 0;
    this.wave = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.damage = 2;
    this.fireRate = FIRE_RATE;
    this.ammo = START_AMMO;
    this.breached = 0;
    this.held = null;
    this.nearPickup = null;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.fireCd = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.punchSide = 1;
    this.punchHand = 1;
    this.lungeX = 0;
    this.lungeZ = 0;
    this.paused = false;
    this.running = true;
    this.time = 0;
    this.playerAlive = true;
    this.player.visible = true;
    clearTint(this.player);
    setArmed(this.player, false);

    this._loadMap();
    this._beginWave(1);

    this.input.keys.clear();
    this.input.mouse.down = false;
    this.el.overlay.classList.remove('on');
    this.el.finalScore.classList.add('hidden');
    this._renderHp();
    this._renderStamina();
    this._renderHud();
  }

  _loadMap() {
    this._clearEntities();
    this.level = buildLevelSpec(this.wave);
    buildLevelMeshes(this._levelRoot, this.level);

    this.world.remove(this.fogMask);
    this.fogMask = createFogMask(this.level.MAP);
    this.world.add(this.fogMask);

    this.player.position.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.player.rotation.y = 0;
    setArmed(this.player, false);

    for (const p of this.level.ammoPoints) {
      this._spawnItem(p.x, p.z, 'ammo', 8 + Math.floor(Math.random() * 8));
    }
    for (const p of this.level.pickupPoints) {
      this._spawnItem(p.x, p.z, p.kind);
    }
  }

  _beginWave(wave) {
    this.wave = wave;
    this._waveSpawning = true;
    this._toSpawn = Math.min(40, 5 + wave * 3 + Math.floor(Math.random() * 3));
    this._spawnCd = 1.2;
    this._waveClearDelay = 0;
    this._waveTimer = 0;
  }

  pause() {
    if (!this.running || !this.playerAlive || this.paused) return;
    this.paused = true;
    this.input.keys.clear();
    this.input.mouse.down = false;
    this._showMenu({
      title: 'PAUSED',
      subtitle: 'The shore can wait.',
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

  gameOver(reason = 'fallen') {
    this.running = false;
    this.paused = false;
    this.playerAlive = false;
    this.player.visible = false;
    const title = reason === 'breach' ? 'BREACHED' : 'FALLEN';
    const subtitle = reason === 'breach'
      ? 'Too many reached the city. Tarajal is overrun.'
      : 'You went down on the sand. The line broke.';
    this._showMenu({
      title,
      subtitle,
      finalScore: `WAVE  ${this.wave}   ·   STOPPED  ${this.score}   ·   THROUGH  ${this.breached}`,
      mode: 'end',
    });
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    const viewH = 26;
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
      this.level.playerSpawn.x + Math.sin(this.time * 0.2) * 2,
      0,
      this.level.playerSpawn.z + Math.cos(this.time * 0.15) * 2,
    );
    this.camera.position.set(
      focus.x + this._camOffset.x,
      this._camOffset.y,
      focus.z + this._camOffset.z,
    );
    this.camera.lookAt(focus);
    this._updateFogMask(focus.x, focus.z);
  }

  update(dt) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 4);

    this._updateWaves(dt);
    if (this.playerAlive) this._updatePlayer(dt);
    this._updateBoats(dt);
    this._updateBullets(dt);
    this._updateEnemies(dt);
    this._updateItems(dt);
    this._updateFx(dt);
    this._updateCamera();
    this._renderHud();
  }

  _updateWaves(dt) {
    this._waveTimer += dt;

    if (this._waveSpawning) {
      this._spawnCd -= dt;
      if (this._spawnCd <= 0 && this._toSpawn > 0) {
        this._spawnInvasionUnit();
        this._toSpawn -= 1;
        this._spawnCd = Math.max(0.35, 1.1 - this.wave * 0.06) + Math.random() * 0.4;
      }
      if (this._toSpawn <= 0) this._waveSpawning = false;
    } else if (this.enemies.length === 0 && this.boats.length === 0) {
      this._waveClearDelay += dt;
      if (this._waveClearDelay > 2.5) {
        this.score += 40 + this.wave * 15;
        // Resupply a little between waves
        this._restockLightly();
        this._beginWave(this.wave + 1);
      }
    }
  }

  _restockLightly() {
    const existingAmmo = this.items.filter((i) => i.kind === 'ammo').length;
    if (existingAmmo < 3) {
      const spot = randPick(this.level.ammoPoints);
      this._spawnItem(
        spot.x + (Math.random() - 0.5) * 2,
        spot.z + (Math.random() - 0.5) * 2,
        'ammo',
        6 + Math.floor(Math.random() * 6),
      );
    }
    const throwables = this.items.filter((i) => i.kind === 'rock').length;
    if (throwables < 4) {
      const spot = randPick(this.level.pickupPoints);
      this._spawnItem(
        spot.x + (Math.random() - 0.5),
        spot.z + (Math.random() - 0.5),
        'rock',
      );
    }
  }

  _spawnInvasionUnit() {
    const boatChance = this.wave <= 2 ? 0.55 : 0.4;
    if (Math.random() < boatChance) {
      this._spawnBoat();
    } else {
      const spot = randPick(this.level.swimSpawns);
      this._spawnEnemy(
        spot.x + (Math.random() - 0.5) * 2,
        spot.z + (Math.random() - 0.5),
        pickInvaderKind(this.wave),
        { swimming: true },
      );
    }
  }

  _spawnBoat() {
    const spot = randPick(this.level.boatSpawns);
    const isRaft = Math.random() < 0.45;
    const group = new THREE.Group();
    group.position.set(spot.x, 0, spot.z);

    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(isRaft ? 2.4 : 3.2, 0.35, isRaft ? 1.4 : 1.1),
      makeMat(isRaft ? COL.raft : COL.boat),
    );
    hull.position.y = 0.25;
    group.add(hull);

    if (!isRaft) {
      const prow = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.3, 0.9),
        makeMat(0x4a3020),
      );
      prow.position.set(0, 0.35, -0.7);
      group.add(prow);
    }

    const capacity = isRaft ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3);
    const passengers = [];
    for (let i = 0; i < capacity; i++) {
      passengers.push(pickInvaderKind(this.wave));
    }

    this.world.add(group);
    this.boats.push({
      mesh: group,
      speed: 2.2 + Math.random() * 0.8,
      targetZ: this.level.shoreLine + 1 + Math.random() * 2,
      passengers,
      bob: Math.random() * Math.PI * 2,
      isRaft,
    });
  }

  _updateBoats(dt) {
    for (let i = this.boats.length - 1; i >= 0; i--) {
      const b = this.boats[i];
      b.bob += dt * 2.5;
      b.mesh.position.y = 0.05 + Math.sin(b.bob) * 0.08;
      b.mesh.rotation.z = Math.sin(b.bob * 0.7) * 0.04;

      // Drift toward shore (decreasing z)
      if (b.mesh.position.z > b.targetZ) {
        b.mesh.position.z -= b.speed * dt;
        // slight drift toward beach center / destination x
        const dx = this.level.destination.x - b.mesh.position.x;
        b.mesh.position.x += Math.sign(dx) * Math.min(Math.abs(dx), 1.2) * dt * 0.4;
      } else {
        // Beach — unload
        const n = b.passengers.length;
        for (let p = 0; p < n; p++) {
          const ox = (p - (n - 1) * 0.5) * 0.7;
          this._spawnEnemy(
            b.mesh.position.x + ox,
            b.mesh.position.z - 0.8,
            b.passengers[p],
            { swimming: false },
          );
        }
        this._spark(b.mesh.position.x, b.mesh.position.z, COL.foam, 8, 0.4, 0.3);
        this.world.remove(b.mesh);
        this.boats.splice(i, 1);
      }
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

    // Punch lunge — short forward shove
    if (Math.hypot(this.lungeX, this.lungeZ) > 0.05) {
      this.player.position.x += this.lungeX * dt;
      this.player.position.z += this.lungeZ * dt;
      const damp = Math.exp(-PUNCH_LUNGE_DECAY * dt);
      this.lungeX *= damp;
      this.lungeZ *= damp;
    } else {
      this.lungeX = 0;
      this.lungeZ = 0;
    }

    this._pos.x = this.player.position.x;
    this._pos.z = this.player.position.z;
    resolveCircle(this._pos, PLAYER_RADIUS, this.level.walls);
    this.player.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
    this.player.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);

    // Keep player mostly on land (not deep water)
    if (this.player.position.z > this.level.waterLine + 4) {
      this.player.position.z = this.level.waterLine + 4;
    }

    const aim = this._aimPoint();
    const dx = aim.x - this.player.position.x;
    const dz = aim.z - this.player.position.z;
    if (dx * dx + dz * dz > 0.001) {
      this.player.rotation.y = Math.atan2(dx, dz);
    }

    this._moveSpeed = moving ? speed : 0;
    animatePerson(this.player, dt, this._moveSpeed, this.sprinting);
    this._applyMeleePose(dt);
    this._renderStamina();

    this.fireCd = Math.max(0, this.fireCd - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);

    const aimLen = Math.hypot(dx, dz) || 1;
    const dirX = dx / aimLen;
    const dirZ = dz / aimLen;

    // Left click — melee (or throw rock)
    if (this.input.mouse.down && this.meleeCd <= 0) {
      if (this.held === 'rock') {
        this.meleeCd = 0.35;
        this._throwRock(dirX, dirZ);
      } else {
        this.meleeCd = MELEE_COOLDOWN;
        this._meleeSwing(dirX, dirZ);
      }
    }

    // Right click — rifle (scarce ammo)
    if (this.input.mouse.right && this.fireCd <= 0 && this.held !== 'rock') {
      if (this.ammo > 0) {
        this.ammo -= 1;
        this.fireCd = this.fireRate;
        this._firePlayer(dirX, dirZ);
      } else {
        this.fireCd = 0.3;
      }
    }

    this._updateNearPrompt();
  }

  _updateNearPrompt() {
    this.nearPickup = null;
    let best = PICKUP_RANGE;
    const px = this.player.position.x;
    const pz = this.player.position.z;
    for (const it of this.items) {
      if (it.kind === 'ammo') continue;
      const d = Math.hypot(it.mesh.position.x - px, it.mesh.position.z - pz);
      if (d < best) {
        best = d;
        this.nearPickup = it;
      }
    }
    // Also allow picking ammo with E when close
    let nearAmmo = null;
    for (const it of this.items) {
      if (it.kind !== 'ammo') continue;
      const d = Math.hypot(it.mesh.position.x - px, it.mesh.position.z - pz);
      if (d < PICKUP_RANGE) {
        nearAmmo = it;
        break;
      }
    }

    if (!this.el.prompt) return;
    if (this.held) {
      this.el.prompt.innerHTML = `<kbd>E</kbd> drop ${this.held}`;
      this.el.prompt.classList.add('on');
    } else if (this.nearPickup) {
      this.el.prompt.innerHTML = `<kbd>E</kbd> grab ${this.nearPickup.kind}`;
      this.el.prompt.classList.add('on');
    } else if (nearAmmo) {
      this.el.prompt.innerHTML = `<kbd>E</kbd> take ammo`;
      this.el.prompt.classList.add('on');
      this.nearPickup = nearAmmo;
    } else {
      this.el.prompt.classList.remove('on');
    }
  }

  _interact() {
    if (this.held) {
      this._dropHeld();
      return;
    }
    if (!this.nearPickup) return;
    const it = this.nearPickup;
    if (it.kind === 'ammo') {
      this.ammo += it.value;
      this._spark(it.mesh.position.x, it.mesh.position.z, COL.ammo, 8, 0.3, 0.5);
      this.world.remove(it.mesh);
      const idx = this.items.indexOf(it);
      if (idx >= 0) this.items.splice(idx, 1);
      return;
    }
    this.held = it.kind;
    this._attachHeldVisual(it.kind);
    setArmed(this.player, false);
    this.world.remove(it.mesh);
    const idx = this.items.indexOf(it);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  _dropHeld() {
    if (!this.held) return;
    const yaw = this.player.rotation.y;
    const x = this.player.position.x + Math.sin(yaw) * 0.9;
    const z = this.player.position.z + Math.cos(yaw) * 0.9;
    this._spawnItem(x, z, this.held);
    this.held = null;
    this._clearHeldVisual();
    setArmed(this.player, false);
  }

  _attachHeldVisual(kind) {
    this._clearHeldVisual();
    const rig = this.player.userData.rig;
    if (!rig?.rArm || kind !== 'rock') return;

    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), makeMat(COL.rock));
    mesh.position.set(0, -0.5, -0.15);
    rig.rArm.add(mesh);
    this._heldMesh = mesh;
    rig.rArm.rotation.x = -1.0;
  }

  _clearHeldVisual() {
    if (this._heldMesh?.parent) this._heldMesh.parent.remove(this._heldMesh);
    this._heldMesh = null;
  }

  _applyMeleePose(dt) {
    const rig = this.player.userData.rig;
    if (!rig?.rArm || !rig?.lArm) return;
    if (this.meleeAnim <= 0) {
      if (rig.torso) rig.torso.rotation.y = 0;
      return;
    }

    this.meleeAnim = Math.max(0, this.meleeAnim - dt);
    const t = 1 - this.meleeAnim / MELEE_ANIM;
    const side = this.punchHand; // 1 = right, -1 = left (set when the punch starts)
    const punchArm = side > 0 ? rig.rArm : rig.lArm;
    const guardArm = side > 0 ? rig.lArm : rig.rArm;

    // Chamber, then drive the active fist forward
    if (t < 0.25) {
      const u = t / 0.25;
      punchArm.rotation.x = -0.2 - u * 0.7;
      punchArm.rotation.z = side * (0.45 - u * 0.15);
    } else {
      const u = (t - 0.25) / 0.75;
      punchArm.rotation.x = -0.9 - u * 1.35;
      punchArm.rotation.z = side * (0.3 - u * 0.45);
    }
    // Opposite fist stays up as a guard
    guardArm.rotation.x = -0.85;
    guardArm.rotation.z = -side * 0.4;

    if (rig.torso) {
      rig.torso.rotation.y = side * Math.sin(Math.min(1, t) * Math.PI) * 0.28;
    }
  }

  _throwRock(dirX, dirZ) {
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.14, 0),
      makeMat(COL.rock),
    );
    mesh.position.set(
      this.player.position.x + dirX * 0.6,
      1.1,
      this.player.position.z + dirZ * 0.6,
    );
    this.world.add(mesh);
    this.bullets.push({
      mesh,
      vx: dirX * THROW_SPEED,
      vz: dirZ * THROW_SPEED,
      life: 1.4,
      team: 'player',
      r: 0.18,
      damage: 3,
      kind: 'rock',
    });
    this.held = null;
    this._clearHeldVisual();
    setArmed(this.player, false);
    this._spark(mesh.position.x, mesh.position.z, COL.rock, 3, 0.15, 1.0);
  }

  _meleeSwing(dirX, dirZ) {
    const dmg = 3;
    this.punchHand = this.punchSide;
    this.meleeAnim = MELEE_ANIM;

    // Lunge into the punch
    this.lungeX = dirX * PUNCH_LUNGE_SPEED;
    this.lungeZ = dirZ * PUNCH_LUNGE_SPEED;

    let hits = 0;
    for (let j = this.enemies.length - 1; j >= 0; j--) {
      const e = this.enemies[j];
      const dx = e.mesh.position.x - this.player.position.x;
      const dz = e.mesh.position.z - this.player.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > MELEE_RANGE + e.r) continue;
      const dot = (dx * dirX + dz * dirZ) / (dist || 1);
      if (dot < 0.05) continue;
      if (this._punchEnemy(j, dmg, dirX, dirZ)) hits += 1;
    }
    if (hits > 0) this.shake = Math.min(0.7, this.shake + 0.22 * hits);

    this.punchSide *= -1;
  }

  /** @returns {boolean} true if a living (or just-hit) enemy was struck */
  _punchEnemy(index, damage, dirX, dirZ) {
    const e = this.enemies[index];
    if (!e) return false;

    // Build toward knockdown; window resets if you keep hitting
    if (e.knockdownTimer <= 0) {
      e.comboHits += 1;
      e.comboDecay = COMBO_WINDOW;
    }

    const willDown = e.knockdownTimer <= 0 && e.comboHits >= PUNCHES_TO_DOWN;
    const knock = willDown ? MELEE_KNOCK_SPEED * 1.45 : MELEE_KNOCK_SPEED * 0.85;

    this._damageEnemy(index, damage, dirX, dirZ, knock);
    // May have been killed and removed
    if (!this.enemies.includes(e)) return true;

    if (willDown) {
      e.comboHits = 0;
      e.comboDecay = 0;
      e.stunTimer = 0;
      e.knockdownTimer = KNOCKDOWN_TIME;
      this._setProne(e, true);
    } else if (e.knockdownTimer <= 0) {
      e.stunTimer = Math.max(e.stunTimer, PUNCH_STUN);
    }
    return true;
  }

  _setProne(e, down) {
    if (down) {
      e.mesh.rotation.x = Math.PI / 2;
      e.mesh.position.y = 0.4;
      if (e.hpBar) e.hpBar.visible = false;
    } else {
      e.mesh.rotation.x = 0;
      e.mesh.position.y = e.swimming ? -0.12 : 0;
    }
  }

  _firePlayer(dirX, dirZ) {
    // Brief rifle pose; muzzle from chest if gun is holstered
    const rig = this.player.userData.rig;
    const wasArmed = rig?.armed;
    if (!wasArmed) {
      setArmed(this.player, true);
      if (this._heldMesh) this._heldMesh.visible = false;
    }

    this.player.updateMatrixWorld(true);
    muzzleWorld(this.player, this._muzzle);
    if (!wasArmed) {
      this._muzzle.set(
        this.player.position.x + dirX * 0.55,
        1.15,
        this.player.position.z + dirZ * 0.55,
      );
    }

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
      kind: 'bullet',
    });

    this._spark(this._muzzle.x, this._muzzle.z, COL.muzzle, 3, 0.16, this._muzzle.y);

    if (!wasArmed) {
      setTimeout(() => {
        if (!this.playerAlive) return;
        setArmed(this.player, false);
        if (this._heldMesh) this._heldMesh.visible = true;
      }, 90);
    }
  }

  _spawnEnemy(x, z, kindKey, opts = {}) {
    const def = INVADER_KINDS[kindKey] || INVADER_KINDS.runner;
    const waveScale = 1 + (this.wave - 1) * 0.08;

    this._pos.x = x;
    this._pos.z = z;
    resolveCircle(this._pos, def.radius, this.level.walls);
    x = this._pos.x;
    z = this._pos.z;

    const mesh = createPerson(def.colors, { armed: false });
    setArmed(mesh, false);
    mesh.position.set(x, 0, z);
    if (kindKey === 'sprinter') mesh.scale.set(0.85, 0.9, 0.85);
    if (kindKey === 'sturdy') mesh.scale.setScalar(1.15);
    if (opts.swimming) mesh.position.y = -0.15;

    const hpBar = createHealthBar();
    mesh.add(hpBar);
    this.world.add(mesh);

    // Face toward destination
    const dx = this.level.destination.x - x;
    const dz = this.level.destination.z - z;
    mesh.rotation.y = Math.atan2(dx, dz);

    this.enemies.push({
      mesh,
      hpBar,
      kind: kindKey,
      r: def.radius * (kindKey === 'sturdy' ? 1.1 : 1),
      hp: Math.round(def.hp * waveScale),
      maxHp: Math.round(def.hp * waveScale),
      speed: def.speed + Math.random() * 0.35,
      damage: def.damage,
      score: def.score + this.wave * 2,
      hitFlash: 0,
      biteCd: 0.4 + Math.random() * 0.4,
      aggroTimer: 0,
      swimming: !!opts.swimming,
      panicked: false,
      kbx: 0,
      kbz: 0,
      stunTimer: 0,
      knockdownTimer: 0,
      comboHits: 0,
      comboDecay: 0,
    });
  }

  _spawnItem(x, z, kind, value = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    let color = COL.rock;
    let geo;
    let y = 0.25;

    if (kind === 'ammo') {
      color = COL.ammo;
      geo = new THREE.BoxGeometry(0.45, 0.28, 0.35);
      y = 0.22;
    } else if (kind === 'rock') {
      color = COL.rock;
      geo = new THREE.DodecahedronGeometry(0.2, 0);
      y = 0.22;
    } else {
      geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    }

    const mesh = new THREE.Mesh(geo, makeMat(color));
    mesh.position.y = y;
    group.add(mesh);

    if (kind === 'ammo') {
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.5, 12),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -2,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.06;
      glow.renderOrder = 1;
      group.add(glow);
    }

    this.world.add(group);
    this.items.push({
      mesh: group,
      bob: mesh,
      kind,
      r: kind === 'ammo' ? 0.7 : 0.55,
      value: kind === 'ammo' ? value : 1,
      phase: Math.random() * Math.PI * 2,
    });
  }

  _updateItems(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.phase += dt * 2.2;
      if (it.bob && it.kind === 'ammo') {
        it.bob.position.y = 0.22 + Math.sin(it.phase) * 0.1;
        it.bob.rotation.y += dt * 1.5;
      }

      // Auto-pickup ammo on walkover
      if (!this.playerAlive || it.kind !== 'ammo') continue;
      const d = Math.hypot(it.mesh.position.x - px, it.mesh.position.z - pz);
      if (d > it.r + PLAYER_RADIUS) continue;
      this.ammo += it.value;
      this._spark(it.mesh.position.x, it.mesh.position.z, COL.ammo, 8, 0.3, 0.5);
      this.world.remove(it.mesh);
      this.items.splice(i, 1);
    }
  }

  _enrage(enemy, duration = AGGRO_DURATION) {
    enemy.aggroTimer = Math.max(enemy.aggroTimer, duration);
    enemy.panicked = true;
  }

  _witnessAttack(victim, excludeIndex = -1) {
    const vx = victim.mesh.position.x;
    const vz = victim.mesh.position.z;
    for (let i = 0; i < this.enemies.length; i++) {
      if (i === excludeIndex) continue;
      const e = this.enemies[i];
      const d = Math.hypot(e.mesh.position.x - vx, e.mesh.position.z - vz);
      if (d > WITNESS_RANGE) continue;
      if (!hasLineOfSight(e.mesh.position.x, e.mesh.position.z, vx, vz, this.level.walls)) continue;
      this._enrage(e, AGGRO_DURATION * 0.85);
    }
  }

  _damageEnemy(index, damage, dirX = 0, dirZ = 0, knockSpeed = 0) {
    const e = this.enemies[index];
    if (!e) return;
    e.hp -= damage;
    e.hitFlash = 0.12;
    this._enrage(e);
    this._witnessAttack(e, index);
    if (dirX || dirZ) {
      const len = Math.hypot(dirX, dirZ) || 1;
      if (knockSpeed > 0) {
        e.kbx = (dirX / len) * knockSpeed;
        e.kbz = (dirZ / len) * knockSpeed;
      } else {
        this._knockback(e.mesh, e.r, dirX, dirZ, BULLET_KNOCKBACK);
      }
    }
    if (e.hp <= 0) this._killEnemy(index);
  }

  _updateEnemies(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const dest = this.level.destination;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.biteCd = Math.max(0, e.biteCd - dt);
      e.aggroTimer = Math.max(0, e.aggroTimer - dt);
      e.stunTimer = Math.max(0, e.stunTimer - dt);
      e.comboDecay = Math.max(0, e.comboDecay - dt);
      if (e.comboDecay <= 0) e.comboHits = 0;
      if (e.aggroTimer <= 0) e.panicked = false;

      const wasDown = e.knockdownTimer > 0;
      e.knockdownTimer = Math.max(0, e.knockdownTimer - dt);
      if (wasDown && e.knockdownTimer <= 0) {
        this._setProne(e, false);
      }

      if (e.hitFlash > 0) setTint(e.mesh, 0xffffff);
      else clearTint(e.mesh);

      // Leave water once past shore
      if (e.swimming && e.mesh.position.z < this.level.shoreLine + 1 && e.knockdownTimer <= 0) {
        e.swimming = false;
        e.mesh.position.y = 0;
      }

      let mx = 0;
      let mz = 0;
      let moveSpeed = 0;
      const downed = e.knockdownTimer > 0;
      const stunned = e.stunTimer > 0;
      const aggressive = !downed && !stunned && e.aggroTimer > 0 && this.playerAlive;

      if (downed || stunned) {
        // No AI — only knockback shove below
        mx = 0;
        mz = 0;
      } else if (aggressive) {
        const dx = px - e.mesh.position.x;
        const dz = pz - e.mesh.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist;
        const nz = dz / dist;
        e.mesh.rotation.y = Math.atan2(nx, nz);
        mx = nx;
        mz = nz;

        if (e.biteCd <= 0 && dist < e.r + PLAYER_RADIUS + 0.4) {
          e.biteCd = 0.85 + Math.random() * 0.35;
          this._hurt(e.damage);
          this._spark(px, pz, COL.blood, 6, 0.28, 1.0);
        }
      } else {
        // Push for the city gate
        let tx = dest.x;
        let tz = dest.z;
        // Slight personal offset so they don't stack in a line
        tx += Math.sin(i * 2.7) * 2.5;
        const dx = tx - e.mesh.position.x;
        const dz = tz - e.mesh.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        mx = dx / dist;
        mz = dz / dist;
        e.mesh.rotation.y = Math.atan2(mx, mz);

        // Soft avoid player when close but not aggressive (sidestep)
        if (this.playerAlive) {
          const pdx = e.mesh.position.x - px;
          const pdz = e.mesh.position.z - pz;
          const pd = Math.hypot(pdx, pdz);
          if (pd < 2.2) {
            mx += (pdx / pd) * 0.8;
            mz += (pdz / pd) * 0.8;
          }
        }
      }

      // Separation (skip while down)
      if (!downed) {
        for (let j = 0; j < this.enemies.length; j++) {
          if (j === i) continue;
          const o = this.enemies[j];
          if (o.knockdownTimer > 0) continue;
          const sx = e.mesh.position.x - o.mesh.position.x;
          const sz = e.mesh.position.z - o.mesh.position.z;
          const sd = Math.hypot(sx, sz);
          const min = e.r + o.r + 0.2;
          if (sd > 0 && sd < min) {
            mx += (sx / sd) * 1.6;
            mz += (sz / sd) * 1.6;
          }
        }
      }

      const mLen = Math.hypot(mx, mz);
      const kbLen = Math.hypot(e.kbx, e.kbz);
      const control = downed || stunned
        ? 0
        : (kbLen > 3 ? 0.12 : kbLen > 1 ? 0.4 : 1);

      if (mLen > 0.05 && control > 0) {
        mx /= mLen;
        mz /= mLen;
        const swimSlow = e.swimming ? 0.55 : 1;
        moveSpeed = (aggressive ? e.speed * 1.15 : e.speed) * swimSlow;
        e.mesh.position.x += mx * moveSpeed * dt * control;
        e.mesh.position.z += mz * moveSpeed * dt * control;
      }

      // Punch / hit knockback shove
      if (kbLen > 0.02) {
        e.mesh.position.x += e.kbx * dt;
        e.mesh.position.z += e.kbz * dt;
        const damp = Math.exp(-MELEE_KNOCK_DECAY * dt);
        e.kbx *= damp;
        e.kbz *= damp;
      } else {
        e.kbx = 0;
        e.kbz = 0;
      }

      this._pos.x = e.mesh.position.x;
      this._pos.z = e.mesh.position.z;
      resolveCircle(this._pos, e.r, this.level.walls);
      e.mesh.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
      e.mesh.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);

      if (downed) {
        e.mesh.rotation.x = Math.PI / 2;
        e.mesh.position.y = 0.4;
      } else if (e.swimming) {
        e.mesh.position.y = -0.12 + Math.sin(this.time * 4 + i) * 0.04;
      }

      if (!downed) {
        animatePerson(
          e.mesh,
          dt,
          stunned ? 0 : moveSpeed,
          aggressive && moveSpeed > 3.5,
          (e.panicked && aggressive) || stunned,
        );
        updateHealthBar(e.hpBar, e.hp, e.maxHp, e.mesh.rotation.y);
      }

      // Breach check — reached city gate (downed can't breach)
      if (
        !downed
        && e.mesh.position.z <= this.level.breachZ + 1.2
        && Math.abs(e.mesh.position.x - dest.x) < this.level.breachHalfW + 1.5
      ) {
        this._breach(i);
      }
    }
  }

  _breach(index) {
    const e = this.enemies[index];
    if (!e) return;
    this.breached += 1;
    this.shake = Math.min(1.0, this.shake + 0.35);
    this._spark(e.mesh.position.x, e.mesh.position.z, 0xaa3030, 10, 0.35, 1.0);
    this.world.remove(e.mesh);
    this.enemies.splice(index, 1);
    if (this.breached >= this.breachLimit) {
      this.gameOver('breach');
    }
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
      if (b.kind === 'rock') {
        b.mesh.position.y = Math.max(0.15, b.mesh.position.y - 4 * dt);
        b.mesh.rotation.x += dt * 8;
        b.mesh.rotation.z += dt * 6;
      }
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
        // Spent rock becomes a pickup again sometimes
        if (b.kind === 'rock' && Math.random() < 0.35 && !hitWall) {
          this._spawnItem(b.mesh.position.x, b.mesh.position.z, 'rock');
        }
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
            const rockImpulse = b.kind === 'rock' ? 5.5 : 3.2;
            this.world.remove(b.mesh);
            this.bullets.splice(i, 1);
            this._damageEnemy(j, b.damage, b.vx, b.vz, rockImpulse);
            break;
          }
        }
      }
    }
  }

  _killEnemy(index) {
    const e = this.enemies[index];
    if (!e) return;
    this._spark(e.mesh.position.x, e.mesh.position.z, COL.blood, 14, 0.45, 1.0);
    if (Math.random() < 0.12) {
      this._spawnItem(e.mesh.position.x, e.mesh.position.z, 'ammo', 2 + Math.floor(Math.random() * 3));
    } else if (Math.random() < 0.18) {
      this._spawnItem(e.mesh.position.x, e.mesh.position.z, 'rock');
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
    if (this.hp <= 0) this.gameOver('fallen');
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
      if (f.gravity !== false) f.vy -= 12 * dt;
      if (f.spin) f.mesh.rotation.z += f.spin * dt;
      const t = Math.max(0, f.life / f.max);
      if (f.grow) f.mesh.scale.setScalar(0.6 + (1 - t) * 1.8);
      else f.mesh.scale.setScalar(0.45 + t * 0.7);
      f.mesh.material.opacity = t * (f.grow ? 0.55 : 0.85);
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
    if (this.el.wave) this.el.wave.textContent = String(this.wave);
    if (this.el.ammo) this.el.ammo.textContent = String(this.ammo);
    if (this.el.breached) {
      this.el.breached.textContent = `${this.breached}/${this.breachLimit}`;
    }
    if (this.el.enemies) {
      this.el.enemies.textContent = String(this.enemies.length + this.boats.reduce((n, b) => n + b.passengers.length, 0));
    }
    if (this.el.held) {
      this.el.held.textContent = this.held ? this.held.toUpperCase() : 'FISTS';
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
