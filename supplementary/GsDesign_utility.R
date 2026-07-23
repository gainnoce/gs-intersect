########################################################################################
#
# who: Fabio Rigat
#
# what: characterisation of utility functions for Simon-2 stage and GS survival design optimisation
#
# when: V1.0, February 13th 2026
#
# what for: AZ collaboration with Prof. Christina Yap
#
########################################################################################

rm(list = ls())
library(gsDesign)

########### GS design with survival endpoint ##################################################################
k=2
test.type <- 4              # See gsDesign() help for description of boundary types
timing <- c(0.7)            # Timing (information fraction) at interim analyses
gamma <- c(2.5, 5, 7.5, 10) # Enrollment rate (normally will be inflated to achieve power)
R <- c(2, 2, 2, 12)         # Relative enrollment rates by time period
# Interval durations for piecewise hazard rate approximation
# (length one less than lambdaC). NULL if length of lambdaC is 1.
S <- NULL
minfup <- 24                # Minimum follow-up time after enrollment complete
T <- sum(R)+minfup          # Calendar time of final analysis
ratio <- 1                  # Relative enrollment (experimental/placebo)
eta <- 0.05                 # Dropout rate (exponential rate)
astar <- 0       # If test.type = 5 or 6, this sets maximum spending for futility
			# under the null hypothesis. Otherwise, this is ignored.

sfu <- sfLDOF  # Efficacy bound spending function
sfl <- sfLDOF  # Lower bound spending function, if used (test.type > 2)
sfupar <- c(0) # Upper bound spending function parameters, if any
sflpar <- c(0) # Lower bound spending function parameters, if any

median_soc_ph3 = 12
lambda_soc_ph3 = 1/median_soc_ph3
HR_ph3 = 0.7

fp_ph3 = eta
pwr_ph3s = c(seq(0.1,0.95,0.05),0.99)
lpwr = length(pwr_ph3s)
U1s = matrix(NA,lpwr,2)
Ns = rep(NA,lpwr)         # total N
Ne_IA = rep(NA,lpwr)      # required IA maturity (n.events)
Ne_FA = rep(NA,lpwr)      # required FA maturity (n.events)
cv_IA = rep(NA,lpwr)
cv_FA = rep(NA,lpwr)
for(i in 1:lpwr){
	x <- gsSurv(k = k, test.type = test.type, alpha = fp_ph3/2,   # 1-sided Type I error Ph3 study 
  	beta = 1 - pwr_ph3s[i], 						   # Type 2 error (1 - targeted cumulative power) Ph3 study
  	astar = astar,timing = timing,sfu = sfu,sfupar = sfupar,sfl = sfl,sflpar = sflpar,
  	lambdaC = lambda_soc_ph3,hr = HR_ph3, hr0 = 1,eta = eta,gamma = gamma,R = R,S = S,T = T, minfup = minfup,ratio = ratio)

	tgS = gsBoundSummary(x, ratio = 1, digits = 4, ddigits = 2, tdigits = 1, timename = 'Month')

	N_ph3_total = as.integer(strsplit(tgS[2,1],":")[[1]][2])
	Nev_ph3_IA_FA = c(as.integer(strsplit(tgS[3,1],":")[[1]][2]),
                 as.integer(strsplit(tgS[8,1],":")[[1]][2]))
	mat_ph3_IA_FA = round(Nev_ph3_IA_FA/N_ph3_total,2)
	fp_IA_FA_ph3 =  tgS[c(2,7),3]   #x$falseposnb
	cpwr_IA_FA_ph3 = tgS[c(5,10),3]
	cv_IA_FA_ph3 = tgS[c(3,8),3]
	calpha_spent = 2*c(fp_IA_FA_ph3)

	r10p_ph3 = cpwr_IA_FA_ph3/calpha_spent
	r01m_ph3 = (1-calpha_spent)/(1-cpwr_IA_FA_ph3)

	U1s[i,] = (1-cv_IA_FA_ph3)*r10p_ph3 

      Ns[i] = round(N_ph3_total)
	Ne_IA[i] = round(Ns[i]*mat_ph3_IA_FA[1])
	Ne_FA[i] = round(Ns[i]*mat_ph3_IA_FA[2])
	cv_IA[i] = cv_IA_FA_ph3[1]
	cv_FA[i] = cv_IA_FA_ph3[2]
}

wM_IA_1 = which(U1s[,1]==max(U1s[,1]))
wM_FA_1 = which(U1s[,2]==max(U1s[,2]))


sUIA = sort(U1s[,1],index.return=T)
sUFA = sort(U1s[,2],index.return=T)


dev.new(width=12,height=6)
par(mfrow=c(1,2))
par(mar=c(5,5,6,5))
plot(Ne_IA,U1s[,1],pch=19,cex=1.3,xlab = "N. events at IA",ylab="LR(+)*(1- HR CV IA)",xaxt="n",yaxt="n")
lines(Ne_IA,U1s[,1])
mtext(paste("OBF design, alpha = ",fp_ph3 *100,"%, SOC median =",median_soc_ph3,", target HR = ",HR_ph3,sep=""),side=3,line=-2,cex=1.5,outer=TRUE)
axis(3,at=Ne_IA,label=round(cv_IA,2))
mtext("IA CV",side=3,line=2.25)
axis(1,at=Ne_IA)
axis(2,at=U1s[,1],label=round(U1s[,1],2),las=2)
axis(4,at=sUIA$x,label=sort(round(pwr_ph3s*100)),las=2)
mtext("power%",side=4,line=2.75)
abline(v=Ne_IA[wM_IA_1],col="red",lty=3)
plot(Ne_FA,U1s[,2],pch=19,cex=1.3,xlab = "N. events at FA",ylab="LR(+)*(1- HR CV FA)",xaxt="n",yaxt="n")
lines(Ne_FA,U1s[,2])
axis(3,at=Ne_FA,label=round(cv_FA,2))
mtext("FA CV",side=3,line=2.25)
axis(1,at=Ne_FA)
axis(2,at=U1s[,2],label=round(U1s[,2],2),las=2)
axis(4,at=sUFA$x,label=sort(round(pwr_ph3s*100)),las=2)
mtext("power%",side=4,line=2.75)
abline(v=Ne_FA[wM_FA_1],col="red",lty=3)
#####################################################################################################