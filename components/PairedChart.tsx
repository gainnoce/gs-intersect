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

const COLOR_Z = "#003865";   // AZ navy  — Z test
const COLOR_T = "#1469b5";   // AZ blue  — T test

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

const layout = (yRange: number[], yTitle: string): Partial<Plotly.Layout> => ({
  paper_bgcolor: "transparent",
  plot_bgcolor:  "#f8faf9",
  showlegend:    false,
  font:   { family: "Inter, sans-serif", color: "#3f4444" },
  margin: { t: 40, r: 20, b: 50, l: 64 },
  hovermode: "x unified",
  xaxis: { ...baseAxis, title: { text: "Sample size N" } } as Partial<Plotly.LayoutAxis>,
  yaxis: { ...baseAxis, title: { text: yTitle }, range: yRange } as Partial<Plotly.LayoutAxis>,
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
  };
  const url: string = await Plotly.toImage(
    { data: d.data ?? [], layout: exportLayout },
    { format: "png", scale: 2, width: div.clientWidth, height: div.clientHeight + 60 },
  );
  const a = document.createElement("a"); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
};

interface PanelProps {
  ns:       number[];
  yZ:       number[];
  yT:       number[];
  optZ:     number;
  optT:     number;
  yTitle:   string;
  hoverFmt: string;
  filename: string;
  pngTitle: string;
}

function Panel({ ns, yZ, yT, optZ, optT, yTitle, hoverFmt, filename, pngTitle }: PanelProps) {
  const [div, setDiv] = useState<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const yRange = yPad([...yZ, ...yT]);

  const data: Plotly.Data[] = [
    vlineTrace(optZ, yRange, COLOR_Z, "solid") as Plotly.Data,
    vlineTrace(optT, yRange, COLOR_T, "dash")  as Plotly.Data,
    {
      x: ns, y: yZ, type: "scatter", mode: "lines",
      line: { color: COLOR_Z, width: 2 },
      name: "Paired Z test",
      hovertemplate: `Z: %{y:${hoverFmt}}<extra></extra>`,
    } as Plotly.Data,
    {
      x: ns, y: yT, type: "scatter", mode: "lines",
      line: { color: COLOR_T, width: 2, dash: "dash" },
      name: "Paired t test",
      hovertemplate: `t: %{y:${hoverFmt}}<extra></extra>`,
    } as Plotly.Data,
  ];

  const resetView = () => {
    if (!div || !getPlotly()) return;
    getPlotly().relayout(div, { "xaxis.autorange": true, "yaxis.autorange": true });
  };

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div style={{ height: "320px" }}>
        {mounted && (
          <Plot
            data={data}
            layout={layout(yRange, yTitle) as Partial<Plotly.Layout>}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "320px" }}
            onInitialized={(_, d) => setDiv(d)}
            onUpdate={(_, d)       => setDiv(d)}
          />
        )}
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-2">
        <p className="text-[10px] text-az-platinum">Drag to zoom · Double-click to reset</p>
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
  const ns    = results.map(r => r.n);
  const lrZ   = results.map(r => r.lr_z);
  const lrT   = results.map(r => r.lr_t);
  const mbZ   = results.map(r => r.mb_z);
  const mbT   = results.map(r => r.mb_t);
  const utlZ  = results.map(r => r.utility_z);
  const utlT  = results.map(r => r.utility_t);

  const pngBase = `μ_D=${inputs.mu_D} σ=${inputs.sigma} α=${inputs.alpha}`;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-6 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5" style={{ background: COLOR_Z }} />
          <span className="text-xs text-az-graphite">Paired Z test</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLOR_T }} />
          <span className="text-xs text-az-graphite">Paired t test</span>
        </div>
        <span className="text-[11px] text-az-platinum ml-auto">
          Solid vertical = Z optimal (N={optimal_z.n}) · Dashed = t optimal (N={optimal_t.n})
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Panel
          ns={ns} yZ={lrZ} yT={lrT}
          optZ={optimal_z.n} optT={optimal_t.n}
          yTitle="LR+ = Power / α"
          hoverFmt=".3f"
          filename="paired-lr.png"
          pngTitle={`Positive Likelihood Ratio · ${pngBase}`}
        />
        <Panel
          ns={ns} yZ={mbZ} yT={mbT}
          optZ={optimal_z.n} optT={optimal_t.n}
          yTitle="Min. detectable benefit"
          hoverFmt=".4f"
          filename="paired-mb.png"
          pngTitle={`Minimum Detectable Benefit · ${pngBase}`}
        />
        <Panel
          ns={ns} yZ={utlZ} yT={utlT}
          optZ={optimal_z.n} optT={optimal_t.n}
          yTitle="Utility = LR+ × MB"
          hoverFmt=".4f"
          filename="paired-utility.png"
          pngTitle={`Design Utility · ${pngBase}`}
        />
      </div>
    </div>
  );
}
