import type { Camera } from "./camera";

/** Tiny puff of particles on a kill (§7.10 polish). Render-only — uses Math.random
 *  freely (not sim state) and never touches the world. */
interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
}

export class Particles {
  private readonly ps: P[] = [];

  burst(x: number, y: number): void {
    for (let k = 0; k < 7; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 45;
      const max = 0.45 + Math.random() * 0.35;
      this.ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: max, max });
    }
  }

  update(dt: number): void {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9;
      p.vy *= 0.9;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const p of this.ps) {
      const a = p.life / p.max;
      const r = (1 + (1 - a) * 2) * camera.zoom;
      ctx.fillStyle = `rgba(235,215,205,${(a * 0.5).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(camera.worldToScreenX(p.x), camera.worldToScreenY(p.y), r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
