FROM alpine:latest

RUN apk update && apk upgrade && apk add --no-cache curl bash nodejs npm

RUN npm install --quiet -g localtunnel

SHELL ["/bin/bash", "-c"]

ARG UID=1000
ARG USER=user

RUN adduser -D -u $UID $USER

USER $USER

RUN touch /home/$USER/.bashrc && chmod +x /home/$USER/.bashrc

#ENV NODE_VERSION 16.13.0
#ENV NVM_DIR /home/$USER/.nvm

#RUN mkdir -p $NVM_DIR && \
#    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

#RUN echo "[ -s \"$NVM_DIR/nvm.sh\" ] && \. \"$NVM_DIR/nvm.sh\"" >> ~/.bashrc
#RUN echo "[ -s \"$NVM_DIR/bash_completion\" ] && \. \"$NVM_DIR/bash_completion\"" >> ~/.bashrc

#ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin
#ENV PATH $NODE_PATH:$PATH

#RUN source /home/$USER/.bashrc && \
#RUN source $NVM_DIR/nvm.sh && \
#    nvm install $NODE_VERSION && \
#    nvm alias default $NODE_VERSION && \
#    nvm use default #&& \
    #npm install --quiet -g localtunnel

#ENTRYPOINT ["lt"]
