import { World } from "../src/sim/world";
import { Grid } from "../src/sim/grid";
import { ResourceField } from "../src/sim/resource";
import { step } from "../src/sim/step";
import {
  populateReef,
  reefResource,
  SP_MACKEREL,
  SP_GROUPER,
} from "../src/scenarios/reef";

/** Headless balance check. The sim core is DOM-free (D15), so we can step it in
 *  Node and watch the three populations over time — the way to confirm an edit to
 *  config/reef.json keeps the reef oscillating instead of collapsing or exploding.
 *
 *  Run:  npm run balance            (6 sim-minutes)
 *        npm run balance -- 12      (12 sim-minutes)
 *
 *  ⚠ This only *reports* — it can't keep a bad config alive. Crazy reef.json
 *  numbers will play out here exactly as they would in the app: a species hitting
 *  0 (extinction) or the count pinning at CAPACITY (runaway breeding) both mean the
 *  balance is broken, not that the harness is. Tune back toward the defaults. */

const W = 1600;
const H = 900;
const CAP = 16384; // keep in sync with CAPACITY in src/main.ts
const DT = 1 / 60;

const minutes = Number(process.argv[2] ?? 6);
const totalTicks = Math.round((minutes * 60) / DT);
const sampleEvery = Math.round(15 / DT); // every 15 sim-seconds

const world = new World(W, H, CAP, 7);
const resource = new ResourceField(W, H, reefResource.cell, reefResource.max, reefResource.regrow);
const grid = new Grid(CAP, 50);
populateReef(world);

function counts(): { sa: number; ma: number; gr: number; res: number } {
  let sa = 0, ma = 0, gr = 0;
  for (let i = 0; i < world.count; i++) {
    const s = world.species[i];
    if (s === SP_MACKEREL) ma++;
    else if (s === SP_GROUPER) gr++;
    else sa++;
  }
  const res = Math.round((resource.totalBiomass() / (resource.amount.length * resource.max)) * 100);
  return { sa, ma, gr, res };
}

const pad = (v: number, w: number) => String(v).padStart(w);

console.log(`reef balance · ${minutes} sim-min · seed 7 · ${W}×${H}\n`);
console.log("  t(s)  sardine  mackerel  grouper  res%   kills   births   total");

let warned = false;
let stepMs = 0;
for (let tick = 0; tick <= totalTicks; tick++) {
  if (tick % sampleEvery === 0) {
    const c = counts();
    console.log(
      pad(Math.round(world.time), 6),
      pad(c.sa, 8),
      pad(c.ma, 9),
      pad(c.gr, 8),
      pad(c.res, 5),
      pad(world.kills, 7),
      pad(world.births, 8),
      pad(world.count, 7),
    );
    if (!warned && (c.sa === 0 || c.ma === 0 || c.gr === 0 || world.count > CAP * 0.95)) {
      console.log("  ⚠ a population hit 0 or the world is near CAPACITY — the balance is broken; tune reef.json back toward the defaults.");
      warned = true;
    }
  }
  const t0 = performance.now();
  step(world, grid, resource, DT);
  stepMs += performance.now() - t0;
}

console.log(`\n${totalTicks} ticks · avg step ${(stepMs / totalTicks).toFixed(2)} ms · final count ${world.count}`);
