import { Rng } from "./rng";
import { TAU } from "./math";

/** Visual archetype for a species (read only by render/fish.ts). Drives body
 *  saturation and markings: prey read muted, hunters read bright + striped,
 *  the whale sits calm in between. */
export const FishStyle = { MUTED: 0, VIVID: 1, CALM: 2 } as const;

/** The shared bounded 2D world (A2). Agents are stored struct-of-arrays (D5/§6):
 *  one typed array per field, indexed by agent id — scales to thousands, no GC churn. */
export class World {
  readonly capacity: number;
  count = 0;

  width: number;
  height: number;

  /** Total simulated time (s); drives deterministic animation phase. */
  time = 0;

  /** Index of the player-possessed agent, or -1. Kept valid across compaction. */
  possessed = -1;

  /** Cumulative event counts for instrumentation (§7.11); rates derived by the recorder. */
  kills = 0;
  births = 0;

  /** Kill positions [x,y,...] this frame, for render FX; the renderer drains it. */
  readonly killFx: number[] = [];

  /** Hunger: energy spend/gain, reproduction, and starvation. Off → fixed, immortal
   *  populations. Biting: do hunters actually catch prey? Off + hunger off = herding
   *  (the big fish push the shoal around without consuming it — same engine, §2). */
  ecologyEnabled = true;
  bitingEnabled = true;

  readonly rng: Rng;

  // --- Body: physics (§7.1) -------------------------------------------------
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  /** Facing angle in radians; gives every creature a front/back (D11). */
  readonly heading: Float32Array;
  readonly maxSpeed: Float32Array;
  readonly maxForce: Float32Array;

  // --- Traits ---------------------------------------------------------------
  readonly size: Float32Array;
  /** Species id — same species (and similar size) school together (D6/A8). */
  readonly species: Int32Array;
  /** Grid query radius = max(visionRange, lateralRange); the coarse cull. */
  readonly viewRadius: Float32Array;
  /** Forward vision-cone range (§7.3). */
  readonly visionRange: Float32Array;
  /** cos(½ FOV): in-cone when dot(heading, dirTo) ≥ this. Wide FOV → near -1. */
  readonly fovHalfCos: Float32Array;
  /** Lateral-line range (§7.3): short, near-omni. */
  readonly lateralRange: Float32Array;
  /** Base hue (0..360); per-creature jitter added. */
  readonly hue: Float32Array;
  readonly wanderAngle: Float32Array;
  /** Animation phase offset so tails don't beat in lockstep. */
  readonly phase: Float32Array;

  // --- Ecology (§7.7) -------------------------------------------------------
  readonly energy: Float32Array;
  /** 1 if the agent feeds from the resource field (a grazer/producer). */
  readonly grazes: Uint8Array;
  /** Visual archetype (FishStyle) — render-only; drives colour/markings. */
  readonly style: Uint8Array;
  /** Energy needed to reproduce — low for r-strategist prey, high for predators. */
  readonly reproThreshold: Float32Array;
  /** Seconds until this agent may reproduce again. */
  readonly reproCooldown: Float32Array;
  /** Seconds until a hunter may eat again (digestion) — damps predation rate. */
  readonly feedCooldown: Float32Array;
  /** Marked within a tick; compacted out at the tick's end. */
  readonly dead: Uint8Array;

  // --- Behaviour & abilities (§7.5, §7.6) -----------------------------------
  /** Which brain to run (see brains/kinds.ts). */
  readonly brainKind: Int8Array;
  /** 1 → eats FOOD agents in the carnivory pass (hunters yes, dogs/grazers no). */
  readonly hunts: Uint8Array;
  /** Which ability this agent has (see abilities.ts). */
  readonly abilityKind: Int8Array;
  readonly abilityCooldown: Float32Array;
  /** Remaining duration of the active ability boost. */
  readonly abilityTimer: Float32Array;

  constructor(width: number, height: number, capacity: number, seed = 1) {
    this.width = width;
    this.height = height;
    this.capacity = capacity;
    this.rng = new Rng(seed);

    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.heading = new Float32Array(capacity);
    this.maxSpeed = new Float32Array(capacity);
    this.maxForce = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.species = new Int32Array(capacity);
    this.viewRadius = new Float32Array(capacity);
    this.visionRange = new Float32Array(capacity);
    this.fovHalfCos = new Float32Array(capacity);
    this.lateralRange = new Float32Array(capacity);
    this.hue = new Float32Array(capacity);
    this.wanderAngle = new Float32Array(capacity);
    this.phase = new Float32Array(capacity);
    this.energy = new Float32Array(capacity);
    this.grazes = new Uint8Array(capacity);
    this.style = new Uint8Array(capacity);
    this.reproThreshold = new Float32Array(capacity);
    this.reproCooldown = new Float32Array(capacity);
    this.feedCooldown = new Float32Array(capacity);
    this.dead = new Uint8Array(capacity);
    this.brainKind = new Int8Array(capacity);
    this.hunts = new Uint8Array(capacity);
    this.abilityKind = new Int8Array(capacity);
    this.abilityCooldown = new Float32Array(capacity);
    this.abilityTimer = new Float32Array(capacity);
  }

  /** Allocate one agent and return its id, or -1 if the world is full. */
  spawn(spec: {
    x: number;
    y: number;
    heading?: number;
    speed?: number;
    size: number;
    species: number;
    visionRange: number;
    /** Total field-of-view angle in degrees (e.g. 300 = small rear blind spot). */
    fovDeg: number;
    lateralRange: number;
    maxSpeed: number;
    maxForce: number;
    hue: number;
    energy: number;
    grazes: boolean;
    style?: number;
    reproThreshold: number;
    brainKind: number;
    hunts: boolean;
    abilityKind: number;
  }): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    const heading = spec.heading ?? this.rng.range(0, TAU);
    const speed = spec.speed ?? spec.maxSpeed * 0.5;
    this.x[i] = spec.x;
    this.y[i] = spec.y;
    this.heading[i] = heading;
    this.vx[i] = Math.cos(heading) * speed;
    this.vy[i] = Math.sin(heading) * speed;
    this.maxSpeed[i] = spec.maxSpeed;
    this.maxForce[i] = spec.maxForce;
    this.size[i] = spec.size;
    this.species[i] = spec.species;
    this.visionRange[i] = spec.visionRange;
    this.lateralRange[i] = spec.lateralRange;
    this.fovHalfCos[i] = Math.cos((spec.fovDeg * 0.5 * Math.PI) / 180);
    this.viewRadius[i] = Math.max(spec.visionRange, spec.lateralRange);
    this.hue[i] = spec.hue;
    this.wanderAngle[i] = this.rng.range(0, TAU);
    this.phase[i] = this.rng.range(0, TAU);
    this.energy[i] = spec.energy;
    this.grazes[i] = spec.grazes ? 1 : 0;
    this.style[i] = spec.style ?? FishStyle.MUTED;
    this.reproThreshold[i] = spec.reproThreshold;
    this.reproCooldown[i] = 0;
    this.feedCooldown[i] = 0;
    this.dead[i] = 0;
    this.brainKind[i] = spec.brainKind;
    this.hunts[i] = spec.hunts ? 1 : 0;
    this.abilityKind[i] = spec.abilityKind;
    this.abilityCooldown[i] = 0;
    this.abilityTimer[i] = 0;
    return i;
  }

  /** Spawn a child inheriting the parent's traits (asexual reproduction, D10). */
  spawnLike(parent: number, x: number, y: number, energy: number): number {
    if (this.count >= this.capacity) return -1;
    const i = this.count++;
    const heading = this.rng.range(0, TAU);
    this.x[i] = x;
    this.y[i] = y;
    this.heading[i] = heading;
    this.vx[i] = Math.cos(heading) * this.maxSpeed[parent] * 0.4;
    this.vy[i] = Math.sin(heading) * this.maxSpeed[parent] * 0.4;
    this.maxSpeed[i] = this.maxSpeed[parent];
    this.maxForce[i] = this.maxForce[parent];
    this.size[i] = this.size[parent];
    this.species[i] = this.species[parent];
    this.visionRange[i] = this.visionRange[parent];
    this.fovHalfCos[i] = this.fovHalfCos[parent];
    this.lateralRange[i] = this.lateralRange[parent];
    this.viewRadius[i] = this.viewRadius[parent];
    this.hue[i] = this.hue[parent];
    this.wanderAngle[i] = this.rng.range(0, TAU);
    this.phase[i] = this.rng.range(0, TAU);
    this.energy[i] = energy;
    this.grazes[i] = this.grazes[parent];
    this.style[i] = this.style[parent];
    this.reproThreshold[i] = this.reproThreshold[parent];
    this.reproCooldown[i] = 0;
    this.feedCooldown[i] = 0;
    this.dead[i] = 0;
    this.brainKind[i] = this.brainKind[parent];
    this.hunts[i] = this.hunts[parent];
    this.abilityKind[i] = this.abilityKind[parent];
    this.abilityCooldown[i] = 0;
    this.abilityTimer[i] = 0;
    return i;
  }

  /** Remove all agents flagged `dead`, compacting survivors to the front and
   *  keeping `possessed` pointing at the right agent (or -1 if it died). */
  compact(): void {
    let w = 0;
    for (let r = 0; r < this.count; r++) {
      if (this.dead[r]) {
        if (r === this.possessed) this.possessed = -1;
        continue;
      }
      if (w !== r) {
        this.copyAgent(r, w);
        if (r === this.possessed) this.possessed = w;
      }
      w++;
    }
    this.count = w;
  }

  private copyAgent(src: number, dst: number): void {
    this.x[dst] = this.x[src];
    this.y[dst] = this.y[src];
    this.vx[dst] = this.vx[src];
    this.vy[dst] = this.vy[src];
    this.heading[dst] = this.heading[src];
    this.maxSpeed[dst] = this.maxSpeed[src];
    this.maxForce[dst] = this.maxForce[src];
    this.size[dst] = this.size[src];
    this.species[dst] = this.species[src];
    this.viewRadius[dst] = this.viewRadius[src];
    this.visionRange[dst] = this.visionRange[src];
    this.fovHalfCos[dst] = this.fovHalfCos[src];
    this.lateralRange[dst] = this.lateralRange[src];
    this.hue[dst] = this.hue[src];
    this.wanderAngle[dst] = this.wanderAngle[src];
    this.phase[dst] = this.phase[src];
    this.energy[dst] = this.energy[src];
    this.grazes[dst] = this.grazes[src];
    this.style[dst] = this.style[src];
    this.reproThreshold[dst] = this.reproThreshold[src];
    this.reproCooldown[dst] = this.reproCooldown[src];
    this.feedCooldown[dst] = this.feedCooldown[src];
    this.brainKind[dst] = this.brainKind[src];
    this.hunts[dst] = this.hunts[src];
    this.abilityKind[dst] = this.abilityKind[src];
    this.abilityCooldown[dst] = this.abilityCooldown[src];
    this.abilityTimer[dst] = this.abilityTimer[src];
    this.dead[dst] = 0;
  }
}
