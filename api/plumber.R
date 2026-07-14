library(plumber)
library(gsDesign)

#* @apiTitle GS-Intersect API
#* @apiDescription Utility optimization for Group Sequential survival trial design

#* Health check
#* @get /health
function() list(status = "ok")

#* Paired Z/T test design utility
#* @post /paired
function(req) {
  body <- jsonlite::fromJSON(req$postBody)

  mu_D  <- as.numeric(body$mu_D  %||% 2)
  sigma <- as.numeric(body$sigma %||% 3)
  alpha <- as.numeric(body$alpha %||% 0.05)
  n_min <- as.integer(body$n_min %||% 5)
  n_max <- as.integer(body$n_max %||% 100)

  if (n_min < 2)      n_min <- 2L
  if (n_max > 500)    n_max <- 500L
  if (n_min >= n_max) stop("n_min must be less than n_max")

  delta  <- mu_D / sigma
  n_grid <- seq(n_min, n_max)
  z_crit <- qnorm(1 - alpha / 2)

  results <- lapply(n_grid, function(n) {
    ncp   <- delta * sqrt(n)
    pwr_z <- 1 - pnorm(z_crit - ncp) + pnorm(-z_crit - ncp)
    lr_z  <- pwr_z / alpha
    mb_z  <- z_crit * sigma / sqrt(n)

    df     <- n - 1L
    t_crit <- qt(1 - alpha / 2, df = df)
    pwr_t  <- 1 - pt(t_crit, df = df, ncp = ncp) + pt(-t_crit, df = df, ncp = ncp)
    lr_t   <- pwr_t / alpha
    mb_t   <- t_crit * sigma / sqrt(n)

    list(
      n         = n,
      power_z   = round(pwr_z  * 100, 2),
      power_t   = round(pwr_t  * 100, 2),
      lr_z      = round(lr_z,   4),
      lr_t      = round(lr_t,   4),
      mb_z      = round(mb_z,   4),
      mb_t      = round(mb_t,   4),
      utility_z = round(lr_z * mb_z, 4),
      utility_t = round(lr_t * mb_t, 4)
    )
  })

  util_z <- sapply(results, `[[`, "utility_z")
  util_t <- sapply(results, `[[`, "utility_t")

  list(
    results   = results,
    optimal_z = results[[which.max(util_z)]],
    optimal_t = results[[which.max(util_t)]],
    delta     = round(delta, 4)
  )
}

#* Enable CORS
#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}

#* Run GS utility optimization
#* @post /optimize
function(req) {
  body <- jsonlite::fromJSON(req$postBody)

  k        <- as.integer(body$k %||% 2)
  alpha    <- as.numeric(body$alpha %||% 0.05)
  timing_raw <- as.numeric(body$timing %||% 0.7)
  hr       <- as.numeric(body$hr %||% 0.7)
  medianC  <- as.numeric(body$medianC %||% 12)
  eta      <- as.numeric(body$eta %||% 0.05)
  minfup   <- as.numeric(body$minfup %||% 24)
  gamma    <- as.numeric(body$gamma %||% c(2.5, 5, 7.5, 10))
  R        <- as.numeric(body$R %||% c(2, 2, 2, 12))
  sfu_name <- body$sfu %||% "sfLDOF"
  sfl_name <- body$sfl %||% "sfLDOF"

  sfu <- get(sfu_name)
  sfl <- get(sfl_name)

  # Build timing vector of length k-1.
  # If user provided fewer values than needed, replicate the last value.
  n_timings <- k - 1
  if (n_timings == 0) {
    timing_gs <- numeric(0)
  } else if (length(timing_raw) >= n_timings) {
    timing_gs <- timing_raw[seq_len(n_timings)]
  } else {
    timing_gs <- c(timing_raw, rep(timing_raw[length(timing_raw)], n_timings - length(timing_raw)))
  }

  lambdaC <- 1 / medianC
  T_total <- sum(R) + minfup
  test.type <- 4
  astar <- 0

  pwr_seq <- c(seq(0.50, 0.95, 0.05), 0.99)
  lpwr <- length(pwr_seq)

  results <- vector("list", lpwr)

  for (i in seq_len(lpwr)) {
    tryCatch({
      x <- gsSurv(
        k = k, test.type = test.type,
        alpha = alpha / 2,
        beta = 1 - pwr_seq[i],
        astar = astar,
        timing = if (n_timings > 0) timing_gs else NULL,
        sfu = sfu, sfupar = 0,
        sfl = sfl, sflpar = 0,
        lambdaC = lambdaC, hr = hr, hr0 = 1,
        eta = eta, gamma = gamma, R = R, S = NULL,
        T = T_total, minfup = minfup, ratio = 1
      )

      tgS <- gsBoundSummary(x, ratio = 1, digits = 4, ddigits = 2,
                            tdigits = 1, timename = "Month")

      # Total N is always in the first analysis block, row 2, col 1: "N: <value>"
      N_total <- as.integer(strsplit(tgS[2, 1], ":")[[1]][2])

      # Extract all k analyses using 5-rows-per-analysis formula:
      #   Analysis j (1-indexed): N/fp at row 2+(j-1)*5
      #                            Events/CV at row 3+(j-1)*5
      #                            Power at row 5+(j-1)*5
      all_stages <- vector("list", k)
      for (j in seq_len(k)) {
        row_n  <- 2 + (j - 1) * 5   # N / false-positive row
        row_cv <- 3 + (j - 1) * 5   # Events / CV row
        row_pw <- 5 + (j - 1) * 5   # Cumulative power row

        ne_j   <- as.integer(strsplit(tgS[row_cv, 1], ":")[[1]][2])
        fp_j   <- as.numeric(tgS[row_n,  3])
        cv_j   <- as.numeric(tgS[row_cv, 3])
        cpwr_j <- as.numeric(tgS[row_pw, 3])

        calpha_j  <- 2 * fp_j
        lr_j      <- cpwr_j / calpha_j
        utility_j <- (1 - cv_j) * lr_j
        r01m_j    <- (1 - calpha_j) / (1 - cpwr_j)
        maturity_j <- round(ne_j / N_total, 4)

        all_stages[[j]] <- list(
          events   = ne_j,
          cv       = round(cv_j, 4),
          utility  = round(utility_j, 4),
          fp       = round(fp_j, 6),
          alpha    = round(calpha_j, 6),
          power    = round(cpwr_j * 100, 1),
          r01m     = round(r01m_j, 4),
          maturity = maturity_j
        )
      }

      # IA stages (analyses 1 to k-1); FA is analysis k
      ia_stages <- all_stages[seq_len(k - 1)]
      fa_stage  <- all_stages[[k]]

      # Backward-compatible top-level fields use IA stage 1 and FA
      results[[i]] <- list(
        power      = round(pwr_seq[i] * 100, 1),
        power_IA   = ia_stages[[1]]$power,   # IA-specific cumulative power (distinct from FA target)
        N          = N_total,
        events_IA  = ia_stages[[1]]$events,
        events_FA  = fa_stage$events,
        cv_IA      = ia_stages[[1]]$cv,
        cv_FA      = fa_stage$cv,
        utility_IA = ia_stages[[1]]$utility,
        utility_FA = fa_stage$utility,
        alpha_IA   = ia_stages[[1]]$alpha,
        alpha_FA   = fa_stage$alpha,
        ia_stages  = ia_stages   # full per-stage breakdown
      )
    }, error = function(e) {
      results[[i]] <<- NULL
    })
  }

  results <- Filter(Negate(is.null), results)

  if (length(results) == 0) {
    stop("All power levels failed. Check that timing fractions are strictly increasing and parameters are feasible for k=", k, ".")
  }

  # Optimal for backward-compat top-level IA (stage 1) and FA
  u_IA <- sapply(results, `[[`, "utility_IA")
  u_FA <- sapply(results, `[[`, "utility_FA")
  opt_IA <- which.max(u_IA)
  opt_FA <- which.max(u_FA)

  # Optimal per IA stage (for k>2 multi-stage UI)
  optimal_IAs <- lapply(seq_len(k - 1), function(j) {
    utils_j <- sapply(results, function(r) r$ia_stages[[j]]$utility)
    results[[which.max(utils_j)]]
  })

  list(
    k           = k,
    results     = results,
    optimal_IA  = results[[opt_IA]],
    optimal_FA  = results[[opt_FA]],
    optimal_IAs = optimal_IAs
  )
}

#* Simon 2-stage design optimization
#* @post /simon
function(req) {
  body <- jsonlite::fromJSON(req$postBody)

  pu   <- as.numeric(body$pu   %||% 0.30)
  pa   <- as.numeric(body$pa   %||% 0.50)
  ep1  <- as.numeric(body$ep1  %||% 0.10)
  nmax <- as.integer(body$nmax %||% 150)

  ep2_seq <- c(0.01, 0.05, seq(0.1, 0.5, 0.01))   # 43 power levels matching Fabio's sweep
  lep2 <- length(ep2_seq)

  results <- vector("list", lep2)

  for (j in seq_len(lep2)) {
    ep2 <- ep2_seq[j]
    pwr <- 1 - ep2

    tryCatch({
      out <- clinfun::ph2simon(pu, pa, ep1, ep2, nmax)$out

      # Identify rows: optimal = min EN(p0) col 5; minimax = min n col 4.
      # When both designs are identical, ph2simon returns 1 row.
      if (nrow(out) == 1) {
        opt_row <- 1; mmx_row <- 1
      } else {
        opt_row <- which.min(out[, 5])   # min expected N under H0
        mmx_row <- which.min(out[, 4])   # min maximum N
      }

      r1_opt  <- out[opt_row, 1]; n1_opt <- out[opt_row, 2]
      r_opt   <- out[opt_row, 3]; n_opt  <- out[opt_row, 4]
      en0_opt <- out[opt_row, 5]

      r1_mmx  <- out[mmx_row, 1]; n1_mmx <- out[mmx_row, 2]
      r_mmx   <- out[mmx_row, 3]; n_mmx  <- out[mmx_row, 4]

      plr           <- pwr / ep1
      cv_ia_opt     <- r1_opt / n1_opt
      cv_fa_opt     <- r_opt  / n_opt
      cv_fa_mmx     <- r_mmx  / n_mmx
      utility_opt   <- plr * (cv_fa_opt - pu)
      utility_mmx   <- plr * (cv_fa_mmx - pu)
      p_early_stop  <- pbinom(r1_opt, n1_opt, pu)

      results[[j]] <- list(
        power           = round(pwr * 100, 1),
        r1              = as.integer(r1_opt),  n1    = as.integer(n1_opt),
        r               = as.integer(r_opt),   n     = as.integer(n_opt),
        cv_ia           = round(cv_ia_opt,    4),
        cv_fa           = round(cv_fa_opt,    4),
        en0             = round(en0_opt,      2),
        p_early_stop    = round(p_early_stop, 4),
        utility         = round(utility_opt,  4),
        minimax_r1      = as.integer(r1_mmx),  minimax_n1  = as.integer(n1_mmx),
        minimax_r       = as.integer(r_mmx),   minimax_n   = as.integer(n_mmx),
        minimax_cv_ia   = round(r1_mmx / n1_mmx, 4),
        minimax_cv_fa   = round(cv_fa_mmx,        4),
        minimax_utility = round(utility_mmx,       4)
      )
    }, error = function(e) {
      results[[j]] <<- NULL
    })
  }

  results <- Filter(Negate(is.null), results)

  if (length(results) == 0) {
    return(list(
      feasible = FALSE,
      error    = "No feasible design found. Try increasing nmax or adjusting parameters."
    ))
  }

  utilities <- sapply(results, `[[`, "utility")
  opt_idx   <- which.max(utilities)

  list(
    feasible = TRUE,
    results  = results,
    optimal  = results[[opt_idx]]
  )
}

#* Difference between proportions design utility (Gaussian approximation)
#* @post /diff-proportions
function(req) {
  body <- jsonlite::fromJSON(req$postBody)

  p_soc <- as.numeric(body$p_soc %||% 0.30)
  p_inv <- as.numeric(body$p_inv %||% 0.50)
  alpha <- as.numeric(body$alpha %||% 0.05)
  n_min <- as.integer(body$n_min %||% 20L)
  n_max <- as.integer(body$n_max %||% 200L)

  if (n_min < 2)      n_min <- 2L
  if (n_max > 1000)   n_max <- 1000L
  if (n_min >= n_max) stop("n_min must be less than n_max")
  if (p_inv <= p_soc) stop("p_inv must exceed p_soc")

  delta  <- p_inv - p_soc
  z_crit <- qnorm(1 - alpha / 2)

  results <- lapply(seq(n_min, n_max), function(n) {
    tryCatch({
      sigma   <- sqrt(p_soc * (1 - p_soc) / n + p_inv * (1 - p_inv) / n)
      power   <- pnorm(delta / sigma - z_crit) + pnorm(-delta / sigma - z_crit)
      mb      <- z_crit * sigma
      lr      <- power / alpha
      utility <- lr * mb
      list(
        n       = n,
        power   = round(power * 100, 2),
        lr      = round(lr,      4),
        mb      = round(mb,      4),
        utility = round(utility, 4)
      )
    }, error = function(e) NULL)
  })

  results <- Filter(Negate(is.null), results)
  if (length(results) == 0) stop("No valid results. Check parameters.")

  utilities <- sapply(results, `[[`, "utility")
  opt_idx   <- which.max(utilities)

  list(
    results = results,
    optimal = results[[opt_idx]],
    delta   = round(delta, 4)
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b
