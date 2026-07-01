# Stores & branding

Covers the public store directory, the storefront-by-slug page, the branding/theme editor, and platform-admin management of stores and users.

`Store` is an **API Platform resource** (`#[ApiResource]` on `src/Entity/Store.php`) — its GET operations use State Providers and its admin writes use a State Processor. Branding updates go through a **custom controller** instead.

| Operation | Route | Backend |
|-----------|-------|---------|
| List active stores | `GET /api/stores` | `ActiveStoreCollectionProvider` |
| Store by slug | `GET /api/stores/{slug}` | `StoreBySlugProvider` |
| Admin list stores | `GET /api/admin/stores` | API Platform default (super-admin) |
| Admin create store | `POST /api/admin/stores` | `StoreAdminProcessor` |
| Admin update store | `PATCH /api/admin/stores/{id}` | `StoreAdminProcessor` |
| Update branding/settings | `PATCH /api/stores/{slug}/settings` | `StoreSettingsController` |

---

## Browse store directory

```mermaid
flowchart LR
    hp["🖥️ HomePage.tsx<br/>useQuery(['stores'])<br/>api.get('/stores')"] -->|"GET /api/stores"| rt["🌐 GET /api/stores"]
    rt --> p["🎛️ ActiveStoreCollectionProvider::provide()"]
    p --> repo["🗄️ StoreRepository::findActiveStores()"]
    repo --> db[("stores<br/>SELECT WHERE is_active = true<br/>ORDER BY name")]
    p -->|"Store[] (store:read)"| hp
```

Public, no auth. Returns active stores serialized with the `store:read` group (name, slug, branding fields).

---

## View a storefront by slug

```mermaid
flowchart LR
    subgraph FE["🖥️ StorePage.tsx"]
        us["useStore(slug)<br/>api.get('/stores/{slug}')"]
        ut["useStoreTheme(store)<br/>→ storeThemeVars() CSS vars"]
        inv["api.get('/stores/{slug}/inventory')"]
        hero["StoreHero (branded)"]
    end
    us -->|"GET /api/stores/{slug}"| rt["🌐 GET /api/stores/{slug}"]
    rt --> prov["🎛️ StoreBySlugProvider::provide()"]
    prov --> repo["🗄️ StoreRepository::findOneBySlug()"]
    repo --> db[("stores<br/>SELECT WHERE slug = ?<br/>(404 if missing)")]
    prov -->|"Store"| us
    us --> ut --> hero
    inv -. "see catalog-and-inventory.md" .-> hero
```

The store's branding columns (colors, logo, hero text) become CSS custom properties via `lib/storeTheme.ts`, so the storefront is themed per tenant. Inventory is fetched separately (see [catalog-and-inventory.md](catalog-and-inventory.md#browse-store-inventory)).

| Layer | Where |
|-------|-------|
| Frontend | `pages/StorePage.tsx`, `hooks/useStore.ts`, `hooks/useStoreTheme.ts`, `lib/storeTheme.ts`, `components/store/StoreHero.tsx` |
| Route | `GET /api/stores/{slug}` |
| Entry | `State/StoreBySlugProvider.php` |
| Repo/DB | `StoreRepository::findOneBySlug` → `stores` (read) |

---

## Update branding & settings

```mermaid
flowchart LR
    subgraph FE["🖥️ BrandingTab.tsx"]
        form["BrandingForm (colors, urls, hero text,<br/>spotlightMinPriceCents)"]
        prev["StorePreview (live theme preview)"]
        mut["useMutation → api.patch('/stores/{slug}/settings')"]
    end
    form --> mut -->|"PATCH /api/stores/{slug}/settings"| rt["🌐 PATCH .../settings"]
    rt --> c["🎛️ StoreSettingsController::update()"]
    c --> g{"denyAccessUnlessGranted<br/>STORE_MANAGE"}
    g -->|ok| upd["⚙️ StoreSettingsUpdater::update()<br/>validates hex colors / urls / lengths"]
    upd --> db[("🗄️ stores<br/>UPDATE branding + spotlight cols")]
    upd -->|"serialized Store"| mut
```

- Validation lives in `StoreSettingsUpdater`: colors must match `#RRGGBB`, URLs must start with `http(s):` or `/`, text fields have max lengths. Invalid input → `422`.
- `StoreVoter` gates the write: store owner or super-admin only.

| Layer | Where |
|-------|-------|
| Frontend | `pages/store-admin/BrandingTab.tsx`, `hooks/useStore.ts` |
| Route | `PATCH /api/stores/{slug}/settings` |
| Entry | `Controller/StoreSettingsController::update()` |
| Service | `Service/Store/StoreSettingsUpdater` |
| DB | `stores` (read + update) |

---

## Platform admin — stores & users

```mermaid
flowchart LR
    subgraph FE["🖥️ PlatformAdminPage.tsx"]
        ls["useQuery(['admin-stores'])<br/>api.get('/admin/stores')"]
        lu["useQuery(['admin-users'])<br/>api.get('/admin/users')"]
        cs["create store form<br/>api.post('/admin/stores')"]
    end
    subgraph API["🌐 Routes (ROLE_SUPER_ADMIN)"]
        r1["GET /api/admin/stores"]
        r2["GET /api/admin/users"]
        r3["POST /api/admin/stores"]
        r4["POST/PATCH /api/admin/users"]
    end
    ls --> r1 --> dstore[("🗄️ stores SELECT *")]
    lu --> r2 --> duser[("🗄️ users SELECT *")]
    cs --> r3 --> sap["🎛️ StoreAdminProcessor::process()"]
    sap --> promote["promote owner → ROLE_STORE_OWNER"]
    sap --> wstore[("🗄️ stores INSERT/UPDATE<br/>+ users UPDATE roles")]
    r4 --> uap["🎛️ UserAdminProcessor::process()<br/>hash plainPassword if set"]
    uap --> wuser[("🗄️ users INSERT/UPDATE")]
```

- All `/api/admin/*` operations require `ROLE_SUPER_ADMIN` (enforced by `security.yaml` **and** API Platform `security:` on each operation). The `TenantFilter` is disabled for these routes.
- Creating a store via `StoreAdminProcessor` also **promotes the chosen owner** to `ROLE_STORE_OWNER`.
- `UserAdminProcessor` hashes `plainPassword` (write-only field) before persisting.

| Layer | Where |
|-------|-------|
| Frontend | `pages/PlatformAdminPage.tsx` |
| Routes | `GET/POST /api/admin/stores`, `PATCH /api/admin/stores/{id}`, `GET/POST/PATCH /api/admin/users[/{id}]` |
| Entry | `State/StoreAdminProcessor.php`, `State/UserAdminProcessor.php`, API Platform default collection providers |
| DB | `stores`, `users` (read/insert/update) |
