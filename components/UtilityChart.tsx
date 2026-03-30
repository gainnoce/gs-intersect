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

  // Initial CV ticks — every other point so the default full-zoom view isn't crowded.
  // The onRelayout handler overrides these dynamically as the user zooms in/out.
  const eventsIA_init = eventsIA.filter((_, i) => i % 2 === 0);
  const cvIA_init     = cvIA.filter((_, i) => i % 2 === 0);
  const eventsFA_init = eventsFA.filter((_, i) => i % 2 === 0);
  const cvFA_init     = cvFA.filter((_, i) => i % 2 === 0);

  // Sorted utility → power% for right y-axis labels
  const sortedIA = [...results].sort((a, b) => a.utility_IA - b.utility_IA);
  const sortedFA = [...results].sort((a, b) => a.utility_FA - b.utility_FA);

  // ── Dynamic CV tick handler ───────────────────────────────────────────
  // When the user zooms/pans, recompute which CV ticks to show so that:
  //   - zoomed in  → all visible data points get a label (dense)
  //   - zoomed out → every-2nd or every-3rd (sparse, not cramped)
  const makeCvRelayout = (
    divRef: HTMLElement | null,
    axes: { key: string; events: number[]; labels: string[] }[],
  ) => (relayoutData: Record<string, unknown>) => {
    if (!divRef || !getPlotly()) return;
    const hasRange    = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAutorange = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAutorange) return;  // guard: only react to x-range events

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : xMin;
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : xMax;

    const update: Record<string, unknown> = {};
    axes.forEach(({ key, events, labels }) => {
      const visible = events.reduce<{ e: number; label: string }[]>((acc, e, i) => {
        if (e >= lo && e <= hi) acc.push({ e, label: labels[i] });
        return acc;
      }, []);
      const n = visible.length;
      const stride = n > 12 ? 3 : n > 6 ? 2 : 1;
      update[`${key}.tickvals`] = visible.filter((_, i) => i % stride === 0).map(p => p.e);
      update[`${key}.ticktext`] = visible.filter((_, i) => i % stride === 0).map(p => p.label);
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
    <div className="flex justify-end gap-2 mt-3">
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
  ): Partial<Plotly.Layout> => ({
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    margin: { t: 78, r: 55, b: 52, l: 52 },
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
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
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
      type: "scatter", mode: "text+markers",
      marker: { color: C.iaOpt, size: 14, symbol: "star" },
      text: [`CV ${optimal_IA.cv_IA.toFixed(3)}`],
      textposition: "top right" as const,
      textfont: { color: C.iaOpt, size: 9.5, family: "Inter, sans-serif" },
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>CV: ${optimal_IA.cv_IA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    // invisible trace to activate xaxis2
    {
      x: eventsIA_init, y: eventsIA_init.map(() => null as unknown as number),
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
      type: "scatter", mode: "text+markers",
      marker: { color: C.faOpt, size: 14, symbol: "star" },
      text: [`CV ${optimal_FA.cv_FA.toFixed(3)}`],
      textposition: "top right" as const,
      textfont: { color: C.faOpt, size: 9.5, family: "Inter, sans-serif" },
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>CV: ${optimal_FA.cv_FA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: eventsFA_init, y: eventsFA_init.map(() => null as unknown as number),
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
      type: "scatter", mode: "text+markers",
      visible: vis[1] ? true : "legendonly",
      marker: { color: C.iaOpt, size: 14, symbol: "star" },
      text: [`CV ${optimal_IA.cv_IA.toFixed(3)}`],
      textposition: "top right" as const,
      textfont: { color: C.iaOpt, size: 9, family: "Inter, sans-serif" },
      hovertemplate: `<b>Optimal IA</b><br>Power: ${optimal_IA.power}%<br>CV: ${optimal_IA.cv_IA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
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
      type: "scatter", mode: "text+markers",
      visible: vis[3] ? true : "legendonly",
      marker: { color: C.faOpt, size: 14, symbol: "star" },
      text: [`CV ${optimal_FA.cv_FA.toFixed(3)}`],
      textposition: "top right" as const,
      textfont: { color: C.faOpt, size: 9, family: "Inter, sans-serif" },
      hovertemplate: `<b>Optimal FA</b><br>Power: ${optimal_FA.power}%<br>CV: ${optimal_FA.cv_FA.toFixed(4)}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    // invisible traces to activate xaxis2 (IA CVs) and xaxis3 (FA CVs)
    {
      x: eventsIA_init, y: eventsIA_init.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
    {
      x: eventsFA_init, y: eventsFA_init.map(() => null as unknown as number),
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
    margin: { t: 114, r: 60, b: 55, l: 55 },
    hovermode: "closest",
    xaxis: {
      ...baseAxis,
      title: { text: "Number of Events" },
      range: xRange,
    } as Partial<Plotly.LayoutAxis>,
    xaxis2: {
      overlaying: "x", side: "top",
      matches: "x",
      tickvals: eventsIA_init, ticktext: cvIA_init,
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
      tickvals: eventsFA_init, ticktext: cvFA_init,
      tickangle: -45,
      tickfont: { color: C.fa, size: 9 },
      title: { text: "FA Critical Value (HR)", font: { color: C.fa, size: 10 } },
      range: xRange, showgrid: false, zeroline: false,
      showline: true, linecolor: C.fa, ticks: "outside",
    } as Partial<Plotly.LayoutAxis>,
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
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
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-5">
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
            layout={singleLayout(eventsIA_init, cvIA_init, sortedIA, "utility_IA", C.ia)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "310px" }}
            onInitialized={(_, div) => setIaDiv(div)}
            onUpdate={(_, div) => setIaDiv(div)}
            onRelayout={makeCvRelayout(iaDiv, [
              { key: "xaxis2", events: eventsIA, labels: cvIA },
            ])}
          />
          <ChartButtons div={iaDiv} name="gs-intersect-IA" axes={AXES_SINGLE} />
        </div>

        {/* FA */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-5">
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
            layout={singleLayout(eventsFA_init, cvFA_init, sortedFA, "utility_FA", C.fa)}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "310px" }}
            onInitialized={(_, div) => setFaDiv(div)}
            onUpdate={(_, div) => setFaDiv(div)}
            onRelayout={makeCvRelayout(faDiv, [
              { key: "xaxis2", events: eventsFA, labels: cvFA },
            ])}
          />
          <ChartButtons div={faDiv} name="gs-intersect-FA" axes={AXES_SINGLE} />
        </div>
      </div>

      {/* ── Overlay ── */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm p-5">
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
          style={{ width: "100%", height: "430px" }}
          onInitialized={(_, div) => setOverlayDiv(div)}
          onUpdate={(_, div) => setOverlayDiv(div)}
          onRelayout={makeCvRelayout(overlayDiv, [
            { key: "xaxis2", events: eventsIA, labels: cvIA },
            { key: "xaxis3", events: eventsFA, labels: cvFA },
          ])}
        />

        {/* Legend + controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
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

        <p className="text-[11px] text-az-platinum mt-1">
          Click legend items above to show/hide curves
        </p>
      </div>
    </div>
  );
}
