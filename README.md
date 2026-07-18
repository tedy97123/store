# MTG Store — Multi-Tenant Symfony + React

Monorepo for a multi-tenant Magic: The Gathering store platform with Scryfall card data, per-store inventory, customer accounts, CSV bulk import, and role-based admin access.

## Stack

- **Backend:** Symfony 8, API Platform, PostgreSQL, JWT (Lexik), Symfony Messenger (async CSV import)
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, React Router
- **Data:** Scryfall `oracle_cards` bulk sync + live search fallback

> **Architecture docs:** end-to-end flowcharts for every feature (frontend → route → service → repository → DB) live in [`architecture/`](architecture/README.md). Start there if you want to understand where a feature lives before touching code.

---

## Prerequisites

Install these first. Versions in parentheses are what this guide was verified against.

| Tool | Version | Notes |
|------|---------|-------|
| PHP | 8.4 (8.4.11) | CLI. Must have `sodium`, `openssl`, `ctype`, `iconv`, `pdo_pgsql` extensions — see [PHP extensions](#php-extensions) |
| Composer | 2.x (2.8.11) | Global `composer` or a local `composer.phar` both work |
| Node.js | 20+ (24.13.0) | |
| npm | 10+ (11.6.2) | |
| Docker + Compose | (29.6.1) | Provides PostgreSQL 16 and Mailpit |

### PHP extensions

The backend **will not install** without the `sodium` extension (required by the JWT library) and needs `pdo_pgsql` to talk to Postgres. Verify:

```bash
php -m | grep -E "sodium|openssl|pdo_pgsql|ctype|iconv"
```

If any are missing, enable them in your `php.ini` (find it with `php --ini`). On Windows uncomment the relevant lines:

```ini
extension=sodium
extension=openssl
extension=pdo_pgsql
```

---

## Quick start

```bash
# 1. Infrastructure (Postgres + Mailpit)
docker compose up -d

# 2. Backend
cd backend
composer install
php bin/console lexik:jwt:generate-keypair --skip-if-exists
php bin/console doctrine:migrations:migrate --no-interaction
php bin/console app:seed
php -S 127.0.0.1:8000 -t public          # leave running

# 3. CSV import worker (separate terminal — see note below)
cd backend
php bin/console messenger:consume async -vv

# 4. Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The frontend proxies `/api` → `http://127.0.0.1:8000` (configured in `frontend/vite.config.ts`), so no frontend env file is needed for local dev.

The detailed walk-through below explains each step and the platform-specific gotchas.

---

## Detailed setup

### 1. Start infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** on `127.0.0.1:5432` (db `store`, user `store`, password `store`)
- **Mailpit** on `127.0.0.1:8025` (web UI) / `1025` (SMTP)

Check it's healthy:

```bash
docker compose ps
```

> **⚠️ Port 5432 conflict (common on Windows/dev machines with a native Postgres install).**
> If you have PostgreSQL installed as a Windows service, it will also bind `5432` and silently intercept the app's connection, causing `FATAL: password authentication failed for user "store"` even though the container is fine.
>
> Check who owns the port:
> ```powershell
> Get-NetTCPConnection -LocalPort 5432 -State Listen |
>   ForEach-Object { Get-Process -Id $_.OwningProcess } | Select-Object Id, ProcessName
> ```
> The cleanest fix (keeps Docker on the canonical port, matching production) is to stop the native service and set it to manual start:
> ```powershell
> # Run elevated (Admin)
> Get-Service *postgres* | Stop-Service -Force
> Get-Service *postgres* | Set-Service -StartupType Manual
> ```
> Then `docker compose up -d` again. To restore the native service later: `Set-Service <name> -StartupType Automatic; Start-Service <name>`.

### 2. Install backend dependencies

```bash
cd backend
composer install          # or: php ../composer.phar install
```

> If install fails with `ext-sodium ... is missing`, enable the `sodium` extension (see [PHP extensions](#php-extensions)) and re-run.

### 3. Generate JWT keys

Lexik signs JWTs with an RSA keypair that is **not** committed. Generate it:

```bash
php bin/console lexik:jwt:generate-keypair --skip-if-exists
```

This writes `config/jwt/private.pem` and `config/jwt/public.pem` using the passphrase in `backend/.env` (`JWT_PASSPHRASE`).

> **⚠️ Windows `OPENSSL_CONF` gotcha.** If the command fails with
> `error:80000002:system library::No such file or directory`, your shell has an
> `OPENSSL_CONF` env var pointing at a config file that doesn't exist (e.g. a
> leftover from a PostgreSQL/ODBC install). Clear it for the command, or generate
> the keys directly with the OpenSSL CLI:
> ```bash
> export OPENSSL_CONF=          # bash — unset for this session
> mkdir -p config/jwt
> PASS=$(grep '^JWT_PASSPHRASE=' .env | cut -d= -f2)
> openssl genpkey -algorithm RSA -out config/jwt/private.pem -aes256 -pass pass:$PASS -pkeyopt rsa_keygen_bits:4096
> openssl pkey -in config/jwt/private.pem -passin pass:$PASS -pubout -out config/jwt/public.pem
> ```

### 4. Run migrations

```bash
php bin/console doctrine:migrations:migrate --no-interaction
```

Creates all tables plus the `messenger_messages` table (the async transport auto-sets-up on first use as well).

### 5. Seed demo data

```bash
php bin/console app:seed
```

Creates the demo users, the `acme-tcg` store, and sample inventory (pulls a few sample cards from Scryfall).

### 6. Run the backend server

```bash
php -S 127.0.0.1:8000 -t public
```

API docs: **http://127.0.0.1:8000/api/docs**

### 7. Run the CSV import worker

CSV imports are processed **asynchronously** via Symfony Messenger using the Doctrine transport (`MESSENGER_TRANSPORT_DSN=doctrine://default?queue_name=csv_import` in `.env`). Uploads will be accepted and queued, but **rows won't process until a worker is running**:

```bash
php bin/console messenger:consume async -vv
```

Leave this running in its own terminal during development. (Skip it if you're not testing CSV import.)

### 8. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**.

---

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Super admin | admin@store.local | password123 |
| Store owner | owner@store.local | password123 |
| Customer | customer@store.local | password123 |

Demo store: **`/s/acme-tcg`**

To create additional super-admins (the only supported way — admin accounts cannot self-register):

```bash
php bin/console app:create-admin admin2@store.local "Second Admin" --password=changeme123
```

---

## Roles

- **ROLE_SUPER_ADMIN** — platform admin (`/platform/admin`), manage stores/users, trigger Scryfall sync, view all imports
- **ROLE_STORE_OWNER** — manage inventory, branding, CSV imports & orders for owned store(s) (`/s/{slug}/admin`)
- **ROLE_USER** — browse stores, register, and hold per-store customer accounts (favorites, want lists)

---

## API highlights

- `POST /api/login` — JWT login
- `POST /api/register` — customer/owner registration
- `GET  /api/me` — current user profile
- `GET  /api/stores` — public store directory
- `GET  /api/stores/{slug}/inventory` — public store inventory
- `GET  /api/catalog/search?q=` — authenticated card search (local + Scryfall fallback)
- `POST /api/stores/{slug}/inventory` — add inventory item (store owner)
- `POST /api/stores/{slug}/csv-imports` — upload a CSV import (store owner)
- `PATCH /api/stores/{slug}/settings` — update store branding/spotlight (store owner)
- `POST /api/admin/scryfall/sync` — super-admin bulk sync

Full API docs: **http://127.0.0.1:8000/api/docs**

---

## Scryfall sync

```bash
php bin/console app:scryfall:sync                      # default_cards — every printing (recommended)
php bin/console app:scryfall:sync --type=oracle_cards  # one printing per card name (smaller/faster)
```

Streams the chosen Scryfall bulk file to disk, parses it incrementally, and upserts the local catalog with multi-row `ON CONFLICT` batches — memory stays flat even for the multi-hundred-MB `default_cards` file.

**`default_cards` is what makes the catalog self-sufficient**: store CSV imports identify a printing by set + collector number, and only the all-printings dataset can resolve those locally (indexed natural-key lookup) without falling back to the Scryfall API. Schedule it via cron to keep prices fresh.

Super-admins can also trigger a sync via `POST /api/admin/scryfall/sync` (defaults to the smaller `oracle_cards` so the synchronous request stays within HTTP timeouts; accepts `{"type": "default_cards"}`).

---

## Services & ports

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://127.0.0.1:8000 |
| API docs (Swagger) | http://127.0.0.1:8000/api/docs |
| Mailpit (email UI) | http://localhost:8025 |
| PostgreSQL | 127.0.0.1:5432 |

---

## Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `ext-sodium ... is missing` on `composer install` | Enable `extension=sodium` in `php.ini`. |
| `error:80000002:system library::No such file or directory` on key generation | Bad `OPENSSL_CONF` env var — see [step 3](#3-generate-jwt-keys). |
| `password authentication failed for user "store"` | A native Postgres is shadowing the Docker container on port 5432 — see the [port conflict note](#1-start-infrastructure). |
| `Unable to find the JWT key` / 401 on every request | JWT keys not generated — run [step 3](#3-generate-jwt-keys). |
| CSV upload accepted but rows stay "pending" | The Messenger worker isn't running — see [step 7](#7-run-the-csv-import-worker). |
| Want a totally clean DB | `docker compose down -v && docker compose up -d`, then re-run migrations + seed. |
