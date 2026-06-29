import { World } from "./src/sim/world.ts";
import { Grid } from "./src/sim/grid.ts";
import { ResourceField } from "./src/sim/resource.ts";
import { step } from "./src/sim/step.ts";
import { populateReef, reefResource, SP_MACKEREL, SP_GROUPER } from "./src/scenarios/reef.ts";

const W = 1600, H = 900;
const CAP = 16384;
const DT = 1 / 60;

const world = new World(W, H, CAP, 7);
const resource = new ResourceField(W, H, reefResource.cell, reefResource.max, reefResource.regrow);
const grid = new Grid(CAP, 50);
populateReef(world);

function counts() {
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

const minutes = Number(process.argv[2] ?? 6);
const totalTicks = Math.round(minutes * 60 / DT);
const sampleEvery = Math.round(15 / DT); // every 15 sim-seconds
let tickStart = performance.now();
let stepMs = 0;
console.log("t(s)  sardine mackerel grouper res%  kills  births");
for (let tick = 0; tick <= totalTicks; tick++) {
  if (tick % sampleEvery === 0) {
    const c = counts();
    const t = Math.round(world.time);
    console.log(
      String(t).padStart(4),
      String(c.sa).padStart(8),
      String(c.ma).padStart(8),
      String(c.gr).padStart(7),
      String(c.res).padStart(4),
      String(world.kills).padStart(6),
      String(world.births).padStart(7),
    );
  }
  const t0 = performance.now();
  step(world, grid, resource, DT);
  stepMs += performance.now() - t0;
}
const wall = (performance.now() - tickStart) / 1000;
console.log(`\n${totalTicks} ticks in ${wall.toFixed(1)}s wall · avg step ${(stepMs / totalTicks).toFixed(2)}ms · final count ${world.count}`);
