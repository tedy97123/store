# Catalog & inventory

Covers card catalog search, browsing a store's inventory, inventory CRUD (owner), Scryfall bulk sync, the card details page, and the spotlight carousel.

- **`cards`** is a shared, global catalog (no `store_id`) synced from Scryfall.
- **`inventory_items`** is store-scoped (`store_id`) and unique per `(store, card, condition, is_foil)`.
- Inventory GET/POST/PATCH/DELETE are **API Platform operations** on `InventoryItem` delegating to State Providers/Processors; catalog search and Scryfall sync are **custom controllers**.

| Operation | Route | Backend |
|-----------|-------|---------|
| Catalog search | `GET /api/catalog/search` | `CardSearchController` |
| Browse inventory | `GET /api/stores/{slug}/inventory` | `StoreInventoryCollectionProvider` |
| Inventory item | `GET /api/stores/{slug}/inventory/{id}` | `StoreInventoryItemProvider` |
| Add inventory | `POST /api/stores/{slug}/inventory` | `StoreInventoryProcessor` |
| Edit inventory | `PATCH /api/stores/{slug}/inventory/{id}` | `StoreInventoryProcessor` |
| Delete inventory | `DELETE /api/stores/{slug}/inventory/{id}` | `StoreInventoryProcessor` |
| Scryfall sync | `POST /api/admin/scryfall/sync` | `ScryfallSyncController` |

---

## Catalog search

```mermaid
flowchart LR
    subgraph FE["🖥️ SearchTab.tsx"]
        deb["useDebouncedValue(query)"]
        q["api.get('/catalog/search', {q, set?, finish?})"]
    end
    deb --> q -->|"GET /api/catalog/search"| rt["🌐 GET /api/catalog/search<br/>#IsGranted('ROLE_USER')"]
    rt --> c["🎛️ CardSearchController::search()"]
    c --> local["🗄️ CardRepository::searchByName()<br/>LOWER(name) LIKE, limit 60"]
    local --> db[("cards SELECT")]
    c --> resolver["⚙️ CatalogCardResolver::matchesFilters()/serializeCard()"]
    c -.->|"few local hits"| scry["⚙️ ScryfallClient::searchRemoteAndUpsert()<br/>→ Scryfall API, upsert into cards"]
    scry --> db
    c -->|"merged card list"| q
```

Searches the local catalog first; if results are thin it falls back to Scryfall live search and **upserts** the fetched cards into `cards` so subsequent searches are local.

| Layer | Where |
|-------|-------|
| Frontend | `pages/store-admin/SearchTab.tsx`, `hooks/useDebouncedValue.ts` |
| Route | `GET /api/catalog/search` (auth required) |
| Entry | `Controller/CardSearchController::search()` |
| Service | `Service/Catalog/CatalogCardResolver`, `Service/Scryfall/ScryfallClient` |
| Repo/DB | `CardRepository::searchByName` → `cards` (read, possible upsert) |

---

## Browse store inventory

```mermaid
flowchart LR
    sp["🖥️ StorePage.tsx<br/>api.get('/stores/{slug}/inventory')<br/>(client-side filters + 24/page)"] -->|"GET"| rt["🌐 GET /api/stores/{slug}/inventory"]
    rt --> tenant["TenantSubscriber sets Store"]
    tenant --> prov["🎛️ StoreInventoryCollectionProvider::provide()"]
    prov --> repo["🗄️ InventoryItemRepository::findByStore()<br/>JOIN card, ORDER BY name"]
    repo --> db[("inventory_items ⋈ cards<br/>SELECT WHERE store_id")]
    prov -->|"InventoryItem[] + nested Card"| sp
```

Filtering (search, set, color, price, foil) and pagination happen **client-side** over the fetched list. Card tiles render via `components/cards/CardTile.tsx`.

---

## Inventory CRUD (store owner)

```mermaid
flowchart TD
    subgraph FE["🖥️ SearchTab.tsx modals"]
        add["Add → api.post('/stores/{slug}/inventory')"]
        edit["Edit → api.patch('.../inventory/{id}')"]
        del["Delete → api.delete('.../inventory/{id}')"]
    end
    add & edit & del --> sec{"🔒 STORE_MANAGE (voter)"}
    sec --> proc["🎛️ StoreInventoryProcessor::process()"]
    proc --> card["CardRepository::find(cardId)"]
    proc --> writer["⚙️ StoreInventoryWriter::write()<br/>(POST/PATCH)"]
    writer --> enrich["ScryfallClient::fetchCardById()<br/>if card lacks Scryfall data"]
    writer --> dup["InventoryItemRepository::findOneBy(<br/>store, card, condition, isFoil)"]
    dup --> db[("🗄️ inventory_items<br/>INSERT or UPDATE quantity/price<br/>(upsert on unique key)")]
    proc -->|DELETE| rm[("🗄️ inventory_items DELETE")]
```

- The unique key `(store, card, condition, is_foil)` means adding a card that already exists **merges** into the existing line (quantity/price update) rather than duplicating. A PATCH that would collide with another line also merges.
- `StoreInventoryWriter` lazily enriches the `Card` from Scryfall (prices/images) when needed.

| Layer | Where |
|-------|-------|
| Frontend | `pages/store-admin/SearchTab.tsx` (add/edit/delete modals) |
| Routes | `POST/PATCH/DELETE /api/stores/{slug}/inventory[/{id}]` |
| Entry | `State/StoreInventoryProcessor.php`, `State/StoreInventoryItemProvider.php` |
| Service | `Service/Inventory/StoreInventoryWriter`, `Service/Scryfall/ScryfallClient` |
| Repo/DB | `InventoryItemRepository`, `CardRepository` → `inventory_items`, `cards` |

---

## Card details & spotlight

```mermaid
flowchart LR
    subgraph FE["🖥️ frontend"]
        cd["CardDetailsPage.tsx<br/>api.get('/stores/{slug}/inventory/{id}')"]
        fav["favorite / want-list actions<br/>(see customers-and-orders.md)"]
        spot["StorePage → SpotlightCard<br/>filtered by store.spotlightMinPriceCents"]
    end
    cd -->|"GET .../inventory/{id}"| prov["🎛️ StoreInventoryItemProvider::provide()"]
    prov --> repo["🗄️ InventoryItemRepository (find by store + id)"]
    repo --> db[("inventory_items ⋈ cards")]
    spot -. "reuses browse inventory + store.spotlightMinPriceCents" .-> db
    cd --> fav
```

The **spotlight carousel** on the storefront isn't a separate endpoint — it filters the already-loaded inventory by the store's `spotlightMinPriceCents` (configured in `SpotlightTab.tsx` via `PATCH /stores/{slug}/settings`) and sorts by market price.

---

## Scryfall bulk sync

```mermaid
sequenceDiagram
    participant Trigger as POST /api/admin/scryfall/sync (or CLI app:scryfall:sync)
    participant Ctl as ScryfallSyncController / Command
    participant SC as ScryfallClient::syncOracleCards()
    participant API as Scryfall bulk API
    participant EM as Doctrine EntityManager
    participant DB as cards table

    Trigger->>Ctl: (ROLE_SUPER_ADMIN)
    Ctl->>SC: syncOracleCards(onProgress)
    SC->>API: getOracleCardsBulkInfo() → download ~169MB JSON
    loop batches of 500
        SC->>SC: upsertFromScryfallData(card)
        SC->>DB: CardRepository::find(id) (exists?)
        SC->>EM: persist (insert) or update
        SC->>EM: flush() + clear()
    end
    SC-->>Ctl: {inserted, updated, total}
```

Batched (500/flush) with `EntityManager::clear()` between batches to keep memory bounded across ~30–40k cards. Super-admin only.

| Layer | Where |
|-------|-------|
| Trigger | `Controller/ScryfallSyncController::sync()` or `Command/ScryfallSyncCommand` |
| Service | `Service/Scryfall/ScryfallClient::syncOracleCards` |
| Repo/DB | `CardRepository` → `cards` (upsert) |

---

## Card resolution cascade

Shared by catalog search and CSV import. `CatalogCardResolver::resolve(name, setCode, collectorNumber, rarity, finish)` returns a `CatalogResolutionResult`:

```mermaid
flowchart TD
    start["resolve(name, set, collector#, rarity, finish)"] --> local["1. matchLocalCard()<br/>CardRepository::searchByName + matchesFilters"]
    local -->|hit| done([✅ CatalogResolutionResult.card])
    local -->|miss| mtg["2. matchMtgJsonCard()<br/>MTGJsonClient::getSetCards()"]
    mtg -->|hit| done
    mtg -->|miss| scry["3. resolveViaScryfallSearch()<br/>ScryfallClient::searchRemoteAndUpsert()"]
    scry -->|hit| done
    scry -->|miss| err([⛔ result.error])
```

| Layer | Where |
|-------|-------|
| Resolver | `Service/Catalog/CatalogCardResolver`, DTO `DTO/CatalogResolutionResult` |
| Sources | `CardRepository` (local), `Service/MTGJson/MTGJsonClient`, `Service/Scryfall/ScryfallClient` |
