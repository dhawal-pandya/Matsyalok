import { FishStyle, type World } from "../sim/world";
import { Ability } from "../sim/abilities";
import { BrainKind } from "../sim/brains/kinds";
import reef from "../config/reef.json";

/** The reef (§2/§7.9): a handful of different fish sharing one board, spawned
 *  straight from config/reef.json — that file is the single dial for the world, so
 *  tuning never means hunting through code (A6, D15). Nothing is labelled "predator"
 *  or "prey"; each fish just has a size, senses, and a way of swimming, and
 *  who-eats-whom falls out of relate() by size (D6). What emerges is a three-tier
 *  chain, bloom → shoal → schooler → ambusher:
 *
 *    sardine  — a tiny silvery shoal that grazes the bloom and breeds fast
 *    mackerel — small, fast; schools and works the shoal it outsizes
 *    grouper  — the brown giant; lurks and darts at passing mackerel, prowling to
 *               new water when hungry. It is the one thing holding the mid tier down. */

// Species ids are the JSON array order — keep these in sync with config/reef.json.
export const SP_SARDINE = 0;
export const SP_MACKEREL = 1;
export const SP_GROUPER = 2;

/** Resource-field setup (cell size, per-cell max, regrow) — read by main.ts. */
export const reefResource = reef.resource;

/** Each fish's id and default starting count — drives the in-app count controls. */
export const reefDefaults: { id: string; count: number }[] = reef.species.map(
  (s) => ({ id: s.id, count: s.count }),
);

const STYLE: Record<string, number> = {
  muted: FishStyle.MUTED,
  vivid: FishStyle.VIVID,
  calm: FishStyle.CALM,
  silver: FishStyle.SILVER,
  earth: FishStyle.EARTH,
};
const BRAIN: Record<string, number> = {
  reflex: BrainKind.REFLEX,
  hunter: BrainKind.HUNTER,
  ambush: BrainKind.AMBUSH,
};
const ABILITY: Record<string, number> = {
  none: Ability.NONE,
  dart: Ability.DART,
  lunge: Ability.LUNGE,
  leap: Ability.LEAP,
};

export interface ReefOpts {
  /** Override a species' spawn count by id (the rest fall back to the JSON). */
  counts?: Partial<Record<string, number>>;
  /** Multiplier on every spawn count — e.g. a thinner reef on small screens. */
  scale?: number;
}

/** Roll a config value that may be a fixed scalar or a [min, max] range. */
function roll(w: World, v: number | number[]): number {
  return Array.isArray(v) ? w.rng.range(v[0]!, v[1]!) : v;
}

export function populateReef(w: World, opts: ReefOpts = {}): void {
  const scale = opts.scale ?? 1;
  reef.species.forEach((s, species) => {
    const base = opts.counts?.[s.id] ?? s.count;
    const count = Math.round(base * scale); // 0 means none — respect the slider
    const m = Math.min(200, 40 + species * 80);
    const corners = (s as { spawnAt?: string }).spawnAt === "corners";
    for (let i = 0; i < count; i++) {
      let px = w.rng.range(m, w.width - m);
      let py = w.rng.range(m, w.height - m);
      if (corners) {
        // Tuck the lurkers into the corners so they don't carve up the central
        // shoal; they prowl inward to hunt from there.
        const inset = 90;
        px = (i % 2 === 0 ? inset : w.width - inset) + w.rng.signed(60);
        py = (i < 2 ? inset : w.height - inset) + w.rng.signed(60);
      }
      w.spawn({
        x: px,
        y: py,
        size: roll(w, s.size),
        species,
        visionRange: s.vision,
        fovDeg: s.fov,
        lateralRange: s.lateral,
        maxSpeed: roll(w, s.maxSpeed),
        maxForce: s.maxForce,
        hue: s.hue + w.rng.signed(s.hueJitter),
        energy: roll(w, s.energy),
        grazes: s.grazes,
        style: STYLE[s.style] ?? FishStyle.MUTED,
        basalMult: s.basalMult,
        reproThreshold: s.reproThreshold,
        brainKind: BRAIN[s.brain] ?? BrainKind.REFLEX,
        hunts: s.hunts,
        abilityKind: ABILITY[s.ability] ?? Ability.NONE,
      });
    }
  });
}
