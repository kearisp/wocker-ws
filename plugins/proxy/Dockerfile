FROM nginxproxy/nginx-proxy:latest

#VOLUME /etc/nginx/certs

COPY ./bin/wocker-create-ca /usr/local/bin/wocker-create-ca
COPY ./bin/wocker-create-cert /usr/local/bin/wocker-create-cert
COPY ./bin/wocker-create-domains /usr/local/bin/wocker-create-domains

RUN chmod +x /usr/local/bin/wocker-create-ca && \
    chmod +x /usr/local/bin/wocker-create-cert && \
    chmod +x /usr/local/bin/wocker-create-domains

#RUN apt update && apt install -y wget unzip

#RUN wget https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip && \
#    unzip ngrok-stable-linux-amd64.zip -d /usr/local/bin && \
#    rm ngrok-stable-linux-amd64.zip
