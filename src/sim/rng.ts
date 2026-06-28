/** Deterministic, seedable PRNG (mulberry32). All sim randomness routes through
 *  here so runs are reproducible from a seed (A1) — never use Math.random() in sim. */
export class Rng {
  private state: number;

  constructor(seed = 0x9e3779b9) {
    // Avoid a zero state, which would collapse the generator.
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform float in [-spread, spread). */
  signed(spread = 1): number {
    return (this.next() * 2 - 1) * spread;
  }
}
