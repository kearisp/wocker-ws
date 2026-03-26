FROM nginxproxy/nginx-proxy:1.10.1-alpine

ENV UID=1000 \
    GID=1000

COPY ./wocker-entrypoint.sh /app/wocker-entrypoint.sh
COPY ./bin/wocker-create-ca /usr/local/bin/wocker-create-ca
COPY ./bin/wocker-create-cert /usr/local/bin/wocker-create-cert
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains

RUN chmod +x /app/wocker-entrypoint.sh && \
    chown root:root /app/wocker-entrypoint.sh && \
    chmod +x /usr/local/bin/wocker-create-ca && \
    chmod +x /usr/local/bin/wocker-create-cert && \
    chmod +x /usr/local/bin/wocker-create-domains && \
    apk add --no-cache apache2-utils shadow

ARG SSH_PASSWORD=''

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

ENTRYPOINT ["/app/wocker-entrypoint.sh"]
CMD ["forego", "start", "-r"]
