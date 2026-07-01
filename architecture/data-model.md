# Data model

PostgreSQL 16. All tables are created by the Doctrine migrations in `backend/migrations/`. Card data uses UUID primary keys (from Scryfall); everything else uses auto-increment integers.

## Entity–relationship diagram

```mermaid
erDiagram
    users ||--o{ stores : "owns (owner_id)"
    users ||--o{ store_customers : "is (user_id)"
    stores ||--o{ store_customers : "has (store_id)"
    stores ||--o{ inventory_items : "stocks (store_id)"
    stores ||--o{ orders : "receives (store_id)"
    stores ||--o{ csv_import_jobs : "runs (store_id)"
    cards ||--o{ inventory_items : "listed as (card_id)"
    cards ||--o{ order_lines : "sold as (card_id, nullable)"
    cards ||--o{ customer_want_list_entries : "wanted as (card_id, nullable)"
    orders ||--o{ order_lines : "contains (order_id)"
    csv_import_jobs ||--o{ csv_import_rows : "parses into (job_id)"
    store_customers ||--o{ customer_favorites : "saves (customer_id)"
    store_customers ||--o{ customer_want_list_entries : "lists (customer_id)"
    inventory_items ||--o{ customer_favorites : "favorited as (inventory_item_id)"

    users {
        int id PK
        string email UK
        string password
        json roles
        string display_name
    }
    stores {
        int id PK
        int owner_id FK
        string name
        string slug UK
        bool is_active
        int spotlight_min_price_cents
        string primary_color "hex, nullable"
        string accent_color "hex, nullable"
        string background_color "+ surface/text/muted/border"
        string logo_url "nullable"
        string hero_image_url "nullable"
        string hero_heading "+ subheading/tagline"
        timestamp created_at
    }
    cards {
        uuid id PK
        uuid oracle_id
        string name "indexed"
        string set_code
        string collector_number
        string rarity
        json prices
        json image_uris
        json scryfall_data
        timestamp scryfall_updated_at
    }
    inventory_items {
        int id PK
        int store_id FK
        uuid card_id FK
        int quantity
        int price_cents
        string condition "enum CardCondition"
        bool is_foil
        text notes
    }
    orders {
        int id PK
        int store_id FK
        string reference UK
        string status "enum OrderStatus"
        string customer_name
        string customer_email
        int total_cents
        timestamp created_at
    }
    order_lines {
        int id PK
        int order_id FK
        uuid card_id FK "nullable, ON DELETE SET NULL"
        string card_name
        int quantity
        int price_cents
    }
    csv_import_jobs {
        int id PK
        int store_id FK
        string original_filename
        string status "queued/processing/completed/failed/paused/cancelled"
        int total_rows
        int processed_rows
        int imported_rows
        int failed_rows
        timestamp started_at
        timestamp finished_at
    }
    csv_import_rows {
        int id PK
        int job_id FK "ON DELETE CASCADE"
        int row_index
        string name
        string set_code
        string condition
        bool is_foil
        int quantity
        string status "queued/processing/imported/error"
        json card "matched card, nullable"
        text error
        int imported_item_id
    }
    store_customers {
        int id PK
        int user_id FK "ON DELETE CASCADE"
        int store_id FK "ON DELETE CASCADE"
        string phone
        text shipping_address
        string payment_brand
        string payment_last4
        string payment_expires
        timestamp created_at
        timestamp updated_at
    }
    customer_favorites {
        int id PK
        int customer_id FK "ON DELETE CASCADE"
        int inventory_item_id FK "ON DELETE CASCADE"
        timestamp created_at
    }
    customer_want_list_entries {
        int id PK
        int customer_id FK "ON DELETE CASCADE"
        uuid card_id FK "nullable, ON DELETE SET NULL"
        string card_name
        string set_code
        bool is_foil
        int quantity
        string notes
        timestamp created_at
    }
```

> Not shown: `messenger_messages` — the Symfony Messenger Doctrine transport table (queue for async CSV jobs). No FKs; columns `body`, `headers`, `queue_name`, `created_at`, `available_at`, `delivered_at`.

## Multi-tenancy pattern

The tenant discriminator is **`store_id`**. Tables split into these groups:

| Group | Tables | How they're scoped |
|-------|--------|--------------------|
| **Tenant root** | `stores` | The tenant itself, resolved from the URL slug |
| **Directly scoped** | `inventory_items`, `orders`, `csv_import_jobs`, `store_customers` | Have a `store_id` column. `inventory_items` and `orders` are additionally enforced by the Doctrine `TenantFilter` at the SQL level |
| **Transitively scoped** | `order_lines` (→ `orders`), `csv_import_rows` (→ `csv_import_jobs`), `customer_favorites` / `customer_want_list_entries` (→ `store_customers`) | Reached only through a scoped parent |
| **Global / shared** | `users`, `cards` | Not tenant-scoped. `cards` is a shared catalog across all stores; `users` are global identities that gain per-store `store_customers` rows |

See [auth-and-tenancy.md](auth-and-tenancy.md#multi-tenancy-filter) for how the filter is toggled per request.

## Enums

Both are PHP backed enums stored as strings.

| Enum | Column | Values |
|------|--------|--------|
| `CardCondition` (`src/Enum/CardCondition.php`) | `inventory_items.condition` | `NM`, `LP`, `MP`, `HP`, `DMG` |
| `OrderStatus` (`src/Enum/OrderStatus.php`) | `orders.status` | `pending`, `paid`, `shipped`, `completed`, `cancelled`, `refunded` |

## Key constraints

- `users.email` — unique (`UNIQ_USER_EMAIL`)
- `stores.slug` — unique (`UNIQ_STORE_SLUG`)
- `inventory_items` — unique on `(store_id, card_id, condition, is_foil)` (`UNIQ_INVENTORY_STORE_CARD`) → one line per condition/foil combination; writes upsert into it
- `orders.reference` — unique (format `ORD-xxxxxxxx`)
- `store_customers` — unique on `(user_id, store_id)` → one customer profile per user per store
- `customer_favorites` — unique on `(customer_id, inventory_item_id)`
- `cards` — indexed on `name` and `oracle_id` for search
