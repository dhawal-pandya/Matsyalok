import type { World } from "../world";
import type { Grid } from "../grid";
import { Rel, relate } from "../relate";
import { perceivedDir } from "../perception";
import { speedMult, tryFire } from "../abilities";
import { wander } from "../steering";

/** Reflex brain (§7.5): cheap reactive AI. One grid query per agent feeds a single
 *  neighbour loop that, per perceived neighbour classified by relate(), accumulates
 *  school (sep+align+cohere), flee (THREAT), chase (FOOD), plus a faint wander.
 *  Allocation-free: caller supplies the neighbour buffer and `out`. */

// Steering weights (A6 — these become live sliders in Phase 6).
const W_SEPARATION = 1.8;
const W_ALIGNMENT = 1.0;
const W_COHESION = 0.85;
const W_FLEE = 4.8; // escaping a predator overrides everything else
const W_CHASE = 1.4;
const W_WANDER = 0.5;
const DART_TRIGGER = 50; // fire an evasive dart when a threat is within this range

const _wander: [number, number] = [0, 0];

export function reflexBrain(
  world: World,
  grid: Grid,
  i: number,
  neighbors: Int32Array,
  dt: number,
  out: [number, number],
): [number, number] {
  const x = world.x[i];
  const y = world.y[i];
  const r = world.viewRadius[i];
  const r2 = r * r;
  const sepR = world.size[i] * 4.0;
  const hx = Math.cos(world.heading[i]);
  const hy = Math.sin(world.heading[i]);

  const count = grid.query(x, y, r, neighbors);

  let sepX = 0,
    sepY = 0;
  let aliX = 0,
    aliY = 0;
  let cohX = 0,
    cohY = 0;
  let schoolN = 0;
  let fleeX = 0,
    fleeY = 0;
  let threatN = 0;
  let nearestThreat = Infinity;
  let bestFood = -1;
  let bestFoodDist = Infinity;

  for (let q = 0; q < count; q++) {
    const j = neighbors[q];
    if (j === i) continue;
    const dx = x - world.x[j]; // vector pointing away from j
    const dy = y - world.y[j];
    const d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);

    // Perception gate (§7.3): a neighbour outside the vision cone and beyond the
    // lateral line is unseen and exerts no influence — the blind spot, and the
    // basis of ambush (D12). (-dx,-dy) points toward j.
    if (!perceivedDir(world, i, -dx, -dy, d, hx, hy)) continue;

    const rel = relate(world, i, j);
    if (rel === Rel.SCHOOLMATE) {
      schoolN++;
      cohX += world.x[j];
      cohY += world.y[j];
      aliX += world.vx[j];
      aliY += world.vy[j];
      if (d < sepR) {
        const w = (sepR - d) / sepR / d; // unit-away × closeness
        sepX += dx * w;
        sepY += dy * w;
      }
    } else if (rel === Rel.THREAT) {
      threatN++;
      if (d < nearestThreat) nearestThreat = d;
      const w = (1 - d / r) / d; // flee harder the closer it is
      fleeX += dx * w;
      fleeY += dy * w;
    } else if (rel === Rel.FOOD) {
      if (d < bestFoodDist) {
        bestFoodDist = d;
        bestFood = j;
      }
    }
  }

  const max = world.maxSpeed[i] * speedMult(world, i);
  const vx = world.vx[i];
  const vy = world.vy[i];
  let fx = 0;
  let fy = 0;

  // Separation — steer away from crowding schoolmates.
  if (sepX !== 0 || sepY !== 0) {
    const m = Math.hypot(sepX, sepY);
    fx += ((sepX / m) * max - vx) * W_SEPARATION;
    fy += ((sepY / m) * max - vy) * W_SEPARATION;
  }

  if (schoolN > 0) {
    // Alignment — match average heading of the school.
    const am = Math.hypot(aliX, aliY);
    if (am > 1e-4) {
      fx += ((aliX / am) * max - vx) * W_ALIGNMENT;
      fy += ((aliY / am) * max - vy) * W_ALIGNMENT;
    }
    // Cohesion — steer toward the school's centroid.
    const tx = cohX / schoolN - x;
    const ty = cohY / schoolN - y;
    const cm = Math.hypot(tx, ty);
    if (cm > 1e-4) {
      fx += ((tx / cm) * max - vx) * W_COHESION;
      fy += ((ty / cm) * max - vy) * W_COHESION;
    }
  }

  // Flee — dominant escape from threats.
  if (threatN > 0) {
    const fm = Math.hypot(fleeX, fleeY);
    if (fm > 1e-4) {
      fx += ((fleeX / fm) * max - vx) * W_FLEE;
      fy += ((fleeY / fm) * max - vy) * W_FLEE;
    }
  }

  // Chase — pursue the nearest food (only carnivores; grazers ignore smaller fish).
  if (bestFood >= 0 && world.hunts[i]) {
    const tx = world.x[bestFood] - x;
    const ty = world.y[bestFood] - y;
    const m = Math.hypot(tx, ty);
    if (m > 1e-4) {
      fx += ((tx / m) * max - vx) * W_CHASE;
      fy += ((ty / m) * max - vy) * W_CHASE;
    }
  }

  // Faint wander so isolated creatures still meander naturally.
  wander(world, i, dt, _wander);
  fx += _wander[0] * W_WANDER;
  fy += _wander[1] * W_WANDER;

  // Evade: dart away when a threat closes in.
  if (threatN > 0 && nearestThreat < DART_TRIGGER) tryFire(world, i);

  out[0] = fx;
  out[1] = fy;
  return out;
}
