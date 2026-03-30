import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DesignResult } from "@/lib/api";

// Colors per IA stage (index 0 = IA1, 1 = IA2, 2 = IA3)
const IA_COLORS = ["#6366f1", "#7c3aed", "#9333ea"];
const IA_LABEL_COLORS = ["text-indigo-600", "text-violet-700", "text-purple-700"];
const IA_BADGE_BG = ["bg-indigo-50 text-indigo-700 border-indigo-200", "bg-violet-50 text-violet-700 border-violet-200", "bg-purple-50 text-purple-700 border-purple-200"];
const IA_BORDER = ["border-indigo-200", "border-violet-200", "border-purple-200"];

interface Props {
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
  optimal_IAs?: DesignResult[];
  k?: number;
}

function StatItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-az-platinum uppercase tracking-wider font-medium">{label}</span>
      <span className="text-lg font-bold text-az-graphite">{value}</span>
    </div>
  );
}

export function OptimalCard({ optimal_IA, optimal_FA, optimal_IAs, k }: Props) {
  const numK = k ?? 2;
  const numIAs = numK - 1;

  // Build IA cards — one per stage for k>2, or single using top-level fields for k=2
  const iaCards = Array.from({ length: numIAs }, (_, j) => {
    const opt    = optimal_IAs?.[j] ?? optimal_IA;
    const stage  = opt.ia_stages?.[j];
    const events = stage?.events ?? opt.events_IA;
    const cv     = stage?.cv ?? opt.cv_IA;
    const util   = stage?.utility ?? opt.utility_IA;
    const color  = IA_COLORS[j % IA_COLORS.length];
    const label  = numIAs === 1 ? "Optimal — Interim Analysis" : `Optimal — IA Stage ${j + 1}`;
    return { opt, events, cv, util, color, label, j };
  });

  return (
    <div className={`grid grid-cols-1 gap-4 ${iaCards.length > 1 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
      {iaCards.map(({ opt, events, cv, util, color, label, j }) => (
        <Card key={j} className={`bg-white shadow-sm ${IA_BORDER[j % IA_BORDER.length]}`}>
          <CardHeader className="pb-3 border-b border-az-light-platinum">
            <CardTitle
              className={`text-sm font-semibold flex items-center gap-2 ${IA_LABEL_COLORS[j % IA_LABEL_COLORS.length]}`}
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
              {label}
              <Badge className={`ml-auto text-xs font-medium border ${IA_BADGE_BG[j % IA_BADGE_BG.length]}`}>
                {opt.power}% power
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 pt-4">
            <StatItem label="Total N"          value={opt.N.toLocaleString()} />
            <StatItem label={`Events at IA${numIAs > 1 ? ` ${j + 1}` : ""}`} value={events} />
            <StatItem label="Critical Value"   value={cv.toFixed(4)} />
            <StatItem label="Utility Score"    value={util.toFixed(4)} />
          </CardContent>
        </Card>
      ))}

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
          <StatItem label="Total N"       value={optimal_FA.N.toLocaleString()} />
          <StatItem label="Events at FA"  value={optimal_FA.events_FA} />
          <StatItem label="Critical Value" value={optimal_FA.cv_FA.toFixed(4)} />
          <StatItem label="Utility Score" value={optimal_FA.utility_FA.toFixed(4)} />
        </CardContent>
      </Card>
    </div>
  );
}
