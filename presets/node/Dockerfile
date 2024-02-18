ARG NODE_VERSION
ARG PACKAGE_MANAGER

FROM node:${NODE_VERSION}

ARG UID=1000
ARG USER=user

ENV TZ=America/Los_Angeles
ENV APP_PORT 80
ENV PORT=$APP_PORT
ENV NPM_RUN 'npm start'
ENV PACKAGE_MANAGER "npm"

RUN ip r l

RUN apk add tcpdump iproute2 iptables

#RUN echo "1   test" >> /etc/iproute2/rt_tables
#RUN ip rule add from 10.8.0.2 table test

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone
RUN apk --update --no-cache add busybox-extras
RUN apk add --no-cache bash

VOLUME ["/usr/app"]

WORKDIR /usr/app

EXPOSE 80

USER $UID

CMD if [ "$PACKAGE_MANAGER" = "npm" ]; then \
        npm install --quiet --no-progress; \
    else \
        yarn install --silent; \
    fi && \
    ${NPM_RUN}