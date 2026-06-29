import { Ecology } from "../sim/lifecycle";
import type { ResourceField } from "../sim/resource";

/** Live sliders bound directly to sim tunables (A6, §7.11). Editing one writes the
 *  parameter object in place, so the running simulation reacts immediately. */
interface Knob {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
}

function slider(k: Knob): HTMLElement {
  const row = document.createElement("label");
  row.className = "ctl";
  const name = document.createElement("span");
  name.className = "ctl-name";
  const val = document.createElement("span");
  val.className = "ctl-val";
  const input = document.createElement("input");
  input.type = "range";
  input.min = String(k.min);
  input.max = String(k.max);
  input.step = String(k.step);
  input.value = String(k.get());

  const render = () => {
    name.textContent = k.label;
    val.textContent = k.get().toFixed(k.step < 1 ? 1 : 0);
  };
  input.addEventListener("input", () => {
    k.set(parseFloat(input.value));
    render();
  });
  render();

  const head = document.createElement("div");
  head.className = "ctl-head";
  head.append(name, val);
  row.append(head, input);
  return row;
}

function toggle(label: string, get: () => boolean, set: (v: boolean) => void): HTMLElement {
  const row = document.createElement("label");
  row.className = "ctl ctl-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = get();
  input.addEventListener("change", () => set(input.checked));
  const name = document.createElement("span");
  name.textContent = label;
  row.append(input, name);
  return row;
}

/** Mode toggles: the single board becomes an ecosystem or a herding sandbox. */
export function buildToggles(
  container: HTMLElement,
  settings: { biting: boolean; hunger: boolean },
  apply: () => void,
): void {
  container.appendChild(
    toggle("Biting · fish catch & eat each other", () => settings.biting, (v) => {
      settings.biting = v;
      apply();
    }),
  );
  container.appendChild(
    toggle("Hunger · energy, breeding & starvation", () => settings.hunger, (v) => {
      settings.hunger = v;
      apply();
    }),
  );
}

export function buildControls(container: HTMLElement, resource: ResourceField): void {
  const knobs: Knob[] = [
    { label: "krill regrow (master dial)", min: 0, max: 14, step: 0.1, get: () => resource.regrowRate, set: (v) => (resource.regrowRate = v) },
    { label: "graze rate", min: 0, max: 14, step: 0.5, get: () => Ecology.GRAZE_RATE, set: (v) => (Ecology.GRAZE_RATE = v) },
    { label: "energy per catch", min: 0, max: 14, step: 0.5, get: () => Ecology.MEAT, set: (v) => (Ecology.MEAT = v) },
    { label: "digestion (s)", min: 0.5, max: 8, step: 0.1, get: () => Ecology.FEED_COOLDOWN, set: (v) => (Ecology.FEED_COOLDOWN = v) },
    { label: "reproduction cooldown (s)", min: 0.5, max: 10, step: 0.1, get: () => Ecology.REPRO_COOLDOWN, set: (v) => (Ecology.REPRO_COOLDOWN = v) },
  ];
  for (const k of knobs) container.appendChild(slider(k));
}

// Sensible upper bounds for the per-fish "how many" sliders (a few × the default).
const COUNT_MAX: Record<string, number> = { sardine: 4000, mackerel: 150, grouper: 16 };
const COUNT_STEP: Record<string, number> = { sardine: 50, mackerel: 5, grouper: 1 };

/** Per-fish starting-count sliders. These take effect on the next Respawn (counts
 *  are a spawn-time choice), writing into the shared `counts` object. */
export function buildCounts(
  container: HTMLElement,
  counts: Record<string, number>,
  species: { id: string; count: number }[],
): void {
  const head = document.createElement("h3");
  head.textContent = "How many of each (respawn to apply)";
  container.appendChild(head);
  for (const s of species) {
    container.appendChild(
      slider({
        label: s.id,
        min: 0,
        max: COUNT_MAX[s.id] ?? s.count * 3,
        step: COUNT_STEP[s.id] ?? 1,
        get: () => counts[s.id] ?? s.count,
        set: (v) => (counts[s.id] = v),
      }),
    );
  }
}
