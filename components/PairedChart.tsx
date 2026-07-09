"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { PairedResult, PairedInputs } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results:   PairedResult[];
  optimal_z: PairedResult;
  optimal_t: PairedResult;
  inputs:    PairedInputs;
}

const COLOR_Z = "#003865";
const COLOR_T = "#1469b5";

const baseAxis = {
  gridcolor:     "#ebefee",
  linecolor:     "#9db0ac",
  tickfont:      { color: "#9db0ac", size: 10 },
  zerolinecolor: "#ebefee",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPlotly = () => (window as any).Plotly;

const yPad = (vals: number[]) => {
  const mn = Math.min(...vals), mx = Math.max(...vals), sp = mx - mn || 1;
  return [mn - sp * 0.06, mx + sp * 0.18];
};

const vlineTrace = (x: number, yRange: number[], color: string, dash: "solid" | "dash") => ({
  x: [x, x], y: [yRange[0], yRange[1]],
  type: "scatter" as const, mode: "lines" as const,
  line: { color, width: dash === "solid" ? 2 : 1.5, dash },
  hoverinfo: "skip" as const, showlegend: false,
});

// Re-enables showlegend on named curve traces and injects horizontal bottom legend
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const downloadPng = async (div: HTMLElement | null, filename: string, title: string) => {
  if (!div || !getPlotly()) return;
  const Plotly = getPlotly();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = div as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exportData = (d.data ?? []).map((trace: any) =>
    (trace.name === "Z test" || trace.name === "t test")
      ? { ...trace, showlegend: true }
      : trace
  );

  const exportLayout = {
    ...(d.layout ?? {}),
    title: { text: title, font: { family: "Inter, sans-serif", size: 12, color: "#1a2e44" }, x: 0.5, xanchor: "center" },
    showlegend: true,
    legend: { orientation: "h", x: 0.5, xanchor: "center", y: -0.18,
              font: { family: "Inter, sans-serif", size: 10, color: "#3f4444" } },
    margin: { ...(d.layout?.margin ?? {}), t: (d.layout?.margin?.t ?? 40) + 40, b: (d.layout?.margin?.b ?? 50) + 40 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor:  "#f8faf9",
  };

  const url: string = await Plotly.toImage(
    { data: exportData, layout: exportLayout },
    { format: "png", scale: 3, width: div.clientWidth, height: div.clientHeight + 100 },
  );
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

// Builds a per-point marker size array: visible (~9 evenly spaced) or 0 (invisible)
const markerSizeArray = (len: number, visibleSize: number): number[] => {
  const step  = Math.max(1, Math.round((len - 1) / 8));
  const sparse = new Set<number>();
  for (let i = 0; i < len; i += step) sparse.add(i);
  sparse.add(len - 1);
  return Array.from({ length: len }, (_, i) => (sparse.has(i) ? visibleSize : 0));
};

// Inline HTML legend matching GS Design's VlineLegend style
function SeriesLegend() {
  return (
    <div className="flex items-center gap-4 text-[10px] text-az-graphite">
      <span className="flex items-center gap-1.5">
        <svg width="20" height="10" viewBox="0 0 20 10">
          <line x1="0" y1="5" x2="20" y2="5" stroke={COLOR_Z} strokeWidth="2" />
          <circle cx="10" cy="5" r="2.5" fill={COLOR_Z} />
        </svg>
        Z test
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="10" viewBox="0 0 20 10">
          <line x1="0" y1="5" x2="20" y2="5" stroke={COLOR_T} strokeWidth="1.5" strokeDasharray="4 2" />
          <circle cx="10" cy="5" r="2.5" fill={COLOR_T} />
        </svg>
        t test
      </span>
    </div>
  );
}

interface PanelProps {
  ns:          number[];
  yZ:          number[];
  yT:          number[];
  optZ:        number;
  optT:        number;
  yTitle:      string;
  hoverFmt:    string;
  filename:    string;
  pngTitle:    string;
  showVlines?: boolean;
  alpha?:      number;
}

function Panel({ ns, yZ, yT, optZ, optT, yTitle, hoverFmt, filename, pngTitle,
                 showVlines, alpha }: PanelProps) {
  const [div, setDiv] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const yRange   = yPad([...yZ, ...yT]);
  const hasPower = alpha !== undefined;

  const mszZ = markerSizeArray(ns.length, 5);
  const mszT = markerSizeArray(ns.length, 5);

  const data: Plotly.Data[] = [];

  if (showVlines) {
    data.push(vlineTrace(optZ, yRange, COLOR_Z, "solid") as Plotly.Data);
    data.push(vlineTrace(optT, yRange, COLOR_T, "dash")  as Plotly.Data);
  }

  // Ghost trace to materialise yaxis2 when showing power right axis
  if (hasPower) {
    const pwrRange = [yRange[0] * alpha! * 100, yRange[1] * alpha! * 100];
    data.push({
      x: [ns[0], ns[ns.length - 1]], y: [pwrRange[0], pwrRange[1]],
      yaxis: "y2", type: "scatter", mode: "markers",
      marker: { size: 0.01, opacity: 0 },
      hoverinfo: "skip", showlegend: false,
    } as Plotly.Data);
  }

  // Single trace per series; showlegend: false in the live view — PNG export re-enables it
  data.push(
    {
      x: ns, y: yZ, type: "scatter", mode: "lines+markers",
      line:   { color: COLOR_Z, width: 2 },
      marker: { size: mszZ, color: COLOR_Z },
      name: "Z test", showlegend: false,
      hovertemplate: `Z: %{y:${hoverFmt}}<extra></extra>`,
    } as Plotly.Data,
    {
      x: ns, y: yT, type: "scatter", mode: "lines+markers",
      line:   { color: COLOR_T, width: 2, dash: "dash" },
      marker: { size: mszT, color: COLOR_T },
      name: "t test", showlegend: false,
      hovertemplate: `t: %{y:${hoverFmt}}<extra></extra>`,
    } as Plotly.Data,
  );

  // Power right-axis ticks: 10% intervals within the displayed range
  let pwrTickVals: number[] = [];
  let pwrTickText: string[] = [];
  if (hasPower) {
    const pwrMin = yRange[0] * alpha! * 100;
    const pwrMax = yRange[1] * alpha! * 100;
    pwrTickVals = [10, 20, 30, 40, 50, 60, 70, 80, 90].filter(p => p >= pwrMin && p <= pwrMax);
    pwrTickText = pwrTickVals.map(p => `${p}%`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const panelLayout: any = {
    paper_bgcolor: "transparent",
    plot_bgcolor:  "#f8faf9",
    showlegend:    false,
    font:      { family: "Inter, sans-serif", color: "#3f4444" },
    margin:    { t: 40, r: hasPower ? 56 : 20, b: 50, l: 64 },
    hovermode: "x unified",
    xaxis: { ...baseAxis, title: { text: "Sample size N" } },
    yaxis: { ...baseAxis, title: { text: yTitle }, range: yRange },
  };

  if (hasPower) {
    panelLayout.yaxis2 = {
      ...baseAxis,
      title: { text: "Power (%)", font: { color: "#9db0ac", size: 10 } },
      overlaying: "y",
      side: "right",
      range: [yRange[0] * alpha! * 100, yRange[1] * alpha! * 100],
      tickmode: "array",
      tickvals: pwrTickVals,
      ticktext: pwrTickText,
      showgrid: false,
    };
  }

  const resetView = () => {
    if (!div || !getPlotly()) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upd: any = { "xaxis.autorange": true, "yaxis.autorange": true };
    if (hasPower) upd["yaxis2.autorange"] = true;
    getPlotly().relayout(div, upd);
  };

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div style={{ height: "320px" }}>
        {mounted && (
          <Plot
            data={data}
            layout={panelLayout as Partial<Plotly.Layout>}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "320px" }}
            onInitialized={(_, d) => setDiv(d)}
            onUpdate={(_, d)       => setDiv(d)}
          />
        )}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <SeriesLegend />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetView}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadPng(div, filename, pngTitle)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7">
            <ImageDown className="w-3 h-3" /> PNG
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PairedChart({ results, optimal_z, optimal_t, inputs }: Props) {
  const ns   = results.map(r => r.n);
  const lrZ  = results.map(r => r.lr_z);
  const lrT  = results.map(r => r.lr_t);
  const mbZ  = results.map(r => r.mb_z);
  const mbT  = results.map(r => r.mb_t);
  const utlZ = results.map(r => r.utility_z);
  const utlT = results.map(r => r.utility_t);

  const pngBase = `μ_D=${inputs.mu_D} σ=${inputs.sigma} α=${inputs.alpha}`;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Panel
        ns={ns} yZ={lrZ} yT={lrT}
        optZ={optimal_z.n} optT={optimal_t.n}
        yTitle="LR+ = Power / α"
        hoverFmt=".3f"
        filename="paired-lr.png"
        pngTitle={`Positive Likelihood Ratio · ${pngBase}`}
        showVlines={false}
        alpha={inputs.alpha}
      />
      <Panel
        ns={ns} yZ={mbZ} yT={mbT}
        optZ={optimal_z.n} optT={optimal_t.n}
        yTitle="Min. detectable benefit"
        hoverFmt=".4f"
        filename="paired-mb.png"
        pngTitle={`Minimum Detectable Benefit · ${pngBase}`}
        showVlines={false}
      />
      <Panel
        ns={ns} yZ={utlZ} yT={utlT}
        optZ={optimal_z.n} optT={optimal_t.n}
        yTitle="Utility = LR+ × MB"
        hoverFmt=".4f"
        filename="paired-utility.png"
        pngTitle={`Design Utility · ${pngBase}`}
        showVlines={true}
      />
    </div>
  );
}
