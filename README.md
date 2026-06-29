# MTG Store — Multi-Tenant Symfony + React

Monorepo for a multi-tenant Magic: The Gathering store platform with Scryfall card data, per-store inventory, and role-based admin access.

## Stack

- **Backend:** Symfony 8, API Platform, PostgreSQL, JWT (Lexik)
- **Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query
- **Data:** Scryfall `oracle_cards` bulk sync + live search fallback

## Quick start

### 1. Start infrastructure

```bash
docker compose up -d
```

### 2. Backend

```bash
cd backend
php ../composer.phar install
php bin/console doctrine:migrations:migrate
php bin/console app:seed
php -S 127.0.0.1:8000 -t public
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Demo accounts

| Role | Email | Password |
|------|-------|----------|
| Super admin | admin@store.local | password123 |
| Store owner | owner@store.local | password123 |
| Customer | customer@store.local | password123 |

Demo store: `/s/acme-tcg`

## Roles

- **ROLE_SUPER_ADMIN** — platform admin (`/platform/admin`), manage stores/users, trigger Scryfall sync
- **ROLE_STORE_OWNER** — manage inventory for owned store(s) (`/s/{slug}/admin`)
- **ROLE_USER** — browse stores and register

## API highlights

- `POST /api/login` — JWT login
- `POST /api/register` — customer registration
- `GET /api/me` — current user profile
- `GET /api/stores` — public store directory
- `GET /api/stores/{slug}/inventory` — public store inventory
- `GET /api/catalog/search?q=` — authenticated card search
- `POST /api/admin/scryfall/sync` — super-admin bulk sync

Full API docs: http://127.0.0.1:8000/api/docs

## Scryfall sync

```bash
php bin/console app:scryfall:sync
```

Downloads the Scryfall `oracle_cards` bulk file (~169 MB) and upserts the local catalog.
