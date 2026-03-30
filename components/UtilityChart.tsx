"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { DesignResult } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
  optimal_IAs?: DesignResult[];
  k?: number;
}

const IA_COLORS     = ["#6366f1", "#7c3aed", "#9333ea"] as const;
const IA_OPT_COLORS = ["#f43f5e", "#fb7185", "#fda4af"] as const;
const FA_COLOR      = "#10b981";
const FA_OPT_COLOR  = "#f97316";

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

// Build initial CV tick arrays — stride controls density, always includes optimal event.
const makeInitTicks = (
  events: number[],
  labels: string[],
  optEvent: number,
  stride: number,
  startIdx = 0,
) => {
  const labelMap = new Map(events.map((e, i) => [e, labels[i]]));
  const strided  = events.filter((_, i) => i >= startIdx && (i - startIdx) % stride === 0);
  const unique   = [...new Set([...strided, optEvent])].sort((a, b) => a - b);
  return { vals: unique, labels: unique.map(e => labelMap.get(e) ?? "") };
};

const yHeadroom = (arr: number[]) => {
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = mx - mn;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

// Snug x-range for a single chart's event array (no shared-range cramping)
const xPad = (events: number[]) => [Math.min(...events) * 0.95, Math.max(...events) * 1.02];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PlotlyTrace = any;

export function UtilityChart({ results, optimal_IA, optimal_FA, optimal_IAs, k }: Props) {
  const numK   = k ?? 2;
  const numIAs = numK - 1;

  const [iaDivs,     setIaDivs]     = useState<(HTMLElement | null)[]>(Array(numIAs).fill(null));
  const [faDiv,      setFaDiv]      = useState<HTMLElement | null>(null);
  const [overlayDiv, setOverlayDiv] = useState<HTMLElement | null>(null);
  const [activeIA,   setActiveIA]   = useState(0);
  const [vis,        setVis]        = useState<boolean[]>(Array(numIAs + 1).fill(true));
  const [logScale,   setLogScale]   = useState(false);
  const [sharedX,    setSharedX]    = useState(false);

  // ── Per-stage data ────────────────────────────────────────────────────
  const stagesData = Array.from({ length: numIAs }, (_, j) => {
    const events = results.map(r => r.ia_stages?.[j]?.events ?? r.events_IA);
    const utils  = results.map(r => r.ia_stages?.[j]?.utility ?? r.utility_IA);
    const cvs    = results.map(r => (r.ia_stages?.[j]?.cv ?? r.cv_IA).toFixed(3));
    const opt    = optimal_IAs?.[j] ?? optimal_IA;
    const optEv  = opt.ia_stages?.[j]?.events  ?? opt.events_IA;
    const optUt  = opt.ia_stages?.[j]?.utility ?? opt.utility_IA;
    const optCv  = (opt.ia_stages?.[j]?.cv ?? opt.cv_IA).toFixed(3);
    const optPow = opt.power;
    const sorted = [...results].sort((a, b) =>
      (a.ia_stages?.[j]?.utility ?? a.utility_IA) - (b.ia_stages?.[j]?.utility ?? b.utility_IA)
    );
    return { events, utils, cvs, opt, optEv, optUt, optCv, optPow, sorted };
  });

  const eventsFA  = results.map(r => r.events_FA);
  const utilFA    = results.map(r => r.utility_FA);
  const cvFA      = results.map(r => r.cv_FA.toFixed(3));
  const powerLbls = results.map(r => `${r.power}%`);
  const sortedFA  = [...results].sort((a, b) => a.utility_FA - b.utility_FA);

  const iaSt     = stagesData[activeIA];
  const iaColor  = IA_COLORS[activeIA % IA_COLORS.length];
  const iaOptCol = IA_OPT_COLORS[activeIA % IA_OPT_COLORS.length];

  // Each individual chart gets its own snug x-range to avoid cramping.
  // The combined overlay uses the global range spanning all analyses.
  const allEvents = [...stagesData.flatMap(s => s.events), ...eventsFA];
  const xMin      = Math.min(...allEvents) * 0.95;
  const xMax      = Math.max(...allEvents) * 1.02;
  const xRange    = [xMin, xMax];
  const iaXRange  = sharedX ? xRange : xPad(iaSt.events);
  const faXRange  = xPad(eventsFA);

  // y ranges
  const iaYRange  = yHeadroom(iaSt.utils);
  const faYRange  = yHeadroom(utilFA);
  const yRangeAll = yHeadroom([...stagesData.flatMap(s => s.utils), ...utilFA]);

  // ── Dynamic CV tick density on zoom ───────────────────────────────────
  const makeCvRelayout = (
    divRef: HTMLElement | null,
    axes: { key: string; events: number[]; labels: string[]; optEvent: number }[],
    chartXMin: number,
    chartXMax: number,
  ) => (relayoutData: Record<string, unknown>) => {
    if (!divRef || !getPlotly()) return;
    const hasRange     = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAutorange = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAutorange) return;

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : chartXMin;
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : chartXMax;

    const update: Record<string, unknown> = {};
    axes.forEach(({ key, events, labels, optEvent }) => {
      const labelMap = new Map(events.map((e, i) => [e, labels[i]]));
      const visible  = events.filter(e => e >= lo && e <= hi);
      const n        = visible.length;
      const stride   = n > 12 ? 3 : n > 6 ? 2 : 1;
      const strided  = visible.filter((_, i) => i % stride === 0);
      const unique   = [...new Set([...strided, ...(visible.includes(optEvent) ? [optEvent] : [])])].sort((a, b) => a - b);
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

  const ChartButtons = ({ div, name, axes }: { div: HTMLElement | null; name: string; axes: string[] }) => (
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

  // ── Single-chart layout factory ────────────────────────────────────────
  // chartXRange: snug range for this specific chart's data
  const singleLayout = (
    events_init: number[],
    cvLabels_init: string[],
    sortedRows: DesignResult[],
    utilKey: "utility_IA" | "utility_FA",
    accentColor: string,
    yRange: number[],
    chartXRange: number[],
    utilExtractor?: (r: DesignResult) => number,
  ): Partial<Plotly.Layout> => {
    const getUtil = utilExtractor ?? ((r: DesignResult) => r[utilKey]);
    return {
      paper_bgcolor: "transparent",
      plot_bgcolor:  "#f8faf9",
      showlegend:    false,
      font:   { family: "Inter, sans-serif", color: "#3f4444" },
      margin: { t: 76, r: 56, b: 50, l: 72 },
      hovermode: "closest",
      xaxis: {
        ...baseAxis,
        title: { text: "Events" },
        range: chartXRange,
      } as Partial<Plotly.LayoutAxis>,
      xaxis2: {
        overlaying: "x", side: "top", matches: "x",
        tickvals: events_init, ticktext: cvLabels_init,
        tickangle: -45,
        tickfont: { color: accentColor, size: 9 },
        title: { text: "Critical Value (HR)", font: { color: accentColor, size: 10 } },
        range: chartXRange, showgrid: false, zeroline: false,
        showline: true, linecolor: accentColor, ticks: "outside",
      } as Partial<Plotly.LayoutAxis>,
      yaxis: {
        ...baseAxis,
        title: { text: "Utility Score" },
        range: yRange,
      } as Partial<Plotly.LayoutAxis>,
      yaxis2: {
        overlaying: "y", side: "right",
        tickvals: sortedRows.map(r => getUtil(r)),
        ticktext: sortedRows.map(r => `${r.power}%`),
        tickfont: { color: accentColor, size: 9 },
        title: { text: "Power %", font: { color: accentColor, size: 10 } },
        showgrid: false, zeroline: false,
        showline: true, linecolor: accentColor, ticks: "outside",
      } as Partial<Plotly.LayoutAxis>,
    };
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optStar = (x: number, y: number, cv: string, power: number, color: string, label: string, chartXRange?: number[]): any => {
    // Place text on the side with more room so it stays inside the chart area
    const xMid = chartXRange ? (chartXRange[0] + chartXRange[1]) / 2 : x;
    const textposition = x >= xMid ? "top left" : "top right";
    return {
      x: [x], y: [y],
      type: "scatter", mode: "text+markers",
      marker: { color, size: 14, symbol: "star" },
      text: [`CV ${cv}`],
      textposition,
      textfont: { color, size: 9.5, family: "Inter, sans-serif" },
      cliponaxis: false,
      hovertemplate: `<b>${label}</b><br>Power: ${power}%<br>CV: ${cv}<br>Utility: %{y:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    };
  };

  // ── IA chart data ─────────────────────────────────────────────────────
  const iaInit = makeInitTicks(iaSt.events, iaSt.cvs, iaSt.optEv, 2);

  const iaData: Plotly.Data[] = [
    {
      x: iaSt.events, y: iaSt.utils, type: "scatter", mode: "lines+markers",
      line: { color: iaColor, width: 2.5 }, marker: { color: iaColor, size: 6 },
      text: powerLbls, customdata: results.map(r => r.ia_stages?.[activeIA]?.cv ?? r.cv_IA),
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    optStar(iaSt.optEv, iaSt.optUt, iaSt.optCv, iaSt.optPow, iaOptCol, `Optimal IA${numIAs > 1 ? ` ${activeIA + 1}` : ""}`, iaXRange),
    {
      x: iaInit.vals, y: iaInit.vals.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
  ];

  const iaLayout = singleLayout(
    iaInit.vals, iaInit.labels, iaSt.sorted,
    "utility_IA", iaColor, iaYRange, iaXRange,
    (r) => r.ia_stages?.[activeIA]?.utility ?? r.utility_IA,
  );

  // ── FA chart data ─────────────────────────────────────────────────────
  const faInit = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 2);

  const faData: Plotly.Data[] = [
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      line: { color: FA_COLOR, width: 2.5, dash: "dot" }, marker: { color: FA_COLOR, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    optStar(optimal_FA.events_FA, optimal_FA.utility_FA, optimal_FA.cv_FA.toFixed(3), optimal_FA.power, FA_OPT_COLOR, "Optimal FA", faXRange),
    {
      x: faInit.vals, y: faInit.vals.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
  ];

  const faLayout = singleLayout(faInit.vals, faInit.labels, sortedFA, "utility_FA", FA_COLOR, faYRange, faXRange);

  // ── Overlay data ──────────────────────────────────────────────────────
  const overlayData: PlotlyTrace[] = [
    ...stagesData.flatMap((st, j) => {
      const col    = IA_COLORS[j % IA_COLORS.length];
      const optCol = IA_OPT_COLORS[j % IA_OPT_COLORS.length];
      const label  = numIAs === 1 ? "Interim Analysis" : `IA Stage ${j + 1}`;
      return [
        {
          x: st.events, y: st.utils, type: "scatter", mode: "lines+markers",
          visible: vis[j] ? true : "legendonly",
          line: { color: col, width: 2.5 }, marker: { color: col, size: 6 },
          text: powerLbls, customdata: results.map(r => r.ia_stages?.[j]?.cv ?? r.cv_IA),
          hovertemplate: `<b>${label} Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>`,
          showlegend: false, xaxis: "x", yaxis: "y",
        },
        { ...optStar(st.optEv, st.optUt, st.optCv, st.optPow, optCol, `Optimal ${label}`, xRange), visible: vis[j] ? true : "legendonly" },
      ];
    }),
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      visible: vis[numIAs] ? true : "legendonly",
      line: { color: FA_COLOR, width: 2.5, dash: "dot" }, marker: { color: FA_COLOR, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>FA Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    { ...optStar(optimal_FA.events_FA, optimal_FA.utility_FA, optimal_FA.cv_FA.toFixed(3), optimal_FA.power, FA_OPT_COLOR, "Optimal FA", xRange), visible: vis[numIAs] ? true : "legendonly" },
    // CV axis anchor traces — only for k=2
    ...(numK === 2 ? (() => {
      const ovlIAInit = makeInitTicks(stagesData[0].events, stagesData[0].cvs, stagesData[0].optEv, 3);
      const ovlFAInit = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 3, 3);
      return [
        { x: ovlIAInit.vals, y: ovlIAInit.vals.map(() => null as unknown as number), type: "scatter", mode: "markers", marker: { opacity: 0, size: 1 }, showlegend: false, xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const },
        { x: ovlFAInit.vals, y: ovlFAInit.vals.map(() => null as unknown as number), type: "scatter", mode: "markers", marker: { opacity: 0, size: 1 }, showlegend: false, xaxis: "x3", yaxis: "y", hoverinfo: "skip" as const },
      ];
    })() : []),
  ];

  const overlayLayout: Partial<Plotly.Layout> = (() => {
    const yAxisConfig: Partial<Plotly.LayoutAxis> = {
      ...baseAxis,
      title: { text: "Utility Score" },
      ...(logScale
        ? { type: "log" as const }
        : { type: "linear" as const, range: yRangeAll }),
    };
    const base: Partial<Plotly.Layout> = {
      paper_bgcolor: "transparent",
      plot_bgcolor:  "#f8faf9",
      showlegend:    false,
      font:   { family: "Inter, sans-serif", color: "#3f4444" },
      margin: { t: numK === 2 ? 112 : 76, r: 60, b: 52, l: 62 },
      hovermode: "closest",
      xaxis: { ...baseAxis, title: { text: "Number of Events" }, range: xRange } as Partial<Plotly.LayoutAxis>,
      yaxis: yAxisConfig,
      yaxis2: {
        overlaying: "y", side: "right",
        tickvals: sortedFA.map(r => r.utility_FA),
        ticktext: sortedFA.map(r => `${r.power}%`),
        tickfont: { color: FA_COLOR, size: 9 },
        title: { text: "Power % (FA)", font: { color: FA_COLOR, size: 10 } },
        showgrid: false, zeroline: false,
        showline: true, linecolor: FA_COLOR, ticks: "outside",
      } as Partial<Plotly.LayoutAxis>,
    };
    if (numK === 2) {
      const ovlIAInit = makeInitTicks(stagesData[0].events, stagesData[0].cvs, stagesData[0].optEv, 3);
      const ovlFAInit = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 3, 3);
      return {
        ...base,
        xaxis2: {
          overlaying: "x", side: "top", matches: "x",
          tickvals: ovlIAInit.vals, ticktext: ovlIAInit.labels, tickangle: -45,
          tickfont: { color: IA_COLORS[0], size: 9 },
          title: { text: "IA Critical Value (HR)", font: { color: IA_COLORS[0], size: 10 } },
          range: xRange, showgrid: false, zeroline: false,
          showline: true, linecolor: IA_COLORS[0], ticks: "outside",
        } as Partial<Plotly.LayoutAxis>,
        xaxis3: {
          overlaying: "x", side: "top", matches: "x", anchor: "free", position: 1.15,
          tickvals: ovlFAInit.vals, ticktext: ovlFAInit.labels, tickangle: -45,
          tickfont: { color: FA_COLOR, size: 9 },
          title: { text: "FA Critical Value (HR)", font: { color: FA_COLOR, size: 10 } },
          range: xRange, showgrid: false, zeroline: false,
          showline: true, linecolor: FA_COLOR, ticks: "outside",
        } as Partial<Plotly.LayoutAxis>,
      };
    }
    return base;
  })();

  const AXES_SINGLE  = ["xaxis", "xaxis2", "yaxis"];
  const AXES_OVL_K2  = ["xaxis", "xaxis2", "xaxis3", "yaxis"];
  const AXES_OVL_KN  = ["xaxis", "yaxis"];

  const overlayLegendItems = [
    ...stagesData.map((st, j) => ({
      label:    numIAs === 1 ? "Interim Analysis"        : `IA Stage ${j + 1}`,
      optLabel: numIAs === 1 ? `Optimal IA (${st.optPow}%)` : `Opt IA${j + 1} (${st.optPow}%)`,
      color: IA_COLORS[j % IA_COLORS.length],
      optColor: IA_OPT_COLORS[j % IA_OPT_COLORS.length],
      visIdx: j, dash: false,
    })),
    { label: "Final Analysis", optLabel: `Optimal FA (${optimal_FA.power}%)`, color: FA_COLOR, optColor: FA_OPT_COLOR, visIdx: numIAs, dash: true },
  ];

  return (
    <div className="space-y-4">

      {/* ── Side-by-side IA / FA ── */}
      <div className="grid grid-cols-2 gap-3">

        {/* IA card — overlaid arrows for multi-stage navigation */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden relative">

          {/* Left arrow: previous IA stage */}
          {numIAs > 1 && activeIA > 0 && (
            <button
              onClick={() => setActiveIA(a => a - 1)}
              aria-label="Previous IA stage"
              className="absolute left-0 inset-y-0 w-7 z-10 flex items-center justify-center bg-gradient-to-r from-white/95 to-transparent hover:from-az-light-platinum/80 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-az-graphite" />
            </button>
          )}
          {/* Right arrow: next IA stage */}
          {numIAs > 1 && activeIA < numIAs - 1 && (
            <button
              onClick={() => setActiveIA(a => a + 1)}
              aria-label="Next IA stage"
              className="absolute right-0 inset-y-0 w-7 z-10 flex items-center justify-center bg-gradient-to-l from-white/95 to-transparent hover:from-az-light-platinum/80 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 text-az-graphite" />
            </button>
          )}

          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: iaColor }} />
            <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              {numIAs === 1 ? "Interim Analysis" : `Interim Analysis — Stage ${activeIA + 1}`}
            </h3>
            {/* Stage dot indicators */}
            {numIAs > 1 && (
              <div className="flex gap-1 ml-0.5">
                {stagesData.map((_, j) => (
                  <button key={j} onClick={() => setActiveIA(j)} aria-label={`Go to IA ${j + 1}`}>
                    <span
                      className="block rounded-full transition-all"
                      style={{
                        width: j === activeIA ? "14px" : "6px",
                        height: "6px",
                        background: j === activeIA ? IA_COLORS[j % IA_COLORS.length] : "#9db0ac",
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
            <span className={`text-[10px] text-az-platinum whitespace-nowrap ${numIAs === 1 ? "ml-auto" : ""}`}>
              Optimal: {iaSt.optPow}% power · CV {iaSt.optCv}
            </span>
            {numIAs > 1 && (
              <Button
                variant="outline" size="sm"
                onClick={() => setSharedX(sx => !sx)}
                className={`ml-auto text-[10px] h-6 px-2.5 gap-1 transition-colors ${
                  sharedX
                    ? "bg-az-navy/10 border-az-navy/40 text-az-navy"
                    : "border-az-platinum text-az-graphite hover:border-az-mulberry hover:text-az-mulberry"
                }`}
              >
                {sharedX ? "Own axis" : "Share x-axis"}
              </Button>
            )}
          </div>

          <Plot
            key={`ia-${activeIA}`}
            data={iaData}
            layout={iaLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "340px" }}
            onInitialized={(_, div) => setIaDivs(prev => prev[activeIA] === div ? prev : prev.map((d, i) => i === activeIA ? div : d))}
            onUpdate={(_, div)       => setIaDivs(prev => prev[activeIA] === div ? prev : prev.map((d, i) => i === activeIA ? div : d))}
            onRelayout={makeCvRelayout(
              iaDivs[activeIA],
              [{ key: "xaxis2", events: iaSt.events, labels: iaSt.cvs, optEvent: iaSt.optEv }],
              iaXRange[0], iaXRange[1],
            )}
          />
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <ChartButtons div={iaDivs[activeIA]} name={`gs-intersect-IA${numIAs > 1 ? activeIA + 1 : ""}`} axes={AXES_SINGLE} />
          </div>
        </div>

        {/* FA card */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: FA_COLOR }} />
            <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              Final Analysis
            </h3>
            <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
              Optimal: {optimal_FA.power}% power · CV {optimal_FA.cv_FA.toFixed(3)}
            </span>
          </div>
          <Plot
            data={faData}
            layout={faLayout}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "340px" }}
            onInitialized={(_, div) => setFaDiv(div)}
            onUpdate={(_, div)       => setFaDiv(div)}
            onRelayout={makeCvRelayout(
              faDiv,
              [{ key: "xaxis2", events: eventsFA, labels: cvFA, optEvent: optimal_FA.events_FA }],
              faXRange[0], faXRange[1],
            )}
          />
          <div className="flex justify-end gap-2 px-5 pb-4 pt-2">
            <ChartButtons div={faDiv} name="gs-intersect-FA" axes={AXES_SINGLE} />
          </div>
        </div>
      </div>

      {/* ── Combined view ── */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1">
          <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
            Combined View
          </h3>
          <span className="text-[10px] text-az-platinum">
            {numIAs === 1 ? "IA + FA overlaid" : `${numIAs} IAs + FA overlaid`}
          </span>
          {/* Log/linear scale toggle */}
          <Button
            variant="outline" size="sm"
            onClick={() => setLogScale(ls => !ls)}
            className={`ml-auto text-[10px] h-6 px-2.5 gap-1 transition-colors ${
              logScale
                ? "bg-az-navy/10 border-az-navy/40 text-az-navy"
                : "border-az-platinum text-az-graphite hover:border-az-mulberry hover:text-az-mulberry"
            }`}
          >
            {logScale ? "Linear scale" : "Log scale"}
          </Button>
        </div>

        <Plot
          data={overlayData}
          layout={overlayLayout}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "460px" }}
          onInitialized={(_, div) => setOverlayDiv(div)}
          onUpdate={(_, div)       => setOverlayDiv(div)}
          onRelayout={numK === 2
            ? makeCvRelayout(
                overlayDiv,
                [
                  { key: "xaxis2", events: stagesData[0].events, labels: stagesData[0].cvs, optEvent: stagesData[0].optEv },
                  { key: "xaxis3", events: eventsFA, labels: cvFA, optEvent: optimal_FA.events_FA },
                ],
                xMin, xMax,
              )
            : () => undefined}
        />

        {/* Legend + controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {overlayLegendItems.map(({ label, optLabel, color, optColor, visIdx, dash }) => (
              <button
                key={visIdx}
                onClick={() => setVis(v => v.map((val, idx) => idx === visIdx ? !val : val))}
                className={`flex items-center gap-1.5 text-xs transition-opacity ${vis[visIdx] ? "opacity-100" : "opacity-35"}`}
              >
                <svg width="22" height="10" viewBox="0 0 22 10">
                  <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dash ? "4 3" : "none"} />
                  <circle cx="11" cy="5" r="3.5" fill={color} />
                </svg>
                <span className="text-az-graphite font-medium">{label}</span>
                <svg width="10" height="10" viewBox="0 0 14 14" className="ml-0.5">
                  <polygon points="7,1 8.5,5.5 13,5.5 9.5,8.5 10.8,13 7,10.2 3.2,13 4.5,8.5 1,5.5 5.5,5.5" fill={optColor} />
                </svg>
                <span className="text-az-graphite">{optLabel}</span>
              </button>
            ))}
          </div>
          <ChartButtons div={overlayDiv} name="gs-intersect-combined" axes={numK === 2 ? AXES_OVL_K2 : AXES_OVL_KN} />
        </div>

        {logScale && (
          <p className="text-[10px] text-az-platinum px-5 pb-3 italic">
            Log scale — curves with very different absolute utilities are easier to compare. Early IAs with OBF spending can show high utility because LR(+) = power / alpha_spent is large when alpha spent is near zero.
          </p>
        )}
        {!logScale && (
          <p className="text-[11px] text-az-platinum px-5 pb-3">
            Click legend items to show/hide curves · Switch to Log scale if one curve dominates
          </p>
        )}
      </div>
    </div>
  );
}
