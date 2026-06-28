import { FishStyle, type World } from "../sim/world";
import { Ability } from "../sim/abilities";
import { BrainKind } from "../sim/brains/kinds";

/** The shared board (§2/§7.9): a prey shoal, the hunters that work it, and a big
 *  filter-feeder (the "whale") that grazes the bloom. The whale eats no fish and
 *  repels lone hunters (it reads as a THREAT by size), but a pack can mob it down.
 *  Pure sim (D15) so headless tests spawn exactly what the app does. */

export const SP_PREY = 0;
export const SP_HUNTER = 1;
export const SP_WHALE = 2;

export interface PredatorPreyOpts {
  prey?: number;
  hunters?: number;
  whales?: number;
}

export function populatePredatorPrey(
  w: World,
  opts: PredatorPreyOpts = {},
): void {
  const prey = opts.prey ?? 1000;
  const hunters = opts.hunters ?? 6;
  const whales = opts.whales ?? 0;

  for (let i = 0; i < prey; i++) {
    w.spawn({
      x: w.rng.range(60, w.width - 60),
      y: w.rng.range(60, w.height - 60),
      size: w.rng.range(6.0, 7.0),
      species: SP_PREY,
      visionRange: 105,
      fovDeg: 300,
      lateralRange: 38,
      maxSpeed: w.rng.range(82, 100),
      maxForce: 240,
      hue: 200 + w.rng.signed(8), // muted blue-grey shoal fish
      energy: w.rng.range(28, 50),
      grazes: true,
      style: FishStyle.MUTED,
      reproThreshold: 52, // r-strategist
      brainKind: BrainKind.REFLEX,
      hunts: false,
      abilityKind: Ability.DART,
    });
  }

  for (let i = 0; i < hunters; i++) {
    w.spawn({
      x: w.rng.range(120, w.width - 120),
      y: w.rng.range(120, w.height - 120),
      size: w.rng.range(10.0, 12.0), // mid: between prey and the whale
      species: SP_HUNTER,
      visionRange: 175,
      fovDeg: 180,
      lateralRange: 72,
      maxSpeed: w.rng.range(108, 120),
      maxForce: 150,
      hue: 142 + w.rng.signed(8), // bright, tacky predatory green
      energy: w.rng.range(120, 180),
      grazes: false,
      style: FishStyle.VIVID,
      reproThreshold: 300, // K-strategist
      brainKind: BrainKind.HUNTER,
      hunts: true,
      abilityKind: Ability.LUNGE,
    });
  }

  for (let i = 0; i < whales; i++) {
    w.spawn({
      x: w.rng.range(160, w.width - 160),
      y: w.rng.range(160, w.height - 160),
      size: w.rng.range(34, 46), // a true leviathan, towering over the shoal
      species: SP_WHALE,
      visionRange: 200,
      fovDeg: 300,
      lateralRange: 90,
      maxSpeed: w.rng.range(38, 48), // slow and lumbering
      maxForce: 70,
      hue: 210 + w.rng.signed(5), // deep blue — "just is"
      energy: 600,
      grazes: true, // filter-feeds the bloom; size-scaled intake keeps it fed
      style: FishStyle.CALM,
      reproThreshold: 3000, // breeds very rarely despite feeding well
      brainKind: BrainKind.REFLEX,
      hunts: false,
      abilityKind: Ability.NONE,
    });
  }
}
