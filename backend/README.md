# ByaheGo – Backend API

Laravel 13 (PHP 8.3) REST API with Sanctum token auth. Works with SQLite locally and PostgreSQL (Neon) in production.

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate --seed
php artisan serve          # http://localhost:8000
php artisan test           # 28 feature tests
```

See the main [README](../README.md) for features, API overview and deployment.
