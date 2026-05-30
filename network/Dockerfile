FROM python:3.11-slim

RUN apt-get update && apt-get install -y nginx nodejs npm curl && rm -rf /var/lib/apt/lists/*

# Copy shared utilities first (needed by ICL)
COPY ./packages/shared-py /app/shared-py
RUN pip install /app/shared-py

# Copy both services and contracts (ABIs needed by ICL at runtime)
COPY ./packages/icl /app/icl
COPY ./packages/payment /app/payment
COPY ./packages/contracts /app/contracts

# Install npm dependencies for payment scripts (Reineira SDK, ts-node)
RUN cd /app/payment && npm install

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

# Install npm dependencies for the CoFHE bridge (used by blindference-node PyPI package)
# The PyPI wheel includes the bridge script but not package.json, so we create one dynamically
RUN BLF_NODE_DIR=$(python -c "import blindference_node, os; print(os.path.dirname(blindference_node.__file__))") && \
    printf '{\n  "name": "blindference-node-cofhe-bridge",\n  "version": "0.2.0",\n  "dependencies": {\n    "@cofhe/sdk": "^0.5.0",\n    "viem": "^2.0.0"\n  }\n}\n' > "$BLF_NODE_DIR/package.json" && \
    cd "$BLF_NODE_DIR" && npm install

# Copy pre-initialized node configs and keystores (avoid GPU detection crash in init)
COPY ./nodes/one/config.json /app/nodes/one/config.json
COPY ./nodes/one/keystore.json /app/nodes/one/keystore.json
COPY ./nodes/two/config.json /app/nodes/two/config.json
COPY ./nodes/two/keystore.json /app/nodes/two/keystore.json
COPY ./nodes/three/config.json /app/nodes/three/config.json
COPY ./nodes/three/keystore.json /app/nodes/three/keystore.json

# Copy Nginx config and startup script
COPY nginx.conf /etc/nginx/nginx.conf
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 80

CMD ["/app/start.sh"]
