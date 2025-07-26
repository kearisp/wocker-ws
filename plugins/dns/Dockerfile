FROM docker.io/nginxproxy/docker-gen:0.15.0 AS docker-gen

FROM docker.io/nginxproxy/forego:0.18.3 AS forego

FROM alpine:edge

RUN set -eu && \
    apk --no-cache add \
    tini \
    bash \
    dnsmasq-dnssec && \
    mkdir -p /etc/default/ && \
    echo -e "ENABLED=1\nIGNORE_RESOLVCONF=yes" > /etc/default/dnsmasq && \
#    rm -f /etc/dnsmasq.conf && \
    rm -rf /tmp/* /var/cache/apk/*

#COPY ./dnsmasq.conf.tmpl /app/dnsmasq.conf.tmpl
#COPY ./Procfile /app/Procfile

#RUN wget https://github.com/jwilder/docker-gen/releases/download/0.3.3/docker-gen-linux-amd64-0.3.3.tar.gz && \
#    tar xvzf docker-gen-linux-amd64-0.3.3.tar.gz && \
#    rm docker-gen-linux-amd64-0.3.3.tar.gz && \
#    mv docker-gen /usr/local/bin/

# Install Forego + docker-gen
COPY --from=forego /usr/local/bin/forego /usr/local/bin/forego
COPY --from=docker-gen /usr/local/bin/docker-gen /usr/local/bin/docker-gen

COPY app /app/
RUN chmod 755 /app/dnsmasq.sh

WORKDIR /app/

#ENTRYPOINT ["/sbin/tini", "--", "honcho", "-f", "/app/Procfile", "start"]
CMD ["forego", "start", "-r"]
