"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { DesignResult } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
}

const TRACES = [
  { key: "ia",     label: "Interim Analysis",         color: "#6366f1", dash: false, star: false },
  { key: "opt_ia", label: (p: number) => `Optimal IA (${p}%)`, color: "#f43f5e", dash: false, star: true  },
  { key: "fa",     label: "Final Analysis",            color: "#10b981", dash: true,  star: false },
  { key: "opt_fa", label: (p: number) => `Optimal FA (${p}%)`, color: "#f97316", dash: true,  star: true  },
] as const;

export function UtilityChart({ results, optimal_IA, optimal_FA }: Props) {
  const [visible, setVisible] = useState([true, true, true, true]);
  const [chartDiv, setChartDiv] = useState<HTMLElement | null>(null);

  const toggle = (i: number) =>
    setVisible((v) => v.map((val, idx) => (idx === i ? !val : val)));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Plotly = () => (window as any).Plotly;

  const handleReset = () => {
    if (!chartDiv || !Plotly()) return;
    Plotly().relayout(chartDiv, { "xaxis.autorange": true, "yaxis.autorange": true });
  };

  const handleDownload = () => {
    if (!chartDiv || !Plotly()) return;
    Plotly().downloadImage(chartDiv, {
      format: "png",
      filename: "gs-intersect-utility-curves",
      scale: 2,
    });
  };

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
      x: eventsIA, y: utilityIA,
      type: "scatter", mode: "lines+markers",
      visible: visible[0] ? true : "legendonly",
      showlegend: false,
      text: power,
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>",
      line: { color: "#6366f1", width: 2.5 },
      marker: { color: "#6366f1", size: 7 },
    },
    {
      x: [optimal_IA.events_IA], y: [optimal_IA.utility_IA],
      type: "scatter", mode: "markers",
      visible: visible[1] ? true : "legendonly",
      showlegend: false,
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>`,
      marker: { color: "#f43f5e", size: 15, symbol: "star" },
    },
    {
      x: eventsFA, y: utilityFA,
      type: "scatter", mode: "lines+markers",
      visible: visible[2] ? true : "legendonly",
      showlegend: false,
      text: power,
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>",
      line: { color: "#10b981", width: 2.5, dash: "dot" },
      marker: { color: "#10b981", size: 7 },
    },
    {
      x: [optimal_FA.events_FA], y: [optimal_FA.utility_FA],
      type: "scatter", mode: "markers",
      visible: visible[3] ? true : "legendonly",
      showlegend: false,
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>Events: %{x}<br>Utility: %{y:.4f}<extra></extra>`,
      marker: { color: "#f97316", size: 15, symbol: "star" },
    },
  ];

  const layout: Partial<Plotly.Layout> = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "#f8faf9",
    showlegend: false,
    font: { family: "Inter, sans-serif", color: "#3f4444" },
    xaxis: { ...commonAxis, title: { text: "Number of Events" } },
    yaxis: { ...commonAxis, title: { text: "Utility Score  [ LR(+) × (1 − CV) ]" } },
    margin: { t: 16, r: 16, b: 50, l: 65 },
    hovermode: "closest",
  };

  const traceLabels = [
    "Interim Analysis",
    `Optimal IA (${optimal_IA.power}%)`,
    "Final Analysis",
    `Optimal FA (${optimal_FA.power}%)`,
  ];

  return (
    <div className="space-y-3">
      {/* Chart */}
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height: "360px" }}
        onInitialized={(_, div) => setChartDiv(div)}
        onUpdate={(_, div) => setChartDiv(div)}
      />

      {/* Controls + Legend row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">

        {/* Custom legend */}
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {TRACES.map((t, i) => (
            <button
              key={t.key}
              onClick={() => toggle(i)}
              className={`flex items-center gap-1.5 text-xs transition-opacity ${
                visible[i] ? "opacity-100" : "opacity-35"
              }`}
            >
              {t.star ? (
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <polygon
                    points="7,1 8.5,5.5 13,5.5 9.5,8.5 10.8,13 7,10.2 3.2,13 4.5,8.5 1,5.5 5.5,5.5"
                    fill={t.color}
                  />
                </svg>
              ) : (
                <svg width="20" height="10" viewBox="0 0 20 10">
                  <line
                    x1="0" y1="5" x2="20" y2="5"
                    stroke={t.color} strokeWidth="2.5"
                    strokeDasharray={t.dash ? "4 3" : "none"}
                  />
                  <circle cx="10" cy="5" r="3.5" fill={t.color} />
                </svg>
              )}
              <span className="text-az-graphite font-medium">
                {traceLabels[i]}
              </span>
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <RotateCcw className="w-3 h-3" />
            Reset View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <ImageDown className="w-3 h-3" />
            Download PNG
          </Button>
        </div>
      </div>

      {/* Hint */}
      <p className="text-[11px] text-az-platinum">
        Drag to zoom · Double-click to reset · Click legend items to show/hide curves
      </p>
    </div>
  );
}
