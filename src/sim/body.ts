import type { World } from "./world";
import { angleDelta, clamp, limit } from "./math";

const TURN_RATE = 8; // rad/s — how fast heading eases toward the direction of motion

/** Body physics (§7.1): integrate steering into velocity/position, and keep agents
 *  in the tank via a soft inward force near walls (D4) — they bank away, not bounce. */

const WALL_MARGIN = 90; // distance from a wall at which avoidance begins
const MIN_SPEED_FRAC = 0.22; // creatures never fully stop — they always glide

const _force: [number, number] = [0, 0];

/** Inward force near a wall, ramping quadratically with closeness; written to `out`. */
export function boundaryForce(world: World, i: number, out: [number, number]): [number, number] {
  const max = world.maxForce[i];
  const x = world.x[i];
  const y = world.y[i];
  let fx = 0;
  let fy = 0;

  if (x < WALL_MARGIN) {
    const t = 1 - x / WALL_MARGIN;
    fx += t * t * max;
  } else if (x > world.width - WALL_MARGIN) {
    const t = 1 - (world.width - x) / WALL_MARGIN;
    fx -= t * t * max;
  }

  if (y < WALL_MARGIN) {
    const t = 1 - y / WALL_MARGIN;
    fy += t * t * max;
  } else if (y > world.height - WALL_MARGIN) {
    const t = 1 - (world.height - y) / WALL_MARGIN;
    fy -= t * t * max;
  }

  out[0] = fx;
  out[1] = fy;
  return out;
}

/** Semi-implicit Euler step under force (fx,fy), with effective (boost-adjusted)
 *  maxSpeed/maxForce: clamp force, clamp speed to [minSpeed, maxSpeed], set heading
 *  from velocity, hard-clamp to bounds. */
export function integrate(
  world: World,
  i: number,
  fx: number,
  fy: number,
  maxSpeed: number,
  maxForce: number,
  dt: number,
): void {
  limit(fx, fy, maxForce, _force);

  const ovx = world.vx[i];
  const ovy = world.vy[i];
  let vx = ovx + _force[0] * dt;
  let vy = ovy + _force[1] * dt;

  // Clamp speed to [minSpeed, maxSpeed]. The min keeps fish gliding (alive), but
  // is skipped while braking (force opposes motion) so an agent can decelerate
  // through zero and reverse instead of being pinned at the floor.
  const max = maxSpeed;
  const min = world.maxSpeed[i] * MIN_SPEED_FRAC;
  const speed = Math.hypot(vx, vy);
  const braking = _force[0] * ovx + _force[1] * ovy < 0;
  if (speed > max) {
    const s = max / speed;
    vx *= s;
    vy *= s;
  } else if (speed < min && speed > 1e-5 && !braking) {
    const s = min / speed;
    vx *= s;
    vy *= s;
  }

  world.vx[i] = vx;
  world.vy[i] = vy;
  world.x[i] += vx * dt;
  world.y[i] += vy * dt;

  // Heading eases toward the direction of motion at a max turn rate, so fish bank
  // smoothly instead of snapping when velocity jerks (D11).
  if (speed > 1e-4) {
    const turn = TURN_RATE * dt;
    world.heading[i] += clamp(angleDelta(world.heading[i], Math.atan2(vy, vx)), -turn, turn);
  }

  // Safety net only: the soft force should keep us off the walls in practice.
  world.x[i] = clamp(world.x[i], 0, world.width);
  world.y[i] = clamp(world.y[i], 0, world.height);
}
