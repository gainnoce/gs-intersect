import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportSimonRScript, exportSimonCSV } from "@/lib/api";
import type { SimonResult, SimonInputs } from "@/lib/api";
import { FileCode2, Table2 } from "lucide-react";

interface Props {
  results: SimonResult[];
  optimal: SimonResult;
  inputs:  SimonInputs;
}

export function SimonResultsTable({ results, optimal, inputs }: Props) {
  const isOptimal = (r: SimonResult) => r.power === optimal.power && r.n === optimal.n;

  const sorted = [...results].sort((a, b) => a.power - b.power);

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-az-light-platinum">
        <h3
          className="text-xs font-semibold text-az-navy"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Results — All Power Levels
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSimonRScript(inputs, optimal)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <FileCode2 className="w-3 h-3" />
            Export R Script
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportSimonCSV(results)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <Table2 className="w-3 h-3" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-az-light-platinum/40">
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap"></TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">Power %</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">N₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">r₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">CV₁</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">N</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">r</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">CV_FA</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">Utility</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2">EN₀</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">P(stop|H₀)%</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">Minimax N</TableHead>
              <TableHead className="text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap">Minimax CV_FA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => {
              const opt = isOptimal(r);
              return (
                <TableRow
                  key={i}
                  className={opt ? "bg-az-light-platinum/60" : "hover:bg-az-light-platinum/20"}
                >
                  <TableCell className="px-3 py-1.5 text-[10px]">
                    {opt && (
                      <span className="text-az-mulberry font-bold" title="Utility-optimal design">★</span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs font-medium text-az-graphite">{r.power}%</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.n1}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.r1}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.cv_ia.toFixed(4)}</TableCell>
                  <TableCell className={`px-3 py-1.5 text-xs font-medium ${opt ? "text-az-mulberry" : "text-az-graphite"}`}>
                    {r.n}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.r}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.cv_fa.toFixed(4)}</TableCell>
                  <TableCell className={`px-3 py-1.5 text-xs font-semibold ${opt ? "text-az-mulberry" : "text-az-graphite"}`}>
                    {r.utility.toFixed(4)}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.en0.toFixed(1)}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{(r.p_early_stop * 100).toFixed(1)}%</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.minimax_n}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.minimax_cv_fa.toFixed(4)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
