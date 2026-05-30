FROM python:3.11-slim

RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

# Copy shared utilities first (needed by ICL)
COPY ./packages/shared-py /app/shared-py
RUN pip install /app/shared-py

# Copy both services and contracts (ABIs needed by ICL at runtime)
COPY ./packages/icl /app/icl
COPY ./packages/payment /app/payment
COPY ./packages/contracts /app/contracts

# Reconstruct Foundry out/ directory from tracked deployment ABIs
# (out/ is gitignored; ICL expects out/ContractName.sol/ContractName.json)
RUN mkdir -p /app/contracts/out && \
    for f in /app/contracts/deployments/abis/*.json; do \
      name=$(basename "$f" .json); \
      mkdir -p "/app/contracts/out/${name}.sol"; \
      cp "$f" "/app/contracts/out/${name}.sol/${name}.json"; \
    done

# Install dependencies for both services
RUN pip install -r /app/icl/requirements.txt -r /app/payment/requirements.txt

# Copy Nginx config and startup script
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
