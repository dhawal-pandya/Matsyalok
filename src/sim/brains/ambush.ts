import type { World } from "../world";
import type { Grid } from "../grid";
import { Rel, relate } from "../relate";
import { perceivedDir } from "../perception";
import { speedMult, tryFire } from "../abilities";
import { clamp } from "../math";

/** Ambush brain (§7.5, §7.8) — a sit-and-wait giant. When fed it parks at its home
 *  and hangs nearly still (so it barely burns energy), watching for *big game*
 *  drifting past; a worthy target in strike range triggers a LEAP — an explosive
 *  burst that closes the gap — with the bite landing in step.ts's carnivory pass.
 *  When it goes hungry it abandons the spot and *prowls*, slowly walking its home to
 *  new water until it finds prey, then settles again. The shoal is too small to
 *  bother with; only large neighbours are worth a strike, so it specialises on the
 *  giants — which is what keeps their numbers in check. */

const W_PURSUE = 2.4; // commit hard toward the target mid-leap
const W_STALK = 1.2; // creep toward sensed prey before it's in leap range
const W_RETURN = 1.1; // ease toward home (parked or prowling)
const W_BRAKE = 1.4; // settle to rest once parked
const STRIKE_RANGE = 5.6; // × own size: how close prey must be to commit the long dart
const BIG_GAME = 4.6; // ignore anything smaller than this — i.e. the sardine shoal
const HUNGRY_FRAC = 0.35; // below this × reproThreshold, leave the spot and prowl
const ROAM_SPEED = 0.55; // fraction of maxSpeed while prowling for new ground
const TURN = 0.6; // how sharply the prowl heading meanders (rad/s scale)

export function ambushBrain(
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
  const count = grid.query(x, y, r, neighbors);

  let target = -1;
  let targetDist = Infinity;
  for (let q = 0; q < count; q++) {
    const j = neighbors[q];
    if (j === i || world.dead[j]) continue;
    if (world.size[j] < BIG_GAME) continue; // ignore the small fry (the sardine shoal)
    if (relate(world, i, j) !== Rel.FOOD) continue;
    const dx = world.x[j] - x;
    const dy = world.y[j] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const d = Math.sqrt(d2) || 1e-6;
    if (!perceivedDir(world, i, dx, dy, d, hx, hy)) continue;
    if (d < targetDist) {
      targetDist = d;
      target = j;
    }
  }

  let fx = 0;
  let fy = 0;
  const striking = world.abilityTimer[i] > 0;

  if (target >= 0) {
    // Prey in sight: hunt it. Creep closer at cruise; once it's in range (or a leap
    // is already underway) commit with an explosive dart. The home follows along so
    // a fed giant lurks wherever the hunt left it, not back at spawn.
    const tx = world.x[target] - x;
    const ty = world.y[target] - y;
    const m = Math.hypot(tx, ty) || 1;
    if (striking || targetDist < world.size[i] * STRIKE_RANGE) {
      if (!striking) tryFire(world, i);
      const sp = world.maxSpeed[i] * speedMult(world, i);
      fx = ((tx / m) * sp - vx) * W_PURSUE;
      fy = ((ty / m) * sp - vy) * W_PURSUE;
    } else {
      fx = ((tx / m) * world.maxSpeed[i] - vx) * W_STALK;
      fy = ((ty / m) * world.maxSpeed[i] - vy) * W_STALK;
    }
    world.homeX[i] = x;
    world.homeY[i] = y;
  } else if (world.energy[i] < world.reproThreshold[i] * HUNGRY_FRAC) {
    // Hungry: prowl. Walk the home spot along a slowly-meandering heading so the
    // giant cruises to new water instead of starving where the prey isn't.
    world.wanderAngle[i] += world.rng.signed(TURN) * dt;
    const a = world.wanderAngle[i];
    const roam = world.maxSpeed[i] * ROAM_SPEED;
    world.homeX[i] = clamp(world.homeX[i] + Math.cos(a) * roam * dt, 60, world.width - 60);
    world.homeY[i] = clamp(world.homeY[i] + Math.sin(a) * roam * dt, 60, world.height - 60);
    const dx = world.homeX[i] - x;
    const dy = world.homeY[i] - y;
    const d = Math.hypot(dx, dy) || 1;
    fx = ((dx / d) * roam - vx) * W_RETURN;
    fy = ((dy / d) * roam - vy) * W_RETURN;
  } else {
    // Fed and content: drift to the spot and settle, burning almost nothing at rest.
    const dx = world.homeX[i] - x;
    const dy = world.homeY[i] - y;
    const d = Math.hypot(dx, dy);
    if (d > world.size[i] * 1.5) {
      fx = ((dx / d) * max - vx) * W_RETURN;
      fy = ((dy / d) * max - vy) * W_RETURN;
    } else {
      fx = -vx * W_BRAKE; // brake to a hover over the spot
      fy = -vy * W_BRAKE;
    }
  }

  out[0] = fx;
  out[1] = fy;
  return out;
}
