import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SimonResult, SimonInputs } from "@/lib/api";

interface Props {
  optimal: SimonResult;
  inputs:  SimonInputs;
}

export function SimonOptimalCard({ optimal, inputs }: Props) {
  return (
    <div className="space-y-3">
      {/* Two-card row */}
      <div className="grid grid-cols-2 gap-3">

        {/* Stage 1 card */}
        <Card className="border-az-light-platinum shadow-sm bg-white">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold text-az-navy"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Stage 1 (Interim)
              </p>
              <Badge
                className="text-[10px] font-medium"
                style={{ background: "#003865", color: "#fff" }}
              >
                n₁ = {optimal.n1}
              </Badge>
            </div>

            <p className="text-sm text-az-graphite leading-snug">
              Stop early if{" "}
              <span className="font-bold text-az-navy">≤ {optimal.r1}</span>{" "}
              responses in{" "}
              <span className="font-bold text-az-navy">{optimal.n1}</span> patients
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">CV₁</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.cv_ia.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">P(stop | H₀)</p>
                <p className="text-sm font-semibold text-az-graphite">
                  {(optimal.p_early_stop * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Final analysis card */}
        <Card className="border-az-light-platinum shadow-sm bg-white">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p
                className="text-xs font-semibold text-az-navy"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Final Analysis
              </p>
              <Badge
                className="text-[10px] font-medium"
                style={{ background: "#830051", color: "#fff" }}
              >
                {optimal.power}% power
              </Badge>
            </div>

            <p className="text-sm text-az-graphite leading-snug">
              Declare promising if{" "}
              <span className="font-bold text-az-navy">&gt; {optimal.r}</span>{" "}
              responses in{" "}
              <span className="font-bold text-az-navy">{optimal.n}</span> patients
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">CV_FA</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.cv_fa.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">Total N</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.n}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">EN₀</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.en0.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-[10px] text-az-platinum uppercase tracking-wide">Utility</p>
                <p className="text-sm font-semibold text-az-graphite">{optimal.utility.toFixed(4)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary line */}
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
