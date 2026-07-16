"use client";

import { useState, useEffect, useRef } from "react";
import { SimonInputPanel }   from "@/components/SimonInputPanel";
import { SimonChart }        from "@/components/SimonChart";
import { SimonAuxCharts }    from "@/components/SimonAuxCharts";
import { SimonOptimalCard }  from "@/components/SimonOptimalCard";
import { SimonResultsTable } from "@/components/SimonResultsTable";
import { RawOutput }         from "@/components/RawOutput";
import { LoadingProgress }   from "@/components/LoadingProgress";
import { runSimon, simonInputsToParams, simonParamsToInputs } from "@/lib/api";
import type { SimonInputs, SimonResponse } from "@/lib/api";
import { AlertCircle, Share2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SimonPage() {
  const [result,     setResult]     = useState<SimonResponse | null>(null);
  const [lastInputs, setLastInputs] = useState<SimonInputs | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [phase,      setPhase]      = useState<"connecting" | "computing" | "processing">("connecting");
  const [error,      setError]      = useState<string | null>(null);
  const [urlInputs,  setUrlInputs]  = useState<Partial<SimonInputs> | undefined>(undefined);
  const [shareToast, setShareToast] = useState(false);
  const autoRanRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parsed = simonParamsToInputs(params);
    if (parsed) setUrlInputs(parsed);
  }, []);

  useEffect(() => {
    if (!urlInputs || autoRanRef.current) return;
    autoRanRef.current = true;
    handleRun(urlInputs as SimonInputs);
  }, [urlInputs]);

  const handleRun = async (inputs: SimonInputs) => {
    setLoading(true);
    setPhase("connecting");
    setError(null);

    let resolved = false;
    const computingTimer = setTimeout(() => {
      if (!resolved) setPhase("computing");
    }, 3000);

    try {
      const data = await runSimon(inputs);
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
      console.error(`[GS-Intersect Simon ${debugId}]`, e);

      setResult(null);
      const smallEffect = inputs && (inputs.pa - inputs.pu) <= 0.15;
      setError(
        isNet && smallEffect
          ? `Computation limit exceeded — this effect size (pa − pu = ${((inputs.pa - inputs.pu) * 100).toFixed(0)}%) requires very large sample sizes (N > 200) that exceed the API timeout.\n\nRun the supplementary R script locally to obtain results for these parameters.\n\nDebug code: ${debugId}`
          : isNet
          ? `Network error — the API could not be reached. Please refresh and try again.\n\nIf the problem persists, contact support with code: ${debugId}`
          : `${raw}\n\nIf this keeps happening, please refresh the page. Debug code: ${debugId}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!lastInputs) return;
    const params = simonInputsToParams(lastInputs);
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 max-w-screen-2xl mx-auto w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">

          <SimonInputPanel onRun={handleRun} loading={loading} initialValues={urlInputs} />

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
                  to find the utility-maximising Simon 2-stage design.
                </p>
              </div>
            )}

            {loading && (
              <LoadingProgress
                phase={phase}
                powerLevels={43}
              />
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
                <div className="flex justify-end items-center gap-3 print-hidden">
                  <div className="relative">
                    <Button
                      variant="outline" size="sm"
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
                    variant="outline" size="sm"
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
                      Utility Curve
                    </h2>
                    <span className="text-[11px] text-az-platinum">Drag to zoom · Double-click to reset</span>
                  </div>
                  <SimonChart results={result.results} optimal={result.optimal} inputs={lastInputs!} />
                </div>

                <SimonAuxCharts results={result.results} inputs={lastInputs!} />

                <SimonOptimalCard optimal={result.optimal} inputs={lastInputs!} />

                <SimonResultsTable
                  results={result.results}
                  optimal={result.optimal}
                  inputs={lastInputs!}
                />

                <RawOutput
                  response={result}
                  inputs={lastInputs!}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
