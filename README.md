# Matsyalok

> *Matsya* (fish) + *Lok* (world/realm) — **"the realm of fish."**

A real-time, agent-based simulation of **emergent collective behaviour** — how
external agents (predators, shepherds, the player) shape disorganised crowds. It
begins as a prey–predator fish simulation and generalises into a full trophic
sandbox spanning krill to apex hunters, with player-possessable creatures at
every level.

The single conceptual commitment: **predator–prey and shepherding are the same
engine observed at different points on the size ladder.**

**The live build is a three-fish reef** — a silvery **sardine** shoal, the quick
**mackerel** that work it, and a brown **grouper** that lurks in the corners and
darts at passing mackerel. Nothing is labelled predator or prey: who-eats-whom is
emergent from `relate()` by size (D6/D17). The whole reef is dialled from a single
data file, [`src/config/reef.json`](src/config/reef.json) (D19).

---
## Quick start

```bash
npm install
npm run dev      # → http://localhost:5173  (hot reload)
```

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | strict type-check + production bundle → `dist/` |
| `npm run preview` | serve the production build |
| `npm run typecheck` | strict `tsc` only |
| `npm run deploy` | build + publish `dist/` to the `gh-pages` branch of `origin` |

---

## Architecture in one breath

`Agent = Body + Brain + Traits`. Relationships are **computed by size**
(`relate(a,b) → FOOD | THREAT | SCHOOLMATE | NEUTRAL`), not stored as roles —
one rule generates the whole food web. The **sim core never imports render or
ui** (testable, headless-runnable), agents live in **struct-of-arrays** for
scale, and everything advances on a **fixed timestep** for deterministic,
seed-reproducible runs.

```
src/
├─ sim/     # headless simulation core (no DOM) — world, grid, relate, steering, brains, step
├─ render/  # Canvas2D drawing — camera, oriented fish, frame compositor
├─ input/   # mouse/keyboard → player intents (Phase 5)
├─ data/    # time-series recorder + CSV export (Phase 6)
├─ config/   # reef.json — the single data dial for species + resource field (D19)
├─ scenarios/, ui/   # modes (reef.ts) + chrome (Phases 6–7)
└─ main.ts  # rAF loop, fixed-timestep accumulator, wiring
```

## Docs

| Doc | What |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | the ROM — vision, locked decisions, architecture, roadmap |
| [docs/USAGE.md](docs/USAGE.md) | how to run it, controls, tuning, capabilities by phase |
| [docs/CALIBRATION.md](docs/CALIBRATION.md) | parameters mapped to real fish biology; where populations are controlled |

## Tech

Vite · TypeScript (strict) · Canvas2D · uPlot (charts, later). No UI framework
on the sim/render path — a 60fps imperative canvas loop should not fight a
framework's re-renders.

## License

Open
