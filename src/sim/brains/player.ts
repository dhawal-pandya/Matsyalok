import type { World } from "../world";
import { speedMult, tryFire } from "../abilities";

/** Player brain (§7.8, D13/D14). Possession just swaps an agent's brain to this.
 *  Both control schemes (thrust+turn and steer-to-cursor) reduce to the same
 *  intent — a desired direction + thrust — so the brain itself is scheme-agnostic.
 *  Input lives outside the sim (input/) and fills `PlayerIntent`, keeping sim pure. */
export interface PlayerIntent {
  dir: number; // desired heading (radians)
  thrust: number; // 0..1 of cruise speed
  fire: boolean; // fire the agent's ability this tick
}

export function playerBrain(
  world: World,
  i: number,
  intent: PlayerIntent,
  out: [number, number],
): [number, number] {
  const max = world.maxSpeed[i] * speedMult(world, i);
  const dvx = Math.cos(intent.dir) * max * intent.thrust;
  const dvy = Math.sin(intent.dir) * max * intent.thrust;
  out[0] = dvx - world.vx[i];
  out[1] = dvy - world.vy[i];
  if (intent.fire) tryFire(world, i);
  return out;
}
