import type { World } from "./world";

/** Uniform spatial hash for neighbour queries (D5/A3). Rebuilt each tick by a
 *  counting sort — contiguous ids per cell, zero per-tick allocation. */
export class Grid {
  readonly cellSize: number;
  cols = 1;
  rows = 1;

  private readonly cellOf: Int32Array; // cell index per agent
  private readonly order: Int32Array; // agent ids sorted by cell
  private starts: Int32Array; // length numCells+1; starts[c]..starts[c+1] = cell c
  private cursor: Int32Array; // scratch write-head per cell during scatter

  constructor(capacity: number, cellSize: number) {
    this.cellSize = cellSize;
    this.cellOf = new Int32Array(capacity);
    this.order = new Int32Array(capacity);
    this.starts = new Int32Array(1);
    this.cursor = new Int32Array(0);
  }

  private cellIndex(x: number, y: number): number {
    let cx = (x / this.cellSize) | 0;
    let cy = (y / this.cellSize) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  build(world: World): void {
    this.cols = Math.max(1, Math.ceil(world.width / this.cellSize));
    this.rows = Math.max(1, Math.ceil(world.height / this.cellSize));
    const numCells = this.cols * this.rows;

    if (this.starts.length < numCells + 1) {
      this.starts = new Int32Array(numCells + 1);
      this.cursor = new Int32Array(numCells);
    } else {
      this.starts.fill(0, 0, numCells + 1);
    }

    const n = world.count;

    // 1) Count per cell (offset by 1 so the prefix sum yields start indices).
    for (let i = 0; i < n; i++) {
      const c = this.cellIndex(world.x[i], world.y[i]);
      this.cellOf[i] = c;
      this.starts[c + 1]++;
    }
    // 2) Prefix sum → starts[c] is the first slot for cell c.
    for (let c = 0; c < numCells; c++) {
      this.starts[c + 1] += this.starts[c];
      this.cursor[c] = this.starts[c];
    }
    // 3) Scatter agent ids into contiguous per-cell runs.
    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];
      this.order[this.cursor[c]++] = i;
    }
  }

  /** Append ids in cells overlapping circle (x,y,r) into `out`; returns the count.
   *  Caller distance-tests against `r` and skips self. */
  query(x: number, y: number, r: number, out: Int32Array): number {
    const cs = this.cellSize;
    let mincx = ((x - r) / cs) | 0;
    let maxcx = ((x + r) / cs) | 0;
    let mincy = ((y - r) / cs) | 0;
    let maxcy = ((y + r) / cs) | 0;
    if (mincx < 0) mincx = 0;
    if (mincy < 0) mincy = 0;
    if (maxcx >= this.cols) maxcx = this.cols - 1;
    if (maxcy >= this.rows) maxcy = this.rows - 1;

    const cap = out.length;
    let k = 0;
    for (let cy = mincy; cy <= maxcy; cy++) {
      const rowBase = cy * this.cols;
      for (let cx = mincx; cx <= maxcx; cx++) {
        const c = rowBase + cx;
        const end = this.starts[c + 1];
        for (let p = this.starts[c]; p < end; p++) {
          if (k >= cap) return k;
          out[k++] = this.order[p];
        }
      }
    }
    return k;
  }
}
