import uPlot from "uplot";
import type { DataRecorder } from "../data/recorder";

/** uPlot population/resource charts for the Data tab (§7.11). Reads recorder
 *  columns; never touches the sim. */

const HEIGHT = 200;
const COL = {
  prey: "#5fd0e6",
  hunter: "#56c6a8",
  whale: "#7aa6ff",
  resource: "#69d49a",
};

function darkAxis(): uPlot.Axis {
  return {
    stroke: "#8fa8bd",
    grid: { stroke: "rgba(150,180,210,0.10)", width: 1 },
    ticks: { stroke: "rgba(150,180,210,0.18)", width: 1 },
    font: "11px ui-monospace, monospace",
  };
}

function make(
  container: HTMLElement,
  title: string,
  width: number,
  series: uPlot.Series[],
): uPlot {
  const opts: uPlot.Options = {
    title,
    width,
    height: HEIGHT,
    scales: { x: { time: false } },
    axes: [darkAxis(), darkAxis()],
    series,
    legend: { live: true },
  };
  return new uPlot(
    opts,
    [[], ...series.slice(1).map(() => [])] as uPlot.AlignedData,
    container,
  );
}

export class Charts {
  private readonly pop: uPlot;
  private readonly eco: uPlot;

  constructor(container: HTMLElement, width: number) {
    this.pop = make(container, "population", width, [
      {},
      { label: "prey", stroke: COL.prey, width: 2 },
      { label: "hunters", stroke: COL.hunter, width: 2 },
      { label: "whales", stroke: COL.whale, width: 2 },
    ]);
    this.eco = make(container, "resource %", width, [
      {},
      { label: "resource %", stroke: COL.resource, width: 2 },
    ]);
  }

  update(rec: DataRecorder): void {
    const t = rec.column("t");
    this.pop.setData([
      t,
      rec.column("prey"),
      rec.column("hunter"),
      rec.column("whale"),
    ]);
    this.eco.setData([t, rec.column("resource")]);
    // Pin the live legend to the latest sample so values show without hovering.
    const idx = t.length - 1;
    if (idx >= 0) {
      this.pop.setLegend({ idx });
      this.eco.setLegend({ idx });
    }
  }

  resize(width: number): void {
    this.pop.setSize({ width, height: HEIGHT });
    this.eco.setSize({ width, height: HEIGHT });
  }
}
