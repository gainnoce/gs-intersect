###########################################################
#
# what: runs and visualizes the design utility U(N), defined as 
# U(N) = positive likelihood ratio X minimum detectable benefit 
# for the randomised design testing for difference between proportions
# using both the standard Gaussian approximation and Bayesian inference
#
# when: V1.0 June 2026
#
# who: Fabio Rigat
#
# license: GNU General Public License v3.0
#
##########################################################

rm(list = ls())

## prop test, with normal approx of dist. of diff btw %s ##########################
alpha = 0.05
pu = 0.3
pa = 0.5
delta = pa-pu
beta = seq(0.01,0.45,0.05) #c(0.01,seq(0.05,0.5,0.05))
pwr = 1-beta
lrp = pwr/alpha

# Decision rule: study is positive if P(delta_ORR > d0) > p
# d0 is null hypothesis, typically, but can explore d0>0 options 
# p is high...e.g. 90%, 95%, 99%...
d0 = 0
p = 1-alpha/2

nsim1 = 50000   # high = precise Blrp
nsim2 = 50000 # high = precise Bcv

# Beta prior hyperparameters, common to both arms
a = 1
b = 1

# for Bayesian version, choose eithe of these 2 computational options
BMC = 1 # if = 1, do Bayesian version exact MC simulations
BnMC = 0 # if = 1, do Bayesian version with fewer exact MC simulations
if(BnMC==1){
	#install.packages(devtools)
	#library(devtools)
	#install_github("https://github.com/Genentech/phase1b/",force=T)
	library(phase1b) #https://github.com/Genentech/phase1b/
}

ns = rep(NA,length(pwr))
Ncv = rep(NA,length(pwr)) 
sds = rep(NA,length(pwr))

if(BMC==1 | BnMC ==1){
  pos = rep(NA,length(pwr))
  pos0 = rep(NA,length(pwr))
  Bcv = rep(NA,length(pwr))  # min_diff_success
 } 

st = Sys.time()
for(i in 1:length(pwr)){
	
	# frequentist version, using normal approximation to difference of proportions
	ns[i] = ceiling(power.prop.test(n = NULL, p1 = pu, p2 = pa, sig.level = alpha,power = pwr[i],alternative = "two.sided")$n)
    sds[i] = sqrt(pu*(1-pu)/ns[i] + pa*(1-pa)/ns[i])
	Ncv[i] = qnorm(p=1-alpha/2)*sds[i]
	
	# Bayesian version #################################################################################
    # use same sample sizes as in frequentist version (so frequentist power and fp controlled, for comparison)
    
 if(BMC==1 | BnMC ==1){ 
 	  
	nOR_contr <- rbinom(nsim1,ns[i],pu)	
	nOR_inv <- rbinom(nsim1,ns[i],pa)
	nOR_inv0 <- rbinom(nsim1,ns[i],pu)
	obs_diff <- (nOR_inv  - nOR_contr) / ns[i] 
	#obs_diff0 <- (nOR_inv0  - nOR_contr) / ns[i]
	
    # this portion is based on code by Kristine Broglio ##################

	##update parameters for the beta 
	post_cntrl <- cbind(a+nOR_contr, b+ns[i]-nOR_contr)
	post_inv <- cbind(a+nOR_inv,b+ns[i]-nOR_inv)
	post_inv0 <- cbind( a+nOR_inv0, b+ns[i]-nOR_inv0)
	
	if(BMC==1){ #nested exact Monte Carlo integration
	  pr_sup_fp <- sapply(1:nrow(post_cntrl), function(z) {
	  pORR_inv <-  rbeta(nsim2, post_inv[z, 1], post_inv[z, 2])
	  pORR_contr <-  rbeta(nsim2, post_cntrl[z, 1], post_cntrl[z, 2])
	  pORR_inv0 <-  rbeta(nsim2, post_inv0[z, 1], post_inv0[z, 2])
	  delta <- pORR_inv - pORR_contr
	  delta0 <- pORR_inv0 - pORR_contr
     return(c(mean(delta > d0),mean(delta0 > d0))) #true and false prob of superiority 
     })
   } 
   if(BnMC==1){ #nested analytical integration
   	# see https://stackoverflow.com/questions/78150369/distribution-of-the-difference-of-two-beta-random-variables-issue-implementing 
   	pr_sup_fp <- sapply(1:nrow(post_cntrl), function(z) {
   		r1 = 1-pbetadiff(d0,parX=c(post_cntrl[z,1],post_cntrl[z,2]),parY =c(post_inv[z,1],post_inv[z,2]))
   		r2 = 1-pbetadiff(d0,parX=c(post_cntrl[z,1],post_cntrl[z,2]),parY =c(post_inv0[z,1],post_inv0[z,2]))
   		return(cbind(r1,r2))}) 	
   }
   	Bcv[i] <- round(min(obs_diff[pr_sup_fp[1,] > p]) ,2) 
	pos[i] <- round(mean(pr_sup_fp[1,] > p),2)    #is the probability of superiority at threshold "p" 
   pos0[i] <- round(mean(pr_sup_fp[2,] > p) + mean(pr_sup_fp[2,] < 1-p),2)
  }
  
	print(i)
	et = Sys.time()
	print(et-st)
	st = Sys.time()
	flush.console()
}

U1 = lrp*round(Ncv,2) # the difference btw proportions is the net benefit itself
sU1 = sort(U1,index.return=T)

OCs = c(ns[U1==max(U1)],pwr[U1==max(U1)],Ncv[U1==max(U1)])

# print(OCs)
# example
#[1] 91.0000000  0.7900000  0.1393498 ###

if(BMC==1 | BnMC==1){
Blrp = round(pos,2)/round(pos0,2)
U1b = Blrp*round(Bcv,2) # the difference btw proportions is the net benefit itself
sU1b = sort(U1b,index.return=T)

BOCs = c(ns[U1b==max(U1b)],pwr[U1b==max(U1b)],Ncv[U1b==max(U1b)],pos[U1b==max(U1b)],pos0[U1b==max(U1b)],Bcv[U1b==max(U1b)])

# print(BOCs)
# example:
#[1] 81.0000000  0.7400000  0.1477014  0.7270000  0.0380000  0.1481481
}

dev.new()
par(mar=c(5,5,6,3),mfrow=c(1,3))
plot(ns,lrp,xlab="",ylab = "",main = "",pch=19,cex=1.5,xlim = range(ns),yaxt="n",xaxt="n")
lines(ns,lrp)
if(BMC==1 | BnMC==1){
	lines(ns,Blrp,col="red")
 points(ns,Blrp,col="red",pch=19)
 }
mtext("power%",side=4,line=2.5,cex=0.9)
mtext("sample size N",side=1,line=2.75)
mtext("positive likelihood ratio (PLR)",side=2,line=2.75,cex=1)
axis(4,at=lrp,label=round(pwr*100),las=2)
axis(2,at=lrp,las=2)
axis(1,at=seq(0,300,20),las=2)
if(BMC==1 | BnMC==1) legend(box.lty=0,"bottomright",pch=19,col=c("black","red"),legend=c("Normal approximation","Bayes (uniform prior)"),cex=1.5)
plot(ns,Ncv,xlab="",ylab = "",main = "",pch=19,cex=1.5,xlim = range(ns),ylim=range(Ncv),yaxt="n",xaxt="n")
mtext("sample size N",side=1,line=2.75)
lines(ns,Ncv)
if(BMC==1 | BnMC==1){
	lines(ns,Bcv,col="red")
  points(ns,Bcv,col="red",pch=19)
}
axis(2,at=seq(0,5,0.01),las=2)
axis(1,at=seq(0,300,20),las=2)
mtext("minimum detectable benefit (MB)",side=2,line=2.75,cex=1)
if(BMC==1 | BnMC==1) legend(box.lty=0,"topright",pch=19,col=c("black","red"),legend=c("Normal approximation","Bayes (uniform prior)"),cex=1.5)
plot(ns,U1,pch=19,cex=1.5,xlab="",ylab="",main = "",xlim = range(ns),ylim=range(U1),yaxt="n",xaxt="n")
mtext("sample size N",side=1,line=2.75)
lines(ns,U1)
if(BMC==1 | BnMC==1){ 
	lines(ns,U1b,col="red")
  points(ns,U1b,col="red",pch=19)
}
axis(2,at=seq(0,5,0.05),las=2)
mtext(paste("Difference between proportions, ORR SOC = ",pu,", ORR INV = ",pa,", alpha = ",100*alpha,"%",sep=""),side=3,line=-3,cex=1.5,outer=TRUE)
abline(v = ns[U1==max(U1)],col="black",lty=3)
axis(1,at=seq(0,300,20),las=2)
mtext("design utility (PLR*MB)",side=2,line=2.75,cex=1)
if(BMC==1 | BnMC==1) legend(box.lty=0,"topright",pch=19,col=c("black","red"),legend=c("Normal approximation","Bayes (uniform prior)"),cex=1.5)

dev.new()
plot(ns,pos,ylim=c(0,1),pch=19,cex=1.5,xlab="sample size N",ylab = "power (%)",
yaxt="n",xaxt="n",main = "Difference between proportions - Gaussian approximtion and Bayesian OCs 
(ORR SOC = 30%, ORR INV = 50%, alpha = 5%)")
abline(h = seq(0,1,0.05),lty=3,col="grey")
points(ns,pos0,pch=19,col="blue")
points(ns,pwr,pch=19,col="red")
legend(box.lty=0,"topleft",pch=19,col=c("black","red","blue"),legend=c("Gaussian approximation power","Bayes power","Bayes FP%"),cex=1.25)
axis(2,at=seq(0,1,0.05),label=100*seq(0,1,0.05),las=2)
axis(1,at=ns)
