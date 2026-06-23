###########################################################
#
# what: runs and visualizes the design utility U(N), defined as 
# U(N) = positive likelihood ratio X minimum detectable benefit 
# for the paired Z and T test designs
#
# when: V1.0 June 2026
#
# who: fabio.rigat@astrazeneca.com
#
# license: GNU General Public License v3.0
#
##########################################################

rm(list = ls())

mu_HC = 6
mu_TRT = 4

# effect size (not standardised)
delta = abs(mu_TRT - mu_HC)  #H0 : delta = 0 versus H1 : delta \neq 0
s = 3 #delta*2         # assumed SD of observations
est_s = s                 # estimated SD for the T test (can be different from the true s)
Sdelta = delta/s

alpha = 0.05
pwr = c(seq(.6,.9,.05),0.95,0.99)
beta = 1-pwr
lrp = pwr/alpha

# Z test ####################################################
# 2 sample paired Z test with same n in each group; this is size of each group
q1 = qnorm(p=1-alpha/2) 
q2 = qnorm(p=pwr) 
ns = round((((q1+q2)/Sdelta)^2))
Ncv = (s/sqrt(ns))*q1                                    # CV using N distribution, i.e. s known
######################################################

# T test (plug in true sd as estimated sd) #####################################################
nst = rep(NA,length(pwr)) 
for(i in 1:length(pwr)) nst[i]=ceiling(power.t.test(n=NULL, delta = delta, sd = est_s, sig.level = alpha,power = pwr[i],type = "paired",alternative = "two.sided")$n) #two.sample
Tcv = (sest/sqrt(nst))*qt(p=1-alpha/2, df=2*(nst-1)) # CV using t distribution, i.e. s unknown
######################################################

U1 = lrp*Ncv # the net trt effect for diff in means is the difference itself
sU1 = sort(U1,index.return=T)

U1t = lrp*Tcv # the net trt effect for diff in means is the difference itself
sU1t = sort(U1t,index.return=T)

nstar = ns[U1==max(U1)]
ntstar = nst[U1t==max(U1t)]

OCs = rbind(c(nstar,ntstar),
c(pwr[U1==max(U1)],pwr[U1t==max(U1t)]))

 #print(OCs)
# example
#[1,] 18.0 20.0
#[2,]  0.8  0.8

dev.new()
par(mar=c(5,5,6,3),mfrow=c(1,3))
plot(ns,lrp,xlab="",ylab = "",main = "",pch=19,xlim = range(c(ns,nst)),yaxt="n",xaxt="n")
lines(ns,lrp)
lines(nst,lrp,col="blue")
points(nst,lrp,col="blue",pch=19)
mtext("power%",side=4,line=2.5,cex=0.8)
mtext("sample size N",side=1,line=2.5)
mtext("positive likelihood ratio (PLR)",side=2,line=2.75,cex=1)
axis(4,at=lrp,label=round(pwr*100),las=2)
axis(2,at=lrp,las=2)
axis(1,at=seq(0,200,5),las=2)
legend(box.lty=0,"topleft",pch=19,col=c("black","blue"),legend = c("Z test","T test"))
plot(ns,Ncv,xlab="",ylab = "",main = "",pch=19,xlim = range(c(ns,nst)),ylim=range(c(Ncv,Tcv)),yaxt="n",xaxt="n")
mtext("sample size N",side=1,line=2.5)
lines(ns,Ncv)
lines(nst,Tcv,col="blue")
points(nst,Tcv,pch=19,col="blue")
axis(2,at=seq(0,10,0.25),las=2)
legend(box.lty=0,"topright",pch=19,col=c("black","blue"),legend = c("Z test","T test"))
axis(1,at=seq(0,200,5),las=2)
mtext("minimum detectable benefit (MB)",side=2,line=2.75,cex=1)
plot(ns,U1,pch=19,xlab="",ylab="",main = "",xlim = range(c(ns,nst)),ylim=range(c(U1,U1t)),yaxt="n",xaxt="n")
mtext("sample size N",side=1,line=2.5)
lines(ns,U1)
lines(nst,U1t,col="blue")
points(nst,U1t,pch=19,col="blue")
axis(2,at=seq(0,50),las=2)
mtext(paste("Continuous endpoint, delta=",delta,", SD =",s,", alpha = ",100*alpha,"%",sep=""),side=3,line=-3,cex=1.5,outer=TRUE)
abline(v = ns[U1==max(U1)],col="black",lty=3)
abline(v = nst[U1t==max(U1t)],col="blue",lty=3)
legend(box.lty=0,"topright",pch=19,col=c("black","blue"),legend = c("Z test","T test"))
axis(1,at=seq(0,200,5),las=2)
mtext("design utility (PLR*MB)",side=2,line=2.75,cex=1)
######################################################


