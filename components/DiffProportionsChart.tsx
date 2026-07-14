"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { RotateCcw, ImageDown } from "lucide-react";
import type { DiffProportionsResult, DiffProportionsInputs } from "@/lib/api";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface Props {
  results: DiffProportionsResult[];
  optimal: DiffProportionsResult;
  inputs:  DiffProportionsInputs;
}

const COLOR = "#003865";

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

const vlineTrace = (x: number, yRange: number[]) => ({
  x: [x, x], y: [yRange[0], yRange[1]],
  type: "scatter" as const, mode: "lines" as const,
  line: { color: COLOR, width: 1.5, dash: "dot" as const },
  hoverinfo: "skip" as const, showlegend: false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const downloadPng = async (div: HTMLElement | null, filename: string, title: string) => {
  if (!div || !getPlotly()) return;
  const Plotly = getPlotly();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = div as any;

  const exportLayout = {
    ...(d.layout ?? {}),
    title: { text: title, font: { family: "Inter, sans-serif", size: 12, color: "#1a2e44" }, x: 0.5, xanchor: "center" },
    margin: { ...(d.layout?.margin ?? {}), t: (d.layout?.margin?.t ?? 40) + 40 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor:  "#f8faf9",
  };

  const url: string = await Plotly.toImage(
    { data: d.data ?? [], layout: exportLayout },
    { format: "png", scale: 3, width: div.clientWidth, height: div.clientHeight + 60 },
  );
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

const markerSizeArray = (len: number, visibleSize: number): number[] => {
  const step   = Math.max(1, Math.round((len - 1) / 8));
  const sparse = new Set<number>();
  for (let i = 0; i < len; i += step) sparse.add(i);
  sparse.add(len - 1);
  return Array.from({ length: len }, (_, i) => (sparse.has(i) ? visibleSize : 0));
};

interface PanelProps {
  ns:          number[];
  yVals:       number[];
  optN:        number;
  optPower:    number;
  optVal:      number;
  metricLabel: string;
  valDecimals: number;
  yTitle:      string;
  hoverFmt:    string;
  filename:    string;
  pngTitle:    string;
  showVline?:  boolean;
  alpha?:      number;
}

function Panel({ ns, yVals, optN, optPower, optVal, metricLabel, valDecimals,
                 yTitle, hoverFmt, filename, pngTitle, showVline, alpha }: PanelProps) {
  const [div, setDiv]       = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const yRange   = yPad(yVals);
  const hasPower = alpha !== undefined;
  const msz      = markerSizeArray(ns.length, 5);

  const data: Plotly.Data[] = [];

  if (showVline) {
    data.push(vlineTrace(optN, yRange) as Plotly.Data);
  }

  if (hasPower) {
    const pwrRange = [yRange[0] * alpha! * 100, yRange[1] * alpha! * 100];
    data.push({
      x: [ns[0], ns[ns.length - 1]], y: [pwrRange[0], pwrRange[1]],
      yaxis: "y2", type: "scatter", mode: "markers",
      marker: { size: 0.01, opacity: 0 },
      hoverinfo: "skip", showlegend: false,
    } as Plotly.Data);
  }

  data.push({
    x: ns, y: yVals, type: "scatter", mode: "lines+markers",
    line:   { color: COLOR, width: 2 },
    marker: { size: msz, color: COLOR },
    name: "Gaussian", showlegend: false,
    hovertemplate: `%{y:${hoverFmt}}<extra></extra>`,
  } as Plotly.Data);

  let pwrTickVals: number[] = [];
  let pwrTickText: string[] = [];
  if (hasPower) {
    const pwrMin = yRange[0] * alpha! * 100;
    const pwrMax = yRange[1] * alpha! * 100;
    pwrTickVals = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99].filter(p => p >= pwrMin && p <= pwrMax);
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
    xaxis: { ...baseAxis, title: { text: "Sample size N (per arm)" } },
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
      <div className="flex items-center px-4 pt-2.5 pb-0.5">
        <span className="text-[10px] text-az-platinum whitespace-nowrap ml-auto">
          Opt: N={optN} per arm · {optPower.toFixed(1)}% · {metricLabel} {optVal.toFixed(valDecimals)}
        </span>
      </div>
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
      <div className="flex items-center justify-end px-4 pb-3 pt-2">
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

export function DiffProportionsChart({ results, optimal, inputs }: Props) {
  const ns      = results.map(r => r.n);
  const lrVals  = results.map(r => r.lr);
  const mbVals  = results.map(r => r.mb);
  const utlVals = results.map(r => r.utility);

  const pngBase = `p_SOC=${inputs.p_soc} p_INV=${inputs.p_inv} α=${inputs.alpha}`;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Panel
        ns={ns} yVals={lrVals}
        optN={optimal.n} optPower={optimal.power} optVal={optimal.lr}
        metricLabel="LR+" valDecimals={2}
        yTitle="LR+ = Power / α"
        hoverFmt=".3f"
        filename="diff-prop-lr.png"
        pngTitle={`Positive Likelihood Ratio · ${pngBase}`}
        alpha={inputs.alpha}
      />
      <Panel
        ns={ns} yVals={mbVals}
        optN={optimal.n} optPower={optimal.power} optVal={optimal.mb}
        metricLabel="MB" valDecimals={4}
        yTitle="Min detectable ORR difference"
        hoverFmt=".4f"
        filename="diff-prop-mb.png"
        pngTitle={`Minimum Detectable Benefit · ${pngBase}`}
      />
      <Panel
        ns={ns} yVals={utlVals}
        optN={optimal.n} optPower={optimal.power} optVal={optimal.utility}
        metricLabel="U" valDecimals={4}
        yTitle="Utility = LR+ × MB"
        hoverFmt=".4f"
        filename="diff-prop-utility.png"
        pngTitle={`Design Utility · ${pngBase}`}
        showVline={true}
      />
    </div>
  );
}
