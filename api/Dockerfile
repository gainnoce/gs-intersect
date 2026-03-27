FROM rocker/plumber:latest

# Install gsDesign from Posit Package Manager (pre-built Linux binaries — no source compilation)
RUN R -e "install.packages('gsDesign', repos='https://packagemanager.posit.co/cran/__linux__/jammy/latest', dependencies=TRUE)"

WORKDIR /app

COPY plumber.R .
COPY run.R .

EXPOSE 8000

CMD ["Rscript", "run.R"]
