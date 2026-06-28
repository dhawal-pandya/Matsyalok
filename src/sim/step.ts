import type { World } from "./world";
import type { Grid } from "./grid";
import type { ResourceField } from "./resource";
import { reflexBrain } from "./brains/reflex";
import { strategyBrain } from "./brains/strategy";
import { playerBrain, type PlayerIntent } from "./brains/player";
import { BrainKind } from "./brains/kinds";
import { boundaryForce, integrate } from "./body";
import { Rel, relate } from "./relate";
import { Ecology, metabolize, AsexualReproduction } from "./lifecycle";
import { tickAbility, speedMult, forceMult } from "./abilities";

/** One fixed-timestep tick (§6, A1): regrow → grid → move → feed → metabolise →
 *  reproduce → remove dead. `dt` is constant → deterministic. */

const _brain: [number, number] = [0, 0];
const _bounds: [number, number] = [0, 0];
let _neighbors = new Int32Array(0);

const W_BOUNDS = 2.4;

export function step(
  world: World,
  grid: Grid,
  resource: ResourceField,
  dt: number,
  intent: PlayerIntent | null = null,
): void {
  if (_neighbors.length < world.capacity) _neighbors = new Int32Array(world.capacity);

  resource.regrow(dt);
  grid.build(world);

  const n = world.count;

  // Movement: tick abilities → brain (possessed: player; apex: strategy; else
  // reflex) → wall avoidance → integrate at boost-adjusted speed/force.
  for (let i = 0; i < n; i++) {
    tickAbility(world, i, dt);
    if (i === world.possessed && intent) playerBrain(world, i, intent, _brain);
    else if (world.brainKind[i] === BrainKind.HUNTER) strategyBrain(world, grid, i, _neighbors, dt, _brain);
    else reflexBrain(world, grid, i, _neighbors, dt, _brain);
    boundaryForce(world, i, _bounds);
    const ms = world.maxSpeed[i] * speedMult(world, i);
    const mf = world.maxForce[i] * forceMult(world, i);
    integrate(world, i, _brain[0] + _bounds[0] * W_BOUNDS, _brain[1] + _bounds[1] * W_BOUNDS, ms, mf, dt);
  }

  // Biting: each hunter catches the nearest in-range prey (digestion-limited), or
  // tears at a whale if its pack is mobbing one. Off → chase but never consume (§2).
  if (world.bitingEnabled) {
    for (let i = 0; i < n; i++) {
      if (world.dead[i] || !world.hunts[i]) continue;
      if (world.feedCooldown[i] > 0) {
        world.feedCooldown[i] -= dt;
        continue;
      }
      if (!eatNearestFood(world, grid, i)) mobBiteWhale(world, grid, i);
    }
  }

  // Hunger: grazing + metabolism + starvation, then reproduction.
  if (world.ecologyEnabled) {
    for (let i = 0; i < n; i++) {
      if (world.dead[i]) continue;
      if (world.grazes[i]) {
        // Intake scales with body size: a big filter-feeder (the whale) sweeps a
        // wide swathe of bloom, enough to outpace its larger metabolism instead of
        // starving. Small grazers just take their own cell.
        const reach = world.size[i] / Ecology.GRAZE_SIZE_REF;
        const want = Ecology.GRAZE_RATE * reach * dt;
        const taken = resource.graze(world.x[i], world.y[i], want, world.size[i]);
        world.energy[i] += taken * Ecology.GRAZE_GAIN;
      }
      metabolize(world, i, dt);
      if (world.energy[i] <= 0) world.dead[i] = 1;
    }
    for (let i = 0; i < n; i++) {
      if (world.dead[i]) continue;
      AsexualReproduction.maybeReproduce(world, i, dt);
    }
  }

  world.compact();
  world.time += dt;
}

function eatNearestFood(world: World, grid: Grid, i: number): boolean {
  const searchR = world.size[i] * 3 + 8;
  const count = grid.query(world.x[i], world.y[i], searchR, _neighbors);
  // Starving hunters turn cannibal: a same-species neighbour no larger than the
  // biter becomes fair game alongside ordinary FOOD.
  const desperate = world.energy[i] < Ecology.CANNIBAL_HUNGER;
  let best = -1;
  let bestD2 = Infinity;
  for (let q = 0; q < count; q++) {
    const j = _neighbors[q];
    if (j === i || world.dead[j]) continue;
    const edible =
      relate(world, i, j) === Rel.FOOD ||
      (desperate && world.species[j] === world.species[i] && world.size[j] <= world.size[i]);
    if (!edible) continue;
    const dx = world.x[i] - world.x[j];
    const dy = world.y[i] - world.y[j];
    const d2 = dx * dx + dy * dy;
    const range = Ecology.EAT_RANGE * (world.size[i] + world.size[j]);
    if (d2 > range * range) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = j;
    }
  }
  if (best < 0) return false;
  world.energy[i] += Ecology.MEAT * world.size[best];
  world.feedCooldown[i] = Ecology.FEED_COOLDOWN;
  world.dead[best] = 1;
  world.kills++;
  world.killFx.push(world.x[best], world.y[best]);
  return true;
}

/** A hunter tears at the nearest whale (a THREAT by size) — but only if enough
 *  fellow hunters are ganged up around it. A lone hunter can't hurt the giant. */
function mobBiteWhale(world: World, grid: Grid, i: number): void {
  const searchR = world.size[i] * 4 + 20;
  let whale = -1;
  let bestD2 = Infinity;
  let count = grid.query(world.x[i], world.y[i], searchR, _neighbors);
  for (let q = 0; q < count; q++) {
    const j = _neighbors[q];
    if (j === i || world.dead[j]) continue;
    if (relate(world, i, j) !== Rel.THREAT) continue;
    const dx = world.x[i] - world.x[j];
    const dy = world.y[i] - world.y[j];
    const d2 = dx * dx + dy * dy;
    const range = Ecology.EAT_RANGE * (world.size[i] + world.size[j]);
    if (d2 > range * range) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      whale = j;
    }
  }
  if (whale < 0) return;

  // Count hunters ganged up around the whale.
  let pack = 0;
  count = grid.query(world.x[whale], world.y[whale], Ecology.MOB_RADIUS, _neighbors);
  for (let q = 0; q < count; q++) {
    const k = _neighbors[q];
    if (!world.dead[k] && world.hunts[k]) pack++;
  }
  if (pack < Ecology.MOB_THRESHOLD) return;

  world.energy[whale] -= Ecology.WHALE_DMG;
  world.energy[i] += Ecology.WHALE_GAIN;
  world.feedCooldown[i] = Ecology.FEED_COOLDOWN;
  if (world.energy[whale] <= 0) {
    world.dead[whale] = 1;
    world.kills++;
    world.killFx.push(world.x[whale], world.y[whale], world.x[whale], world.y[whale]);
  }
}
