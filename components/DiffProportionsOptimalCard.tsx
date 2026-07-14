"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiffProportionsResult, DiffProportionsInputs } from "@/lib/api";

const COLOR = "#003865";

interface Props {
  optimal: DiffProportionsResult;
  inputs:  DiffProportionsInputs;
  delta:   number;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-az-platinum uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-az-graphite">{value}</span>
    </div>
  );
}

export function DiffProportionsOptimalCard({ optimal, inputs, delta }: Props) {
  return (
    <div className="space-y-3">
      <Card className="bg-white shadow-sm" style={{ borderColor: `${COLOR}55` }}>
        <CardHeader className="pb-3 border-b border-az-light-platinum">
          <CardTitle
            className="text-sm font-semibold flex items-center gap-2"
            style={{ fontFamily: "var(--font-heading)", color: COLOR }}
          >
            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: COLOR }} />
            Optimal Design — 2-Arm ORR
            <Badge className="ml-auto text-xs font-medium border" style={{ background: `${COLOR}10`, color: COLOR, borderColor: `${COLOR}40` }}>
              N = {optimal.n} per arm
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatItem label="N per arm"                value={optimal.n} />
            <StatItem label="Total N"                  value={optimal.n * 2} />
            <StatItem label="Power"                    value={`${optimal.power.toFixed(1)}%`} />
            <StatItem label="LR+ = Power / α"          value={optimal.lr.toFixed(4)} />
            <StatItem label="Min detectable diff (MB)" value={`${(optimal.mb * 100).toFixed(2)}%`} />
            <StatItem label="Utility (LR+ × MB)"       value={optimal.utility.toFixed(4)} />
          </div>
        </CardContent>
      </Card>

      <p className="text-[11px] text-az-platinum text-center leading-relaxed">
        ORR difference = p_INV − p_SOC ={" "}
        <span className="text-az-graphite font-medium">{(delta * 100).toFixed(0)}%</span>
        {" · "} p_SOC = <span className="text-az-graphite font-medium">{(inputs.p_soc * 100).toFixed(0)}%</span>
        {" · "} p_INV = <span className="text-az-graphite font-medium">{(inputs.p_inv * 100).toFixed(0)}%</span>
        {" · "} α = <span className="text-az-graphite font-medium">{inputs.alpha}</span>
      </p>
    </div>
  );
}
