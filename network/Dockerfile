FROM python:3.11-slim

RUN apt-get update && apt-get install -y nginx nodejs npm && rm -rf /var/lib/apt/lists/*

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

# Install blindference-node from PyPI
RUN pip install blindference-node==0.3.4

# Create isolated node directories and copy .env + keystores
RUN mkdir -p /app/nodes/one /app/nodes/two /app/nodes/three

COPY ./real/one/Blindference-node/.env /app/nodes/one/.env
COPY ./real/one/Blindference-node/keystore.json /app/nodes/one/keystore.json
COPY ./real/two/Blindference-node/.env /app/nodes/two/.env
COPY ./real/two/Blindference-node/keystore.json /app/nodes/two/keystore.json
COPY ./real/three/Blindference-node/.env /app/nodes/three/.env
COPY ./real/three/Blindference-node/keystore.json /app/nodes/three/keystore.json

# Update ICL endpoint in node .env files to use internal loopback
RUN sed -i 's|http://0.0.0.0:8000|http://127.0.0.1:8000|g' /app/nodes/one/.env /app/nodes/two/.env /app/nodes/three/.env && \
    sed -i 's|http://127.0.0.1:8001|http://127.0.0.1:8001|g' /app/nodes/one/.env /app/nodes/two/.env /app/nodes/three/.env

# Copy Nginx config and startup script
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
