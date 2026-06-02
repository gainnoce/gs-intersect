"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileCode2, Table2 } from "lucide-react";
import type { DesignResult, DesignInputs, OptimizeResponse } from "@/lib/api";
import { exportCSV, exportRScript } from "@/lib/api";

interface Props {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
  optimal_IAs?: DesignResult[];
  k?: number;
  inputs: DesignInputs;
  response: OptimizeResponse;
}

export function ResultsTable({ results, optimal_IA, optimal_FA, optimal_IAs, k, inputs, response }: Props) {
  const numK   = k ?? 2;
  const numIAs = numK - 1;

  const optimalForIA = Array.from({ length: numIAs }, (_, j) =>
    (optimal_IAs?.[j] ?? optimal_IA).power
  );

  const iaHeaders = Array.from({ length: numIAs }, (_, j) =>
    numIAs === 1 ? ["Events IA", "CV IA", "Utility IA"] : [`Events IA${j + 1}`, `CV IA${j + 1}`, `Util IA${j + 1}`]
  ).flat();

  const headers = [
    "Power %", "N Total",
    ...iaHeaders,
    "Events FA", "CV FA", "Utility FA",
  ];

  const thClass = "text-[10px] text-az-graphite font-semibold uppercase tracking-wide px-3 py-2 whitespace-nowrap";

  return (
    <div className="rounded-xl border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-az-light-platinum">
        <h3 className="text-xs font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Full Results
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => exportRScript(inputs, response)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <FileCode2 className="w-3 h-3" /> Export R Script
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => exportCSV(results, numK)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs h-7"
          >
            <Table2 className="w-3 h-3" /> Export CSV
          </Button>
        </div>
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
              const isOptIAs = Array.from({ length: numIAs }, (_, j) => r.power === optimalForIA[j]);
              const isOptFA  = r.power === optimal_FA.power;
              const isAnyOpt = isOptIAs.some(Boolean) || isOptFA;

              return (
                <TableRow
                  key={r.power}
                  className={isAnyOpt ? "bg-az-light-platinum/60" : "hover:bg-az-light-platinum/20"}
                >
                  {/* Star column */}
                  <TableCell className="px-3 py-1.5 text-[10px]">
                    {isOptIAs.map((opt, j) => opt && (
                      <span key={j} style={{ color: ["#6366f1","#7c3aed","#9333ea"][j % 3] }} className="font-bold">
                        ★{numIAs > 1 ? `IA${j + 1}` : "IA"}
                      </span>
                    ))}
                    {isOptFA && (
                      <span className="text-az-navy font-bold">★FA</span>
                    )}
                  </TableCell>

                  {/* Power % */}
                  <TableCell className="px-3 py-1.5 text-xs font-medium text-az-graphite whitespace-nowrap">
                    {r.power}%
                  </TableCell>

                  {/* N Total */}
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.N.toLocaleString()}</TableCell>

                  {/* Per IA stage: Events, CV, Utility */}
                  {Array.from({ length: numIAs }, (_, j) => {
                    const ev   = r.ia_stages?.[j]?.events  ?? r.events_IA;
                    const cv   = r.ia_stages?.[j]?.cv      ?? r.cv_IA;
                    const util = r.ia_stages?.[j]?.utility ?? r.utility_IA;
                    const isOpt = isOptIAs[j];
                    const col   = ["#6366f1","#7c3aed","#9333ea"][j % 3];
                    return [
                      <TableCell key={`ev-ia${j}`}  className="px-3 py-1.5 text-xs text-az-graphite">{ev}</TableCell>,
                      <TableCell key={`cv-ia${j}`}  className="px-3 py-1.5 text-xs text-az-graphite">{cv.toFixed(4)}</TableCell>,
                      <TableCell key={`ut-ia${j}`}  className={`px-3 py-1.5 text-xs ${isOpt ? "font-bold" : "text-az-graphite"}`} style={isOpt ? { color: col } : undefined}>
                        {util.toFixed(4)}
                      </TableCell>,
                    ];
                  })}

                  {/* FA: Events, CV, Utility */}
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.events_FA}</TableCell>
                  <TableCell className="px-3 py-1.5 text-xs text-az-graphite">{r.cv_FA.toFixed(4)}</TableCell>
                  <TableCell className={`px-3 py-1.5 text-xs ${isOptFA ? "text-az-navy font-bold" : "text-az-graphite"}`}>
                    {r.utility_FA.toFixed(4)}
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
