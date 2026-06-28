import "uplot/dist/uPlot.min.css";
import { World } from "./sim/world";
import { Grid } from "./sim/grid";
import { ResourceField } from "./sim/resource";
import { step } from "./sim/step";
import { clamp } from "./sim/math";
import { populatePredatorPrey, SP_HUNTER, SP_WHALE } from "./scenarios/predatorPrey";
import { Renderer } from "./render/canvas";
import { Camera } from "./render/camera";
import { PlayerController } from "./input/controller";
import { DataRecorder } from "./data/recorder";
import { downloadCSV } from "./data/export";
import { Charts } from "./ui/charts";
import { buildControls, buildToggles } from "./ui/controls";
import { Tabs } from "./ui/tabs";

/** Entry point: fixed-timestep accumulator loop (A1) wiring sim → render. One shared
 *  board (§2); Biting/Hunger toggles turn the ecosystem into a herding sandbox. */

const DT = 1 / 60;
const MAX_FRAME = 0.25;
const MAX_STEPS = 8;
const CAPACITY = 8192;
const CELL_SIZE = 50;
const RES_CELL = 32;
const RES_MAX = 14;
const RES_REGROW = 4.5; // master balance dial (D9)
const SAMPLE_SEC = 0.5; // data sampling cadence (A7)
const FOLLOW_ZOOM = 1.7;

const canvas = document.getElementById("scene") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const renderer = new Renderer(canvas);
const camera = new Camera();
const grid = new Grid(CAPACITY, CELL_SIZE);
const controller = new PlayerController(canvas, () => world, camera);
const settings = { biting: true, hunger: true };

let world: World;
let resource: ResourceField;
let seed = 7;

const recorder = new DataRecorder([
  "t", "prey", "hunter", "whale", "resource", "preyEnergy", "hunterEnergy", "killsPerSec", "birthsPerSec",
]);
let charts: Charts;
let tabs: Tabs;
let paused = false;
let chartsDirty = false;
let lastKills = 0;
let lastBirths = 0;
let lastSampleT = 0;

function chartWidth(): number {
  return Math.min(720, window.innerWidth - 60);
}

function applySettings(): void {
  world.bitingEnabled = settings.biting;
  world.ecologyEnabled = settings.hunger;
}

function sample(): void {
  let prey = 0;
  let hunter = 0;
  let whale = 0;
  let preyE = 0;
  let hunterE = 0;
  for (let i = 0; i < world.count; i++) {
    const s = world.species[i];
    if (s === SP_HUNTER) {
      hunter++;
      hunterE += world.energy[i];
    } else if (s === SP_WHALE) {
      whale++;
    } else {
      prey++;
      preyE += world.energy[i];
    }
  }
  const resPct = (resource.totalBiomass() / (resource.amount.length * resource.max)) * 100;
  const span = world.time - lastSampleT || 1;
  recorder.push([
    world.time, prey, hunter, whale, resPct,
    prey ? preyE / prey : 0,
    hunter ? hunterE / hunter : 0,
    (world.kills - lastKills) / span,
    (world.births - lastBirths) / span,
  ]);
  lastKills = world.kills;
  lastBirths = world.births;
  lastSampleT = world.time;
  chartsDirty = true;
}

function respawn(): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  world = new World(vw, vh, CAPACITY, seed++);
  resource.resize(vw, vh);
  populatePredatorPrey(world);
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

  charts = new Charts(document.getElementById("charts") as HTMLElement, chartWidth());
  tabs = new Tabs(
    document.getElementById("tabs") as HTMLElement,
    document.getElementById("data") as HTMLElement,
    (tab) => {
      if (tab === "data") {
        charts.resize(chartWidth());
        charts.update(recorder);
      }
    },
  );

  const exportBtn = document.getElementById("export") as HTMLElement;
  exportBtn.addEventListener("click", () => downloadCSV(`matsyalok-${Date.now()}.csv`, recorder.toCSV()));

  const respawnBtn = document.createElement("button");
  respawnBtn.id = "respawn";
  respawnBtn.textContent = "Respawn ↻";
  respawnBtn.addEventListener("click", respawn);
  exportBtn.insertAdjacentElement("afterend", respawnBtn);

  // Welcome / help overlay (shown on load, reopened by the ? button; click to close).
  const overlay = document.getElementById("overlay") as HTMLElement;
  overlay.addEventListener("click", () => overlay.classList.add("hidden"));
  (document.getElementById("help-btn") as HTMLElement).addEventListener("click", () =>
    overlay.classList.remove("hidden"),
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
  let prey = 0;
  let hunter = 0;
  let whale = 0;
  for (let i = 0; i < world.count; i++) {
    const s = world.species[i];
    if (s === SP_HUNTER) hunter++;
    else if (s === SP_WHALE) whale++;
    else prey++;
  }
  const res = Math.round((resource.totalBiomass() / (resource.amount.length * resource.max)) * 100);
  hud.innerHTML = `${modeName()} · ${prey} prey · ${hunter} hunters · ${whale} whales · ${res}% · ${fps} fps`;
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
  } else if (chartsDirty) {
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
resource = new ResourceField(window.innerWidth, window.innerHeight, RES_CELL, RES_MAX, RES_REGROW);
initUI();
respawn();
window.addEventListener("resize", onResize);
requestAnimationFrame(frame);
