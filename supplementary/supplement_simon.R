# Supplementary Material: Simon 2-Stage Design Utility Sweep
#
# Paper: "Calibration of clinical trial design based on design utility
#         combining precision and magnitude of treatment effects"
# Authors: Christina Yap, Daniel Jackson, Gabriel Innocenzi, Fabio Rigat
#
# Reproduces the Simon 2-stage utility results from Section 2.2
# (Figure 2 and Table 1). Runs across all three scenarios in Table 1.
#
# Requires: clinfun
# Install:  install.packages("clinfun")

library(clinfun)

# ── Table 1 scenarios ─────────────────────────────────────────────────────────

scenarios <- list(
  list(pu = 0.30, pa = 0.40, label = "Lower ORR 30%, Target ORR 40%"),
  list(pu = 0.30, pa = 0.50, label = "Lower ORR 30%, Target ORR 50%"),  # Figure 2
  list(pu = 0.30, pa = 0.60, label = "Lower ORR 30%, Target ORR 60%")
)

ep1  <- 0.05   # type I error (false positive rate), fixed at 5% for all scenarios
nmax <- 150    # maximum sample size to search over

# Power (1 - type II error) levels to sweep
ep2_seq <- c(0.01, 0.05, seq(0.10, 0.50, 0.01))

# ── Utility sweep function ────────────────────────────────────────────────────

run_simon_sweep <- function(pu, pa) {
  results <- vector("list", length(ep2_seq))

  for (j in seq_along(ep2_seq)) {
    ep2 <- ep2_seq[j]
    pwr <- 1 - ep2

    tryCatch({
      out <- ph2simon(pu, pa, ep1, ep2, nmax)$out

      # Identify optimal (min expected N under H0) and minimax (min maximum N) rows
      if (nrow(out) == 1) {
        opt_row <- 1
        mmx_row <- 1
      } else {
        opt_row <- which.min(out[, 5])
        mmx_row <- which.min(out[, 4])
      }

      r1  <- out[opt_row, 1];  n1  <- out[opt_row, 2]
      r   <- out[opt_row, 3];  n   <- out[opt_row, 4]
      en0 <- out[opt_row, 5]

      # Design utility (3): LR(+) * minimum detectable ORR benefit
      plr           <- pwr / ep1          # positive likelihood ratio (1)
      cv_fa         <- r / n              # critical ORR at final analysis
      min_orr_delta <- cv_fa - pu         # minimum detectable benefit (2)
      utility       <- plr * min_orr_delta  # design utility index (3)

      # Probability of early stopping under H0
      p_early_stop <- pbinom(r1, n1, pu)

      results[[j]] <- data.frame(
        power         = round(pwr * 100, 1),
        r1            = as.integer(r1),
        n1            = as.integer(n1),
        r             = as.integer(r),
        n             = as.integer(n),
        cv_ia         = round(r1 / n1,      4),
        cv_fa         = round(cv_fa,         4),
        min_orr_delta = round(min_orr_delta, 4),
        en0           = round(en0,           2),
        p_early_stop  = round(p_early_stop,  4),
        plr           = round(plr,           4),
        utility       = round(utility,       4)
      )
    }, error = function(e) NULL)
  }

  do.call(rbind, Filter(Negate(is.null), results))
}

# ── Run all scenarios ─────────────────────────────────────────────────────────

summary_rows <- list()

for (sc in scenarios) {
  cat(sprintf(
    "\n════════════════════════════════════════════════════\n"
  ))
  cat(sprintf("  %s\n", sc$label))
  cat(sprintf(
    "════════════════════════════════════════════════════\n"
  ))

  df <- run_simon_sweep(sc$pu, sc$pa)
  opt <- df[which.max(df$utility), ]

  cat("\nFull sweep results:\n")
  print(df, row.names = FALSE)

  cat("\nUtility-maximising design (Table 1 row):\n")
  print(opt, row.names = FALSE)

  summary_rows[[length(summary_rows) + 1]] <- data.frame(
    scenario      = sc$label,
    lower_orr_pct = sc$pu * 100,
    target_orr_pct = sc$pa * 100,
    opt_n         = opt$n,
    power_pct     = opt$power,
    min_orr_delta_pct = round(opt$min_orr_delta * 100, 1)
  )

  fname <- sprintf("simon_utility_pu%02.0f_pa%02.0f.csv", sc$pu * 100, sc$pa * 100)
  write.csv(df, fname, row.names = FALSE)
  cat(sprintf("\nResults saved to: %s\n", fname))
}

# ── Table 1 reproduction ──────────────────────────────────────────────────────

cat("\n════════════════════════════════════════════════════\n")
cat("  Table 1: Utility-maximising Simon 2-stage designs\n")
cat("════════════════════════════════════════════════════\n")
summary_df <- do.call(rbind, summary_rows)
print(summary_df, row.names = FALSE)
write.csv(summary_df, "simon_table1_summary.csv", row.names = FALSE)
cat("\nTable 1 saved to: simon_table1_summary.csv\n")
