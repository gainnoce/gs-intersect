"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Table2 } from "lucide-react";
import type { PairedResult, PairedInputs } from "@/lib/api";
import { exportPairedCSV } from "@/lib/api";

const COLOR_Z = "#003865";
const COLOR_T = "#1469b5";

interface Props {
  results:   PairedResult[];
  optimal_z: PairedResult;
  optimal_t: PairedResult;
  inputs:    PairedInputs;
}

const thClass = "text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap";

export function PairedResultsTable({ results, optimal_z, optimal_t }: Props) {
  const headers = [
    "N",
    "Power Z %", "Power T %",
    "LR+ Z", "LR+ T",
    "MB Z", "MB T",
    "Utility Z", "Utility T",
  ];

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-az-light-platinum">
        <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Full Results
        </h3>
        <Button
          variant="outline" size="sm"
          onClick={() => exportPairedCSV(results)}
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
              const isOptZ = r.n === optimal_z.n;
              const isOptT = r.n === optimal_t.n;
              const isAnyOpt = isOptZ || isOptT;

              return (
                <TableRow
                  key={r.n}
                  className={isAnyOpt ? "bg-az-light-platinum/60" : "hover:bg-az-light-platinum/20"}
                >
                  {/* Star column */}
                  <TableCell className="px-3 py-1.5 text-[10px] whitespace-nowrap">
                    {isOptZ && (
                      <span className="font-bold" style={{ color: COLOR_Z }}>★Z</span>
                    )}
                    {isOptZ && isOptT && " "}
                    {isOptT && (
                      <span className="font-bold" style={{ color: COLOR_T }}>★T</span>
                    )}
                  </TableCell>

                  {/* N */}
                  <TableCell className="px-3 py-1.5 text-xs font-medium text-az-graphite">{r.n}</TableCell>

                  {/* Power Z % */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptZ ? "font-bold" : "text-az-graphite"}`}
                    style={isOptZ ? { color: COLOR_Z } : undefined}>
                    {(r.power_z * 100).toFixed(1)}%
                  </TableCell>

                  {/* Power T % */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptT ? "font-bold" : "text-az-graphite"}`}
                    style={isOptT ? { color: COLOR_T } : undefined}>
                    {(r.power_t * 100).toFixed(1)}%
                  </TableCell>

                  {/* LR+ Z */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptZ ? "font-bold" : "text-az-graphite"}`}
                    style={isOptZ ? { color: COLOR_Z } : undefined}>
                    {r.lr_z.toFixed(2)}
                  </TableCell>

                  {/* LR+ T */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptT ? "font-bold" : "text-az-graphite"}`}
                    style={isOptT ? { color: COLOR_T } : undefined}>
                    {r.lr_t.toFixed(2)}
                  </TableCell>

                  {/* MB Z */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptZ ? "font-bold" : "text-az-graphite"}`}
                    style={isOptZ ? { color: COLOR_Z } : undefined}>
                    {r.mb_z.toFixed(4)}
                  </TableCell>

                  {/* MB T */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptT ? "font-bold" : "text-az-graphite"}`}
                    style={isOptT ? { color: COLOR_T } : undefined}>
                    {r.mb_t.toFixed(4)}
                  </TableCell>

                  {/* Utility Z */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptZ ? "font-bold" : "text-az-graphite"}`}
                    style={isOptZ ? { color: COLOR_Z } : undefined}>
                    {r.utility_z.toFixed(4)}
                  </TableCell>

                  {/* Utility T */}
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptT ? "font-bold" : "text-az-graphite"}`}
                    style={isOptT ? { color: COLOR_T } : undefined}>
                    {r.utility_t.toFixed(4)}
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
