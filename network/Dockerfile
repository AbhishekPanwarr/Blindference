FROM python:3.11-slim

RUN apt-get update && apt-get install -y nginx && rm -rf /var/lib/apt/lists/*

COPY ./network/packages/icl /app/icl
COPY ./network/packages/payment /app/payment

RUN pip install -r /app/icl/requirements.txt -r /app/payment/requirements.txt

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["/bin/bash", "-c", "uvicorn icl.main:app --host 127.0.0.1 --port 8000 --app-dir /app/icl & uvicorn payment.main:app --host 127.0.0.1 --port 8001 --app-dir /app/payment & nginx -g 'daemon off;'"]
