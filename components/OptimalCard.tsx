import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DesignResult } from "@/lib/api";

interface Props {
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-az-platinum uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-az-graphite">{value}</span>
    </div>
  );
}

export function OptimalCard({ optimal_IA, optimal_FA }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-white border-az-mulberry/30 shadow-sm">
        <CardHeader className="pb-3 border-b border-az-light-platinum">
          <CardTitle className="text-sm font-semibold text-az-mulberry flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <span className="w-2 h-2 rounded-full bg-az-mulberry inline-block" />
            Optimal — Interim Analysis
            <Badge className="ml-auto bg-az-mulberry/10 text-az-mulberry border-az-mulberry/30 text-xs font-medium">
              {optimal_IA.power}% power
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-4">
          <StatItem label="Total N" value={optimal_IA.N.toLocaleString()} />
          <StatItem label="Events at IA" value={optimal_IA.events_IA} />
          <StatItem label="Critical Value" value={optimal_IA.cv_IA.toFixed(4)} />
          <StatItem label="Utility Score" value={optimal_IA.utility_IA.toFixed(4)} />
        </CardContent>
      </Card>

      <Card className="bg-white border-az-navy/30 shadow-sm">
        <CardHeader className="pb-3 border-b border-az-light-platinum">
          <CardTitle className="text-sm font-semibold text-az-navy flex items-center gap-2" style={{ fontFamily: "var(--font-heading)" }}>
            <span className="w-2 h-2 rounded-full bg-az-navy inline-block" />
            Optimal — Final Analysis
            <Badge className="ml-auto bg-az-navy/10 text-az-navy border-az-navy/30 text-xs font-medium">
              {optimal_FA.power}% power
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 pt-4">
          <StatItem label="Total N" value={optimal_FA.N.toLocaleString()} />
          <StatItem label="Events at FA" value={optimal_FA.events_FA} />
          <StatItem label="Critical Value" value={optimal_FA.cv_FA.toFixed(4)} />
          <StatItem label="Utility Score" value={optimal_FA.utility_FA.toFixed(4)} />
        </CardContent>
      </Card>
    </div>
  );
}
