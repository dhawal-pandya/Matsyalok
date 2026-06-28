/** Time-series recorder (§7.11, A7): named columns sampled on a fixed cadence into
 *  capped ring buffers. Generic — the caller decides what each column means. */
export class DataRecorder {
  readonly keys: readonly string[];
  readonly cap: number;
  private readonly cols: number[][];
  private readonly idx: Map<string, number>;

  constructor(keys: string[], cap = 2400) {
    this.keys = keys;
    this.cap = cap;
    this.cols = keys.map(() => []);
    this.idx = new Map(keys.map((k, i) => [k, i]));
  }

  /** Append one row (values in `keys` order). Oldest sample drops when full. */
  push(row: number[]): void {
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      c.push(row[i]);
      if (c.length > this.cap) c.shift();
    }
  }

  column(key: string): number[] {
    return this.cols[this.idx.get(key)!];
  }

  clear(): void {
    for (const c of this.cols) c.length = 0;
  }

  get length(): number {
    return this.cols[0].length;
  }

  toCSV(): string {
    const out = [this.keys.join(",")];
    const n = this.length;
    for (let r = 0; r < n; r++) {
      const row = new Array(this.cols.length);
      for (let c = 0; c < this.cols.length; c++) row[c] = +this.cols[c][r].toFixed(3);
      out.push(row.join(","));
    }
    return out.join("\n");
  }
}
