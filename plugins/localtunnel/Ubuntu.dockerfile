FROM ubuntu:latest

RUN apt-get update && apt-get upgrade -y && apt-get install -y curl bash

SHELL ["/bin/bash", "-c"]

ARG UID=1000
ARG USER=user

RUN useradd -m -u $UID $USER

USER $USER

RUN touch /home/$USER/.bashrc && chmod +x /home/$USER/.bashrc

ENV NODE_VERSION 16.13.0
ENV NVM_DIR /home/$USER/.nvm

RUN mkdir -p $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

RUN echo "[ -s \"$NVM_DIR/nvm.sh\" ] && \. \"$NVM_DIR/nvm.sh\"" >> ~/.bashrc
RUN echo "[ -s \"$NVM_DIR/bash_completion\" ] && \. \"$NVM_DIR/bash_completion\"" >> ~/.bashrc

ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH

RUN source $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default && \
    npm install --quiet -g localtunnel

ENTRYPOINT ["lt"]
