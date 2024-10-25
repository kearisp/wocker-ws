FROM nginxproxy/nginx-proxy:latest

COPY ./bin/wocker-create-root-cert /usr/local/bin/wocker-create-root-cert
COPY ./bin/wocker-create-cert-v2 /usr/local/bin/wocker-create-cert-v2
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains

RUN chmod +x /usr/local/bin/wocker-create-root-cert && \
    chmod +x /usr/local/bin/wocker-create-cert-v2 && \
    chmod +x /usr/local/bin/wocker-create-domains

#VOLUME /etc/nginx/certs

#RUN apt update && apt install -y wget unzip

#RUN wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip && \
#    unzip ngrok-stable-linux-amd64.zip -d /usr/local/bin && \
#    rm ngrok-stable-linux-amd64.zip
