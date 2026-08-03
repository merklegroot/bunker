import * as THREE from 'three';

/** Axis-aligned solid. x,z = center. */
export function wall(x, z, w, d, h = 3.2) {
  return { x, z, w, d, h, hx: w * 0.5, hz: d * 0.5 };
}

/**
 * Rough Tarajal (Ceuta) layout:
 *   -Z  city / promenade (invader destination)
 *   mid sand beach + border fence
 *   +Z  Mediterranean (boat / swimmer spawn)
 *   +X  espigón / border breakwater
 */
export function buildLevelSpec(_wave = 1) {
  const MAP = 72;
  const HALF = MAP / 2;
  const CELL = 2;

  // Shore band: water z > waterLine, sand between, city z < cityLine
  const waterLine = 10;
  const shoreLine = 2;
  const cityLine = -14;
  const breachZ = cityLine - 4;
  const breachHalfW = 5;

  const walls = [];
  const floors = [];
  const props = [];

  // —— Ground planes (non-overlapping Z bands to avoid z-fighting) ——
  // Water is built as a shaded plane in buildLevelMeshes (deep + shallow bands).
  // Wet sand band  z: 8 → 2
  floors.push({ x: 0, z: 5, w: MAP + 2, d: 6, color: 0xb8a878, y: -0.04, kind: 'wet' });
  // Dry sand  z: 2 → -14
  floors.push({ x: 0, z: -6, w: MAP + 2, d: 16, color: 0xd8c49a, y: 0, kind: 'sand' });
  // Warm sand strip near promenade
  floors.push({ x: 0, z: -13.2, w: MAP + 2, d: 1.6, color: 0xcbb892, y: 0.02, kind: 'sand' });
  // Promenade / asphalt  z: -14 → -18
  floors.push({ x: 0, z: -16, w: MAP + 2, d: 4, color: 0x5a5a58, y: 0.08, kind: 'road' });
  // City plaza  z: -18 → -36
  floors.push({ x: 0, z: -27, w: MAP + 4, d: 18, color: 0x6a6860, y: 0.08, kind: 'plaza' });

  // —— Border fence (east side, toward Morocco) ——
  // Single thin panels for collision; posts are visual-only (avoids z-fight)
  const fenceX = 22;
  walls.push(wall(fenceX, 0, 0.12, 56, 2.1));
  walls.push(wall(fenceX + 1.4, 0, 0.12, 56, 2.1));

  // Espigón / rocky breakwater extending into the sea
  for (let i = 0; i < 10; i++) {
    const ez = 12 + i * 2.4;
    const ew = 2.2 + (i % 3) * 0.4;
    // Offset successive rocks so they barely overlap
    walls.push(wall(fenceX - 0.4 + (i % 2) * 0.5, ez, ew, 1.8, 0.7 + (i % 2) * 0.35));
  }

  // —— City buildings (north) —— blocking except the breach gate
  // West block
  walls.push(wall(-16, -26, 18, 10, 4.5));
  walls.push(wall(-22, -18, 8, 8, 3.2));
  // East block (near fence)
  walls.push(wall(14, -26, 14, 10, 4.2));
  walls.push(wall(10, -18, 10, 6, 3.0));
  // Far north wall (city interior)
  walls.push(wall(-8, -32, 12, 4, 3.5));
  walls.push(wall(8, -32, 10, 4, 3.8));

  // Border crossing / customs booth (east of beach near fence)
  walls.push(wall(16, -8, 6, 4, 2.8));
  walls.push(wall(18, -4, 3, 2.5, 2.2));

  // Low dunes / rock clusters on beach (cover)
  const coverSpots = [
    [-14, 4], [-8, -2], [6, 6], [-18, -6], [4, -8],
    [-4, 8], [10, 2], [-12, -10], [2, -4],
  ];
  for (const [cx, cz] of coverSpots) {
    const hw = 1.2 + Math.random() * 1.4;
    const hd = 0.9 + Math.random() * 1.1;
    const hh = 0.55 + Math.random() * 0.55;
    walls.push(wall(cx, cz, hw, hd, hh));
    props.push({ kind: 'rock', x: cx, z: cz, w: hw, d: hd, h: hh });
  }

  // Palm / scrub markers (visual only; meshes in buildLevelMeshes)
  const flora = [
    [-20, -12], [-24, 0], [8, -12], [-16, 10], [12, 8],
    [-22, -6], [14, -10], [-10, 9], [6, -11], [-26, 4],
    [10, -14], [-18, -14],
  ];
  const scrub = [
    [-15, 2], [-6, 5], [3, 3], [9, -1], [-11, -5],
    [15, 4], [-19, 7], [1, -9], [-3, 7], [12, -6],
  ];

  // Outer bounds (invisible play fence — low)
  walls.push(wall(0, HALF + 1, MAP + 4, 2, 1.5));
  walls.push(wall(0, -HALF - 1, MAP + 4, 2, 2.5));
  walls.push(wall(-HALF - 1, 0, 2, MAP + 4, 2));
  walls.push(wall(HALF + 1, 0, 2, MAP + 4, 2));

  // Player starts mid-beach facing the sea
  const playerSpawn = { x: -4, z: -2 };

  // Invaders run toward the open gate into the city
  const destination = { x: 0, z: breachZ };

  // Boat spawn band (offshore)
  const boatSpawns = [];
  for (let i = 0; i < 8; i++) {
    boatSpawns.push({
      x: -18 + i * 5 + (Math.random() - 0.5) * 2,
      z: 26 + Math.random() * 6,
    });
  }

  // Swimmer spawn (near shore / around espigón)
  const swimSpawns = [];
  for (let i = 0; i < 10; i++) {
    swimSpawns.push({
      x: -20 + Math.random() * 36,
      z: waterLine + 2 + Math.random() * 8,
    });
  }
  // Around the breakwater tip
  for (let i = 0; i < 4; i++) {
    swimSpawns.push({
      x: fenceX - 4 - Math.random() * 4,
      z: 20 + Math.random() * 8,
    });
  }

  return {
    MAP,
    HALF,
    CELL,
    walls,
    floors,
    props,
    flora,
    scrub,
    playerSpawn,
    destination,
    breachZ,
    breachHalfW,
    waterLine,
    shoreLine,
    cityLine,
    fenceX,
    boatSpawns,
    swimSpawns,
  };
}

export function circleHitsWall(cx, cz, r, walls) {
  for (const w of walls) {
    const nearestX = Math.max(w.x - w.hx, Math.min(cx, w.x + w.hx));
    const nearestZ = Math.max(w.z - w.hz, Math.min(cz, w.z + w.hz));
    const dx = cx - nearestX;
    const dz = cz - nearestZ;
    if (dx * dx + dz * dz < r * r) return w;
  }
  return null;
}

export function resolveCircle(pos, r, walls, passes = 3) {
  for (let p = 0; p < passes; p++) {
    for (const w of walls) {
      const nearestX = Math.max(w.x - w.hx, Math.min(pos.x, w.x + w.hx));
      const nearestZ = Math.max(w.z - w.hz, Math.min(pos.z, w.z + w.hz));
      let dx = pos.x - nearestX;
      let dz = pos.z - nearestZ;
      const dist2 = dx * dx + dz * dz;
      if (dist2 >= r * r) continue;
      if (dist2 < 1e-8) {
        const oxL = (pos.x - (w.x - w.hx)) + r;
        const oxR = ((w.x + w.hx) - pos.x) + r;
        const ozB = (pos.z - (w.z - w.hz)) + r;
        const ozT = ((w.z + w.hz) - pos.z) + r;
        const m = Math.min(oxL, oxR, ozB, ozT);
        if (m === oxL) pos.x = w.x - w.hx - r;
        else if (m === oxR) pos.x = w.x + w.hx + r;
        else if (m === ozB) pos.z = w.z - w.hz - r;
        else pos.z = w.z + w.hz + r;
      } else {
        const dist = Math.sqrt(dist2);
        const push = (r - dist) / dist;
        pos.x += dx * push;
        pos.z += dz * push;
      }
    }
  }
  return pos;
}

export function segmentHitsWall(x0, z0, x1, z1, walls, pad = 0) {
  for (const w of walls) {
    if (_segAabb(
      x0, z0, x1, z1,
      w.x - w.hx - pad, w.z - w.hz - pad,
      w.x + w.hx + pad, w.z + w.hz + pad,
    )) return true;
  }
  return false;
}

function _segAabb(x0, z0, x1, z1, minX, minZ, maxX, maxZ) {
  let t0 = 0;
  let t1 = 1;
  const dx = x1 - x0;
  const dz = z1 - z0;
  const clip = (p, q) => {
    if (Math.abs(p) < 1e-9) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  return clip(-dx, x0 - minX)
    && clip(dx, maxX - x0)
    && clip(-dz, z0 - minZ)
    && clip(dz, maxZ - z0)
    && t0 < t1;
}

export function hasLineOfSight(x0, z0, x1, z1, walls) {
  return !segmentHitsWall(x0, z0, x1, z1, walls, 0.05);
}

/**
 * Build a coarse walkability grid (inflated by clearance for agent radius).
 * Origin is map center; cell (0,0) is at world (-HALF, -HALF).
 */
export function buildNavGrid(spec, clearance = 0.55) {
  const { MAP, HALF, CELL, walls } = spec;
  const cols = Math.ceil(MAP / CELL);
  const rows = Math.ceil(MAP / CELL);
  const blocked = new Uint8Array(cols * rows);
  for (let cz = 0; cz < rows; cz++) {
    for (let cx = 0; cx < cols; cx++) {
      const wx = -HALF + (cx + 0.5) * CELL;
      const wz = -HALF + (cz + 0.5) * CELL;
      // Sample center + corners so thin walls still block
      let hit = circleHitsWall(wx, wz, clearance, walls);
      if (!hit) {
        const o = CELL * 0.35;
        hit = circleHitsWall(wx + o, wz + o, clearance * 0.7, walls)
          || circleHitsWall(wx - o, wz + o, clearance * 0.7, walls)
          || circleHitsWall(wx + o, wz - o, clearance * 0.7, walls)
          || circleHitsWall(wx - o, wz - o, clearance * 0.7, walls);
      }
      if (hit) blocked[cz * cols + cx] = 1;
    }
  }
  return { cols, rows, cell: CELL, half: HALF, blocked };
}

export function worldToCell(nav, x, z) {
  const cx = Math.floor((x + nav.half) / nav.cell);
  const cz = Math.floor((z + nav.half) / nav.cell);
  return {
    cx: Math.max(0, Math.min(nav.cols - 1, cx)),
    cz: Math.max(0, Math.min(nav.rows - 1, cz)),
  };
}

export function cellToWorld(nav, cx, cz) {
  return {
    x: -nav.half + (cx + 0.5) * nav.cell,
    z: -nav.half + (cz + 0.5) * nav.cell,
  };
}

function _navWalkable(nav, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= nav.cols || cz >= nav.rows) return false;
  return nav.blocked[cz * nav.cols + cx] === 0;
}

/** Nearest walkable cell to a world point (spiral search). */
export function nearestWalkable(nav, x, z) {
  let { cx, cz } = worldToCell(nav, x, z);
  if (_navWalkable(nav, cx, cz)) return { cx, cz };
  for (let r = 1; r <= 8; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        if (_navWalkable(nav, cx + dx, cz + dz)) return { cx: cx + dx, cz: cz + dz };
      }
    }
  }
  return { cx, cz };
}

/**
 * A* on the nav grid. Returns world-space waypoints (excluding start), or null.
 */
export function findPath(nav, x0, z0, x1, z1) {
  if (!nav) return null;
  const start = nearestWalkable(nav, x0, z0);
  const goal = nearestWalkable(nav, x1, z1);
  if (start.cx === goal.cx && start.cz === goal.cz) {
    return [{ x: x1, z: z1 }];
  }

  const cols = nav.cols;
  const rows = nav.rows;
  const N = cols * rows;
  const came = new Int32Array(N).fill(-1);
  const gScore = new Float32Array(N).fill(Infinity);
  const fScore = new Float32Array(N).fill(Infinity);
  const closed = new Uint8Array(N);
  const open = [];

  const idx = (cx, cz) => cz * cols + cx;
  const heur = (cx, cz) => {
    const dx = Math.abs(cx - goal.cx);
    const dz = Math.abs(cz - goal.cz);
    return Math.max(dx, dz) + Math.min(dx, dz) * 0.414; // octile
  };

  const s = idx(start.cx, start.cz);
  gScore[s] = 0;
  fScore[s] = heur(start.cx, start.cz);
  open.push(s);

  const neigh = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
  ];

  let found = -1;
  let guard = N * 4;
  while (open.length && guard-- > 0) {
    // Pop lowest f
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      if (fScore[open[i]] < fScore[open[bi]]) bi = i;
    }
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;

    const ccx = cur % cols;
    const ccz = (cur / cols) | 0;
    if (ccx === goal.cx && ccz === goal.cz) {
      found = cur;
      break;
    }

    for (const [dx, dz, cost] of neigh) {
      const nx = ccx + dx;
      const nz = ccz + dz;
      if (!_navWalkable(nav, nx, nz)) continue;
      // No corner-cutting through blocked diagonals
      if (dx !== 0 && dz !== 0) {
        if (!_navWalkable(nav, ccx + dx, ccz) || !_navWalkable(nav, ccx, ccz + dz)) continue;
      }
      const ni = idx(nx, nz);
      if (closed[ni]) continue;
      const tent = gScore[cur] + cost;
      if (tent >= gScore[ni]) continue;
      came[ni] = cur;
      gScore[ni] = tent;
      fScore[ni] = tent + heur(nx, nz);
      open.push(ni);
    }
  }

  if (found < 0) return null;

  const cells = [];
  for (let c = found; c >= 0; c = came[c]) cells.push(c);
  cells.reverse();

  const path = [];
  for (let i = 1; i < cells.length; i++) {
    const c = cells[i];
    const w = cellToWorld(nav, c % cols, (c / cols) | 0);
    path.push(w);
  }
  // Snap final waypoint toward actual goal
  path.push({ x: x1, z: z1 });
  return path;
}

/**
 * Steering toward a goal: straight if LOS, else follow A* waypoints.
 * Mutates `state` ({ path, i, goalX, goalZ, until }).
 * Returns { x, z } unit direction (or zeros).
 */
export function steerTo(nav, walls, x, z, tx, tz, state, time) {
  const dx = tx - x;
  const dz = tz - z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.15) return { x: 0, z: 0 };

  if (hasLineOfSight(x, z, tx, tz, walls)) {
    state.path = null;
    state.i = 0;
    return { x: dx / dist, z: dz / dist };
  }

  const goalMoved = !state.path
    || Math.hypot((state.goalX ?? tx) - tx, (state.goalZ ?? tz) - tz) > 2.2
    || time >= (state.until ?? 0);

  if (goalMoved) {
    state.path = findPath(nav, x, z, tx, tz);
    state.i = 0;
    state.goalX = tx;
    state.goalZ = tz;
    state.until = time + 0.55 + Math.random() * 0.35;
  }

  if (!state.path || state.path.length === 0) {
    return { x: dx / dist, z: dz / dist };
  }

  // Advance past nearby / skip-ahead if LOS to later waypoint
  while (state.i < state.path.length) {
    const w = state.path[state.i];
    if (Math.hypot(w.x - x, w.z - z) < 1.15) {
      state.i += 1;
      continue;
    }
    break;
  }
  // LOS shortcut along the path
  while (state.i + 1 < state.path.length) {
    const w2 = state.path[state.i + 1];
    if (hasLineOfSight(x, z, w2.x, w2.z, walls)) state.i += 1;
    else break;
  }

  if (state.i >= state.path.length) {
    return { x: dx / dist, z: dz / dist };
  }
  const w = state.path[state.i];
  const wx = w.x - x;
  const wz = w.z - z;
  const wd = Math.hypot(wx, wz) || 1;
  return { x: wx / wd, z: wz / wd };
}

function makeMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

const BUILDING = [0x8a8070, 0x7a7468, 0x9a9080, 0x6a6558, 0xa09888, 0xb0a090];
const ROCK = [0x6a6458, 0x5a5448, 0x7a7060, 0x4a4840, 0x8a8070];
const WINDOW = 0x2a4050;
const WINDOW_LIT = 0xc8b878;

function glslNoiseFns() {
  return /* glsl */`
    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise21(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise21(p);
        p = p * 2.02 + vec2(17.1, 9.7);
        a *= 0.5;
      }
      return v;
    }
  `;
}

function createWaterMaterial(waterLine) {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uWaterLine: { value: waterLine },
      uDeep: { value: new THREE.Color(0x123848) },
      uMid: { value: new THREE.Color(0x286888) },
      uShallow: { value: new THREE.Color(0x52a8bc) },
      uFoam: { value: new THREE.Color(0xd8eef4) },
      uCaustic: { value: new THREE.Color(0x7ec8d8) },
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
      uniform float uTime;
      uniform float uWaterLine;
      uniform vec3 uDeep;
      uniform vec3 uMid;
      uniform vec3 uShallow;
      uniform vec3 uFoam;
      uniform vec3 uCaustic;
      varying vec2 vWorldXZ;
      ${glslNoiseFns()}

      void main() {
        float shore = vWorldXZ.y;
        float depth = clamp((shore - (uWaterLine - 1.5)) / 18.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.42, depth));
        col = mix(col, uDeep, smoothstep(0.38, 1.0, depth));

        // Rolling wave bands toward shore
        float waves = sin(shore * 1.15 - uTime * 1.8 + sin(vWorldXZ.x * 0.25) * 0.8);
        waves = waves * 0.5 + 0.5;
        col += waves * 0.045 * (1.0 - depth * 0.55) * vec3(0.65, 0.85, 0.95);

        // Cross ripples
        float ripA = sin(vWorldXZ.x * 0.55 + uTime * 1.35) * sin(vWorldXZ.y * 0.4 + uTime * 0.95);
        float ripB = sin(vWorldXZ.x * 1.25 - uTime * 0.85 + vWorldXZ.y * 0.7);
        col += (ripA * 0.03 + ripB * 0.018) * vec3(0.55, 0.78, 0.9);

        // Soft caustic blotches in shallows
        float cau = fbm(vWorldXZ * 0.55 + vec2(uTime * 0.15, -uTime * 0.11));
        float cau2 = fbm(vWorldXZ * 1.1 + vec2(-uTime * 0.08, uTime * 0.13));
        float caustic = smoothstep(0.45, 0.75, cau) * smoothstep(0.4, 0.7, cau2);
        col = mix(col, uCaustic, caustic * (1.0 - depth) * 0.28);

        // Foam near beach + wind streaks
        float foamBand = 1.0 - smoothstep(uWaterLine - 2.4, uWaterLine - 0.15, shore);
        foamBand *= smoothstep(uWaterLine - 3.8, uWaterLine - 1.6, shore);
        float foamNoise = fbm(vec2(vWorldXZ.x * 0.8, shore * 1.4 - uTime * 0.9));
        float foamPulse = 0.5 + 0.5 * sin(uTime * 1.55 + vWorldXZ.x * 0.32);
        col = mix(col, uFoam, foamBand * (0.35 + foamNoise * 0.4) * foamPulse);

        // Deep-water sparkle
        float spark = step(0.975, hash21(floor(vWorldXZ * 3.0) + floor(uTime * 2.0)));
        col += spark * (0.07 + 0.08 * depth) * vec3(0.95, 0.98, 1.0);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createSandMaterial(baseColor, { wet = false, stone = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new THREE.Color(baseColor) },
      uDark: { value: new THREE.Color(wet ? 0x9a8a60 : stone ? 0x4a4a48 : 0xc0ac78) },
      uLight: { value: new THREE.Color(wet ? 0xc8b888 : stone ? 0x7a7870 : 0xe8d8b0) },
      uWet: { value: wet ? 1.0 : 0.0 },
      uStone: { value: stone ? 1.0 : 0.0 },
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
      uniform float uTime;
      uniform vec3 uBase;
      uniform vec3 uDark;
      uniform vec3 uLight;
      uniform float uWet;
      uniform float uStone;
      varying vec2 vWorldXZ;
      ${glslNoiseFns()}

      void main() {
        float n = fbm(vWorldXZ * (uStone > 0.5 ? 0.9 : 0.45));
        float n2 = fbm(vWorldXZ * 1.3 + 20.0);
        vec3 col = mix(uDark, uBase, smoothstep(0.25, 0.75, n));
        col = mix(col, uLight, smoothstep(0.55, 0.9, n2) * (uStone > 0.5 ? 0.22 : 0.35));

        if (uStone > 0.5) {
          // Soft paving joints
          vec2 g = abs(fract(vWorldXZ * 0.55) - 0.5);
          float joint = smoothstep(0.42, 0.48, max(g.x, g.y));
          col = mix(col, uDark * 0.85, joint * 0.55);
        } else {
          float rip = sin(vWorldXZ.x * 2.2 + vWorldXZ.y * 0.35 + n * 2.0) * 0.5 + 0.5;
          col += (rip - 0.5) * 0.04 * (1.0 - uWet);
          if (uWet > 0.5) {
            float sheen = pow(max(0.0, sin(vWorldXZ.x * 0.4 + uTime * 0.2)), 8.0) * 0.08;
            col += sheen * vec3(0.7, 0.85, 0.95);
          }
          float pebble = step(0.93, hash21(floor(vWorldXZ * 2.5)));
          col = mix(col, uDark * 0.75, pebble * 0.55);
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createSkyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: new THREE.Color(0x5aa8cc) },
      uHorizon: { value: new THREE.Color(0xd2e6f0) },
      uBottom: { value: new THREE.Color(0x8ab8c8) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      ${glslNoiseFns()}

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y * 1.15 + 0.15, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(0.12, 0.95, h));
        col = mix(uBottom, col, smoothstep(-0.25, 0.28, dir.y));

        vec3 sunDir = normalize(vec3(0.28, 0.42, 0.88));
        float sun = pow(max(0.0, dot(dir, sunDir)), 32.0);
        float glow = pow(max(0.0, dot(dir, sunDir)), 4.0);
        col += vec3(1.0, 0.93, 0.78) * sun * 0.65;
        col += vec3(1.0, 0.85, 0.55) * glow * 0.12;

        // Soft drifting cloud puffs
        vec2 cuv = dir.xz / max(0.15, dir.y + 0.35);
        cuv += vec2(uTime * 0.012, uTime * 0.004);
        float clouds = fbm(cuv * 1.6);
        clouds = smoothstep(0.55, 0.78, clouds) * smoothstep(0.05, 0.45, dir.y);
        col = mix(col, vec3(0.95, 0.97, 0.99), clouds * 0.55);

        // Horizon warm band
        float hz = exp(-abs(dir.y) * 8.0);
        col = mix(col, vec3(0.95, 0.82, 0.65), hz * 0.18);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 28, 18), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

function addGroundShadow(root, x, z, sx = 1.4, sz = 1.4, opacity = 0.22) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 16),
    makeMat(0x1a1810, {
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(x, 0.03, z);
  shadow.scale.set(sx, sz, 1);
  shadow.renderOrder = 1;
  root.add(shadow);
  return shadow;
}

function addFoamStrip(root, env, {
  w, d, z, y = 0.09, opacity = 0.5, speed = 1.4, phase = 0,
}) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    makeMat(0xd8e8f0, {
      transparent: true,
      opacity,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, y, z);
  mesh.renderOrder = 2;
  mesh.userData.baseZ = z;
  mesh.userData.baseOp = opacity;
  mesh.userData.speed = speed;
  mesh.userData.phase = phase;
  root.add(mesh);
  env.foam.push(mesh);
  return mesh;
}

function addBuildingDetail(root, w, color) {
  const facade = new THREE.Color(color);
  const trim = facade.clone().offsetHSL(0, -0.02, -0.08);
  const accent = [0xa05040, 0xc4a060, 0x5a7080, 0x8a6048][Math.abs(Math.floor(w.x)) % 4];

  addGroundShadow(root, w.x, w.z, w.w * 0.55, w.d * 0.55, 0.18);

  // Base plinth
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.2, 0.28, w.d + 0.2),
    makeMat(trim.getHex()),
  );
  plinth.position.set(w.x, 0.12, w.z);
  root.add(plinth);

  // Cornice / roof parapet
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.4, 0.24, w.d + 0.4),
    makeMat(0x4a4038),
  );
  cornice.position.set(w.x, w.h + 0.08, w.z);
  root.add(cornice);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.12, 0.18, w.d + 0.12),
    makeMat(0x3a342e),
  );
  roof.position.set(w.x, w.h + 0.24, w.z);
  root.add(roof);

  // Terracotta edge tiles on street-facing roofs
  if (w.z > -28) {
    const tiles = new THREE.Mesh(
      new THREE.BoxGeometry(w.w + 0.45, 0.1, 0.35),
      makeMat(0xb06040),
    );
    tiles.position.set(w.x, w.h + 0.12, w.z + w.hz + 0.05);
    root.add(tiles);
  }

  // Chimney
  if (w.h > 3.4 && (Math.floor(w.x + w.z) % 2) === 0) {
    const chim = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.9, 0.55),
      makeMat(0x6a6058),
    );
    chim.position.set(w.x + w.w * 0.25, w.h + 0.7, w.z - w.d * 0.15);
    root.add(chim);
  }

  const faceZ = w.z + w.hz + 0.03;
  const faceX = w.x + w.hx + 0.03;
  const cols = Math.max(2, Math.min(5, Math.floor(w.w / 2.4)));
  const rows = w.h > 3.6 ? 2 : 1;
  const span = w.w * 0.72;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((c + r + Math.floor(w.x)) % 3) === 0;
      const t = cols === 1 ? 0 : (c / (cols - 1) - 0.5);
      const wx = w.x + t * span;
      const wy = 1.15 + r * 1.4;

      // Frame
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.85, 0.05),
        makeMat(0xf0e8d8),
      );
      frame.position.set(wx, wy, faceZ);
      root.add(frame);

      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.65, 0.06),
        makeMat(lit ? WINDOW_LIT : WINDOW),
      );
      win.position.set(wx, wy, faceZ + 0.02);
      root.add(win);

      // Shutter pair
      if (((c + Math.floor(w.z)) % 2) === 0) {
        for (const side of [-1, 1]) {
          const shut = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, 0.7, 0.04),
            makeMat(accent),
          );
          shut.position.set(wx + side * 0.38, wy, faceZ + 0.01);
          root.add(shut);
        }
      }
    }
  }

  // Side-face windows for wide buildings
  if (w.d > 6) {
    const sCols = Math.max(1, Math.min(3, Math.floor(w.d / 3)));
    for (let c = 0; c < sCols; c++) {
      const t = sCols === 1 ? 0 : (c / (sCols - 1) - 0.5);
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.6, 0.45),
        makeMat(WINDOW),
      );
      win.position.set(faceX, 1.5, w.z + t * w.d * 0.55);
      root.add(win);
    }
  }

  if (w.w > 5 && w.d > 4) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 1.85, 0.1),
      makeMat(trim.getHex()),
    );
    door.position.set(w.x - w.w * 0.15, 0.92, faceZ);
    root.add(door);
    const doorWin = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.05),
      makeMat(WINDOW_LIT),
    );
    doorWin.position.set(w.x - w.w * 0.15, 1.55, faceZ + 0.04);
    root.add(doorWin);
  }

  // Balcony
  if (w.h > 3.5 && w.w > 8) {
    const balc = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.12, 0.7),
      makeMat(0x5a5548),
    );
    balc.position.set(w.x + w.w * 0.1, 2.35, faceZ + 0.3);
    root.add(balc);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.35, 0.06),
      makeMat(0x8a9098),
    );
    rail.position.set(w.x + w.w * 0.1, 2.55, faceZ + 0.6);
    root.add(rail);
  }

  if (w.z > -22 && w.z < -12 && w.w > 6) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w.w * 0.5, 0.08, 1.0),
      makeMat(accent),
    );
    awning.position.set(w.x, 2.2, faceZ + 0.4);
    awning.rotation.x = -0.15;
    root.add(awning);
    // Support poles
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.1, 4),
        makeMat(0x4a4038),
      );
      pole.position.set(w.x + side * w.w * 0.2, 1.1, faceZ + 0.75);
      root.add(pole);
    }
  }
}

function addRockCluster(root, w, color, assets = null) {
  const kenney = assets?.cloneRock?.(w);
  if (kenney) {
    root.add(kenney);
    return;
  }

  addGroundShadow(root, w.x, w.z, w.w * 0.7, w.d * 0.7, 0.2);

  const base = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makeMat(color));
  base.position.set(w.x, w.h / 2 - 0.02, w.z);
  base.rotation.y = (w.x + w.z) * 0.15;
  root.add(base);

  const c2 = new THREE.Mesh(
    new THREE.BoxGeometry(w.w * 0.55, w.h * 0.7, w.d * 0.6),
    makeMat(ROCK[(ROCK.indexOf(color) + 1 + ROCK.length) % ROCK.length]),
  );
  c2.position.set(w.x + w.w * 0.22, w.h * 0.55, w.z - w.d * 0.15);
  c2.rotation.y = 0.4;
  root.add(c2);

  if (w.h > 0.7) {
    const c3 = new THREE.Mesh(
      new THREE.BoxGeometry(w.w * 0.35, w.h * 0.45, w.d * 0.4),
      makeMat(0x8a8070),
    );
    c3.position.set(w.x - w.w * 0.2, w.h * 0.85, w.z + w.d * 0.1);
    root.add(c3);
  }

  // Pale salt crust / lichen patch
  const patch = new THREE.Mesh(
    new THREE.BoxGeometry(w.w * 0.4, 0.05, w.d * 0.35),
    makeMat(0xb0a890),
  );
  patch.position.set(w.x, w.h + 0.02, w.z);
  root.add(patch);
}

function addPalm(root, env, x, z, scale = 1, assets = null) {
  const kenney = assets?.clonePalm?.(x, z, scale);
  if (kenney) {
    addGroundShadow(root, x, z, 1.1 * scale, 0.9 * scale, 0.2);
    root.add(kenney);
    env.palmFronds.push(kenney);
    return;
  }

  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  addGroundShadow(root, x, z, 1.1 * scale, 0.9 * scale, 0.2);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.2, 2.6, 6),
    makeMat(0x6a5030),
  );
  trunk.position.y = 1.3;
  trunk.rotation.z = ((x * 13) % 7) * 0.01;
  g.add(trunk);

  // Trunk rings
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.14 - i * 0.01, 0.03, 4, 6),
      makeMat(0x5a4028),
    );
    ring.position.y = 0.6 + i * 0.55;
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }

  const crown = new THREE.Group();
  crown.position.y = 2.65;
  crown.userData.phase = (x + z) * 0.3;
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.65, 4),
      makeMat(i % 2 ? 0x2a6a3a : 0x3a7a48),
    );
    frond.position.set(0, 0.1, 0);
    frond.rotation.z = -0.95 + (i % 3) * 0.08;
    frond.rotation.y = (i / 7) * Math.PI * 2;
    crown.add(frond);
  }
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 5, 4),
    makeMat(0x245a30),
  );
  top.position.y = 0.2;
  crown.add(top);
  // Coconuts
  for (const a of [0, 2.1, 4.2]) {
    const nut = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 4, 3),
      makeMat(0x4a3020),
    );
    nut.position.set(Math.cos(a) * 0.25, -0.05, Math.sin(a) * 0.25);
    crown.add(nut);
  }
  g.add(crown);
  root.add(g);
  env.palmFronds.push(crown);
}

function addBench(root, x, z, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.45), makeMat(0x6a5038));
  seat.position.y = 0.45;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 0.08), makeMat(0x5a4028));
  back.position.set(0, 0.7, -0.2);
  g.add(back);
  for (const s of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), makeMat(0x3a3a38));
    leg.position.set(s, 0.22, 0);
    g.add(leg);
  }
  root.add(g);
}

function addSeagull(root, env, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  // Local +Z = nose / flight direction; wings span ±X
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 5, 4),
    makeMat(0xf0f0f0),
  );
  body.scale.set(0.75, 0.65, 1.35);
  g.add(body);
  const beak = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 4),
    makeMat(0xe8a040),
  );
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0, 0.2);
  g.add(beak);
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.18), makeMat(0xe8e8e8));
  wingL.position.set(-0.28, 0.02, 0);
  g.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.18), makeMat(0xe8e8e8));
  wingR.position.set(0.28, 0.02, 0);
  g.add(wingR);
  g.userData.wingL = wingL;
  g.userData.wingR = wingR;
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.radius = 6 + Math.random() * 10;
  g.userData.speed = 0.25 + Math.random() * 0.2;
  g.userData.baseX = x;
  g.userData.baseY = y;
  g.userData.baseZ = z;
  root.add(g);
  env.seagulls.push(g);
}

function addCloudBillboard(root, env, x, y, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  const mat = makeMat(0xf2f6f8, { transparent: true, opacity: 0.78, depthWrite: false });
  for (const [ox, oy, s] of [[0, 0, 1.4], [-1.1, -0.1, 1.0], [1.2, 0.05, 1.1], [0.3, 0.35, 0.85]]) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), mat);
    puff.position.set(ox, oy, 0);
    puff.scale.y = 0.55;
    g.add(puff);
  }
  g.userData.baseX = x;
  g.userData.speed = 0.35 + Math.random() * 0.25;
  g.userData.phase = Math.random() * Math.PI * 2;
  root.add(g);
  env.clouds.push(g);
}

function addScrub(root, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const n = 2 + ((Math.abs(x * 10) | 0) % 3);
  for (let i = 0; i < n; i++) {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.35 + (i % 2) * 0.15, 5, 4),
      makeMat(i % 2 ? 0x4a6a38 : 0x3a5a30),
    );
    bush.position.set((i - 1) * 0.35, 0.28, (i % 2) * 0.2 - 0.1);
    bush.scale.y = 0.7;
    g.add(bush);
  }
  root.add(g);
}

/** Animate water / foam / palms / sky life. Call each frame with world time. */
export function updateLevelEnv(root, time) {
  const env = root?.userData?.env;
  if (!env) return;
  if (env.waterMat) env.waterMat.uniforms.uTime.value = time;
  if (env.skyMat) env.skyMat.uniforms.uTime.value = time;
  for (const m of env.sandMats) m.uniforms.uTime.value = time;
  for (const f of env.foam) {
    const pulse = 0.72 + 0.28 * Math.sin(time * f.userData.speed + f.userData.phase);
    f.material.opacity = f.userData.baseOp * pulse;
    f.position.z = f.userData.baseZ + Math.sin(time * f.userData.speed * 0.65 + f.userData.phase) * 0.18;
  }
  for (const crown of env.palmFronds) {
    const phase = crown.userData.phase ?? 0;
    if (crown.userData.kenneyPalm) {
      crown.rotation.z = Math.sin(time * 0.7 + phase) * 0.035;
      crown.rotation.x = Math.sin(time * 0.55 + phase * 1.3) * 0.025;
    } else {
      crown.rotation.z = Math.sin(time * 0.7 + phase) * 0.05;
      crown.rotation.x = Math.sin(time * 0.55 + phase * 1.3) * 0.03;
    }
  }
  if (env.banner) {
    env.banner.rotation.y = Math.sin(time * 2.2) * 0.08;
    env.banner.position.x = Math.sin(time * 1.7) * 0.04;
  }
  for (const c of env.clouds) {
    c.position.x = c.userData.baseX + Math.sin(time * 0.08 + c.userData.phase) * 14;
    c.position.z = c.position.z;
  }
  for (const s of env.seagulls) {
    const a = time * s.userData.speed + s.userData.phase;
    const rx = s.userData.radius;
    const rz = s.userData.radius * 0.55;
    s.position.x = s.userData.baseX + Math.cos(a) * rx;
    s.position.z = s.userData.baseZ + Math.sin(a) * rz;
    s.position.y = s.userData.baseY + Math.sin(a * 2.2) * 0.6;
    // Face tangent of the flight ellipse (local +Z = forward)
    const tx = -Math.sin(a) * rx;
    const tz = Math.cos(a) * rz;
    s.rotation.y = Math.atan2(tx, tz);
    const flap = Math.sin(time * 8 + s.userData.phase) * 0.45;
    s.userData.wingL.rotation.z = flap;
    s.userData.wingR.rotation.z = -flap;
  }
  for (const lamp of env.lamps) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 3 + lamp.userData.phase);
    lamp.material.opacity = pulse;
  }
}

export function buildLevelMeshes(root, spec, { assets = null } = {}) {
  const {
    MAP, walls, floors, flora, scrub = [], destination, fenceX, waterLine, cityLine,
  } = spec;

  while (root.children.length) {
    const c = root.children[0];
    root.remove(c);
    c.traverse?.((o) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }

  const env = {
    foam: [],
    palmFronds: [],
    waterMat: null,
    skyMat: null,
    sandMats: [],
    seagulls: [],
    clouds: [],
    lamps: [],
    banner: null,
  };
  root.userData.env = env;

  // Sky dome (Mediterranean haze + soft sun + drifting clouds)
  const sky = createSkyDome();
  root.add(sky);
  env.skyMat = sky.material;

  // Distant cloud billboards over the sea
  for (let i = 0; i < 6; i++) {
    addCloudBillboard(
      root,
      env,
      -20 + i * 9 + (i % 2) * 3,
      14 + (i % 3) * 2.5,
      28 + (i % 2) * 4,
      1.2 + (i % 3) * 0.35,
    );
  }

  // Water plane — y≈0 so submerged bodies stay occluded.
  const waterMat = createWaterMaterial(waterLine);
  env.waterMat = waterMat;
  const waterDepth = 30;
  const waterZ0 = waterLine - 1;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP + 10, waterDepth),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0, waterZ0 + waterDepth * 0.5);
  root.add(water);

  // Shallow tint band under foam for wet-edge read
  const shallows = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP + 2, 3.2),
    makeMat(0x5aa8b8, { transparent: true, opacity: 0.35, depthWrite: false }),
  );
  shallows.rotation.x = -Math.PI / 2;
  shallows.position.set(0, 0.04, waterLine - 0.2);
  shallows.renderOrder = 1;
  root.add(shallows);

  for (const f of floors) {
    let mat;
    if (f.kind === 'sand' || f.kind === 'wet') {
      mat = createSandMaterial(f.color, { wet: f.kind === 'wet' });
      env.sandMats.push(mat);
    } else if (f.kind === 'plaza' || f.kind === 'road') {
      mat = createSandMaterial(f.color, { stone: true });
      env.sandMats.push(mat);
    } else {
      mat = makeMat(f.color);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.d), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(f.x, f.y ?? 0, f.z);
    root.add(mesh);
  }

  // Plaza tile grid accents near gate
  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -2; gz <= 1; gz++) {
      if ((gx + gz) % 2 !== 0) continue;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        makeMat(0x747268, { transparent: true, opacity: 0.35, depthWrite: false }),
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(gx * 2.0, 0.1, destination.z + gz * 1.8);
      tile.renderOrder = 1;
      root.add(tile);
    }
  }

  // Promenade curb / painted edge + railing
  const curb = new THREE.Mesh(
    new THREE.BoxGeometry(MAP * 0.85, 0.18, 0.35),
    makeMat(0x8a8880),
  );
  curb.position.set(0, 0.16, cityLine + 0.15);
  root.add(curb);
  const curbPaint = new THREE.Mesh(
    new THREE.BoxGeometry(MAP * 0.85, 0.04, 0.12),
    makeMat(0xd0c8a0),
  );
  curbPaint.position.set(0, 0.26, cityLine + 0.15);
  root.add(curbPaint);
  for (let rx = -20; rx <= 20; rx += 2.5) {
    if (Math.abs(rx) < 5.5) continue; // gate opening
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 5), makeMat(0x8a9098));
    post.position.set(rx, 0.55, cityLine + 0.55);
    root.add(post);
  }
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.05, 0.05),
    makeMat(0x8a9098),
  );
  rail.position.set(-13, 0.85, cityLine + 0.55);
  root.add(rail);
  const rail2 = rail.clone();
  rail2.position.x = 13;
  root.add(rail2);

  // Benches along promenade
  for (const bx of [-16, -8, 8, 16]) {
    addBench(root, bx, cityLine - 1.4, 0);
  }

  // Animated surf foam layers
  addFoamStrip(root, env, {
    w: MAP * 0.92, d: 1.8, z: waterLine - 1.05, opacity: 0.5, speed: 1.35, phase: 0,
  });
  addFoamStrip(root, env, {
    w: MAP * 0.7, d: 0.9, z: waterLine - 0.35, y: 0.1, opacity: 0.35, speed: 1.8, phase: 1.2,
  });
  addFoamStrip(root, env, {
    w: MAP * 0.5, d: 0.55, z: waterLine - 1.7, y: 0.07, opacity: 0.22, speed: 1.1, phase: 2.4,
  });
  // Breakwater splash foam
  for (let i = 0; i < 5; i++) {
    addFoamStrip(root, env, {
      w: 3.5,
      d: 1.2,
      z: 14 + i * 3.2,
      y: 0.12,
      opacity: 0.28,
      speed: 2.0 + i * 0.15,
      phase: i * 0.9,
    });
    // nudge foam toward espigón
    const last = env.foam[env.foam.length - 1];
    last.position.x = fenceX - 1.2;
    last.userData.baseZ = last.position.z;
  }

  let bi = 0;
  let ri = 0;
  for (const w of walls) {
    const isOuter = w.w > MAP * 0.5 || w.d > MAP * 0.5;
    const isFence = w.w < 0.25 && w.h > 1.8;
    const isLowRock = w.h < 1.2 && !isOuter;
    let color;
    if (isOuter) color = 0x1a2830;
    else if (isFence) color = 0x3a4048;
    else if (isLowRock) color = ROCK[ri++ % ROCK.length];
    else color = BUILDING[bi++ % BUILDING.length];

    if (isLowRock) {
      addRockCluster(root, w, color, assets);
      continue;
    }

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makeMat(color));
    mesh.position.set(w.x, w.h / 2 - 0.02, w.z);
    root.add(mesh);

    if (!isFence && !isOuter && w.h > 2.5) {
      addBuildingDetail(root, w, color);
    }
  }

  // Fence posts + rails + coiled tips
  const railMat = makeMat(0x4a5058);
  const postMat = makeMat(0x3a4048);
  const tipMat = makeMat(0x9aa0a8);
  for (let z = -28; z < 28; z += 2.2) {
    for (const ox of [0, 1.4]) {
      const px = fenceX + ox + (ox === 0 ? -0.18 : 0.18);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 0.2), postMat);
      post.position.set(px, 1.2, z);
      root.add(post);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), tipMat);
      tip.position.set(px, 2.48, z);
      root.add(tip);
      // Coil / razor hint
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.04, 4, 8),
        tipMat,
      );
      coil.position.set(px, 2.62, z);
      coil.rotation.x = Math.PI / 2;
      root.add(coil);
    }
  }
  // Horizontal rails between posts
  for (const ox of [0, 1.4]) {
    const px = fenceX + ox + (ox === 0 ? -0.18 : 0.18);
    for (const hy of [0.7, 1.35, 2.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 56), railMat);
      rail.position.set(px, hy, 0);
      root.add(rail);
    }
  }

  // Promenade lamps
  for (const lx of [-18, -10, -2, 6, 14]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3.2, 5),
      makeMat(0x3a3a38),
    );
    pole.position.set(lx, 1.7, cityLine - 0.8);
    root.add(pole);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 6, 5),
      makeMat(0xe8d8a0, { transparent: true, opacity: 0.95, depthWrite: false }),
    );
    lamp.position.set(lx, 3.35, cityLine - 0.8);
    lamp.userData.phase = lx * 0.4;
    root.add(lamp);
    env.lamps.push(lamp);
    // Soft glow disc
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 12),
      makeMat(0xe8d090, { transparent: true, opacity: 0.12, depthWrite: false }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(lx, 0.12, cityLine - 0.8);
    glow.renderOrder = 1;
    root.add(glow);
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.55),
      makeMat(0x3a3a38),
    );
    arm.position.set(lx, 3.15, cityLine - 0.55);
    root.add(arm);
  }

  // Destination / city gate marker
  const gate = new THREE.Group();
  gate.position.set(destination.x, 0, destination.z);
  const gatePad = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.12, 4),
    makeMat(0x4a4840),
  );
  gatePad.position.y = 0.14;
  gate.add(gatePad);
  for (let i = -1; i <= 1; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.02, 3.4),
      makeMat(0x6a6860),
    );
    stripe.position.set(i * 2.2, 0.21, 0);
    gate.add(stripe);
  }
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 3.4, 0.55),
      makeMat(0x5a5048),
    );
    post.position.set(side * 4.5, 1.7, 0);
    gate.add(post);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.7),
      makeMat(0x7a7060),
    );
    cap.position.set(side * 4.5, 3.45, 0);
    gate.add(cap);
    // Crest ornament
    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.45, 0.25),
      makeMat(0xc4a060),
    );
    crest.position.set(side * 4.5, 3.75, 0);
    gate.add(crest);
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.45, 0.55),
    makeMat(0x6a6050),
  );
  lintel.position.set(0, 3.35, 0);
  gate.add(lintel);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.55, 0.08),
    makeMat(0xaa3030),
  );
  banner.position.set(0, 2.7, 0.12);
  gate.add(banner);
  env.banner = banner;
  const bannerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.1, 0.09),
    makeMat(0xf0e8d0),
  );
  bannerStripe.position.set(0, 2.55, 0.13);
  gate.add(bannerStripe);
  root.add(gate);
  spec.gateMesh = gate;

  // Customs booth signage
  const boothSign = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.45, 0.08),
    makeMat(0x2a5080),
  );
  boothSign.position.set(16, 3.1, -5.9);
  root.add(boothSign);
  const boothStripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.08, 0.09),
    makeMat(0xe8d060),
  );
  boothStripe.position.set(16, 2.95, -5.88);
  root.add(boothStripe);

  // Palms + scrub
  for (const [fx, fz] of flora) {
    const scale = 0.85 + (((Math.abs(fx * 3 + fz) | 0) % 5) * 0.06);
    addPalm(root, env, fx, fz, scale, assets);
  }
  for (const [sx, sz] of scrub) {
    addScrub(root, sx, sz);
  }

  // Beach debris / driftwood + buoys
  const debris = [
    [-7, 3, 1.2], [5, 5, 0.9], [-13, 6, 1.0], [11, 1, 0.7], [-2, 7, 0.8],
    [8, 4, 0.6], [-16, 3, 1.1],
  ];
  for (const [dx, dz, len] of debris) {
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, len, 5),
      makeMat(0x5a4030),
    );
    log.rotation.z = Math.PI / 2;
    log.rotation.y = dx * 0.2;
    log.position.set(dx, 0.1, dz);
    root.add(log);
  }
  for (const [bx, bz] of [[-9, 8.5], [3, 9], [13, 7.5]]) {
    const buoy = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.55, 6),
      makeMat(0xc04030),
    );
    buoy.position.set(bx, 0.15, bz);
    root.add(buoy);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.19, 0.19, 0.12, 6),
      makeMat(0xf0f0f0),
    );
    band.position.set(bx, 0.25, bz);
    root.add(band);
  }

  // Seagulls over the shore
  for (let i = 0; i < 5; i++) {
    addSeagull(root, env, -8 + i * 5, 6 + (i % 3), waterLine + 2 + (i % 2) * 3);
  }

  // Distant Moroccan hills — layered soft silhouettes
  const hillColors = [0x5a6a48, 0x4a5a3c, 0x6a7a55, 0x3a4a32, 0x7a8a60];
  for (let i = 0; i < 10; i++) {
    const h = 2.4 + (i % 4) * 1.1;
    const r = 5 + (i % 3) * 2.4;
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 6),
      makeMat(hillColors[i % hillColors.length]),
    );
    hill.position.set(
      fenceX + 9 + (i % 5) * 4.2,
      h * 0.35,
      -20 + i * 4.8 + (i % 2) * 2,
    );
    hill.scale.x = 1.5;
    hill.scale.z = 1.15;
    root.add(hill);
  }
  // Settlements twinkle on far hills
  for (let i = 0; i < 6; i++) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.35, 0.35),
      makeMat(0xe8c878),
    );
    light.position.set(fenceX + 14 + (i % 3) * 5, 2.2 + (i % 2), -8 + i * 5);
    root.add(light);
  }
  // Far haze ridge
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(48, 4.5, 8),
    makeMat(0x6a8a78, { transparent: true, opacity: 0.32, depthWrite: false }),
  );
  ridge.position.set(fenceX + 24, 2.8, 2);
  root.add(ridge);

  // Horizon sea haze sheet
  const seaHaze = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP + 20, 8),
    makeMat(0xb0d0e0, { transparent: true, opacity: 0.22, depthWrite: false }),
  );
  seaHaze.position.set(0, 3.5, waterLine + 22);
  root.add(seaHaze);
}
