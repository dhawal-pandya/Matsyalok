/** Which brain an agent runs (dispatched in step.ts). Possession overrides this.
 *  REFLEX: reactive school/flee/graze · HUNTER: roaming pack strategy ·
 *  AMBUSH: sit-and-wait, leap at big game, return to its spot. */
export const BrainKind = { REFLEX: 0, HUNTER: 1, AMBUSH: 2 } as const;
export type BrainKind = (typeof BrainKind)[keyof typeof BrainKind];
