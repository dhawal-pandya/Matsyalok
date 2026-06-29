import { World } from "./sim/world";
import { Grid } from "./sim/grid";
import { ResourceField } from "./sim/resource";
import { step } from "./sim/step";
import { clamp } from "./sim/math";
import {
  populateReef,
  reefResource,
  reefDefaults,
  SP_MACKEREL,
  SP_GROUPER,
} from "./scenarios/reef";
import { Renderer } from "./render/canvas";
import { Camera } from "./render/camera";
import { PlayerController } from "./input/controller";
import { DataRecorder } from "./data/recorder";
import { downloadCSV } from "./data/export";
import { Charts } from "./ui/charts";
import { buildControls, buildCounts, buildToggles } from "./ui/controls";
import { Tabs } from "./ui/tabs";

/** Entry point: fixed-timestep accumulator loop (A1) wiring sim → render. One shared
 *  board (§2); Biting/Hunger toggles turn the ecosystem into a herding sandbox. */

const DT = 1 / 60;
const MAX_FRAME = 0.25;
const MAX_STEPS = 8;
const CAPACITY = 16384; // headroom for a ~5k shoal plus breeding
const CELL_SIZE = 50;
const RES_CELL = reefResource.cell;
const RES_MAX = reefResource.max;
const RES_REGROW = reefResource.regrow; // master balance dial (D9), set in reef.json
const SAMPLE_SEC = 0.5; // data sampling cadence (A7)
const FOLLOW_ZOOM = 1.7;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const renderer = new Renderer(canvas);
const camera = new Camera();
const grid = new Grid(CAPACITY, CELL_SIZE);
const controller = new PlayerController(canvas, () => world, camera);
const settings = { biting: true, hunger: true };
// Per-fish starting counts (editable in the Data tab; applied on Respawn).
const counts: Record<string, number> = Object.fromEntries(
  reefDefaults.map((s) => [s.id, s.count]),
);

let world: World;
let resource: ResourceField;
let seed = 7;

const recorder = new DataRecorder([
  "t",
  "sardine",
  "mackerel",
  "grouper",
  "resource",
  "sardineEnergy",
  "mackerelEnergy",
  "killsPerSec",
  "birthsPerSec",
]);
let charts: Charts | undefined;
let tabs: Tabs;
let paused = false;
let chartsDirty = false;
let lastKills = 0;
let lastBirths = 0;
let lastSampleT = 0;

function chartWidth(): number {
  // Measure the real container when it's laid out (the data panel is visible);
  // fall back to a window estimate while it's still hidden.
  const el = document.getElementById("charts");
  const w = el?.clientWidth ?? 0;
  return Math.min(720, w > 0 ? w : window.innerWidth - 40);
}

function applySettings(): void {
  world.bitingEnabled = settings.biting;
  world.ecologyEnabled = settings.hunger;
}

function sample(): void {
  let sardine = 0;
  let mackerel = 0;
  let grouper = 0;
  let sardineE = 0;
  let mackerelE = 0;
  for (let i = 0; i < world.count; i++) {
    const s = world.species[i];
    if (s === SP_MACKEREL) {
      mackerel++;
      mackerelE += world.energy[i];
    } else if (s === SP_GROUPER) {
      grouper++;
    } else {
      sardine++;
      sardineE += world.energy[i];
    }
  }
  const resPct =
    (resource.totalBiomass() / (resource.amount.length * resource.max)) * 100;
  const span = world.time - lastSampleT || 1;
  recorder.push([
    world.time,
    sardine,
    mackerel,
    grouper,
    resPct,
    sardine ? sardineE / sardine : 0,
    mackerel ? mackerelE / mackerel : 0,
    (world.kills - lastKills) / span,
    (world.births - lastBirths) / span,
  ]);
  lastKills = world.kills;
  lastBirths = world.births;
  lastSampleT = world.time;
  chartsDirty = true;
}

/** Thin the reef on small / touch screens — fewer fish read better and run
 *  smoother on a phone, where the world is a fraction of a desktop's area. */
function spawnScale(): number {
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 680;
  return coarse || small ? 0.35 : 1;
}

function respawn(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  world = new World(vw, vh, CAPACITY, seed++);
  resource.resize(vw, vh);
  populateReef(world, { scale: spawnScale(), counts });
  applySettings();
  recorder.clear();
  lastKills = 0;
  lastBirths = 0;
  lastSampleT = 0;
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  sample();
  updateHud();
}

function initUI(): void {
  const controlsEl = document.getElementById("controls") as HTMLElement;
  buildToggles(controlsEl, settings, () => world && applySettings());
  buildControls(controlsEl, resource);
  buildCounts(controlsEl, counts, reefDefaults);

  tabs = new Tabs(
    document.getElementById("tabs") as HTMLElement,
    document.getElementById("data") as HTMLElement,
    (tab) => {
      // The floating help button overlaps the data panel's controls — hide it there.
      const help = document.getElementById("help-btn");
      if (help) help.style.display = tab === "data" ? "none" : "";
      if (tab !== "data") return;
      // Build the charts lazily, on first reveal: uPlot can only measure its
      // layout once the panel is actually visible (not display:none).
      if (!charts) {
        charts = new Charts(
          document.getElementById("charts") as HTMLElement,
          chartWidth(),
        );
      } else {
        charts.resize(chartWidth());
      }
      charts.update(recorder);
    },
  );

  const exportBtn = document.getElementById("export") as HTMLElement;
  exportBtn.addEventListener("click", () =>
    downloadCSV(`matsyalok-${Date.now()}.csv`, recorder.toCSV()),
  );

  const respawnBtn = document.createElement("button");
  respawnBtn.id = "respawn";
  respawnBtn.textContent = "Respawn ↻";
  respawnBtn.addEventListener("click", respawn);
  exportBtn.insertAdjacentElement("afterend", respawnBtn);

  // Welcome / help overlay (shown on load, reopened by the ? button; click to close).
  const overlay = document.getElementById("overlay") as HTMLElement;
  overlay.addEventListener("click", () => overlay.classList.add("hidden"));
  // Let the credit link open without the overlay's click-to-close swallowing it.
  overlay
    .querySelector(".credit a")
    ?.addEventListener("click", (e) => e.stopPropagation());
  (document.getElementById("help-btn") as HTMLElement).addEventListener(
    "click",
    () => overlay.classList.remove("hidden"),
  );

  // Pause with P.
  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "p") paused = !paused;
  });
}

function onResize(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  renderer.resize(vw, vh);
  world.width = vw;
  world.height = vh;
  resource.resize(vw, vh);
  charts?.resize(chartWidth());
}

let frames = 0;
let fpsAccum = 0;
let fps = 0;

function modeName(): string {
  if (settings.biting && settings.hunger) return "ecosystem";
  if (!settings.biting && !settings.hunger) return "herding";
  return "custom";
}

function updateHud(): void {
  let sardine = 0;
  let mackerel = 0;
  let grouper = 0;
  for (let i = 0; i < world.count; i++) {
    const s = world.species[i];
    if (s === SP_MACKEREL) mackerel++;
    else if (s === SP_GROUPER) grouper++;
    else sardine++;
  }
  const res = Math.round(
    (resource.totalBiomass() / (resource.amount.length * resource.max)) * 100,
  );
  hud.innerHTML =
    `${modeName()} · ${sardine} sardine · ${mackerel} mackerel` +
    (grouper > 0 ? ` · ${grouper} grouper` : "") +
    ` · ${res}% · ${fps} fps`;
}

function updateCamera(): void {
  const p = world.possessed;
  const targetZoom = p >= 0 && controller.follow ? FOLLOW_ZOOM : 1;
  camera.zoom += (targetZoom - camera.zoom) * 0.1;

  let tx = 0;
  let ty = 0;
  if (p >= 0 && controller.follow) {
    tx = world.x[p] - renderer.viewW / (2 * camera.zoom);
    ty = world.y[p] - renderer.viewH / (2 * camera.zoom);
  }
  tx = clamp(tx, 0, Math.max(0, world.width - renderer.viewW / camera.zoom));
  ty = clamp(ty, 0, Math.max(0, world.height - renderer.viewH / camera.zoom));
  camera.x += (tx - camera.x) * 0.12;
  camera.y += (ty - camera.y) * 0.12;
}

let last = performance.now();
let acc = 0;

function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;

  const intent = controller.update(Math.min(dt, DT * MAX_STEPS));

  if (!paused) {
    acc += dt;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS) {
      step(world, grid, resource, DT, intent);
      acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    if (world.time - lastSampleT >= SAMPLE_SEC) sample();
  }

  // Drain kill positions into the renderer's particle system.
  const fx = world.killFx;
  for (let k = 0; k < fx.length; k += 2) renderer.spawnKill(fx[k], fx[k + 1]);
  fx.length = 0;

  if (tabs.active === "sim") {
    updateCamera();
    const hovered = world.possessed < 0 ? controller.hovered(world) : -1;
    renderer.draw(world, camera, resource, world.possessed, hovered, dt);
  } else if (chartsDirty && charts) {
    charts.update(recorder);
    chartsDirty = false;
  }

  frames++;
  fpsAccum += dt;
  if (fpsAccum >= 0.5) {
    fps = Math.round(frames / fpsAccum);
    frames = 0;
    fpsAccum = 0;
    updateHud();
  }

  requestAnimationFrame(frame);
}

renderer.resize(window.innerWidth, window.innerHeight);
resource = new ResourceField(
  window.innerWidth,
  window.innerHeight,
  RES_CELL,
  RES_MAX,
  RES_REGROW,
);
initUI();
respawn();
window.addEventListener("resize", onResize);
requestAnimationFrame(frame);
