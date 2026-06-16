# Supplementary Material: Group Sequential Design Utility Sweep
#
# Paper: "Calibration of clinical trial design based on design utility
#         combining precision and magnitude of treatment effects"
# Authors: Christina Yap, Daniel Jackson, Gabriel Innocenzi, Fabio Rigat
#
# Reproduces the group sequential design utility results from Section 3
# (Figure 4). Two scenarios are run: IA at 50% and IA at 80% information
# fraction, as described in the paper.
#
# Requires: gsDesign
# Install:  install.packages("gsDesign")

library(gsDesign)

# ── Design parameters (Section 3) ────────────────────────────────────────────

k       <- 2              # number of analyses: 1 interim (IA) + 1 final (FA)
alpha   <- 0.05           # two-sided family-wise error rate
hr      <- 0.7            # target hazard ratio (investigational vs. control)
medianC <- 12             # median TTE (months) under control arm
eta     <- 0.05           # annual dropout rate
minfup  <- 24             # minimum follow-up (months)
gamma   <- c(2.5, 5, 7.5, 10)  # enrolment rates (patients/month)
R       <- c(2, 2, 2, 12)      # duration of each enrolment period (months)
sfu     <- sfLDOF         # O'Brien-Fleming upper spending function
sfl     <- sfLDOF         # O'Brien-Fleming lower spending function

# IA information fractions evaluated (Figure 4: left panels)
ia_fractions <- c(0.50, 0.80)

# Power levels to sweep (matching web application)
pwr_seq <- c(seq(0.50, 0.95, 0.05), 0.99)

# ── Utility sweep function ────────────────────────────────────────────────────

run_gs_sweep <- function(timing_ia) {
  lambdaC <- 1 / medianC
  T_total <- sum(R) + minfup
  results <- vector("list", length(pwr_seq))

  for (i in seq_along(pwr_seq)) {
    tryCatch({
      x <- gsSurv(
        k        = k,
        test.type = 4,
        alpha    = alpha / 2,
        beta     = 1 - pwr_seq[i],
        astar    = 0,
        timing   = timing_ia,
        sfu      = sfu,  sfupar = 0,
        sfl      = sfl,  sflpar = 0,
        lambdaC  = lambdaC,
        hr       = hr,
        hr0      = 1,
        eta      = eta,
        gamma    = gamma,
        R        = R,
        S        = NULL,
        T        = T_total,
        minfup   = minfup,
        ratio    = 1
      )

      tgS <- gsBoundSummary(x, ratio = 1, digits = 4, ddigits = 2,
                            tdigits = 1, timename = "Month")

      N_total <- as.integer(strsplit(tgS[2, 1], ":")[[1]][2])

      # Extract per-analysis values using 5-rows-per-analysis structure
      all_stages <- vector("list", k)
      for (j in seq_len(k)) {
        row_n  <- 2 + (j - 1) * 5
        row_cv <- 3 + (j - 1) * 5
        row_pw <- 5 + (j - 1) * 5

        ne_j    <- as.integer(strsplit(tgS[row_cv, 1], ":")[[1]][2])
        fp_j    <- as.numeric(tgS[row_n,  3])
        cv_j    <- as.numeric(tgS[row_cv, 3])
        cpwr_j  <- as.numeric(tgS[row_pw, 3])

        calpha_j  <- 2 * fp_j
        lr_j      <- cpwr_j / calpha_j          # positive likelihood ratio (1)
        utility_j <- (1 - cv_j) * lr_j          # design utility index (3)

        all_stages[[j]] <- list(
          events  = ne_j,
          cv      = round(cv_j,      4),
          power   = round(cpwr_j * 100, 1),
          lr      = round(lr_j,      4),
          utility = round(utility_j, 4)
        )
      }

      ia <- all_stages[[1]]
      fa <- all_stages[[k]]

      results[[i]] <- data.frame(
        power_target = round(pwr_seq[i] * 100, 1),
        N            = N_total,
        events_IA    = ia$events,
        cv_IA        = ia$cv,
        power_IA     = ia$power,
        lr_IA        = ia$lr,
        utility_IA   = ia$utility,
        events_FA    = fa$events,
        cv_FA        = fa$cv,
        power_FA     = fa$power,
        lr_FA        = fa$lr,
        utility_FA   = fa$utility
      )
    }, error = function(e) NULL)
  }

  do.call(rbind, Filter(Negate(is.null), results))
}

# ── Run sweep for each IA information fraction ────────────────────────────────

for (frac in ia_fractions) {
  cat(sprintf(
    "\n════════════════════════════════════════════════════\n",
  ))
  cat(sprintf("  IA information fraction: %.0f%%\n", frac * 100))
  cat(sprintf(
    "════════════════════════════════════════════════════\n"
  ))

  df <- run_gs_sweep(frac)

  opt_ia <- df[which.max(df$utility_IA), ]
  opt_fa <- df[which.max(df$utility_FA), ]

  cat("\nFull sweep results:\n")
  print(df, row.names = FALSE)

  cat("\nUtility-maximising design at IA:\n")
  print(opt_ia, row.names = FALSE)

  cat("\nUtility-maximising design at FA:\n")
  print(opt_fa, row.names = FALSE)

  fname <- sprintf("gs_utility_ia%02.0fpct.csv", frac * 100)
  write.csv(df, fname, row.names = FALSE)
  cat(sprintf("\nResults saved to: %s\n", fname))
}
