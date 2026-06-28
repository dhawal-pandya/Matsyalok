import type { World } from "../world";
import type { Grid } from "../grid";
import { Rel, relate } from "../relate";
import { perceivedDir } from "../perception";
import { speedMult, tryFire } from "../abilities";
import { wander } from "../steering";
import { Ecology } from "../lifecycle";

/** Strategy brain (§7.5, §7.8) — apex pack hunting. Hunters spread apart (so the
 *  shoal is pressured from several sides, not dogpiled), pick the nearest perceived
 *  prey, pursue with lead, and lunge when close. A whale (a THREAT by size) is
 *  avoided when alone but mobbed when enough fellow hunters are near — the same
 *  encircle family aimed at a giant. */

const W_SPREAD = 1.6; // push off other hunters → spread around the shoal
const W_PURSUE = 1.9;
const W_AVOID = 1.5; // back off a whale when not in a pack
const W_WANDER = 0.6;
const LUNGE_RANGE = 6; // × predator size: close enough to commit a lunge

const _wander: [number, number] = [0, 0];

export function strategyBrain(
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
  const max = world.maxSpeed[i] * speedMult(world, i);
  const vx = world.vx[i];
  const vy = world.vy[i];
  const hx = Math.cos(world.heading[i]);
  const hy = Math.sin(world.heading[i]);
  const spreadR = world.size[i] * 9;

  const count = grid.query(x, y, r, neighbors);

  let sepX = 0,
    sepY = 0;
  let target = -1;
  let targetDist = Infinity;
  let whale = -1;
  let whaleDist = Infinity;
  let pack = 1; // self, plus fellow hunters nearby (mob readiness)

  for (let q = 0; q < count; q++) {
    const j = neighbors[q];
    if (j === i || world.dead[j]) continue;
    const dx = x - world.x[j];
    const dy = y - world.y[j];
    const d2 = dx * dx + dy * dy;
    if (d2 > r2 || d2 < 1e-6) continue;
    const d = Math.sqrt(d2);
    if (!perceivedDir(world, i, -dx, -dy, d, hx, hy)) continue;

    const rel = relate(world, i, j);
    if (rel === Rel.FOOD) {
      if (d < targetDist) {
        targetDist = d;
        target = j;
      }
    } else if (rel === Rel.SCHOOLMATE) {
      if (d < Ecology.MOB_RADIUS) pack++;
      if (d < spreadR) {
        const w = (spreadR - d) / spreadR / d;
        sepX += dx * w;
        sepY += dy * w;
      }
    } else if (rel === Rel.THREAT) {
      if (d < whaleDist) {
        whaleDist = d;
        whale = j;
      }
    }
  }

  let fx = 0;
  let fy = 0;

  if (sepX !== 0 || sepY !== 0) {
    const m = Math.hypot(sepX, sepY);
    fx += ((sepX / m) * max - vx) * W_SPREAD;
    fy += ((sepY / m) * max - vy) * W_SPREAD;
  }

  // A whale nearby: mob it with the pack, or back off if outnumbered.
  if (whale >= 0) {
    if (pack >= Ecology.MOB_THRESHOLD) {
      target = whale; // commit the pack to the giant
      targetDist = whaleDist;
    } else {
      const ax = (x - world.x[whale]) / (whaleDist || 1);
      const ay = (y - world.y[whale]) / (whaleDist || 1);
      fx += (ax * max - vx) * W_AVOID;
      fy += (ay * max - vy) * W_AVOID;
    }
  }

  if (target >= 0) {
    // Lead pursuit: aim at where the prey will be, not where it is.
    const lead = targetDist / max;
    const tx = world.x[target] + world.vx[target] * lead - x;
    const ty = world.y[target] + world.vy[target] * lead - y;
    const m = Math.hypot(tx, ty) || 1;
    fx += ((tx / m) * max - vx) * W_PURSUE;
    fy += ((ty / m) * max - vy) * W_PURSUE;

    if (targetDist < world.size[i] * LUNGE_RANGE) tryFire(world, i);
  } else {
    wander(world, i, dt, _wander);
    fx += _wander[0] * W_WANDER;
    fy += _wander[1] * W_WANDER;
  }

  out[0] = fx;
  out[1] = fy;
  return out;
}
