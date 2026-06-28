export type Tab = "sim" | "data";

/** Sim ⇄ Data tab switch (§7.11, D2 — plain DOM). Toggles the data panel; the sim
 *  keeps running underneath either way. */
export class Tabs {
  active: Tab = "sim";

  constructor(
    bar: HTMLElement,
    private readonly dataPanel: HTMLElement,
    private readonly onChange: (tab: Tab) => void,
  ) {
    const mk = (tab: Tab, label: string) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.className = "tab" + (tab === this.active ? " active" : "");
      b.addEventListener("click", () => this.select(tab, bar));
      bar.appendChild(b);
      return b;
    };
    mk("sim", "Sim");
    mk("data", "Data");
  }

  private select(tab: Tab, bar: HTMLElement): void {
    if (tab === this.active) return;
    this.active = tab;
    for (const b of Array.from(bar.children)) b.classList.remove("active");
    const i = tab === "sim" ? 0 : 1;
    bar.children[i]?.classList.add("active");
    this.dataPanel.classList.toggle("hidden", tab !== "data");
    this.onChange(tab);
  }
}
