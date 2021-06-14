library(readr) 
  
args <- commandArgs()
con = file("/var/tmp/readings.log", "r")
vec=c()
while ( TRUE ) {
    line = readLines(con, n = 1)
    if ( length(line) == 0 ) {
        break
    }
    vec=c(vec, as.double(line))
}

close(con)
as.list(summary(vec))
as.list(quantile(vec, na.rm = T, probs = c(0, .1, .2, .3, .4, .5, .6, .7, .8, .9, 1)))

png(file = args[6])
plot(vec, type="p", col=args[7], pch=20, cex=.75, main=args[8], xlab="Requests", ylab="Time taken(MS)")
dev.off()