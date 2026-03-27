"use client";

import { useState } from "react";
import { InputPanel } from "@/components/InputPanel";
import { UtilityChart } from "@/components/UtilityChart";
import { OptimalCard } from "@/components/OptimalCard";
import { ResultsTable } from "@/components/ResultsTable";
import { runOptimization } from "@/lib/api";
import type { DesignInputs, OptimizeResponse } from "@/lib/api";
import { AlertCircle } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (inputs: DesignInputs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runOptimization(inputs);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100 tracking-tight">GS-Intersect</h1>
            <p className="text-xs text-zinc-500">Optimal power selection for Group Sequential survival trial design</p>
          </div>
          <div className="text-xs text-zinc-600 text-right hidden sm:block">
            <p>Rigat &amp; Yap collaboration · AstraZeneca</p>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

          {/* Left: inputs */}
          <InputPanel onRun={handleRun} loading={loading} />

          {/* Right: results */}
          <div className="space-y-6">
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-dashed border-zinc-800 text-center px-8">
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <p className="text-zinc-500 text-sm font-medium">Set your design parameters</p>
                <p className="text-zinc-600 text-xs mt-1 max-w-xs">
                  Adjust the inputs on the left and click <span className="text-indigo-400">Run Optimization</span> to find the utility-maximising design.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-zinc-800">
                <div className="flex gap-1.5 mb-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-zinc-400 text-sm">Running optimization…</p>
                <p className="text-zinc-600 text-xs mt-1">This may take a few seconds</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-300 font-medium">Optimization failed</p>
                  <p className="text-xs text-red-400/80 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
                  <h2 className="text-sm font-medium text-zinc-300 mb-4">Utility Curves</h2>
                  <UtilityChart
                    results={result.results}
                    optimal_IA={result.optimal_IA}
                    optimal_FA={result.optimal_FA}
                  />
                </div>
                <OptimalCard optimal_IA={result.optimal_IA} optimal_FA={result.optimal_FA} />
                <ResultsTable
                  results={result.results}
                  optimal_IA={result.optimal_IA}
                  optimal_FA={result.optimal_FA}
                />
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-auto">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-zinc-600">
          <span>GS-Intersect · Companion tool for publication</span>
          <span>Powered by gsDesign (R)</span>
        </div>
      </footer>
    </div>
  );
}
