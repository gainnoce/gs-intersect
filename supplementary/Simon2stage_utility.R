###########################################################
#
# what: runs and visualizes the design utility U(N), defined as 
# U(N) = positive likelihood ratio X minimum detectable benefit 
# for the Simon 2-stage design
#
# when: V1.0 June 2026
#
# who: fabio.rigat@astrazeneca.com
#
# license: GNU General Public License v3.0
#
##########################################################

rm(list = ls())
library(clinfun)

## Simon 2- stage #################################################
#pu:	unacceptable response rate; baseline response rate that needs to be exceeded for treatment to be deemed promising
#pa:	response rate that is desirable; should be larger than pu
#ep1:	threshold for the probability of declaring drug desirable under pu (target type 1 error rate); between 0 and 1
#ep2:	threshold for the probability of rejecting the drug under pa (target type 2 error rate); between 0 and 1
#nmax:	maximum total sample size (default 100; can be at most 1000)

pu = 0.3
pa = 0.5
ep1 = 0.05                                            # FP error
ep2 = c(0.01,0.05,seq(0.1,0.7,0.02))    # FN error
pwr = 1-ep2
nmax = 150

lep2 = length(ep2)
N_IA = rep(NA,lep2)
N_FA = rep(NA,lep2)
cv_IA = rep(NA,lep2)
cv_FA = rep(NA,lep2)
for(j in 1:lep2){
  res = ph2simon(pu, pa, ep1, ep2[j], nmax)$out 
  rr = res[res[,5]==min(res[,5]),]
  N_IA[j] = rr[2]
  N_FA[j] = rr[4] 
  cv_IA[j] = rr[1]/N_IA[j]
  cv_FA[j] = rr[3]/N_FA[j]
}

plr = pwr/ep1 # positive likelihood ratio (i.e. posterior odds of H1 over H0 u

uNA = sort(unique(N_FA))
wuNA = rep(NA,length(uNA))
for(i in 1:length(uNA)){
	wuNA[i] = which(pwr==max(pwr[N_FA==uNA[i]]))
}

N_FA = N_FA[wuNA]
pwr = pwr[wuNA]
plr = plr[wuNA]
ep2 = ep2[wuNA]
cv_FA = cv_FA[wuNA]

ss = sort(N_FA,index.return=T)
N_FA = N_FA[ss$ix]
plr = plr[ss$ix]
pwr = pwr[ss$ix]
ep2 = ep2[ss$ix]
cv_FA = cv_FA[ss$ix]
cv_FA = round(cv_FA,3)

u_FA_1 = plr*(cv_FA - pu)   # evidence precision (LR(+) i.e. posterior odds of H1 over H0 under perfect equipoise P(H1)/P(H0) = 1) 
		                # times minimal magnitude of effect associated with + outcome

wM_1 = which(u_FA_1==max(u_FA_1))
sU1 = sort(u_FA_1,index.return=T)

OCs = c(pu,pa,ep1,pwr[wM_1],N_FA[wM_1],cv_FA[wM_1] - pu)
# print(OCs) 
#example:
#.     LRV.  target.  alpha. power N_FA.  min_delta_ORR
#[1]   0.30    0.50     0.05     0.84    45.00       0.10
#[1]   0.300  0.500   0.100   0.650 17.000      0.112
#[1]   0.300  0.400   0.050   0.890 210.000    0.048
#[1]   0.300  0.400   0.100   0.790 109.000    0.049
#[1]   0.300  0.600   0.050   0.760 15.000      0.167
#[1]   0.300  0.600   0.100   0.820 14.000      0.129

ph2simon(pu, pa, ep1, 1-pwr[wM_1], nmax)

# Simon 2-stage Phase II design 
#
#Unacceptable response rate:  0.3 
#Desirable response rate:  0.5 
#Error rates: alpha =  0.05 ; beta =  0.16 
#
#        r1 n1  r  n EN(p0) PET(p0)   qLo   qHi
#Minimax  6 20 17 42  28.62  0.6080 0.236 1.000
#Optimal  6 19 18 45  27.70  0.6655 0.000 0.236

dev.new(width=7,height=5)
par(mar=c(5,5,7,5),mfrow = c(1,3))
plot(N_FA,plr,pch=19,cex=1.3,xlab = "",ylab="",xaxt="n",yaxt="n")
lines(N_FA,plr)
axis(1,at=N_FA,las=2)
axis(2,at=plr,label=round(plr,2),las=2)
axis(3,at=N_FA,label=round(cv_FA,3),las=2)
axis(4,at=plr,label=round(pwr*100),las=2)
mtext("sample size N",side=1,line=2.75)
mtext("positive likelihood ratio (PLR)",side=2,line=2.75)
mtext("power%",side=4,line=2.75)
mtext("FA ORR% CV",side=3,line=3.3)

plot(N_FA,cv_FA - pu,pch=19,cex=1.3,xlab = "",ylab="",xaxt="n",yaxt="n")
lines(N_FA,cv_FA - pu)
axis(1,at=N_FA,las=2)
axis(2,at=cv_FA - pu,label=round(cv_FA - pu,2),las=2)
axis(3,at=N_FA,label=round(cv_FA,3),las=2)
axis(4,at=cv_FA - pu,label=round(pwr*100),las=2)
mtext("minimum detectable benefit (MB)",side=2,line=2.75)
mtext("sample size N",side=1,line=2.75)
mtext("FA ORR% CV",side=3,line=3.3)
mtext("power%",side=4,line=2.75)

plot(N_FA,u_FA_1,pch=19,cex=1.3,xlab = "",ylab="",xaxt="n",yaxt="n")
lines(N_FA,u_FA_1)
mtext(paste("Simon 2-stage, alpha = ",ep1*100,"%, lower reference ORR% = ",pu*100,"%, target ORR% = ",pa*100,"%",sep=""),side=3,line=-2,cex=1.5,outer=TRUE)
axis(3,at=N_FA,label=round(cv_FA,3),las=2)
mtext("FA ORR% CV",side=3,line=3.3)
axis(1,at=N_FA,las=2)
axis(2,at=u_FA_1,label=round(u_FA_1,2),las=2)
axis(4,at=u_FA_1,label=round(pwr*100),las=2)
mtext("design utility (PLR*MB)",side=2,line=2.75)
mtext("sample size N",side=1,line=2.75)
mtext("power%",side=4,line=2.75)
abline(v=N_FA[wM_1],col="red",lty=3)


 
