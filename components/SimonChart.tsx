"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { SimonResult, SimonInputs } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: SimonResult[];
  optimal: SimonResult;
  inputs:  SimonInputs;
}

const CURVE_COLOR   = "#003865";   // AZ navy
const VLINE_COLOR   = "#830051";   // AZ mulberry

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vline = (x: number, yRange: number[], color: string, dash: "solid" | "dash"): any => ({
  x: [x, x], y: [yRange[0], yRange[1]],
  type: "scatter", mode: "lines",
  line:      { color, width: dash === "solid" ? 2 : 1.5, dash },
  hoverinfo: "skip" as const,
  showlegend: false, xaxis: "x", yaxis: "y",
});

const yHeadroom = (arr: number[]) => {
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = mx - mn || 1;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

export function SimonChart({ results, optimal, inputs }: Props) {
  const [chartDiv, setChartDiv] = useState<HTMLElement | null>(null);
  const [mounted,  setMounted]  = useState(false);
  useEffect(() => setMounted(true), []);

  // Sort by N ascending so the line draws correctly
  const sorted = [...results].sort((a, b) => a.n - b.n);

  const ns       = sorted.map(r => r.n);
  const utils    = sorted.map(r => r.utility);
  const cvLabels = sorted.map(r => r.cv_fa.toFixed(4));
  const powers   = sorted.map(r => `${r.power}%`);
  const customData = sorted.map(r => [r.r1, r.n1, r.r, r.cv_fa, r.en0, r.p_early_stop]);

  const xPad = [Math.min(...ns) * 0.95, Math.max(...ns) * 1.02];
  const yRange = yHeadroom(utils);

  // ── Pixel-gap yaxis2 (power % on right axis) ──────────────────────────────
  // Same algorithm as UtilityChart: greedy forward pass enforcing minGap,
  // then force-include the optimal point.
  const sortedByUtil = [...sorted].sort((a, b) => a.utility - b.utility);
  const ySpan  = yRange[1] - yRange[0];
  const minGap = ySpan > 0 ? (14 * ySpan) / 214 : 0;
  const optUtil = optimal.utility;

  const greedy: SimonResult[] = [];
  let lastU = -Infinity;
  for (const r of sortedByUtil) {
    if (r.utility - lastU >= minGap) { greedy.push(r); lastU = r.utility; }
  }
  let thinned = greedy;
  if (!greedy.some(r => Math.abs(r.utility - optUtil) < 1e-9)) {
    const optRow = sortedByUtil.find(r => Math.abs(r.utility - optUtil) < 1e-9);
    if (optRow) {
      const withOpt = [...greedy, optRow].sort((a, b) => a.utility - b.utility);
      const regreedy: SimonResult[] = [];
      let last2 = -Infinity;
      for (const r of withOpt) {
        const isOpt = Math.abs(r.utility - optUtil) < 1e-9;
        if (isOpt || r.utility - last2 >= minGap) {
          regreedy.push(r);
          last2 = r.utility;
        }
      }
      thinned = regreedy;
    }
  }

  // ── Plotly traces ──────────────────────────────────────────────────────────
  const data = [
    // Vertical reference line at optimal N (behind curve)
    vline(optimal.n, yRange, VLINE_COLOR, "solid"),

    // Main utility curve
    {
      x: ns, y: utils,
      type: "scatter", mode: "lines+markers",
      line:   { color: CURVE_COLOR, width: 2.5 },
      marker: { color: CURVE_COLOR, size: 6 },
      text:   powers,
      customdata: customData,
      hovertemplate:
        "<b>Power: %{text}</b><br>" +
        "N: %{x}<br>" +
        "r₁ / n₁: %{customdata[0]} / %{customdata[1]}<br>" +
        "r / n: %{customdata[2]} / %{x}<br>" +
        "CV_FA: %{customdata[3]:.4f}<br>" +
        "EN₀: %{customdata[4]:.1f}<br>" +
        "P(stop|H₀): %{customdata[5]:.2%}<br>" +
        "Utility: %{y:.4f}" +
        "<extra></extra>",
      showlegend: false, xaxis: "x", yaxis: "y",
    },

    // Invisible anchor trace forces Plotly to render xaxis2 (CV top axis)
    {
      x: ns, y: ns.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    },

    // Ghost trace forces Plotly to render yaxis2 (power% right axis)
    {
      x: [null], y: [null],
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 0 }, showlegend: false,
      xaxis: "x", yaxis: "y2", hoverinfo: "skip" as const,
    },
  ];

  const layout = {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:   { family: "Inter, sans-serif", color: "#3f4444" },
    margin: { t: 76, r: 56, b: 50, l: 72 },
    hovermode: "closest",
    xaxis: {
      ...baseAxis,
      title: { text: "Total N" },
      range: xPad,
    },
    xaxis2: {
      overlaying: "x", side: "top", matches: "x",
      tickvals:  ns, ticktext: cvLabels,
      tickangle: -45,
      tickfont:  { color: CURVE_COLOR, size: 9 },
      title: { text: "Critical Value FA (CV_FA)", font: { color: CURVE_COLOR, size: 10 } },
      range: xPad, showgrid: false, zeroline: false,
      showline: true, linecolor: CURVE_COLOR, ticks: "outside",
    },
    yaxis: {
      ...baseAxis,
      title: { text: "Utility Score" },
      range: yRange,
      tickvals: thinned.map(r => r.utility),
      ticktext: thinned.map(r => r.utility.toFixed(4)),
    },
    yaxis2: {
      overlaying: "y", side: "right",
      range: yRange,
      tickvals: thinned.map(r => r.utility),
      ticktext: thinned.map(r => `${r.power.toFixed(1)}%`),
      tickfont: { color: CURVE_COLOR, size: 9 },
      title: { text: "Power %", font: { color: CURVE_COLOR, size: 10 } },
      showgrid: false, zeroline: false,
      showline: true, linecolor: CURVE_COLOR, ticks: "outside",
    },
  };

  // ── Zoom: update CV tick density ──────────────────────────────────────────
  const handleRelayout = (relayoutData: Record<string, unknown>) => {
    if (!chartDiv || !getPlotly()) return;
    const hasRange     = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAutorange = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAutorange) return;

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : xPad[0];
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : xPad[1];

    const labelMap = new Map(ns.map((n, i) => [n, cvLabels[i]]));
    const visible  = ns.filter(n => n >= lo && n <= hi);
    const stride   = visible.length > 12 ? 3 : visible.length > 6 ? 2 : 1;
    const strided  = visible.filter((_, i) => i % stride === 0);
    const unique   = [...new Set([...strided, ...(visible.includes(optimal.n) ? [optimal.n] : [])])].sort((a, b) => a - b);

    getPlotly().relayout(chartDiv, {
      "xaxis2.tickvals": unique,
      "xaxis2.ticktext": unique.map(n => labelMap.get(n) ?? ""),
    });
  };

  // ── PNG export ─────────────────────────────────────────────────────────────
  const handleDownloadPng = async () => {
    if (!chartDiv || !getPlotly()) return;
    const Plotly = getPlotly();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divAny = chartDiv as any;
    const currentData   = divAny.data   ?? [];
    const currentLayout = divAny.layout ?? {};

    const title = `Simon 2-Stage · H₀: ${(inputs.pu * 100).toFixed(0)}% · H₁: ${(inputs.pa * 100).toFixed(0)}% · α = ${(inputs.ep1 * 100).toFixed(0)}%`;

    // Label the solid vline in the legend for the export
    const exportData = currentData.map((trace: Record<string, unknown>) => {
      if (
        trace.mode === "lines" &&
        Array.isArray(trace.x) &&
        (trace.x as number[]).length === 2 &&
        (trace.x as number[])[0] === (trace.x as number[])[1]
      ) {
        return { ...trace, showlegend: true, name: `Optimal N = ${optimal.n}` };
      }
      return trace;
    });

    const exportLayout = {
      ...currentLayout,
      title: {
        text: title,
        font: { family: "Inter, sans-serif", size: 13, color: "#1a2e44" },
        x: 0.5, xanchor: "center",
      },
      showlegend: true,
      legend: {
        orientation: "h", x: 0.5, xanchor: "center", y: -0.22,
        font: { family: "Inter, sans-serif", size: 10, color: "#3f4444" },
      },
      margin: {
        ...currentLayout.margin,
        b: (currentLayout.margin?.b ?? 50) + 50,
        t: (currentLayout.margin?.t ?? 76) + 40,
      },
    };

    const url: string = await Plotly.toImage(
      { data: exportData, layout: exportLayout },
      { format: "png", scale: 2, width: chartDiv.clientWidth, height: chartDiv.clientHeight + 90 },
    );
    const a = document.createElement("a");
    a.href = url; a.download = "simon-utility.png";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const resetView = () => {
    if (!chartDiv || !getPlotly()) return;
    getPlotly().relayout(chartDiv, { "xaxis.autorange": true, "yaxis.autorange": true });
  };

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CURVE_COLOR }} />
        <h3
          className="text-xs font-semibold text-az-navy"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Utility Curve
        </h3>
        <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
          Optimal: {optimal.power}% power · N = {optimal.n} · CV_FA = {optimal.cv_fa.toFixed(4)}
        </span>
      </div>

      <div style={{ height: "360px" }}>
        {mounted && (
          <Plot
            data={data as Plotly.Data[]}
            layout={layout as Partial<Plotly.Layout>}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "360px" }}
            onInitialized={(_, div) => setChartDiv(div)}
            onUpdate={(_, div)       => setChartDiv(div)}
            onRelayout={handleRelayout}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-5 pb-4 pt-2">
        <p className="text-[10px] text-az-platinum">
          Drag to zoom · Double-click to reset
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={resetView}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={handleDownloadPng}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <ImageDown className="w-3 h-3" /> PNG
          </Button>
        </div>
      </div>
    </div>
  );
}
