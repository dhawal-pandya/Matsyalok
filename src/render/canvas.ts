import type { World } from "../sim/world";
import type { ResourceField } from "../sim/resource";
import type { Camera } from "./camera";
import { activeFrac } from "../sim/abilities";
import { drawFish } from "./fish";
import { Particles } from "./particles";

/** Frame compositor (§7.10): reads world arrays and paints them, never mutates sim
 *  (D15). Handles HiDPI and off-screen culling. */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private dpr = 1;
  viewW = 0;
  viewH = 0;

  // Low-res offscreen buffer for the resource field; upscaled with smoothing so
  // the cells read as soft, blurred blobs rather than a sharp grid.
  private resBuf: HTMLCanvasElement;
  private resBufCtx: CanvasRenderingContext2D;
  private resImage: ImageData | null = null;

  readonly particles = new Particles();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Matsyalok: 2D canvas context unavailable.");
    this.ctx = ctx;
    this.resBuf = document.createElement("canvas");
    this.resBufCtx = this.resBuf.getContext("2d")!;
  }

  /** Size the backing store to the CSS box × devicePixelRatio. */
  resize(cssW: number, cssH: number): void {
    this.dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    this.viewW = cssW;
    this.viewH = cssH;
    this.canvas.width = Math.round(cssW * this.dpr);
    this.canvas.height = Math.round(cssH * this.dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  private drawBackground(time: number): void {
    const { ctx, viewW, viewH } = this;

    const g = ctx.createLinearGradient(0, 0, viewW, viewH);
    g.addColorStop(0, "#0c1c2c");
    g.addColorStop(1, "#08131f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, viewW, viewH);

    // Soft drifting caustic dapples — a top-down water surface, cheap.
    ctx.globalCompositeOperation = "lighter";
    const span = Math.min(viewW, viewH);
    for (let k = 0; k < 5; k++) {
      const px = viewW * (0.5 + 0.42 * Math.sin(time * 0.04 + k * 1.7));
      const py = viewH * (0.5 + 0.42 * Math.cos(time * 0.03 + k * 2.3));
      const rad = span * (0.18 + 0.05 * Math.sin(time * 0.07 + k));
      const dap = ctx.createRadialGradient(px, py, 0, px, py, rad);
      dap.addColorStop(0, "rgba(90,150,190,0.05)");
      dap.addColorStop(1, "rgba(90,150,190,0)");
      ctx.fillStyle = dap;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  private drawResource(resource: ResourceField, camera: Camera): void {
    const { cols, rows, amount, max } = resource;
    const buf = this.resBuf;
    if (buf.width !== cols || buf.height !== rows) {
      buf.width = cols;
      buf.height = rows;
      this.resImage = this.resBufCtx.createImageData(cols, rows);
    }
    const img = this.resImage!;
    const data = img.data;
    // Desaturated grey-green; per-pixel alpha encodes how full each cell is.
    for (let c = 0; c < cols * rows; c++) {
      const a = amount[c] / max;
      const o = c * 4;
      data[o] = 108;
      data[o + 1] = 124;
      data[o + 2] = 116;
      data[o + 3] = (a * a * 50) | 0; // muted toward grey, biased to the richest cells
    }
    this.resBufCtx.putImageData(img, 0, 0);

    const cs = resource.cellSize * camera.zoom;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true; // bilinear upscale → soft, blurred blobs
    ctx.drawImage(
      buf,
      camera.worldToScreenX(0),
      camera.worldToScreenY(0),
      cols * cs,
      rows * cs,
    );
  }

  spawnKill(x: number, y: number): void {
    this.particles.burst(x, y);
  }

  private ring(world: World, camera: Camera, i: number, color: string, lw: number): void {
    const sx = camera.worldToScreenX(world.x[i]);
    const sy = camera.worldToScreenY(world.y[i]);
    const r = (world.size[i] * 2.4 + 6) * camera.zoom;
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lw;
    this.ctx.beginPath();
    this.ctx.arc(sx, sy, r, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  draw(world: World, camera: Camera, resource: ResourceField, possessed = -1, hovered = -1, dt = 0): void {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.drawBackground(world.time);
    this.drawResource(resource, camera);

    if (hovered >= 0 && hovered < world.count && hovered !== possessed) {
      this.ring(world, camera, hovered, "rgba(190,225,255,0.45)", 1.5);
    }
    if (possessed >= 0 && possessed < world.count) {
      this.ring(world, camera, possessed, "rgba(255,235,150,0.9)", 2);
    }

    const n = world.count;
    const margin = 64;
    for (let i = 0; i < n; i++) {
      const sx = camera.worldToScreenX(world.x[i]);
      const sy = camera.worldToScreenY(world.y[i]);
      if (sx < -margin || sy < -margin || sx > this.viewW + margin || sy > this.viewH + margin) {
        continue; // off-screen cull
      }

      // A short motion streak while an ability (dart/lunge) is bursting.
      if (world.abilityTimer[i] > 0) {
        const z = camera.zoom * 0.09;
        ctx.strokeStyle = "rgba(225,240,255,0.45)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - world.vx[i] * z, sy - world.vy[i] * z);
        ctx.stroke();
      }

      // A burst flicks the tail once, then holds rigid until it ends; otherwise the
      // tail beats faster the quicker the fish swims (phase de-syncs the school).
      let animFrac: number;
      let straight = false;
      if (world.abilityTimer[i] > 0) {
        const prog = 1 - activeFrac(world, i); // 0 at fire → 1 at end
        if (prog < 0.3) animFrac = Math.sin((prog / 0.3) * Math.PI) * 0.24; // one flick
        else {
          animFrac = 0;
          straight = true;
        }
      } else {
        animFrac = world.phase[i]; // smooth tail beat accumulated by step()
      }

      // Satiation: how full the fish is toward its split threshold, shown on the
      // tail/eyes by the sprite (body colour persists).
      const thr = world.reproThreshold[i];
      const satiety = thr > 0 ? Math.min(1, world.energy[i] / thr) : 0;

      drawFish(
        ctx, sx, sy, world.heading[i], world.size[i], world.hue[i],
        animFrac, straight, world.style[i], satiety,
      );
    }

    this.particles.update(dt);
    this.particles.draw(ctx, camera);

    // Soft vignette to settle the edges.
    const vg = ctx.createRadialGradient(
      this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * 0.42,
      this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * 0.75,
    );
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.34)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }
}
