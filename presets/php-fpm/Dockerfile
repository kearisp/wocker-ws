ARG PHP_VERSION

FROM php:${PHP_VERSION}-fpm

#RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

#RUN touch /usr/local/bin/docker-entrypoint && \
#    echo "#!/bin/sh" >> /usr/local/bin/docker-entrypoint && \
#    echo "" >> /usr/local/bin/docker-entrypoint && \
#    echo "exec docker-php-entrypoint \"\$@\"" >> /usr/local/bin/docker-entrypoint && \
#    chmod 775 /usr/local/bin/docker-entrypoint && \
#    chmod +x /usr/local/bin/docker-entrypoint

#ENV WORKDIR /var/www/html
WORKDIR /var/www/html

EXPOSE 9000


#ENTRYPOINT ["docker-entrypoint"]
CMD ["php-fpm"]
