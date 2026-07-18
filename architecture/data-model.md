# Data model

PostgreSQL 16. Doctrine migrations in `backend/migrations/` create the schema. Card data uses UUID primary keys from Scryfall; most application-owned records use auto-increment integer IDs.

## Entity relationship diagram

```mermaid
erDiagram
    users ||--o{ stores : "owns"
    users ||--o{ store_customers : "shops as"
    users ||--o{ customer_notifications : "receives"
    stores ||--o{ store_customers : "has customers"
    stores ||--o{ inventory_items : "stocks"
    stores ||--o{ orders : "receives"
    stores ||--o{ csv_import_jobs : "runs"
    stores ||--o{ store_payment_accounts : "connects"
    stores ||--o{ customer_notifications : "sends"
    cards ||--o{ inventory_items : "listed as"
    cards ||--o{ order_lines : "sold as"
    cards ||--o{ customer_want_list_entries : "wanted as"
    orders ||--o{ order_lines : "contains"
    orders ||--o{ customer_notifications : "related to"
    csv_import_jobs ||--o{ csv_import_rows : "parses into"
    store_customers ||--o{ customer_favorites : "saves"
    store_customers ||--o{ customer_want_list_entries : "lists"
    store_customers ||--o{ cart_items : "holds"
    inventory_items ||--o{ customer_favorites : "favorited as"
    inventory_items ||--o{ cart_items : "cart line"

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
        bool featured
        int spotlight_min_price_cents
        string primary_color
        string accent_color
        string background_color
        string surface_color
        string text_color
        string muted_color
        string border_color
        string logo_url
        string hero_image_url
        string hero_heading
        text hero_subheading
        string tagline
        string card_display_style
        timestamp created_at
    }
    cards {
        uuid id PK
        uuid oracle_id
        string name
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
        string condition
        bool is_foil
        text notes
    }
    orders {
        int id PK
        int store_id FK
        string reference UK
        string status
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
    customer_notifications {
        int id PK
        int user_id FK
        int store_id FK
        int related_order_id FK "nullable, ON DELETE CASCADE"
        string type
        string title
        text body
        timestamp created_at
        timestamp read_at
    }
    store_payment_accounts {
        int id PK
        int store_id FK
        string provider
        string status
        string environment
        string provider_merchant_id
        string provider_location_id
        text access_token_encrypted
        text refresh_token_encrypted
        json scopes
        timestamp token_expires_at
        timestamp connected_at
        timestamp disconnected_at
        text last_error
        timestamp created_at
        timestamp updated_at
    }
    store_customers {
        int id PK
        int user_id FK
        int store_id FK
        string phone
        text shipping_address
        string payment_brand
        string payment_last4
        string payment_expires
        timestamp created_at
        timestamp updated_at
    }
    cart_items {
        int id PK
        int customer_id FK
        int inventory_item_id FK
        int quantity
        timestamp created_at
        timestamp updated_at
    }
    customer_favorites {
        int id PK
        int customer_id FK
        int inventory_item_id FK
        timestamp created_at
    }
    customer_want_list_entries {
        int id PK
        int customer_id FK
        uuid card_id FK "nullable, ON DELETE SET NULL"
        string card_name
        string set_code
        bool is_foil
        int quantity
        string notes
        timestamp created_at
    }
    csv_import_jobs {
        int id PK
        int store_id FK
        string original_filename
        string status
        int total_rows
        int processed_rows
        int imported_rows
        int failed_rows
        timestamp started_at
        timestamp finished_at
    }
    csv_import_rows {
        int id PK
        int job_id FK
        int row_index
        string name
        string set_code
        string collector_number
        string condition
        bool is_foil
        int quantity
        string status
        json card
        text error
        int imported_item_id
    }
```

`messenger_messages` is not shown. It is the Symfony Messenger Doctrine transport table used by async CSV import jobs.

## Multi-tenancy pattern

The tenant discriminator is `store_id`.

| Group | Tables | How they are scoped |
|-------|--------|---------------------|
| Tenant root | `stores` | Resolved from the URL slug |
| Directly scoped | `inventory_items`, `orders`, `csv_import_jobs`, `store_customers`, `store_payment_accounts`, `customer_notifications` | Have a `store_id` column. `inventory_items` and `orders` are additionally enforced by `TenantFilter` at the SQL level |
| Transitively scoped | `order_lines`, `csv_import_rows`, `cart_items`, `customer_favorites`, `customer_want_list_entries` | Reached through a directly scoped parent |
| Global/shared | `users`, `cards` | `users` are global identities; `cards` is the shared catalog |

See [auth-and-tenancy.md](auth-and-tenancy.md#multi-tenancy-filter) for request-time filter behavior.

## Enums and constrained values

| Value set | Column | Values |
|-----------|--------|--------|
| `CardCondition` | `inventory_items.condition` | `NM`, `LP`, `MP`, `HP`, `DMG` |
| `OrderStatus` | `orders.status` | `pending`, `received`, `fulfilled`, `paid`, `shipped`, `completed`, `cancelled`, `refunded` |
| Card display style | `stores.card_display_style` | `gallery`, `marketplace` |
| Payment provider | `store_payment_accounts.provider` | `square` today; PayPal can be added later |
| Payment status | `store_payment_accounts.status` | `connected`, `disconnected`, `error` |
| Notification type | `customer_notifications.type` | `order_fulfilled` today |

## Key constraints

- `users.email` is unique.
- `stores.slug` is unique.
- `inventory_items` is unique on `(store_id, card_id, condition, is_foil)`, so each store has one inventory line per card/condition/foil combination.
- `orders.reference` is unique and generated as `ORD-xxxxxxxx`.
- `store_customers` is unique on `(user_id, store_id)`, giving one customer profile per user per store.
- `cart_items` is unique on `(customer_id, inventory_item_id)`.
- `customer_favorites` is unique on `(customer_id, inventory_item_id)`.
- `store_payment_accounts` is unique on `(store_id, provider)`.
- `customer_notifications` indexes user/store/order lookups for the notification bell and order fulfillment dedupe.
- `cards` is indexed on `name` and `oracle_id`, plus two scaling indexes (migration `Version20260718090000`):
  - `idx_card_set_collector` on `(LOWER(set_code), LOWER(collector_number))` — the **natural key of a printing**. Import resolution matches on this (indexed, exact) instead of scanning by name substring, so lookups stay fast as the catalog grows toward every MTG printing.
  - `idx_card_name_trgm`, a `pg_trgm` GIN index on `LOWER(name)` — makes the catalog's leading-wildcard `LIKE '%…%'` searches index-backed instead of sequential scans.

## Security-sensitive storage

- Store customer payment fields are metadata only: card brand, last4, and expiry. Full card numbers are not stored.
- `store_payment_accounts.access_token_encrypted` and `refresh_token_encrypted` hold provider tokens after encryption by `SecretCipher`.
- Payment status serialization intentionally excludes provider tokens.
