#!/bin/sh

set -e

UID=${UID:-1000}
GID=${GID:-1000}

groupmod -g ${GID} nginx
usermod -u ${UID} -g ${GID} nginx

exec /app/docker-entrypoint.sh "$@"
