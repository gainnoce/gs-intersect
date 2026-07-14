"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Table2 } from "lucide-react";
import type { DiffProportionsResult, DiffProportionsInputs } from "@/lib/api";
import { exportDiffProportionsCSV } from "@/lib/api";

const COLOR = "#003865";

interface Props {
  results: DiffProportionsResult[];
  optimal: DiffProportionsResult;
  inputs:  DiffProportionsInputs;
}

const thClass = "text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap";

export function DiffProportionsResultsTable({ results, optimal }: Props) {
  const headers = ["N (per arm)", "Total N", "Power %", "LR+", "MB (ORR diff)", "Utility"];

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-az-light-platinum">
        <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Full Results
        </h3>
        <Button
          variant="outline" size="sm"
          onClick={() => exportDiffProportionsCSV(results)}
          className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
        >
          <Table2 className="w-3 h-3" /> Export CSV
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-az-light-platinum/40">
              <TableHead className={thClass}></TableHead>
              {headers.map(h => (
                <TableHead key={h} className={thClass}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const isOpt = r.n === optimal.n;
              const cellClass = `px-3 py-1.5 text-xs ${isOpt ? "font-bold" : "text-az-graphite"}`;

              return (
                <TableRow
                  key={r.n}
                  className={isOpt ? "bg-az-light-platinum/60" : "hover:bg-az-light-platinum/20"}
                >
                  <TableCell className="px-3 py-1.5 text-[10px]">
                    {isOpt && <span className="font-bold" style={{ color: COLOR }}>★</span>}
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {r.n}
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {r.n * 2}
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {r.power.toFixed(1)}%
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {r.lr.toFixed(2)}
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {(r.mb * 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className={cellClass} style={isOpt ? { color: COLOR } : undefined}>
                    {r.utility.toFixed(4)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
