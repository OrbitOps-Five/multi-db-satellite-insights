FROM continuumio/miniconda3

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    default-jre-headless \
    dnsutils && \
    rm -rf /var/lib/apt/lists/*

RUN conda config --add channels conda-forge && \
    conda install --yes orekit && \
    conda clean --all --yes

WORKDIR /app

COPY orekit-data /app/orekit-data

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5003
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5003", "--reload"]