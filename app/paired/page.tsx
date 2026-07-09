"use client";

import { useState } from "react";
import { PairedInputPanel }  from "@/components/PairedInputPanel";
import { PairedChart }       from "@/components/PairedChart";
import { PairedOptimalCard } from "@/components/PairedOptimalCard";
import { runPaired }         from "@/lib/api";
import type { PairedInputs, PairedResponse } from "@/lib/api";
import { AlertCircle, Loader2 } from "lucide-react";

export default function PairedPage() {
  const [result,     setResult]     = useState<PairedResponse | null>(null);
  const [lastInputs, setLastInputs] = useState<PairedInputs | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleRun = async (inputs: PairedInputs) => {
    setLoading(true);
    setLastInputs(inputs);
    setError(null);
    try {
      const data = await runPaired(inputs);
      setResult(data);
    } catch (e) {
      const raw   = e instanceof Error ? e.message : "Unknown error";
      const isNet = /failed to fetch|network|load failed/i.test(raw);
      const debugId = `ERR-${Date.now().toString(36).toUpperCase()}`;
      console.error(`[GS-Intersect Paired ${debugId}]`, e);
      setError(
        isNet
          ? `Network error — the API could not be reached. Please refresh and try again.\n\nIf the problem persists, contact support with code: ${debugId}`
          : `${raw}\n\nIf this keeps happening, please refresh the page. Debug code: ${debugId}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          <PairedInputPanel onRun={handleRun} loading={loading} />

          <div className="space-y-6">

            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border-2 border-dashed border-az-light-platinum text-center px-8 bg-white print-hidden">
                <div className="w-14 h-14 rounded-full bg-az-light-platinum flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-az-platinum" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-az-graphite text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  Set your design parameters
                </p>
                <p className="text-az-platinum text-xs mt-1.5 max-w-xs leading-relaxed">
                  Adjust the inputs on the left and click{" "}
                  <span className="text-az-mulberry font-medium">Run Optimization</span>{" "}
                  to find the utility-maximising paired design.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
                <Loader2 className="w-8 h-8 text-az-mulberry animate-spin mb-3" />
                <p className="text-sm text-az-graphite font-medium">Computing…</p>
                <p className="text-xs text-az-platinum mt-1">Sweeping N from {lastInputs ? lastInputs.n_min : "—"} to …</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 print-hidden">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Optimization failed</p>
                  <p className="text-xs text-red-500 mt-0.5 whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-az-navy print-hidden" style={{ fontFamily: "var(--font-heading)" }}>
                    Utility Curves
                  </h2>
                  <PairedChart
                    results={result.results}
                    optimal_z={result.optimal_z}
                    optimal_t={result.optimal_t}
                    inputs={lastInputs!}
                  />
                </div>

                <PairedOptimalCard
                  optimal_z={result.optimal_z}
                  optimal_t={result.optimal_t}
                  inputs={lastInputs!}
                  delta={result.delta}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
