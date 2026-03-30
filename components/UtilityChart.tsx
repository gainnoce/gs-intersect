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

const C = {
  ia:    "#6366f1",
  iaOpt: "#f43f5e",
  fa:    "#10b981",
  faOpt: "#f97316",
};

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

export function UtilityChart({ results, optimal_IA, optimal_FA }: Props) {
  const [iaDiv,      setIaDiv]      = useState<HTMLElement | null>(null);
  const [faDiv,      setFaDiv]      = useState<HTMLElement | null>(null);
  const [overlayDiv, setOverlayDiv] = useState<HTMLElement | null>(null);
  const [vis, setVis] = useState([true, true, true, true]);

  // ── Raw arrays ────────────────────────────────────────────────────────
  const eventsIA  = results.map(r => r.events_IA);
  const eventsFA  = results.map(r => r.events_FA);
  const utilIA    = results.map(r => r.utility_IA);
  const utilFA    = results.map(r => r.utility_FA);
  const cvIA      = results.map(r => r.cv_IA.toFixed(3));
  const cvFA      = results.map(r => r.cv_FA.toFixed(3));
  const powerLbls = results.map(r => `${r.power}%`);

  // Shared x range
  const xMin   = Math.min(...eventsIA) * 0.95;
  const xMax   = Math.max(...eventsFA) * 1.02;
  const xRange = [xMin, xMax];

  // Thin out CV ticks — show every other point to avoid crowding at low-power end
  const eventsIA_ticks = eventsIA.filter((_, i) => i % 2 === 0);
  const cvIA_ticks     = cvIA.filter((_, i) => i % 2 === 0);
  const eventsFA_ticks = eventsFA.filter((_, i) => i % 2 === 0);
  const cvFA_ticks     = cvFA.filter((_, i) => i % 2 === 0);

  // Sorted utility → power% for right y-axis labels
  const sortedIA = [...results].sort((a, b) => a.utility_IA - b.utility_IA);
  const sortedFA = [...results].sort((a, b) => a.utility_FA - b.utility_FA);

  // ── Helpers ───────────────────────────────────────────────────────────
  const resetView = (div: HTMLElement | null) => {
    if (!div || !getPlotly()) return;
    getPlotly().relayout(div, { "xaxis.autorange": true, "yaxis.autorange": true });
  };
  const downloadPng = (div: HTMLElement | null, name: string) => {
    if (!div || !getPlotly()) return;
    getPlotly().downloadImage(div, { format: "png", filename: name, scale: 2 });
  };

  const ChartButtons = ({ div, name }: { div: HTMLElement | null; name: string }) => (
    <div className="flex justify-end gap-2 mt-2">
      <Button variant="outline" size="sm" onClick={() => resetView(div)}
        className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
        <RotateCcw className="w-3 h-3" /> Reset
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadPng(div, name)}
        className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
        <ImageDown className="w-3 h-3" /> PNG
      </Button>
    </div>
  );

  // ── Single-analysis chart layout factory ─────────────────────────────
  const singleLayout = (
    events_ticks: number[],
    cvLabels_ticks: string[],
    sortedRows: DesignResult[],
    utilKey: "utility_IA" | "utility_FA",
    accentColor: string,
  ): Partial<Plotly.Layout> => ({
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    margin: { t: 72, r: 52, b: 44, l: 52 },
    hovermode: "closest",
    xaxis: { ...baseAxis, title: { text: "Events" }, range: xRange } as Partial<Plotly.LayoutAxis>,
    /* top x-axis — CV labels, thinned + angled */
    xaxis2: {
      overlaying: "x", side: "top",
      tickvals: events_ticks, ticktext: cvLabels_ticks,
      tickangle: -40,
      tickfont: { color: accentColor, size: 9 },
      title: { text: "Critical Value (HR)", font: { color: accentColor, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: accentColor, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    yaxis: { ...baseAxis, title: { text: "Utility Score" } } as Partial<Plotly.LayoutAxis>,
    /* right y-axis — Power % */
    yaxis2: {
      overlaying: "y", side: "right",
      tickvals: sortedRows.map(r => r[utilKey]),
      ticktext: sortedRows.map(r => `${r.power}%`),
      tickfont: { color: accentColor, size: 9 },
      title: { text: "Power %", font: { color: accentColor, size: 10 } },
      showgrid: false, zeroline: false,
      showline: true, linecolor: accentColor, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
  });

  // ── IA data ───────────────────────────────────────────────────────────
  const iaData: Plotly.Data[] = [
    {
      x: eventsIA, y: utilIA, type: "scatter", mode: "lines+markers",
      line: { color: C.ia, width: 2.5 }, marker: { color: C.ia, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_IA),
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: [optimal_IA.events_IA], y: [optimal_IA.utility_IA],
      type: "scatter", mode: "markers",
      marker: { color: C.iaOpt, size: 14, symbol: "star" },
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>CV: ${optimal_IA.cv_IA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    // invisible trace to activate xaxis2
    {
      x: eventsIA_ticks, y: eventsIA_ticks.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
  ];

  // ── FA data ───────────────────────────────────────────────────────────
  const faData: Plotly.Data[] = [
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      line: { color: C.fa, width: 2.5, dash: "dot" }, marker: { color: C.fa, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: [optimal_FA.events_FA], y: [optimal_FA.utility_FA],
      type: "scatter", mode: "markers",
      marker: { color: C.faOpt, size: 14, symbol: "star" },
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>CV: ${optimal_FA.cv_FA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: eventsFA_ticks, y: eventsFA_ticks.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
  ];

  // ── Overlay data ──────────────────────────────────────────────────────
  const overlayData: Plotly.Data[] = [
    {
      x: eventsIA, y: utilIA, type: "scatter", mode: "lines+markers",
      visible: vis[0] ? true : "legendonly",
      line: { color: C.ia, width: 2.5 }, marker: { color: C.ia, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_IA),
      hovertemplate: "<b>IA Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: [optimal_IA.events_IA], y: [optimal_IA.utility_IA],
      type: "scatter", mode: "markers",
      visible: vis[1] ? true : "legendonly",
      marker: { color: C.iaOpt, size: 14, symbol: "star" },
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      visible: vis[2] ? true : "legendonly",
      line: { color: C.fa, width: 2.5, dash: "dot" }, marker: { color: C.fa, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>FA Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: [optimal_FA.events_FA], y: [optimal_FA.utility_FA],
      type: "scatter", mode: "markers",
      visible: vis[3] ? true : "legendonly",
      marker: { color: C.faOpt, size: 14, symbol: "star" },
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    // invisible traces to activate xaxis2 (IA CVs) and xaxis3 (FA CVs)
    {
      x: eventsIA_ticks, y: eventsIA_ticks.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
    {
      x: eventsFA_ticks, y: eventsFA_ticks.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x3", yaxis: "y", hoverinfo: "skip" as const,
    },
  ];

  const overlayLayout: Partial<Plotly.Layout> = {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    margin: { t: 108, r: 60, b: 50, l: 60 },
    hovermode: "closest",
    xaxis: { ...baseAxis, title: { text: "Number of Events" }, range: xRange } as Partial<Plotly.LayoutAxis>,
    /* IA CV — top, indigo */
    xaxis2: {
      overlaying: "x", side: "top",
      tickvals: eventsIA_ticks, ticktext: cvIA_ticks,
      tickangle: -40,
      tickfont: { color: C.ia, size: 9 },
      title: { text: "IA Critical Value (HR)", font: { color: C.ia, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: C.ia, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    /* FA CV — stacked above IA CV row, emerald */
    xaxis3: {
      overlaying: "x", side: "top",
      anchor: "free", position: 1.15,
      tickvals: eventsFA_ticks, ticktext: cvFA_ticks,
      tickangle: -40,
      tickfont: { color: C.fa, size: 9 },
      title: { text: "FA Critical Value (HR)", font: { color: C.fa, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: C.fa, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    yaxis: { ...baseAxis, title: { text: "Utility Score" } } as Partial<Plotly.LayoutAxis>,
    /* Power % on right — keyed to IA utility positions */
    yaxis2: {
      overlaying: "y", side: "right",
      tickvals: sortedIA.map(r => r.utility_IA),
      ticktext: sortedIA.map(r => `${r.power}%`),
      tickfont: { color: C.ia, size: 9 },
      title: { text: "Power % (IA)", font: { color: C.ia, size: 10 } },
      showgrid: false, zeroline: false,
      showline: true, linecolor: C.ia, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
  };

  // ── Overlay legend items ──────────────────────────────────────────────
  const overlayLegend = [
    { label: "Interim Analysis",                  color: C.ia,    dash: false, star: false, i: 0 },
    { label: `Optimal IA (${optimal_IA.power}%)`, color: C.iaOpt, dash: false, star: true,  i: 1 },
    { label: "Final Analysis",                    color: C.fa,    dash: true,  star: false, i: 2 },
    { label: `Optimal FA (${optimal_FA.power}%)`, color: C.faOpt, dash: true,  star: true,  i: 3 },
  ];

  return (
    <div className="space-y-4">

      {/* ── Side-by-side IA / FA ── */}
      <div className="grid grid-cols-2 gap-3">

        {/* IA */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: C.ia }} />
            <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              Interim Analysis
            </h3>
            <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
              Optimal: {optimal_IA.power}% power · CV {optimal_IA.cv_IA.toFixed(3)}
            </span>
          </div>
          <Plot
            data={iaData}
            layout={singleLayout(eventsIA_ticks, cvIA_ticks, sortedIA, "utility_IA", C.ia)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "300px" }}
            onInitialized={(_, div) => setIaDiv(div)}
            onUpdate={(_, div) => setIaDiv(div)}
          />
          <ChartButtons div={iaDiv} name="gs-intersect-IA" />
        </div>

        {/* FA */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: C.fa }} />
            <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              Final Analysis
            </h3>
            <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
              Optimal: {optimal_FA.power}% power · CV {optimal_FA.cv_FA.toFixed(3)}
            </span>
          </div>
          <Plot
            data={faData}
            layout={singleLayout(eventsFA_ticks, cvFA_ticks, sortedFA, "utility_FA", C.fa)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "300px" }}
            onInitialized={(_, div) => setFaDiv(div)}
            onUpdate={(_, div) => setFaDiv(div)}
          />
          <ChartButtons div={faDiv} name="gs-intersect-FA" />
        </div>
      </div>

      {/* ── Overlay ── */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
            Combined View
          </h3>
          <span className="text-[10px] text-az-platinum">
            IA + FA overlaid · IA CV (indigo) · FA CV (emerald) · Power % (right)
          </span>
        </div>

        <Plot
          data={overlayData}
          layout={overlayLayout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "420px" }}
          onInitialized={(_, div) => setOverlayDiv(div)}
          onUpdate={(_, div) => setOverlayDiv(div)}
        />

        {/* Legend + controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {overlayLegend.map(({ label, color, dash, star, i }) => (
              <button
                key={i}
                onClick={() => setVis(v => v.map((val, idx) => idx === i ? !val : val))}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${vis[i] ? "opacity-100" : "opacity-35"}`}
              >
                {star ? (
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <polygon points="7,1 8.5,5.5 13,5.5 9.5,8.5 10.8,13 7,10.2 3.2,13 4.5,8.5 1,5.5 5.5,5.5" fill={color} />
                  </svg>
                ) : (
                  <svg width="22" height="10" viewBox="0 0 22 10">
                    <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dash ? "4 3" : "none"} />
                    <circle cx="11" cy="5" r="3.5" fill={color} />
                  </svg>
                )}
                <span className="text-az-graphite font-medium">{label}</span>
              </button>
            ))}
          </div>
          <ChartButtons div={overlayDiv} name="gs-intersect-combined" />
        </div>

        <p className="text-[11px] text-az-platinum mt-1">
          Drag to zoom · Double-click to reset · Click legend items to show/hide curves
        </p>
      </div>
    </div>
  );
}
