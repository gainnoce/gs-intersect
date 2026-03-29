"use client";

import dynamic from "next/dynamic";
import type { DesignResult } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
}

export function UtilityChart({ results, optimal_IA, optimal_FA }: Props) {
  const eventsIA = results.map((r) => r.events_IA);
  const eventsFA = results.map((r) => r.events_FA);
  const utilityIA = results.map((r) => r.utility_IA);
  const utilityFA = results.map((r) => r.utility_FA);
  const power = results.map((r) => `${r.power}%`);

  const commonAxis = {
    gridcolor: "#ebefee",
    linecolor: "#9db0ac",
    tickfont: { color: "#9db0ac", size: 11 },
    titlefont: { color: "#3f4444", size: 12 },
    zerolinecolor: "#ebefee",
  };

  const data: Plotly.Data[] = [
    {
      x: eventsIA,
      y: utilityIA,
      type: "scatter",
      mode: "lines+markers",
      name: "Interim Analysis",
      text: power,
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>",
      line: { color: "#6366f1", width: 2.5 },
      marker: { color: "#6366f1", size: 7 },
    },
    {
      x: [optimal_IA.events_IA],
      y: [optimal_IA.utility_IA],
      type: "scatter",
      mode: "markers",
      name: `Optimal IA (${optimal_IA.power}%)`,
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>`,
      marker: { color: "#f43f5e", size: 15, symbol: "star" },
    },
    {
      x: eventsFA,
      y: utilityFA,
      type: "scatter",
      mode: "lines+markers",
      name: "Final Analysis",
      text: power,
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>",
      line: { color: "#10b981", width: 2.5, dash: "dot" },
      marker: { color: "#10b981", size: 7 },
    },
    {
      x: [optimal_FA.events_FA],
      y: [optimal_FA.utility_FA],
      type: "scatter",
      mode: "markers",
      name: `Optimal FA (${optimal_FA.power}%)`,
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>`,
      marker: { color: "#f97316", size: 15, symbol: "star" },
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "#f8faf9",
    font: { family: "Inter, sans-serif", color: "#3f4444" },
    xaxis: { ...commonAxis, title: { text: "Number of Events" } },
    yaxis: { ...commonAxis, title: { text: "Utility Score  [ LR(+) × (1 − CV) ]" } },
    legend: {
      font: { color: "#3f4444", size: 11 },
      bgcolor: "rgba(255,255,255,0.8)",
      bordercolor: "#ebefee",
      borderwidth: 1,
    },
    margin: { t: 20, r: 20, b: 50, l: 65 },
    hovermode: "closest",
  };

  return (
    <Plot
      data={data}
      layout={layout}
      config={{
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
        responsive: true,
        toImageButtonOptions: { format: "png", filename: "gs-intersect-chart", scale: 2 },
      }}
      style={{ width: "100%", height: "380px" }}
    />
  );
}
