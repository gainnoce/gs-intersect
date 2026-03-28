"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { DesignResult } from "@/lib/api";
import { exportCSV } from "@/lib/api";

interface Props {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
}

export function ResultsTable({ results, optimal_IA, optimal_FA }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
          Full Results
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(results)}
          className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-2 bg-white"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-lg border border-az-light-platinum overflow-auto max-h-72 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="border-az-light-platinum hover:bg-transparent bg-az-light-platinum/50">
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">Power %</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">N Total</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">Events IA</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">Events FA</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">CV IA</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">CV FA</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">Utility IA</TableHead>
              <TableHead className="text-az-platinum text-[10px] uppercase tracking-wider font-semibold">Utility FA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const isOptIA = r.power === optimal_IA.power;
              const isOptFA = r.power === optimal_FA.power;
              return (
                <TableRow
                  key={r.power}
                  className={`border-az-light-platinum text-xs ${
                    isOptIA || isOptFA ? "bg-az-light-platinum/60 font-medium" : "hover:bg-az-light-platinum/30"
                  }`}
                >
                  <TableCell className="text-az-graphite font-medium">
                    {r.power}%
                    {isOptIA && <span className="ml-1.5 text-az-mulberry text-[10px]">★IA</span>}
                    {isOptFA && <span className="ml-1.5 text-az-navy text-[10px]">★FA</span>}
                  </TableCell>
                  <TableCell className="text-az-graphite">{r.N.toLocaleString()}</TableCell>
                  <TableCell className="text-az-graphite">{r.events_IA}</TableCell>
                  <TableCell className="text-az-graphite">{r.events_FA}</TableCell>
                  <TableCell className="text-az-graphite">{r.cv_IA.toFixed(4)}</TableCell>
                  <TableCell className="text-az-graphite">{r.cv_FA.toFixed(4)}</TableCell>
                  <TableCell className={isOptIA ? "text-az-mulberry font-bold" : "text-az-graphite"}>
                    {r.utility_IA.toFixed(4)}
                  </TableCell>
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
