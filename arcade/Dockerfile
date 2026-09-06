# Production Arcade API image.
# Local compose still works: docker-compose.yml mounts ./arcade:/var/www/html over this tree.
FROM composer:2 AS builder

WORKDIR /app

COPY composer.json composer.lock ./
COPY src ./src

RUN composer install \
    --no-dev \
    --prefer-dist \
    --no-interaction \
    --no-scripts \
    --optimize-autoloader

FROM php:8.2-apache

RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev \
        zip \
        unzip \
    && docker-php-ext-install pdo_mysql zip \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf \
    && sed -ri -e 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

WORKDIR /var/www/html

COPY --from=builder /app/vendor ./vendor
COPY composer.json ./
COPY public ./public
COPY src ./src

RUN chown -R www-data:www-data /var/www/html

EXPOSE 80
