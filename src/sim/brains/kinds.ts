/** Which brain an agent runs (dispatched in step.ts). Possession overrides this. */
export const BrainKind = { REFLEX: 0, HUNTER: 1 } as const;
export type BrainKind = (typeof BrainKind)[keyof typeof BrainKind];
