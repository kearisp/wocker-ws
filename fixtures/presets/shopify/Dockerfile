ARG PHP_VERSION

FROM php:${PHP_VERSION}-apache

ARG UID=1000
ARG USER=user

RUN useradd -G www-data,root -u $UID -d /home/$USER $USER && \
    mkdir -p /home/$USER && \
    touch /home/$USER/.bashrc && \
    chown -R $USER:$USER /home/$USER

# WS Tools
ADD ./bin/compare-version /usr/local/bin/compare-version
RUN chmod +x /usr/local/bin/compare-version

RUN apt-get clean
RUN apt-get update

RUN apt-get install -y --no-install-recommends \
        git \
        curl \
        autoconf \
        build-essential \
        apt-utils \
        zlib1g-dev \
        libzip-dev \
        unzip \
        zip \
        libmagick++-dev \
        libmagickwand-dev \
        libpq-dev \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libwebp-dev \
        libxpm-dev \
        libxml2-dev

RUN compare-version $PHP_VERSION "7.3" && \
    docker-php-ext-configure zip || \
    docker-php-ext-configure zip --with-libzip

RUN docker-php-ext-install -j "$(nproc)" zip
RUN docker-php-ext-install -j "$(nproc)" mysqli
RUN docker-php-ext-install pdo_mysql exif pcntl bcmath gd
RUN docker-php-ext-install soap

RUN a2enmod rewrite
RUN a2enmod headers

ADD ./etc/apache2/sites-available/000-default.conf /etc/apache2/sites-available/000-default.conf
ADD ./etc/apache2/apache2.conf /etc/apache2/apache2.conf
COPY ./etc/apache2/mods-available/mpm_prefork.conf /etc/apache2/mods-available/

RUN mkdir -p /home/$USER/.composer && \
    chown -R $USER:$USER /home/$USER

RUN touch /home/$USER/.bashrc && chmod +x /home/$USER/.bashrc
RUN touch /home/$USER/.npmrc && chmod +x /home/$USER/.npmrc

# Composer
ARG COMPOSER_ENABLE=true

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

RUN chown -R $USER:$USER /home/$USER

USER $USER

# Install NodeJS
ARG NODE_VERSION=16.13.0
ENV NVM_DIR=/home/$USER/.nvm

RUN if [ "$NODE_VERSION" != "" ]; then \
        mkdir -p $NVM_DIR; \
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash; \
        . "$NVM_DIR/nvm.sh" && \
            nvm install $NODE_VERSION && \
            nvm alias default $NODE_VERSION && \
            nvm use default; \
        echo "[ -n \"\$(command -v npm)\" ] && . <(npm completion)" >> /home/$USER/.bashrc; \
    fi

# Install ruby
USER root
RUN apt-get install -y \
      gawk \
      bison \
      libssl-dev \
      libgdbm-dev \
      libncurses5-dev \
      libsqlite3-dev \
      libtool \
      libyaml-dev \
      sqlite3 \
      libgmp-dev \
      libreadline-dev \
      libcurl4-openssl-dev \
      software-properties-common \
      libffi-dev \
      libxslt1-dev \
      ruby-full

RUN apt-get install -y gnupg2

RUN gem install bundler

USER $USER

#ENV RUBY_VERSION=2.7.5
#ENV RVM_DIR=/home/$USER/.rvm
#RUN mkdir -p $RVM_DIR
#
#RUN gpg --keyserver hkp://keyserver.ubuntu.com --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB && \
#    command curl -sSL https://rvm.io/mpapis.asc | gpg --import - && \
#    command curl -sSL https://rvm.io/pkuczynski.asc | gpg --import - && \
#    curl -sSL https://get.rvm.io | bash -s stable --path $RVM_DIR
#
#SHELL ["/bin/bash", "-c"]
#RUN . "$RVM_DIR/scripts/rvm" && \
#    rvm autolibs fail && \
#    rvm install $RUBY_VERSION && \
#    gem install bundler
#SHELL ["/bin/sh", "-c"]
#
#RUN echo "[ -s \"$RVM_DIR/scripts/rvm\" ] && \. \"$RVM_DIR/scripts/rvm\"" >> /home/$USER/.bashrc

USER root

RUN touch /usr/local/etc/php/conf.d/mail.ini && \
    echo "SMTP = maildev.workspace" >> /usr/local/etc/php/conf.d/mail.ini && \
    echo "smtp_port = 25" >> /usr/local/etc/php/conf.d/mail.ini

RUN touch /usr/local/etc/php/conf.d/uploads.ini && \
    echo "upload_max_filesize = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini && \
    echo "post_max_size = 100M;" >> /usr/local/etc/php/conf.d/uploads.ini

RUN touch /usr/local/etc/php/conf.d/memory.ini && \
    echo "memory_limit = 256M;" >> /usr/local/etc/php/conf.d/memory.ini

USER $USER

ENV APACHE_DOCUMENT_ROOT /var/www
WORKDIR $APACHE_DOCUMENT_ROOT

EXPOSE 80
EXPOSE 443

