library(plumber)
library(gsDesign)

#* @apiTitle GS-Intersect API
#* @apiDescription Utility optimization for Group Sequential survival trial design

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
  timing   <- as.numeric(body$timing %||% 0.7)
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

  lambdaC <- 1 / medianC
  T_total <- sum(R) + minfup
  test.type <- 4
  astar <- 0

  pwr_seq <- c(seq(0.10, 0.95, 0.05), 0.99)
  lpwr <- length(pwr_seq)

  results <- vector("list", lpwr)

  for (i in seq_len(lpwr)) {
    tryCatch({
      x <- gsSurv(
        k = k, test.type = test.type,
        alpha = alpha / 2,
        beta = 1 - pwr_seq[i],
        astar = astar,
        timing = if (k > 1) rep(timing, k - 1) else timing,
        sfu = sfu, sfupar = 0,
        sfl = sfl, sflpar = 0,
        lambdaC = lambdaC, hr = hr, hr0 = 1,
        eta = eta, gamma = gamma, R = R, S = NULL,
        T = T_total, minfup = minfup, ratio = 1
      )

      tgS <- gsBoundSummary(x, ratio = 1, digits = 4, ddigits = 2,
                            tdigits = 1, timename = "Month")

      N_total  <- as.integer(strsplit(tgS[2, 1], ":")[[1]][2])
      Ne_IA    <- as.integer(strsplit(tgS[3, 1], ":")[[1]][2])
      Ne_FA    <- as.integer(strsplit(tgS[8, 1], ":")[[1]][2])
      fp_IA_FA <- as.numeric(tgS[c(2, 7), 3])
      cpwr     <- as.numeric(tgS[c(5, 10), 3])
      cv       <- as.numeric(tgS[c(3, 8), 3])
      calpha   <- 2 * fp_IA_FA

      lr_pos   <- cpwr / calpha
      utility  <- (1 - cv) * lr_pos

      results[[i]] <- list(
        power     = round(pwr_seq[i] * 100, 1),
        N         = N_total,
        events_IA = Ne_IA,
        events_FA = Ne_FA,
        cv_IA     = round(cv[1], 4),
        cv_FA     = round(cv[2], 4),
        utility_IA = round(utility[1], 4),
        utility_FA = round(utility[2], 4)
      )
    }, error = function(e) {
      results[[i]] <<- NULL
    })
  }

  results <- Filter(Negate(is.null), results)

  # Find optimal points
  u_IA <- sapply(results, `[[`, "utility_IA")
  u_FA <- sapply(results, `[[`, "utility_FA")
  opt_IA <- which.max(u_IA)
  opt_FA <- which.max(u_FA)

  list(
    results      = results,
    optimal_IA   = results[[opt_IA]],
    optimal_FA   = results[[opt_FA]]
  )
}

`%||%` <- function(a, b) if (!is.null(a)) a else b
