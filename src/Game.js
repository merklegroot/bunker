import * as THREE from 'three';
import { Input } from './Input.js';
import { Sfx } from './Audio.js';
import {
  createPerson, animatePerson, setTint, clearTint, setArmed, setMachete,
  createHealthBar, updateHealthBar, detachBodyParts,
} from './Character.js';
import {
  buildLevelSpec,
  buildLevelMeshes,
  buildNavGrid,
  resolveCircle,
  hasLineOfSight,
  circleHitsWall,
  segmentHitsWall,
  wall,
  steerTo,
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
const HP_REGEN_DELAY = 2.0;
const HP_REGEN_RATE = 0.4; // player hearts per second after delay
/** Living units (invaders / civilians): fraction of max HP healed per second after delay. */
const UNIT_REGEN_FRAC = 0.1;
const VIEW_NEAR = 10;
const VIEW_FAR = 24;
const LEADER_POUND_RADIUS = 3.1;
const LEADER_POUND_RISE = 0.32;
const LEADER_POUND_HANG = 0.14;
const LEADER_POUND_SLAM = 0.2;
const LEADER_CLUB_MAX_HITS = 3;
const LEADER_CLUB_REACH = 2.6;
const LEADER_CLUB_SWING = 0.58;
const LEADER_CLUB_READY = 0.55;
const CAM_VIEW_H = 13.5;
/** Ortho frustum scale: lower = zoomed in. */
const CAM_ZOOM_MIN = 0.72;
const CAM_ZOOM_MAX = 1.38;
const BULLET_KNOCKBACK = 0.28;
const BREACH_LIMIT = 12;
const AGGRO_DURATION = 3.25;
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
const TEAR_PAIR_CIV_RANGE = 5.2;
const TEAR_PAIR_ALLY_RANGE = 7.5;
const PUNCH_HUNT_CIV_RANGE = 6.5;
const TEAR_DURATION = 1.7;
const HOLD_DURATION = 5.5;
const BEHEAD_PIN = 0.75;
const BEHEAD_DRAW = 1.35;
const BEHEAD_RAISE = 2.2;
const BEHEAD_CHOP = 2.5;
const BEHEAD_END = 3.15;
/** Swim pose: nearly prone so the water plane occludes torso/hips/legs. */
const SWIM_PITCH = 1.42;
const SWIM_Y = -0.34;
const CIV_TARGET_COUNT = 18;
const CIV_REINFORCE_MIN = 1.2;
const CIV_REINFORCE_MAX = 2.5;
const TOWER_RANGE = 13;
const TOWER_FIRE_CD = 0.9;
const TOWER_DAMAGE = 1;
const TOWER_HP = 28;
const TOWER_PICKUP_RANGE = 2.4;
const TOWER_START_COUNT = 0;
const TOWER_SHOP_COST = 25;
const TOWER_OWN_CAP = 6;
const TOWER_CARRY_CAP = 1;
const START_GOLD = 50;
const SIM_FAST_SCALE = 2.5;
const ARROW_SPEED = 26;
const ARROW_LIFE = 1.4;

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

const LEADER_LINES = [
  'With me!',
  'Take the beach!',
  'No mercy!',
  'Forward — now!',
  'Break them!',
  'I lead. You follow.',
];

const SPAIN_SKINS = [0xd4b08a, 0xc4a070, 0xb89068, 0xdbc4a0];
const SPAIN_HAIR = [0x1a120e, 0x3a2818, 0x5a3a20, 0x2a1c14, 0x6a5030];
// No Moroccan flag greens / crimson — mostly yellow, white, blue (red rare)
const SPAIN_SHIRTS = [
  0xf0ece4, // white
  0xe8e0d4, // cream
  0xe8c84a, // Spanish yellow
  0xf0b429, // gold
  0x2a4a6a, // navy
  0x4a7a9a, // sky blue
  0x5a6a7a, // slate
  0x3a5a78, // steel blue
  0xd8c8a0, // sand
];
const SPAIN_PANTS = [0x2a3540, 0x3a4550, 0x4a3a30, 0x1a3048, 0x5a5048, 0x2a2a38];
const SPAIN_SHIRTS_F = [
  0xf0ece4,
  0xe8e0d4,
  0xe8c84a,
  0xf0b429,
  0x6a8ab0, // blue
  0x5a6a9a, // periwinkle
  0xe8a070, // peach
  0xd8b8c8, // pale lilac
  0xd87890, // soft pink (occasional)
];

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
    gold: 4,
    skin: 0xb89060,
  },
  sturdy: {
    name: 'sturdy',
    hp: 12,
    speed: 2.6,
    radius: 0.42,
    damage: 2,
    score: 18,
    gold: 8,
    skin: 0xa87850,
  },
  sprinter: {
    name: 'sprinter',
    hp: 4,
    speed: 5.0,
    radius: 0.32,
    damage: 1,
    score: 14,
    gold: 6,
    skin: 0xc4a070,
  },
  leader: {
    name: 'leader',
    hp: 26,
    speed: 3.5,
    radius: 0.5,
    damage: 3,
    score: 80,
    gold: 30,
    skin: 0x6e4a32,
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

function leaderClothes(skin) {
  return {
    skin: skin || 0x6e4a32,
    shirt: 0xc2c6ca,
    pants: 0x1a221c,
    boot: 0x0c0a08,
    hair: 0x0e0a08,
    gun: 0x2a3038,
  };
}

function spainClothes(female = false) {
  const hair = female
    ? randPick([0x1a120e, 0x3a2818, 0x5a3a20, 0x6a5030, 0x8a6040, 0xc4a060])
    : randPick(SPAIN_HAIR);
  return {
    skin: randPick(SPAIN_SKINS),
    shirt: randPick(female ? SPAIN_SHIRTS_F : SPAIN_SHIRTS),
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

/** Small wooden archery platform with a bow mount. */
function createArrowTowerMesh({ ghost = false } = {}) {
  const opacity = ghost ? 0.4 : 1;
  const mat = (c) => makeMat(c, ghost
    ? { transparent: true, opacity, depthWrite: false }
    : {});
  const g = new THREE.Group();
  const wood = mat(0x6b4a2a);
  const dark = mat(0x3d2918);
  const iron = mat(0x5a6068);

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.28, 1.15), wood);
  base.position.y = 0.14;
  g.add(base);

  for (const [x, z] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.7, 0.14), dark);
    post.position.set(x, 0.95, z);
    g.add(post);
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 1.05), wood);
  deck.position.y = 1.72;
  g.add(deck);

  const railN = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 0.08), dark);
  railN.position.set(0, 1.9, -0.48);
  g.add(railN);
  const railS = railN.clone();
  railS.position.z = 0.48;
  g.add(railS);

  const mount = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.32), iron);
  mount.position.y = 1.92;
  g.add(mount);

  const bow = new THREE.Group();
  bow.position.y = 2.1;
  const limb = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.07), dark);
  bow.add(limb);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.4), dark);
  stock.position.z = 0.12;
  bow.add(stock);
  g.add(bow);
  g.userData.bow = bow;

  return g;
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
    this.timeScale = 1;
    this.score = 0;
    this.gold = START_GOLD;
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
    this.debugGatesClosed = false;
    this.debugSpeech = true;
    this.debugAttacks = { punch: true, behead: true, tear: true, club: true };
    this.debugLeader = { pound: true, charge: true };
    this._gateBarrierWall = null;
    this._gateBarrierMesh = null;
    this._dbgMenuOpen = false;

    this.enemies = [];
    this.spaniards = [];
    this.boats = [];
    this.fx = [];
    this.arrows = [];
    this.towers = []; // placed towers: { mesh, wall, fireCd, hp, maxHp, hitFlash }
    this.towerStock = 0; // towers currently carried
    this._carryMesh = null;
    this._towerGhost = null;
    this._levelRoot = null;
    this._speechLayer = null;
    this._proj = new THREE.Vector3();
    this._keysWas = new Set();

    this._wavePhase = 'prep'; // 'prep' | 'active'
    this._waveTimer = 0;
    this._waveSpawning = false;
    this._toSpawn = 0;
    this._spawnCd = 0;
    this._waveClearDelay = 0;
    this._waveClearCelebrating = false;
    this._civReinforceCd = 3;

    this._moveSpeed = 0;
    this._pos = { x: 0, z: 0 };

    this.level = buildLevelSpec(1);
    this.nav = buildNavGrid(this.level);

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
    this._camOffset = new THREE.Vector3(0, 18, 13);
    this.camZoom = 1;
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
      gold: document.getElementById('gold'),
      wave: document.getElementById('wave'),
      breached: document.getElementById('breached'),
      enemies: document.getElementById('enemies'),
      hp: document.getElementById('hp'),
      stamina: document.getElementById('stamina'),
      staminaFill: document.getElementById('staminaFill'),
      prompt: document.getElementById('prompt'),
      waveBanner: document.getElementById('waveBanner'),
      waveBannerNum: document.getElementById('waveBannerNum'),
      shop: document.getElementById('shop'),
      shopGold: document.getElementById('shopGold'),
      towerCost: document.getElementById('towerCost'),
      buyTowerBtn: document.getElementById('buyTowerBtn'),
      simControls: document.getElementById('simControls'),
      btnPause: document.getElementById('btnPause'),
      btnPlay: document.getElementById('btnPlay'),
      btnFast: document.getElementById('btnFast'),
      btnNextWave: document.getElementById('btnNextWave'),
      btnReset: document.getElementById('btnReset'),
      radar: document.getElementById('radar'),
      dbgBtn: document.getElementById('dbgBtn'),
      dbgMenu: document.getElementById('dbgMenu'),
      dbgGatesBtn: document.getElementById('dbgGatesBtn'),
      dbgSpeechBtn: document.getElementById('dbgSpeechBtn'),
      dbgAtkPunch: document.getElementById('dbgAtkPunch'),
      dbgAtkBehead: document.getElementById('dbgAtkBehead'),
      dbgAtkTear: document.getElementById('dbgAtkTear'),
      dbgAtkClub: document.getElementById('dbgAtkClub'),
      dbgLeadPound: document.getElementById('dbgLeadPound'),
      dbgLeadCharge: document.getElementById('dbgLeadCharge'),
    };
    this._speechLayer = document.getElementById('speechLayer');
    this._radarCtx = this.el.radar?.getContext('2d') ?? null;
    this.el.startBtn.addEventListener('click', () => this.start());
    this.el.resumeBtn.addEventListener('click', () => this.resume());
    this.el.restartBtn.addEventListener('click', () => this.start());
    if (this.el.buyTowerBtn) {
      this.el.buyTowerBtn.addEventListener('click', () => this._buyTower());
    }
    if (this.el.btnPause) this.el.btnPause.addEventListener('click', () => this._setTimeScale(0));
    if (this.el.btnPlay) this.el.btnPlay.addEventListener('click', () => this._setTimeScale(1));
    if (this.el.btnFast) this.el.btnFast.addEventListener('click', () => this._setTimeScale(SIM_FAST_SCALE));
    if (this.el.btnNextWave) this.el.btnNextWave.addEventListener('click', () => this._requestNextWave());
    if (this.el.btnReset) this.el.btnReset.addEventListener('click', () => this._resetLevel());
    if (this.el.towerCost) this.el.towerCost.textContent = String(TOWER_SHOP_COST);
    if (this.el.dbgBtn) {
      this.el.dbgBtn.addEventListener('click', () => this._toggleDebugMenu());
    }
    if (this.el.dbgGatesBtn) {
      this.el.dbgGatesBtn.addEventListener('click', () => {
        this._setGatesClosed(!this.debugGatesClosed);
        this.sfx.uiClick();
      });
    }
    if (this.el.dbgSpeechBtn) {
      this.el.dbgSpeechBtn.addEventListener('click', () => {
        this._setDebugSpeech(!this.debugSpeech);
        this.sfx.uiClick();
      });
    }
    for (const [key, el] of [
      ['punch', this.el.dbgAtkPunch],
      ['behead', this.el.dbgAtkBehead],
      ['tear', this.el.dbgAtkTear],
      ['club', this.el.dbgAtkClub],
    ]) {
      if (!el) continue;
      el.addEventListener('click', () => {
        this._setDebugAttack(key, !this.debugAttacks[key]);
        this.sfx.uiClick();
      });
    }
    for (const [key, el] of [
      ['pound', this.el.dbgLeadPound],
      ['charge', this.el.dbgLeadCharge],
    ]) {
      if (!el) continue;
      el.addEventListener('click', () => {
        this._setDebugLeader(key, !this.debugLeader[key]);
        this.sfx.uiClick();
      });
    }
    this._renderDebugToggles();
    this._renderHp();
    this._renderStamina();
    this._setShopOpen(false);
    this._renderSimControls();

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
    for (const a of this.arrows) this.world.remove(a.mesh);
    this.enemies.length = 0;
    this.spaniards.length = 0;
    this.boats.length = 0;
    this.fx.length = 0;
    this.arrows.length = 0;
    this._clearAllTowers();
    if (this._speechLayer) this._speechLayer.replaceChildren();
  }

  start() {
    this.sfx.unlock();
    this.sfx.uiClick();
    this._clearEntities();

    this.score = 0;
    this.gold = START_GOLD;
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
    this.timeScale = 1;
    this.running = true;
    this.time = 0;
    this.playerAlive = true;
    this.player.visible = true;
    clearTint(this.player);
    setArmed(this.player, false);

    this._loadMap();
    this._spawnSpaniards(16);
    this._civReinforceCd = 2;
    this._giveTowers(TOWER_START_COUNT);
    this._enterWavePrep(1);
    this._setShopOpen(true);

    this.input.keys.clear();
    this._keysWas = new Set();
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
    this.nav = buildNavGrid(this.level);

    this.world.remove(this.fogMask);
    this.fogMask = createFogMask(this.level.MAP);
    this.world.add(this.fogMask);

    this.player.position.set(this.level.playerSpawn.x, 0, this.level.playerSpawn.z);
    this.player.rotation.y = 0;
    setArmed(this.player, false);
    this._syncGateBarrier();
  }

  _toggleDebugMenu() {
    this._dbgMenuOpen = !this._dbgMenuOpen;
    if (this.el.dbgMenu) this.el.dbgMenu.classList.toggle('hidden', !this._dbgMenuOpen);
    if (this.el.dbgBtn) this.el.dbgBtn.setAttribute('aria-expanded', this._dbgMenuOpen ? 'true' : 'false');
    this.sfx.uiClick();
  }

  _paintDebugToggle(el, name, on, { nowOn = 'ON', nowOff = 'OFF', nextOn = 'turn on', nextOff = 'turn off' } = {}) {
    if (!el) return;
    el.classList.toggle('on', !!on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    const now = on ? nowOn : nowOff;
    const next = on ? nextOff : nextOn;
    el.title = `${name} is ${now}. Click to ${next}.`;
    el.setAttribute('aria-label', `${name} ${now}, click to ${next}`);
    el.innerHTML = (
      `<span class="dbgName">${name}</span>`
      + `<span class="dbgNow">${now}</span>`
      + `<span class="dbgNext">→ ${next}</span>`
    );
  }

  _renderDebugToggles() {
    this._paintDebugToggle(this.el.dbgGatesBtn, 'Gates', this.debugGatesClosed, {
      nowOn: 'CLOSED',
      nowOff: 'OPEN',
      nextOn: 'close',
      nextOff: 'open',
    });
    this._paintDebugToggle(this.el.dbgSpeechBtn, 'Speech', this.debugSpeech);
    this._paintDebugToggle(this.el.dbgAtkPunch, 'Punch', this.debugAttacks.punch);
    this._paintDebugToggle(this.el.dbgAtkBehead, 'Behead', this.debugAttacks.behead);
    this._paintDebugToggle(this.el.dbgAtkTear, 'Tear apart', this.debugAttacks.tear);
    this._paintDebugToggle(this.el.dbgAtkClub, 'Club body', this.debugAttacks.club);
    this._paintDebugToggle(this.el.dbgLeadPound, 'Ground pound', this.debugLeader.pound);
    this._paintDebugToggle(this.el.dbgLeadCharge, 'Machete charge', this.debugLeader.charge);
  }

  _leadEnabled(kind) {
    return !!(this.debugLeader && this.debugLeader[kind]);
  }

  _setDebugLeader(kind, on) {
    if (!this.debugLeader || !(kind in this.debugLeader)) return;
    this.debugLeader[kind] = !!on;
    this._renderDebugToggles();
  }

  _setDebugSpeech(on) {
    this.debugSpeech = !!on;
    this._renderDebugToggles();
    if (!this.debugSpeech) {
      const hush = (list) => {
        if (!list) return;
        for (const u of list) {
          u.speechLife = 0;
          if (u.bubble) u.bubble.classList.remove('on');
        }
      };
      hush(this.enemies);
      hush(this.spaniards);
    }
  }

  _atkEnabled(kind) {
    return !!(this.debugAttacks && this.debugAttacks[kind]);
  }

  /** True when this is the only civilian attack still enabled (forces more frequent commits). */
  _atkSolo(kind) {
    if (!this._atkEnabled(kind)) return false;
    const keys = Object.keys(this.debugAttacks || {});
    return keys.every((k) => k === kind || !this.debugAttacks[k]);
  }

  _setDebugAttack(kind, on) {
    if (!this.debugAttacks || !(kind in this.debugAttacks)) return;
    this.debugAttacks[kind] = !!on;
    this._renderDebugToggles();
    // Drop hunts that are no longer allowed
    if (!this.debugAttacks[kind] && this.enemies) {
      for (const e of this.enemies) {
        if (e.civHuntMode === kind && !e.holding && !e.tearing && !e.beheading && !e.weaponCiv) {
          this._clearCivHunt(e);
        }
        if (kind === 'club' && e.weaponCiv) this._discardClubWeapon(e, { fling: true });
      }
    }
  }

  _setGatesClosed(closed) {
    this.debugGatesClosed = !!closed;
    this._renderDebugToggles();
    this._syncGateBarrier();
    if (this.running) {
      this._setPrompt(this.debugGatesClosed
        ? 'GATES CLOSED — invaders wander; they only fight you if you hit them'
        : 'GATES OPEN — breach escape restored');
    }
  }

  _disposeGateBarrier() {
    if (this._gateBarrierWall && this.level?.walls) {
      const i = this.level.walls.indexOf(this._gateBarrierWall);
      if (i >= 0) this.level.walls.splice(i, 1);
    }
    this._gateBarrierWall = null;
    if (this._gateBarrierMesh) {
      this.world.remove(this._gateBarrierMesh);
      this._gateBarrierMesh = null;
    }
  }

  _syncGateBarrier() {
    this._disposeGateBarrier();
    if (!this.level) return;
    if (!this.debugGatesClosed) {
      this.nav = buildNavGrid(this.level);
      return;
    }

    const z = this.level.breachZ;
    const w = this.level.breachHalfW * 2;
    this._gateBarrierWall = wall(0, z, w, 0.85, 3.4);
    this._gateBarrierWall._gateBarrier = true;
    this.level.walls.push(this._gateBarrierWall);

    const group = new THREE.Group();
    group.position.set(0, 0, z);
    const mat = new THREE.MeshLambertMaterial({ color: 0x5a5048 });
    const barMat = new THREE.MeshLambertMaterial({ color: 0x3a3830 });
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 3.05, 0.38), mat);
      door.position.set(side * (w * 0.25), 1.52, 0);
      group.add(door);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.42, 0.18, 0.2), barMat);
      bar.position.set(side * (w * 0.25), 1.55, 0.22);
      group.add(bar);
    }
    this.world.add(group);
    this._gateBarrierMesh = group;
    this.nav = buildNavGrid(this.level);
  }

  _enterWavePrep(wave) {
    this.wave = wave;
    this._wavePhase = 'prep';
    this._waveSpawning = false;
    this._toSpawn = 0;
    this._spawnCd = 0;
    this._waveClearDelay = 0;
    this._waveClearCelebrating = false;
    this._waveTimer = 0;
    this._fullHeal();
    this._hideWaveWinBanner();
    this._setPrompt(this._prepPrompt());
    this._renderSimControls();
  }

  /** Restore player + placed towers at the end of a wave. */
  _fullHeal() {
    this.hp = this.maxHp;
    this.regenAcc = 0;
    this.regenDelay = 0;
    this.stamina = MAX_STAMINA;
    this.staminaRegenCd = 0;
    clearTint(this.player);
    for (const t of this.towers) {
      t.hp = t.maxHp ?? TOWER_HP;
      t.hitFlash = 0;
      clearTint(t.mesh);
      updateHealthBar(t.hpBar, t.hp, t.maxHp, t.mesh.rotation.y);
    }
    this._renderHp();
    this._renderStamina();
    updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y, this.player.rotation.x);
  }

  _prepPrompt() {
    const action = this.towerStock > 0
      ? 'PLACE TOWER'
      : (this.towers.length > 0 ? 'PICK UP TOWER' : 'BUY A TOWER');
    return `<kbd>R</kbd> START WAVE ${this.wave} &nbsp;·&nbsp; <kbd>RMB</kbd> ${action}`;
  }

  _showWaveWinBanner(wave) {
    if (!this.el?.waveBanner) return;
    if (this.el.waveBannerNum) this.el.waveBannerNum.textContent = String(wave);
    this.el.waveBanner.classList.remove('hidden');
    void this.el.waveBanner.offsetWidth;
    this.el.waveBanner.classList.add('on');
    this.sfx.waveClear(wave);
    this.shake = Math.min(0.7, this.shake + 0.2);
  }

  _hideWaveWinBanner() {
    if (!this.el?.waveBanner) return;
    this.el.waveBanner.classList.remove('on');
    const el = this.el.waveBanner;
    clearTimeout(this._waveBannerHideT);
    this._waveBannerHideT = setTimeout(() => {
      if (!el.classList.contains('on')) el.classList.add('hidden');
    }, 400);
  }

  _beginWave(wave) {
    this.wave = wave;
    this._wavePhase = 'active';
    this._waveSpawning = true;
    // Wave 1 stays light so the player can learn the beach
    const base = wave <= 1
      ? 3
      : 4 + wave * 2;
    const jitter = wave <= 1 ? 2 : 3;
    this._toSpawn = Math.min(40, base + Math.floor(Math.random() * jitter));
    this._spawnCd = 1.2;
    this._waveClearDelay = 0;
    this._waveClearCelebrating = false;
    this._waveTimer = 0;
    // Pack leader each wave (including wave 1 for testing)
    this._leaderPending = wave >= 1;
    this.sfx.waveStart(wave);
    this._hideWaveWinBanner();
    this._setPrompt('');
    this._renderSimControls();
  }

  _setShopOpen(open) {
    if (!this.el.shop) return;
    this.el.shop.classList.toggle('hidden', !open);
    if (this.el.simControls) this.el.simControls.classList.toggle('hidden', !open);
    if (open) {
      this._renderShop();
      this._renderSimControls();
    }
  }

  _setTimeScale(scale) {
    if (!this.running || this.paused || !this.playerAlive) return;
    this.timeScale = scale;
    this.sfx.uiClick();
    this._renderSimControls();
  }

  _renderSimControls() {
    const scale = this.timeScale;
    if (this.el.btnPause) this.el.btnPause.classList.toggle('on', scale <= 0);
    if (this.el.btnPlay) this.el.btnPlay.classList.toggle('on', scale > 0 && scale < SIM_FAST_SCALE - 0.1);
    if (this.el.btnFast) this.el.btnFast.classList.toggle('on', scale >= SIM_FAST_SCALE - 0.1);
    if (this.el.btnNextWave) {
      const canNext = this.running && this.playerAlive && this._wavePhase === 'prep';
      this.el.btnNextWave.disabled = !canNext;
    }
  }

  _requestNextWave() {
    if (!this.running || this.paused || !this.playerAlive) return;
    if (this._wavePhase !== 'prep') {
      this.sfx.uiClick();
      return;
    }
    this.sfx.uiClick();
    if (this.timeScale <= 0) this.timeScale = 1;
    this._beginWave(this.wave);
    this._renderSimControls();
  }

  /** Full level restart from wave 1. */
  _resetLevel() {
    this.start();
    this._setPrompt('LEVEL RESET');
  }

  _towerOwnedCount() {
    return this.towers.length + this.towerStock;
  }

  _renderShop() {
    if (this.el.shopGold) this.el.shopGold.textContent = String(this.gold);
    if (!this.el.buyTowerBtn) return;
    const atCap = this._towerOwnedCount() >= TOWER_OWN_CAP;
    const carrying = this.towerStock >= TOWER_CARRY_CAP;
    const canBuy = this.gold >= TOWER_SHOP_COST && !atCap && !carrying;
    this.el.buyTowerBtn.disabled = !canBuy;
    if (carrying) this.el.buyTowerBtn.title = 'Place your tower before buying another';
    else if (atCap) this.el.buyTowerBtn.title = `Tower limit (${TOWER_OWN_CAP})`;
    else if (canBuy) this.el.buyTowerBtn.title = 'Buy arrow tower';
    else this.el.buyTowerBtn.title = `Need ${TOWER_SHOP_COST} gold`;
  }

  _buyTower() {
    if (!this.running || this.paused || !this.playerAlive) return;
    if (this.towerStock >= TOWER_CARRY_CAP) {
      this.sfx.uiClick();
      return;
    }
    if (this._towerOwnedCount() >= TOWER_OWN_CAP) {
      this.sfx.uiClick();
      return;
    }
    if (this.gold < TOWER_SHOP_COST) {
      this.sfx.uiClick();
      return;
    }
    this.gold -= TOWER_SHOP_COST;
    this.towerStock = Math.min(TOWER_CARRY_CAP, this.towerStock + 1);
    this._syncCarryMesh();
    this._renderShop();
    this._renderHud();
    this.sfx.towerPickup();
    if (this._wavePhase === 'prep') this._setPrompt(this._prepPrompt());
  }

  _setPrompt(html) {
    if (!this.el.prompt) return;
    this.el.prompt.innerHTML = html || '';
    this.el.prompt.classList.toggle('on', !!html);
  }

  _pressed(code) {
    return this.input.keys.has(code) && !this._keysWas.has(code);
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
    this._hideWaveWinBanner();
    this._setPrompt('');
    this._setShopOpen(false);
    this.timeScale = 1;
    this.sfx.gameOver(reason);
    const title = reason === 'breach' ? 'BREACHED' : 'FALLEN';
    const subtitle = reason === 'breach'
      ? 'Too many reached the city. Tarajal is overrun.'
      : 'You went down on the sand. The line broke.';
    this._showMenu({
      title,
      subtitle,
      finalScore: `WAVE  ${this.wave}   ·   GOLD  ${this.gold}   ·   THROUGH  ${this.breached}`,
      mode: 'end',
    });
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this._applyCameraZoom();
  }

  _applyCameraZoom() {
    const w = window.innerWidth;
    const h = Math.max(1, window.innerHeight);
    const aspect = w / h;
    const viewH = CAM_VIEW_H * (this.camZoom || 1);
    const viewW = viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.updateProjectionMatrix();
  }

  _handleZoom() {
    const wheel = this.input.consumeWheel?.() ?? 0;
    let next = this.camZoom || 1;
    if (wheel) {
      next *= Math.exp(wheel * 0.00115);
    }
    // Hold = / + to zoom in, - to zoom out
    if (this.input.keys.has('Equal') || this.input.keys.has('NumpadAdd')) {
      next *= 0.985;
    }
    if (this.input.keys.has('Minus') || this.input.keys.has('NumpadSubtract')) {
      next *= 1.015;
    }
    next = clamp(next, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
    if (Math.abs(next - this.camZoom) > 0.0001) {
      this.camZoom = next;
      this._applyCameraZoom();
    }
  }

  _frame(now) {
    const dt = Math.min(0.033, (now - this._last) / 1000);
    this._last = now;
    this._handleZoom();
    if (this.paused) {
      this._updateCamera();
    } else if (this.running) {
      if (this.timeScale <= 0) {
        this._updateSimPaused();
      } else {
        const simDt = Math.min(0.05, dt * this.timeScale);
        this.update(simDt);
      }
    } else {
      this._idleFx(dt);
    }
    this.render();
    requestAnimationFrame((t) => this._frame(t));
  }

  /** Frozen sim: shop + tower place/pickup + next wave still work. */
  _updateSimPaused() {
    if (this.playerAlive) {
      this._updateTowerInteract();
      if (this._wavePhase === 'prep' && this._pressed('KeyR')) {
        this._requestNextWave();
      }
    }
    this._updateSpeechBubbles();
    this._updateCamera();
    this._renderHud();
    this._keysWas = new Set(this.input.keys);
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
    if (this.playerAlive) {
      this._updatePlayer(dt);
      this._updateTowerInteract();
    }
    this._updateTower(dt);
    this._updateArrows(dt);
    this._updateBoats(dt);
    this._updateEnemies(dt);
    this._updateSpaniards(dt);
    this._updateCivilianReinforcements(dt);
    this._updateHoldings(dt);
    this._updateClubWeapons(dt);
    this._updateBeheadings(dt);
    this._updateTearings(dt);
    this._updateFx(dt);
    this._updateSpeechBubbles();
    this._updateCamera();
    this._renderHud();

    this._keysWas = new Set(this.input.keys);
  }

  _updateWaves(dt) {
    this._waveTimer += dt;

    if (this._wavePhase === 'prep') {
      if (this._pressed('KeyR')) {
        this._beginWave(this.wave);
      }
      return;
    }

    if (this._waveSpawning) {
      this._spawnCd -= dt;
      if (this._spawnCd <= 0 && this._toSpawn > 0) {
        this._spawnInvasionUnit();
        this._toSpawn -= 1;
        this._spawnCd = Math.max(0.35, 1.1 - this.wave * 0.06) + Math.random() * 0.4;
      }
      if (this._toSpawn <= 0) this._waveSpawning = false;
    } else if (this.enemies.length === 0 && this.boats.length === 0) {
      if (!this._waveClearCelebrating) {
        this._waveClearCelebrating = true;
        this._showWaveWinBanner(this.wave);
      }
      this._waveClearDelay += dt;
      if (this._waveClearDelay > 2.5) {
        this.score += 40 + this.wave * 15;
        this._enterWavePrep(this.wave + 1);
      }
    } else {
      this._waveClearDelay = 0;
      this._waveClearCelebrating = false;
    }
  }

  _spawnInvasionUnit() {
    const kind = this._takeSpawnKind();
    const boatChance = this.wave <= 2 ? 0.55 : 0.4;
    // Leader prefers to arrive by boat with an escort when possible
    if (kind === 'leader' || Math.random() < boatChance) {
      this._spawnBoat(kind === 'leader' ? { leader: true } : {});
    } else {
      const spot = randPick(this.level.swimSpawns);
      this._spawnEnemy(
        spot.x + (Math.random() - 0.5) * 2,
        spot.z + (Math.random() - 0.5),
        kind,
        { swimming: true },
      );
    }
  }

  _takeSpawnKind() {
    if (this._leaderPending) {
      this._leaderPending = false;
      return 'leader';
    }
    return pickInvaderKind(this.wave);
  }

  _spawnBoat(opts = {}) {
    const spot = randPick(this.level.boatSpawns);
    const isRaft = opts.leader ? false : Math.random() < 0.45;
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

    const capacity = opts.leader
      ? 3 + Math.floor(Math.random() * 2)
      : (isRaft ? 2 + Math.floor(Math.random() * 2) : 3 + Math.floor(Math.random() * 3));
    const passengers = [];
    if (opts.leader) passengers.push('leader');
    while (passengers.length < capacity) {
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

  _towerWallSet() {
    const set = new Set();
    for (const t of this.towers) {
      if (t.wall) set.add(t.wall);
    }
    return set;
  }

  _wallsWithoutTowers() {
    const skip = this._towerWallSet();
    if (skip.size === 0) return this.level.walls;
    return this.level.walls.filter((w) => !skip.has(w));
  }

  _nearestPlacedTower(x, z, maxDist = Infinity) {
    let best = null;
    let bestD = maxDist;
    for (const t of this.towers) {
      const d = Math.hypot(t.mesh.position.x - x, t.mesh.position.z - z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }

  _clearAllTowers() {
    while (this.towers.length) this._removeTower(this.towers[0], { silent: true });
    this.towerStock = 0;
    if (this._carryMesh) {
      if (this._carryMesh.parent) this._carryMesh.parent.remove(this._carryMesh);
      this._carryMesh = null;
    }
    if (this._towerGhost) {
      this.world.remove(this._towerGhost);
      this._towerGhost = null;
    }
    this._clearTowerAggro();
  }

  _removeTower(t, { silent = false } = {}) {
    const idx = this.towers.indexOf(t);
    if (idx < 0) return;
    if (t.mesh?.parent) t.mesh.parent.remove(t.mesh);
    if (t.wall && this.level?.walls) {
      const wi = this.level.walls.indexOf(t.wall);
      if (wi >= 0) this.level.walls.splice(wi, 1);
    }
    this.towers.splice(idx, 1);
    if (!silent) this.nav = buildNavGrid(this.level);
    if (this.towers.length === 0) this._clearTowerAggro();
  }

  _giveTowers(count = TOWER_START_COUNT) {
    this._clearAllTowers();
    this.towerStock = count;
    this._syncCarryMesh();
    this._towerGhost = createArrowTowerMesh({ ghost: true });
    this._towerGhost.visible = false;
    this.world.add(this._towerGhost);
  }

  _syncCarryMesh() {
    if (this.towerStock > 0) {
      if (!this._carryMesh) {
        this._carryMesh = createArrowTowerMesh();
        this._carryMesh.scale.setScalar(0.55);
        this._carryMesh.position.set(0.45, 1.05, -0.35);
        this._carryMesh.rotation.set(0.15, 0.4, 0.1);
        this.player.add(this._carryMesh);
      }
      this._carryMesh.visible = true;
    } else if (this._carryMesh) {
      this._carryMesh.visible = false;
    }
  }

  _towerPlacePos() {
    const yaw = this.player.rotation.y;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return {
      x: this.player.position.x + fx * 1.55,
      z: this.player.position.z + fz * 1.55,
    };
  }

  _canPlaceTower(x, z) {
    if (!this.level) return false;
    if (z > this.level.waterLine - 0.3) return false;
    if (z < this.level.breachZ + 3) return false;
    if (Math.abs(x) > this.level.HALF - 1.5) return false;
    if (circleHitsWall(x, z, 0.7, this.level.walls)) return false;
    // Keep towers from stacking on each other
    for (const t of this.towers) {
      if (Math.hypot(t.mesh.position.x - x, t.mesh.position.z - z) < 2.2) return false;
    }
    return true;
  }

  _updateTowerInteract() {
    // Ghost preview while carrying at least one
    if (this.towerStock > 0 && this._towerGhost) {
      const p = this._towerPlacePos();
      const ok = this._canPlaceTower(p.x, p.z);
      this._towerGhost.visible = true;
      this._towerGhost.position.set(p.x, 0, p.z);
      this._towerGhost.rotation.y = this.player.rotation.y;
      this._towerGhost.traverse((o) => {
        if (o.isMesh && o.material) {
          o.material.color.setHex(ok ? 0x6b8a4a : 0xa04030);
        }
      });
    } else if (this._towerGhost) {
      this._towerGhost.visible = false;
    }

    if (!this.input.consumeRightClick()) return;

    if (this.towerStock > 0) {
      const p = this._towerPlacePos();
      if (!this._canPlaceTower(p.x, p.z)) {
        this.sfx.uiClick();
        return;
      }
      const mesh = createArrowTowerMesh();
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = this.player.rotation.y;
      this.world.add(mesh);
      const hpBar = createHealthBar({ y: 2.55 });
      mesh.add(hpBar);
      const w = wall(p.x, p.z, 1.05, 1.05, 1.9);
      w._tower = true;
      this.level.walls.push(w);
      this.towers.push({
        mesh,
        wall: w,
        hpBar,
        fireCd: 0.35,
        hp: TOWER_HP,
        maxHp: TOWER_HP,
        hitFlash: 0,
      });
      this.towerStock -= 1;
      this._syncCarryMesh();
      this.nav = buildNavGrid(this.level);
      this.sfx.towerPlace();
      this._renderShop();
      if (this._wavePhase === 'prep') this._setPrompt(this._prepPrompt());
      return;
    }

    // Pick up nearest placed tower in range
    const near = this._nearestPlacedTower(
      this.player.position.x,
      this.player.position.z,
      TOWER_PICKUP_RANGE,
    );
    if (!near) {
      this.sfx.uiClick();
      return;
    }
    if (this.towerStock >= TOWER_CARRY_CAP) {
      this.sfx.uiClick();
      return;
    }
    this._removeTower(near);
    this.towerStock = Math.min(TOWER_CARRY_CAP, this.towerStock + 1);
    this._syncCarryMesh();
    this.sfx.towerPickup();
    this._renderShop();
    if (this._wavePhase === 'prep') this._setPrompt(this._prepPrompt());
  }

  _updateTower(dt) {
    const losWalls = this._wallsWithoutTowers();
    for (const t of this.towers) {
      t.fireCd = Math.max(0, t.fireCd - dt);
      t.hitFlash = Math.max(0, (t.hitFlash || 0) - dt);
      if (t.hitFlash > 0) setTint(t.mesh, 0xffffff);
      else clearTint(t.mesh);

      const bow = t.mesh.userData.bow;
      const tx = t.mesh.position.x;
      const tz = t.mesh.position.z;

      let best = null;
      let bestD = TOWER_RANGE;
      for (const e of this.enemies) {
        if (e.knockdownTimer > 0 || e.hp <= 0) continue;
        const d = Math.hypot(e.mesh.position.x - tx, e.mesh.position.z - tz);
        if (d > bestD) continue;
        if (!hasLineOfSight(tx, tz, e.mesh.position.x, e.mesh.position.z, losWalls)) continue;
        best = e;
        bestD = d;
      }

      if (best && bow) {
        t.mesh.rotation.y = Math.atan2(best.mesh.position.x - tx, best.mesh.position.z - tz);
      }

      updateHealthBar(t.hpBar, t.hp, t.maxHp, t.mesh.rotation.y);

      if (!best || t.fireCd > 0) continue;

      const aimY = best.swimming ? 0.35 : 1.05;
      const fromY = 2.1;
      const dx = best.mesh.position.x - tx;
      const dy = aimY - fromY;
      const dz = best.mesh.position.z - tz;
      const len = Math.hypot(dx, dy, dz) || 1;
      this._spawnArrow(
        tx + (dx / len) * 0.5,
        fromY,
        tz + (dz / len) * 0.5,
        (dx / len) * ARROW_SPEED,
        (dy / len) * ARROW_SPEED,
        (dz / len) * ARROW_SPEED,
      );
      t.fireCd = TOWER_FIRE_CD;
      this.sfx.arrowFire();
    }
  }

  _spawnArrow(x, y, z, vx, vy, vz) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.55),
      makeMat(0xc4a060),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = Math.atan2(vx, vz);
    mesh.rotation.x = Math.atan2(-vy, Math.hypot(vx, vz));
    this.world.add(mesh);
    this.arrows.push({ mesh, vx, vy, vz, life: ARROW_LIFE });
  }

  _updateArrows(dt) {
    const walls = this._wallsWithoutTowers();
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      const ox = a.mesh.position.x;
      const oz = a.mesh.position.z;
      a.life -= dt;
      a.vy -= 4 * dt;
      a.mesh.position.x += a.vx * dt;
      a.mesh.position.y += a.vy * dt;
      a.mesh.position.z += a.vz * dt;
      a.mesh.rotation.y = Math.atan2(a.vx, a.vz);
      a.mesh.rotation.x = Math.atan2(-a.vy, Math.hypot(a.vx, a.vz));

      let dead = a.life <= 0 || a.mesh.position.y < 0.05;
      if (!dead && segmentHitsWall(ox, oz, a.mesh.position.x, a.mesh.position.z, walls, 0.05)) {
        dead = true;
      }

      if (!dead) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const e = this.enemies[j];
          if (e.hp <= 0) continue;
          const ex = e.mesh.position.x - a.mesh.position.x;
          const ez = e.mesh.position.z - a.mesh.position.z;
          const ey = (e.swimming ? 0.3 : 1.0) - a.mesh.position.y;
          if (ex * ex + ez * ez < (e.r + 0.25) ** 2 && Math.abs(ey) < 1.2) {
            const len = Math.hypot(a.vx, a.vz) || 1;
            this._damageEnemy(j, TOWER_DAMAGE, a.vx / len, a.vz / len, MELEE_KNOCK_SPEED * 0.35, {
              aggro: 'tower',
            });
            this._spark(a.mesh.position.x, a.mesh.position.z, 0xc4a060, 4, 0.2, a.mesh.position.y);
            dead = true;
            break;
          }
        }
      }

      if (dead) {
        this.world.remove(a.mesh);
        this.arrows.splice(i, 1);
      }
    }
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

    // Face the way we're moving (yaw before swim pitch — YXZ order)
    if (moving) {
      this.player.rotation.y = Math.atan2(axis.x, axis.y);
    }

    const playerSwimming = this.player.position.z > this.level.waterLine;
    if (playerSwimming) {
      this.player.rotation.x = SWIM_PITCH;
      this.player.rotation.z = 0;
      this.player.position.y = SWIM_Y + Math.sin(this.time * 3.6) * 0.03;
    } else {
      this.player.rotation.x = 0;
      this.player.rotation.z = 0;
      this.player.position.y = 0;
    }

    this._moveSpeed = moving ? speed : 0;
    animatePerson(
      this.player,
      dt,
      this._moveSpeed,
      this.sprinting && !playerSwimming,
      false,
      this.meleeAnim > 0 && !playerSwimming,
      playerSwimming,
    );
    if (!playerSwimming) this._applyMeleePose(dt);
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
  }

  _regenPlayer(dt) {
    if (!this.playerAlive || this.hp <= 0) {
      this.regenAcc = 0;
      if (this.playerHpBar) this.playerHpBar.visible = false;
      return;
    }
    if (this.hp >= this.maxHp) {
      this.regenAcc = 0;
      updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y, this.player.rotation.x);
      return;
    }
    this.regenDelay = Math.max(0, this.regenDelay - dt);
    if (this.regenDelay > 0) {
      updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y, this.player.rotation.x);
      return;
    }

    this.regenAcc += HP_REGEN_RATE * dt;
    if (this.regenAcc >= 1) {
      const healed = Math.floor(this.regenAcc);
      this.regenAcc -= healed;
      this.hp = Math.min(this.maxHp, this.hp + healed);
      if (this.hp >= this.maxHp) this.regenAcc = 0;
    }
    this._renderHp();
    updateHealthBar(
      this.playerHpBar,
      Math.min(this.maxHp, this.hp + this.regenAcc),
      this.maxHp,
      this.player.rotation.y,
      this.player.rotation.x,
    );
  }

  /** Gradual HP restore for invaders / civilians after combat delay. */
  _regenLiving(ent, dt) {
    if (!ent || ent.hp <= 0 || ent.hp >= ent.maxHp) return;
    ent.regenDelay = Math.max(0, (ent.regenDelay ?? 0) - dt);
    if (ent.regenDelay > 0) return;
    const rate = Math.max(0.25, (ent.maxHp || 1) * UNIT_REGEN_FRAC);
    ent.hp = Math.min(ent.maxHp, ent.hp + rate * dt);
  }

  _resetRegen(ent) {
    if (!ent) return;
    ent.regenDelay = HP_REGEN_DELAY;
  }

  _heartSvg(fill, id) {
    // fill 0..1 — classic heart path, fill rises from the bottom
    const t = clamp(fill, 0, 1);
    const y = ((1 - t) * 24).toFixed(2);
    const h = (t * 24).toFixed(2);
    const clip = `hp${id}`;
    return (
      `<svg viewBox="0 0 24 24" aria-hidden="true">`
      + `<path class="heart-outline" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 `
      + `2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 `
      + `19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`
      + `<defs><clipPath id="${clip}"><rect x="0" y="${y}" width="24" height="${h}"/></clipPath></defs>`
      + `<path class="heart-fill" clip-path="url(#${clip})" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 `
      + `2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 `
      + `19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>`
      + `</svg>`
    );
  }

  _renderHp() {
    if (!this.el.hp) return;
    const bits = [];
    const partial = (this.hp < this.maxHp && this.regenDelay <= 0) ? this.regenAcc : 0;
    for (let i = 0; i < this.maxHp; i++) {
      let fill = 0;
      if (i < this.hp) fill = 1;
      else if (i === this.hp) fill = clamp(partial, 0, 1);
      const cls = fill <= 0.001 ? 'empty' : (fill >= 0.999 ? 'full' : 'partial');
      bits.push(`<i class="${cls}">${this._heartSvg(fill, i)}</i>`);
    }
    this.el.hp.innerHTML = bits.join('');
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
        rig.torso.position.y = rig.torsoBaseY ?? 0.95;
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
    // Keep yaw modest so the guard shoulder isn't dragged through a big arc
    const torsoYaw = -side * 0.32 * body;
    if (rig.torso) {
      rig.torso.rotation.y = torsoYaw;
      // Positive X pitches toward +Z (facing), i.e. lean into the punch
      rig.torso.rotation.x = 0.38 * body;
      rig.torso.rotation.z = side * 0.06 * body;
      rig.torso.position.y = (rig.torsoBaseY ?? 0.95) - 0.06 * body;
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

    // Guard arm: stay glued to the chin — cancel torso lean/yaw (arms parented to torso)
    // so the off-hand does not ride the punch.
    const torsoPitch = rig.torso ? rig.torso.rotation.x : 0;
    guardArm.rotation.x = -0.9 - torsoPitch;
    guardArm.rotation.y = -torsoYaw;
    guardArm.rotation.z = -side * 0.22;
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
      e.mesh.position.y = e.swimming ? SWIM_Y : 0;
      if (e.swimming) e.mesh.rotation.x = SWIM_PITCH;
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

    const isLeader = kindKey === 'leader';
    const clothes = isLeader ? leaderClothes(def.skin) : moroccoClothes(def.skin);
    const mesh = createPerson(clothes, {
      armed: false,
      female: false,
      muscular: isLeader,
      bald: isLeader,
    });
    setArmed(mesh, false);
    // Machete only comes out for executions / charge — default combat is fists
    if (isLeader) setMachete(mesh, false);
    mesh.position.set(x, 0, z);
    if (kindKey === 'sprinter') mesh.scale.set(0.85, 0.9, 0.85);
    if (kindKey === 'sturdy') mesh.scale.setScalar(1.15);
    // Leader scale is baked into createPerson(muscular)
    if (opts.swimming) {
      mesh.position.y = SWIM_Y;
      mesh.rotation.x = SWIM_PITCH;
    }

    const hpBar = createHealthBar({ y: isLeader ? 2.55 : 2.15 });
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
      r: def.radius * (kindKey === 'sturdy' ? 1.1 : isLeader ? 1.15 : 1),
      hp: Math.round(def.hp * waveScale),
      maxHp: Math.round(def.hp * waveScale),
      speed: def.speed + Math.random() * (isLeader ? 0.15 : 0.35),
      damage: def.damage,
      score: def.score + this.wave * 2,
      gold: def.gold + Math.floor(this.wave * 0.5),
      hitFlash: 0,
      biteCd: 0.4 + Math.random() * 0.4,
      aggroTimer: 0,
      aggroTarget: null, // 'player' | 'tower' | null
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
      civHuntMode: null, // 'punch' | 'tear' | 'behead' | 'club'
      speechCd: 1.5 + Math.random() * 3,
      speechLife: 0,
      tearing: null,
      holding: null,
      beheading: null,
      weaponCiv: null,
      clubHits: 0,
      clubSwingT: 0,
      clubDidHit: false,
      clubReadyCd: 0,
      regenDelay: 0,
      // Leader: war-cry rally, fists, ground pound, occasional machete charge
      rallyCd: isLeader ? 2.5 + Math.random() * 2 : 0,
      chargeCd: isLeader ? 4 + Math.random() * 2 : 0,
      charging: false,
      chargeT: 0,
      poundCd: isLeader ? 2.2 + Math.random() * 1.5 : 0,
      pounding: false,
      poundPhase: null,
      poundT: 0,
      clubGrabCd: isLeader ? 1.2 + Math.random() : 0,
      rampageT: 0,
      towerSeekCd: isLeader ? 1.5 + Math.random() : 0,
      speedBoostT: 0,
    });
    if (isLeader) {
      this._sayInvader(this.enemies[this.enemies.length - 1], randPick(LEADER_LINES));
    }
  }

  _sayInvader(e, text) {
    if (!this.debugSpeech || !e?.bubble) return;
    e.bubble.textContent = text;
    e.bubble.classList.add('foe', 'on');
    e.bubble.classList.remove('fear');
    e.speechLife = 2.5;
    e.speechCd = 3.5 + Math.random() * 4;
  }

  _enrage(enemy, baseDuration = AGGRO_DURATION, target = 'player') {
    const wasCalm = enemy.aggroTimer <= 0;
    // Scatter so every chase doesn't time out in lockstep
    const duration = baseDuration * (0.7 + Math.random() * 0.7);
    enemy.aggroTimer = Math.max(enemy.aggroTimer, duration);
    enemy.aggroTarget = target;
    enemy.panicked = true;
    if (wasCalm && Math.random() < 0.55) {
      this._sayInvader(enemy, randPick(INVADER_FIGHT_LINES));
    }
  }

  _witnessAttack(victim, excludeIndex = -1, target = 'player') {
    const vx = victim.mesh.position.x;
    const vz = victim.mesh.position.z;
    for (let i = 0; i < this.enemies.length; i++) {
      if (i === excludeIndex) continue;
      const e = this.enemies[i];
      const d = Math.hypot(e.mesh.position.x - vx, e.mesh.position.z - vz);
      if (d > WITNESS_RANGE) continue;
      if (!hasLineOfSight(e.mesh.position.x, e.mesh.position.z, vx, vz, this.level.walls)) continue;
      this._enrage(e, AGGRO_DURATION * 0.85, target);
    }
  }

  _damageEnemy(index, damage, dirX = 0, dirZ = 0, knockSpeed = 0, opts = {}) {
    const e = this.enemies[index];
    if (!e) return;
    const aggro = opts.aggro === 'tower' ? 'tower' : 'player';
    e.hp -= damage;
    this._resetRegen(e);
    e.hitFlash = 0.12;
    this._enrage(e, AGGRO_DURATION, aggro);
    this._witnessAttack(e, index, aggro);
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

  _hurtTower(t, damage) {
    if (!t || !this.towers.includes(t)) return;
    t.hp = Math.max(0, (t.hp ?? TOWER_HP) - damage);
    t.hitFlash = 0.14;
    this.shake = Math.min(0.45, this.shake + 0.08);
    this.sfx.punchHit({ hard: damage >= 2 });
    updateHealthBar(t.hpBar, t.hp, t.maxHp, t.mesh.rotation.y);
    if (t.hp <= 0) {
      this._spark(t.mesh.position.x, t.mesh.position.z, 0xc4a060, 10, 0.35, 1.2);
      this._removeTower(t);
      if (this.towers.length === 0 && this.towerStock === 0) {
        this._setPrompt('TOWERS DESTROYED');
      } else if (this._wavePhase === 'prep') {
        this._setPrompt(this._prepPrompt());
      }
    }
  }

  _clearTowerAggro() {
    if (!this.enemies) return;
    for (const e of this.enemies) {
      if (e.aggroTarget === 'tower') {
        e.aggroTimer = 0;
        e.aggroTarget = null;
        e.panicked = false;
      }
    }
  }

  /** Unit steer toward a world point, pathing around walls when needed. */
  _steer(agent, tx, tz) {
    if (!agent._pathState) agent._pathState = {};
    return steerTo(
      this.nav,
      this.level.walls,
      agent.mesh.position.x,
      agent.mesh.position.z,
      tx,
      tz,
      agent._pathState,
      this.time,
    );
  }

  _updateEnemies(dt) {
    const px = this.player.position.x;
    const pz = this.player.position.z;
    const dest = this.level.destination;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      this._regenLiving(e, dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.biteCd = Math.max(0, e.biteCd - dt);
      e.aggroTimer = Math.max(0, e.aggroTimer - dt);
      e.stunTimer = Math.max(0, e.stunTimer - dt);
      e.comboDecay = Math.max(0, e.comboDecay - dt);
      if (e.comboDecay <= 0) e.comboHits = 0;
      if (e.aggroTimer <= 0) {
        e.panicked = false;
        e.aggroTarget = null;
      }
      // Tower aggro only while a placed tower exists.
      if (e.aggroTarget === 'tower' && this.towers.length === 0) {
        e.aggroTimer = 0;
        e.aggroTarget = null;
        e.panicked = false;
      }
      e.civHuntCd = Math.max(0, e.civHuntCd - dt);
      e.civHuntTimer = Math.max(0, e.civHuntTimer - dt);
      e.speechCd = Math.max(0, e.speechCd - dt);
      e.speechLife = Math.max(0, e.speechLife - dt);
      if (e.speechLife <= 0 && e.bubble) e.bubble.classList.remove('on');
      if (e.civTarget && (e.civTarget.hp <= 0 || !this.spaniards.includes(e.civTarget))) {
        this._clearCivHunt(e);
      }
      if (e.civHuntTimer <= 0 && e.civTarget) this._clearCivHunt(e);

      const wasDown = e.knockdownTimer > 0;
      e.knockdownTimer = Math.max(0, e.knockdownTimer - dt);
      if (wasDown && e.knockdownTimer <= 0) {
        this._setProne(e, false);
      }

      if (e.hitFlash > 0) setTint(e.mesh, 0xffffff);
      else clearTint(e.mesh);

      // Hit the beach — stand and run (don't keep swimming across the sand)
      if (e.swimming && e.mesh.position.z <= this.level.waterLine && e.knockdownTimer <= 0) {
        e.swimming = false;
        e.mesh.position.y = 0;
        e.mesh.rotation.x = 0;
        e.mesh.rotation.z = 0;
        if (e.mesh.userData.rig?.torso) e.mesh.userData.rig.torso.rotation.x = 0;
      }

      e.speedBoostT = Math.max(0, (e.speedBoostT || 0) - dt);
      if (e.kind === 'leader') {
        this._updateLeader(e, dt, px, pz);
      }

      let mx = 0;
      let mz = 0;
      let moveSpeed = 0;
      let phaseWalls = false; // club / charge smash straight through buildings
      const downed = e.knockdownTimer > 0;
      const stunned = e.stunTimer > 0;
      const tearing = !!e.tearing;
      const holding = !!e.holding;
      const beheading = !!e.beheading;
      const clubbing = !!e.weaponCiv;
      const pounding = !!e.pounding;
      const towerTarget = e.aggroTarget === 'tower'
        ? this._nearestPlacedTower(e.mesh.position.x, e.mesh.position.z)
        : null;
      const aggressive = !downed && !stunned && !tearing && !holding && !beheading && !pounding
        && e.aggroTimer > 0
        && (e.aggroTarget === 'tower' ? !!towerTarget : this.playerAlive);

      if (downed || stunned || tearing || holding || beheading || pounding) {
        // No AI — knockback only (hold/tear/behead/pound posing happens in dedicated updates)
        mx = 0;
        mz = 0;
        if (e.charging) {
          e.charging = false;
          e.chargeT = 0;
        }
        if ((downed || stunned) && e.pounding) {
          e.pounding = false;
          e.poundPhase = null;
          e.poundT = 0;
          if (!e.swimming) e.mesh.position.y = 0;
        }
      } else if (clubbing) {
        // Use the dragged body as a weapon against whatever is in reach
        const aim = this._leaderClubAim(e, px, pz);
        if (aim) {
          phaseWalls = true;
          const dist = Math.hypot(aim.x - e.mesh.position.x, aim.z - e.mesh.position.z) || 1;
          const nx = (aim.x - e.mesh.position.x) / dist;
          const nz = (aim.z - e.mesh.position.z) / dist;
          const reach = e.r + (aim.kind === 'player' ? PLAYER_RADIUS : 0.55) + LEADER_CLUB_REACH;
          const holdDist = reach - 0.4;
          e.mesh.rotation.y = this._dampYaw(e.mesh.rotation.y, Math.atan2(nx, nz), dt, 12);
          if (e.clubSwingT > 0 || dist > holdDist + 0.12) {
            mx = nx;
            mz = nz;
          } else if (dist < holdDist - 0.2) {
            mx = -nx;
            mz = -nz;
          } else {
            mx = 0;
            mz = 0;
          }
          if (
            e.clubSwingT <= 0
            && (e.clubReadyCd || 0) <= 0
            && dist < reach + 1.4
          ) {
            e.clubSwingT = LEADER_CLUB_SWING;
            e.clubDidHit = false;
          }
        } else {
          // Nothing to smash — keep rampaging while dragging
          const point = this._leaderRampagePoint(e, dest, dt);
          const steer = this._steer(e, point.x, point.z);
          mx = steer.x;
          mz = steer.z;
          if (mx || mz) {
            e.mesh.rotation.y = this._dampYaw(e.mesh.rotation.y, Math.atan2(mx, mz), dt, 8);
          }
        }
      } else if (e.charging && this.playerAlive) {
        // Leader machete charge — straight rush through buildings, heavy hit on contact
        phaseWalls = true;
        const dist = Math.hypot(px - e.mesh.position.x, pz - e.mesh.position.z) || 1;
        mx = (px - e.mesh.position.x) / dist;
        mz = (pz - e.mesh.position.z) / dist;
        e.mesh.rotation.y = Math.atan2(mx, mz);
        const punchReach = e.r + PLAYER_RADIUS + 0.55;
        if (dist < punchReach) {
          const nx = mx;
          const nz = mz;
          this._hurt(e.damage + 1, nx, nz);
          this.kbx = nx * PLAYER_KNOCK_SPEED * 1.6;
          this.kbz = nz * PLAYER_KNOCK_SPEED * 1.6;
          this._spark(px, pz, COL.blood, 10, 0.35, 1.15);
          this.sfx.punchHit({ hard: true });
          this._sayInvader(e, randPick(LEADER_LINES));
          e.charging = false;
          e.chargeT = 0;
          e.biteCd = 0.9;
          setMachete(e.mesh, false);
        }
      } else if (aggressive && e.aggroTarget === 'tower' && towerTarget) {
        const tx = towerTarget.mesh.position.x;
        const tz = towerTarget.mesh.position.z;
        const punchReach = e.r + 0.75;
        const holdDist = punchReach - 0.15;
        const dist = Math.hypot(tx - e.mesh.position.x, tz - e.mesh.position.z) || 1;
        const steer = this._steer(e, tx, tz);
        e.mesh.rotation.y = Math.atan2(steer.x || (tx - e.mesh.position.x), steer.z || (tz - e.mesh.position.z));

        if (dist > holdDist + 0.12) {
          mx = steer.x;
          mz = steer.z;
        } else if (dist < holdDist - 0.1) {
          mx = -(tx - e.mesh.position.x) / dist;
          mz = -(tz - e.mesh.position.z) / dist;
        } else {
          mx = 0;
          mz = 0;
        }

        if (e.biteCd <= 0 && dist < punchReach) {
          e.biteCd = 0.7 + Math.random() * 0.3;
          this._hurtTower(towerTarget, e.damage);
          this._spark(tx, tz, 0xc4a060, 5, 0.22, 1.1);
          if (Math.random() < 0.4) this._sayInvader(e, randPick(INVADER_FIGHT_LINES));
        }
      } else if (aggressive) {
        const punchReach = e.r + PLAYER_RADIUS + 0.45;
        const holdDist = punchReach - 0.2;
        const dist = Math.hypot(px - e.mesh.position.x, pz - e.mesh.position.z) || 1;
        const steer = this._steer(e, px, pz);
        e.mesh.rotation.y = Math.atan2(steer.x || (px - e.mesh.position.x), steer.z || (pz - e.mesh.position.z));

        // Hold just inside punching range — don't pile onto the player
        if (dist > holdDist + 0.12) {
          mx = steer.x;
          mz = steer.z;
        } else if (dist < holdDist - 0.1) {
          mx = -(px - e.mesh.position.x) / dist;
          mz = -(pz - e.mesh.position.z) / dist;
        } else {
          mx = 0;
          mz = 0;
        }

        const nx = (px - e.mesh.position.x) / dist;
        const nz = (pz - e.mesh.position.z) / dist;
        if (e.biteCd <= 0 && dist < punchReach) {
          e.biteCd = 0.85 + Math.random() * 0.35;
          this._hurt(e.damage, nx, nz);
          this._spark(px, pz, COL.blood, 6, 0.28, 1.0);
          if (Math.random() < 0.4) {
            this._sayInvader(e, randPick(e.kind === 'leader' ? LEADER_LINES : INVADER_FIGHT_LINES));
          }
        }
      } else if (!downed && !stunned && !tearing && !holding && !beheading && !clubbing && !pounding && e.civTarget) {
        // Divert to punch / grab / behead a Spaniard
        const s = e.civTarget;
        if (s.tearing || s.heldBy === e || s.beheading) {
          mx = 0;
          mz = 0;
        } else {
          const dx = s.mesh.position.x - e.mesh.position.x;
          const dz = s.mesh.position.z - e.mesh.position.z;
          const dist = Math.hypot(dx, dz) || 1;
          const steer = this._steer(e, s.mesh.position.x, s.mesh.position.z);
          const nx = dx / dist;
          const nz = dz / dist;
          e.mesh.rotation.y = Math.atan2(steer.x || nx, steer.z || nz);

          const punchReach = e.r + s.r + 0.45;
          const holdDist = punchReach - 0.15;
          if (dist > holdDist + 0.1) {
            mx = steer.x;
            mz = steer.z;
          } else if (dist < holdDist - 0.12) {
            mx = -nx;
            mz = -nz;
          } else {
            mx = 0;
            mz = 0;
          }

          if (e.biteCd <= 0 && dist < punchReach) {
            e.biteCd = 0.55 + Math.random() * 0.25;
            if (e.civHuntMode === 'behead' && this._atkEnabled('behead')) {
              this._beginBehead(e, s);
            } else if (e.civHuntMode === 'club' && this._atkEnabled('club')) {
              this._beginClubWeapon(e, s);
            } else if (e.civHuntMode === 'punch' && this._atkEnabled('punch')) {
              this._hurtSpaniard(s, e.damage, nx, nz);
              this._bloodSpray(s.mesh.position.x, s.mesh.position.z, nx, nz, { mild: true });
              this.sfx.punchHit({ hard: e.damage >= 2 });
              if (Math.random() < 0.4) this._sayInvader(e, randPick(INVADER_CIV_LINES));
            } else if (
              this._atkEnabled('tear')
              && s.heldBy && s.heldBy !== e && !s.tearing
            ) {
              // Designated partner arrives while someone is holding → start tear
              this._beginTearSpaniard(s);
            } else if (
              this._atkEnabled('tear')
              && !s.heldBy
              && !s.tearing
              && this._countHuntersOn(s) === 2
              && this._countSwarmOn(s, 3.2) >= 2
              && Math.random() < 0.7
            ) {
              this._beginTearSpaniard(s);
            } else if (
              this._atkEnabled('tear')
              && !s.heldBy
              && !s.tearing
              && this._countHuntersOn(s) === 2
              && Math.random() < 0.45
            ) {
              this._beginHoldCivilian(e, s);
            } else if (
              this._atkEnabled('punch')
              && !s.heldBy
              && this._countHuntersOn(s) <= 2
            ) {
              this._hurtSpaniard(s, e.damage, nx, nz);
              this._bloodSpray(s.mesh.position.x, s.mesh.position.z, nx, nz, { mild: true });
              this.sfx.punchHit({ hard: e.damage >= 2 });
              if (Math.random() < 0.4) this._sayInvader(e, randPick(INVADER_CIV_LINES));
            }
          }
        }
      } else if (!tearing && !holding && !beheading && !pounding) {
        // March / rampage. Clubbing invaders keep the body and keep moving.
        const isLeader = e.kind === 'leader';
        if (!downed && !stunned && !clubbing && e.civHuntCd <= 0 && this.spaniards.length > 0) {
          // Boss hunts constantly; rank-and-file peel off less often
          e.civHuntCd = isLeader
            ? 0.25 + Math.random() * 0.45
            : 1.6 + Math.random() * 1.8;
          this._maybeHuntCivilian(e);
        }

        if (!downed && !stunned && !e.swimming && e.speechCd <= 0) {
          if (Math.random() < 0.4) this._sayInvader(e, randPick(isLeader ? LEADER_LINES : INVADER_MARCH_LINES));
          else e.speechCd = 1.2 + Math.random() * 2;
        }

        let tx;
        let tz;
        if (isLeader && !e.swimming) {
          // Prefer causing havoc; only gradually commit to the gate
          const point = this._leaderRampagePoint(e, dest, dt);
          tx = point.x;
          tz = point.z;
        } else if (this.debugGatesClosed) {
          // Stay on whichever side of the gate they're on — never path through it
          e.wanderCd = Math.max(0, (e.wanderCd ?? 0) - dt);
          const nearWander = e.wanderTx != null
            && Math.hypot(e.mesh.position.x - e.wanderTx, e.mesh.position.z - e.wanderTz) < 1.2;
          if (e.wanderTx == null || e.wanderCd <= 0 || nearWander) {
            const gateZ = this.level.breachZ;
            const citySide = e.mesh.position.z < gateZ + 1.2;
            let zMin;
            let zMax;
            if (citySide) {
              zMin = gateZ - 14;
              zMax = gateZ - 2.2;
            } else {
              zMin = gateZ + 2.5;
              zMax = this.level.shoreLine + 1.5;
            }
            e.wanderTx = clamp(-16 + Math.random() * 32, -18, 18);
            e.wanderTz = zMin + Math.random() * Math.max(0.5, zMax - zMin);
            e.wanderCd = 2.5 + Math.random() * 3.5;
          }
          tx = e.wanderTx;
          tz = e.wanderTz;
        } else {
          tx = dest.x + Math.sin(i * 2.7) * 2.5;
          tz = dest.z;
        }
        const steer = this._steer(e, tx, tz);
        mx = steer.x;
        mz = steer.z;
        if (mx || mz) e.mesh.rotation.y = Math.atan2(mx, mz);

        // Soft avoid player when close but not aggressive (sidestep — never open fire first)
        if (this.playerAlive && e.aggroTimer <= 0) {
          const pdx = e.mesh.position.x - px;
          const pdz = e.mesh.position.z - pz;
          const pd = Math.hypot(pdx, pdz);
          if (pd < 2.2) {
            mx += (pdx / pd) * 0.8;
            mz += (pdz / pd) * 0.8;
          }
        }
      }

      // Separation (skip while down or phasing through buildings on a swing/charge)
      if (!downed && !phaseWalls) {
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
          if (s.hp <= 0 || e.civTarget === s || e.weaponCiv === s) continue;
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

      const startX = e.mesh.position.x;
      const startZ = e.mesh.position.z;

      if (mLen > 0.05 && control > 0) {
        mx /= mLen;
        mz /= mLen;
        const swimSlow = e.swimming ? 0.55 : 1;
        const hunting = !!e.civTarget && e.aggroTimer <= 0;
        const rampaging = e.kind === 'leader' && e.aggroTimer <= 0 && !hunting;
        let spd = aggressive ? e.speed * 1.15 : hunting ? e.speed * 1.25 : e.speed;
        if (rampaging) spd *= 0.88; // linger while causing havoc
        if (e.charging) spd = e.speed * 2.35;
        else if (clubbing && phaseWalls) spd = e.speed * 1.55;
        else if (e.speedBoostT > 0) spd *= 1.35;
        moveSpeed = spd * swimSlow;
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
      if (!phaseWalls) {
        resolveCircle(this._pos, e.r, this.level.walls);
      }
      e.mesh.position.x = clamp(this._pos.x, -this.level.HALF + 0.5, this.level.HALF - 0.5);
      e.mesh.position.z = clamp(this._pos.z, -this.level.HALF + 0.5, this.level.HALF - 0.5);

      // Stuck against a wall — repath occasionally (avoid per-frame nudge jitter)
      if (!phaseWalls && !downed && !stunned && moveSpeed > 0.5 && mLen > 0.05) {
        const moved = Math.hypot(e.mesh.position.x - startX, e.mesh.position.z - startZ);
        if (moved < moveSpeed * dt * control * 0.12) {
          e._stuckT = (e._stuckT || 0) + dt;
          if (e._stuckT > 0.28) {
            e._stuckT = 0;
            if (e._pathState) e._pathState.until = 0;
            const side = (i % 2 === 0) ? 1 : -1;
            e.mesh.position.x += (-mz) * side * 0.55;
            e.mesh.position.z += mx * side * 0.55;
            this._pos.x = e.mesh.position.x;
            this._pos.z = e.mesh.position.z;
            resolveCircle(this._pos, e.r, this.level.walls);
            e.mesh.position.x = this._pos.x;
            e.mesh.position.z = this._pos.z;
          }
        } else {
          e._stuckT = 0;
        }
      }

      if (downed) {
        e.mesh.rotation.x = Math.PI / 2;
        e.mesh.position.y = 0.4;
      } else if (e.swimming) {
        // Nearly prone into facing dir (mesh uses YXZ: yaw then pitch)
        e.mesh.rotation.x = SWIM_PITCH;
        e.mesh.rotation.z = 0;
        e.mesh.position.y = SWIM_Y + Math.sin(this.time * 3.6 + i) * 0.03;
      } else {
        e.mesh.rotation.x = 0;
        e.mesh.rotation.z = 0;
      }

      if (!downed) {
        animatePerson(
          e.mesh,
          dt,
          stunned ? 0 : moveSpeed,
          aggressive && moveSpeed > 3.5,
          (e.panicked && aggressive) || stunned,
          tearing || holding || beheading || pounding,
          e.swimming,
        );
        updateHealthBar(e.hpBar, e.hp, e.maxHp, e.mesh.rotation.y, e.mesh.rotation.x);
      } else if (e.hpBar) {
        updateHealthBar(e.hpBar, e.hp, e.maxHp, e.mesh.rotation.y, e.mesh.rotation.x);
      }

      // Breach check — reached city gate (downed can't breach; closed gates block escapes)
      if (
        !this.debugGatesClosed
        && !downed
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
      beheading: null,
      weaponBy: null,
      regenDelay: 0,
    };
    this.spaniards.push(s);
    return s;
  }

  _saySpaniard(s, text, fear = false) {
    if (!this.debugSpeech || !s.bubble) return;
    s.bubble.textContent = text;
    s.bubble.classList.toggle('fear', fear);
    s.bubble.classList.add('on');
    s.speechLife = fear ? 2.4 : 2.8;
    s.speechCd = fear ? 1.2 : 4 + Math.random() * 5;
  }

  _hurtSpaniard(s, damage, dirX = 0, dirZ = 0, opts = {}) {
    if (!s || s.hp <= 0 || s.tearing) return;
    if (s.beheading) {
      if (opts.fromPlayer) this._cancelBehead(s);
      else return;
    }
    // Being held — still take damage but no flee knockback
    const held = !!s.heldBy;
    s.hp -= damage;
    this._resetRegen(s);
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
    updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y, s.mesh.rotation.x);
    if (opts.fromPlayer) {
      this._bloodSpray(s.mesh.position.x, s.mesh.position.z, dirX, dirZ, { mild: true });
    }

    // Pair already committed: if both are in melee, start the pull-apart
    if (
      this._atkEnabled('tear')
      && !opts.fromPlayer
      && !s.tearing
      && this._countHuntersOn(s) === 2
      && this._countSwarmOn(s, 3.1) >= 2
    ) {
      s.pullPressure = (s.pullPressure || 0) + 1;
      if (s.pullPressure >= 2 || Math.random() < 0.35) {
        this._beginTearSpaniard(s);
        return;
      }
    }

    if (s.hp <= 0) {
      this._killSpaniard(s, { fromPunch: !!opts.fromPlayer, dirX, dirZ });
    }
  }

  _countHuntersOn(s) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.knockdownTimer > 0 || e.tearing || e.beheading) continue;
      if (e.civTarget === s || e.holding === s) n += 1;
    }
    return n;
  }

  _countSwarmOn(s, range) {
    let n = 0;
    for (const e of this.enemies) {
      if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.tearing || e.beheading) continue;
      const targeting = e.civTarget === s || e.holding === s;
      if (!targeting) continue;
      const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
      if (d <= range) n += 1;
    }
    return n;
  }

  _clearCivHunt(e) {
    if (!e) return;
    e.civTarget = null;
    e.civHuntTimer = 0;
    e.civHuntMode = null;
  }

  /** Opportunistic civilian attack: punch, behead, club, or a two-person tear. */
  _maybeHuntCivilian(e) {
    if (!e || e.civTarget || e.holding || e.tearing || e.beheading || e.weaponCiv || e.aggroTimer > 0) return;
    if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.pounding) return;

    // Pack leader: grab a body to swing, else try an execution
    if (e.kind === 'leader') {
      if (this._atkEnabled('club')) {
        this._maybeHuntClub(e);
        if (e.civTarget) return;
      }
      if (this._atkEnabled('behead')) {
        this._maybeHuntBehead(e);
        if (e.civTarget) return;
      }
    }

    const tries = [];
    if (this._atkEnabled('behead')) tries.push(() => this._maybeHuntBehead(e));
    if (this._atkEnabled('punch')) tries.push(() => this._maybeHuntPunch(e));
    if (this._atkEnabled('tear')) tries.push(() => this._maybeProposeTearPair(e));
    if (tries.length === 0) return;

    for (let i = tries.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tries[i], tries[j]] = [tries[j], tries[i]];
    }
    for (const tryHunt of tries) {
      tryHunt();
      if (e.civTarget) return;
    }
  }

  _updateLeader(e, dt, px, pz) {
    if (!e || e.kind !== 'leader') return;
    e.rallyCd = Math.max(0, (e.rallyCd || 0) - dt);
    e.chargeCd = Math.max(0, (e.chargeCd || 0) - dt);
    e.poundCd = Math.max(0, (e.poundCd || 0) - dt);
    e.towerSeekCd = Math.max(0, (e.towerSeekCd || 0) - dt);
    if (!e.swimming) e.rampageT = (e.rampageT || 0) + dt;

    if (e.charging) {
      e.chargeT = Math.max(0, (e.chargeT || 0) - dt);
      if (e.chargeT <= 0) {
        e.charging = false;
        if (!e.beheading) setMachete(e.mesh, false);
      } else {
        setMachete(e.mesh, true);
      }
    }

    // Ground pound wind-up / slam
    if (e.pounding) {
      this._tickLeaderPound(e, dt);
      return;
    }

    if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.tearing || e.holding || e.beheading) {
      e.charging = false;
      return;
    }

    // War cry — whip nearby invaders into a frenzy
    if (e.rallyCd <= 0 && !e.weaponCiv) {
      e.rallyCd = 7.5 + Math.random() * 3.5;
      this._leaderRally(e);
    }

    // Smash towers on sight — part of the rampage, not a gate rush
    if (
      e.aggroTimer <= 0
      && !e.civTarget
      && !e.charging
      && e.towerSeekCd <= 0
      && this.towers.length > 0
    ) {
      e.towerSeekCd = 2.2 + Math.random() * 1.8;
      const tower = this._nearestPlacedTower(e.mesh.position.x, e.mesh.position.z);
      if (tower) {
        const d = Math.hypot(
          tower.mesh.position.x - e.mesh.position.x,
          tower.mesh.position.z - e.mesh.position.z,
        );
        if (d < 11) {
          this._enrage(e, AGGRO_DURATION * 1.6, 'tower');
          return;
        }
      }
    }

    const fighting = e.aggroTimer > 0 && e.aggroTarget !== 'tower' && this.playerAlive;
    if (!fighting || e.charging || e.weaponCiv) return;

    const dist = Math.hypot(px - e.mesh.position.x, pz - e.mesh.position.z);

    // Ground pound when close — preferred special over charge
    if (
      this._leadEnabled('pound')
      && e.poundCd <= 0
      && dist < LEADER_POUND_RADIUS + 0.85
      && dist > 0.6
    ) {
      this._beginLeaderPound(e);
      return;
    }

    // Snatch a nearby civilian mid-fight to use as a club
    e.clubGrabCd = Math.max(0, (e.clubGrabCd || 0) - dt);
    if (this._atkEnabled('club') && e.clubGrabCd <= 0) {
      e.clubGrabCd = 2.8 + Math.random() * 1.5;
      let bestS = null;
      let bestD = 2.6;
      for (const s of this.spaniards) {
        if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
        const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
        if (d < bestD) {
          bestD = d;
          bestS = s;
        }
      }
      if (bestS) {
        this._beginClubWeapon(e, bestS);
        return;
      }
    }

    // Occasional machete charge from mid range (not the default attack)
    if (
      this._leadEnabled('charge')
      && e.chargeCd <= 0
      && dist > 4.2
      && dist < 9.5
      && Math.random() < 0.35
    ) {
      e.charging = true;
      e.chargeT = 0.85;
      e.chargeCd = 7.5 + Math.random() * 3;
      setMachete(e.mesh, true);
      this._sayInvader(e, randPick(LEADER_LINES));
      this.sfx.macheteDraw();
    }
  }

  /** 0 = pure rampage, 1 = fully committed to the gate. */
  _leaderGatePull(e) {
    const t = e.rampageT || 0;
    let pull = 0;
    if (t > 20) pull = Math.min(1, (t - 20) / 55);
    // Nothing left to wreck → hurry through
    if (this.spaniards.length === 0 && this.towers.length === 0) {
      pull = Math.max(pull, Math.min(1, 0.35 + t / 18));
    }
    if (this.debugGatesClosed) pull = 0;
    return pull;
  }

  /**
   * Boss pathing: chase civilians / towers first, drift toward the gate over time.
   */
  _leaderRampagePoint(e, dest, dt) {
    e.wanderCd = Math.max(0, (e.wanderCd ?? 0) - dt);
    const pull = this._leaderGatePull(e);
    const near = e.wanderTx != null
      && Math.hypot(e.mesh.position.x - e.wanderTx, e.mesh.position.z - e.wanderTz) < 1.4;

    if (e.wanderTx == null || e.wanderCd <= 0 || near) {
      let ix = e.mesh.position.x + (Math.random() - 0.5) * 10;
      let iz = e.mesh.position.z - 2 - Math.random() * 6;

      let bestD = 14;
      let found = false;
      for (const s of this.spaniards) {
        if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
        const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
        if (d < bestD) {
          bestD = d;
          ix = s.mesh.position.x;
          iz = s.mesh.position.z;
          found = true;
        }
      }
      if (!found || bestD > 9) {
        for (const t of this.towers) {
          if (!t || t.hp <= 0) continue;
          const d = Math.hypot(t.mesh.position.x - e.mesh.position.x, t.mesh.position.z - e.mesh.position.z);
          if (d < bestD) {
            bestD = d;
            ix = t.mesh.position.x;
            iz = t.mesh.position.z;
            found = true;
          }
        }
      }
      if (!found) {
        const shore = this.level.shoreLine;
        const gateZ = this.level.breachZ;
        ix = clamp(-14 + Math.random() * 28, -16, 16);
        // Stay in the fight zone early; later samples nudge north toward the gate
        const zLean = 0.15 + pull * 0.7;
        iz = shore + (gateZ - shore) * (0.1 + Math.random() * 0.55 * (0.4 + zLean));
      }

      e.wanderTx = ix + (dest.x - ix) * pull;
      e.wanderTz = iz + (dest.z - iz) * pull;
      e.wanderCd = found
        ? 1.2 + Math.random() * 1.4
        : 2.0 + Math.random() * 2.5;
    }

    return { x: e.wanderTx, z: e.wanderTz };
  }

  _beginLeaderPound(e) {
    if (!e || e.pounding) return;
    e.pounding = true;
    e.poundPhase = 'rise';
    e.poundT = 0;
    e.poundCd = 6.5 + Math.random() * 2.5;
    e.charging = false;
    e.chargeT = 0;
    e.kbx = 0;
    e.kbz = 0;
    setMachete(e.mesh, false);
    this._sayInvader(e, randPick(LEADER_LINES));
  }

  _tickLeaderPound(e, dt) {
    e.poundT += dt;
    const rig = e.mesh.userData.rig;
    if (e.poundPhase === 'rise') {
      const u = Math.min(1, e.poundT / LEADER_POUND_RISE);
      e.mesh.position.y = u * 1.4;
      if (rig?.lArm && rig?.rArm) {
        rig.lArm.rotation.x = -2.2 * u;
        rig.rArm.rotation.x = -2.2 * u;
        rig.lArm.rotation.z = -0.35;
        rig.rArm.rotation.z = 0.35;
      }
      if (rig?.torso) rig.torso.rotation.x = -0.25 * u;
      if (u >= 1) {
        e.poundPhase = 'hang';
        e.poundT = 0;
      }
    } else if (e.poundPhase === 'hang') {
      e.mesh.position.y = 1.4;
      if (e.poundT >= LEADER_POUND_HANG) {
        e.poundPhase = 'slam';
        e.poundT = 0;
      }
    } else if (e.poundPhase === 'slam') {
      const u = Math.min(1, e.poundT / LEADER_POUND_SLAM);
      e.mesh.position.y = 1.4 * (1 - u);
      if (rig?.lArm && rig?.rArm) {
        rig.lArm.rotation.x = -2.2 + u * 1.4;
        rig.rArm.rotation.x = -2.2 + u * 1.4;
      }
      if (rig?.torso) rig.torso.rotation.x = -0.25 + u * 0.55;
      if (u >= 1) {
        e.mesh.position.y = 0;
        if (rig?.torso) rig.torso.rotation.x = 0;
        this._leaderPoundImpact(e);
        e.pounding = false;
        e.poundPhase = null;
        e.poundT = 0;
      }
    }
  }

  _leaderPoundImpact(e) {
    const x = e.mesh.position.x;
    const z = e.mesh.position.z;
    this.shake = Math.min(1.2, this.shake + 0.55);
    this._spark(x, z, 0xc4a060, 16, 0.55, 1.2);
    this._spark(x, z, COL.blood, 6, 0.3, 1.0);
    this.sfx.knockdown();
    this.sfx.punchHit({ hard: true });

    if (this.playerAlive) {
      const dist = Math.hypot(this.player.position.x - x, this.player.position.z - z);
      if (dist < LEADER_POUND_RADIUS + PLAYER_RADIUS) {
        const falloff = 1 - dist / (LEADER_POUND_RADIUS + PLAYER_RADIUS);
        const nx = (this.player.position.x - x) / (dist || 1);
        const nz = (this.player.position.z - z) / (dist || 1);
        this._hurt(Math.max(1, Math.round(e.damage + 1 + falloff)), nx, nz);
        this.kbx = nx * PLAYER_KNOCK_SPEED * (1.3 + falloff);
        this.kbz = nz * PLAYER_KNOCK_SPEED * (1.3 + falloff);
      }
    }

    for (const s of this.spaniards) {
      if (s.hp <= 0 || s.weaponBy || s.tearing || s.beheading) continue;
      const d = Math.hypot(s.mesh.position.x - x, s.mesh.position.z - z);
      if (d >= LEADER_POUND_RADIUS + 0.4) continue;
      const nx = (s.mesh.position.x - x) / (d || 1);
      const nz = (s.mesh.position.z - z) / (d || 1);
      this._hurtSpaniard(s, Math.max(2, e.damage), nx, nz);
      this._bloodSpray(s.mesh.position.x, s.mesh.position.z, nx, nz, { mild: true });
    }

    for (const t of this.towers) {
      if (!t || t.hp <= 0) continue;
      const d = Math.hypot(t.mesh.position.x - x, t.mesh.position.z - z);
      if (d < LEADER_POUND_RADIUS + 0.8) this._hurtTower(t, e.damage + 1);
    }
  }

  _leaderRally(leader) {
    if (!leader) return;
    this._sayInvader(leader, randPick(LEADER_LINES));
    this._spark(leader.mesh.position.x, leader.mesh.position.z, 0xc1272d, 8, 0.4, 1.1);
    this.shake = Math.min(0.55, this.shake + 0.12);
    for (const o of this.enemies) {
      if (o === leader || o.knockdownTimer > 0 || o.hp <= 0) continue;
      const d = Math.hypot(
        o.mesh.position.x - leader.mesh.position.x,
        o.mesh.position.z - leader.mesh.position.z,
      );
      if (d > 10) continue;
      // Rally buffs speed; only re-aggro units already fighting (never provoke fresh player chases)
      if (o.aggroTimer > 0) {
        this._enrage(o, AGGRO_DURATION * 1.15, o.aggroTarget === 'tower' ? 'tower' : 'player');
      }
      o.speedBoostT = Math.max(o.speedBoostT || 0, 3.8);
      if (o.aggroTimer > 0) o.panicked = true;
    }
  }

  /** Leader peels off to grab a civilian and use them as a club. */
  _maybeHuntClub(e) {
    if (!this._atkEnabled('club')) return;
    if (!e || e.kind !== 'leader' || e.civTarget || e.weaponCiv || e.holding || e.tearing || e.beheading) return;
    if (e.aggroTimer > 0 || e.knockdownTimer > 0 || e.stunTimer > 0 || e.pounding) return;
    // Boss almost always commits; debug-solo still forces it
    if (!this._atkSolo('club') && Math.random() > 0.92) return;

    let bestS = null;
    let bestD = PUNCH_HUNT_CIV_RANGE + 5 + (this._atkSolo('club') ? 4 : 0);
    for (const s of this.spaniards) {
      if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
      if (this._countHuntersOn(s) > 0) continue;
      const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        bestS = s;
      }
    }
    if (!bestS) return;

    e.civTarget = bestS;
    e.civHuntTimer = 6 + Math.random() * 2.5;
    e.civHuntMode = 'club';
    if (Math.random() < 0.55) this._sayInvader(e, randPick(INVADER_CIV_LINES));
  }

  _beginClubWeapon(e, s) {
    if (!this._atkEnabled('club')) return;
    if (!e || !s || e.weaponCiv || s.weaponBy || s.tearing || s.beheading) return;
    if (s.heldBy) this._releaseHold(s);
    if (s.beheading) this._cancelBehead(s);

    for (const o of this.enemies) {
      if (o !== e && o.civTarget === s) this._clearCivHunt(o);
    }

    e.weaponCiv = s;
    e.clubHits = LEADER_CLUB_MAX_HITS;
    e.clubSwingT = 0;
    e.clubDidHit = false;
    e.clubReadyCd = 0.45; // drag a beat, then smash
    e.civTarget = null;
    e.civHuntMode = null;
    e.civHuntTimer = 0;
    e.holding = null;
    e.kbx = 0;
    e.kbz = 0;
    setMachete(e.mesh, false);

    s.weaponBy = e;
    s.heldBy = null;
    s.kbx = 0;
    s.kbz = 0;
    s.fearTimer = 99;
    if (s.hpBar) s.hpBar.visible = false;

    this._sayInvader(e, randPick(LEADER_LINES));
    this._saySpaniard(s, randPick(FEAR_LINES), true);
    this.sfx.punchHit({ hard: true });
  }

  _poseClubWeapon(e, s, swingU = 0, dt = 0.016) {
    if (!e || !s) return;
    if (!this._clubGrip) this._clubGrip = new THREE.Vector3();
    if (!this._clubFoot) this._clubFoot = new THREE.Vector3();
    if (!this._clubTargetPos) this._clubTargetPos = new THREE.Vector3();
    if (!this._clubTargetQuat) this._clubTargetQuat = new THREE.Quaternion();
    if (!this._clubEuler) this._clubEuler = new THREE.Euler(0, 0, 0, 'YXZ');

    const facing = e.mesh.rotation.y;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    const sx = Math.cos(facing);
    const sz = -Math.sin(facing);
    const lrig = e.mesh.userData.rig;
    const vrig = s.mesh.userData.rig;
    const t = this.time;
    const blend = 1 - Math.exp(-16 * Math.max(0.001, dt));
    const rotBlend = 1 - Math.exp(-14 * Math.max(0.001, dt));

    if (s.mesh.userData.shadow) s.mesh.userData.shadow.visible = false;

    let ty;
    let tx;
    let tz;
    const target = this._clubTargetPos;
    const euler = this._clubEuler;

    if (swingU <= 0.001) {
      // Stable arm reach — no per-frame flicker
      if (lrig?.rArm && lrig?.lArm) {
        lrig.rArm.rotation.x = 0.55;
        lrig.rArm.rotation.y = 0.35;
        lrig.rArm.rotation.z = 1.15;
        lrig.lArm.rotation.x = 0.15;
        lrig.lArm.rotation.y = 0;
        lrig.lArm.rotation.z = -0.2;
        if (lrig.rElbow) lrig.rElbow.rotation.x = -1.15;
        if (lrig.lElbow) lrig.lElbow.rotation.x = -0.35;
      }
      if (lrig?.torso) {
        lrig.torso.rotation.x = 0.28;
        lrig.torso.rotation.y = 0.22;
        lrig.torso.rotation.z = -0.08;
      }

      e.mesh.updateMatrixWorld(true);
      const grip = this._clubGrip;
      if (lrig?.rHand) lrig.rHand.getWorldPosition(grip);
      else {
        grip.set(
          e.mesh.position.x - fx * 0.2 + sx * 0.7,
          0.35,
          e.mesh.position.z - fz * 0.2 + sz * 0.7,
        );
      }

      // Gentle drag bounce (rotation only — avoids foot-snap feedback jitter)
      const yawWobble = Math.sin(t * 7.5) * 0.12 + Math.sin(t * 11) * 0.05;
      const pitchWobble = Math.sin(t * 8.5) * 0.1;
      const rollWobble = Math.sin(t * 9) * 0.22 + Math.sin(t * 13) * 0.08;

      euler.set(Math.PI / 2 + 0.1 + pitchWobble, facing + Math.PI + yawWobble, rollWobble, 'YXZ');
      this._clubTargetQuat.setFromEuler(euler);

      // Place root at grip (feet end); one corrective snap without post-bounce translate
      s.mesh.quaternion.slerp(this._clubTargetQuat, rotBlend);
      s.mesh.position.copy(grip);
      s.mesh.updateMatrixWorld(true);
      const foot = this._clubFoot;
      if (vrig?.rFoot) vrig.rFoot.getWorldPosition(foot);
      else if (vrig?.rLeg) vrig.rLeg.getWorldPosition(foot);
      else foot.copy(grip);
      target.set(
        s.mesh.position.x + (grip.x - foot.x),
        s.mesh.position.y + (grip.y - foot.y),
        s.mesh.position.z + (grip.z - foot.z),
      );
      s.mesh.position.lerp(target, blend);
    } else {
      const lift = Math.min(1, swingU / 0.22);
      const strike = Math.max(0, (swingU - 0.22) / 0.78);
      const wind = Math.min(1, strike / 0.28);
      const smash = Math.max(0, (strike - 0.28) / 0.72);
      const smashEase = smash * smash * (3 - 2 * smash);

      const back = -0.35 - wind * 0.95 + smashEase * 2.55;
      const side = 0.55 + wind * 0.95 - smashEase * 2.65;
      const height = 0.45 + lift * 0.85 + wind * 0.55 + Math.sin(smashEase * Math.PI) * 0.55;

      if (lrig?.rArm && lrig?.lArm) {
        lrig.rArm.rotation.x = 0.55 - lift * 1.6 - wind * 1.35 + smashEase * 0.35;
        lrig.rArm.rotation.y = 0.35 + wind * 0.55 - smashEase * 1.35;
        lrig.rArm.rotation.z = 1.15 + wind * 0.55 - smashEase * 1.85;
        lrig.lArm.rotation.x = 0.15 - lift * 1.1 - smashEase * 0.4;
        lrig.lArm.rotation.z = -0.2 - wind * 0.15 - smashEase * 0.25;
        if (lrig.rElbow) lrig.rElbow.rotation.x = -1.15 + lift * 0.35 + smashEase * 0.4;
        if (lrig.lElbow) lrig.lElbow.rotation.x = -0.35;
      }
      if (lrig?.torso) {
        lrig.torso.rotation.x = 0.28 - lift * 0.15 + smashEase * 0.2;
        lrig.torso.rotation.y = 0.22 + wind * 0.55 - smashEase * 1.15;
        lrig.torso.rotation.z = -0.08 + wind * 0.12 - smashEase * 0.2;
      }

      const arcX = e.mesh.position.x + fx * back + sx * side;
      const arcZ = e.mesh.position.z + fz * back + sz * side;
      const arcY = height;
      // Drive body on the arc (hand follow was fighting the wide path)
      target.set(arcX, arcY, arcZ);

      euler.set(
        Math.PI / 2 - 0.2 * lift - smashEase * 0.35,
        facing + Math.PI * (1 - lift * 0.35) - wind * 0.4 + smashEase * 2.4,
        -wind * 0.6 + smashEase * 1.8,
        'YXZ',
      );
      this._clubTargetQuat.setFromEuler(euler);
      // Snappier during the strike so the wide arc still reads
      const strikeBlend = 1 - Math.exp(-(10 + smashEase * 14) * Math.max(0.001, dt));
      s.mesh.quaternion.slerp(this._clubTargetQuat, strikeBlend);
      s.mesh.position.lerp(target, strikeBlend);
    }

    // Softer limb flail
    if (vrig) {
      const flail = Math.sin(t * 11) * 0.35;
      const flail2 = Math.cos(t * 8.5) * 0.28;
      if (vrig.lArm) {
        vrig.lArm.rotation.x = 0.55 + flail;
        vrig.lArm.rotation.z = -0.55 + flail2 * 0.4;
      }
      if (vrig.rArm) {
        vrig.rArm.rotation.x = 0.6 - flail * 0.7;
        vrig.rArm.rotation.z = 0.55 + flail2;
      }
      if (vrig.lLeg) {
        vrig.lLeg.rotation.x = 0.3 + flail2 * 0.45;
        vrig.lLeg.rotation.z = -0.2 + Math.sin(t * 9) * 0.12;
      }
      if (vrig.rLeg) {
        vrig.rLeg.rotation.x = -0.18 + Math.sin(t * 6) * 0.04;
        vrig.rLeg.rotation.z = 0.04;
      }
      if (vrig.head) {
        vrig.head.rotation.x = 0.55 + Math.sin(t * 7) * 0.12;
        vrig.head.rotation.y = Math.sin(t * 5.5) * 0.22;
        vrig.head.rotation.z = Math.sin(t * 8) * 0.25;
      }
    }
  }

  _clubDetachLimb(s, dirX, dirZ) {
    if (!s?.mesh?.userData?.rig) return false;
    const rig = s.mesh.userData.rig;
    const order = ['lArm', 'rArm', 'lLeg', 'rLeg', 'head'];
    const next = order.find((n) => rig[n]);
    if (!next) return false;
    const parts = detachBodyParts(s.mesh, [next]);
    const len = Math.hypot(dirX, dirZ) || 1;
    const nx = dirX / len;
    const nz = dirZ / len;
    for (const p of parts) {
      const sp = 2.8 + Math.random() * 2.5;
      this._spawnGib(
        p.mesh,
        nx * sp + (Math.random() - 0.5) * 2.2,
        nz * sp + (Math.random() - 0.5) * 2.2,
        2.2 + Math.random() * 2.2,
        1.8,
      );
    }
    this._bloodBurst(s.mesh.position.x, s.mesh.position.z, { heavy: false });
    return true;
  }

  _clubHasLimbs(s) {
    const rig = s?.mesh?.userData?.rig;
    if (!rig) return false;
    return !!(rig.lArm || rig.rArm || rig.lLeg || rig.rLeg || rig.head);
  }

  _discardClubWeapon(e, opts = {}) {
    if (!e?.weaponCiv) return;
    const s = e.weaponCiv;
    e.weaponCiv = null;
    e.clubHits = 0;
    e.clubSwingT = 0;
    e.clubDidHit = false;
    const lrig = e.mesh?.userData?.rig;
    if (lrig?.torso) {
      lrig.torso.rotation.x = 0;
      lrig.torso.rotation.y = 0;
      lrig.torso.rotation.z = 0;
    }
    if (!s) return;
    s.weaponBy = null;
    if (s.mesh?.userData?.shadow) s.mesh.userData.shadow.visible = true;
    if (!this.spaniards.includes(s)) return;

    const fx = Math.sin(e.mesh.rotation.y);
    const fz = Math.cos(e.mesh.rotation.y);
    if (opts.fling) {
      const x = s.mesh.position.x;
      const z = s.mesh.position.z;
      const idx = this.spaniards.indexOf(s);
      if (idx >= 0) this.spaniards.splice(idx, 1);
      if (s.bubble) s.bubble.remove();

      // Remaining limbs explode off hard — then the stump follows
      const leftover = ['lArm', 'rArm', 'lLeg', 'rLeg', 'head'].filter(
        (n) => s.mesh.userData.rig?.[n],
      );
      const parts = leftover.length ? detachBodyParts(s.mesh, leftover) : [];
      for (const p of parts) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 7 + Math.random() * 6;
        this._spawnGib(
          p.mesh,
          Math.cos(ang) * sp + fx * (2 + Math.random() * 3),
          Math.sin(ang) * sp + fz * (2 + Math.random() * 3),
          5 + Math.random() * 5,
          2.6,
          { spin: 36 },
        );
      }
      this._spawnGib(
        s.mesh,
        fx * (6 + Math.random() * 4) + (Math.random() - 0.5) * 3,
        fz * (6 + Math.random() * 4) + (Math.random() - 0.5) * 3,
        4.5 + Math.random() * 3.5,
        2.8,
        { spin: 28 },
      );
      this._bloodBurst(x, z, { heavy: true });
      this._bloodSpray(x, z, fx, fz, { mild: false });
      this._spark(x, z, COL.blood, 16, 0.55, 1.25);
      this.shake = Math.min(1.15, this.shake + 0.45);
      this.sfx.knockdown();
    } else {
      this._killSpaniard(s, { fromPunch: true, dirX: fx, dirZ: fz });
    }
  }

  _dampYaw(current, target, dt, rate = 10) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const k = 1 - Math.exp(-rate * Math.max(0.001, dt));
    return current + diff * k;
  }

  /**
   * What the boss should smash with a dragged body.
   * Player only if already provoked; otherwise towers / other civilians.
   */
  _leaderClubAim(e, px, pz) {
    if (!e?.weaponCiv) return null;
    const ex = e.mesh.position.x;
    const ez = e.mesh.position.z;

    if (e.aggroTimer > 0 && e.aggroTarget !== 'tower' && this.playerAlive) {
      return { x: px, z: pz, kind: 'player' };
    }

    let best = null;
    let bestD = 12;

    if (e.aggroTimer > 0 && e.aggroTarget === 'tower') {
      const t = this._nearestPlacedTower(ex, ez);
      if (t) {
        return { x: t.mesh.position.x, z: t.mesh.position.z, kind: 'tower', ref: t };
      }
    }

    for (const t of this.towers) {
      if (!t || t.hp <= 0) continue;
      const d = Math.hypot(t.mesh.position.x - ex, t.mesh.position.z - ez);
      if (d < bestD) {
        bestD = d;
        best = { x: t.mesh.position.x, z: t.mesh.position.z, kind: 'tower', ref: t };
      }
    }

    for (const s of this.spaniards) {
      if (!s || s === e.weaponCiv || s.hp <= 0) continue;
      if (s.weaponBy || s.tearing || s.beheading) continue;
      const d = Math.hypot(s.mesh.position.x - ex, s.mesh.position.z - ez);
      if (d < bestD) {
        bestD = d;
        best = { x: s.mesh.position.x, z: s.mesh.position.z, kind: 'civ', ref: s };
      }
    }

    return best;
  }

  _updateClubWeapons(dt) {
    for (const e of this.enemies) {
      if (!e.weaponCiv) continue;
      const s = e.weaponCiv;
      e.clubReadyCd = Math.max(0, (e.clubReadyCd || 0) - dt);
      const ok = this.spaniards.includes(s) && s.hp > 0 && e.hp > 0 && e.knockdownTimer <= 0;
      if (!ok || !this._atkEnabled('club')) {
        this._discardClubWeapon(e, { fling: true });
        continue;
      }

      let swingU = 0;
      if (e.clubSwingT > 0) {
        const prev = e.clubSwingT;
        e.clubSwingT = Math.max(0, e.clubSwingT - dt);
        swingU = 1 - e.clubSwingT / LEADER_CLUB_SWING;
        // Connect as the body whips through the front of the arc
        if (!e.clubDidHit && swingU >= 0.48 && swingU <= 0.78) {
          e.clubDidHit = true;
          this._resolveClubHit(e, s);
        }
        // Swing finished — brief drag beat before the next smash
        if (prev > 0 && e.clubSwingT <= 0) {
          e.clubReadyCd = LEADER_CLUB_READY;
          if (!e.clubDidHit) {
            e.clubDidHit = true;
            const fx = Math.sin(e.mesh.rotation.y);
            const fz = Math.cos(e.mesh.rotation.y);
            this._clubDetachLimb(s, fx, fz);
            e.clubHits = Math.max(0, (e.clubHits || 0) - 1);
            if (e.clubHits <= 0 || !this._clubHasLimbs(s)) {
              this._discardClubWeapon(e, { fling: true });
              continue;
            }
          }
        }
      }

      this._poseClubWeapon(e, s, swingU, dt);
      if (s.speechCd <= 0) this._saySpaniard(s, randPick(FEAR_LINES), true);
    }
  }

  _resolveClubHit(e, s) {
    const fx = Math.sin(e.mesh.rotation.y);
    const fz = Math.cos(e.mesh.rotation.y);
    const reach = e.r + LEADER_CLUB_REACH + 0.6;
    let hitSomething = false;

    if (this.playerAlive) {
      const dist = Math.hypot(
        this.player.position.x - e.mesh.position.x,
        this.player.position.z - e.mesh.position.z,
      );
      const toPx = this.player.position.x - e.mesh.position.x;
      const toPz = this.player.position.z - e.mesh.position.z;
      const facing = (toPx * fx + toPz * fz) / (dist || 1);
      if (dist < reach + PLAYER_RADIUS && facing > 0.05) {
        const nx = toPx / (dist || 1);
        const nz = toPz / (dist || 1);
        this._hurt(e.damage + 1, nx, nz);
        this.kbx = nx * PLAYER_KNOCK_SPEED * 1.45;
        this.kbz = nz * PLAYER_KNOCK_SPEED * 1.45;
        this._spark(this.player.position.x, this.player.position.z, COL.blood, 8, 0.32, 1.1);
        this.sfx.punchHit({ hard: true });
        hitSomething = true;
      }
    }

    if (!hitSomething) {
      for (const t of this.towers) {
        if (!t || t.hp <= 0) continue;
        const d = Math.hypot(t.mesh.position.x - e.mesh.position.x, t.mesh.position.z - e.mesh.position.z);
        const toTx = t.mesh.position.x - e.mesh.position.x;
        const toTz = t.mesh.position.z - e.mesh.position.z;
        const facing = (toTx * fx + toTz * fz) / (d || 1);
        if (d < reach + 0.5 && facing > 0.0) {
          this._hurtTower(t, e.damage + 1);
          this.sfx.punchHit({ hard: true });
          hitSomething = true;
          break;
        }
      }
    }

    if (!hitSomething) {
      for (const civ of this.spaniards) {
        if (!civ || civ === s || civ.hp <= 0 || civ.weaponBy) continue;
        const d = Math.hypot(civ.mesh.position.x - e.mesh.position.x, civ.mesh.position.z - e.mesh.position.z);
        const toCx = civ.mesh.position.x - e.mesh.position.x;
        const toCz = civ.mesh.position.z - e.mesh.position.z;
        const facing = (toCx * fx + toCz * fz) / (d || 1);
        if (d < reach + 0.4 && facing > 0.0) {
          const nx = toCx / (d || 1);
          const nz = toCz / (d || 1);
          this._hurtSpaniard(civ, Math.max(2, e.damage + 1), nx, nz);
          this._bloodSpray(civ.mesh.position.x, civ.mesh.position.z, nx, nz, { mild: false });
          this.sfx.punchHit({ hard: true });
          hitSomething = true;
          break;
        }
      }
    }

    // Limbs shear off whether or not the swing connected cleanly
    this._clubDetachLimb(s, fx, fz);
    e.clubHits = Math.max(0, (e.clubHits || 0) - 1);
    this.shake = Math.min(0.85, this.shake + 0.18);
    if (Math.random() < 0.5) this._sayInvader(e, randPick(LEADER_LINES));

    if (e.clubHits <= 0 || !this._clubHasLimbs(s)) {
      this._discardClubWeapon(e, { fling: true });
    }
  }

  /** Solo invader peels off to punch a nearby civilian. */
  _maybeHuntPunch(e) {
    if (!this._atkEnabled('punch')) return;
    if (!e || e.civTarget || e.holding || e.tearing || e.beheading || e.weaponCiv || e.aggroTimer > 0) return;
    if (e.knockdownTimer > 0 || e.stunTimer > 0) return;
    if (!this._atkSolo('punch') && Math.random() > 0.48) return;

    let bestS = null;
    let bestD = PUNCH_HUNT_CIV_RANGE + (this._atkSolo('punch') ? 4 : 0);
    for (const s of this.spaniards) {
      if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
      if (this._countHuntersOn(s) > 0) continue;
      const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        bestS = s;
      }
    }
    if (!bestS) return;

    e.civTarget = bestS;
    e.civHuntTimer = 3.8 + Math.random() * 2.2;
    e.civHuntMode = 'punch';
    if (Math.random() < 0.5) this._sayInvader(e, randPick(INVADER_CIV_LINES));
  }

  /** Solo invader peels off to pin and behead a civilian with a machete. */
  _maybeHuntBehead(e) {
    if (!this._atkEnabled('behead')) return;
    if (!e || e.civTarget || e.holding || e.tearing || e.beheading || e.weaponCiv || e.aggroTimer > 0) return;
    if (e.knockdownTimer > 0 || e.stunTimer > 0) return;
    if (e.kind !== 'leader' && !this._atkSolo('behead') && Math.random() > 0.42) return;

    let bestS = null;
    let bestD = PUNCH_HUNT_CIV_RANGE + (e.kind === 'leader' ? 4 : 0) + (this._atkSolo('behead') ? 5 : 0.8);
    for (const s of this.spaniards) {
      if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
      if (this._countHuntersOn(s) > 0) continue;
      const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        bestS = s;
      }
    }
    if (!bestS) return;

    e.civTarget = bestS;
    e.civHuntTimer = (e.kind === 'leader' ? 6.5 : 5.5) + Math.random() * 2;
    e.civHuntMode = 'behead';
    if (Math.random() < 0.55) this._sayInvader(e, randPick(INVADER_CIV_LINES));
  }

  /** Nearby invader + free ally sometimes agree to pull a civilian apart (exactly two). */
  _maybeProposeTearPair(e) {
    if (!this._atkEnabled('tear')) return;
    if (!e || e.civTarget || e.holding || e.tearing || e.beheading || e.aggroTimer > 0) return;
    if (e.knockdownTimer > 0 || e.stunTimer > 0) return;

    let bestS = null;
    let bestD = TEAR_PAIR_CIV_RANGE + (this._atkSolo('tear') ? 3 : 0);
    for (const s of this.spaniards) {
      if (s.hp <= 0 || s.tearing || s.heldBy || s.beheading || s.weaponBy) continue;
      if (this._countHuntersOn(s) > 0) continue;
      const d = Math.hypot(s.mesh.position.x - e.mesh.position.x, s.mesh.position.z - e.mesh.position.z);
      if (d < bestD) {
        bestD = d;
        bestS = s;
      }
    }
    if (!bestS) return;

    let partner = null;
    let partnerBest = Infinity;
    const allyRange = TEAR_PAIR_ALLY_RANGE + (this._atkSolo('tear') ? 4 : 0);
    for (const o of this.enemies) {
      if (o === e || o.civTarget || o.holding || o.tearing || o.beheading) continue;
      if (o.knockdownTimer > 0 || o.stunTimer > 0 || o.aggroTimer > 0) continue;
      const dAlly = Math.hypot(o.mesh.position.x - e.mesh.position.x, o.mesh.position.z - e.mesh.position.z);
      if (dAlly > allyRange) continue;
      const dCiv = Math.hypot(
        o.mesh.position.x - bestS.mesh.position.x,
        o.mesh.position.z - bestS.mesh.position.z,
      );
      if (dCiv > allyRange + 1.5) continue;
      if (dAlly < partnerBest) {
        partnerBest = dAlly;
        partner = o;
      }
    }
    if (!partner) return;
    // Not every encounter — opportunistic (always when isolating tear)
    if (!this._atkSolo('tear') && Math.random() > 0.32) return;

    const timer = 5.5 + Math.random() * 2.5;
    e.civTarget = bestS;
    e.civHuntTimer = timer;
    e.civHuntMode = 'tear';
    partner.civTarget = bestS;
    partner.civHuntTimer = timer;
    partner.civHuntMode = 'tear';
    if (Math.random() < 0.55) this._sayInvader(e, randPick(INVADER_CIV_LINES));
    if (Math.random() < 0.4) this._sayInvader(partner, randPick(INVADER_CIV_LINES));
  }

  /** One of a designated pair pins the civilian while the partner closes in. */
  _beginHoldCivilian(holder, s) {
    if (!this._atkEnabled('tear')) return;
    if (!holder || !s || s.tearing || s.heldBy || s.beheading || holder.holding || holder.tearing || holder.beheading) return;
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
    this._dropExtraHunters(s, holder);
  }

  /** Keep at most two hunters on a civilian (holder + one partner). */
  _dropExtraHunters(s, keep) {
    const keepSet = new Set();
    if (keep) keepSet.add(keep);
    if (s.heldBy) keepSet.add(s.heldBy);
    // Preserve the closest other hunter as the partner slot
    let partner = null;
    let partnerD = Infinity;
    for (const e of this.enemies) {
      if (keepSet.has(e)) continue;
      if (e.civTarget !== s && e.holding !== s) continue;
      const d = Math.hypot(e.mesh.position.x - s.mesh.position.x, e.mesh.position.z - s.mesh.position.z);
      if (d < partnerD) {
        partnerD = d;
        partner = e;
      }
    }
    if (partner) keepSet.add(partner);
    for (const e of this.enemies) {
      if (keepSet.has(e)) continue;
      if (e.civTarget === s) this._clearCivHunt(e);
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
      if (!s.heldBy || s.tearing || s.beheading) continue;

      s.holdTimer = Math.max(0, s.holdTimer - dt);
      const holder = s.heldBy;
      const holderOk = this.enemies.includes(holder) && holder.hp > 0 && !holder.knockdownTimer;

      if (!holderOk || s.holdTimer <= 0) {
        this._releaseHold(s);
        continue;
      }

      // Second invader in range → start the pull-apart
      if (this._atkEnabled('tear') && this._countSwarmOn(s, 3.2) >= 2) {
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

      if (s.hpBar) updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y, s.mesh.rotation.x);
    }
  }

  /** Solo pin → draw machete → chop head. */
  _beginBehead(killer, s) {
    if (!this._atkEnabled('behead')) return;
    if (!killer || !s || s.hp <= 0) return;
    if (s.tearing || s.heldBy || s.beheading) return;
    if (killer.holding || killer.tearing || killer.beheading) return;

    if (s.heldBy) this._releaseHold(s);
    this._dropExtraHunters(s, killer);

    s.beheading = {
      killer,
      t: 0,
      chopped: false,
      drew: false,
      raised: false,
    };
    s.kbx = 0;
    s.kbz = 0;
    s.fearTimer = BEHEAD_END + 1;
    if (s.hpBar) s.hpBar.visible = false;

    killer.beheading = s;
    killer.civTarget = s;
    killer.civHuntTimer = BEHEAD_END + 2;
    killer.kbx = 0;
    killer.kbz = 0;
    setMachete(killer.mesh, false);

    this._saySpaniard(s, randPick(FEAR_LINES), true);
    this._sayInvader(killer, randPick(INVADER_CIV_LINES));
  }

  _cancelBehead(s) {
    if (!s?.beheading) return;
    const killer = s.beheading.killer;
    if (killer) {
      if (killer.beheading === s) killer.beheading = null;
      setMachete(killer.mesh, false);
      this._clearCivHunt(killer);
    }
    s.beheading = null;
    s.mesh.rotation.x = 0;
    s.mesh.rotation.z = 0;
    s.mesh.position.y = 0;
    s.fearTimer = Math.max(s.fearTimer, SPANIARD_FEAR_TIME);
  }

  /**
   * World point where the blade meets the neck: a pace in front of the killer,
   * slightly to their right (right-handed chop), at prone neck height.
   * Kept stable for the whole pin — do not track the raised blade tip.
   */
  _beheadNeckTarget(killer) {
    if (!this._beheadNeck) this._beheadNeck = new THREE.Vector3();
    const facing = killer.mesh.rotation.y;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);
    // Forward ~ reach of a lowered right arm; right ~ shoulder / swing bias
    this._beheadNeck.set(
      killer.mesh.position.x + fx * 0.68 + fz * 0.16,
      0.33,
      killer.mesh.position.z + fz * 0.68 - fx * 0.16,
    );
    return this._beheadNeck;
  }

  /**
   * Face-down, head toward killer, feet away. Snaps so the neck (not the skull
   * center, not the feet origin) sits on `neckTarget`.
   */
  _poseBeheadVictim(s, killer, neckTarget) {
    const facing = killer.mesh.rotation.y;
    const fx = Math.sin(facing);
    const fz = Math.cos(facing);

    // YXZ: yaw opposite the killer, then pitch into the ground → head toward killer
    s.mesh.rotation.y = facing + Math.PI;
    s.mesh.rotation.x = Math.PI / 2;
    s.mesh.rotation.z = 0;

    // Seed past the neck so the head can settle on the killer's side of the cut
    s.mesh.position.set(
      neckTarget.x + fx * 1.85,
      0.28,
      neckTarget.z + fz * 1.85,
    );
    s.mesh.updateMatrixWorld(true);

    const rig = s.mesh.userData.rig;
    if (!rig?.head) {
      s.mesh.position.set(neckTarget.x + fx * 1.6, 0.28, neckTarget.z + fz * 1.6);
      return;
    }

    if (!this._beheadHead) this._beheadHead = new THREE.Vector3();
    if (!this._beheadTorso) this._beheadTorso = new THREE.Vector3();
    rig.head.getWorldPosition(this._beheadHead);
    if (rig.torso) rig.torso.getWorldPosition(this._beheadTorso);
    else this._beheadTorso.copy(this._beheadHead);

    // Neck sits between head and torso, biased toward the head
    const nx = this._beheadHead.x * 0.62 + this._beheadTorso.x * 0.38;
    const ny = this._beheadHead.y * 0.62 + this._beheadTorso.y * 0.38;
    const nz = this._beheadHead.z * 0.62 + this._beheadTorso.z * 0.38;

    s.mesh.position.x += neckTarget.x - nx;
    s.mesh.position.y += neckTarget.y - ny;
    s.mesh.position.z += neckTarget.z - nz;
  }

  _poseBeheadKiller(killer, t) {
    const krig = killer.mesh.userData.rig;
    if (!krig?.lArm || !krig?.rArm) return;
    killer.mesh.position.y = 0;

    if (t < BEHEAD_PIN) {
      // Kneel-press over the upper back / neck
      krig.lArm.rotation.x = -1.35;
      krig.rArm.rotation.x = -1.25;
      krig.lArm.rotation.y = 0;
      krig.rArm.rotation.y = 0;
      krig.lArm.rotation.z = -0.15;
      krig.rArm.rotation.z = 0.2;
      if (krig.lElbow) krig.lElbow.rotation.x = -0.55;
      if (krig.rElbow) krig.rElbow.rotation.x = -0.45;
      if (krig.lLeg) krig.lLeg.rotation.x = 0.55;
      if (krig.rLeg) krig.rLeg.rotation.x = -0.35;
    } else if (t < BEHEAD_DRAW) {
      const u = (t - BEHEAD_PIN) / Math.max(0.001, BEHEAD_DRAW - BEHEAD_PIN);
      krig.lArm.rotation.x = -1.35;
      krig.lArm.rotation.z = -0.2;
      krig.rArm.rotation.x = -0.4 - u * 0.5;
      krig.rArm.rotation.z = 0.55 + u * 0.35;
      krig.rArm.rotation.y = -u * 0.4;
      if (krig.rElbow) krig.rElbow.rotation.x = -0.7 + u * 0.2;
      if (krig.lElbow) krig.lElbow.rotation.x = -0.55;
      if (krig.machete) krig.machete.rotation.z = -0.4 + u * 0.2;
    } else if (t < BEHEAD_RAISE) {
      const u = (t - BEHEAD_DRAW) / Math.max(0.001, BEHEAD_RAISE - BEHEAD_DRAW);
      krig.lArm.rotation.x = -1.2;
      krig.lArm.rotation.z = -0.25;
      // Left stays on the upper back while the blade rises
      krig.rArm.rotation.x = -0.9 - u * 1.5;
      krig.rArm.rotation.z = 0.25 - u * 0.1;
      krig.rArm.rotation.y = -0.3 + u * 0.15;
      if (krig.rElbow) krig.rElbow.rotation.x = -0.2 - u * 0.15;
      if (krig.lElbow) krig.lElbow.rotation.x = -0.5;
      if (krig.machete) krig.machete.rotation.z = -0.15;
      if (krig.head) krig.head.rotation.x = -0.1;
    } else if (t < BEHEAD_CHOP) {
      const u = (t - BEHEAD_RAISE) / Math.max(0.001, BEHEAD_CHOP - BEHEAD_RAISE);
      const ease = u * u;
      krig.lArm.rotation.x = -1.15;
      krig.lArm.rotation.z = -0.2;
      krig.rArm.rotation.x = -2.4 + ease * 2.6;
      krig.rArm.rotation.z = 0.15;
      krig.rArm.rotation.y = -0.1;
      if (krig.rElbow) krig.rElbow.rotation.x = -0.35 + ease * 0.2;
      if (krig.machete) krig.machete.rotation.z = -0.1 + ease * 0.5;
    } else {
      krig.lArm.rotation.x = -1.1;
      krig.rArm.rotation.x = 0.35;
      krig.rArm.rotation.z = 0.2;
      if (krig.rElbow) krig.rElbow.rotation.x = -0.25;
      if (krig.machete) krig.machete.rotation.z = 0.45;
    }
  }

  _updateBeheadings(dt) {
    for (let i = this.spaniards.length - 1; i >= 0; i--) {
      const s = this.spaniards[i];
      if (!s.beheading) continue;
      const B = s.beheading;
      const killer = B.killer;
      const killerOk = this.enemies.includes(killer)
        && killer.hp > 0
        && !killer.knockdownTimer
        && !killer.stunTimer;

      if (!killerOk) {
        this._cancelBehead(s);
        continue;
      }

      B.t += dt;
      const t = B.t;
      const facing = killer.mesh.rotation.y;
      const fx = Math.sin(facing);
      const fz = Math.cos(facing);
      const neck = this._beheadNeckTarget(killer);

      s.kbx = 0;
      s.kbz = 0;

      // Killer pose first (drives the read of the execution)
      if (t >= BEHEAD_PIN && !B.drew) {
        B.drew = true;
        setMachete(killer.mesh, true);
        this.sfx.macheteDraw();
      } else if (t >= BEHEAD_DRAW && !B.raised) {
        B.raised = true;
        setMachete(killer.mesh, true);
      }
      this._poseBeheadKiller(killer, t);

      if (!B.chopped) {
        this._poseBeheadVictim(s, killer, neck);
      } else {
        s.mesh.rotation.y = facing + Math.PI;
        s.mesh.rotation.x = Math.PI / 2;
        s.mesh.rotation.z = 0;
        s.mesh.position.x = B.bodyX;
        s.mesh.position.y = B.bodyY;
        s.mesh.position.z = B.bodyZ;
      }

      const vrig = s.mesh.userData.rig;
      if (vrig?.lArm && vrig?.rArm) {
        const flail = Math.sin(this.time * 16) * 0.5;
        vrig.lArm.rotation.x = -0.3 + flail;
        vrig.rArm.rotation.x = -0.3 - flail;
        vrig.lArm.rotation.z = -0.55;
        vrig.rArm.rotation.z = 0.55;
        if (vrig.lLeg) vrig.lLeg.rotation.x = 0.35 + flail * 0.2;
        if (vrig.rLeg) vrig.rLeg.rotation.x = 0.35 - flail * 0.2;
      }

      if (t >= BEHEAD_CHOP && !B.chopped) {
        B.chopped = true;
        B.bodyX = s.mesh.position.x;
        B.bodyY = s.mesh.position.y;
        B.bodyZ = s.mesh.position.z;
        const hx = neck.x;
        const hz = neck.z;
        const parts = detachBodyParts(s.mesh, ['head']);
        for (const p of parts) {
          // Head tumbles away from the killer along the body axis
          this._spawnGib(
            p.mesh,
            -fx * (1.2 + Math.random()) + (Math.random() - 0.5) * 1.2,
            -fz * (1.2 + Math.random()) + (Math.random() - 0.5) * 1.2,
            2.2 + Math.random() * 3,
            2.2,
          );
        }
        this._bloodBurst(hx, hz, { heavy: true });
        this._bloodSpray(hx, hz, fx, fz, { mild: false });
        this.sfx.macheteChop();
        this.shake = Math.min(1.15, this.shake + 0.45);
        if (Math.random() < 0.7) this._sayInvader(killer, randPick(INVADER_CIV_LINES));
      }

      if (s.speechCd <= 0 && t < BEHEAD_CHOP) this._saySpaniard(s, randPick(FEAR_LINES), true);

      if (t >= BEHEAD_END) {
        this._finishBehead(s);
      }
    }
  }

  _finishBehead(s) {
    const idx = this.spaniards.indexOf(s);
    if (idx < 0) return;
    const B = s.beheading;
    const killer = B?.killer;
    const x = s.mesh.position.x;
    const z = s.mesh.position.z;

    if (killer) {
      if (killer.beheading === s) killer.beheading = null;
      setMachete(killer.mesh, false);
      this._clearCivHunt(killer);
      if (Math.random() < 0.5) this._sayInvader(killer, randPick(INVADER_CIV_LINES));
    }
    for (const e of this.enemies) {
      if (e.civTarget === s) this._clearCivHunt(e);
    }

    s.beheading = null;
    s.mesh.rotation.x = 0;
    s.mesh.rotation.z = 0;
    if (s.hpBar) s.hpBar.visible = false;

    // Headless stump collapses
    if (s.mesh.parent) s.mesh.parent.remove(s.mesh);
    this._spawnGib(s.mesh, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0.8 + Math.random(), 2.0);
    this._bloodSpray(x, z, 0, 1, { mild: false });

    if (s.bubble) s.bubble.remove();
    this.spaniards.splice(idx, 1);
  }

  _pickTearPair(s) {
    const candidates = [];
    for (const e of this.enemies) {
      if (e.knockdownTimer > 0 || e.stunTimer > 0 || e.tearing || e.beheading) continue;
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
    if (!this._atkEnabled('tear')) return;
    if (!s || s.tearing || s.beheading || s.hp <= 0) return;
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
    a.civTarget = s;
    b.civTarget = s;
    a.civHuntTimer = TEAR_DURATION + 1;
    b.civHuntTimer = TEAR_DURATION + 1;
    // Only the pair participates — drop anyone else queued on this civilian
    for (const e of this.enemies) {
      if (e === a || e === b) continue;
      if (e.civTarget === s) this._clearCivHunt(e);
    }
    a.kbx = 0;
    a.kbz = 0;
    b.kbx = 0;
    b.kbz = 0;

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
      this._clearCivHunt(T.a);
      if (Math.random() < 0.6) this._sayInvader(T.a, randPick(INVADER_CIV_LINES));
    }
    if (T?.b) {
      this._clearCivHunt(T.b);
      if (Math.random() < 0.6) this._sayInvader(T.b, randPick(INVADER_CIV_LINES));
    }
    for (const e of this.enemies) {
      if (e.civTarget === s) this._clearCivHunt(e);
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

  _spawnGib(mesh, vx, vz, vy, life = 2.4, opts = {}) {
    this.world.add(mesh);
    this.fx.push({
      mesh,
      vx,
      vz,
      vy,
      life: life * (0.85 + Math.random() * 0.3),
      max: life,
      spin: (Math.random() - 0.5) * (opts.spin ?? 14),
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
    if (s.beheading) this._cancelBehead(s);
    if (s.heldBy) this._releaseHold(s);
    if (s.weaponBy) {
      const holder = s.weaponBy;
      if (holder.weaponCiv === s) {
        holder.weaponCiv = null;
        holder.clubHits = 0;
        holder.clubSwingT = 0;
      }
      s.weaponBy = null;
    }
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
      if (e.civTarget === s) this._clearCivHunt(e);
      if (e.tearing === s) e.tearing = null;
      if (e.holding === s) e.holding = null;
      if (e.weaponCiv === s) {
        e.weaponCiv = null;
        e.clubHits = 0;
        e.clubSwingT = 0;
      }
      if (e.beheading === s) {
        setMachete(e.mesh, false);
        e.beheading = null;
      }
    }
  }

  _updateSpaniards(dt) {
    for (let i = this.spaniards.length - 1; i >= 0; i--) {
      const s = this.spaniards[i];
      this._regenLiving(s, dt);
      s.hitFlash = Math.max(0, s.hitFlash - dt);
      s.fearTimer = Math.max(0, s.fearTimer - dt);
      s.speechCd = Math.max(0, s.speechCd - dt);
      s.speechLife = Math.max(0, s.speechLife - dt);
      s.wanderCd = Math.max(0, s.wanderCd - dt);

      if (s.hitFlash > 0) setTint(s.mesh, 0xffffff);
      else clearTint(s.mesh);

      if (s.speechLife <= 0 && s.bubble) s.bubble.classList.remove('on');

      // Being pulled apart, held, used as a weapon, or executed — posing handled elsewhere
      if (s.tearing || s.heldBy || s.beheading || s.weaponBy) {
        updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y, s.mesh.rotation.x);
        continue;
      }

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
        const fleeTx = s.mesh.position.x + fx * 10;
        const fleeTz = s.mesh.position.z + fz * 10;
        const steer = this._steer(s, fleeTx, fleeTz);
        const wobble = Math.sin(this.time * 9 + i * 2.1) * 0.35;
        mx = steer.x + (-steer.z) * wobble;
        mz = steer.z + steer.x * wobble;
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
            const steer = this._steer(s, greet.mesh.position.x, greet.mesh.position.z);
            mx = steer.x;
            mz = steer.z;
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
            const steer = this._steer(s, s.wanderTx, s.wanderTz);
            mx = steer.x;
            mz = steer.z;
            moveSpeed = s.speed * 0.55;
            if (mx || mz) s.mesh.rotation.y = Math.atan2(mx, mz);
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
      updateHealthBar(s.hpBar, s.hp, s.maxHp, s.mesh.rotation.y, s.mesh.rotation.x);
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
    if (e.weaponCiv) this._discardClubWeapon(e, { fling: true });
    if (e.holding) this._releaseHold(e.holding);
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
    if (e.weaponCiv) this._discardClubWeapon(e, { fling: true });
    if (e.holding) this._releaseHold(e.holding);
    if (e.beheading) this._cancelBehead(e.beheading);
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
    this.gold += e.gold || 0;
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
    updateHealthBar(this.playerHpBar, this.hp, this.maxHp, this.player.rotation.y, this.player.rotation.x);
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
    if (this.el.gold) this.el.gold.textContent = String(this.gold);
    if (this.el.wave) this.el.wave.textContent = String(this.wave);
    if (this.el.breached) {
      this.el.breached.textContent = `${this.breached}/${this.breachLimit}`;
    }
    if (this.el.enemies) {
      this.el.enemies.textContent = String(this.enemies.length + this.boats.reduce((n, b) => n + b.passengers.length, 0));
    }
    if (this.running && this.playerAlive) this._renderShop();
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
      ctx.arc(x, y, e.kind === 'leader' ? 4 : e.kind === 'sturdy' ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Arrow towers (placed)
    for (const t of this.towers) {
      const x = toX(t.mesh.position.x);
      const y = toY(t.mesh.position.z);
      ctx.fillStyle = '#d4b878';
      ctx.fillRect(x - 3, y - 3, 6, 6);
      ctx.strokeStyle = 'rgba(8, 22, 32, 0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 3, y - 3, 6, 6);
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
