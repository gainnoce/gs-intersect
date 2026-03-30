"use client";

import { useState, useEffect, useRef } from "react";
import { InputPanel } from "@/components/InputPanel";
import { UtilityChart } from "@/components/UtilityChart";
import { OptimalCard } from "@/components/OptimalCard";
import { ResultsTable } from "@/components/ResultsTable";
import { RawOutput } from "@/components/RawOutput";
import { runOptimization, inputsToParams, paramsToInputs } from "@/lib/api";
import type { DesignInputs, OptimizeResponse } from "@/lib/api";
import { AlertCircle, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [result,      setResult]      = useState<OptimizeResponse | null>(null);
  const [lastInputs,  setLastInputs]  = useState<DesignInputs | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [urlInputs,   setUrlInputs]   = useState<Partial<DesignInputs> | undefined>(undefined);
  const [shareToast,  setShareToast]  = useState(false);
  const autoRanRef = useRef(false);

  // ── Read URL params on mount ───────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = paramsToInputs(params);
    if (parsed) {
      setUrlInputs(parsed);
    }
  }, []);

  // Auto-run once when urlInputs are populated (avoids running before InputPanel seeds)
  useEffect(() => {
    if (!urlInputs || autoRanRef.current) return;
    autoRanRef.current = true;
    handleRun(urlInputs as DesignInputs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInputs]);

  const handleRun = async (inputs: DesignInputs) => {
    setLoading(true);
    setError(null);
    try {
      const data = await runOptimization(inputs);
      setResult(data);
      setLastInputs(inputs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!lastInputs) return;
    const params = inputsToParams(lastInputs);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-az-platinum bg-white/90 backdrop-blur sticky top-0 z-10 print-hidden">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
              GS-Intersect
            </h1>
            <p className="text-xs text-az-platinum mt-0.5">
              Optimal power selection for Group Sequential survival trial design
            </p>
          </div>
          <div className="flex items-center gap-3">
            {result && !loading && (
              <>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </Button>
                  {shareToast && (
                    <div className="absolute right-0 top-9 bg-az-graphite text-white text-xs rounded-md px-3 py-1.5 whitespace-nowrap shadow-lg animate-slide-in">
                      Link copied!
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="border-az-platinum text-az-graphite hover:text-az-mulberry hover:border-az-mulberry gap-1.5 bg-white text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Export PDF
                </Button>
              </>
            )}
            <div className="hidden sm:flex items-center gap-3">
              <div className="h-8 w-px bg-az-light-platinum" />
              <p className="text-xs font-medium text-az-graphite">AstraZeneca</p>
              <div className="w-3 h-8 rounded-sm" style={{ background: "linear-gradient(180deg, #830051 0%, #003865 100%)" }} />
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          {/* Left: inputs */}
          <InputPanel onRun={handleRun} loading={loading} initialValues={urlInputs} />

          {/* Right: results */}
          <div className="space-y-6">
            {!result && !loading && !error && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border-2 border-dashed border-az-light-platinum text-center px-8 bg-white print-hidden">
                <div className="w-14 h-14 rounded-full bg-az-light-platinum flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-az-platinum" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <p className="text-az-graphite text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
                  Set your design parameters
                </p>
                <p className="text-az-platinum text-xs mt-1.5 max-w-xs leading-relaxed">
                  Adjust the inputs on the left and click{" "}
                  <span className="text-az-mulberry font-medium">Run Optimization</span>{" "}
                  to find the utility-maximising design.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
                <div className="flex gap-1.5 mb-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2.5 h-2.5 rounded-full bg-az-mulberry animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
                <p className="text-az-graphite text-sm font-medium">Running optimization…</p>
                <p className="text-az-platinum text-xs mt-1">This may take a few seconds</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 print-hidden">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-700 font-medium">Optimization failed</p>
                  <p className="text-xs text-red-500 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            {result && !loading && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between print-hidden">
                    <h2 className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
                      Utility Curves
                    </h2>
                    <span className="text-[11px] text-az-platinum">Drag to zoom · Double-click to reset</span>
                  </div>
                  <UtilityChart
                    results={result.results}
                    optimal_IA={result.optimal_IA}
                    optimal_FA={result.optimal_FA}
                    optimal_IAs={result.optimal_IAs}
                    k={result.k}
                  />
                </div>
                <OptimalCard
                  optimal_IA={result.optimal_IA}
                  optimal_FA={result.optimal_FA}
                  optimal_IAs={result.optimal_IAs}
                  k={result.k}
                />
                <ResultsTable
                  results={result.results}
                  optimal_IA={result.optimal_IA}
                  optimal_FA={result.optimal_FA}
                  inputs={lastInputs!}
                  response={result}
                />
                <RawOutput response={result} inputs={lastInputs!} />
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-az-light-platinum mt-auto bg-white print-hidden">
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-az-platinum">
          <span>GS-Intersect</span>
          <span>Powered by gsDesign (R)</span>
        </div>
      </footer>
    </div>
  );
}
