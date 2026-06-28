import type { World } from "./world";
import { limit } from "./math";

/** Reynolds steering forces (§7.4). Allocation-free: callers pass a reusable `out`. */

// Wander tuning (A6 — future sliders): a point rides a circle projected ahead,
// jittering each tick for smooth meandering paths.
const WANDER_AHEAD = 26; // how far ahead the wander circle sits
const WANDER_RADIUS = 18; // size of the wander circle
const WANDER_JITTER = 2.6; // radians/sec of angular drift along the circle

/** Gentle turn toward a slowly drifting target ahead. Mutates `world.wanderAngle[i]`. */
export function wander(world: World, i: number, dt: number, out: [number, number]): [number, number] {
  world.wanderAngle[i] += world.rng.signed(WANDER_JITTER * dt);

  const heading = world.heading[i];
  const a = heading + world.wanderAngle[i];

  // local offset: circle centre ahead + point on circle
  const tx = Math.cos(heading) * WANDER_AHEAD + Math.cos(a) * WANDER_RADIUS;
  const ty = Math.sin(heading) * WANDER_AHEAD + Math.sin(a) * WANDER_RADIUS;

  const max = world.maxSpeed[i];
  const len = Math.hypot(tx, ty) || 1;
  const desiredX = (tx / len) * max;
  const desiredY = (ty / len) * max;

  return limit(desiredX - world.vx[i], desiredY - world.vy[i], world.maxForce[i], out);
}
