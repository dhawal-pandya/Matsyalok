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
    toggle("Biting — hunters catch prey", () => settings.biting, (v) => {
      settings.biting = v;
      apply();
    }),
  );
  container.appendChild(
    toggle("Hunger — energy, breeding & starvation", () => settings.hunger, (v) => {
      settings.hunger = v;
      apply();
    }),
  );
}

export function buildControls(container: HTMLElement, resource: ResourceField): void {
  const knobs: Knob[] = [
    { label: "resource regrow (master dial · D9)", min: 0, max: 12, step: 0.1, get: () => resource.regrowRate, set: (v) => (resource.regrowRate = v) },
    { label: "graze rate", min: 0, max: 14, step: 0.5, get: () => Ecology.GRAZE_RATE, set: (v) => (Ecology.GRAZE_RATE = v) },
    { label: "meat per kill", min: 0, max: 14, step: 0.5, get: () => Ecology.MEAT, set: (v) => (Ecology.MEAT = v) },
    { label: "predator digestion (s)", min: 0.5, max: 8, step: 0.1, get: () => Ecology.FEED_COOLDOWN, set: (v) => (Ecology.FEED_COOLDOWN = v) },
    { label: "reproduction cooldown (s)", min: 0.5, max: 10, step: 0.1, get: () => Ecology.REPRO_COOLDOWN, set: (v) => (Ecology.REPRO_COOLDOWN = v) },
  ];
  for (const k of knobs) container.appendChild(slider(k));
}
