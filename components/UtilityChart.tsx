"use client";

import { useState, useEffect } from "react";
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
const IA_OPT_COLORS = ["#f43f5e", "#fb7185", "#ec4899"] as const;
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

// Build initial CV tick arrays — stride controls density, always includes all pinned events.
const makeInitTicks = (
  events: number[],
  labels: string[],
  optEvent: number | number[],
  stride: number,
  startIdx = 0,
) => {
  const labelMap = new Map(events.map((e, i) => [e, labels[i]]));
  const strided  = events.filter((_, i) => i >= startIdx && (i - startIdx) % stride === 0);
  const pins     = Array.isArray(optEvent) ? optEvent : [optEvent];
  const unique   = [...new Set([...strided, ...pins])].sort((a, b) => a - b);
  return { vals: unique, labels: unique.map(e => labelMap.get(e) ?? "") };
};

const yHeadroom = (arr: number[]) => {
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = mx - mn;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

// Snug x-range for a single chart's event array (no shared-range cramping)
const xPad = (events: number[]) => [Math.min(...events) * 0.95, Math.max(...events) * 1.02];

// Greedy label-placement: returns a Plotly textposition for each point such that
// labels avoid each other, nearby markers, and the other curves.
// curveSamples[i] is the array of {x,y} data points for the i-th series.
function smartTextPositions(
  points: Array<{ x: number; y: number }>,
  xRange: number[],
  yRange: number[],
  curveSamples?: Array<Array<{ x: number; y: number }>>,
): string[] {
  const xs = xRange[1] - xRange[0];
  const ys = yRange[1] - yRange[0];
  if (xs === 0 || ys === 0) return points.map(() => "top right");

  const nx = points.map(p => (p.x - xRange[0]) / xs);
  const ny = points.map(p => (p.y - yRange[0]) / ys);

  // Approximate label half-size in normalised units
  const LW = 0.14, LH = 0.09;
  // Centroid of label box relative to anchor
  const OFFSET: Record<string, [number, number]> = {
    "top right":    [ LW * 0.55,  LH],
    "top left":     [-LW * 0.55,  LH],
    "bottom right": [ LW * 0.55, -LH],
    "bottom left":  [-LW * 0.55, -LH],
  };
  const CANDS = Object.keys(OFFSET) as Array<keyof typeof OFFSET>;

  const chosen: string[] = [];

  for (let i = 0; i < points.length; i++) {
    let best = nx[i] >= 0.5 ? "top left" : "top right";
    let bestScore = Infinity;

    for (const cand of CANDS) {
      const [ox, oy] = OFFSET[cand];
      const lx = nx[i] + ox, ly = ny[i] + oy;
      let score = 0;

      // Penalise overlap with already-placed labels
      for (let j = 0; j < i; j++) {
        const [pox, poy] = OFFSET[chosen[j]];
        const plx = nx[j] + pox, ply = ny[j] + poy;
        const dx = Math.abs(lx - plx), dy = Math.abs(ly - ply);
        if (dx < LW * 1.2 && dy < LH * 1.2) {
          score += 10 * (1 - dx / (LW * 1.2)) * (1 - dy / (LH * 1.2));
        }
      }

      // Penalise proximity to other star icons (large radius — stars are big)
      for (let j = 0; j < points.length; j++) {
        if (j === i) continue;
        const dx = Math.abs(lx - nx[j]), dy = Math.abs(ly - ny[j]);
        if (dx < LW * 1.1 && dy < LH * 1.2) score += 12;
        else if (dx < LW * 1.6 && dy < LH * 1.6) score += 4;
      }

      // Penalise proximity to other curves.
      // Hard penalty when a curve point falls inside the label box; soft gradient outside.
      if (curveSamples) {
        for (let ci = 0; ci < curveSamples.length; ci++) {
          if (ci === i) continue; // skip own curve
          for (const pt of curveSamples[ci]) {
            const cpx = (pt.x - xRange[0]) / xs;
            const cpy = (pt.y - yRange[0]) / ys;
            const dx = Math.abs(lx - cpx), dy = Math.abs(ly - cpy);
            // Hard: curve point is inside the label bounding box
            if (dx < LW * 0.65 && dy < LH * 0.9) {
              score += 20;
            } else if (dx < LW * 1.3 && dy < LH * 1.8) {
              // Soft: curve point near (but outside) label box
              score += 8 * (1 - dx / (LW * 1.3)) * (1 - dy / (LH * 1.8));
            }
          }
        }
      }

      // Small penalty for going out of chart bounds
      if (lx < 0.02 || lx > 0.98 || ly < 0 || ly > 1.1) score += 3;

      if (score < bestScore) { bestScore = score; best = cand; }
    }

    chosen.push(best);
  }

  return chosen;
}

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
  const [mounted,    setMounted]    = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Per-stage data ────────────────────────────────────────────────────
  const stagesData = Array.from({ length: numIAs }, (_, j) => {
    const events = results.map(r => r.ia_stages?.[j]?.events ?? r.events_IA);
    const utils  = results.map(r => r.ia_stages?.[j]?.utility ?? r.utility_IA);
    const cvs    = results.map(r => (r.ia_stages?.[j]?.cv ?? r.cv_IA).toFixed(3));
    const opt    = optimal_IAs?.[j] ?? optimal_IA;
    const optEv  = opt.ia_stages?.[j]?.events  ?? opt.events_IA;
    const optUt  = opt.ia_stages?.[j]?.utility ?? opt.utility_IA;
    const optCv  = (opt.ia_stages?.[j]?.cv ?? opt.cv_IA).toFixed(3);
    const optPow       = opt.power;
    // IA-specific cumulative power (may differ from optPow which is the FA target)
    const optIAPow     = opt.ia_stages?.[j]?.power ?? opt.power_IA ?? opt.power;
    // Events at this IA stage under the FA-optimal design — pinned as cross-reference tick
    const faOptEvAtStage = optimal_FA.ia_stages?.[j]?.events ?? optimal_FA.events_IA;
    const sorted = [...results].sort((a, b) =>
      (a.ia_stages?.[j]?.utility ?? a.utility_IA) - (b.ia_stages?.[j]?.utility ?? b.utility_IA)
    );
    return { events, utils, cvs, opt, optEv, optUt, optCv, optPow, optIAPow, faOptEvAtStage, sorted };
  });

  const eventsFA  = results.map(r => r.events_FA);
  const utilFA    = results.map(r => r.utility_FA);
  const cvFA      = results.map(r => r.cv_FA.toFixed(3));
  const powerLbls = results.map(r => `${r.power}%`);
  const sortedFA  = [...results].sort((a, b) => a.utility_FA - b.utility_FA);

  const iaSt    = stagesData[activeIA];
  const iaColor = IA_COLORS[activeIA % IA_COLORS.length];

  // Global x-range spans all analyses (used by combined overlay and sharedX mode).
  const allEvents = [...stagesData.flatMap(s => s.events), ...eventsFA];
  const xMin      = Math.min(...allEvents) * 0.95;
  const xMax      = Math.max(...allEvents) * 1.02;
  const xRange    = [xMin, xMax];
  const faXRange  = xPad(eventsFA);

  // y ranges
  const faYRange  = yHeadroom(utilFA);
  const yRangeAll = yHeadroom([...stagesData.flatMap(s => s.utils), ...utilFA]);

  // ── Dynamic CV tick density on zoom ───────────────────────────────────
  const makeCvRelayout = (
    divRef: HTMLElement | null,
    axes: { key: string; events: number[]; labels: string[]; optEvent: number | number[] }[],
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
      const pins     = Array.isArray(optEvent) ? optEvent : [optEvent];
      const unique   = [...new Set([...strided, ...pins.filter(e => visible.includes(e))])].sort((a, b) => a - b);
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

  // Build a PNG from the div's current figure but with an injected title + legend,
  // without touching the live chart. vlines get named entries in the legend.
  const downloadPngWithMeta = async (
    div: HTMLElement | null,
    name: string,
    title: string,
    solidLabel: string,
    dashedLabel: string | null,
  ) => {
    if (!div || !getPlotly()) return;
    const Plotly = getPlotly();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divAny = div as any;
    const currentData: PlotlyTrace[] = divAny.data ?? [];
    const currentLayout = divAny.layout ?? {};

    const exportData = currentData.map((trace: PlotlyTrace) => {
      if (trace.mode === "lines" && Array.isArray(trace.x) && trace.x.length === 2 && trace.x[0] === trace.x[1]) {
        const isDashed = trace.line?.dash === "dash";
        if (!isDashed && solidLabel)  return { ...trace, showlegend: true, name: solidLabel };
        if (isDashed  && dashedLabel) return { ...trace, showlegend: true, name: dashedLabel };
      }
      return trace;
    });

    const exportLayout = {
      ...currentLayout,
      title: { text: title, font: { family: "Inter, sans-serif", size: 13, color: "#1a2e44" }, x: 0.5, xanchor: "center" },
      showlegend: true,
      legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.22, font: { family: "Inter, sans-serif", size: 10, color: "#3f4444" } },
      // +40 on top clears the title above the CV (xaxis2) labels; +50 on bottom fits the legend
      margin: { ...currentLayout.margin, b: (currentLayout.margin?.b ?? 50) + 50, t: (currentLayout.margin?.t ?? 76) + 40 },
    };

    const url: string = await Plotly.toImage(
      { data: exportData, layout: exportLayout },
      { format: "png", scale: 2, width: div.clientWidth, height: div.clientHeight + 90 },
    );
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Overlay PNG: curve traces get named legend entries; stars are suppressed from legend.
  const downloadOverlayPng = async (div: HTMLElement | null, name: string) => {
    if (!div || !getPlotly()) return;
    const Plotly = getPlotly();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divAny = div as any;
    const currentData: PlotlyTrace[] = divAny.data ?? [];
    const currentLayout = divAny.layout ?? {};

    const curveLabels = [
      ...stagesData.map((_, j) => numIAs === 1 ? "Interim Analysis" : `IA Stage ${j + 1}`),
      "Final Analysis",
    ];
    let curveIdx = 0;
    const exportData = currentData.map((trace: PlotlyTrace) => {
      if (trace.mode === "lines+markers" && Array.isArray(trace.x) && trace.x.length > 2) {
        return { ...trace, showlegend: true, name: curveLabels[curveIdx++] ?? trace.name };
      }
      return trace;
    });

    const exportTitle = numIAs === 1
      ? "Combined View — IA + FA Utility"
      : `Combined View — ${numIAs} IAs + FA Utility`;

    const exportLayout = {
      ...currentLayout,
      title: { text: exportTitle, font: { family: "Inter, sans-serif", size: 13, color: "#1a2e44" }, x: 0.5, xanchor: "center" },
      showlegend: true,
      legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18, font: { family: "Inter, sans-serif", size: 10, color: "#3f4444" } },
      margin: { ...currentLayout.margin, b: (currentLayout.margin?.b ?? 52) + 50, t: (currentLayout.margin?.t ?? 76) + 40 },
    };

    const url: string = await Plotly.toImage(
      { data: exportData, layout: exportLayout },
      { format: "png", scale: 2, width: div.clientWidth, height: div.clientHeight + 90 },
    );
    const a = document.createElement("a");
    a.href = url; a.download = `${name}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const ChartButtons = ({ div, name, axes, onDownload }: { div: HTMLElement | null; name: string; axes: string[]; onDownload?: () => void }) => (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => resetView(div, axes)}
        className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
        <RotateCcw className="w-3 h-3" /> Reset
      </Button>
      <Button variant="outline" size="sm" onClick={() => onDownload ? onDownload() : undefined}
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
    powerLabel?: string,
    powerExtractor?: (r: DesignResult) => number,
  ): Partial<Plotly.Layout> => {
    const getUtil  = utilExtractor  ?? ((r: DesignResult) => r[utilKey]);
    const getPower = powerExtractor ?? ((r: DesignResult) => r.power);
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
      yaxis2: (() => {
        // Thin ticks so labels never overlap. Plot area height ≈ 214 px; allow 13 px/label.
        const maxTicks = Math.max(2, Math.floor(214 / 13));
        const n = sortedRows.length;
        const stride = Math.max(1, Math.ceil(n / maxTicks));
        const optUtil = n > 0 ? Math.max(...sortedRows.map(r => getUtil(r))) : 0;
        const thinned = sortedRows.filter((r, i) =>
          Math.abs(getUtil(r) - optUtil) < 1e-9 || i % stride === 0
        );
        return {
          overlaying: "y", side: "right",
          range: yRange,
          tickvals: thinned.map(r => getUtil(r)),
          ticktext: thinned.map(r => `${getPower(r).toFixed(1)}%`),
          tickfont: { color: accentColor, size: 9 },
          title: { text: powerLabel ?? "Power %", font: { color: accentColor, size: 10 } },
          showgrid: false, zeroline: false,
          showline: true, linecolor: accentColor, ticks: "outside",
        } as Partial<Plotly.LayoutAxis>;
      })(),
    };
  };

  // Vertical reference line — solid for the chart's own optimal, dashed for the cross-optimal.
  // Drawn before the curve so it sits behind all data.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vline = (x: number, yRange: number[], color: string, dash: "solid" | "dash", hoverLabel: string, extra?: { cv?: string; power?: number; utility?: number }): any => ({
    x: [x, x], y: [yRange[0], yRange[1]],
    type: "scatter", mode: "lines",
    line: { color, width: dash === "solid" ? 2 : 1.5, dash },
    hovertemplate: extra
      ? `<b>${hoverLabel}</b><br>Events: ${x}${extra.power !== undefined ? `<br>Power: ${extra.power.toFixed(1)}%` : ""}${extra.cv ? `<br>CV: ${extra.cv}` : ""}${extra.utility !== undefined ? `<br>Utility: ${extra.utility.toFixed(4)}` : ""}<extra></extra>`
      : `${hoverLabel}<br>Events: ${x}<extra></extra>`,
    showlegend: false, xaxis: "x", yaxis: "y",
  });

  // Small inline legend explaining the two vertical bar styles used in single charts.
  const VlineLegend = ({ color, thisLabel, otherLabel }: { color: string; thisLabel: string; otherLabel: string }) => (
    <div className="flex items-center gap-3 text-[10px] text-az-graphite">
      <span className="flex items-center gap-1">
        <svg width="10" height="16" viewBox="0 0 10 16">
          <line x1="5" y1="0" x2="5" y2="16" stroke={color} strokeWidth="2" />
        </svg>
        {thisLabel}
      </span>
      <span className="flex items-center gap-1">
        <svg width="10" height="16" viewBox="0 0 10 16">
          <line x1="5" y1="0" x2="5" y2="16" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
        {otherLabel}
      </span>
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const optStar = (x: number, y: number, cv: string, power: number, color: string, label: string, chartXRange?: number[], forcedPos?: string): any => {
    // Use forced position (from collision algorithm) or fall back to x-midpoint heuristic
    const xMid = chartXRange ? (chartXRange[0] + chartXRange[1]) / 2 : x;
    const textposition = forcedPos ?? (x >= xMid ? "top left" : "top right");
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

  // ── IA chart data — computed for ALL stages (enables multi-stage PDF) ─────
  // Non-active charts are kept in the DOM at opacity-0 so Plotly pre-renders them.
  // Print CSS reveals them all stacked.
  const allIACharts = stagesData.map((st, j) => {
    const color   = IA_COLORS[j % IA_COLORS.length];
    const jXRange = sharedX ? xRange : xPad(st.events);
    const jYRange = yHeadroom(st.utils);
    const naturalW = xPad(st.events)[1] - xPad(st.events)[0];
    const rangeW   = jXRange[1] - jXRange[0];
    const stride      = Math.min(6, Math.max(1, Math.round(2 * rangeW / naturalW)));
    // Events at this IA stage under the FA-optimal design (cross-reference)
    const faOptEvAtIA = optimal_FA.ia_stages?.[j]?.events ?? optimal_FA.events_IA;
    const init        = makeInitTicks(st.events, st.cvs, [st.optEv, faOptEvAtIA], stride);
    const faOptCvAtStage = (optimal_FA.ia_stages?.[j]?.cv ?? optimal_FA.cv_IA).toFixed(3);
    const data: Plotly.Data[] = [
      // Reference lines behind the curve (solid = IA-optimal, dashed = FA-optimal)
      vline(st.optEv, jYRange, color, "solid", `Optimal N for IA${numIAs > 1 ? ` ${j + 1}` : ""}`, { cv: st.optCv, power: st.optIAPow, utility: st.optUt }),
      ...(faOptEvAtIA !== st.optEv
        ? [vline(faOptEvAtIA, jYRange, color, "dash", "Optimal N for FA (reference)", { cv: faOptCvAtStage, power: optimal_FA.power })]
        : []),
      {
        x: st.events, y: st.utils, type: "scatter", mode: "lines+markers",
        line: { color, width: 2.5 }, marker: { color, size: 6 },
        text: powerLbls, customdata: results.map(r => r.ia_stages?.[j]?.cv ?? r.cv_IA),
        hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
        showlegend: false, xaxis: "x", yaxis: "y",
      },
      {
        x: init.vals, y: init.vals.map(() => null as unknown as number),
        type: "scatter", mode: "markers",
        marker: { opacity: 0, size: 1 }, showlegend: false,
        xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
      },
      // Ghost trace — forces Plotly to render yaxis2 (power axis) even without real data on it
      {
        x: [null], y: [null], type: "scatter", mode: "markers",
        marker: { opacity: 0, size: 0 }, showlegend: false,
        xaxis: "x", yaxis: "y2", hoverinfo: "skip" as const,
      },
    ];
    const layout = singleLayout(
      init.vals, init.labels, st.sorted,
      "utility_IA", color, jYRange, jXRange,
      (r) => r.ia_stages?.[j]?.utility ?? r.utility_IA,
      "IA Power %",
      (r) => r.ia_stages?.[j]?.power ?? r.power_IA ?? r.power,
    );
    return { data, layout, jXRange, init, color };
  });

  // ── FA chart data ─────────────────────────────────────────────────────
  const faInit = makeInitTicks(eventsFA, cvFA, optimal_FA.events_FA, 2);

  // Events at FA under the IA-optimal design (cross-reference)
  const iaOptEvAtFA = optimal_IA.events_FA;
  const faData: Plotly.Data[] = [
    // Reference lines behind the curve (solid = FA-optimal, dashed = IA-optimal)
    vline(optimal_FA.events_FA, faYRange, FA_COLOR, "solid", "Optimal N for FA", { cv: optimal_FA.cv_FA.toFixed(3), power: optimal_FA.power, utility: optimal_FA.utility_FA }),
    ...(iaOptEvAtFA !== optimal_FA.events_FA
      ? [vline(iaOptEvAtFA, faYRange, FA_COLOR, "dash", "Optimal N for IA (reference)", { cv: optimal_IA.cv_FA.toFixed(3), power: optimal_IA.power })]
      : []),
    {
      x: eventsFA, y: utilFA, type: "scatter", mode: "lines+markers",
      line: { color: FA_COLOR, width: 2.5, dash: "dot" }, marker: { color: FA_COLOR, size: 6 },
      text: powerLbls, customdata: results.map(r => r.cv_FA),
      hovertemplate: "<b>Power: %{text}</b><br>Events: %{x}<br>CV: %{customdata:.4f}<br>Utility: %{y:.4f}<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },
    {
      x: faInit.vals, y: faInit.vals.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },
    // Ghost trace — forces Plotly to render yaxis2 (power axis)
    {
      x: [null], y: [null], type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 0 }, showlegend: false,
      xaxis: "x", yaxis: "y2", hoverinfo: "skip" as const,
    },
  ];

  const faLayout = singleLayout(faInit.vals, faInit.labels, sortedFA, "utility_FA", FA_COLOR, faYRange, faXRange, undefined, "FA Cumul. Power %");

  // ── Overlay data ──────────────────────────────────────────────────────
  // Pre-compute non-overlapping label positions for all overlay stars
  const overlayStarPts = [
    ...stagesData.map(st => ({ x: st.optEv, y: st.optUt })),
    { x: optimal_FA.events_FA, y: optimal_FA.utility_FA },
  ];
  const overlayCurveSamples = [
    ...stagesData.map(st => st.events.map((e, idx) => ({ x: e, y: st.utils[idx] }))),
    eventsFA.map((e, idx) => ({ x: e, y: utilFA[idx] })),
  ];
  const overlayTextPos = smartTextPositions(overlayStarPts, xRange, yRangeAll, overlayCurveSamples);

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
        { ...optStar(st.optEv, st.optUt, st.optCv, st.optIAPow, optCol, `Optimal ${label}`, xRange, overlayTextPos[j]), visible: vis[j] ? true : "legendonly" },
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
    { ...optStar(optimal_FA.events_FA, optimal_FA.utility_FA, optimal_FA.cv_FA.toFixed(3), optimal_FA.power, FA_OPT_COLOR, "Optimal FA", xRange, overlayTextPos[numIAs]), visible: vis[numIAs] ? true : "legendonly" },
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
      optLabel: numIAs === 1 ? `Optimal IA (${st.optIAPow}%)` : `Opt IA${j + 1} (${st.optIAPow}%)`,
      color: IA_COLORS[j % IA_COLORS.length],
      optColor: IA_OPT_COLORS[j % IA_OPT_COLORS.length],
      visIdx: j, dash: false,
    })),
    { label: "Final Analysis", optLabel: `Optimal FA (${optimal_FA.power}%)`, color: FA_COLOR, optColor: FA_OPT_COLOR, visIdx: numIAs, dash: true },
  ];

  return (
    <div className="space-y-4">

      {/* ── Side-by-side IA / FA ── */}
      <div className="grid grid-cols-2 gap-3 print:grid-cols-1">

        {/* IA card */}
        <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">

          <div className="flex items-center gap-2 px-5 pt-4 pb-1">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: iaColor }} />
            <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              {numIAs === 1 ? "Interim Analysis" : `Interim Analysis — Stage ${activeIA + 1}`}
            </h3>
            {/* Passive stage dots in header */}
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
            <span className="text-[10px] text-az-platinum whitespace-nowrap ml-auto">
              Optimal: {iaSt.optIAPow}% IA power · CV {iaSt.optCv}
            </span>
          </div>

          {/* All IA stage charts — active one visible, others opacity-0 absolute.
              Print CSS (.ia-chart-wrapper / .ia-chart-slide) stacks all. */}
          <div className="ia-chart-wrapper relative" style={{ height: "340px" }}>
            {allIACharts.map(({ data, layout, jXRange, init }, j) => {
              const isActive = j === activeIA;
              return (
                <div
                  key={j}
                  className={`ia-chart-slide ${isActive ? "relative h-full" : "absolute inset-0 opacity-0 pointer-events-none"}`}
                >
                  {/* Print-only stage label shown above each non-active chart */}
                  {numIAs > 1 && (
                    <div className={`${isActive ? "hidden" : "hidden"} print:flex items-center gap-2 px-5 pt-3 pb-0`}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: IA_COLORS[j % IA_COLORS.length] }} />
                      <span className="text-xs font-semibold text-az-navy">Interim Analysis — Stage {j + 1}</span>
                    </div>
                  )}
                  {mounted && (
                    <Plot
                      data={data}
                      layout={layout}
                      config={{ displayModeBar: false, responsive: true }}
                      style={{ width: "100%", height: "340px" }}
                      onInitialized={(_, div) => setIaDivs(prev => prev[j] === div ? prev : prev.map((d, i) => i === j ? div : d))}
                      onUpdate={(_, div)       => setIaDivs(prev => prev[j] === div ? prev : prev.map((d, i) => i === j ? div : d))}
                      onRelayout={makeCvRelayout(
                        iaDivs[j],
                        [{ key: "xaxis2", events: stagesData[j].events, labels: stagesData[j].cvs, optEvent: [stagesData[j].optEv, stagesData[j].faOptEvAtStage] }],
                        jXRange[0], jXRange[1],
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center px-5 pb-4 pt-2">
            {/* Left zone: vline legend + Share x-axis (k>2 only) */}
            <div className="flex-1 flex items-center gap-3 flex-wrap">
              <VlineLegend color={iaColor} thisLabel="N for IA" otherLabel="N for FA" />
              {numIAs > 1 && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setSharedX(sx => !sx)}
                  className={`text-[10px] h-6 px-2.5 gap-1 transition-colors ${
                    sharedX
                      ? "bg-az-navy/10 border-az-navy/40 text-az-navy"
                      : "border-az-platinum text-az-graphite hover:border-az-mulberry hover:text-az-mulberry"
                  }`}
                >
                  {sharedX ? "Own axis" : "Share x-axis"}
                </Button>
              )}
            </div>
            {/* Stage navigation — ml-4 offsets for Plotly left/right margin asymmetry
                so the nav centres under the "Events" x-axis label */}
            {numIAs > 1 && (
              <div className="flex items-center gap-1.5 ml-4">
                <button
                  onClick={() => setActiveIA(a => a - 1)}
                  disabled={activeIA === 0}
                  aria-label="Previous IA stage"
                  className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm disabled:opacity-25 hover:scale-110 transition-transform"
                  style={{ background: activeIA > 0 ? IA_COLORS[(activeIA - 1) % IA_COLORS.length] : "#9db0ac" }}
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-white" />
                </button>
                {stagesData.map((_, j) => (
                  <button key={j} onClick={() => setActiveIA(j)} aria-label={`Go to IA ${j + 1}`}>
                    <span
                      className="block rounded-full transition-all"
                      style={{
                        width: j === activeIA ? "16px" : "7px",
                        height: "7px",
                        background: j === activeIA ? IA_COLORS[j % IA_COLORS.length] : "#9db0ac",
                      }}
                    />
                  </button>
                ))}
                <button
                  onClick={() => setActiveIA(a => a + 1)}
                  disabled={activeIA === numIAs - 1}
                  aria-label="Next IA stage"
                  className="w-6 h-6 rounded-full flex items-center justify-center shadow-sm disabled:opacity-25 hover:scale-110 transition-transform"
                  style={{ background: activeIA < numIAs - 1 ? IA_COLORS[(activeIA + 1) % IA_COLORS.length] : "#9db0ac" }}
                >
                  <ChevronRight className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            )}
            {/* Right zone: Reset + PNG */}
            <div className="flex-1 flex justify-end gap-2">
              <ChartButtons
                div={iaDivs[activeIA]}
                name={`gs-intersect-IA${numIAs > 1 ? activeIA + 1 : ""}`}
                axes={AXES_SINGLE}
                onDownload={() => downloadPngWithMeta(
                  iaDivs[activeIA],
                  `gs-intersect-IA${numIAs > 1 ? activeIA + 1 : ""}`,
                  numIAs === 1 ? "Interim Analysis — Utility" : `Interim Analysis Stage ${activeIA + 1} — Utility`,
                  "N optimising IA",
                  "N optimising FA (reference)",
                )}
              />
            </div>
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
          {mounted && (
            <Plot
              data={faData}
              layout={faLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "340px" }}
              onInitialized={(_, div) => setFaDiv(div)}
              onUpdate={(_, div)       => setFaDiv(div)}
              onRelayout={makeCvRelayout(
                faDiv,
                [{ key: "xaxis2", events: eventsFA, labels: cvFA, optEvent: [optimal_FA.events_FA, iaOptEvAtFA] }],
                faXRange[0], faXRange[1],
              )}
            />
          )}
          <div className="flex items-center justify-between px-5 pb-4 pt-2">
            <VlineLegend color={FA_COLOR} thisLabel="N for FA" otherLabel="N for IA" />
            <ChartButtons
              div={faDiv}
              name="gs-intersect-FA"
              axes={AXES_SINGLE}
              onDownload={() => downloadPngWithMeta(
                faDiv,
                "gs-intersect-FA",
                "Final Analysis — Utility",
                "N optimising FA",
                "N optimising IA (reference)",
              )}
            />
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

        {mounted && (
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
        )}

        {/* Legend — full-width wrapping row, centred */}
        <div className="flex flex-wrap justify-center gap-2 px-5 pt-2 pb-3">
          {overlayLegendItems.map(({ label, optLabel, color, optColor, visIdx, dash }) => (
            <button
              key={visIdx}
              onClick={() => setVis(v => v.map((val, idx) => idx === visIdx ? !val : val))}
              className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 transition-all select-none ${
                vis[visIdx]
                  ? "border-az-light-platinum bg-white shadow-sm hover:border-az-platinum hover:shadow"
                  : "border-transparent opacity-35 bg-transparent"
              }`}
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

        {/* Bottom bar: hint text (left) + Reset/PNG (right) */}
        <div className="flex items-center justify-between px-5 pb-4 gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-[10px] text-az-platinum">
              Click legend items to show/hide curves · Switch to Log scale if one curve dominates
            </p>
            {logScale && (
              <p className="text-[10px] text-az-platinum italic">
                Log scale: early IAs with OBF spending can show high utility because LR(+) = power&nbsp;/&nbsp;alpha_spent is large when alpha spent is near zero.
              </p>
            )}
          </div>
          <div className="shrink-0">
            <ChartButtons
              div={overlayDiv}
              name="gs-intersect-combined"
              axes={numK === 2 ? AXES_OVL_K2 : AXES_OVL_KN}
              onDownload={() => downloadOverlayPng(overlayDiv, "gs-intersect-combined")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
