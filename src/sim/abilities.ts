import type { World } from "./world";

/** Cooldown-gated "verb" pulses (§7.6). A brain fires one by policy (AI) or
 *  keypress (player); while active it boosts the agent's speed/force — this is the
 *  burst that lets escape/attack exceed cruise speed. `bark`/`bubble-net` (shared
 *  repulsion pulses) slot in here later for the shepherd/orca. */
export const Ability = { NONE: 0, DART: 1, LUNGE: 2 } as const;
export type Ability = (typeof Ability)[keyof typeof Ability];

interface AbilityDef {
  speedMult: number;
  forceMult: number;
  duration: number; // seconds the boost lasts
  cooldown: number; // seconds before it can fire again
  energyCost: number;
}

const DEFS: Record<number, AbilityDef> = {
  [Ability.DART]: { speedMult: 2.3, forceMult: 2.2, duration: 0.45, cooldown: 1.5, energyCost: 2 },
  [Ability.LUNGE]: { speedMult: 1.9, forceMult: 1.8, duration: 0.6, cooldown: 2.2, energyCost: 5 },
};

export function tickAbility(world: World, i: number, dt: number): void {
  if (world.abilityCooldown[i] > 0) world.abilityCooldown[i] -= dt;
  if (world.abilityTimer[i] > 0) world.abilityTimer[i] -= dt;
}

/** Fire if off cooldown, not already active, and affordable; returns success. */
export function tryFire(world: World, i: number): boolean {
  const def = DEFS[world.abilityKind[i]];
  if (!def) return false;
  if (world.abilityCooldown[i] > 0 || world.abilityTimer[i] > 0) return false;
  if (world.energy[i] <= def.energyCost) return false;
  world.energy[i] -= def.energyCost;
  world.abilityTimer[i] = def.duration;
  world.abilityCooldown[i] = def.cooldown;
  return true;
}

export function isActive(world: World, i: number): boolean {
  return world.abilityTimer[i] > 0;
}

/** Remaining fraction of the active burst: 1 at fire → 0 at end (0 if inactive). */
export function activeFrac(world: World, i: number): number {
  const def = DEFS[world.abilityKind[i]];
  if (!def || world.abilityTimer[i] <= 0) return 0;
  return world.abilityTimer[i] / def.duration;
}

export function speedMult(world: World, i: number): number {
  if (world.abilityTimer[i] <= 0) return 1;
  const def = DEFS[world.abilityKind[i]];
  return def ? def.speedMult : 1;
}

export function forceMult(world: World, i: number): number {
  if (world.abilityTimer[i] <= 0) return 1;
  const def = DEFS[world.abilityKind[i]];
  return def ? def.forceMult : 1;
}
