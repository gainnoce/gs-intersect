"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PairedResult, PairedInputs } from "@/lib/api";

interface Props {
  optimal_z: PairedResult;
  optimal_t: PairedResult;
  inputs:    PairedInputs;
  delta:     number;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-az-platinum uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-az-graphite">{value}</span>
    </div>
  );
}

const COLOR_Z = "#003865";
const COLOR_T = "#1469b5";

export function PairedOptimalCard({ optimal_z, optimal_t, inputs, delta }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Z test card */}
        <Card className="bg-white shadow-sm" style={{ borderColor: `${COLOR_Z}55` }}>
          <CardHeader className="pb-3 border-b border-az-light-platinum">
            <CardTitle
              className="text-sm font-semibold flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)", color: COLOR_Z }}
            >
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: COLOR_Z }} />
              Optimal — Paired Z Test
              <Badge className="ml-auto text-xs font-medium border" style={{ background: `${COLOR_Z}10`, color: COLOR_Z, borderColor: `${COLOR_Z}40` }}>
                N = {optimal_z.n}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Sample size N"        value={optimal_z.n} />
              <StatItem label="Power"                value={`${optimal_z.power_z.toFixed(1)}%`} />
              <StatItem label="LR+ = Power / α"      value={optimal_z.lr_z.toFixed(4)} />
              <StatItem label="Min detectable Δ"     value={optimal_z.mb_z.toFixed(4)} />
              <StatItem label="Utility (LR+ × MB)"   value={optimal_z.utility_z.toFixed(4)} />
              <StatItem label="α"                    value={inputs.alpha} />
            </div>
          </CardContent>
        </Card>

        {/* T test card */}
        <Card className="bg-white shadow-sm" style={{ borderColor: `${COLOR_T}55` }}>
          <CardHeader className="pb-3 border-b border-az-light-platinum">
            <CardTitle
              className="text-sm font-semibold flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)", color: COLOR_T }}
            >
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: COLOR_T }} />
              Optimal — Paired t Test
              <Badge className="ml-auto text-xs font-medium border" style={{ background: `${COLOR_T}10`, color: COLOR_T, borderColor: `${COLOR_T}40` }}>
                N = {optimal_t.n}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <StatItem label="Sample size N"        value={optimal_t.n} />
              <StatItem label="Power"                value={`${optimal_t.power_t.toFixed(1)}%`} />
              <StatItem label="LR+ = Power / α"      value={optimal_t.lr_t.toFixed(4)} />
              <StatItem label="Min detectable Δ"     value={optimal_t.mb_t.toFixed(4)} />
              <StatItem label="Utility (LR+ × MB)"   value={optimal_t.utility_t.toFixed(4)} />
              <StatItem label="df = N − 1"               value={optimal_t.n - 1} />
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-[11px] text-az-platinum text-center leading-relaxed">
        Cohen&#39;s d = μ_D / σ ={" "}
        <span className="text-az-graphite font-medium">{delta.toFixed(4)}</span> ·
        μ_D = <span className="text-az-graphite font-medium">{inputs.mu_D}</span> ·
        σ = <span className="text-az-graphite font-medium">{inputs.sigma}</span> ·
        α = <span className="text-az-graphite font-medium">{inputs.alpha}</span>
      </p>
    </div>
  );
}
