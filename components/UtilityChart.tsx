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

const AXES_SINGLE  = ["xaxis", "xaxis2", "yaxis"];
const AXES_OVERLAY = ["xaxis", "xaxis2", "xaxis3", "yaxis"];

// Build initial tick arrays for a CV top-axis:
//   - every `stride`-th data point starting from `startIdx`
//   - always include the optimal event position so its CV tick is visible
const makeInitTicks = (
  events: number[],
  labels: string[],
  optEvent: number,
  stride: number,
  startIdx = 0,
) => {
  const labelMap = new Map(events.map((e, i) => [e, labels[i]]));
  const strided = events.filter((_, i) => i >= startIdx && (i - startIdx) % stride === 0);
  const unique = [...new Set([...strided, optEvent])].sort((a, b) => a - b);
  return {
    vals:   unique,
    labels: unique.map(e => labelMap.get(e) ?? ""),
  };
};

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
  const xMin = Math.min(...eventsIA) * 0.95;
  const xMax = Math.max(...eventsFA) * 1.02;
  const xRange = [xMin, xMax];

  // y-axis ranges with top headroom so the star callout text sits comfortably
  // below the top of the chart rather than crammed against it.
  const yMinIA  = Math.min(...utilIA);
  const yMaxIA  = Math.max(...utilIA);
  const yMinFA  = Math.min(...utilFA);
  const yMaxFA  = Math.max(...utilFA);
  const yRangeIA  = [yMinIA  - (yMaxIA  - yMinIA)  * 0.06, yMaxIA  + (yMaxIA  - yMinIA)  * 0.18];
  const yRangeFA  = [yMinFA  - (yMaxFA  - yMinFA)  * 0.06, yMaxFA  + (yMaxFA  - yMinFA)  * 0.18];
  const yRangeAll = [
    Math.min(yMinIA, yMinFA) - (Math.max(yMaxIA, yMaxFA) - Math.min(yMinIA, yMinFA)) * 0.06,
    Math.max(yMaxIA, yMaxFA) + (Math.max(yMaxIA, yMaxFA) - Math.min(yMinIA, yMinFA)) * 0.18,
  ];

  // Initial CV tick arrays — every-other for single charts (always includes
  // the optimal event so its CV value is visible), every-3rd for the overlay
  // with FA starting at index 3 to avoid labels crowding the left edge of the curve.
  const iaInit    = makeInitTicks(eventsIA, cvIA, optimal_IA.events_IA, 2);
  const faInit    = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 2);
  const ovlIAInit = makeInitTicks(eventsIA, cvIA, optimal_IA.events_IA, 3);
  const ovlFAInit = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 3, 3);

  // Sorted utility → power% for right y-axis labels
  const sortedIA = [...results].sort((a, b) => a.utility_IA - b.utility_IA);
  const sortedFA = [...results].sort((a, b) => a.utility_FA - b.utility_FA);

  // ── Dynamic CV tick density ───────────────────────────────────────────
  // Fires on x-range changes; recomputes which CV ticks to show based on
  // how many data points are currently in view. Only touches xaxis2/xaxis3.
  const makeCvRelayout = (
    divRef: HTMLElement | null,
    axes: { key: string; events: number[]; labels: string[]; optEvent: number }[],
  ) => (relayoutData: Record<string, unknown>) => {
    if (!divRef || !getPlotly()) return;
    const hasRange     = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAutorange = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAutorange) return;

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : xMin;
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : xMax;

    const update: Record<string, unknown> = {};
    axes.forEach(({ key, events, labels, optEvent }) => {
      const labelMap = new Map(events.map((e, i) => [e, labels[i]]));
      const visible = events.filter(e => e >= lo && e <= hi);
      const n = visible.length;
      const stride = n > 12 ? 3 : n > 6 ? 2 : 1;
      const strided = visible.filter((_, i) => i % stride === 0);
      const unique = [...new Set([...strided, ...(visible.includes(optEvent) ? [optEvent] : [])])].sort((a, b) => a - b);
      update[`${key}.tickvals`] = unique;
      update[`${key}.ticktext`] = unique.map(e => labelMap.get(e) ?? "");
    });
    getPlotly().relayout(divRef, update);
  };

  // ── Helpers ───────────────────────────────────────────────────────────
  const resetView = (div: HTMLElement | null, axes: string[]) => {
    if (!div || !getPlotly()) return;
    const update: Record<string, unknown> = {};
    axes.forEach(ax => { update[`${ax}.autorange`] = true; });
    getPlotly().relayout(div, update);
  };

  const downloadPng = (div: HTMLElement | null, name: string) => {
    if (!div || !getPlotly()) return;
    getPlotly().downloadImage(div, { format: "png", filename: name, scale: 2 });
  };

  const ChartButtons = ({
    div, name, axes,
  }: { div: HTMLElement | null; name: string; axes: string[] }) => (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => resetView(div, axes)}
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
    events_init: number[],
    cvLabels_init: string[],
    sortedRows: DesignResult[],
    utilKey: "utility_IA" | "utility_FA",
    accentColor: string,
    yRange: number[],
  ): Partial<Plotly.Layout> => ({
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    // l:62 gives the y-axis title a few extra pixels away from the card edge
    margin: { t: 76, r: 56, b: 50, l: 62 },
    hovermode: "closest",
    xaxis: {
      ...baseAxis,
      title: { text: "Events" },
      range: xRange,
    } as Partial<Plotly.LayoutAxis>,
    xaxis2: {
      overlaying: "x", side: "top",
      matches: "x",
      tickvals: events_init, ticktext: cvLabels_init,
      tickangle: -45,
      tickfont: { color: accentColor, size: 9 },
      title: { text: "Critical Value (HR)", font: { color: accentColor, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: accentColor, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    // Explicit y range gives 18% headroom above the max utility so the star's
    // CV text label sits well within the chart rather than near the top edge.
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
      range: yRange,
    } as Partial<Plotly.LayoutAxis>,
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

  // Optimal-star trace helper — cliponaxis:false lets the CV text label
  // render beyond the plot boundary without being clipped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optStar = (x: number, y: number, cv: string, power: number, color: string, label: string): any => ({
    x: [x], y: [y],
    type: "scatter", mode: "text+markers",
    marker: { color, size: 14, symbol: "star" },
    text: [`CV ${cv}`],
    textposition: "top right",
    textfont: { color, size: 9.5, family: "Inter, sans-serif" },
    cliponaxis: false,
    hovertemplate: `<b>${label}</b><br>Power: ${power}%<br>CV: ${cv}<br>Utility: %{y:.4f}<extra></extra>`,
    showlegend: false, xaxis: "x", yaxis: "y",
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
    optStar(optimal_IA.events_IA, optimal_IA.utility_IA, optimal_IA.cv_IA.toFixed(3), optimal_IA.power, C.iaOpt, "Optimal IA"),
    {
      x: iaInit.vals, y: iaInit.vals.map(() => null as unknown as number),
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
    optStar(optimal_FA.events_FA, optimal_FA.utility_FA, optimal_FA.cv_FA.toFixed(3), optimal_FA.power, C.faOpt, "Optimal FA"),
    {
      x: faInit.vals, y: faInit.vals.map(() => null as unknown as number),
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
    { ...optStar(optimal_IA.events_IA, optimal_IA.utility_IA, optimal_IA.cv_IA.toFixed(3), optimal_IA.power, C.iaOpt, "Optimal IA"),
      visible: vis[1] ? true : "legendonly" },
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      visible: vis[2] ? true : "legendonly",
      line: { color: C.fa, width: 2.5, dash: "dot" }, marker: { color: C.fa, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>FA Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    { ...optStar(optimal_FA.events_FA, optimal_FA.utility_FA, optimal_FA.cv_FA.toFixed(3), optimal_FA.power, C.faOpt, "Optimal FA"),
      visible: vis[3] ? true : "legendonly" },
    // invisible traces to activate xaxis2 (IA CVs) and xaxis3 (FA CVs)
    {
      x: ovlIAInit.vals, y: ovlIAInit.vals.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
    {
      x: ovlFAInit.vals, y: ovlFAInit.vals.map(() => null as unknown as number),
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
    margin: { t: 112, r: 60, b: 52, l: 62 },
    hovermode: "closest",
    xaxis: {
      ...baseAxis,
      title: { text: "Number of Events" },
      range: xRange,
    } as Partial<Plotly.LayoutAxis>,
    xaxis2: {
      overlaying: "x", side: "top",
      matches: "x",
      tickvals: ovlIAInit.vals, ticktext: ovlIAInit.labels,
      tickangle: -45,
      tickfont: { color: C.ia, size: 9 },
      title: { text: "IA Critical Value (HR)", font: { color: C.ia, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: C.ia, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    xaxis3: {
      overlaying: "x", side: "top",
      matches: "x",
      anchor: "free", position: 1.15,
      tickvals: ovlFAInit.vals, ticktext: ovlFAInit.labels,
      tickangle: -45,
      tickfont: { color: C.fa, size: 9 },
      title: { text: "FA Critical Value (HR)", font: { color: C.fa, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: C.fa, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
      range: yRangeAll,
    } as Partial<Plotly.LayoutAxis>,
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

  // ── Overlay legend ────────────────────────────────────────────────────
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
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
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
            layout={singleLayout(iaInit.vals, iaInit.labels, sortedIA, "utility_IA", C.ia, yRangeIA)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "340px" }}
            onInitialized={(_, div) => setIaDiv(div)}
            onUpdate={(_, div) => setIaDiv(div)}
            onRelayout={makeCvRelayout(iaDiv, [
              { key: "xaxis2", events: eventsIA, labels: cvIA, optEvent: optimal_IA.events_IA },
            ])}
          />
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <ChartButtons div={iaDiv} name="gs-intersect-IA" axes={AXES_SINGLE} />
          </div>
        </div>

        {/* FA */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
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
            layout={singleLayout(faInit.vals, faInit.labels, sortedFA, "utility_FA", C.fa, yRangeFA)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "340px" }}
            onInitialized={(_, div) => setFaDiv(div)}
            onUpdate={(_, div) => setFaDiv(div)}
            onRelayout={makeCvRelayout(faDiv, [
              { key: "xaxis2", events: eventsFA, labels: cvFA, optEvent: optimal_FA.events_FA },
            ])}
          />
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <ChartButtons div={faDiv} name="gs-intersect-FA" axes={AXES_SINGLE} />
          </div>
        </div>
      </div>

      {/* ── Overlay ── */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1">
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
          style={{ width: "100%", height: "460px" }}
          onInitialized={(_, div) => setOverlayDiv(div)}
          onUpdate={(_, div) => setOverlayDiv(div)}
          onRelayout={makeCvRelayout(overlayDiv, [
            { key: "xaxis2", events: eventsIA, labels: cvIA, optEvent: optimal_IA.events_IA },
            { key: "xaxis3", events: eventsFA, labels: cvFA, optEvent: optimal_FA.events_FA },
          ])}
        />

        {/* Legend + controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pb-4 pt-2">
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
          <ChartButtons div={overlayDiv} name="gs-intersect-combined" axes={AXES_OVERLAY} />
        </div>

        <p className="text-[11px] text-az-platinum px-5 pb-3">
          Click legend items above to show/hide curves
        </p>
      </div>
    </div>
  );
}
