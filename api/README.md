# GS-Intersect R API

R Plumber API powering the GS-Intersect platform.

## Local development

```r
install.packages(c("plumber", "gsDesign", "jsonlite"))
Rscript run.R
```

API runs on http://localhost:8000

## Deployment

Deploy to Render as a web service. Set start command to:
```
Rscript run.R
```
