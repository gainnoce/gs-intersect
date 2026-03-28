export interface DesignInputs {
  k: number;
  alpha: number;
  timing: number;
  hr: number;
  medianC: number;
  eta: number;
  minfup: number;
  gamma: number[];
  R: number[];
  sfu: string;
  sfl: string;
}

export interface DesignResult {
  power: number;
  N: number;
  events_IA: number;
  events_FA: number;
  cv_IA: number;
  cv_FA: number;
  utility_IA: number;
  utility_FA: number;
}

export interface OptimizeResponse {
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
}

export async function runOptimization(inputs: DesignInputs): Promise<OptimizeResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/optimize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(inputs),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  const data = await res.json();
  const coerce = (r: Record<string, unknown>): DesignResult => ({
    power: Number(r.power),
    N: Number(r.N),
    events_IA: Number(r.events_IA),
    events_FA: Number(r.events_FA),
    cv_IA: Number(r.cv_IA),
    cv_FA: Number(r.cv_FA),
    utility_IA: Number(r.utility_IA),
    utility_FA: Number(r.utility_FA),
  });
  return {
    results: data.results.map(coerce),
    optimal_IA: coerce(data.optimal_IA),
    optimal_FA: coerce(data.optimal_FA),
  };
}

export function exportCSV(results: DesignResult[]): void {
  const headers = ["Power (%)", "N Total", "Events IA", "Events FA", "CV IA", "CV FA", "Utility IA", "Utility FA"];
  const rows = results.map((r) => [
    r.power, r.N, r.events_IA, r.events_FA, r.cv_IA, r.cv_FA, r.utility_IA, r.utility_FA,
  ]);
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gs-intersect-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}
