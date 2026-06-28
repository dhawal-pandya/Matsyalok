# Matsyalok

> *Matsya* (fish) + *Lok* (world/realm) — **"the realm of fish."**

A real-time, agent-based simulation of **emergent collective behaviour** — how
external agents (predators, shepherds, the player) shape disorganised crowds. It
begins as a prey–predator fish simulation and generalises into a full trophic
sandbox spanning krill to apex hunters, with player-possessable creatures at
every level.

The single conceptual commitment: **predator–prey and shepherding are the same
engine observed at different points on the size ladder.**

---

## Status

| Phase | What it adds | State |
| --- | --- | --- |
| 0 — Foundation | Vite+TS+Canvas, fixed-timestep loop, soft-bounce tank, oriented animated fish | ✅ done |
| 1 — Relational crowd | `relate()` by size, boid steering, spatial-hash grid; schooling / fleeing / chasing | ✅ done |
| 2 — Perception & ambush | vision cones + lateral line + blind spot | ✅ done |
| 3 — Ecology | resource field, energy, asexual reproduction, death | ✅ done |
| 4 — Apex intelligence | strategy brains (pack hunt / drive), abilities | ✅ done |
| 5 — Possession | click-to-possess, player control schemes | ✅ done |
| 6 — Data | uPlot per-species charts, HUD, live sliders, CSV export | ✅ done |
| 7 — Scenarios | scenario registry, shepherding + predator-prey, presets | 🚧 next |
| 8 — Production polish | visuals, UX, perf, audio | ⬜ |

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

### Deploy on push

`npm install` points git at the versioned hooks in [`.githooks/`](.githooks). The
`pre-push` hook then **auto-deploys to `gh-pages` whenever `main` is pushed**
(via [`scripts/deploy-gh-pages.sh`](scripts/deploy-gh-pages.sh)). After creating
the GitHub repo and adding the `origin` remote, run `npm install` once to arm the
hook, then enable **Settings → Pages → Deploy from branch → `gh-pages`**.

See **[docs/USAGE.md](docs/USAGE.md)** for controls, tuning, and what you can do in
each phase, and **[docs/CALIBRATION.md](docs/CALIBRATION.md)** for how the
parameters map to real fish biology.

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
├─ scenarios/, ui/   # modes + chrome (Phases 6–7)
└─ main.ts  # rAF loop, fixed-timestep accumulator, wiring
```

**[CLAUDE.md](CLAUDE.md)** is the project's ROM — the durable record of vision,
locked decisions, architecture, and roadmap. Read it before making structural
changes.

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

TBD.
