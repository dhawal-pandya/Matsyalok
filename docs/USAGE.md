# Using Matsyalok

How to run it, what you can do in it, and what to tune. This is a **living
document**: it is updated at the end of **every phase** alongside
[README.md](../README.md) so it always reflects what the build can actually do.
See [CALIBRATION.md](CALIBRATION.md) for how the tunables map to real biology.

> Maintenance rule: when a phase is completed, update (a) the status table in
> README.md, (b) the "Capabilities by phase" and "Controls" sections below, and
> (c) any new tunable parameters. Keep this file honest about the *current* build.

---

## Running

```bash
npm install        # first time only
npm run dev        # http://localhost:5173 — hot reload on save
```

- **Hot reload:** editing CSS/HTML hot-swaps live; editing a `.ts` file triggers
  a fast full-page reload. The sim restarts from its fixed seed each reload, so
  every reload is **reproducible** — ideal for tuning.

Other commands:

| Command | Purpose |
| --- | --- |
| `npm run build` | strict type-check + production bundle → `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run typecheck` | strict `tsc`, no emit |

---

## Capabilities by phase

What you can actually do today, and what each landed phase added.

### Phase 0 — Foundation ✅
- A tank of oriented, tail-animated fish wander over a water background.
- Soft-bounce walls keep them inside; motion is smooth and frame-rate independent.
- **Watch for:** fish point where they swim; tails beat faster when they move
  faster; they bank away from the edges rather than bouncing hard.
- **HUD (top-left):** fish count · FPS · current phase.

### Phase 1 — Relational crowd ✅
- Two species share one tank: a shoal of ~1000 small **prey** and a few bigger
  **hunters**. With no roles hard-coded, three behaviours emerge from `relate()`
  (size comparison) + Reynolds boid steering over a spatial-hash grid:
  - **prey school** — separation + alignment + cohesion with schoolmates
    (measured local polarization ≈ 0.83, i.e. a strongly coherent shoal);
  - **prey flee hunters** — a dominant escape force; prey near a hunter swim
    markedly faster and the shoal opens a void around it;
  - **hunters chase prey** — seek the nearest reachable prey; faster top speed
    than prey, but prey are more agile and juke away.
- **Watch for:** a flowing, polarised shoal; bait-ball bulges and voids where a
  hunter pushes in; the colour/size contrast (teal prey vs larger orange hunters)
  making the trophic roles readable at a glance.
- **HUD:** prey count · hunter count · FPS · phase.
- **Scale:** runs the sim at ~1.3 ms/tick for ~1000 agents — ample headroom
  toward the few-thousand target (D5); the grid is the enabler.

### Phase 2 — Perception & ambush ✅
- Creatures now only react to what they can actually **perceive** (§7.3): a
  forward **vision cone** (long range, limited field of view) plus a short,
  near-omnidirectional **lateral line**. The region behind a creature, outside
  both, is a **blind spot**.
  - **Prey** have side-set eyes — a wide ~300° view with only a small rear blind
    spot — so they spot hunters early from most directions.
  - **Hunters** have forward-facing eyes — a narrower ~180° cone but longer
    sight — better for locking onto a target ahead.
- **Consequence — ambush emerges from geometry:** a hunter that approaches from
  directly behind a prey sits in its blind spot, so the prey *doesn't flee until
  it's nearly too late*. (Measured: a prey turns ~9× harder from a threat it can
  see than from one in its blind spot.) The lateral line is the last-ditch
  near-field warning.
- **Watch for:** prey reacting late to hunters sneaking up from behind; the
  school staying tight because close neighbours are always felt by the lateral
  line regardless of facing.

### Phase 3 — Ecology ✅
- A regrowing **resource field** (soft green blobs) feeds the base of the web.
  Energy flows up: **prey graze** the field; **hunters eat prey**; everyone pays a
  basal + movement metabolic cost; reaching an energy threshold **reproduces**
  (asexual, splits energy); hitting zero energy **starves**.
- Populations are now **dynamic and self-sustaining** — prey (r-strategists) breed
  fast, hunters (K-strategists) breed slowly and can only kill at a digestion-
  limited rate. The result oscillates (emergent Lotka–Volterra): prey boom →
  overgraze + get hunted → dip → recover, with hunters tracking on a lag.
- **Watch for:** grazed-out dark patches regrowing; the shoal thinning when
  hunters thrive then rebounding; the HUD's live **resource %** breathing in
  anti-phase with the prey count.
- **The master dial** is resource regrowth (D9) in `main.ts` — turn it up and the
  whole web booms; down and it thins.

### Phase 4 — Apex intelligence & abilities ✅
- Hunters now run a **strategy brain** instead of plain reflexes (§7.5/§7.8):
  they **spread apart** to pressure the shoal from several sides (rather than
  dogpiling), pick the nearest prey they can see, **pursue with lead** (aim where
  it's going), and commit a **lunge** when close.
- **Abilities** (§7.6) are cooldown-gated burst "verbs" that cost energy and
  briefly exceed cruise speed — matching real fish (burst ≈ 2× cruise):
  - **dart** — prey's evasive burst, fired reflexively when a threat closes in;
  - **lunge** — hunter's attack burst toward a target.
  A short white **motion streak** marks an agent mid-burst.
- **Watch for:** hunters fanning out around a bait-ball and taking turns lunging;
  prey flicking away with a darting streak just as a hunter commits.

### Phase 5 — Possession & control ✅
- **Click any creature** to possess it (a gold ring marks it); the camera eases in
  and follows. Possession just swaps that agent's brain to the `PlayerBrain` — the
  same machinery for prey, hunter, anything (D13). Click it again or **Esc** to let
  go; the AI brain takes back over.
- **Three control schemes** (D14), cycled with **C**:
  - **direct** (default) — **WASD**/arrows as compass directions (top-down movement);
  - **cursor** — the creature steers toward your pointer;
  - **thrust** — arcade: **←/→** (or A/D) turn, **↑** (or W) thrust, inertial.
- **Space** fires the possessed creature's ability (prey *dart*, hunter *lunge*).
  **F** toggles camera follow.
- You remain part of the world: possess a prey and dodge the pack, or possess a
  hunter and run the chase. If your creature is eaten or starves, possession
  releases.

### Phase 6 — Data & instrumentation ✅
- A **Sim ⇄ Data** tab switch (top-right). The Data tab shows live **uPlot** charts
  — prey/hunter **population** and **resource %** over time — sampled every 0.5s
  into ring buffers (§7.11, A7). The sim keeps running underneath.
- **Live tuning sliders** bound straight to the running sim: the **resource
  regrowth master dial (D9)**, graze rate, meat-per-kill, predator digestion, and
  reproduction cooldown. Drag one and the ecosystem responds immediately.
- **Export CSV** dumps the full recorded time series (incl. average energies and
  kill/birth rates) for offline analysis — the replacement for the pandas story.
- The Sim HUD already shows live prey · hunters · resource % · fps.

_Later phases append here as they ship._

---

## Controls

| Input | Action | Available |
| --- | --- | --- |
| click a creature | possess it / release if already possessed | ✅ now |
| mouse move | steer toward pointer (cursor scheme) | ✅ now |
| WASD / arrows | move by compass direction (direct scheme) | ✅ now |
| ←/→ ↑ (or A/D/W) | turn / thrust (thrust scheme) | ✅ now |
| Space | fire the possessed creature's ability | ✅ now |
| C | cycle control scheme (cursor → direct → thrust) | ✅ now |
| F | toggle camera follow | ✅ now |
| Esc | release possession | ✅ now |
| Sim / Data tabs (top-right) | switch between the world and the charts | ✅ now |

---

## Tuning

Parameters that shape behaviour. The key ecology dials are **live sliders** in the
Data tab (A6); the rest are named constants in the files below.

| Where | Knob | Effect |
| --- | --- | --- |
| `sim/brains/reflex.ts` | `W_SEPARATION/ALIGNMENT/COHESION/FLEE/CHASE/WANDER` | relative pull of each boid behaviour |
| `sim/steering.ts` | `WANDER_*` | meander shape/speed of idle swimming |
| `sim/body.ts` | `WALL_MARGIN`, `MIN_SPEED_FRAC` | how early fish turn from walls; idle glide speed |
| `sim/step.ts` | `W_BOUNDS` | strength of wall avoidance |
| `sim/relate.ts` | `EAT_RATIO` | the size threshold that defines who eats whom |
| `sim/lifecycle.ts` | `Ecology.*` (basal/move cost, graze, meat, repro/feed cooldowns) | metabolism, predation rate, breeding speed |
| `sim/abilities.ts` | `DEFS` (dart/lunge: speed/force mult, duration, cooldown, cost) | burst strength and frequency |
| `sim/brains/strategy.ts` | `W_SPREAD`, `W_PURSUE`, `LUNGE_RANGE` | how hunters encircle and commit |
| `sim/resource.ts` / `main.ts` | `RES_REGROW`, `RES_MAX` | **master balance dial (D9)** — ecosystem carrying capacity |
| `scenarios/predatorPrey.ts` | senses, sizes, speeds, counts, `energy`, `reproThreshold` | per-species physique, r/K strategy, population mix |

The **resource-field regrowth rate** (Phase 3) becomes the master balance dial
for the whole ecosystem (D9).

---

## Verifying the sim (headless)

The sim core has no DOM dependencies (D15), so it runs in Node for smoke tests
and (later) unit tests — bundle a script through esbuild and run it:

```bash
node_modules/.bin/esbuild yourtest.ts --bundle --platform=node --format=esm --outfile=/tmp/t.mjs && node /tmp/t.mjs
```
