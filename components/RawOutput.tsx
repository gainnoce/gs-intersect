"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { OptimizeResponse, DesignInputs } from "@/lib/api";

interface Props {
  response: OptimizeResponse;
  inputs: DesignInputs;
}

export function RawOutput({ response, inputs }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-az-light-platinum bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-az-light-platinum/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-az-platinum" />
          ) : (
            <ChevronRight className="w-4 h-4 text-az-platinum" />
          )}
          <span className="text-sm font-semibold text-az-navy" style={{ fontFamily: "var(--font-heading)" }}>
            Raw Output
          </span>
          <span className="text-xs text-az-platinum">— full API response for validation</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-az-light-platinum">
          {/* Inputs used */}
          <div className="px-5 py-4 border-b border-az-light-platinum">
            <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold mb-3">
              Parameters Sent
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(inputs).map(([key, val]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-az-platinum font-mono">{key}</span>
                  <span className="text-xs text-az-graphite font-mono bg-az-light-platinum/60 px-1.5 py-0.5 rounded">
                    {Array.isArray(val) ? `[${val.join(", ")}]` : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Full JSON */}
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-az-platinum font-semibold mb-3">
              Full API Response (JSON)
            </p>
            <pre className="text-[11px] text-az-graphite font-mono bg-az-light-platinum/40 rounded-lg p-4 overflow-auto max-h-96 leading-relaxed">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
