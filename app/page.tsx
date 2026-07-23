"use client";

import { useState, useEffect, useRef } from "react";
import { InputPanel } from "@/components/InputPanel";
import { UtilityChart } from "@/components/UtilityChart";
import { OptimalCard } from "@/components/OptimalCard";
import { ResultsTable } from "@/components/ResultsTable";
import { RawOutput } from "@/components/RawOutput";
import { LoadingProgress } from "@/components/LoadingProgress";
import { runOptimization, inputsToParams, paramsToInputs } from "@/lib/api";
import type { DesignInputs, OptimizeResponse } from "@/lib/api";
import { AlertCircle, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [result,      setResult]      = useState<OptimizeResponse | null>(null);
  const [lastInputs,  setLastInputs]  = useState<DesignInputs | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [phase,       setPhase]       = useState<"connecting" | "computing" | "processing">("connecting");
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
  }, [urlInputs]);

  const handleRun = async (inputs: DesignInputs) => {
    setLoading(true);
    setPhase("connecting");
    setError(null);

    let resolved = false;
    const computingTimer = setTimeout(() => {
      if (!resolved) setPhase("computing");
    }, 3000);

    try {
      const data = await runOptimization(inputs);
      resolved = true;
      clearTimeout(computingTimer);
      setPhase("processing");
      await new Promise(r => setTimeout(r, 500));
      setResult(data);
      setLastInputs(inputs);
    } catch (e) {
      resolved = true;
      clearTimeout(computingTimer);
      const raw     = e instanceof Error ? e.message : "Unknown error";
      const isNet   = /failed to fetch|network|load failed/i.test(raw);
      const debugId = `ERR-${Date.now().toString(36).toUpperCase()}`;
      console.error(`[GS-Intersect ${debugId}]`, e);
      setResult(null);
      setError(
        isNet
          ? `Network error — the API could not be reached. Please refresh the page and try again.\n\nIf the problem persists, contact support with code: ${debugId}`
          : `${raw}\n\nIf this keeps happening, please refresh the page and try again. Debug code: ${debugId}`
      );
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
      {/* Main content */}
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
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
              <LoadingProgress
                phase={phase}
                powerLevels={11}
              />
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
                {/* Share / Print toolbar */}
                <div className="flex justify-end items-center gap-3 print-hidden">
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
                </div>

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
                  optimal_IAs={result.optimal_IAs}
                  k={result.k}
                  inputs={lastInputs!}
                  response={result}
                />
                <RawOutput response={result} inputs={lastInputs!} />
              </>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}
