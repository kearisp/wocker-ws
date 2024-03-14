ARG PHP_VERSION

FROM php:${PHP_VERSION}-fpm

# WS Tools
ADD ./bin/compare-version /usr/local/bin/compare-version
RUN chmod +x /usr/local/bin/compare-version

RUN apt-get update --fix-missing -y && \
    apt-get install -y curl git nginx && \
    chown -R www-data:www-data /var/lib/nginx

# Http
ARG HTTP_ENABLE=false
RUN if [ "$HTTP_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            libpcre3-dev \
            libssl-dev \
            libcurl4-openssl-dev \
            libicu-dev \
            g++ \
            zlib1g-dev && \
        docker-php-ext-install pcntl && \
        pecl install raphf && docker-php-ext-enable raphf && \
        pecl install pecl_http && docker-php-ext-enable http; \
    fi

# Mysqli
ARG MYSQLI_ENABLE=false
RUN if [ "$MYSQLI_ENABLE" = "true" ]; then \
        docker-php-ext-install -j "$(nproc)" mysqli && \
        docker-php-ext-enable mysqli; \
    fi

# pdo
ARG PDO_MYSQL_ENABLE=false
RUN if [ "$PDO_MYSQL_ENABLE" = "true" ]; then \
        docker-php-ext-install pdo pdo_mysql &&  \
        docker-php-ext-enable pdo_mysql; \
    fi

# pgsql
ARG PGSQL_ENABLE=false
RUN if [ "$PGSQL_ENABLE" = "true" ]; then \
    apt-get install -y libpq-dev && \
    docker-php-ext-install -j "$(nproc)" pgsql pdo_pgsql && \
    docker-php-ext-enable pgsql pdo_pgsql; \
fi

#gd
ARG GD_ENABLE=false
RUN if [ "$GD_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            libfreetype6-dev \
            libjpeg62-turbo-dev \
            libpng-dev && \
        compare-version $PHP_VERSION "7.3" && \
            docker-php-ext-configure gd --with-freetype-dir=/usr/include/ --with-jpeg-dir=/usr/include || \
            docker-php-ext-configure gd --with-freetype --with-jpeg && \
        docker-php-ext-install -j$(nproc) gd && \
        docker-php-ext-install exif; \
    fi

# Zip
ARG ZIP_ENABLE=false
RUN if [ "$ZIP_ENABLE" = "true" ]; then \
        apt-get install -y libzip-dev zip unzip && \
        docker-php-ext-configure zip && \
        docker-php-ext-install -j "$(nproc)" zip; \
    fi

# memcache
ARG MEMCACHE_ENABLE=false
RUN if [ "$MEMCACHE_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            zlib1g-dev \
            libmemcached-dev && \
        pecl install memcache && docker-php-ext-enable memcache; \
    fi

# memcached
ARG MEMCACHED_ENABLE=false
RUN if [ "$MEMCACHED_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            libcurl4-openssl-dev  \
            libssl-dev \
            libmemcached-dev \
            zlib1g-dev && \
        pecl install memcached && docker-php-ext-enable memcached; \
    fi

# Intl
ARG INTL_ENABLE=false
RUN if [ "$INTL_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            libicu-dev && \
        docker-php-ext-configure intl && \
        docker-php-ext-install intl; \
    fi

# Pcntl
ARG PCNTL_ENABLE=false
RUN if [ "$PCNTL_ENABLE" = "true" ]; then \
        docker-php-ext-install pcntl && \
        docker-php-ext-enable pcntl; \
    fi

# Soap
ARG SOAP_ENABLE=false
RUN if [ "$SOAP_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y \
            libxml2-dev && \
        docker-php-ext-install soap && \
        docker-php-ext-enable soap; \
    fi

# XDebug
ARG XDEBUG_ENABLE=false
RUN if [ "$XDEBUG_ENABLE" = "true" ]; then \
        pecl install xdebug && \
        docker-php-ext-enable xdebug; \
    fi

# Gettext
ARG GETTEXT_ENABLE=false
RUN if [ "$GETTEXT_ENABLE" = "true" ]; then \
        apt-get update && apt-get install -y gettext && \
        docker-php-ext-install -j "$(nproc)" gettext && \
        docker-php-ext-enable gettext; \
    fi

# Bcmath
ARG BCMATH_ENABLE=false
RUN if [ "$BCMATH_ENABLE" = "true" ]; then \
        docker-php-ext-install -j "$(nproc)" bcmath && \
        docker-php-ext-enable bcmath; \
    fi

# Sockets
ARG SOCKETS_ENABLE=false
RUN if [ "$SOCKETS_ENABLE" = "true" ]; then \
        docker-php-ext-install sockets && \
        docker-php-ext-enable sockets; \
    fi

# Composer
ARG COMPOSER_ENABLE=false

SHELL ["/bin/bash", "-c"]
RUN if [ "$COMPOSER_ENABLE" = "true" ]; then \
        apt-get update && \
            apt-get install -y bash-completion; \
        echo "source /etc/bash_completion" >> /home/$USER/.bashrc; \
        mkdir -p /home/$USER/.composer; \
        curl -sL https://getcomposer.org/installer | php && \
        mv composer.phar /usr/local/bin/composer && \
        chmod +x /usr/local/bin/composer; \
        echo ". <(composer completion bash)" >> /home/$USER/.bashrc; \
    fi
SHELL ["/bin/sh", "-c"]

ARG WORKDIR=/var/www
ARG NGINX_DOCUMENT_ROOT=/var/www
WORKDIR $WORKDIR

ADD etc/nginx/sites-available/default.conf /tmp/default.conf.txt
RUN envsubst '\${NGINX_DOCUMENT_ROOT}' < /tmp/default.conf.txt > /etc/nginx/sites-available/default.conf

EXPOSE 80
EXPOSE 9000

#CMD ["nginx", "-g", "daemon off;"]
CMD service nginx start && php-fpm
