FROM rocker/r-ver:4.4.1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install R packages
RUN R -e "install.packages(c('plumber', 'gsDesign', 'jsonlite'), repos='https://cloud.r-project.org', dependencies=TRUE); stopifnot(requireNamespace('plumber'), requireNamespace('gsDesign'), requireNamespace('jsonlite'))"

WORKDIR /app

COPY plumber.R .
COPY run.R .

EXPOSE 8000

CMD ["Rscript", "run.R"]
