FROM nginxproxy/nginx-proxy:latest

COPY ./bin/wocker-create-ca /usr/local/bin/wocker-create-ca
COPY ./bin/wocker-create-cert /usr/local/bin/wocker-create-cert
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains

RUN chmod +x /usr/local/bin/wocker-create-ca && \
    chmod +x /usr/local/bin/wocker-create-cert && \
    chmod +x /usr/local/bin/wocker-create-domains
