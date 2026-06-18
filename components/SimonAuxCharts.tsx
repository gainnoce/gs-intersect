"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { SimonResult, SimonInputs } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: SimonResult[];
  inputs:  SimonInputs;
}

const CURVE_COLOR = "#003865";

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

const yHeadroom = (arr: number[]) => {
  const mn = Math.min(...arr), mx = Math.max(...arr), sp = mx - mn || 1;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

// Greedy pixel-gap thinning — returns subset of items with y-values spread ≥ minGap apart.
// plotHeight ≈ 214px for a 360px card with t:76 r:56 b:50 l:72 margins.
const greedyThin = <T,>(
  items: T[],
  getValue: (item: T) => number,
  yRange: number[],
  pixelBudget = 18,
  plotHeight  = 214,
): T[] => {
  const ySpan  = yRange[1] - yRange[0];
  const minGap = ySpan > 0 ? (pixelBudget * ySpan) / plotHeight : 0;
  const result: T[] = [];
  let last = -Infinity;
  for (const item of items) {
    const v = getValue(item);
    if (v - last >= minGap) { result.push(item); last = v; }
  }
  return result;
};

export function SimonAuxCharts({ results, inputs }: Props) {
  const [lrDiv,   setLrDiv]   = useState<HTMLElement | null>(null);
  const [cvDiv,   setCvDiv]   = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Sort by N ascending — same order as SimonChart
  const sorted   = [...results].sort((a, b) => a.n - b.n);
  const ns       = sorted.map(r => r.n);
  const cvLabels = sorted.map(r => r.cv_fa.toFixed(4));
  const powers   = sorted.map(r => `${r.power}%`);
  const xPad     = [Math.min(...ns) * 0.95, Math.max(...ns) * 1.02];

  // Derived y-series (computable from existing API fields + inputs)
  const plrs     = sorted.map(r => (r.power / 100) / inputs.ep1);
  const cvExcess = sorted.map(r => r.cv_fa - inputs.pu);

  // ── Layout factory ───────────────────────────────────────────────────────
  const makeLayout = (
    yVals:     number[],
    yTitle:    string,
    yDecimals: number,
  ): Partial<Plotly.Layout> => {
    const rows       = sorted.map((r, i) => ({ y: yVals[i], power: r.power }));
    const yRange     = yHeadroom(yVals);
    const sortedRows = [...rows].sort((a, b) => a.y - b.y);

    const leftThinned  = greedyThin(sortedRows, r => r.y, yRange, 18);
    const rightThinned = greedyThin(sortedRows, r => r.y, yRange, 20);

    // Thin the top CV axis to ~8-10 ticks max to avoid overlap
    const cvStride    = Math.max(1, Math.ceil(ns.length / 9));
    const thinnedNs   = ns.filter((_, i) => i % cvStride === 0);
    const labelMap    = new Map(ns.map((n, i) => [n, cvLabels[i]]));
    const thinnedCvTx = thinnedNs.map(n => labelMap.get(n) ?? "");

    return {
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
      } as Partial<Plotly.LayoutAxis>,
      xaxis2: {
        overlaying: "x", side: "top", matches: "x",
        tickvals:  thinnedNs, ticktext: thinnedCvTx,
        tickangle: -45,
        tickfont:  { color: CURVE_COLOR, size: 9 },
        title: { text: "FA ORR% CV", font: { color: CURVE_COLOR, size: 10 } },
        range: xPad, showgrid: false, zeroline: false,
        showline: true, linecolor: CURVE_COLOR, ticks: "outside",
      } as Partial<Plotly.LayoutAxis>,
      yaxis: {
        ...baseAxis,
        title: { text: yTitle },
        range: yRange,
        tickmode: "array",
        tickvals: leftThinned.map(r => r.y),
        ticktext: leftThinned.map(r => r.y.toFixed(yDecimals)),
      } as Partial<Plotly.LayoutAxis>,
      yaxis2: {
        overlaying: "y", side: "right",
        range: yRange,
        tickmode: "array",
        tickvals: rightThinned.map(r => r.y),
        ticktext: rightThinned.map(r => `${r.power.toFixed(1)}%`),
        tickfont: { color: CURVE_COLOR, size: 9 },
        title: { text: "Power %", font: { color: CURVE_COLOR, size: 10 } },
        showgrid: false, zeroline: false,
        showline: true, linecolor: CURVE_COLOR, ticks: "outside",
      } as Partial<Plotly.LayoutAxis>,
    };
  };

  // ── Trace factory ────────────────────────────────────────────────────────
  const makeData = (
    yVals:       number[],
    yHoverLabel: string,
    yHoverFmt:   string,
  ): Plotly.Data[] => [
    {
      x: ns, y: yVals,
      type: "scatter", mode: "lines+markers",
      line:   { color: CURVE_COLOR, width: 2.5 },
      marker: { color: CURVE_COLOR, size: 6 },
      text:   powers,
      customdata: sorted.map(r => r.cv_fa),
      hovertemplate:
        `<b>Power: %{text}</b><br>N: %{x}<br>${yHoverLabel}: %{y:${yHoverFmt}}<br>CV_FA: %{customdata:.4f}<extra></extra>`,
      showlegend: false, xaxis: "x", yaxis: "y",
    } as Plotly.Data,
    // Invisible anchor forces Plotly to render xaxis2 (CV top axis)
    {
      x: ns, y: ns.map(() => null as unknown as number),
      type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 1 }, showlegend: false,
      xaxis: "x2", yaxis: "y", hoverinfo: "skip" as const,
    } as Plotly.Data,
    // Ghost trace forces Plotly to render yaxis2 (power% right axis)
    {
      x: [null], y: [null], type: "scatter", mode: "markers",
      marker: { opacity: 0, size: 0 }, showlegend: false,
      xaxis: "x", yaxis: "y2", hoverinfo: "skip" as const,
    } as Plotly.Data,
  ];

  // ── Zoom: update CV tick density ─────────────────────────────────────────
  const makeRelayout = (divRef: HTMLElement | null) => (relayoutData: Record<string, unknown>) => {
    if (!divRef || !getPlotly()) return;
    const hasRange = relayoutData["xaxis.range[0]"] !== undefined;
    const hasAuto  = !!relayoutData["xaxis.autorange"];
    if (!hasRange && !hasAuto) return;

    const lo = hasRange ? Number(relayoutData["xaxis.range[0]"]) : xPad[0];
    const hi = hasRange ? Number(relayoutData["xaxis.range[1]"]) : xPad[1];

    const labelMap = new Map(ns.map((n, i) => [n, cvLabels[i]]));
    const visible  = ns.filter(n => n >= lo && n <= hi);
    const stride   = visible.length > 12 ? 3 : visible.length > 6 ? 2 : 1;
    const unique   = visible.filter((_, i) => i % stride === 0);

    getPlotly().relayout(divRef, {
      "xaxis2.tickvals": unique,
      "xaxis2.ticktext": unique.map(n => labelMap.get(n) ?? ""),
    });
  };

  // ── PNG export ────────────────────────────────────────────────────────────
  const downloadPng = async (div: HTMLElement | null, filename: string, title: string) => {
    if (!div || !getPlotly()) return;
    const Plotly = getPlotly();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divAny = div as any;
    const exportLayout = {
      ...(divAny.layout ?? {}),
      title: {
        text: title,
        font: { family: "Inter, sans-serif", size: 13, color: "#1a2e44" },
        x: 0.5, xanchor: "center",
      },
      margin: {
        ...(divAny.layout?.margin ?? {}),
        t: ((divAny.layout?.margin?.t) ?? 76) + 40,
        b: ((divAny.layout?.margin?.b) ?? 50) + 50,
      },
    };
    const url: string = await Plotly.toImage(
      { data: divAny.data ?? [], layout: exportLayout },
      { format: "png", scale: 2, width: div.clientWidth, height: div.clientHeight + 90 },
    );
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const resetView = (div: HTMLElement | null) => {
    if (!div || !getPlotly()) return;
    getPlotly().relayout(div, { "xaxis.autorange": true, "yaxis.autorange": true });
  };

  const pngBase = `Simon 2-Stage · H₀: ${(inputs.pu * 100).toFixed(0)}% · H₁: ${(inputs.pa * 100).toFixed(0)}% · α = ${(inputs.ep1 * 100).toFixed(0)}%`;

  const lrData   = makeData(plrs,     "LR(+)",        ".3f");
  const lrLayout = makeLayout(plrs,   "LR(+)",        2);

  const cvData   = makeData(cvExcess, "CV_FA − pu",   ".4f");
  const cvLayout = makeLayout(cvExcess, "FA CV ORR% − lower ref. ORR%", 3);

  return (
    <div className="grid grid-cols-2 gap-3">

      {/* LR(+) card */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CURVE_COLOR }} />
          <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
            Likelihood Ratio LR(+)
          </h3>
          <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
            power / α · α&nbsp;=&nbsp;{inputs.ep1}
          </span>
        </div>
        <div style={{ height: "360px" }}>
          {mounted && (
            <Plot
              data={lrData}
              layout={lrLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "360px" }}
              onInitialized={(_, div) => setLrDiv(div)}
              onUpdate={(_, div)       => setLrDiv(div)}
              onRelayout={makeRelayout(lrDiv)}
            />
          )}
        </div>
        <div className="flex items-center justify-between px-5 pb-4 pt-2">
          <p className="text-[10px] text-az-platinum">Drag to zoom · Double-click to reset</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => resetView(lrDiv)}
              className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => downloadPng(lrDiv, "simon-lr.png", `LR(+) · ${pngBase}`)}
              className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
              <ImageDown className="w-3 h-3" /> PNG
            </Button>
          </div>
        </div>
      </div>

      {/* CV Excess card */}
      <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CURVE_COLOR }} />
          <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
            Minimum Detectable Effect
          </h3>
          <span className="text-[10px] text-az-platinum ml-auto whitespace-nowrap">
            CV_FA − lower ref. ORR ({(inputs.pu * 100).toFixed(0)}%)
          </span>
        </div>
        <div style={{ height: "360px" }}>
          {mounted && (
            <Plot
              data={cvData}
              layout={cvLayout}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "360px" }}
              onInitialized={(_, div) => setCvDiv(div)}
              onUpdate={(_, div)       => setCvDiv(div)}
              onRelayout={makeRelayout(cvDiv)}
            />
          )}
        </div>
        <div className="flex items-center justify-between px-5 pb-4 pt-2">
          <p className="text-[10px] text-az-platinum">Drag to zoom · Double-click to reset</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => resetView(cvDiv)}
              className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
              <RotateCcw className="w-3 h-3" /> Reset
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => downloadPng(cvDiv, "simon-cv-excess.png", `Min. Detectable Effect · ${pngBase}`)}
              className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
              <ImageDown className="w-3 h-3" /> PNG
            </Button>
          </div>
        </div>
      </div>

    </div>
  );
}
