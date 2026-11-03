#!/bin/sh
set -e

# Render tells us which port to listen on.
PORT="${PORT:-10000}"
sed -i "s/Listen 80$/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

php artisan config:clear

# Create/update tables in Neon.
php artisan migrate --force

# Fills an EMPTY database with demo data (accounts, vehicles, trips) on the first deploy only.
# After that the data lives in Neon and this step does nothing. Delete this line to skip demo data.
php artisan db:seed --force

php artisan config:cache
php artisan route:cache

# Runs the scheduled jobs (expire unpaid bookings, lift suspensions, settle deposits) next to the web server.
# On Render's free plan the service sleeps when idle, so jobs also self-heal on the next request (see README).
php artisan schedule:work >/proc/1/fd/1 2>&1 &

exec apache2-foreground
