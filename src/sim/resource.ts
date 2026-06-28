/** Regrowing resource field (§7.7, D9): a low-res grid of plankton/sunlight that
 *  feeds grazers. Regrowth is logistic toward `max`; `regrowRate` is the master
 *  balance dial for the whole ecosystem. */
export class ResourceField {
  readonly cellSize: number;
  readonly max: number;
  regrowRate: number;

  cols = 1;
  rows = 1;
  amount: Float32Array;

  constructor(width: number, height: number, cellSize: number, max: number, regrowRate: number) {
    this.cellSize = cellSize;
    this.max = max;
    this.regrowRate = regrowRate;
    this.amount = new Float32Array(1);
    this.resize(width, height);
  }

  resize(width: number, height: number): void {
    this.cols = Math.max(1, Math.ceil(width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(height / this.cellSize));
    const n = this.cols * this.rows;
    if (this.amount.length !== n) this.amount = new Float32Array(n);
    this.amount.fill(this.max);
  }

  private index(x: number, y: number): number {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  /** Logistic regrowth toward `max` (never stuck at zero, saturates near full). */
  regrow(dt: number): void {
    const r = this.regrowRate * dt;
    const max = this.max;
    const a = this.amount;
    for (let i = 0; i < a.length; i++) {
      a[i] += r * (1 - a[i] / max);
      if (a[i] > max) a[i] = max;
    }
  }

  /** Take up to `want` from the cells under a creature of footprint `radius`,
   *  returning the amount actually grazed. Small grazers (radius within one cell)
   *  drain just their cell; a large filter-feeder sweeps the surrounding cells. */
  graze(x: number, y: number, want: number, radius = 0): number {
    if (radius <= this.cellSize * 0.5) {
      const c = this.index(x, y);
      const take = this.amount[c] < want ? this.amount[c] : want;
      this.amount[c] -= take;
      return take;
    }
    const cs = this.cellSize;
    const c0 = Math.max(0, ((x - radius) / cs) | 0);
    const c1 = Math.min(this.cols - 1, ((x + radius) / cs) | 0);
    const r0 = Math.max(0, ((y - radius) / cs) | 0);
    const r1 = Math.min(this.rows - 1, ((y + radius) / cs) | 0);
    const r2 = radius * radius;
    let got = 0;
    for (let cy = r0; cy <= r1; cy++) {
      const dy = (cy + 0.5) * cs - y;
      for (let cx = c0; cx <= c1; cx++) {
        const dx = (cx + 0.5) * cs - x;
        if (dx * dx + dy * dy > r2) continue;
        const idx = cy * this.cols + cx;
        const need = want - got;
        if (need <= 0) return got;
        const take = this.amount[idx] < need ? this.amount[idx] : need;
        this.amount[idx] -= take;
        got += take;
      }
    }
    return got;
  }

  totalBiomass(): number {
    let s = 0;
    for (let i = 0; i < this.amount.length; i++) s += this.amount[i];
    return s;
  }
}
