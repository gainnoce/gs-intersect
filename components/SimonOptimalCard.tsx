"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SimonResult, SimonInputs } from "@/lib/api";

interface Props {
  optimal: SimonResult;
  inputs:  SimonInputs;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-az-platinum uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-az-graphite">{value}</span>
    </div>
  );
}

export function SimonOptimalCard({ optimal, inputs }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Stage 1 card */}
        <Card className="bg-white border-indigo-200 shadow-sm">
          <CardHeader className="pb-3 border-b border-az-light-platinum">
            <CardTitle
              className="text-sm font-semibold text-indigo-600 flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0 bg-indigo-500" />
              Optimal — Stage 1 (Interim)
              <Badge className="ml-auto text-xs font-medium border bg-indigo-50 text-indigo-700 border-indigo-200">
                n₁ = {optimal.n1}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-az-graphite leading-snug">
              Stop early if{" "}
              <span className="font-bold text-indigo-600">≤ {optimal.r1}</span>{" "}
              responses in{" "}
              <span className="font-bold text-indigo-600">{optimal.n1}</span>{" "}
              patients
            </p>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Stop if ≤ r₁ responses" value={optimal.r1} />
              <StatItem label="Interim N"               value={optimal.n1} />
              <StatItem label="Critical Value (CV₁)"    value={optimal.cv_ia.toFixed(4)} />
              <StatItem label="P(stop early | H₀)"      value={`${(optimal.p_early_stop * 100).toFixed(1)}%`} />
            </div>
          </CardContent>
        </Card>

        {/* Final analysis card */}
        <Card className="bg-white border-az-navy/30 shadow-sm">
          <CardHeader className="pb-3 border-b border-az-light-platinum">
            <CardTitle
              className="text-sm font-semibold text-az-navy flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="w-2 h-2 rounded-full bg-az-navy inline-block flex-shrink-0" />
              Optimal — Final Analysis
              <Badge className="ml-auto bg-az-navy/10 text-az-navy border-az-navy/30 text-xs font-medium">
                {optimal.power}% power
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <p className="text-sm text-az-graphite leading-snug">
              Declare promising if{" "}
              <span className="font-bold text-az-navy">&gt; {optimal.r}</span>{" "}
              responses in{" "}
              <span className="font-bold text-az-navy">{optimal.n}</span>{" "}
              patients
            </p>
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Total N"        value={optimal.n} />
              <StatItem label="Declare if > r" value={optimal.r} />
              <StatItem label="Critical Value" value={optimal.cv_fa.toFixed(4)} />
              <StatItem label="EN₀"            value={optimal.en0.toFixed(1)} />
              <StatItem label="Utility Score"  value={optimal.utility.toFixed(4)} />
              <StatItem label="α"              value={inputs.ep1} />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-az-platinum text-center leading-relaxed">
        Optimal design at{" "}
        <span className="text-az-graphite font-medium">{optimal.power}%</span> power ·
        α = <span className="text-az-graphite font-medium">{inputs.ep1}</span> ·
        EN₀ = <span className="text-az-graphite font-medium">{optimal.en0.toFixed(1)}</span> ·
        P(stop&nbsp;early&nbsp;|&nbsp;H₀) = <span className="text-az-graphite font-medium">{(optimal.p_early_stop * 100).toFixed(1)}%</span>
      </p>
    </div>
  );
}
