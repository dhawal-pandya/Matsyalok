# Calibration — tuning Matsyalok against real biology

How we keep the simulation's numbers honest: where each tunable comes from in the
animal-behaviour literature, how our current values compare, and where the
populations themselves are controlled.

> This is a **living reference**, updated as phases add new tunables (perception,
> energy, abilities). It pairs with the locked decisions in
> [../CLAUDE.md](../CLAUDE.md) and the per-phase notes in [USAGE.md](USAGE.md).

---

## The principle: think in body lengths, not pixels

Biology reports everything **relative to body size** — distances in **body
lengths (BL)** and speeds in **body-lengths-per-second (BL/s)**. That makes the
numbers dimensionless and directly checkable against papers.

In our code, one body length ≈ `size × 3` px (the render length in
[../src/render/fish.ts](../src/render/fish.ts)), so a mid prey (`size ≈ 6.7`) is
**~20 px / BL**. Convert any pixel constant by dividing by that.

> **Recommended refactor (deferred):** express the steering/perception constants
> in BL and BL/s with one `PX_PER_BL` scale, so the sim is self-documenting and
> every value is literature-checkable. Planned to fold into the Phase 2 work.

---

## Parameter ↔ nature map

| Quantity | In nature | Our value (Phase 1) | Verdict |
| --- | --- | --- | --- |
| Nearest-neighbour distance | 0.3–3 BL, usually **0.5–1 BL** | sep target ~1.3 BL; measured NND ~0.9 BL | ✅ on target |
| School polarization ρ | tight schools **0.8–0.97** | **0.83** measured | ✅ realistic |
| Cruise speed | **~2–5 BL/s** (small fish) | prey ~4–5 BL/s | ✅ good cruise |
| Burst / escape speed | **~10 BL/s** avg, up to 20+ | dart/lunge burst to ~2× cruise (Phase 4) | ✅ implemented |
| Predator vs prey | predator faster straight-line; **prey more maneuverable** | hunter top-speed > prey; prey `maxForce` > hunter | ✅ correct asymmetry |
| Escape latency | C-start **5–20 ms** (Mauthner reflex) | reacts in ~1 tick (17 ms) | ✅ ~realistic |
| Perception | vision long-range (many BL); **lateral line ~1–2 BL** omni | vision cone ~5 BL + lateral line ~1.8 BL (Phase 2) | ✅ split & realistic |
| Field of view | teleosts **~330–340°** total, small **rear blind spot** | prey FOV 300° (wide), hunter 180° (forward) | ✅ implemented (D12 ambush) |
| Predator response | bait-ball, **fountain, flash expansion, vacuole** | flee + void; bearing-aware flee now possible | ◑ partial (richer in Phase 4) |

**Headline:** once converted to body lengths, the Phase 1 values are already
biologically sane — NND ~0.9 BL, polarization 0.83, and the *correct* predator/
prey trade-off (hunters win top speed, prey win agility). The remaining gaps are
exactly what the roadmap schedules next.

### What the gaps imply
- **Burst speed** — real fish cruise at 2–5 BL/s and *burst* to 10–20 BL/s only
  briefly. So `maxSpeed` should stay at cruise; the **dart/lunge abilities
  (Phase 4)** supply the burst. Don't raise `maxSpeed` to fix evasion.
- **Split perception (Phase 2)** — a long **vision cone** (~5–10 BL, ~330° FOV)
  plus a short **lateral line** (~1.5 BL, omnidirectional), with the rear blind
  spot that makes ambush emergent (D12). The lateral-line range maps almost
  exactly to the literature's "within a few body lengths."
- **Fountain / flash maneuvers** become possible once prey sense the predator's
  *bearing* (Phase 2): they flee at the characteristic constant angle past the
  rear limit of their visual field.

---

## Where populations are controlled

Populations are **dynamic** as of Phase 3 — you *tune* them, you don't set them.
The initial counts are just seeds; energy, reproduction, and predation drive the
rest (emergent Lotka–Volterra, verified to oscillate without collapse).

| Control | Location | Notes |
| --- | --- | --- |
| Master dial | [../src/main.ts](../src/main.ts) — `RES_REGROW`, `RES_MAX` | resource regrowth = ecosystem carrying capacity (D9) |
| Breeding / predation | [../src/sim/lifecycle.ts](../src/sim/lifecycle.ts) — `Ecology.*` | metabolic cost, energy per kill, repro + digestion cooldowns |
| r/K strategy, seed counts | [../src/scenarios/predatorPrey.ts](../src/scenarios/predatorPrey.ts) — `reproThreshold`, `energy`, `prey`/`hunters` | prey breed cheap & fast, hunters dear & slow |
| Who-eats-whom | [../src/sim/relate.ts](../src/sim/relate.ts) — `EAT_RATIO` | the size threshold defining the food web |
| Hard cap | [../src/main.ts](../src/main.ts) — `CAPACITY = 8192` | SoA size; nothing spawns past it |

The balance that works today: prey are r-strategists (low `reproThreshold`, fast
grazing) and hunters are K-strategists (high threshold, **digestion-limited
predation**) over a generous resource — so prey out-breed predation and the web
oscillates instead of collapsing. All of this becomes live sliders in Phase 6.

---

## Sources

- [Shoaling & schooling — Wikipedia](https://en.wikipedia.org/wiki/Shoaling_and_schooling) (NND, polarization)
- [Individual behavior & emergent properties of fish schools (MEPS)](https://www.int-res.com/articles/meps2004/273/m273p239.pdf) (NND 0.3–3 BL)
- [Escape responses of fish: a review (J. Exp. Biol.)](https://journals.biologists.com/jeb/article/222/18/jeb166009/223422/Escape-responses-of-fish-a-review-of-the-diversity) (C-start 5–20 ms)
- [Vision & lateral line for schooling in giant danios (J. Exp. Biol.)](https://journals.biologists.com/jeb/article/227/10/jeb246887/352207/The-role-of-vision-and-lateral-line-sensing-for)
- [Fish swimming: speed limits & endurance (Rev. Fish Biol. Fisheries)](https://link.springer.com/article/10.1007/BF00042660) (burst ~10 BL/s)
- [Predator evasion & the fountain effect (Marine Biology)](https://link.springer.com/content/pdf/10.1007/BF00397579.pdf)
- [Bait ball — Wikipedia](https://en.wikipedia.org/wiki/Bait_ball) (compaction tactics)
