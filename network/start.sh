#!/bin/bash

# Start ICL Service
cd /app/icl
PYTHONPATH=/app/icl:/app/shared-py uvicorn main:app --host 127.0.0.1 --port 8000 --no-access-log &

# Start Payment Service
cd /app/payment
PYTHONPATH=/app/payment:/app/shared-py uvicorn main:app --host 127.0.0.1 --port 8001 --no-access-log &

# Start Nginx in foreground
nginx -g 'daemon off;'
