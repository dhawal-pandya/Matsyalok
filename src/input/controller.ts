import type { World } from "../sim/world";
import type { Camera } from "../render/camera";
import type { PlayerIntent } from "../sim/brains/player";

/** Translates mouse/keyboard into possession + a `PlayerIntent` (§7.8, D13/D14).
 *  Outside the sim core so the sim stays headless/pure. Three schemes:
 *    cursor  — the creature steers toward the pointer
 *    direct  — WASD/arrows as compass directions (top-down)
 *    thrust  — arcade: ←/→ turn, ↑ thrust (inertial) */
export type Scheme = "cursor" | "direct" | "thrust";
const SCHEME_CYCLE: Scheme[] = ["direct", "cursor", "thrust"];

const TURN_RATE = 3.2; // rad/s for the thrust scheme
const PICK_RADIUS = 44; // click tolerance (screen px) for possession

export class PlayerController {
  scheme: Scheme = "direct";
  follow = true;

  private keys = new Set<string>();
  private csx = 0;
  private csy = 0;
  private dir = 0; // desired heading for the thrust scheme
  private readonly intent: PlayerIntent = { dir: 0, thrust: 0, fire: false };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: () => World,
    private readonly camera: Camera,
  ) {
    canvas.addEventListener("mousemove", (e) => this.onMove(e));
    canvas.addEventListener("mousedown", (e) => this.onClick(e));
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
  }

  private onMove(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.csx = e.clientX - r.left;
    this.csy = e.clientY - r.top;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key.toLowerCase();
    if (down) {
      if (k === "escape") this.world().possessed = -1;
      else if (k === "c") this.scheme = SCHEME_CYCLE[(SCHEME_CYCLE.indexOf(this.scheme) + 1) % SCHEME_CYCLE.length];
      else if (k === "f") this.follow = !this.follow;
    }
    if (k === " " || k.startsWith("arrow")) e.preventDefault();
    if (down) this.keys.add(k);
    else this.keys.delete(k);
  }

  private onClick(e: MouseEvent): void {
    const w = this.world();
    const r = this.canvas.getBoundingClientRect();
    const wx = this.camera.screenToWorldX(e.clientX - r.left);
    const wy = this.camera.screenToWorldY(e.clientY - r.top);
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < w.count; i++) {
      const dx = w.x[i] - wx;
      const dy = w.y[i] - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    const pick = PICK_RADIUS / this.camera.zoom;
    if (best >= 0 && bestD2 < pick * pick) {
      w.possessed = w.possessed === best ? -1 : best;
      if (w.possessed === best) this.dir = w.heading[best]; // avoid a heading snap
    }
  }

  /** Agent under the cursor (within click tolerance), or -1 — for a hover affordance. */
  hovered(world: World): number {
    const wx = this.camera.screenToWorldX(this.csx);
    const wy = this.camera.screenToWorldY(this.csy);
    let best = -1;
    let bestD2 = Infinity;
    for (let i = 0; i < world.count; i++) {
      const dx = world.x[i] - wx;
      const dy = world.y[i] - wy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    const pick = PICK_RADIUS / this.camera.zoom;
    return best >= 0 && bestD2 < pick * pick ? best : -1;
  }

  private has(...keys: string[]): boolean {
    for (const k of keys) if (this.keys.has(k)) return true;
    return false;
  }

  /** Compute this frame's intent for the possessed agent. */
  update(dt: number): PlayerIntent {
    const w = this.world();
    const p = w.possessed;
    const it = this.intent;
    it.fire = this.has(" ");
    if (p < 0) {
      it.thrust = 0;
      return it;
    }

    if (this.scheme === "cursor") {
      const dx = this.camera.screenToWorldX(this.csx) - w.x[p];
      const dy = this.camera.screenToWorldY(this.csy) - w.y[p];
      const d = Math.hypot(dx, dy);
      it.dir = Math.atan2(dy, dx);
      it.thrust = d > 10 ? Math.min(1, d / 120) : 0; // ease off near the pointer
    } else if (this.scheme === "direct") {
      const dx = (this.has("arrowright", "d") ? 1 : 0) - (this.has("arrowleft", "a") ? 1 : 0);
      const dy = (this.has("arrowdown", "s") ? 1 : 0) - (this.has("arrowup", "w") ? 1 : 0);
      if (dx !== 0 || dy !== 0) {
        it.dir = Math.atan2(dy, dx);
        it.thrust = 1;
      } else {
        it.thrust = 0; // no key held → coast
      }
    } else {
      const turn = (this.has("arrowleft", "a") ? -1 : 0) + (this.has("arrowright", "d") ? 1 : 0);
      this.dir += turn * TURN_RATE * dt;
      it.dir = this.dir;
      it.thrust = this.has("arrowup", "w") ? 1 : this.has("arrowdown", "s") ? 0.15 : 0;
    }
    return it;
  }
}
