ARG PHP_VERSION

FROM php:${PHP_VERSION}-apache

# WS Tools
ADD ./bin/compare-version /usr/local/bin/compare-version
RUN chmod +x /usr/local/bin/compare-version

RUN apt-get update --fix-missing -y
#RUN apt-get upgrade
RUN apt-get install -y curl

#RUN apt-get install -y \
#      build-essential \
#      libssl-dev \
#      zlib1g-dev

# Git
#RUN apt-get install -y git

# Mysqli
ARG MYSQLI_ENABLE=true
RUN if [ "$MYSQLI_ENABLE" = "true" ]; then \
        docker-php-ext-install -j "$(nproc)" mysqli && \
        docker-php-ext-enable mysqli; \
    fi

# pdo
ARG PDO_MYSQL_ENABLE=true
RUN if [ "$PDO_ENABLE" = "true" ]; then \
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

#RUN compare-version $PHP_VERSION "7.3" && \
#        docker-php-ext-configure gd --with-freetype-dir=/usr/include/ --with-jpeg-dir=/usr/include || \
#        docker-php-ext-configure gd --with-freetype --with-jpeg

#RUN docker-php-ext-configure gd --with-freetype-dir=/usr/include/ --with-jpeg-dir=/usr/include/
#RUN docker-php-ext-configure gd --with-freetype=/usr/include/ --with-jpeg=/usr/include/
#RUN docker-php-ext-install gd

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
RUN if [ "$COMPOSER_ENABLE" = "true" ]; then \
        curl -sL https://getcomposer.org/installer | php && \
        mv composer.phar /usr/local/bin/composer && \
        chmod +x /usr/local/bin/composer; \
    fi

RUN a2enmod rewrite
RUN a2enmod headers

ADD ./.docker/apache2/sites-available/000-default.conf.conf /etc/apache2/sites-available/000-default.conf
ADD ./.docker/apache2/apache2.conf /etc/apache2/apache2.conf
COPY ./.docker/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-available/

#RUN touch /usr/local/etc/php/conf.d/mail.ini && \
#    echo "SMTP = maildev.workspace" >> /usr/local/etc/php/conf.d/mail.ini && \
#    echo "smtp_port = 25" >> /usr/local/etc/php/conf.d/mail.ini

#RUN touch /usr/local/etc/php/conf.d/uploads.ini && \
#    echo "upload_max_filesize = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini && \
#    echo "post_max_size = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini

#RUN touch /usr/local/etc/php/conf.d/memory.ini && \
#    echo "memory_limit = 256M;" >> /usr/local/etc/php/conf.d/memory.ini

EXPOSE 80
EXPOSE 443

ENV APACHE_DOCUMENT_ROOT /var/www/html
WORKDIR $APACHE_DOCUMENT_ROOT

ARG UID=1000
ARG USER=user

RUN useradd -G www-data,root -u $UID -d /home/$USER $USER
RUN mkdir -p /home/$USER/.composer && \
    chown -R $USER:$USER /home/$USER

USER $USER
