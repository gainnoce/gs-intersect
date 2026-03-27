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
        <h3 className="text-sm font-medium text-zinc-400">Full Results</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(results)}
          className="border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:border-zinc-500 gap-2"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="rounded-lg border border-zinc-800 overflow-auto max-h-72">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="text-zinc-500 text-xs">Power %</TableHead>
              <TableHead className="text-zinc-500 text-xs">N Total</TableHead>
              <TableHead className="text-zinc-500 text-xs">Events IA</TableHead>
              <TableHead className="text-zinc-500 text-xs">Events FA</TableHead>
              <TableHead className="text-zinc-500 text-xs">CV IA</TableHead>
              <TableHead className="text-zinc-500 text-xs">CV FA</TableHead>
              <TableHead className="text-zinc-500 text-xs">Utility IA</TableHead>
              <TableHead className="text-zinc-500 text-xs">Utility FA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => {
              const isOptIA = r.power === optimal_IA.power;
              const isOptFA = r.power === optimal_FA.power;
              return (
                <TableRow
                  key={r.power}
                  className={`border-zinc-800 text-xs ${
                    isOptIA || isOptFA
                      ? "bg-zinc-800/60 font-medium"
                      : "hover:bg-zinc-900"
                  }`}
                >
                  <TableCell className="text-zinc-200">
                    {r.power}%
                    {isOptIA && (
                      <span className="ml-1.5 text-indigo-400 text-[10px]">★IA</span>
                    )}
                    {isOptFA && (
                      <span className="ml-1.5 text-emerald-400 text-[10px]">★FA</span>
                    )}
                  </TableCell>
                  <TableCell className="text-zinc-300">{r.N.toLocaleString()}</TableCell>
                  <TableCell className="text-zinc-300">{r.events_IA}</TableCell>
                  <TableCell className="text-zinc-300">{r.events_FA}</TableCell>
                  <TableCell className="text-zinc-300">{r.cv_IA.toFixed(4)}</TableCell>
                  <TableCell className="text-zinc-300">{r.cv_FA.toFixed(4)}</TableCell>
                  <TableCell className={isOptIA ? "text-indigo-300 font-semibold" : "text-zinc-300"}>
                    {r.utility_IA.toFixed(4)}
                  </TableCell>
                  <TableCell className={isOptFA ? "text-emerald-300 font-semibold" : "text-zinc-300"}>
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
