import * as THREE from 'three';
import { Input } from './Input.js';
import { Sfx } from './Audio.js';
import {
  createPerson, animatePerson, setTint, clearTint, setArmed,
  createHealthBar, updateHealthBar, detachBodyParts,
} from './Character.js';
import {
  buildLevelSpec,
  buildLevelMeshes,
  resolveCircle,
  hasLineOfSight,
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
const MAX_HP = 6;
const HP_REGEN_DELAY = 3.0;
const HP_REGEN_RATE = 0.22; // hearts per second after delay
const VIEW_NEAR = 14;
const VIEW_FAR = 32;
const BULLET_KNOCKBACK = 0.28;
const BREACH_LIMIT = 12;
const AGGRO_DURATION = 6.5;
const WITNESS_RANGE = 11;
const MELEE_RANGE = 1.9;
const MELEE_COOLDOWN = 0.26;
const MELEE_ANIM = 0.34;
const MELEE_KNOCK_SPEED = 18;
const MELEE_KNOCK_DECAY = 5.2;
const PUNCH_LUNGE_SPEED = 6.2;
const PUNCH_LUNGE_DECAY = 10;
const PLAYER_KNOCK_SPEED = 7.5;
const PLAYER_KNOCK_DECAY = 8;
const PUNCH_STUN = 0.55;
const PUNCHES_TO_DOWN = 3;
const KNOCKDOWN_TIME = 1.6;
const COMBO_WINDOW = 1.8;
const SPANIARD_FEAR_TIME = 5.5;
const SPANIARD_GREET_RANGE = 7.5;
const CIV_HUNT_RANGE = 12;
const TEAR_DURATION = 1.7;
const HOLD_DURATION = 5.5;
const CIV_TARGET_COUNT = 9;
const CIV_REINFORCE_MIN = 2.4;
const CIV_REINFORCE_MAX = 5.0;

const WELCOME_LINES = [
  // Spanish
  '¡Bienvenidos!',
  '¡Pasad, pasad!',
  '¡Estáis a salvo!',
  '¡Hermanos, adelante!',
  '¡La ciudad está abierta!',
  '¿Queréis agua? ¿Comida?',
  '¡Ánimo, venid!',
  '¡Sois bienvenidos aquí!',
  // English
  'Welcome, friends!',
  'Come, you are safe!',
  'Welcome to Spain!',
  'The city is open!',
  'Water? Food?',
  'This way — you\'re safe now.',
  'Come ashore, friends!',
  'We\'re here to help!',
];

const FEAR_LINES = [
  // Spanish
  '¡Qué haces?!',
  '¡Socorro!',
  '¡No, por favor!',
  '¡Ayuda!',
  '¡Dios mío!',
  '¡Pero si os ayudamos!',
  '¡No lo entiendo!',
  '¡Dejadnos en paz!',
  // English
  'Why?!',
  'We\'re helping you!',
  'I don\'t understand!',
  'Stop — we\'re friends!',
  'Please, no!',
  'What are you doing?!',
  'Help!',
  'We welcomed you!',
];

// Mostly English / widely known Arabic; a few Arabic phrases mixed in
const INVADER_MARCH_LINES = [
  'To the city!',
  'Keep moving!',
  'Spain is next!',
  'We made it ashore!',
  'No going back!',
  'Europe waits!',
  'Push forward!',
  'The gate is open!',
  'Inshallah we take it.',
  'Yalla!',
  'Allahu Akbar!',
  'Wallahi, we go!',
];

const INVADER_FIGHT_LINES = [
  'Come fight!',
  'You die here!',
  'Get him!',
  'Out of our way!',
  'I\'ll break you!',
  'Stay down!',
  'This beach is ours!',
  'Wallahi!',
  'Allahu Akbar!',
  'Yalla, hit him!',
];

const INVADER_CIV_LINES = [
  'Out of the way!',
  'Move!',
  'You are nothing!',
  'This land is ours!',
  'Shut up!',
  'We don\'t need you!',
  'Go home, kuffar!',
  'Spain is finished!',
  'Allahu Akbar!',
  'Yalla!',
];

const INVADER_HIT_LINES = [
  'Argh!',
  'You\'ll pay!',
  'Hit him back!',
  'I\'m fine — fight!',
  'Wallah!',
  'Allahu Akbar!',
];

const INVADER_BREACH_LINES = [
  'We\'re through!',
  'The city is ours!',
  'Inshallah!',
  'Allahu Akbar!',
  'Keep going!',
];

const SPAIN_SKINS = [0xd4b08a, 0xc4a070, 0xb89068, 0xdbc4a0];
const SPAIN_HAIR = [0x1a120e, 0x3a2818, 0x5a3a20, 0x2a1c14, 0x6a5030];
const SPAIN_SHIRTS = [0xe8e0d4, 0xc45c48, 0x3a5a7a, 0xe8c84a, 0x2a6a5a, 0xf0ece4];
const SPAIN_PANTS = [0x2a3540, 0x3a4550, 0x4a3a30, 0x1a3048, 0x5a5048];

const COL = {
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
    skin: 0xb89060,
  },
  sturdy: {
    name: 'sturdy',
    hp: 12,
    speed: 2.6,
    radius: 0.42,
    damage: 2,
    score: 18,
    skin: 0xa87850,
  },
  sprinter: {
    name: 'sprinter',
    hp: 4,
    speed: 5.0,
    radius: 0.32,
    damage: 1,
    score: 14,
    skin: 0xc4a070,
  },
};

// Moroccan flag red / green with slight per-person variants
const MOROCCO_REDS = [0xc1272d, 0xb8222a, 0xd12f35, 0xa61e25, 0xc73a3f, 0xb52a30];
const MOROCCO_GREENS = [0x006233, 0x0b6e3c, 0x005229, 0x127a48, 0x004a26, 0x0a5f38];
const MOROCCO_HAIR = [0x1a120c, 0x0e0a08, 0x2a1810, 0x1c1410, 0x24180e];

function moroccoClothes(skin) {
  const shirt = randPick(MOROCCO_REDS);
  // Usually green pants; sometimes darker red so the pair still reads as the flag
  const pants = Math.random() < 0.78 ? randPick(MOROCCO_GREENS) : randPick(MOROCCO_REDS);
  return {
    skin,
    shirt,
    pants,
    boot: Math.random() < 0.5 ? 0x1a1210 : 0x15100e,
    hair: randPick(MOROCCO_HAIR),
    gun: 0x2a3038,
  };
}

function spainClothes(female = false) {
  const hair = female
    ? randPick([0x1a120e, 0x3a2818, 0x5a3a20, 0x6a5030, 0x8a6040, 0xc4a060])
    : randPick(SPAIN_HAIR);
  const shirt = female
    ? randPick([0xe8e0d4, 0xc45c48, 0xe8c84a, 0xf0ece4, 0xd87890, 0x6a8ab0, 0xe8a070])
    : randPick(SPAIN_SHIRTS);
  return {
    skin: randPick(SPAIN_SKINS),
    shirt,
    pants: randPick(SPAIN_PANTS),
    boot: Math.random() < 0.5 ? 0x2a2420 : 0x1a1814,
    hair,
    gun: 0x2a3038,
  };
}

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
    this.sfx = new Sfx();
    this.running = false;
    this.paused = false;
    this.time = 0;
    this.score = 0;
    this.wave = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.regenDelay = 0;
    this.regenAcc = 0;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.punchSide = 1; // 1 = right fist, -1 = left
    this.punchHand = 1;
    this.lungeX = 0;
    this.lungeZ = 0;
    this.lungeDirX = 0;
    this.lungeDirZ = 0;
    this.lungeArmed = false;
    this.kbx = 0;
    this.kbz = 0;
    this._pendingPunch = null;
    this.breached = 0;
    this.breachLimit = BREACH_LIMIT;

    this.enemies = [];
    this.spaniards = [];
    this.boats = [];
    this.fx = [];
    this._levelRoot = null;
    this._speechLayer = null;
    this._proj = new THREE.Vector3();

    this._waveTimer = 0;
    this._waveSpawning = false;
    this._toSpawn = 0;
    this._spawnCd = 0;
    this._waveClearDelay = 0;
    this._civReinforceCd = 3;

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
    this._camOffset = new THREE.Vector3(0, 23, 17);
    this.camera.position.copy(this._camOffset);
    this.camera.lookAt(0, 0, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);
  }

  _buildPlayer() {
    this.player = createPerson(PLAYER_COLORS, { armed: false });
    this.playerHpBar = createHealthBar();
    this.player.add(this.playerHpBar);
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
      wave: document.getElementById('wave'),
      breached: document.getElementById('breached'),
      enemies: document.getElementById('enemies'),
      hp: document.getElementById('hp'),
      stamina: document.getElementById('stamina'),
      staminaFill: document.getElementById('staminaFill'),
      prompt: document.getElementById('prompt'),
      radar: document.getElementById('radar'),
    };
    this._speechLayer = document.getElementById('speechLayer');
    this._radarCtx = this.el.radar?.getContext('2d') ?? null;
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
    for (const e of this.enemies) {
      this.world.remove(e.mesh);
      if (e.bubble) e.bubble.remove();
    }
    for (const s of this.spaniards) {
      this.world.remove(s.mesh);
      if (s.bubble) s.bubble.remove();
    }
    for (const boat of this.boats) this.world.remove(boat.mesh);
    for (const f of this.fx) this.world.remove(f.mesh);
    this.enemies.length = 0;
    this.spaniards.length = 0;
    this.boats.length = 0;
    this.fx.length = 0;
    if (this._speechLayer) this._speechLayer.replaceChildren();
  }

  start() {
    this.sfx.unlock();
    this.sfx.uiClick();
    this._clearEntities();

    this.score = 0;
    this.wave = 1;
    this.hp = MAX_HP;
    this.maxHp = MAX_HP;
    this.regenDelay = 0;
    this.regenAcc = 0;
    this.breached = 0;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    this.shake = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.punchSide = 1;
    this.punchHand = 1;
    this.lungeX = 0;
    this.lungeZ = 0;
    this.lungeDirX = 0;
    this.lungeDirZ = 0;
    this.lungeArmed = false;
    this.kbx = 0;
    this.kbz = 0;
    this._pendingPunch = null;
    this.paused = false;
    this.running = true;
    this.time = 0;
    this.playerAlive = true;
    this.player.visible = true;
    clearTint(this.player);
    setArmed(this.player, false);

    this._loadMap();
    this._spawnSpaniards(8);
    this._civReinforceCd = 4;
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
  }

  _beginWave(wave) {
    this.wave = wave;
    this._waveSpawning = true;
    this._toSpawn = Math.min(40, 5 + wave * 3 + Math.floor(Math.random() * 3));
    this._spawnCd = 1.2;
    this._waveClearDelay = 0;
    this._waveTimer = 0;
    this.sfx.waveStart(wave);
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
    this.sfx.unlock();
    this.sfx.uiClick();
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
    this.sfx.gameOver(reason);
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
    const viewH = 18.5;
    const viewW = viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
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
    this._updateEnemies(dt);
    this._updateSpaniards(dt);
    this._updateCivilianReinforcements(dt);
    this._updateHoldings(dt);
    this._updateTearings(dt);
    this._updateFx(dt);
    this._updateSpeechBubbles();
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
        this._beginWave(this.wave + 1);
      }
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
      // Beach just out of the water — tiny bit inland only
      targetZ: this.level.waterLine - 0.8 - Math.random() * 1.2,
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
        this.sfx.boatLand();
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

    // Hit knockback — shove away from the attacker
    if (Math.hypot(this.kbx, this.kbz) > 0.05) {
      this.player.position.x += this.kbx * dt;
      this.player.position.z += this.kbz * dt;
      const damp = Math.exp(-PLAYER_KNOCK_DECAY * dt);
      this.kbx *= damp;
      this.kbz *= damp;
    } else {
      this.kbx = 0;
      this.kbz = 0;
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

    // Face the way we're moving
    if (moving) {
      this.player.rotation.y = Math.atan2(axis.x, axis.y);
    }

    this._moveSpeed = moving ? speed : 0;
    animatePerson(this.player, dt, this._moveSpeed, this.sprinting, false, this.meleeAnim > 0);
    this._applyMeleePose(dt);
    this._renderStamina();

    this.meleeCd = Math.max(0, this.meleeCd - dt);

    // Punch in facing direction (click or space) — wait for previous swing to finish
    const dirX = Math.sin(this.player.rotation.y);
    const dirZ = Math.cos(this.player.rotation.y);
    if (this.input.mouse.down || this.input.keys.has('Space')) {
      if (this.meleeCd <= 0 && this.meleeAnim <= 0) {
        this.meleeCd = MELEE_COOLDOWN;
        this._meleeSwing(dirX, dirZ);
      }
    }

    this._regenPlayer(dt);
    updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y);
  }

  _regenPlayer(dt) {
    if (!this.playerAlive || this.hp <= 0 || this.hp >= this.maxHp) {
      this.regenAcc = 0;
      return;
    }
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    if (this.regenDelay > 0) return;

    this.regenAcc += HP_REGEN_RATE * dt;
    if (this.regenAcc >= 1) {
      const healed = Math.floor(this.regenAcc);
      this.regenAcc -= healed;
      this.hp = Math.min(this.maxHp, this.hp + healed);
      this._renderHp();
    }
  }

  /**
   * Full-body jab/cross: ground → drive leg → hip/torso → shoulder → fist.
   * Body leads; arm catches up; guard hand stays up; retract on the same line.
   */
  _applyMeleePose(dt) {
    const rig = this.player.userData.rig;
    if (!rig?.rArm || !rig?.lArm) return;
    if (this.meleeAnim <= 0) {
      if (rig.torso) {
        rig.torso.rotation.y = 0;
        rig.torso.rotation.x = 0;
        rig.torso.rotation.z = 0;
        rig.torso.position.y = 0.95;
      }
      if (rig.head) {
        rig.head.rotation.x = 0;
        rig.head.rotation.y = 0;
      }
      return;
    }

    this.meleeAnim = Math.max(0, this.meleeAnim - dt);
    const t = 1 - this.meleeAnim / MELEE_ANIM;
    const side = this.punchHand; // 1 = right, -1 = left
    const punchArm = side > 0 ? rig.rArm : rig.lArm;
    const guardArm = side > 0 ? rig.lArm : rig.rArm;
    const punchElbow = side > 0 ? rig.rElbow : rig.lElbow;
    const guardElbow = side > 0 ? rig.lElbow : rig.rElbow;
    const driveLeg = side > 0 ? rig.rLeg : rig.lLeg;
    const plantLeg = side > 0 ? rig.lLeg : rig.rLeg;

    // Envelope: ease in to peak, brief hold through impact, smooth recover
    const env = (peakAt) => {
      if (t < peakAt) {
        const u = t / peakAt;
        return u * u;
      }
      const hold = peakAt + 0.06;
      if (t < hold) return 1;
      const u = (t - hold) / Math.max(0.001, 1 - hold);
      return 1 - u * u * (3 - 2 * u);
    };

    // Proximal→distal: hips/torso peak first, arm slightly later
    const body = env(0.28);
    const armDelay = Math.max(0, (t - 0.05) / 0.95);
    const arm = (() => {
      const peakAt = 0.34;
      if (armDelay < peakAt) {
        const u = armDelay / peakAt;
        return u * u;
      }
      const hold = peakAt + 0.06;
      if (armDelay < hold) return 1;
      const u = (armDelay - hold) / Math.max(0.001, 1 - hold);
      return 1 - u * u * (3 - 2 * u);
    })();

    // Impact when fist is near full extension (after body has turned in)
    if (this.lungeArmed && t >= 0.4) {
      this.lungeX = this.lungeDirX * PUNCH_LUNGE_SPEED;
      this.lungeZ = this.lungeDirZ * PUNCH_LUNGE_SPEED;
      this.lungeArmed = false;
      if (this._pendingPunch) {
        const { dirX, dirZ, dmg } = this._pendingPunch;
        this._pendingPunch = null;
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
        for (let j = this.spaniards.length - 1; j >= 0; j--) {
          const s = this.spaniards[j];
          if (!s || s.hp <= 0) continue;
          const dx = s.mesh.position.x - this.player.position.x;
          const dz = s.mesh.position.z - this.player.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > MELEE_RANGE + s.r) continue;
          const dot = (dx * dirX + dz * dirZ) / (dist || 1);
          if (dot < 0.05) continue;
          this._hurtSpaniard(s, dmg, dirX, dirZ, { fromPlayer: true });
          hits += 1;
        }
        if (hits > 0) {
          this.shake = Math.min(0.7, this.shake + 0.22 * hits);
          this.sfx.punchHit({ hard: hits > 1 });
          this._bloodSpray(
            this.player.position.x + dirX * 0.9,
            this.player.position.z + dirZ * 0.9,
            dirX,
            dirZ,
            { mild: true },
          );
        } else {
          this.sfx.punchMiss();
        }
      }
    }

    // Legs: drive foot loads then pushes; plant foot takes weight forward
    if (driveLeg) driveLeg.rotation.x = -0.42 * body;
    if (plantLeg) plantLeg.rotation.x = 0.28 * body;

    // Hips/shoulders: punch-side shoulder comes forward; slight lean + crouch
    if (rig.torso) {
      rig.torso.rotation.y = -side * 0.58 * body;
      // Positive X pitches toward +Z (facing), i.e. lean into the punch
      rig.torso.rotation.x = 0.38 * body;
      rig.torso.rotation.z = side * 0.06 * body;
      rig.torso.position.y = 0.95 - 0.06 * body;
    }

    // Chin tucks behind the punching shoulder
    if (rig.head) {
      rig.head.rotation.y = -side * 0.18 * body;
      rig.head.rotation.x = 0.16 * body;
    }

    // Fist: hang → straight line, palm-down snap (internal rotation), retract same path
    punchArm.rotation.x = 0.12 - arm * 1.72;
    punchArm.rotation.y = -side * 0.4 * arm;
    punchArm.rotation.z = side * (0.14 * (1 - arm) + 0.04);
    if (punchElbow) punchElbow.rotation.x = -0.55 + arm * 0.5;

    // Rear hand stays in a high guard (not a second punch)
    guardArm.rotation.x = -0.95 - 0.12 * body;
    guardArm.rotation.y = side * 0.22;
    guardArm.rotation.z = -side * 0.48;
    if (guardElbow) guardElbow.rotation.x = -1.05;
  }

  _meleeSwing(dirX, dirZ) {
    this.punchHand = this.punchSide;
    this.meleeAnim = MELEE_ANIM;
    this.sfx.punchSwing();

    // Lunge + hit land at impact (see _applyMeleePose)
    this.lungeDirX = dirX;
    this.lungeDirZ = dirZ;
    this.lungeArmed = true;
    this._pendingPunch = { dirX, dirZ, dmg: 3 };

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
    const knock = willDown ? MELEE_KNOCK_SPEED * 1.35 : MELEE_KNOCK_SPEED;

    this._damageEnemy(index, damage, dirX, dirZ, knock, { fromPunch: true });
    // May have been killed and removed
    if (!this.enemies.includes(e)) return true;

    if (willDown) {
      e.comboHits = 0;
      e.comboDecay = 0;
      e.stunTimer = 0;
      e.knockdownTimer = KNOCKDOWN_TIME;
      this._setProne(e, true);
      this.sfx.knockdown();
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

  _spawnEnemy(x, z, kindKey, opts = {}) {
    const def = INVADER_KINDS[kindKey] || INVADER_KINDS.runner;
    const waveScale = 1 + (this.wave - 1) * 0.08;

    this._pos.x = x;
    this._pos.z = z;
    resolveCircle(this._pos, def.radius, this.level.walls);
    x = this._pos.x;
    z = this._pos.z;

    const mesh = createPerson(moroccoClothes(def.skin), { armed: false, female: false });
    setArmed(mesh, false);
    mesh.position.set(x, 0, z);
    if (kindKey === 'sprinter') mesh.scale.set(0.85, 0.9, 0.85);
    if (kindKey === 'sturdy') mesh.scale.setScalar(1.15);
    if (opts.swimming) mesh.position.y = -0.15;

    const hpBar = createHealthBar();
    mesh.add(hpBar);
    this.world.add(mesh);

    const bubble = document.createElement('div');
    bubble.className = 'speech foe';
    if (this._speechLayer) this._speechLayer.appendChild(bubble);

    // Face toward destination
    const dx = this.level.destination.x - x;
    const dz = this.level.destination.z - z;
    mesh.rotation.y = Math.atan2(dx, dz);

    this.enemies.push({
      mesh,
      hpBar,
      bubble,
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
      civTarget: null,
      civHuntCd: 0.2 + Math.random() * 0.8,
      civHuntTimer: 0,
      speechCd: 1.5 + Math.random() * 3,
      speechLife: 0,
      tearing: null,
      holding: null,
    });
  }

  _sayInvader(e, text) {
    if (!e?.bubble) return;
    e.bubble.textContent = text;
    e.bubble.classList.add('foe', 'on');
    e.bubble.classList.remove('fear');
    e.speechLife = 2.5;
    e.speechCd = 3.5 + Math.random() * 4;
  }

  _enrage(enemy, duration = AGGRO_DURATION) {
    const wasCalm = enemy.aggroTimer <= 0;
    enemy.aggroTimer = Math.max(enemy.aggroTimer, duration);
    enemy.panicked = true;
    if (wasCalm && Math.random() < 0.55) {
      this._sayInvader(enemy, randPick(INVADER_FIGHT_LINES));
    }
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

  _damageEnemy(index, damage, dirX = 0, dirZ = 0, knockSpeed = 0, opts = {}) {
    const e = this.enemies[index];
    if (!e) return;
    e.hp -= damage;
    e.hitFlash = 0.12;
    this._enrage(e);
    this._witnessAttack(e, index);
    if (e.speechCd <= 0 && Math.random() < 0.4) {
      this._sayInvader(e, randPick(INVADER_HIT_LINES));
    }
    if (dirX || dirZ) {
      const len = Math.hypot(dirX, dirZ) || 1;
      if (knockSpeed > 0) {
        e.kbx = (dirX / len) * knockSpeed;
        e.kbz = (dirZ / len) * knockSpeed;
      } else {
        this._knockback(e.mesh, e.r, dirX, dirZ, BULLET_KNOCKBACK);
      }
    }
    if (e.hp <= 0) this._killEnemy(index, { fromPunch: !!opts.fromPunch, dirX, dirZ });
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
      e.civHuntCd = Math.max(0, e.civHuntCd - dt);
      e.civHuntTimer = Math.max(0, e.civHuntTimer - dt);
      e.speechCd = Math.max(0, e.speechCd - dt);
      e.speechLife = Math.max(0, e.speechLife - dt);
      if (e.speechLife <= 0 && e.bubble) e.bubble.classList.remove('on');
      if (e.civTarget && (e.civTarget.hp <= 0 || !this.spaniards.includes(e.civTarget))) {
        e.civTarget = null;
        e.civHuntTimer = 0;
      }
      if (e.civHuntTimer <= 0) e.civTarget = null;

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
      const tearing = !!e.tearing;
      const holding = !!e.holding;
      const aggressive = !downed && !stunned && !tearing && !holding && e.aggroTimer > 0 && this.playerAlive;

      if (downed || stunned || tearing || holding) {
        // No AI — knockback only (hold/tear posing happens in dedicated updates)
        mx = 0;
        mz = 0;
      } else if (aggressive) {
        const dx = px - e.mesh.position.x;
        const dz = pz - e.mesh.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        const nx = dx / dist;
        const nz = dz / dist;
        e.mesh.rotation.y = Math.atan2(nx, nz);

        // Hold just inside punching range — don't pile onto the player
        const punchReach = e.r + PLAYER_RADIUS + 0.45;
        const holdDist = punchReach - 0.2;
        if (dist > holdDist + 0.12) {
          mx = nx;
          mz = nz;
        } else if (dist < holdDist - 0.1) {
          mx = -nx;
          mz = -nz;
        } else {
          mx = 0;
          mz = 0;
        }

        if (e.biteCd <= 0 && dist < punchReach) {
          e.biteCd = 0.85 + Math.random() * 0.35;
          this._hurt(e.damage, nx, nz);
          this._spark(px, pz, COL.blood, 6, 0.28, 1.0);
          if (Math.random() < 0.4) this._sayInvader(e, randPick(INVADER_FIGHT_LINES));
        }
      } else if (!downed && !stunned && !tearing && !holding && e.civTarget) {
        // Divert to punch / grab a Spaniard
        const s = e.civTarget;
        if (s.tearing || s.heldBy === e) {
          mx = 0;
          mz = 0;
        } else {
          const dx = s.mesh.position.x - e.mesh.position.x;
          const dz = s.mesh.position.z - e.mesh.position.z;
          const dist = Math.hypot(dx, dz) || 1;
          const nx = dx / dist;
          const nz = dz / dist;
          e.mesh.rotation.y = Math.atan2(nx, nz);

          const punchReach = e.r + s.r + 0.45;
          const holdDist = punchReach - 0.15;
          if (dist > holdDist + 0.1) {
            mx = nx;
            mz = nz;
          } else if (dist < holdDist - 0.12) {
            mx = -nx;
            mz = -nz;
          } else {
            mx = 0;
            mz = 0;
          }

          if (e.biteCd <= 0 && dist < punchReach) {
            e.biteCd = 0.55 + Math.random() * 0.25;
            // Second invader arrives while someone is already holding → start tear
            if (s.heldBy && s.heldBy !== e && !s.tearing) {
              this._beginTearSpaniard(s);
            } else if (!s.heldBy && !s.tearing && this._countSwarmOn(s, 3.2) < 2 && Math.random() < 0.5) {
              this._beginHoldCivilian(e, s);
            } else if (!s.heldBy) {
              this._hurtSpaniard(s, e.damage, nx, nz);
              this._bloodSpray(s.mesh.position.x, s.mesh.position.z, nx, nz, { mild: true });
              if (Math.random() < 0.55) this._sayInvader(e, randPick(INVADER_CIV_LINES));
            }
          }
        }
      } else if (!tearing && !holding) {
        // Push for the city gate — often pick on a nearby Spaniard
        if (!downed && !stunned && e.civHuntCd <= 0 && this.spaniards.length > 0) {
          e.civHuntCd = 0.7 + Math.random() * 1.1;
          let nearest = null;
          let nearestD = CIV_HUNT_RANGE;
          // Prefer civilians already being held (backup for a pull-apart)
          for (const s of this.spaniards) {
            if (s.hp <= 0 || s.tearing) continue;
            const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
            const score = s.heldBy ? d * 0.45 : d;
            if (score < nearestD) {
              nearestD = score;
              nearest = s;
            }
          }
          const p = nearest?.heldBy ? 0.95 : (nearestD < 5 ? 0.9 : 0.72);
          if (nearest && Math.random() < p) {
            e.civTarget = nearest;
            e.civHuntTimer = 10 + Math.random() * 6;
            if (Math.random() < 0.45) this._sayInvader(e, randPick(INVADER_CIV_LINES));
          }
        }

        if (!downed && !stunned && !e.swimming && e.speechCd <= 0) {
          if (Math.random() < 0.4) this._sayInvader(e, randPick(INVADER_MARCH_LINES));
          else e.speechCd = 1.2 + Math.random() * 2;
        }

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
        for (const s of this.spaniards) {
          if (s.hp <= 0 || e.civTarget === s) continue;
          const sx = e.mesh.position.x - s.mesh.position.x;
          const sz = e.mesh.position.z - s.mesh.position.z;
          const sd = Math.hypot(sx, sz);
          const min = e.r + s.r + 0.35;
          if (sd > 0 && sd < min) {
            mx += (sx / sd) * 1.2;
            mz += (sz / sd) * 1.2;
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
        const hunting = !!e.civTarget && e.aggroTimer <= 0;
        moveSpeed = (aggressive ? e.speed * 1.15 : hunting ? e.speed * 1.25 : e.speed) * swimSlow;
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

  _spawnSpaniards(count) {
    if (!this.level || !this._speechLayer) return;
    const shore = this.level.shoreLine;
    const city = this.level.breachZ + 6;
    for (let n = 0; n < count; n++) {
      const x = -16 + Math.random() * 28;
      const z = city + Math.random() * Math.max(4, shore - city - 1);
      this._spawnSpaniard(x, z);
    }
  }

  /** Top up civilians from the city (−Z) as they're killed off. */
  _updateCivilianReinforcements(dt) {
    if (!this.running || !this.level) return;
    this._civReinforceCd = Math.max(0, (this._civReinforceCd ?? 0) - dt);
    if (this._civReinforceCd > 0) return;
    if (this.spaniards.length >= CIV_TARGET_COUNT) {
      this._civReinforceCd = 1.5;
      return;
    }
    this._spawnSpaniardFromNorth();
    const deficit = CIV_TARGET_COUNT - this.spaniards.length;
    // Arrive faster when many are missing
    const haste = deficit >= 5 ? 0.55 : deficit >= 3 ? 0.75 : 1;
    this._civReinforceCd = (CIV_REINFORCE_MIN + Math.random() * (CIV_REINFORCE_MAX - CIV_REINFORCE_MIN)) * haste;
  }

  _spawnSpaniardFromNorth() {
    if (!this.level || !this._speechLayer) return;
    const x = -14 + Math.random() * 28;
    const z = this.level.breachZ - 1.5 - Math.random() * 7;
    const homeX = clamp(x + (Math.random() - 0.5) * 5, -16, 16);
    const homeZ = this.level.breachZ + 5 + Math.random() * Math.max(3, this.level.shoreLine - this.level.breachZ - 6);
    const s = this._spawnSpaniard(x, z, { fromNorth: true });
    if (!s) return;
    s.homeX = homeX;
    s.homeZ = homeZ;
    s.wanderTx = homeX;
    s.wanderTz = homeZ;
    s.wanderCd = 0.2;
    // Face south toward the beach
    s.mesh.rotation.y = Math.atan2(homeX - s.mesh.position.x, homeZ - s.mesh.position.z);
    if (Math.random() < 0.35) {
      this._saySpaniard(s, randPick(WELCOME_LINES), false);
    }
  }

  _spawnSpaniard(x, z, opts = {}) {
    this._pos.x = x;
    this._pos.z = z;
    resolveCircle(this._pos, 0.36, this.level.walls);
    x = this._pos.x;
    const zMin = opts.fromNorth ? this.level.breachZ - 10 : this.level.breachZ + 3;
    z = clamp(this._pos.z, zMin, this.level.shoreLine - 0.5);

    const female = Math.random() < 0.48;
    const mesh = createPerson(spainClothes(female), { armed: false, female });
    setArmed(mesh, false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.random() * Math.PI * 2;

    const hpBar = createHealthBar();
    mesh.add(hpBar);
    this.world.add(mesh);

    const bubble = document.createElement('div');
    bubble.className = 'speech';
    this._speechLayer.appendChild(bubble);

    const s = {
      mesh,
      hpBar,
      bubble,
      female,
      r: female ? 0.34 : 0.36,
      hp: 5,
      maxHp: 5,
      speed: 2.4 + Math.random() * 0.4,
      fleeSpeed: 5.2 + Math.random() * 0.6,
      fearTimer: 0,
      speechCd: 1 + Math.random() * 4,
      speechLife: 0,
      wanderCd: Math.random() * 2,
      wanderTx: x,
      wanderTz: z,
      homeX: x,
      homeZ: z,
      kbx: 0,
      kbz: 0,
      hitFlash: 0,
      fleeX: 0,
      fleeZ: 1,
      pullPressure: 0,
      tearing: null,
      heldBy: null,
      holdTimer: 0,
    };
    this.spaniards.push(s);
    return s;
  }

  _saySpaniard(s, text, fear = false) {
    if (!s.bubble) return;
    s.bubble.textContent = text;
    s.bubble.classList.toggle('fear', fear);
    s.bubble.classList.add('on');
    s.speechLife = fear ? 2.4 : 2.8;
    s.speechCd = fear ? 1.2 : 4 + Math.random() * 5;
  }

  _hurtSpaniard(s, damage, dirX = 0, dirZ = 0, opts = {}) {
    if (!s || s.hp <= 0 || s.tearing) return;
    // Being held — still take damage but no flee knockback
    const held = !!s.heldBy;
    s.hp -= damage;
    s.hitFlash = 0.14;
    s.fearTimer = Math.max(s.fearTimer, SPANIARD_FEAR_TIME);
    if (!held) {
      s.fleeX = dirX;
      s.fleeZ = dirZ;
      const len = Math.hypot(dirX, dirZ) || 1;
      const knock = opts.fromPlayer ? MELEE_KNOCK_SPEED * 1.05 : PLAYER_KNOCK_SPEED * 0.85;
      s.kbx = (dirX / len) * knock;
      s.kbz = (dirZ / len) * knock;
    } else {
      s.kbx = 0;
      s.kbz = 0;
    }
    this._saySpaniard(s, randPick(FEAR_LINES), true);
    if (!opts.fromPlayer) this.sfx.playerHurt();
    updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y);
    if (opts.fromPlayer) {
      this._bloodSpray(s.mesh.position.x, s.mesh.position.z, dirX, dirZ, { mild: true });
    }

    // Nearby invaders join in on the victim (not when the player struck them)
    if (!opts.fromPlayer) {
      for (const e of this.enemies) {
        if (e.aggroTimer > 0 || e.knockdownTimer > 0 || e.tearing || e.holding) continue;
        const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
        if (d > 8) continue;
        if (e.civTarget === s) {
          e.civHuntTimer = Math.max(e.civHuntTimer, 8);
          continue;
        }
        if (!e.civTarget && Math.random() < 0.65) {
          e.civTarget = s;
          e.civHuntTimer = 8 + Math.random() * 4;
        }
      }

      // Two+ invaders in melee can start a pull-apart
      const swarm = this._countSwarmOn(s, 3.1);
      if (swarm >= 2 && !s.tearing) {
        s.pullPressure = (s.pullPressure || 0) + 1;
        if (s.pullPressure >= 2 || (s.hp <= 2 && Math.random() < 0.55) || Math.random() < 0.28) {
          this._beginTearSpaniard(s);
          return;
        }
      }
    }

    if (s.hp <= 0) {
      this._killSpaniard(s, { fromPunch: !!opts.fromPlayer, dirX, dirZ });
    }
  }

  _countSwarmOn(s, range) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.tearing) continue;
      const targeting = e.civTarget === s || e.holding === s;
      if (!targeting) continue;
      const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
      if (d <= range) n += 1;
    }
    return n;
  }

  /** Solo invader pins a civilian and calls for backup to pull them apart. */
  _beginHoldCivilian(holder, s) {
    if (!holder || !s || s.tearing || s.heldBy || holder.holding || holder.tearing) return;
    s.heldBy = holder;
    s.holdTimer = HOLD_DURATION;
    s.kbx = 0;
    s.kbz = 0;
    s.fearTimer = HOLD_DURATION;
    holder.holding = s;
    holder.civTarget = s;
    holder.civHuntTimer = HOLD_DURATION + 1;
    holder.kbx = 0;
    holder.kbz = 0;
    this._saySpaniard(s, randPick(FEAR_LINES), true);
    this._sayInvader(holder, randPick(INVADER_CIV_LINES));
    this._callHelpForHold(s, holder);
  }

  _callHelpForHold(s, holder) {
    for (const e of this.enemies) {
      if (e === holder || e.tearing || e.holding || e.knockdownTimer > 0) continue;
      const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
      if (d > 20) continue;
      // Drop gate trek and come help
      if (!e.civTarget || e.civTarget === s || Math.random() < 0.75) {
        e.civTarget = s;
        e.civHuntTimer = Math.max(e.civHuntTimer, 9);
        if (d < 12 && Math.random() < 0.35) this._sayInvader(e, randPick(INVADER_CIV_LINES));
      }
    }
  }

  _releaseHold(s) {
    if (!s?.heldBy) return;
    const h = s.heldBy;
    if (h.holding === s) h.holding = null;
    s.heldBy = null;
    s.holdTimer = 0;
    s.mesh.position.y = 0;
    s.fearTimer = Math.max(s.fearTimer, SPANIARD_FEAR_TIME);
  }

  _updateHoldings(dt) {
    for (let i = this.spaniards.length - 1; i >= 0; i--) {
      const s = this.spaniards[i];
      if (!s.heldBy || s.tearing) continue;

      s.holdTimer = Math.max(0, s.holdTimer - dt);
      const holder = s.heldBy;
      const holderOk = this.enemies.includes(holder) && holder.hp > 0 && !holder.knockdownTimer;

      if (!holderOk || s.holdTimer <= 0) {
        this._releaseHold(s);
        continue;
      }

      // Second invader in range → start the pull-apart
      if (this._countSwarmOn(s, 3.2) >= 2) {
        this._beginTearSpaniard(s);
        continue;
      }

      // Pin civilian in front of holder
      const hx = holder.mesh.position.x;
      const hz = holder.mesh.position.z;
      const facing = holder.mesh.rotation.y;
      const fx = Math.sin(facing);
      const fz = Math.cos(facing);
      s.mesh.position.x = hx + fx * 0.75;
      s.mesh.position.z = hz + fz * 0.75;
      s.mesh.position.y = 0.35 + Math.sin(this.time * 8) * 0.03;
      s.mesh.rotation.y = facing + Math.PI;
      s.kbx = 0;
      s.kbz = 0;

      // Holder grab pose
      holder.mesh.position.y = 0;
      const rig = holder.mesh.userData.rig;
      if (rig?.lArm && rig?.rArm) {
        rig.lArm.rotation.x = -1.2;
        rig.rArm.rotation.x = -1.2;
        rig.lArm.rotation.z = -0.25;
        rig.rArm.rotation.z = 0.25;
        if (rig.lElbow) rig.lElbow.rotation.x = -0.4;
        if (rig.rElbow) rig.rElbow.rotation.x = -0.4;
      }
      // Victim struggle
      const vrig = s.mesh.userData.rig;
      if (vrig?.lArm && vrig?.rArm) {
        const flail = Math.sin(this.time * 12) * 0.45;
        vrig.lArm.rotation.x = -0.8 + flail;
        vrig.rArm.rotation.x = -0.8 - flail;
        vrig.lArm.rotation.z = -0.5;
        vrig.rArm.rotation.z = 0.5;
      }

      if (s.speechCd <= 0) this._saySpaniard(s, randPick(FEAR_LINES), true);
      // Periodically yell for more help
      if (Math.random() < dt * 0.35) this._callHelpForHold(s, holder);

      if (s.hpBar) updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y);
    }
  }

  _pickTearPair(s) {
    const candidates = [];
    for (const e of this.enemies) {
      if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.tearing) continue;
      const targeting = e.civTarget === s || e.holding === s;
      if (!targeting) continue;
      const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
      if (d <= 3.8) candidates.push(e);
    }
    // Always include the holder if present
    if (s.heldBy && this.enemies.includes(s.heldBy) && !candidates.includes(s.heldBy)) {
      candidates.push(s.heldBy);
    }
    if (candidates.length < 2) return null;
    let best = null;
    let bestD = -1;
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const d = Math.hypot(
          candidates[i].mesh.position.x - candidates[j].mesh.position.x,
          candidates[i].mesh.position.z - candidates[j].mesh.position.z,
        );
        if (d > bestD) {
          bestD = d;
          best = [candidates[i], candidates[j]];
        }
      }
    }
    return best;
  }

  /** Start a 1–2s lift-and-stretch pull-apart by two invaders. */
  _beginTearSpaniard(s) {
    if (!s || s.tearing || s.hp <= 0) return;
    const pair = this._pickTearPair(s);
    if (!pair) return;
    const [a, b] = pair;

    // Clear hold state into tear
    if (s.heldBy) {
      if (s.heldBy.holding === s) s.heldBy.holding = null;
      s.heldBy = null;
      s.holdTimer = 0;
    }
    if (a.holding === s) a.holding = null;
    if (b.holding === s) b.holding = null;

    let ax = b.mesh.position.x - a.mesh.position.x;
    let az = b.mesh.position.z - a.mesh.position.z;
    let al = Math.hypot(ax, az);
    if (al < 0.15) {
      const ang = Math.random() * Math.PI * 2;
      ax = Math.cos(ang);
      az = Math.sin(ang);
      al = 1;
    }
    ax /= al;
    az /= al;

    const sx = s.mesh.scale.x;
    const sy = s.mesh.scale.y;
    const sz = s.mesh.scale.z;

    s.tearing = {
      t: 0,
      dur: TEAR_DURATION,
      a,
      b,
      ax,
      az,
      cx: s.mesh.position.x,
      cz: s.mesh.position.z,
      sx,
      sy,
      sz,
    };
    s.kbx = 0;
    s.kbz = 0;
    s.fearTimer = TEAR_DURATION + 1;
    a.tearing = s;
    b.tearing = s;
    a.kbx = 0;
    a.kbz = 0;
    b.kbx = 0;
    b.kbz = 0;
    a.civHuntTimer = TEAR_DURATION + 1;
    b.civHuntTimer = TEAR_DURATION + 1;

    this._saySpaniard(s, randPick(FEAR_LINES), true);
    this._sayInvader(a, randPick(INVADER_CIV_LINES));
    if (Math.random() < 0.7) this._sayInvader(b, randPick(INVADER_CIV_LINES));
    this._bloodSpray(s.mesh.position.x, s.mesh.position.z, ax, az, { mild: false });
  }

  _updateTearings(dt) {
    for (let i = this.spaniards.length - 1; i >= 0; i--) {
      const s = this.spaniards[i];
      if (!s.tearing) continue;
      const T = s.tearing;
      T.t += dt;
      const u = Math.min(1, T.t / T.dur);

      const aOk = this.enemies.includes(T.a) && T.a.hp > 0;
      const bOk = this.enemies.includes(T.b) && T.b.hp > 0;
      if (!aOk || !bOk) {
        this._cancelTear(s);
        continue;
      }

      // Ease curves: lift early, stretch through mid, snap at end
      const liftU = u < 0.18 ? (u / 0.18) * (u / 0.18) : 1;
      const stretchU = u < 0.12 ? 0 : Math.min(1, (u - 0.12) / 0.72);
      const stretchEase = stretchU * stretchU * (3 - 2 * stretchU);
      const pullOut = 0.55 + stretchEase * 1.55;
      const lift = liftU * 0.95;

      // Hold attackers on opposite sides; they lean back as the stretch grows
      const a = T.a;
      const b = T.b;
      a.mesh.position.x = T.cx - T.ax * pullOut;
      a.mesh.position.z = T.cz - T.az * pullOut;
      a.mesh.position.y = 0;
      b.mesh.position.x = T.cx + T.ax * pullOut;
      b.mesh.position.z = T.cz + T.az * pullOut;
      b.mesh.position.y = 0;
      a.mesh.rotation.y = Math.atan2(T.ax, T.az);
      b.mesh.rotation.y = Math.atan2(-T.ax, -T.az);
      a.mesh.rotation.x = 0;
      b.mesh.rotation.x = 0;

      // Pulling pose — arms out toward the victim
      this._posePuller(a, 1);
      this._posePuller(b, -1);

      // Victim held between them, stretched along the pull axis
      const stretch = 1 + stretchEase * 1.75;
      s.mesh.position.set(T.cx, lift, T.cz);
      // Align local +X with pull axis so non-uniform scale stretches sideways
      s.mesh.rotation.y = Math.atan2(T.ax, T.az) - Math.PI / 2;
      s.mesh.rotation.x = Math.sin(this.time * 18) * 0.04 * stretchEase;
      s.mesh.scale.set(T.sx * stretch, T.sy * (1 - stretchEase * 0.12), T.sz * (1 - stretchEase * 0.08));

      if (s.hpBar) s.hpBar.visible = false;

      // Struggle flail
      const rig = s.mesh.userData.rig;
      if (rig?.lArm && rig?.rArm) {
        const flail = Math.sin(this.time * 14) * 0.5;
        rig.lArm.rotation.x = -1.2 + flail;
        rig.rArm.rotation.x = -1.2 - flail;
        rig.lArm.rotation.z = -0.6;
        rig.rArm.rotation.z = 0.6;
        if (rig.lLeg) rig.lLeg.rotation.x = 0.4 + flail * 0.4;
        if (rig.rLeg) rig.rLeg.rotation.x = 0.4 - flail * 0.4;
      }

      if (s.speechCd <= 0) this._saySpaniard(s, randPick(FEAR_LINES), true);

      if (u >= 1) {
        this._finishTearSpaniard(s);
      }
    }
  }

  _posePuller(e, sideSign) {
    const rig = e.mesh.userData.rig;
    if (!rig?.lArm || !rig?.rArm) return;
    // Both arms reach forward/out as if gripping the victim
    rig.lArm.rotation.x = -1.35;
    rig.rArm.rotation.x = -1.35;
    rig.lArm.rotation.z = -0.35 * sideSign;
    rig.rArm.rotation.z = 0.35 * sideSign;
    if (rig.lElbow) rig.lElbow.rotation.x = -0.25;
    if (rig.rElbow) rig.rElbow.rotation.x = -0.25;
    if (rig.lLeg) rig.lLeg.rotation.x = 0.25;
    if (rig.rLeg) rig.rLeg.rotation.x = -0.15;
  }

  _cancelTear(s) {
    if (!s?.tearing) return;
    const T = s.tearing;
    if (T.a) T.a.tearing = null;
    if (T.b) T.b.tearing = null;
    s.tearing = null;
    s.mesh.scale.set(T.sx, T.sy, T.sz);
    s.mesh.position.y = 0;
    s.mesh.rotation.x = 0;
    s.fearTimer = Math.max(s.fearTimer, SPANIARD_FEAR_TIME);
  }

  /** Snap — limbs fly toward each puller, stump drops. */
  _finishTearSpaniard(s) {
    const idx = this.spaniards.indexOf(s);
    if (idx < 0) return;
    const T = s.tearing;
    const x = s.mesh.position.x;
    const z = s.mesh.position.z;
    const ax = T?.ax ?? 1;
    const az = T?.az ?? 0;

    if (T?.a) T.a.tearing = null;
    if (T?.b) T.b.tearing = null;
    if (T?.a) {
      T.a.civTarget = null;
      T.a.civHuntTimer = 0;
      if (Math.random() < 0.6) this._sayInvader(T.a, randPick(INVADER_CIV_LINES));
    }
    if (T?.b) {
      T.b.civTarget = null;
      T.b.civHuntTimer = 0;
      if (Math.random() < 0.6) this._sayInvader(T.b, randPick(INVADER_CIV_LINES));
    }
    for (const e of this.enemies) {
      if (e.civTarget === s) {
        e.civTarget = null;
        e.civHuntTimer = 0;
      }
    }

    s.tearing = null;
    s.mesh.scale.set(T.sx, T.sy, T.sz);
    s.mesh.rotation.x = 0;

    if (s.hpBar) s.hpBar.visible = false;
    const parts = detachBodyParts(s.mesh);
    for (const p of parts) {
      // Leftish parts fly toward A (−axis), rightish toward B (+axis)
      const towardA = p.name === 'lArm' || p.name === 'lLeg' || (p.name === 'head' && Math.random() < 0.5);
      const sign = towardA ? -1 : 1;
      const sp = 6 + Math.random() * 7;
      const jx = (Math.random() - 0.5) * 3;
      const jz = (Math.random() - 0.5) * 3;
      this._spawnGib(
        p.mesh,
        ax * sign * sp + jx,
        az * sign * sp + jz,
        3.5 + Math.random() * 5,
      );
    }
    if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
    this._spawnGib(s.mesh, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2);

    if (s.bubble) s.bubble.remove();
    this.spaniards.splice(idx, 1);

    this._bloodBurst(x, z, { heavy: true });
    this.sfx.knockdown();
    this.shake = Math.min(1.1, this.shake + 0.5);
  }

  _spawnGib(mesh, vx, vz, vy, life = 2.4) {
    this.world.add(mesh);
    this.fx.push({
      mesh,
      vx,
      vz,
      vy,
      life: life * (0.85 + Math.random() * 0.3),
      max: life,
      spin: (Math.random() - 0.5) * 14,
      gib: true,
    });
  }

  /** Mild directional punch spray. */
  _bloodSpray(x, z, dirX = 0, dirZ = 0, { mild = true } = {}) {
    const n = mild ? 5 + Math.floor(Math.random() * 4) : 12 + Math.floor(Math.random() * 6);
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * (mild ? 1.1 : 1.8);
      const px = -nz * spread + nx * (0.3 + Math.random());
      const pz = nx * spread + nz * (0.3 + Math.random());
      const sp = (mild ? 1.8 : 3.5) + Math.random() * (mild ? 2.5 : 4);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06 + Math.random() * 0.06, 0.06, 0.06 + Math.random() * 0.06),
        makeMat(COL.blood),
      );
      mesh.position.set(x, 0.9 + Math.random() * 0.5, z);
      this.world.add(mesh);
      this.fx.push({
        mesh,
        vx: px * sp,
        vz: pz * sp,
        vy: (mild ? 1.2 : 2.2) + Math.random() * 2.5,
        life: (mild ? 0.28 : 0.45) * (0.7 + Math.random() * 0.5),
        max: mild ? 0.35 : 0.55,
      });
    }
  }

  /** Heavy tear blood — spray + ground pools. */
  _bloodBurst(x, z, { heavy = false } = {}) {
    this._spark(x, z, COL.blood, heavy ? 34 : 14, heavy ? 0.7 : 0.4, 1.15);
    this._bloodSpray(x, z, Math.random() - 0.5, Math.random() - 0.5, { mild: false });
    this._bloodSpray(x, z, Math.random() - 0.5, Math.random() - 0.5, { mild: false });
    const pools = heavy ? 5 : 2;
    for (let i = 0; i < pools; i++) {
      const size = (heavy ? 0.35 : 0.2) + Math.random() * (heavy ? 0.45 : 0.25);
      const mesh = new THREE.Mesh(
        new THREE.CircleGeometry(size, 10),
        new THREE.MeshBasicMaterial({
          color: COL.blood,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(
        x + (Math.random() - 0.5) * (heavy ? 1.4 : 0.6),
        0.06,
        z + (Math.random() - 0.5) * (heavy ? 1.4 : 0.6),
      );
      mesh.renderOrder = 2;
      this.world.add(mesh);
      this.fx.push({
        mesh,
        vx: 0,
        vz: 0,
        vy: 0,
        life: heavy ? 4.5 + Math.random() * 2 : 2.5,
        max: heavy ? 6 : 3,
        gravity: false,
        pool: true,
        grow: true,
      });
    }
  }

  /** Drop 1–2 limbs with mild force (punch deaths). */
  _mildDismember(root, dirX = 0, dirZ = 0) {
    const pool = ['lArm', 'rArm', 'lLeg', 'rLeg'];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const count = Math.random() < 0.35 ? 2 : 1;
    const names = pool.slice(0, count);
    if (Math.random() < 0.12) names.push('head');
    const parts = detachBodyParts(root, names);
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    for (const p of parts) {
      const sp = 2.2 + Math.random() * 2.8;
      this._spawnGib(
        p.mesh,
        nx * sp + (Math.random() - 0.5) * 2,
        nz * sp + (Math.random() - 0.5) * 2,
        1.8 + Math.random() * 2.5,
        1.6,
      );
    }
  }

  _killSpaniard(s, opts = {}) {
    if (s.tearing) this._cancelTear(s);
    if (s.heldBy) this._releaseHold(s);
    const idx = this.spaniards.indexOf(s);
    if (idx < 0) return;
    const x = s.mesh.position.x;
    const z = s.mesh.position.z;
    if (opts.fromPunch && Math.random() < 0.42) {
      this._mildDismember(s.mesh, opts.dirX || 0, opts.dirZ || 0);
    }
    this._bloodSpray(x, z, opts.dirX || 0, opts.dirZ || 0, { mild: true });
    this._spark(x, z, COL.blood, 8, 0.3, 1.0);
    this.world.remove(s.mesh);
    if (s.bubble) s.bubble.remove();
    this.spaniards.splice(idx, 1);
    for (const e of this.enemies) {
      if (e.civTarget === s) {
        e.civTarget = null;
        e.civHuntTimer = 0;
      }
      if (e.tearing === s) e.tearing = null;
      if (e.holding === s) e.holding = null;
    }
  }

  _updateSpaniards(dt) {
    for (let i = this.spaniards.length - 1; i >= 0; i--) {
      const s = this.spaniards[i];
      s.hitFlash = Math.max(0, s.hitFlash - dt);
      s.fearTimer = Math.max(0, s.fearTimer - dt);
      s.speechCd = Math.max(0, s.speechCd - dt);
      s.speechLife = Math.max(0, s.speechLife - dt);
      s.wanderCd = Math.max(0, s.wanderCd - dt);

      if (s.hitFlash > 0) setTint(s.mesh, 0xffffff);
      else clearTint(s.mesh);

      if (s.speechLife <= 0 && s.bubble) s.bubble.classList.remove('on');

      // Being pulled apart or held — posing handled elsewhere
      if (s.tearing || s.heldBy) continue;

      let mx = 0;
      let mz = 0;
      let moveSpeed = 0;
      const fleeing = s.fearTimer > 0;

      if (fleeing) {
        // Run away from attacker with confused zig-zag
        let fx = s.fleeX;
        let fz = s.fleeZ;
        const fl = Math.hypot(fx, fz);
        if (fl < 0.05) {
          // Default: away from nearest invader, else toward city
          let nearest = null;
          let nd = 12;
          for (const e of this.enemies) {
            const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
            if (d < nd) {
              nd = d;
              nearest = e;
            }
          }
          if (nearest) {
            fx = s.mesh.position.x - nearest.mesh.position.x;
            fz = s.mesh.position.z - nearest.mesh.position.z;
          } else {
            fx = 0;
            fz = -1;
          }
        }
        const n = Math.hypot(fx, fz) || 1;
        fx /= n;
        fz /= n;
        const wobble = Math.sin(this.time * 9 + i * 2.1) * 0.55;
        mx = fx + (-fz) * wobble;
        mz = fz + fx * wobble;
        s.mesh.rotation.y = Math.atan2(mx, mz);
        moveSpeed = s.fleeSpeed;

        if (s.speechCd <= 0 && Math.random() < 0.35) {
          this._saySpaniard(s, randPick(FEAR_LINES), true);
        }
      } else {
        // Greet nearby invaders
        let greet = null;
        let greetD = SPANIARD_GREET_RANGE;
        for (const e of this.enemies) {
          if (e.swimming) continue;
          const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
          if (d < greetD) {
            greetD = d;
            greet = e;
          }
        }

        if (greet) {
          const dx = greet.mesh.position.x - s.mesh.position.x;
          const dz = greet.mesh.position.z - s.mesh.position.z;
          s.mesh.rotation.y = Math.atan2(dx, dz);
          // Drift a little toward them to welcome — but keep a polite distance
          if (greetD > 2.8) {
            mx = dx / (greetD || 1);
            mz = dz / (greetD || 1);
            moveSpeed = s.speed * 0.7;
          }
          if (s.speechCd <= 0) {
            this._saySpaniard(s, randPick(WELCOME_LINES), false);
          }
        } else {
          // Idle wander near home
          if (s.wanderCd <= 0) {
            s.wanderTx = s.homeX + (Math.random() - 0.5) * 6;
            s.wanderTz = clamp(
              s.homeZ + (Math.random() - 0.5) * 4,
              this.level.breachZ + 3,
              this.level.shoreLine - 0.5,
            );
            s.wanderCd = 2.5 + Math.random() * 4;
          }
          const dx = s.wanderTx - s.mesh.position.x;
          const dz = s.wanderTz - s.mesh.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.4) {
            mx = dx / dist;
            mz = dz / dist;
            moveSpeed = s.speed * 0.55;
            s.mesh.rotation.y = Math.atan2(mx, mz);
          }
        }
      }

      // Separation from other Spaniards and invaders
      for (const o of this.spaniards) {
        if (o === s) continue;
        const sx = s.mesh.position.x - o.mesh.position.x;
        const sz = s.mesh.position.z - o.mesh.position.z;
        const sd = Math.hypot(sx, sz);
        const min = s.r + o.r + 0.25;
        if (sd > 0 && sd < min) {
          mx += (sx / sd) * 1.4;
          mz += (sz / sd) * 1.4;
        }
      }
      for (const e of this.enemies) {
        if (fleeing) continue;
        const sx = s.mesh.position.x - e.mesh.position.x;
        const sz = s.mesh.position.z - e.mesh.position.z;
        const sd = Math.hypot(sx, sz);
        const min = s.r + e.r + 0.5;
        if (sd > 0 && sd < min) {
          mx += (sx / sd) * 0.9;
          mz += (sz / sd) * 0.9;
        }
      }

      const mLen = Math.hypot(mx, mz);
      const kbLen = Math.hypot(s.kbx, s.kbz);
      if (mLen > 0.05) {
        mx /= mLen;
        mz /= mLen;
        const control = kbLen > 2 ? 0.35 : 1;
        s.mesh.position.x += mx * moveSpeed * dt * control;
        s.mesh.position.z += mz * moveSpeed * dt * control;
      }

      if (kbLen > 0.02) {
        s.mesh.position.x += s.kbx * dt;
        s.mesh.position.z += s.kbz * dt;
        const damp = Math.exp(-PLAYER_KNOCK_DECAY * dt);
        s.kbx *= damp;
        s.kbz *= damp;
      } else {
        s.kbx = 0;
        s.kbz = 0;
      }

      this._pos.x = s.mesh.position.x;
      this._pos.z = s.mesh.position.z;
      resolveCircle(this._pos, s.r, this.level.walls);
      s.mesh.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
      s.mesh.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);
      // Keep on the beach / promenade — not in deep water
      if (s.mesh.position.z > this.level.waterLine + 1) {
        s.mesh.position.z = this.level.waterLine + 1;
      }

      const waving = !fleeing && s.speechLife > 0;
      animatePerson(
        s.mesh,
        dt,
        moveSpeed,
        fleeing,
        fleeing,
        false,
      );
      updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y);
      // Friendly wave while greeting (override walk arm after anim)
      if (waving && s.mesh.userData.rig?.rArm) {
        const rig = s.mesh.userData.rig;
        const wave = Math.sin(this.time * 10) * 0.35;
        rig.rArm.rotation.x = -1.4 + wave;
        rig.rArm.rotation.z = 0.25;
        if (rig.rElbow) rig.rElbow.rotation.x = -0.25;
      }
    }
  }

  _updateSpeechBubbles() {
    if (!this._speechLayer || !this.canvas) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const place = (mesh, bubble, speechLife) => {
      if (!bubble || speechLife <= 0) return;
      this._proj.set(mesh.position.x, 2.15, mesh.position.z);
      this._proj.project(this.camera);
      if (this._proj.z > 1) {
        bubble.style.visibility = 'hidden';
        return;
      }
      bubble.style.visibility = 'visible';
      const sx = (this._proj.x * 0.5 + 0.5) * w;
      const sy = (-this._proj.y * 0.5 + 0.5) * h;
      bubble.style.left = `${sx}px`;
      bubble.style.top = `${sy}px`;
    };
    for (const s of this.spaniards) place(s.mesh, s.bubble, s.speechLife);
    for (const e of this.enemies) place(e.mesh, e.bubble, e.speechLife);
  }

  _breach(index) {
    const e = this.enemies[index];
    if (!e) return;
    this.breached += 1;
    this.shake = Math.min(1.0, this.shake + 0.35);
    this._spark(e.mesh.position.x, e.mesh.position.z, 0xaa3030, 10, 0.35, 1.0);
    this.sfx.breach();
    // Nearby invaders cheer the breach
    for (const o of this.enemies) {
      if (o === e) continue;
      const d = Math.hypot(o.mesh.position.x - e.mesh.position.x, o.mesh.position.z - e.mesh.position.z);
      if (d < 10 && Math.random() < 0.4) this._sayInvader(o, randPick(INVADER_BREACH_LINES));
    }
    if (e.bubble) e.bubble.remove();
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

  _killEnemy(index, opts = {}) {
    const e = this.enemies[index];
    if (!e) return;
    if (e.holding) this._releaseHold(e.holding);
    if (e.tearing) {
      // Don't cancel mid-tear of a civilian if this invader dies — cancelTear handles pair
    }
    const x = e.mesh.position.x;
    const z = e.mesh.position.z;
    if (opts.fromPunch && Math.random() < 0.4) {
      this._mildDismember(e.mesh, opts.dirX || 0, opts.dirZ || 0);
    }
    this._bloodSpray(x, z, opts.dirX || 0, opts.dirZ || 0, { mild: true });
    this._spark(x, z, COL.blood, 10, 0.35, 1.0);
    this.sfx.enemyDie();
    if (e.bubble) e.bubble.remove();
    this.world.remove(e.mesh);
    this.enemies.splice(index, 1);
    this.score += e.score;
  }

  _hurt(amount, dirX = 0, dirZ = 0) {
    if (!this.playerAlive) return;
    this.hp = Math.max(0, this.hp - amount);
    this.regenDelay = HP_REGEN_DELAY;
    this.regenAcc = 0;
    this.shake = Math.min(1.2, this.shake + 0.55);
    this.sfx.playerHurt();

    const len = Math.hypot(dirX, dirZ);
    if (len > 0.01) {
      const power = PLAYER_KNOCK_SPEED * (0.85 + 0.2 * amount);
      this.kbx = (dirX / len) * power;
      this.kbz = (dirZ / len) * power;
    }

    setTint(this.player, 0xffffff);
    setTimeout(() => { if (this.playerAlive) clearTint(this.player); }, 80);
    this._spark(this.player.position.x, this.player.position.z, COL.blood, 8, 0.32, 1.0);
    this._renderHp();
    updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y);
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

      if (f.pool) {
        const t = Math.max(0, f.life / f.max);
        if (f.grow && f.life > f.max * 0.7) {
          const u = 1 - (f.life - f.max * 0.7) / (f.max * 0.3);
          f.mesh.scale.setScalar(0.4 + u * 0.6);
        }
        if (f.mesh.material) {
          f.mesh.material.opacity = Math.min(0.8, t * 1.1);
          f.mesh.material.transparent = true;
        }
        if (f.life <= 0) {
          this.world.remove(f.mesh);
          this.fx.splice(i, 1);
        }
        continue;
      }

      if (f.gib) {
        f.mesh.rotation.x += f.spin * dt * 0.45;
        f.mesh.rotation.y += f.spin * dt;
        f.mesh.rotation.z += f.spin * dt * 0.3;
        if (f.mesh.position.y < 0.08) {
          f.mesh.position.y = 0.08;
          f.vy *= -0.25;
          f.vx *= 0.65;
          f.vz *= 0.65;
          f.spin *= 0.7;
        }
        if (f.life <= 0) {
          this.world.remove(f.mesh);
          this.fx.splice(i, 1);
        }
        continue;
      }

      if (f.spin) f.mesh.rotation.z += f.spin * dt;
      const t = Math.max(0, f.life / f.max);
      if (f.grow) f.mesh.scale.setScalar(0.6 + (1 - t) * 1.8);
      else f.mesh.scale.setScalar(0.45 + t * 0.7);
      if (f.mesh.material) {
        f.mesh.material.opacity = t * (f.grow ? 0.55 : 0.85);
        f.mesh.material.transparent = true;
      }
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
    if (this.el.breached) {
      this.el.breached.textContent = `${this.breached}/${this.breachLimit}`;
    }
    if (this.el.enemies) {
      this.el.enemies.textContent = String(this.enemies.length + this.boats.reduce((n, b) => n + b.passengers.length, 0));
    }
    this._renderRadar();
  }

  /**
   * World-fixed radar: city (−Z) at top, sea (+Z) at bottom.
   */
  _renderRadar() {
    const canvas = this.el.radar;
    const ctx = this._radarCtx;
    if (!canvas || !ctx || !this.level) return;

    const w = canvas.width;
    const h = canvas.height;
    const half = this.level.HALF;
    // Pad so edge markers aren't clipped
    const pad = 8;
    const scale = (Math.min(w, h) - pad * 2) / (half * 2);

    const toX = (wx) => w * 0.5 + wx * scale;
    // Flip Z so city (−Z) is toward the top of the radar
    const toY = (wz) => h * 0.5 + wz * scale;

    ctx.clearRect(0, 0, w, h);

    // Water / sand / city bands
    const band = (z0, z1, color) => {
      const y0 = toY(z0);
      const y1 = toY(z1);
      ctx.fillStyle = color;
      ctx.fillRect(pad, Math.min(y0, y1), w - pad * 2, Math.abs(y1 - y0));
    };
    band(half, this.level.waterLine, 'rgba(26, 74, 106, 0.85)');
    band(this.level.waterLine, this.level.shoreLine, 'rgba(58, 138, 170, 0.55)');
    band(this.level.shoreLine, this.level.breachZ + 4, 'rgba(216, 196, 154, 0.35)');
    band(this.level.breachZ + 4, -half, 'rgba(90, 90, 88, 0.45)');

    // Fence (east)
    ctx.strokeStyle = 'rgba(180, 190, 200, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(toX(this.level.fenceX), toY(-half + 2));
    ctx.lineTo(toX(this.level.fenceX), toY(half - 2));
    ctx.stroke();

    // Gate / breach
    const dest = this.level.destination;
    const gw = this.level.breachHalfW * scale;
    ctx.fillStyle = 'rgba(232, 196, 106, 0.85)';
    ctx.fillRect(toX(dest.x) - gw, toY(dest.z) - 2, gw * 2, 4);

    // Border
    ctx.strokeStyle = 'rgba(74, 160, 192, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Boats
    for (const b of this.boats) {
      const x = toX(b.mesh.position.x);
      const y = toY(b.mesh.position.z);
      ctx.fillStyle = '#e8a040';
      ctx.beginPath();
      ctx.moveTo(x, y - 4);
      ctx.lineTo(x + 3.5, y + 3);
      ctx.lineTo(x - 3.5, y + 3);
      ctx.closePath();
      ctx.fill();
    }

    // Spaniards
    ctx.fillStyle = '#8ec8e0';
    for (const s of this.spaniards) {
      if (s.hp <= 0) continue;
      ctx.beginPath();
      ctx.arc(toX(s.mesh.position.x), toY(s.mesh.position.z), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Invaders
    for (const e of this.enemies) {
      const x = toX(e.mesh.position.x);
      const y = toY(e.mesh.position.z);
      ctx.fillStyle = e.aggroTimer > 0 || e.civTarget ? '#e05040' : '#c04038';
      ctx.beginPath();
      ctx.arc(x, y, e.kind === 'sturdy' ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player — chevron facing movement / facing yaw
    if (this.player && this.playerAlive) {
      const px = toX(this.player.position.x);
      const py = toY(this.player.position.z);
      // yaw 0 faces +Z (down on radar); rotate chevron accordingly
      const ang = this.player.rotation.y;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-ang);
      ctx.fillStyle = '#e8c46a';
      ctx.strokeStyle = 'rgba(8, 22, 32, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 5);
      ctx.lineTo(4, -4);
      ctx.lineTo(0, -1.5);
      ctx.lineTo(-4, -4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
