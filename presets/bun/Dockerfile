FROM ubuntu:latest

RUN apt-get update && \
    apt-get -y install wget curl unzip

RUN curl -fsSL https://bun.sh/install | bash

ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# TODO
