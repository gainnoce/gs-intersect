"use client";

import { useState, useEffect } from "react";

interface Props {
  phase:       "connecting" | "computing" | "processing";
  powerLevels: number;
  label?:      string;
}

export function LoadingProgress({ phase, powerLevels, label = "power levels" }: Props) {
  const [elapsed,  setElapsed]  = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (phase !== "connecting") return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Asymptotic curve: tau=25s → ~33% at 10s, ~70% at 30s, ~86% at 50s.
  useEffect(() => {
    if (phase !== "computing") return;
    const start = Date.now();
    const id = setInterval(() => {
      setProgress(88 * (1 - Math.exp(-(Date.now() - start) / 25000)));
    }, 80);
    return () => clearInterval(id);
  }, [phase]);

  const displayProgress = phase === "processing" ? 100 : progress;

  if (phase === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
        {/* Spinning ring */}
        <div className="w-9 h-9 rounded-full border-2 border-az-light-platinum border-t-az-mulberry animate-spin mb-5" />
        <p className="text-az-graphite text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>
          Connecting to API…
        </p>
        <p className="text-az-platinum text-xs mt-1">{elapsed}s elapsed</p>
        <p className="text-[11px] text-az-platinum mt-4 max-w-[260px] text-center leading-relaxed">
          The API server may take up to&nbsp;
          <span className="text-az-graphite font-medium">50 seconds</span>
          &nbsp;to wake up on a cold start.
        </p>
      </div>
    );
  }

  if (phase === "computing") {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
        <p className="text-az-graphite text-sm font-semibold mb-1" style={{ fontFamily: "var(--font-heading)" }}>
          Computing {powerLevels} {label}…
        </p>
        <p className="text-az-platinum text-xs mb-4">Evaluating candidate designs</p>
        <div className="w-64 h-1.5 rounded-full bg-az-light-platinum overflow-hidden">
          <div
            className="h-full rounded-full bg-az-mulberry transition-none"
            style={{ width: `${displayProgress}%` }}
          />
        </div>
        <p className="text-[11px] text-az-platinum mt-2">{Math.round(displayProgress)}%</p>
      </div>
    );
  }

  // processing
  return (
    <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-az-light-platinum bg-white print-hidden">
      <p className="text-az-graphite text-sm font-semibold mb-4" style={{ fontFamily: "var(--font-heading)" }}>
        Processing results…
      </p>
      <div className="w-64 h-1.5 rounded-full bg-az-light-platinum overflow-hidden">
        <div className="h-full rounded-full bg-az-mulberry" style={{ width: "100%" }} />
      </div>
    </div>
  );
}
