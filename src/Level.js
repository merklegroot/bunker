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

function createWaterMaterial(waterLine) {
  return new THREE.ShaderMaterial({
    transparent: false,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uWaterLine: { value: waterLine },
      uDeep: { value: new THREE.Color(0x154058) },
      uMid: { value: new THREE.Color(0x2a6a88) },
      uShallow: { value: new THREE.Color(0x4a9ab0) },
      uFoam: { value: new THREE.Color(0xd0e8f0) },
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
      varying vec2 vWorldXZ;

      void main() {
        float shore = vWorldXZ.y; // world Z
        float depth = clamp((shore - (uWaterLine - 1.5)) / 18.0, 0.0, 1.0);
        vec3 col = mix(uShallow, uMid, smoothstep(0.0, 0.45, depth));
        col = mix(col, uDeep, smoothstep(0.4, 1.0, depth));

        float ripA = sin(vWorldXZ.x * 0.55 + uTime * 1.35) * sin(vWorldXZ.y * 0.4 + uTime * 0.95);
        float ripB = sin(vWorldXZ.x * 1.1 - uTime * 0.8 + vWorldXZ.y * 0.7) * 0.5;
        col += (ripA * 0.035 + ripB * 0.02) * vec3(0.55, 0.75, 0.85);

        // Soft foam near the beach edge
        float foamBand = 1.0 - smoothstep(uWaterLine - 2.2, uWaterLine - 0.2, shore);
        foamBand *= smoothstep(uWaterLine - 3.5, uWaterLine - 1.8, shore);
        float foamPulse = 0.55 + 0.45 * sin(uTime * 1.6 + vWorldXZ.x * 0.35);
        col = mix(col, uFoam, foamBand * 0.45 * foamPulse);

        // Speckish sparkle farther out
        float spark = step(0.97, fract(sin(dot(vWorldXZ, vec2(12.9898, 78.233)) + uTime) * 43758.5453));
        col += spark * (0.08 + 0.06 * depth) * vec3(0.9, 0.95, 1.0);

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
      uTop: { value: new THREE.Color(0x6eb0d0) },
      uHorizon: { value: new THREE.Color(0xc8dce8) },
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
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y * 1.15 + 0.15, 0.0, 1.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(0.15, 0.95, h));
        col = mix(uBottom, col, smoothstep(-0.2, 0.25, vDir.y));
        // Soft sun glow toward sea (+Z roughly, with a bit of +X)
        vec3 sunDir = normalize(vec3(0.25, 0.35, 0.9));
        float sun = pow(max(0.0, dot(normalize(vDir), sunDir)), 28.0);
        col += vec3(1.0, 0.92, 0.75) * sun * 0.55;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
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

  // Cornice / roof parapet
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.35, 0.22, w.d + 0.35),
    makeMat(0x4a4038),
  );
  cornice.position.set(w.x, w.h + 0.08, w.z);
  root.add(cornice);

  // Slightly darker roof slab
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w.w + 0.1, 0.16, w.d + 0.1),
    makeMat(0x3a342e),
  );
  roof.position.set(w.x, w.h + 0.22, w.z);
  root.add(roof);

  // Windows on the longer façade facing the beach (+Z roughly)
  const faceZ = w.z + w.hz + 0.03;
  const cols = Math.max(2, Math.min(5, Math.floor(w.w / 2.4)));
  const rows = w.h > 3.6 ? 2 : 1;
  const span = w.w * 0.72;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((c + r + Math.floor(w.x)) % 3) === 0;
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.7, 0.06),
        makeMat(lit ? WINDOW_LIT : WINDOW),
      );
      const t = cols === 1 ? 0 : (c / (cols - 1) - 0.5);
      win.position.set(w.x + t * span, 1.1 + r * 1.35, faceZ);
      root.add(win);
    }
  }

  // Door on south face for mid-size buildings
  if (w.w > 5 && w.d > 4) {
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.7, 0.08),
      makeMat(trim.getHex()),
    );
    door.position.set(w.x - w.w * 0.15, 0.85, faceZ);
    root.add(door);
  }

  // Awning strip on beach-facing buildings near promenade
  if (w.z > -22 && w.z < -12 && w.w > 6) {
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(w.w * 0.55, 0.08, 0.9),
      makeMat(0xa05040),
    );
    awning.position.set(w.x, 2.15, faceZ + 0.35);
    root.add(awning);
  }
}

function addRockCluster(root, w, color) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makeMat(color));
  base.position.set(w.x, w.h / 2 - 0.02, w.z);
  base.rotation.y = (w.x + w.z) * 0.15;
  root.add(base);

  const c2 = new THREE.Mesh(
    new THREE.BoxGeometry(w.w * 0.55, w.h * 0.7, w.d * 0.6),
    makeMat(ROCK[(ROCK.indexOf(color) + 1) % ROCK.length]),
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
}

function addPalm(root, env, x, z, scale = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.2, 2.6, 6),
    makeMat(0x6a5030),
  );
  trunk.position.y = 1.3;
  trunk.rotation.z = ((x * 13) % 7) * 0.01;
  g.add(trunk);

  const crown = new THREE.Group();
  crown.position.y = 2.65;
  crown.userData.phase = (x + z) * 0.3;
  for (let i = 0; i < 5; i++) {
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.5, 4),
      makeMat(i % 2 ? 0x2a6a3a : 0x3a7a48),
    );
    frond.position.set(0, 0.15, 0);
    frond.rotation.z = -0.85;
    frond.rotation.y = (i / 5) * Math.PI * 2;
    crown.add(frond);
  }
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 5, 4),
    makeMat(0x245a30),
  );
  top.position.y = 0.2;
  crown.add(top);
  g.add(crown);
  root.add(g);
  env.palmFronds.push(crown);
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

/** Animate water / foam / palms. Call each frame with world time. */
export function updateLevelEnv(root, time) {
  const env = root?.userData?.env;
  if (!env) return;
  if (env.waterMat) env.waterMat.uniforms.uTime.value = time;
  for (const f of env.foam) {
    const pulse = 0.72 + 0.28 * Math.sin(time * f.userData.speed + f.userData.phase);
    f.material.opacity = f.userData.baseOp * pulse;
    f.position.z = f.userData.baseZ + Math.sin(time * f.userData.speed * 0.65 + f.userData.phase) * 0.18;
  }
  for (const crown of env.palmFronds) {
    crown.rotation.z = Math.sin(time * 0.7 + crown.userData.phase) * 0.05;
    crown.rotation.x = Math.sin(time * 0.55 + crown.userData.phase * 1.3) * 0.03;
  }
}

export function buildLevelMeshes(root, spec) {
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

  const env = { foam: [], palmFronds: [], waterMat: null, sky: null };
  root.userData.env = env;

  // Sky dome (Mediterranean haze + soft sun)
  const sky = createSkyDome();
  root.add(sky);
  env.sky = sky;

  // Water plane — y≈0 so submerged bodies stay occluded.
  // Starts just seaward of the wet-sand band (z ≈ waterLine - 1).
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
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(f.w, f.d),
      makeMat(f.color),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(f.x, f.y ?? 0, f.z);
    root.add(mesh);

    // Soft sand mottling strips
    if (f.kind === 'sand' || f.kind === 'wet') {
      for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(
          new THREE.PlaneGeometry(f.w * (0.15 + (i % 3) * 0.08), 0.55 + (i % 2) * 0.35),
          makeMat(f.kind === 'wet' ? 0xa89868 : 0xc8b488, {
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
          }),
        );
        stripe.rotation.x = -Math.PI / 2;
        stripe.rotation.z = (i - 1.5) * 0.08;
        stripe.position.set(
          f.x + (i - 1.5) * 6,
          (f.y ?? 0) + 0.015,
          f.z + (i % 3 - 1) * (f.d * 0.18),
        );
        stripe.renderOrder = 1;
        root.add(stripe);
      }
    }
  }

  // Promenade curb / painted edge
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
      addRockCluster(root, w, color);
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
      new THREE.SphereGeometry(0.22, 6, 5),
      makeMat(0xe8d8a0),
    );
    lamp.position.set(lx, 3.35, cityLine - 0.8);
    root.add(lamp);
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
  // Tile pattern on pad
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
  const bannerStripe = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.1, 0.09),
    makeMat(0xf0e8d0),
  );
  bannerStripe.position.set(0, 2.55, 0.13);
  gate.add(bannerStripe);
  root.add(gate);
  spec.gateMesh = gate;

  // Palms + scrub
  for (const [fx, fz] of flora) {
    const scale = 0.85 + (((Math.abs(fx * 3 + fz) | 0) % 5) * 0.06);
    addPalm(root, env, fx, fz, scale);
  }
  for (const [sx, sz] of scrub) {
    addScrub(root, sx, sz);
  }

  // Beach debris / driftwood (visual only)
  const debris = [
    [-7, 3, 1.2], [5, 5, 0.9], [-13, 6, 1.0], [11, 1, 0.7], [-2, 7, 0.8],
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

  // Distant Moroccan hills — layered soft silhouettes
  const hillColors = [0x5a6a48, 0x4a5a3c, 0x6a7a55, 0x3a4a32];
  for (let i = 0; i < 8; i++) {
    const h = 2.2 + (i % 4) * 0.9;
    const r = 5 + (i % 3) * 2.2;
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 6),
      makeMat(hillColors[i % hillColors.length]),
    );
    hill.position.set(
      fenceX + 9 + (i % 4) * 4.5,
      h * 0.35,
      -18 + i * 5.5 + (i % 2) * 2,
    );
    hill.scale.x = 1.4;
    hill.scale.z = 1.1;
    root.add(hill);
  }
  // Far haze ridge
  const ridge = new THREE.Mesh(
    new THREE.BoxGeometry(40, 3.5, 6),
    makeMat(0x6a8a78, { transparent: true, opacity: 0.35, depthWrite: false }),
  );
  ridge.position.set(fenceX + 22, 2.2, 2);
  root.add(ridge);

}
