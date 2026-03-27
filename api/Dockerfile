FROM rocker/plumber:latest

# Install gsDesign (plumber + jsonlite already included in base image)
RUN R -e "install.packages('gsDesign', repos='https://cloud.r-project.org', dependencies=TRUE)"

WORKDIR /app

COPY plumber.R .
COPY run.R .

EXPOSE 8000

CMD ["Rscript", "run.R"]
