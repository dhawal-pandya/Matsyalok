import type { World } from "./world";

/** Directional perception (§7.3, D11/D12): a short omni lateral line + a long
 *  forward vision cone. Outside both is the rear blind spot — the basis of ambush. */

/** Perceivable given toward-vector (tx,ty)=pos[j]−pos[i], its length `d`, and
 *  heading unit (hx,hy). Hot-path form: caller supplies values it already has. */
export function perceivedDir(
  world: World,
  i: number,
  tx: number,
  ty: number,
  d: number,
  hx: number,
  hy: number,
): boolean {
  if (d <= world.lateralRange[i]) return true; // lateral line: near, omnidirectional
  if (d > world.visionRange[i]) return false; // beyond sight entirely
  // Within vision range — is it inside the forward cone?
  return (tx * hx + ty * hy) / d >= world.fovHalfCos[i];
}

/** Convenience wrapper (tests / non-hot callers): does i perceive j? */
export function perceives(world: World, i: number, j: number): boolean {
  const tx = world.x[j] - world.x[i];
  const ty = world.y[j] - world.y[i];
  const d = Math.hypot(tx, ty) || 1e-6;
  return perceivedDir(world, i, tx, ty, d, Math.cos(world.heading[i]), Math.sin(world.heading[i]));
}
