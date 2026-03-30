"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download, FileCode } from "lucide-react";
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

  // For each IA stage j, which result is "optimal"?
  const optimalForIA = Array.from({ length: numIAs }, (_, j) =>
    (optimal_IAs?.[j] ?? optimal_IA).power
  );

  // Column definitions — built dynamically for k>2
  const iaHeaders = Array.from({ length: numIAs }, (_, j) =>
    numIAs === 1 ? ["Events IA", "CV IA", "Utility IA"] : [`Events IA${j + 1}`, `CV IA${j + 1}`, `Util IA${j + 1}`]
  ).flat();

  const headers = [
    "Power %", "N Total",
    ...iaHeaders,
    "Events FA", "CV FA", "Utility FA",
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Full Results
        </h3>
        <div className="flex gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => exportRScript(inputs, response)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-2 bg-white"
          >
            <FileCode className="w-3.5 h-3.5" /> Export R Script
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => exportCSV(results, numK)}
            className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-2 bg-white"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-az-light-platinum overflow-auto max-h-72 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-az-light-platinum hover:bg-transparent bg-az-light-platinum/50">
              {headers.map(h => (
                <TableHead key={h} className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap">
                  {h}
                </TableHead>
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
                  className={`border-az-light-platinum text-xs ${
                    isAnyOpt ? "bg-az-light-platinum/60 font-medium" : "hover:bg-az-light-platinum/30"
                  }`}
                >
                  {/* Power % */}
                  <TableCell className="text-az-graphite font-medium whitespace-nowrap">
                    {r.power}%
                    {isOptIAs.map((opt, j) => opt && (
                      <span key={j} className="ml-1 text-[10px]" style={{ color: ["#6366f1","#7c3aed","#9333ea"][j % 3] }}>
                        ★IA{numIAs > 1 ? j + 1 : ""}
                      </span>
                    ))}
                    {isOptFA && <span className="ml-1 text-az-navy text-[10px]">★FA</span>}
                  </TableCell>

                  {/* N Total */}
                  <TableCell className="text-az-graphite">{r.N.toLocaleString()}</TableCell>

                  {/* Per IA stage: Events, CV, Utility */}
                  {Array.from({ length: numIAs }, (_, j) => {
                    const ev   = r.ia_stages?.[j]?.events  ?? r.events_IA;
                    const cv   = r.ia_stages?.[j]?.cv      ?? r.cv_IA;
                    const util = r.ia_stages?.[j]?.utility ?? r.utility_IA;
                    const isOpt = isOptIAs[j];
                    const col   = ["#6366f1","#7c3aed","#9333ea"][j % 3];
                    return [
                      <TableCell key={`ev-ia${j}`} className="text-az-graphite">{ev}</TableCell>,
                      <TableCell key={`cv-ia${j}`} className="text-az-graphite">{cv.toFixed(4)}</TableCell>,
                      <TableCell key={`ut-ia${j}`} style={isOpt ? { color: col, fontWeight: 700 } : undefined} className={isOpt ? "" : "text-az-graphite"}>
                        {util.toFixed(4)}
                      </TableCell>,
                    ];
                  })}

                  {/* FA: Events, CV, Utility */}
                  <TableCell className="text-az-graphite">{r.events_FA}</TableCell>
                  <TableCell className="text-az-graphite">{r.cv_FA.toFixed(4)}</TableCell>
                  <TableCell className={isOptFA ? "text-az-navy font-bold" : "text-az-graphite"}>
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
