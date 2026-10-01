# Smart Village API

Laravel 12 REST API for the Smart Village thesis project.

## Implemented foundation

- Phone/password registration and login
- New accounts start as `pending`
- Admin approval, rejection and suspension
- Sanctum bearer-token authentication
- Admin and resident authorization
- News management
- Incident creation, resident edit/delete while pending, and admin status updates
- Incident status history
- In-app notifications and Firebase token storage endpoint
- MySQL schema and an initial admin seeder

## Local requirements

- PHP 8.2+
- Composer 2
- MySQL 8+

## Setup

```powershell
cd backend
Copy-Item .env.example .env
composer install
php artisan key:generate
```

Create a MySQL database named `smart_village`, update `.env`, then run:

```powershell
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
```

Initial local admin account:

- Phone: `admin`
- Password: `admin1234`

Change this password before any public deployment.

## Tests

```powershell
php artisan test
```

The test environment uses an in-memory SQLite database and does not modify the local MySQL database.
