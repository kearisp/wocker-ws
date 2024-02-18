ARG PHP_VERSION

FROM php:${PHP_VERSION}-apache

ARG UID=1000
ARG USER=www-data

RUN usermod -u 1000 www-data && \
#    useradd -G root,www-data -u $UID -d /home/$USER $USER && \
    mkdir -p /home/$USER && \
    touch /home/$USER/.bashrc && \
    chown -R $USER:$USER /home/$USER

# WS Tools
ADD ./bin/compare-version /usr/local/bin/compare-version
RUN chmod +x /usr/local/bin/compare-version

RUN apt-get update --fix-missing -y
#RUN apt-get upgrade
RUN apt-get install -y curl git

#RUN apt-get install -y \
#      build-essential \
#      libssl-dev \
#      zlib1g-dev

# Mysqli
ARG MYSQLI_ENABLE=false
RUN if [ "$MYSQLI_ENABLE" = "true" ]; then \
        echo "Install mysqli" && \
        docker-php-ext-install -j "$(nproc)" mysqli && \
        docker-php-ext-enable mysqli; \
    fi

# pdo
ARG PDO_MYSQL_ENABLE=false
RUN if [ "$PDO_MYSQL_ENABLE" = "true" ]; then \
        docker-php-ext-install pdo pdo_mysql &&  \
        docker-php-ext-enable pdo_mysql; \
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
        apt-get install -y \
            libzip-dev \
            zip && \
        docker-php-ext-configure zip && \
        docker-php-ext-install -j "$(nproc)" zip; \
    fi

#RUN compare-version $PHP_VERSION "7.3" && \
#    docker-php-ext-configure zip || \
#    docker-php-ext-configure zip --with-libzip

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

# NodeJS
#USER $USER
ARG NODE_VERSION=''
ENV NVM_DIR=/root/.nvm

RUN if [ "$NODE_VERSION" != "" ] && [ "$NODE_VERSION" != "none" ]; then \
        mkdir -p $NVM_DIR; \
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash; \
        . "$NVM_DIR/nvm.sh" && \
            nvm install $NODE_VERSION && \
            nvm alias default $NODE_VERSION && \
            nvm use default; \
        echo "[ -n \"\$(command -v npm)\" ] && . <(npm completion)" >> /.bashrc; \
    fi

#USER root

RUN a2enmod rewrite
RUN a2enmod headers

ADD ./etc/apache2/sites-available/000-default.conf /etc/apache2/sites-available/000-default.conf
ADD ./etc/apache2/apache2.conf /etc/apache2/apache2.conf
COPY ./etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-available/

#RUN touch /usr/local/etc/php/conf.d/mail.ini && \
#    echo "SMTP = maildev.workspace" >> /usr/local/etc/php/conf.d/mail.ini && \
#    echo "smtp_port = 25" >> /usr/local/etc/php/conf.d/mail.ini

#RUN touch /usr/local/etc/php/conf.d/uploads.ini && \
#    echo "upload_max_filesize = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini && \
#    echo "post_max_size = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini

#RUN touch /usr/local/etc/php/conf.d/memory.ini && \
#    echo "memory_limit = 256M;" >> /usr/local/etc/php/conf.d/memory.ini

RUN touch /usr/local/bin/docker-entrypoint && \
    echo "#!/bin/bash" >> /usr/local/bin/docker-entrypoint && \
    echo "source /root/.bashrc" >> /usr/local/bin/docker-entrypoint && \
    echo "exec docker-php-entrypoint \"\$@\"" >> /usr/local/bin/docker-entrypoint && \
    chmod 775 /usr/local/bin/docker-entrypoint && \
    chmod +x /usr/local/bin/docker-entrypoint

ENV APACHE_DOCUMENT_ROOT /var/www
WORKDIR $APACHE_DOCUMENT_ROOT

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["docker-entrypoint"]
CMD ["apache2-foreground"]
