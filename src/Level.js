import * as THREE from 'three';

/** Axis-aligned solid. x,z = center. */
export function wall(x, z, w, d, h = 3.2) {
  return { x, z, w, d, h, hx: w * 0.5, hz: d * 0.5 };
}

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Procedural dungeon: rooms + L-corridors on a tile grid, then solid wall AABBs.
 * @param {number} depth Floor number (1+); deeper = more rooms / denser spawns.
 */
export function buildLevelSpec(depth = 1) {
  const CELL = 2;
  const W = 36 + Math.min(12, depth * 2);
  const H = 36 + Math.min(12, depth * 2);
  const MAP = Math.max(W, H) * CELL;
  const HALF = MAP / 2;

  const grid = Array.from({ length: H }, () => Array(W).fill(1)); // 1 = wall, 0 = floor
  const rooms = [];
  const roomTarget = Math.min(14, 5 + depth + Math.floor(depth / 2));

  for (let tries = 0; tries < 120 && rooms.length < roomTarget; tries++) {
    const rw = randInt(4, 8);
    const rh = randInt(4, 7);
    const rx = randInt(1, W - rw - 2);
    const rz = randInt(1, H - rh - 2);

    let ok = true;
    for (const r of rooms) {
      if (
        rx < r.x + r.w + 1
        && rx + rw + 1 > r.x
        && rz < r.z + r.h + 1
        && rz + rh + 1 > r.z
      ) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    carveRoom(grid, rx, rz, rw, rh);
    rooms.push({
      x: rx,
      z: rz,
      w: rw,
      h: rh,
      cx: rx + rw / 2,
      cz: rz + rh / 2,
    });
  }

  // Guarantee at least two rooms
  if (rooms.length < 2) {
    carveRoom(grid, 4, 4, 6, 5);
    rooms.push({ x: 4, z: 4, w: 6, h: 5, cx: 7, cz: 6.5 });
    carveRoom(grid, W - 12, H - 11, 6, 5);
    rooms.push({
      x: W - 12, z: H - 11, w: 6, h: 5,
      cx: W - 9, cz: H - 8.5,
    });
  }

  // Connect rooms in shuffled order (snake) so the map feels branched
  const order = shuffle(rooms.map((_, i) => i));
  for (let i = 1; i < order.length; i++) {
    const a = rooms[order[i - 1]];
    const b = rooms[order[i]];
    carveCorridor(grid, Math.floor(a.cx), Math.floor(a.cz), Math.floor(b.cx), Math.floor(b.cz));
  }
  // Extra links for loops on deeper floors
  const extra = Math.min(3, Math.floor(depth / 2));
  for (let i = 0; i < extra && rooms.length > 3; i++) {
    const a = rooms[randInt(0, rooms.length - 1)];
    const b = rooms[randInt(0, rooms.length - 1)];
    if (a === b) continue;
    carveCorridor(grid, Math.floor(a.cx), Math.floor(a.cz), Math.floor(b.cx), Math.floor(b.cz));
  }

  // Seal outer border
  for (let z = 0; z < H; z++) {
    grid[z][0] = 1;
    grid[z][W - 1] = 1;
  }
  for (let x = 0; x < W; x++) {
    grid[0][x] = 1;
    grid[H - 1][x] = 1;
  }

  const tileToWorld = (tx, tz) => ({
    x: (tx + 0.5) * CELL - HALF,
    z: (tz + 0.5) * CELL - HALF,
  });

  const startRoom = rooms[0];
  const endRoom = rooms.reduce((best, r) => {
    const d = Math.hypot(r.cx - startRoom.cx, r.cz - startRoom.cz);
    return !best || d > best.d ? { r, d } : best;
  }, null).r;

  const playerSpawn = tileToWorld(
    Math.floor(startRoom.cx),
    Math.floor(startRoom.cz),
  );
  const stairsPos = tileToWorld(
    Math.floor(endRoom.cx),
    Math.floor(endRoom.cz),
  );

  // Spawn points: floor tiles in rooms other than start
  const spawnPoints = [];
  const lootPoints = [];
  for (const room of rooms) {
    const isStart = room === startRoom;
    const isEnd = room === endRoom;
    for (let tz = room.z + 1; tz < room.z + room.h - 1; tz++) {
      for (let tx = room.x + 1; tx < room.x + room.w - 1; tx++) {
        if (grid[tz][tx] !== 0) continue;
        const p = tileToWorld(tx, tz);
        const nearPlayer = Math.hypot(p.x - playerSpawn.x, p.z - playerSpawn.z) < 5;
        const nearStairs = Math.hypot(p.x - stairsPos.x, p.z - stairsPos.z) < 2.5;
        if (nearPlayer || nearStairs) continue;
        if (!isStart) spawnPoints.push(p);
        if (!isStart && !isEnd) lootPoints.push(p);
      }
    }
  }

  // Merge wall tiles into larger AABBs where possible (row runs)
  const walls = mergeWalls(grid, W, H, CELL, HALF);
  // Outer fence — short enough not to hide the map under the angled camera
  walls.push(wall(0, -HALF - 0.6, MAP + 2.4, 1.2, 2.0));
  walls.push(wall(0, HALF + 0.6, MAP + 2.4, 1.2, 2.0));
  walls.push(wall(-HALF - 0.6, 0, 1.2, MAP, 2.0));
  walls.push(wall(HALF + 0.6, 0, 1.2, MAP, 2.0));

  const floors = [];
  // Base dirt under everything
  floors.push({ x: 0, z: 0, w: MAP + 4, d: MAP + 4, color: 0x0c0a08, y: -0.02 });

  // Floor tiles as room/corridor patches (batched by room + corridor cells)
  for (let tz = 0; tz < H; tz++) {
    for (let tx = 0; tx < W; tx++) {
      if (grid[tz][tx] !== 0) continue;
      const p = tileToWorld(tx, tz);
      const checker = (tx + tz) % 2 === 0;
      floors.push({
        x: p.x,
        z: p.z,
        w: CELL * 0.98,
        d: CELL * 0.98,
        color: checker ? 0x2a241c : 0x241e18,
        y: 0,
      });
    }
  }

  const props = [];
  // Pillars / columns in larger rooms
  for (const room of rooms) {
    if (room.w < 6 || room.h < 6) continue;
    const px = Math.floor(room.cx);
    const pz = Math.floor(room.cz);
    if (room === endRoom || room === startRoom) continue;
    if (grid[pz]?.[px] !== 0) continue;
    const p = tileToWorld(px, pz);
    // Skip if too close to spawn points center — place offset
    const ox = p.x + CELL * 0.35;
    const oz = p.z - CELL * 0.35;
    props.push(wall(ox, oz, 0.7, 0.7, 1.55));
  }
  walls.push(...props);

  return {
    MAP,
    HALF,
    CELL,
    W,
    H,
    grid,
    walls,
    floors,
    rooms,
    props,
    spawnPoints,
    lootPoints,
    playerSpawn,
    stairsPos,
    startRoom,
    endRoom,
    depth,
    tileToWorld,
  };
}

function carveRoom(grid, x, z, w, h) {
  for (let tz = z; tz < z + h; tz++) {
    for (let tx = x; tx < x + w; tx++) {
      grid[tz][tx] = 0;
    }
  }
}

function carveCorridor(grid, x0, z0, x1, z1) {
  let x = x0;
  let z = z0;
  // Randomly choose H-then-V or V-then-H
  if (Math.random() < 0.5) {
    while (x !== x1) {
      grid[z][x] = 0;
      grid[z][Math.min(x + 1, grid[0].length - 1)] = 0;
      x += x < x1 ? 1 : -1;
    }
    while (z !== z1) {
      grid[z][x] = 0;
      if (z + 1 < grid.length) grid[z + 1][x] = 0;
      z += z < z1 ? 1 : -1;
    }
  } else {
    while (z !== z1) {
      grid[z][x] = 0;
      if (x + 1 < grid[0].length) grid[z][x + 1] = 0;
      z += z < z1 ? 1 : -1;
    }
    while (x !== x1) {
      grid[z][x] = 0;
      if (z + 1 < grid.length) grid[z + 1][x] = 0;
      x += x < x1 ? 1 : -1;
    }
  }
  grid[z1][x1] = 0;
}

/** Greedy horizontal then vertical merge of wall tiles into AABBs. */
function mergeWalls(grid, W, H, CELL, HALF) {
  const used = Array.from({ length: H }, () => Array(W).fill(false));
  const walls = [];

  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (grid[z][x] !== 1 || used[z][x]) continue;

      let x2 = x;
      while (x2 + 1 < W && grid[z][x2 + 1] === 1 && !used[z][x2 + 1]) x2 += 1;

      let z2 = z;
      outer: while (z2 + 1 < H) {
        for (let xx = x; xx <= x2; xx++) {
          if (grid[z2 + 1][xx] !== 1 || used[z2 + 1][xx]) break outer;
        }
        z2 += 1;
      }

      for (let zz = z; zz <= z2; zz++) {
        for (let xx = x; xx <= x2; xx++) used[zz][xx] = true;
      }

      const tw = (x2 - x + 1) * CELL;
      const td = (z2 - z + 1) * CELL;
      const cx = ((x + x2 + 1) / 2) * CELL - HALF;
      const cz = ((z + z2 + 1) / 2) * CELL - HALF;
      // Low walls so corridors stay readable under the angled camera
      const h = 1.25 + ((x * 3 + z * 7) % 5) * 0.06;
      walls.push(wall(cx, cz, tw * 0.98, td * 0.98, h));
    }
  }
  return walls;
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

function makeMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color, ...opts });
}

const STONE = [0x3a342c, 0x322c26, 0x403830, 0x2e2822, 0x463e34];

export function buildLevelMeshes(root, spec) {
  const { MAP, walls, floors, stairsPos, depth } = spec;

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

  let si = 0;
  for (const w of walls) {
    const isOuter = w.w > MAP * 0.5 || w.d > MAP * 0.5;
    const color = isOuter
      ? 0x1a1612
      : STONE[si++ % STONE.length];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w.w, w.h, w.d), makeMat(color));
    mesh.position.set(w.x, w.h / 2, w.z);
    root.add(mesh);
  }

  // Stairs down marker
  const stairGroup = new THREE.Group();
  stairGroup.position.set(stairsPos.x, 0, stairsPos.z);
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.1, 0.12, 8),
    makeMat(0x1a3040),
  );
  pad.position.y = 0.06;
  stairGroup.add(pad);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.08, 6, 16),
    makeMat(0x4ad4ff),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.14;
  stairGroup.add(ring);
  const glow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 0.5, 6),
    makeMat(0x2a80a0),
  );
  glow.position.y = 0.35;
  stairGroup.add(glow);
  root.add(stairGroup);
  spec.stairsMesh = stairGroup;

  // Depth-tinted torch posts near stairs
  const torchMat = makeMat(depth % 2 === 0 ? 0xffa050 : 0xff7040);
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 0.12), makeMat(0x2a2218));
    pole.position.set(stairsPos.x + side * 1.6, 0.8, stairsPos.z + 1.2);
    root.add(pole);
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.22), torchMat);
    flame.position.set(stairsPos.x + side * 1.6, 1.75, stairsPos.z + 1.2);
    root.add(flame);
  }

  const grid = new THREE.GridHelper(MAP, Math.floor(MAP / 2), 0x1e1810, 0x16120e);
  grid.position.y = 0.008;
  grid.material.opacity = 0.2;
  grid.material.transparent = true;
  root.add(grid);
}
