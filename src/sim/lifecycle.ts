import type { World } from "./world";

/** Energy, reproduction, and death (§7.7, A4). Tunables here are the population
 *  knobs (A6); resource regrowth (resource.ts, D9) is the master dial above them. */
export const Ecology = {
  BASAL: 0.55, // metabolic cost per unit size, per second
  MOVE: 0.02, // movement cost per unit speed, per second
  GRAZE_RATE: 7, // resource units a baseline-size grazer ingests per second
  GRAZE_GAIN: 1.2, // energy per unit of resource grazed
  GRAZE_SIZE_REF: 3.3, // body size that grazes at GRAZE_RATE; bigger sweep wider
  GRAZE_REACH_MAX: 2.2, // cap on the size bonus, so a giant can't vacuum the field
  MEAT: 6, // energy gained per unit of prey size when eaten
  REPRO_COOLDOWN: 3, // seconds between births
  FEED_COOLDOWN: 2.5, // predator digestion time → caps the predation rate
  EAT_RANGE: 1.3, // catch distance as a multiple of (eater + eaten size)
  CANNIBAL_HUNGER: 35, // below this energy a hunter turns on its own kind
};

/** Per-tick metabolic burn: a basal cost (scaled per agent — tiny for a lurking
 *  ambusher) plus a movement cost that only bites while actually swimming. */
export function metabolize(world: World, i: number, dt: number): void {
  const speed = Math.hypot(world.vx[i], world.vy[i]);
  const basal = Ecology.BASAL * world.size[i] * world.basalMult[i];
  world.energy[i] -= (basal + Ecology.MOVE * speed) * dt;
}

/** Reproduction seam (D10). Asexual: split energy into a child once over threshold.
 *  A sexual (needs-a-mate) strategy can later implement the same interface. */
export interface ReproductionStrategy {
  maybeReproduce(world: World, i: number, dt: number): void;
}

export const AsexualReproduction: ReproductionStrategy = {
  maybeReproduce(world, i, dt) {
    if (world.reproCooldown[i] > 0) {
      world.reproCooldown[i] -= dt;
      return;
    }
    if (world.energy[i] < world.reproThreshold[i]) return;

    const half = world.energy[i] * 0.5;
    const jitter = world.size[i] * 2;
    const child = world.spawnLike(
      i,
      world.x[i] + world.rng.signed(jitter),
      world.y[i] + world.rng.signed(jitter),
      half,
    );
    if (child < 0) return; // world full — defer
    world.energy[i] = half;
    world.reproCooldown[i] = Ecology.REPRO_COOLDOWN;
    world.reproCooldown[child] = Ecology.REPRO_COOLDOWN;
    world.births++;
  },
};
