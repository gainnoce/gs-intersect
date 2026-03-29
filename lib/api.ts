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

export function exportRScript(inputs: DesignInputs, response: OptimizeResponse): void {
  const fmtVec = (arr: number[]) => `c(${arr.join(", ")})`;
  const date = new Date().toISOString().split("T")[0];

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
timing     <- ${inputs.timing}
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

pwr_seq <- c(seq(0.10, 0.95, 0.05), 0.99)
lpwr    <- length(pwr_seq)

U1s    <- matrix(NA, lpwr, 2)
Ns     <- rep(NA, lpwr)
Ne_IA  <- rep(NA, lpwr)
Ne_FA  <- rep(NA, lpwr)
cv_IA  <- rep(NA, lpwr)
cv_FA  <- rep(NA, lpwr)

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

  N_total      <- as.integer(strsplit(tgS[2, 1], ":")[[1]][2])
  Nev_IA_FA    <- c(as.integer(strsplit(tgS[3, 1], ":")[[1]][2]),
                    as.integer(strsplit(tgS[8, 1], ":")[[1]][2]))
  mat_IA_FA    <- round(Nev_IA_FA / N_total, 2)
  fp_IA_FA     <- as.numeric(tgS[c(2, 7), 3])
  cpwr_IA_FA   <- as.numeric(tgS[c(5, 10), 3])
  cv_IA_FA     <- as.numeric(tgS[c(3, 8), 3])
  calpha_spent <- 2 * fp_IA_FA

  lr_pos  <- cpwr_IA_FA / calpha_spent
  U1s[i,] <- (1 - cv_IA_FA) * lr_pos

  Ns[i]    <- round(N_total)
  Ne_IA[i] <- round(Ns[i] * mat_IA_FA[1])
  Ne_FA[i] <- round(Ns[i] * mat_IA_FA[2])
  cv_IA[i] <- cv_IA_FA[1]
  cv_FA[i] <- cv_IA_FA[2]
}

# ── Optimal points ────────────────────────────────────────────────────────────

wM_IA <- which.max(U1s[, 1])
wM_FA <- which.max(U1s[, 2])

cat("\\n=== Optimal — Interim Analysis ===\\n")
cat(sprintf("  Power:         %.1f%%\\n", pwr_seq[wM_IA] * 100))
cat(sprintf("  N total:       %d\\n",     Ns[wM_IA]))
cat(sprintf("  Events at IA:  %d\\n",     Ne_IA[wM_IA]))
cat(sprintf("  Critical value (IA): %.4f\\n", cv_IA[wM_IA]))
cat(sprintf("  Utility (IA):  %.4f\\n",   U1s[wM_IA, 1]))

cat("\\n=== Optimal — Final Analysis ===\\n")
cat(sprintf("  Power:         %.1f%%\\n", pwr_seq[wM_FA] * 100))
cat(sprintf("  N total:       %d\\n",     Ns[wM_FA]))
cat(sprintf("  Events at FA:  %d\\n",     Ne_FA[wM_FA]))
cat(sprintf("  Critical value (FA): %.4f\\n", cv_FA[wM_FA]))
cat(sprintf("  Utility (FA):  %.4f\\n",   U1s[wM_FA, 2]))

# ── Expected values from GS-Intersect ────────────────────────────────────────
# Optimal IA → Power: ${response.optimal_IA.power}%, N: ${response.optimal_IA.N}, Events: ${response.optimal_IA.events_IA}, CV: ${response.optimal_IA.cv_IA.toFixed(4)}, Utility: ${response.optimal_IA.utility_IA.toFixed(4)}
# Optimal FA → Power: ${response.optimal_FA.power}%, N: ${response.optimal_FA.N}, Events: ${response.optimal_FA.events_FA}, CV: ${response.optimal_FA.cv_FA.toFixed(4)}, Utility: ${response.optimal_FA.utility_FA.toFixed(4)}

# ── Plot ──────────────────────────────────────────────────────────────────────

dev.new(width = 12, height = 6)
par(mfrow = c(1, 2))
par(mar = c(5, 5, 6, 5))

plot(Ne_IA, U1s[, 1], pch = 19, cex = 1.3,
     xlab = "N. events at IA", ylab = "LR(+) * (1 - HR CV IA)", xaxt = "n", yaxt = "n")
lines(Ne_IA, U1s[, 1])
axis(3, at = Ne_IA, label = round(cv_IA, 2))
mtext("IA CV", side = 3, line = 2.25)
axis(1, at = Ne_IA)
axis(2, at = U1s[, 1], label = round(U1s[, 1], 2), las = 2)
axis(4, at = sort(U1s[, 1]), label = sort(round(pwr_seq * 100)), las = 2)
mtext("power%", side = 4, line = 2.75)
abline(v = Ne_IA[wM_IA], col = "red", lty = 3)

plot(Ne_FA, U1s[, 2], pch = 19, cex = 1.3,
     xlab = "N. events at FA", ylab = "LR(+) * (1 - HR CV FA)", xaxt = "n", yaxt = "n")
lines(Ne_FA, U1s[, 2])
axis(3, at = Ne_FA, label = round(cv_FA, 2))
mtext("FA CV", side = 3, line = 2.25)
axis(1, at = Ne_FA)
axis(2, at = U1s[, 2], label = round(U1s[, 2], 2), las = 2)
axis(4, at = sort(U1s[, 2]), label = sort(round(pwr_seq * 100)), las = 2)
mtext("power%", side = 4, line = 2.75)
abline(v = Ne_FA[wM_FA], col = "red", lty = 3)
`;

  const blob = new Blob([script], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gs-intersect-validation.R";
  a.click();
  URL.revokeObjectURL(url);
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
