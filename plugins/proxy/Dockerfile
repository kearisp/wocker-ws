FROM nginxproxy/nginx-proxy:latest

ENV SSH_PASSWORD=''

COPY ./bin/wocker-create-ca /usr/local/bin/wocker-create-ca
COPY ./bin/wocker-create-cert /usr/local/bin/wocker-create-cert
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains
COPY ./bin/wocker-sshd /usr/local/bin/wocker-sshd
COPY ./Procfile /app/Procfile
COPY ./stream.tmpl /app/stream.tmpl
COPY ./docker-gen.conf /app/docker-gen.conf

RUN chmod +x /usr/local/bin/wocker-create-ca && \
    chmod +x /usr/local/bin/wocker-create-cert && \
    chmod +x /usr/local/bin/wocker-create-domains && \
    chmod +x /usr/local/bin/wocker-sshd

EXPOSE 22
