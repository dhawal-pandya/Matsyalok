# Matsyalok

> *Matsya* (fish) + *Lok* (world/realm) — "the realm of fish."

A real-time, agent-based simulation of **emergent collective behavior** and how
external agents — predators, shepherds, and the player — shape disorganised
crowds. It begins as a prey–predator fish simulation and generalises into a
full trophic sandbox spanning krill to apex hunters, with player-possessable
creatures at every level.

This file is the **ROM of the project**: the durable record of the vision,
decisions, assumptions, architecture, and roadmap. It is written to be detailed
on purpose. Refer back to it; update it when a decision changes; never let the
vision drift silently.

---

## 1. North Star

Build a **steering-behaviour sandbox** in which:

- Crowds (shoals, herds, flocks) move with believable emergent dynamics.
- **External agents** apply pressure to those crowds toward an objective:
  - a **predator** disperses-and-isolates a crowd to feed,
  - a **shepherd** gathers-and-drives a crowd to a goal (a barn),
  - **the player** does either, by possessing a creature.
- A **trophic hierarchy** (krill → fish → bigger fish → apex pack hunters → …
  → human) means every creature is simultaneously predator *and* prey, and a
  full food web emerges from one relational rule.
- The simulation is **observable**: a separate data view shows population,
  energy, and ecology curves over time so the world can be understood and tuned.
- The whole thing is **production-grade polished** — it should look and feel
  like a finished, shareable product, not a prototype.

The single most important conceptual commitment:

> **Predator–prey and shepherding are not separate features. They are the same
> engine observed at different points on the size ladder.** Get the systems
> right and these behaviours arise from the same primitives.

---

## 2. The Core Insight

Three superficially different features collapse into one system:

| Surface feature | What it really is |
| --- | --- |
| Prey fleeing a predator | a crowd being *dispersed/exploited* by an external agent |
| Sheep fleeing a shepherd dog | a crowd being *gathered/corralled* by an external agent |
| Player possessing a creature | an external agent driven by a human instead of an AI |

They share the **same crowd physics** (boids) and the **same "pressure agent"**
the crowd flees from. They differ only in:

1. **The pressure agent's goal** — isolate-and-kill vs cluster-and-deliver.
2. **Who drives the pressure agent** — an AI brain or the player.

This is why the architecture below separates *body*, *brain*, and *relations*.

---

## 3. Locked Decisions

These are settled. Changing one requires a deliberate edit to this file.

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | **Stack: Vite + TypeScript + Canvas2D**, charts via **uPlot** | Tight hot-reload feedback loop (fun to tune); imperative canvas matches the sim; shareable as a URL (no installs). |
| D2 | **No UI framework (no React) for the sim/render path** | A 60fps imperative canvas loop fights framework re-rendering. Plain DOM only for tabs/sliders. |
| D3 | **2D** for the foreseeable future | 3D is a separate, much larger project. 2D bait-balls already look superb. |
| D4 | **Soft-bounce "tank" boundaries** | Looks most like a real tank/field; avoids wrap-around weirdness. |
| D5 | **Scale target: a few thousand agents (~1k–5k)** | Requires a spatial-hash grid (built in from Phase 1). Convincing schools without GPU complexity. |
| D6 | **Roles are relational, not fixed** — `relate(a,b)` by size | One rule generates the entire predator/prey/schoolmate web. A fish is prey to the orca and predator to the krill simultaneously. |
| D7 | **Intelligence is a top-heavy gradient** | Low/mid trophic levels get cheap *reflex* brains; only **apex predators** get the *strategy* layer (coordination, ambush, ability timing). |
| D8 | **Coordinated tactics are an explicit strategy layer**, not assumed-emergent | Local boid rules give reactive crowd dynamics for free; clever pack-hunting / collect-drive herding must be deliberately coded. Shared between orcas and dogs. |
| D9 | **Energy flows up from a resource field** | Sunlight/plankton (water) and grass (land) regrow on a grid; bottom-of-chain grazers feed on it. Regrowth rate is the master balance dial. |
| D10 | **Reproduction is asexual for now** | Energy threshold → spawn offspring, split energy. A `ReproductionStrategy` seam keeps sexual (needs-a-mate) reproduction open for later. |
| D11 | **Creatures render as oriented fish shapes**, not circles | Gives every creature a *front and back* — the geometric basis for directional perception and ambush. |
| D12 | **Directional perception**: forward vision cone + short lateral-line radius | Enables the **blind spot behind**, which makes ambush a real, emergent tactic. |
| D13 | **Any creature is clickable and possessable** | Possession = swap the agent's brain to `PlayerBrain`. Same machinery for krill, fish, orca, dog. |
| D14 | **Player control is switchable**: thrust+turn (arcade) *and* steer-toward-cursor | Different creatures/scenarios suit different schemes. |
| D15 | **The sim core never imports from render/ or ui/** | Keeps it testable, headless-runnable, and lets the data recorder run independent of what's drawn. |
| D16 | **Production-grade polish is a first-class goal**, not an afterthought | See §10. Budget real time for visuals, UX, and perf. |
| D17 | **Species are presented as plain fish, never labelled "predator"/"prey"** | The product shows *different fish* (sardine, mackerel, grouper); who-eats-whom stays implicit and emergent from `relate()` (reinforces D6). Neutral language in UI, help, charts, HUD. |
| D18 | **A sit-and-wait ambush brain** joins reflex/strategy as a third brain | The grouper lurks at a cheap idle (low `basalMult`), stalks big game it senses, commits a long **leap/dart**, prowls to new water when hungry, and returns to a home anchor. It's the "wait" counterpart to the roaming pack (D8) and the lever that holds the mid tier down. |
| D19 | **The reef is data-driven via `src/config/reef.json`** | One JSON is the single dial for every species (size/senses/speed/energy/breeding/colour/count) and the resource field. Scenario code only spawns from it; the app and the headless balance harness read the same file (serves A6). |

---

## 4. Assumptions & Defaults

Working assumptions (cheaper to change than locked decisions, but recorded so
nothing is silently lost):

- **A1** Fixed-timestep simulation, decoupled from render framerate
  (accumulator pattern), so behaviour is deterministic and reproducible.
- **A2** World is a single bounded 2D rectangle; one shared world for all
  trophic levels (predator-prey and shepherding coexist in the same space).
- **A3** Perception/neighbour queries are always routed through the spatial-hash
  grid, then filtered by `relate()` and the vision test.
- **A4** Movement has a cost; idling has a (smaller) basal metabolic cost;
  abilities cost energy. Without this, balance is impossible.
- **A5** "Sandbox first." The default mode does **not** require ecological
  stability. Balanced/challenge presets come later.
- **A6** All tunable parameters are surfaced as live sliders eventually; nothing
  important should be a buried magic number.
- **A7** Data is sampled on a fixed cadence (every N ticks) into ring buffers;
  the data view reads those, and a CSV export is available for offline analysis.
- **A8** Same-species, similar-size creatures school together; the player's
  possessed creature is still part of its species for others' relations.

---

## 5. Tech Stack

- **Build/dev:** Vite + TypeScript (strict mode).
- **Simulation:** pure TypeScript over typed arrays / struct-of-arrays where hot.
- **Rendering:** Canvas2D (imperative). WebGL is a *future* option only if the
  agent count demands it (see §11).
- **Charts:** uPlot (fast, tiny) for the data tab.
- **UI chrome:** plain DOM + CSS for tabs, sliders, HUD.
- **Deploy/share:** static build → Vercel or GitHub Pages → shareable URL.
- **Testing:** unit tests for the headless sim core (`relate`, grid, steering,
  energy/lifecycle math). The sim's independence from render makes this clean.

---

## 6. Architecture Overview

The spine of the entire project:

```
Agent = Body + Brain + Traits
  Body    : pos, vel, heading, maxSpeed, maxForce, radius
  Brain   : produces a steering force this tick (+ may fire an ability)
  Traits  : { size, diet, energy, vision (fov+range), abilities[], species }

relate(a, b)         → by size: FOOD | THREAT | SCHOOLMATE | NEUTRAL  (the web)
Perception           → grid query → vision-cone/lateral-line filter
StrategyLayer        → optional, apex only: coordinated hunt / collect-drive
AbilitySystem        → timed pulses: dart / lunge / bark / bubble-net
ResourceField        → regrowing grid of light/grass; grazers feed
Lifecycle            → energy spend/gain, asexual repro, starve/eaten death
Possession           → click any agent → swap Brain to PlayerBrain
Scenario             → spawn config + win condition + camera + recorded metrics
DataRecorder         → samples per-species metrics → time series
```

Proposed module layout (the **sim/ layer must not import render/ or ui/**, per D15):

```
matsyalok/
├─ src/
│  ├─ sim/
│  │  ├─ body.ts            # physics; shared by all agents
│  │  ├─ world.ts           # agent storage (struct-of-arrays), world bounds
│  │  ├─ grid.ts            # spatial hash for O(1)-ish neighbour queries
│  │  ├─ relate.ts          # size-based FOOD/THREAT/SCHOOLMATE/NEUTRAL rule
│  │  ├─ perception.ts      # vision cone + lateral-line; blind-spot logic
│  │  ├─ steering.ts        # boid forces: separation/alignment/cohesion/flee/seek
│  │  ├─ brains/
│  │  │  ├─ reflex.ts       # reactive: school + flee + chase + dart  (sardine)
│  │  │  ├─ strategy.ts     # roaming pack: spread, target select, lead-pursue, lunge (mackerel)
│  │  │  ├─ ambush.ts       # sit-and-wait: lurk → stalk → long dart → return home (grouper, D18)
│  │  │  └─ player.ts       # reads input → steering + ability
│  │  ├─ abilities.ts       # ability defs, cooldowns, pulse effects
│  │  ├─ resource.ts        # regrowing food field (sunlight/grass)
│  │  ├─ lifecycle.ts       # energy, reproduction (strategy seam), death
│  │  └─ step.ts            # one fixed-timestep tick; orchestrates the above
│  ├─ render/
│  │  ├─ canvas.ts          # frame draw
│  │  ├─ fish.ts            # oriented fish/creature shapes (front/back)
│  │  └─ camera.ts          # pan/zoom; optional follow-possessed
│  ├─ input/                # mouse/keyboard → PlayerBrain intents
│  ├─ data/
│  │  ├─ recorder.ts        # ring-buffer time series, sampling cadence
│  │  └─ export.ts          # CSV download
│  ├─ config/
│  │  └─ reef.json          # the single dial: species + resource field (D19)
│  ├─ scenarios/
│  │  ├─ registry.ts        # the mode switch
│  │  ├─ reef.ts            # spawns the three-fish reef from config/reef.json
│  │  └─ shepherd.ts        # sheep + dogs + barn zone + "all in barn" win
│  ├─ ui/
│  │  ├─ tabs.ts            # Sim ⇄ Data
│  │  ├─ charts.ts          # uPlot population/energy/kills graphs
│  │  ├─ controls.ts        # sliders bound to live sim params
│  │  └─ hud.ts             # possession state, FPS, counts
│  └─ main.ts               # rAF loop, fixed-timestep accumulator, wiring
└─ CLAUDE.md
```

---

## 7. Core Systems (detail)

### 7.1 Agent model — Body + Brain + Traits
Every creature is the same struct. **Body** is physics. **Brain** is swappable
(reflex / strategy / player). **Traits** carry `size`, `diet`, `energy`,
`vision`, `abilities`, `species`. Possession and the intelligence gradient are
both just "which Brain is attached," which is why they cost nothing to vary.

### 7.2 Relational trophic web — `relate(a, b)`
Relationship is computed between two agents from size, not stored as a role:

```
relate(a, b):
  if  b.size < a.size * EAT_RATIO   → FOOD        (chase + eat)
  if  a.size < b.size * EAT_RATIO   → THREAT      (flee)
  if  same species / similar size   → SCHOOLMATE  (cohere/align/separate)
  else                              → NEUTRAL     (ignore)
```

This single rule generates the entire food web. Adding a trophic level = adding
a species with a size. Diet refinements (e.g. obligate herbivore) layer on top.

### 7.3 Perception & ambush
Each creature perceives via a **forward vision cone** (FOV angle + range) plus a
short-range, near-omnidirectional **lateral-line** sense. Creatures only react
to threats/food they can perceive. The region **behind** a creature, outside the
cone and beyond the lateral line, is a **blind spot**. Consequences:
- Prey doesn't flee a predator it can't see → late, sometimes fatal reactions.
- Apex strategy can **maneuver into the target's blind cone before lunging** →
  **ambush emerges from geometry.** This is the whole point of D11/D12.

### 7.4 Steering / boids
Classic Reynolds forces over perceived neighbours: **separation, alignment,
cohesion** (with SCHOOLMATEs), **flee** (from THREATs, high weight), **seek**
(toward FOOD or a goal). Forces are weighted and clamped to `maxForce`; velocity
clamped to `maxSpeed`. All weights are tunable (A6).

### 7.5 Intelligence gradient & strategy layer
- **Reflex brains** (krill, fish): the steering forces above + reflex ability
  use (e.g. dart when a THREAT enters the cone).
- **Strategy brains** (apex: orca, wolf, dog): a thin layer *on top of* steering
  that adds deliberate tactics. Shared encircle-and-drive logic:
  - **Predators:** compress/scatter the shoal, pick the most isolated target
    (straggler), approach via blind spot, lunge.
  - **Shepherds (dogs):** Strömbom-style **collect** (push the furthest stray
    back to the herd) vs **drive** (position behind the herd on the line to the
    barn and push). Multiple dogs spread on an arc and split duties.
  - Same algorithm family — goal differs: *disperse/isolate* vs *gather/deliver*.

### 7.6 Abilities (the "verbs")
A Brain outputs *steering force + optionally fires an ability*. Abilities are
cooldown-gated pulses; AI fires them by policy, the player by keypress:

| Ability | Effect | Typical owner |
| --- | --- | --- |
| `dart` | short burst of speed/force (evasion) | krill, sardine |
| `lunge` | speed/force burst toward a target | mackerel, orca, tuna |
| `leap` | long, explosive dart (speed×duration) to run down big game | grouper (ambush, D18) |
| `bark` | temporary boost to flee-radius + repulsion on nearby crowd | dog |
| `bubble-net` | emit a ring of repulsion that compresses a shoal | orca |

`bark` and `bubble-net` are the **same primitive** (a repulsion pulse) — the
recurring theme of the project: one mechanic reused across the hierarchy.

### 7.7 Energy, resource field, lifecycle, reproduction
- **Resource field:** a low-res grid of a regrowing resource (sunlight/plankton
  in water, grass on land). Regrowth rate is the **master balance dial** (D9).
- **Gain:** producers graze the cell they occupy; consumers gain energy by eating
  FOOD agents.
- **Spend:** movement cost ∝ speed; basal metabolic cost while alive; abilities
  cost energy (A4).
- **Reproduce:** energy ≥ threshold → spawn offspring, split energy (asexual,
  D10). Behind a `ReproductionStrategy` interface so sexual reproduction (needs a
  nearby same-species mate) can drop in later.
- **Die:** energy ≤ 0 (starve) or eaten.
Tuned correctly, populations oscillate (emergent Lotka–Volterra) instead of
crashing — visible in the data tab.

### 7.8 Possession & control
- **Click any creature** → swap its Brain to `PlayerBrain`; click again / Esc →
  restore its AI brain. Camera optionally follows.
- **Two control schemes, switchable** (D14): **thrust+turn** (WASD/arrows,
  inertial piloting) and **steer-toward-cursor** (creature seeks the pointer).
- **Ability key** (e.g. Space) fires the possessed creature's ability.
- **Hierarchy of stakes:** possessing different trophic levels yields different
  games — krill (survive), fish (school+evade+graze), orca (pack hunt), dog
  (herd), human (top-level management). All from the same engine.

### 7.9 Scenarios & modes
A `Scenario` declares: what spawns + with which brains, the win/goal condition,
camera setup, and which metrics to record. Switching scenario = `loadScenario()`
into the same loop. Predator-prey and shepherding are scenarios over one shared
world; the orca-scatters-a-shoal behaviour and the dog-herds-sheep behaviour are
the same systems at different size points.

**Current build — the reef (D17/D19).** The live scenario is a three-fish reef,
spawned from `config/reef.json` and presented as *just fish* (no predator/prey
labels); the trophic chain is emergent (`relate()` by size):
- **sardine** — a tiny silvery shoal that grazes the bloom and breeds fast;
- **mackerel** — small, quick; schools (strategy brain) and works the shoal it
  outsizes;
- **grouper** — the brown giant; sit-and-wait ambush brain (D18) that lurks in the
  corners, stalks mackerel it senses, and runs them down with a long dart. It is
  the one check on the mid tier — without it the mid tier just keeps breeding.
On small / touch screens the whole reef is spawned thinner (a count `scale`), for
density and framerate. Balance is dialled live in the Data tab and validated
headlessly by bundling a script that steps the sim and prints per-species counts
(§ "Verifying" in docs/USAGE.md).

### 7.10 Rendering — oriented fish (production polish)
- Each creature drawn as an **oriented shape** (teardrop body + tail) pointed
  along its heading, scaled by size, coloured/styled by species — minimal but
  unmistakably a fish, giving front/back for free.
- Polish targets: smooth motion, subtle tail/body animation (sine over heading),
  size-appropriate detail, readable species silhouettes, depth/parallax cues,
  pleasing water/field background, particle touches (bubbles, dust on a kill).
- **Tail beat** is a phase *accumulated each tick* from the fish's speed (in
  `step`), not derived from absolute time — so it stays smooth as speed fluctuates.
- **Hunger gauge:** the tail fin and eyes read **red when starving** (energy near
  zero, about to die) and shift through to **green as the fish fills toward its
  reproductive split** — an at-a-glance read on every fish's state.
- Camera pan/zoom; follow-possessed mode.

### 7.11 Data & instrumentation
- **Data tab** separate from the sim view.
- **Per-species** population curves; energy distributions; kills/sec; school
  cohesion metric; resource-field totals.
- Live numeric HUD on the sim view (counts, FPS, possession state).
- **CSV export** for offline analysis (replaces the pandas/numpy story we give
  up by choosing web).

---

## 8. Balance Philosophy

Multi-trophic ecosystems are **emergent and fragile** — small parameter errors
collapse the web (mass starvation or population explosion). This is the nature
of ecosystems, not an architecture flaw. Therefore:

- **Sandbox mode (default):** spawn anything, tune live, no stability required.
  Where 90% of play happens.
- **Balanced/challenge mode (later):** tuned presets + win conditions (herd to
  barn, survive N minutes, keep all levels alive).
- The **data tab is the balancing instrument** — watch all trophic levels at once
  and tune (especially resource regrowth, D9) until curves oscillate.

---

## 9. Roadmap — Phases

Each phase ends in something **watchable**, to keep the feedback loop alive.

- **Phase 0 — Foundation**
  Scaffold Vite + TS + Canvas. Fixed-timestep loop (accumulator). World bounds +
  soft-bounce. Oriented fish shapes that wander. *Deliverable: actual fish swim
  on screen.*

- **Phase 1 — Relational crowd**
  `Body`, `relate()` by size, boid steering, spatial-hash grid. Two species that
  **school / flee / chase emergently**, scaled to thousands. *Deliverable: a
  living shoal that reacts to a bigger fish.*

- **Phase 2 — Perception & ambush**
  Vision cones + lateral line + blind spot. Reactions gated by what a creature
  can perceive. *Deliverable: prey that doesn't see it coming.*

- **Phase 3 — Ecology**
  Resource field (sunlight/grass) + grazing; energy spend/gain; asexual
  reproduction (behind the strategy seam); death. *Deliverable: self-sustaining
  populations that rise and fall.*

- **Phase 4 — Apex intelligence & abilities**
  Strategy brain (pack coordination, target selection, encircle-and-drive).
  Ability system (dart/lunge/bark/bubble-net). Ambush via blind spot.
  *Deliverable: coordinated pack hunting that genuinely looks intelligent.*

- **Phase 5 — Possession & control**
  Click-to-possess any creature; switchable thrust+turn / steer-to-cursor;
  ability key; camera follow. *Deliverable: be the fish / be the orca / be the dog.*

- **Phase 6 — Data & instrumentation**
  Data tab with uPlot per-species curves; live HUD; sliders bound to every
  important parameter; CSV export. *Deliverable: see and tune the ecosystem.*

- **Phase 7 — Scenarios & win conditions**
  Scenario registry + mode switch. Shepherding scenario (sheep + dogs + barn +
  "all in barn" win). Predator-prey scenario. Balanced presets.
  *Deliverable: switchable games over one engine.*

- **Phase 8 — Production polish**
  Visual fidelity (animation, backgrounds, particles, silhouettes), UX
  (onboarding, controls discoverability, responsive layout), performance
  (profiling to hold framerate at scale), audio (optional). *Deliverable: feels
  like a finished product; shareable with pride.*

> Polish is **not** confined to Phase 8 — D16 means each phase ships clean,
> readable, well-structured code and a tidy UI. Phase 8 is the dedicated
> elevation pass, not the first time we care.

---

## 10. Production-Grade Polish Bar

What "production-grade" means here, concretely:

- **Visual:** smooth 60fps motion; believable swim animation; readable species
  silhouettes; cohesive art direction (water/field); tasteful particles; no
  programmer-art circles in the shipped build.
- **UX:** discoverable controls; clear possession affordance (hover/selection
  highlight); responsive layout; sensible defaults; non-blocking, legible HUD;
  clean tab switching.
- **Performance:** spatial grid mandatory; struct-of-arrays in hot paths;
  profiled to hold framerate at the scale target (D5); no GC churn in the loop.
- **Code quality:** strict TypeScript; sim core decoupled and unit-tested (D15);
  no buried magic numbers (A6); clear module boundaries per §6.
- **Shareability:** static deploy to a URL; works on mobile browsers; loads fast.

---

## 11. Open Questions & Kept-Open Seams

Deliberately deferred — the architecture leaves room for each:

- **Sexual reproduction** — needs-a-mate logic behind `ReproductionStrategy`
  (D10). Genetics/trait inheritance (size, speed, vision) could follow,
  enabling evolution.
- **More trophic levels** — wolves, larger pelagic hunters, and the **human**
  level (top-of-chain management: command multiple dogs, or fish the shoals).
  The relational web (D6) absorbs these for free; balance is the only cost.
- **3D** — explicitly out of scope now (D3); would be a major undertaking
  (rendering, perception cones, controls all change).
- **WebGL/GPU** — only if the agent count outgrows Canvas2D (beyond D5).
- **Save/share world states** — serialise a scenario + RNG seed + params so a
  configured world can be shared by URL, not just the app.
- **Audio** — ambience and event cues (optional, Phase 8+).
- **Mating-driven herd genetics, disease, migration, day/night resource cycles**
  — further ecological depth, all compatible with the resource-field model (D9).

---

## 12. Glossary

- **Boid** — an agent steered by local separation/alignment/cohesion rules.
- **`relate(a,b)`** — the size-based function returning FOOD/THREAT/SCHOOLMATE/
  NEUTRAL; the source of the entire food web.
- **Reflex brain** — reactive, cheap AI (low/mid trophic levels).
- **Strategy brain** — deliberate, coordinated AI (apex predators only).
- **Pressure agent** — any external agent (predator/shepherd/player) that shapes
  a crowd.
- **Blind spot** — the region outside a creature's vision cone + lateral line;
  the basis of ambush.
- **Resource field** — the regrowing grid of sunlight/grass that feeds the base
  of the food web and acts as the master balance dial.
- **Ability** — a cooldown-gated pulse verb (dart/lunge/bark/bubble-net).
- **Possession** — swapping an agent's brain to `PlayerBrain`.
- **Scenario** — a configuration of spawns + win condition + camera + recorded
  metrics, loaded into the shared engine.
