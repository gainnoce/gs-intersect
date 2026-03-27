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
      <span className="text-xs text-zinc-500 uppercase tracking-wider">{label}</span>
      <span className="text-lg font-semibold text-zinc-100">{value}</span>
    </div>
  );
}

export function OptimalCard({ optimal_IA, optimal_FA }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="bg-indigo-950/40 border-indigo-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-indigo-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
            Optimal — Interim Analysis
            <Badge variant="outline" className="ml-auto border-indigo-700 text-indigo-300 text-xs">
              {optimal_IA.power}% power
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <StatItem label="Total N" value={optimal_IA.N.toLocaleString()} />
          <StatItem label="Events at IA" value={optimal_IA.events_IA} />
          <StatItem label="Critical Value" value={optimal_IA.cv_IA.toFixed(4)} />
          <StatItem label="Utility Score" value={optimal_IA.utility_IA.toFixed(4)} />
        </CardContent>
      </Card>

      <Card className="bg-emerald-950/40 border-emerald-800/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-emerald-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            Optimal — Final Analysis
            <Badge variant="outline" className="ml-auto border-emerald-700 text-emerald-300 text-xs">
              {optimal_FA.power}% power
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <StatItem label="Total N" value={optimal_FA.N.toLocaleString()} />
          <StatItem label="Events at FA" value={optimal_FA.events_FA} />
          <StatItem label="Critical Value" value={optimal_FA.cv_FA.toFixed(4)} />
          <StatItem label="Utility Score" value={optimal_FA.utility_FA.toFixed(4)} />
        </CardContent>
      </Card>
    </div>
  );
}
