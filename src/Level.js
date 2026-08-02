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
  // Deep sea  z: 36 → 14 — surface near y=0 so submerged bodies are occluded
  floors.push({ x: 0, z: 25, w: MAP + 8, d: 22, color: 0x1a4a6a, y: 0 });
  // Shallow / surf  z: 14 → 8
  floors.push({ x: 0, z: 11, w: MAP + 4, d: 6, color: 0x3a8aaa, y: 0.02 });
  // Wet sand  z: 8 → 2
  floors.push({ x: 0, z: 5, w: MAP + 2, d: 6, color: 0xc4b48a, y: -0.04 });
  // Dry sand  z: 2 → -14
  floors.push({ x: 0, z: -6, w: MAP + 2, d: 16, color: 0xd8c49a, y: 0 });
  // Promenade / asphalt  z: -14 → -18
  floors.push({ x: 0, z: -16, w: MAP + 2, d: 4, color: 0x5a5a58, y: 0.08 });
  // City plaza  z: -18 → -36
  floors.push({ x: 0, z: -27, w: MAP + 4, d: 18, color: 0x6a6860, y: 0.08 });

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

  // Palm / scrub markers (visual only via props list; meshes in buildLevelMeshes)
  const flora = [
    [-20, -12], [-24, 0], [8, -12], [-16, 10], [12, 8],
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

const BUILDING = [0x8a8070, 0x7a7468, 0x9a9080, 0x6a6558, 0xa09888];
const ROCK = [0x6a6458, 0x5a5448, 0x7a7060, 0x4a4840];

export function buildLevelMeshes(root, spec) {
  const { MAP, walls, floors, flora, destination, fenceX, waterLine } = spec;

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

  for (const f of floors) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(f.w, f.d),
      makeMat(f.color),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(f.x, f.y ?? 0, f.z);
    root.add(mesh);
  }

  // Surf foam — no depth write so it never z-fights the shore planes
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP * 0.9, 1.6),
    makeMat(0xd8e8f0, {
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.08, waterLine - 1);
  foam.renderOrder = 2;
  root.add(foam);

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

    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makeMat(color));
    // Sink slightly so bottoms don't z-fight the ground plane
    mesh.position.set(w.x, w.h / 2 - 0.02, w.z);
    root.add(mesh);

    // Flat roofs on taller buildings
    if (w.h > 2.5 && !isFence && !isOuter) {
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w.w + 0.3, 0.2, w.d + 0.3),
        makeMat(0x4a4038),
      );
      roof.position.set(w.x, w.h + 0.1, w.z);
      root.add(roof);
    }
  }

  // Fence posts (visual only — panels already in walls)
  for (let z = -28; z < 28; z += 2.2) {
    for (const ox of [0, 1.4]) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 2.4, 0.2),
        makeMat(0x3a4048),
      );
      // Sit just outside the panel face so depths don't fight
      post.position.set(fenceX + ox + (ox === 0 ? -0.18 : 0.18), 1.2, z);
      root.add(post);
      const tip = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.3),
        makeMat(0x8a9098),
      );
      tip.position.set(fenceX + ox + (ox === 0 ? -0.18 : 0.18), 2.5, z);
      root.add(tip);
    }
  }

  // Destination / city gate marker
  const gate = new THREE.Group();
  gate.position.set(destination.x, 0, destination.z);
  // Thin box instead of a coplanar plane — avoids flicker on the plaza
  const gatePad = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.12, 4),
    makeMat(0x4a4840),
  );
  gatePad.position.y = 0.14;
  gate.add(gatePad);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 3.2, 0.5),
      makeMat(0x5a5048),
    );
    post.position.set(side * 4.5, 1.6, 0);
    gate.add(post);
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.4, 0.5),
    makeMat(0x6a6050),
  );
  lintel.position.set(0, 3.2, 0);
  gate.add(lintel);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 0.55, 0.08),
    makeMat(0xaa3030),
  );
  banner.position.set(0, 2.6, 0.1);
  gate.add(banner);
  root.add(gate);
  spec.gateMesh = gate;

  // Sparse palms / scrub
  for (const [fx, fz] of flora) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 2.4, 5),
      makeMat(0x6a5030),
    );
    trunk.position.set(fx, 1.2, fz);
    root.add(trunk);
    const frond = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 1.4, 5),
      makeMat(0x2a6a3a),
    );
    frond.position.set(fx, 2.6, fz);
    root.add(frond);
  }

  // Distant Moroccan hills hint (+X beyond fence)
  for (let i = 0; i < 5; i++) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(4 + i, 2 + i * 0.4, 5),
      makeMat(0x5a6a48),
    );
    hill.position.set(fenceX + 10 + i * 3, 0.5, -10 + i * 6);
    root.add(hill);
  }

}
