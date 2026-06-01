export interface IAStageResult {
  events: number;
  cv: number;
  utility: number;
  fp: number;
  power: number;       // cumulative power at this stage (IA-specific)
  r01m?: number;       // LR(-) ratio: (1 - alpha_spent) / (1 - cumulative_power)
  maturity?: number;   // events / N total
}

export interface DesignInputs {
  k: number;
  alpha: number;
  timing: number[];   // length k-1; [0.7] for k=2, [0.5, 0.7] for k=3, etc.
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
  power: number;       // target FA cumulative power (%)
  power_IA?: number;   // IA-specific cumulative power at stage 1 (%) — may differ from power
  N: number;
  events_IA: number;
  events_FA: number;
  cv_IA: number;
  cv_FA: number;
  utility_IA: number;
  utility_FA: number;
  ia_stages?: IAStageResult[];
}

export interface OptimizeResponse {
  k?: number;
  results: DesignResult[];
  optimal_IA: DesignResult;
  optimal_FA: DesignResult;
  optimal_IAs?: DesignResult[];
}

// ── URL param serialization ───────────────────────────────────────────────────

export function inputsToParams(inputs: DesignInputs): URLSearchParams {
  const p = new URLSearchParams();
  p.set("k",       String(inputs.k));
  p.set("alpha",   String(inputs.alpha));
  p.set("timing",  inputs.timing.join(","));
  p.set("hr",      String(inputs.hr));
  p.set("medianC", String(inputs.medianC));
  p.set("eta",     String(inputs.eta));
  p.set("minfup",  String(inputs.minfup));
  p.set("gamma",   inputs.gamma.join(","));
  p.set("R",       inputs.R.join(","));
  p.set("sfu",     inputs.sfu);
  p.set("sfl",     inputs.sfl);
  return p;
}

export function paramsToInputs(params: URLSearchParams): DesignInputs | null {
  if (!params.has("k")) return null;
  const parseArr = (s: string) =>
    s.split(",").map(v => parseFloat(v.trim())).filter(n => !isNaN(n));
  return {
    k:       parseInt(params.get("k")!),
    alpha:   parseFloat(params.get("alpha") ?? "0.05"),
    timing:  parseArr(params.get("timing") ?? "0.7"),
    hr:      parseFloat(params.get("hr") ?? "0.7"),
    medianC: parseFloat(params.get("medianC") ?? "12"),
    eta:     parseFloat(params.get("eta") ?? "0.05"),
    minfup:  parseFloat(params.get("minfup") ?? "24"),
    gamma:   parseArr(params.get("gamma") ?? "2.5,5,7.5,10"),
    R:       parseArr(params.get("R") ?? "2,2,2,12"),
    sfu:     params.get("sfu") ?? "sfLDOF",
    sfl:     params.get("sfl") ?? "sfLDOF",
  };
}

// ── API call ─────────────────────────────────────────────────────────────────

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

  const coerceStage = (s: Record<string, unknown>): IAStageResult => ({
    events:   Number(s.events),
    cv:       Number(s.cv),
    utility:  Number(s.utility),
    fp:       Number(s.fp),
    power:    Number(s.power),
    r01m:     s.r01m    != null ? Number(s.r01m)    : undefined,
    maturity: s.maturity != null ? Number(s.maturity) : undefined,
  });

  const coerce = (r: Record<string, unknown>): DesignResult => ({
    power:      Number(r.power),
    power_IA:   r.power_IA != null ? Number(r.power_IA) : undefined,
    N:          Number(r.N),
    events_IA:  Number(r.events_IA),
    events_FA:  Number(r.events_FA),
    cv_IA:      Number(r.cv_IA),
    cv_FA:      Number(r.cv_FA),
    utility_IA: Number(r.utility_IA),
    utility_FA: Number(r.utility_FA),
    ia_stages:  Array.isArray(r.ia_stages)
      ? (r.ia_stages as Record<string, unknown>[]).map(coerceStage)
      : undefined,
  });

  return {
    k:           data.k ? Number(data.k) : 2,
    results:     data.results.map(coerce),
    optimal_IA:  coerce(data.optimal_IA),
    optimal_FA:  coerce(data.optimal_FA),
    optimal_IAs: Array.isArray(data.optimal_IAs)
      ? (data.optimal_IAs as Record<string, unknown>[]).map(coerce)
      : undefined,
  };
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function exportRScript(inputs: DesignInputs, response: OptimizeResponse): void {
  const fmtVec = (arr: number[]) => `c(${arr.join(", ")})`;
  const date = new Date().toISOString().split("T")[0];
  const timingR = inputs.timing.length === 1
    ? String(inputs.timing[0])
    : fmtVec(inputs.timing);

  const script = `\
########################################################################################
#
# GS-Intersect Validation Script
# Generated: ${date}
#
# Reproduces the utility optimisation from GS-Intersect using the parameters
# entered in the web interface. Run this script in R to validate the output.
#
########################################################################################

library(gsDesign)

# ── Parameters ────────────────────────────────────────────────────────────────

k          <- ${inputs.k}
test.type  <- 4
timing     <- ${timingR}
alpha      <- ${inputs.alpha}          # one-sided Type I error
eta        <- ${inputs.eta}            # dropout rate
astar      <- 0

sfu    <- ${inputs.sfu}
sfl    <- ${inputs.sfl}
sfupar <- 0
sflpar <- 0

median_soc <- ${inputs.medianC}
lambda_soc <- 1 / median_soc
HR         <- ${inputs.hr}

gamma  <- ${fmtVec(inputs.gamma)}      # enrollment rates
R      <- ${fmtVec(inputs.R)}          # enrollment durations
minfup <- ${inputs.minfup}
T      <- sum(R) + minfup
ratio  <- 1

# ── Power sweep ───────────────────────────────────────────────────────────────

pwr_seq <- c(seq(0.50, 0.95, 0.05), 0.99)
lpwr    <- length(pwr_seq)

U1s    <- matrix(NA, lpwr, k)
Ns     <- rep(NA, lpwr)
Ne_FA  <- rep(NA, lpwr)

for (i in 1:lpwr) {
  x <- gsSurv(
    k = k, test.type = test.type,
    alpha = alpha / 2,
    beta  = 1 - pwr_seq[i],
    astar = astar, timing = timing,
    sfu = sfu, sfupar = sfupar,
    sfl = sfl, sflpar = sflpar,
    lambdaC = lambda_soc, hr = HR, hr0 = 1,
    eta = eta, gamma = gamma, R = R, S = NULL,
    T = T, minfup = minfup, ratio = ratio
  )

  tgS <- gsBoundSummary(x, ratio = 1, digits = 4, ddigits = 2,
                        tdigits = 1, timename = "Month")

  N_total <- as.integer(strsplit(tgS[2, 1], ":")[[1]][2])
  Ns[i]   <- N_total

  for (j in seq_len(k)) {
    row_n  <- 2 + (j - 1) * 5
    row_cv <- 3 + (j - 1) * 5
    row_pw <- 5 + (j - 1) * 5
    fp_j   <- as.numeric(tgS[row_n,  3])
    cv_j   <- as.numeric(tgS[row_cv, 3])
    cpwr_j <- as.numeric(tgS[row_pw, 3])
    U1s[i, j] <- (1 - cv_j) * (cpwr_j / (2 * fp_j))
    if (j == k) Ne_FA[i] <- as.integer(strsplit(tgS[row_cv, 1], ":")[[1]][2])
  }
}

# ── Optimal points ────────────────────────────────────────────────────────────

for (j in seq_len(k)) {
  wM <- which.max(U1s[, j])
  if (j < k) {
    cat(sprintf("\\n=== Optimal — Interim Analysis %d ===\\n", j))
  } else {
    cat("\\n=== Optimal — Final Analysis ===\\n")
  }
  cat(sprintf("  Power:    %.1f%%\\n", pwr_seq[wM] * 100))
  cat(sprintf("  N total:  %d\\n",     Ns[wM]))
  cat(sprintf("  Utility:  %.4f\\n",   U1s[wM, j]))
}

# ── Expected values from GS-Intersect ─────────────────────────────────────────
# Optimal IA → Power: ${response.optimal_IA.power}%, N: ${response.optimal_IA.N}, Events: ${response.optimal_IA.events_IA}, CV: ${response.optimal_IA.cv_IA.toFixed(4)}, Utility: ${response.optimal_IA.utility_IA.toFixed(4)}
# Optimal FA → Power: ${response.optimal_FA.power}%, N: ${response.optimal_FA.N}, Events: ${response.optimal_FA.events_FA}, CV: ${response.optimal_FA.cv_FA.toFixed(4)}, Utility: ${response.optimal_FA.utility_FA.toFixed(4)}
`;

  const blob = new Blob([script], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gs-intersect-validation.R";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCSV(results: DesignResult[], k = 2): void {
  const numIAs = k - 1;
  const iaHeaders = Array.from({ length: numIAs }, (_, j) =>
    numIAs === 1
      ? ["Events IA", "CV IA", "Utility IA"]
      : [`Events IA${j + 1}`, `CV IA${j + 1}`, `Utility IA${j + 1}`]
  ).flat();
  const headers = ["Power (%)", "N Total", ...iaHeaders, "Events FA", "CV FA", "Utility FA"];

  const rows = results.map((r) => {
    const iaCols = Array.from({ length: numIAs }, (_, j) => [
      r.ia_stages?.[j]?.events  ?? r.events_IA,
      r.ia_stages?.[j]?.cv      ?? r.cv_IA,
      r.ia_stages?.[j]?.utility ?? r.utility_IA,
    ]).flat();
    return [r.power, r.N, ...iaCols, r.events_FA, r.cv_FA, r.utility_FA];
  });
  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gs-intersect-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Simon 2-Stage ─────────────────────────────────────────────────────────────

export interface SimonInputs {
  pu:   number;
  pa:   number;
  ep1:  number;
  nmax: number;
}

export interface SimonResult {
  power:           number;
  r1:              number;
  n1:              number;
  r:               number;
  n:               number;
  cv_ia:           number;
  cv_fa:           number;
  en0:             number;
  p_early_stop:    number;
  utility:         number;
  minimax_r1:      number;
  minimax_n1:      number;
  minimax_r:       number;
  minimax_n:       number;
  minimax_cv_ia:   number;
  minimax_cv_fa:   number;
  minimax_utility: number;
}

export interface SimonResponse {
  results:  SimonResult[];
  optimal:  SimonResult;
  feasible: boolean;
  error?:   string;
}

export function simonInputsToParams(inputs: SimonInputs): URLSearchParams {
  const p = new URLSearchParams();
  p.set("pu",   String(inputs.pu));
  p.set("pa",   String(inputs.pa));
  p.set("ep1",  String(inputs.ep1));
  p.set("nmax", String(inputs.nmax));
  return p;
}

export function simonParamsToInputs(params: URLSearchParams): SimonInputs | null {
  if (!params.has("pu")) return null;
  return {
    pu:   parseFloat(params.get("pu")  ?? "0.3"),
    pa:   parseFloat(params.get("pa")  ?? "0.5"),
    ep1:  parseFloat(params.get("ep1") ?? "0.1"),
    nmax: parseInt(params.get("nmax")  ?? "150"),
  };
}

export async function runSimon(inputs: SimonInputs): Promise<SimonResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const res = await fetch(`${apiUrl}/simon`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(inputs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  if (!data.feasible) {
    throw new Error(data.error ?? "No feasible design found.");
  }
  const coerce = (r: Record<string, unknown>): SimonResult => ({
    power:           Number(r.power),
    r1:              Number(r.r1),    n1:    Number(r.n1),
    r:               Number(r.r),     n:     Number(r.n),
    cv_ia:           Number(r.cv_ia), cv_fa: Number(r.cv_fa),
    en0:             Number(r.en0),
    p_early_stop:    Number(r.p_early_stop),
    utility:         Number(r.utility),
    minimax_r1:      Number(r.minimax_r1),  minimax_n1:      Number(r.minimax_n1),
    minimax_r:       Number(r.minimax_r),   minimax_n:       Number(r.minimax_n),
    minimax_cv_ia:   Number(r.minimax_cv_ia),
    minimax_cv_fa:   Number(r.minimax_cv_fa),
    minimax_utility: Number(r.minimax_utility),
  });
  return {
    feasible: true,
    results:  (data.results as Record<string, unknown>[]).map(coerce),
    optimal:  coerce(data.optimal as Record<string, unknown>),
  };
}

export function exportSimonRScript(inputs: SimonInputs, optimal: SimonResult): void {
  const date = new Date().toISOString().split("T")[0];
  const script = `\
########################################################################################
#
# GS-Intersect — Simon 2-Stage Validation Script
# Generated: ${date}
#
# Reproduces the utility optimisation for the Simon 2-stage design using clinfun::ph2simon.
# Run in R to validate the output from the web interface.
#
########################################################################################

library(clinfun)

# ── Parameters ────────────────────────────────────────────────────────────────

pu   <- ${inputs.pu}     # unacceptable response rate (H0)
pa   <- ${inputs.pa}     # target response rate (H1)
ep1  <- ${inputs.ep1}    # type I error (alpha)
nmax <- ${inputs.nmax}   # maximum sample size

# ── Power sweep ───────────────────────────────────────────────────────────────

ep2_seq <- c(0.01, seq(0.05, 0.95, 0.05), 0.99)
lep2    <- length(ep2_seq)

utility <- rep(NA, lep2)
n_fa    <- rep(NA, lep2)
cv_fa   <- rep(NA, lep2)

for (j in seq_len(lep2)) {
  ep2 <- ep2_seq[j]; pwr <- 1 - ep2
  out <- tryCatch(ph2simon(pu, pa, ep1, ep2, nmax)$out, error = function(e) NULL)
  if (is.null(out)) next
  opt_row      <- if (nrow(out) >= 2) which.min(out[, 5]) else 1
  r            <- out[opt_row, 3]; n <- out[opt_row, 4]
  cv_fa[j]     <- r / n
  n_fa[j]      <- n
  utility[j]   <- (pwr / ep1) * (cv_fa[j] - pu)
}

wM <- which.max(utility)
cat(sprintf("Optimal power:   %.1f%%\\n", (1 - ep2_seq[wM]) * 100))
cat(sprintf("Optimal N:       %d\\n",     n_fa[wM]))
cat(sprintf("Optimal CV_FA:   %.4f\\n",   cv_fa[wM]))
cat(sprintf("Optimal utility: %.4f\\n",   utility[wM]))

# ── Expected from GS-Intersect ────────────────────────────────────────────────
# Optimal -> Power: ${optimal.power}%, N: ${optimal.n}, CV_FA: ${optimal.cv_fa.toFixed(4)}, Utility: ${optimal.utility.toFixed(4)}
`;
  const blob = new Blob([script], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "simon-validation.R";
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSimonCSV(results: SimonResult[]): void {
  const headers = [
    "Power (%)", "N1", "r1", "CV1", "N", "r", "CV_FA",
    "Utility", "EN0", "P(stop|H0) %", "Minimax N", "Minimax CV_FA",
  ];
  const rows = results.map(r => [
    r.power, r.n1, r.r1, r.cv_ia.toFixed(4), r.n, r.r, r.cv_fa.toFixed(4),
    r.utility.toFixed(4), r.en0.toFixed(2), (r.p_early_stop * 100).toFixed(2),
    r.minimax_n, r.minimax_cv_fa.toFixed(4),
  ]);
  const csv  = [headers, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "simon-results.csv";
  a.click();
  URL.revokeObjectURL(url);
}
