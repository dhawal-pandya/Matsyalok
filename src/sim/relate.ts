import type { World } from "./world";

/** Relational trophic web (D6/§7.2): role is computed from size, never stored —
 *  one rule yields the whole food web.
 *    b≪a → FOOD · a≪b → THREAT · same species → SCHOOLMATE · else NEUTRAL */
export const Rel = {
  NEUTRAL: 0,
  FOOD: 1,
  THREAT: 2,
  SCHOOLMATE: 3,
} as const;
export type Rel = (typeof Rel)[keyof typeof Rel];

/** A creature eats things ≤ this fraction of its size. The size-ladder dial. */
export const EAT_RATIO = 0.74;

export function relate(world: World, a: number, b: number): Rel {
  const sa = world.size[a];
  const sb = world.size[b];
  if (sb <= sa * EAT_RATIO) return Rel.FOOD;
  if (sa <= sb * EAT_RATIO) return Rel.THREAT;
  if (world.species[a] === world.species[b]) return Rel.SCHOOLMATE;
  return Rel.NEUTRAL;
}
