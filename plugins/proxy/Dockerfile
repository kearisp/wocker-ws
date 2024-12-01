FROM nginxproxy/nginx-proxy:1.6.4-alpine

ARG SSH_PASSWORD=''

COPY ./bin/wocker-create-ca /usr/local/bin/wocker-create-ca
COPY ./bin/wocker-create-cert /usr/local/bin/wocker-create-cert
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains
COPY ./Procfile /app/Procfile
COPY ./stream.tmpl /app/stream.tmpl
COPY ./docker-gen.conf /app/docker-gen.conf

RUN chmod +x /usr/local/bin/wocker-create-ca && \
    chmod +x /usr/local/bin/wocker-create-cert && \
    chmod +x /usr/local/bin/wocker-create-domains

RUN if [ -n "$SSH_PASSWORD" ]; then \
        apk update && apk add --no-cache openssh; \
        mkdir -p /var/run/sshd; \
        echo "root:$SSH_PASSWORD" | chpasswd; \
        sed -i 's/AllowTcpForwarding no/AllowTcpForwarding yes/' /etc/ssh/sshd_config; \
        sed -i 's/GatewayPorts no/GatewayPorts yes/' /etc/ssh/sshd_config; \
        sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config; \
        sed -i 's/#UsePAM yes/UsePAM no/' /etc/ssh/sshd_config; \
        ssh-keygen -A; \
        echo "sshd: /usr/sbin/sshd -D" >> /app/Procfile; \
    fi

EXPOSE 22
