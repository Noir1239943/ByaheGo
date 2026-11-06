# ByaheGo – Backend API

Laravel 13 (PHP 8.3) REST API with Sanctum token auth. It runs on PostgreSQL (a Neon project) everywhere; the tests use an in-memory SQLite database.

```bash
composer install
cp .env.example .env       # paste your Neon DIRECT connection string (no "-pooler") into DB_URL
php artisan key:generate
php artisan migrate --seed # demo data; prints the demo password
php artisan serve          # http://localhost:8000  (or: node dev-parallel.mjs, which answers several requests at once)
php artisan test
```

See the main [README](../README.md) for features, API overview, security and deployment.
