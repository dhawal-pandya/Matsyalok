/** Small, allocation-free math helpers for the hot path. */

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest signed angular difference from `a` to `b`, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d < -Math.PI) d += TAU;
  else if (d > Math.PI) d -= TAU;
  return d;
}

/**
 * Clamp a vector's magnitude to `max`, writing the result into `out` (a 2-tuple
 * reused across calls to keep the simulation loop free of per-tick allocation).
 */
export function limit(x: number, y: number, max: number, out: [number, number]): [number, number] {
  const m2 = x * x + y * y;
  if (m2 > max * max && m2 > 1e-9) {
    const s = max / Math.sqrt(m2);
    out[0] = x * s;
    out[1] = y * s;
  } else {
    out[0] = x;
    out[1] = y;
  }
  return out;
}
