# Customers & orders

Covers per-store customer profiles, favorites, want lists (all via the `StoreCustomerController`), plus orders and sales reports (API Platform `Order` resource).

A **`StoreCustomer`** links a global `User` to a specific `Store` (unique per `user_id + store_id`). Favorites and want-list entries hang off that customer row.

**Create-on-write:** `GET` endpoints never create rows — they return empty if the user has no `StoreCustomer` at that store yet. The row is created lazily on the first `PUT`/`POST`/`PATCH`.

All customer routes are under `StoreCustomerController` at `/api/stores/{slug}/customer`, gated by `ROLE_USER`.

| Feature | Route(s) |
|---------|----------|
| Profile | `GET` / `PATCH /api/stores/{slug}/customer` |
| Favorites | `GET /favorites`, `PUT /favorites/{itemId}`, `DELETE /favorites/{itemId}` |
| Want list | `GET /want-list`, `POST /want-list`, `DELETE /want-list/{id}` |
| Orders | `GET/POST /api/stores/{slug}/orders`, `GET /orders/{id}` |

---

## Customer profile

```mermaid
flowchart LR
    subgraph FE["🖥️ CustomerProfilePage.tsx"]
        show["useCustomerProfile(slug)<br/>api.get('/stores/{slug}/customer')"]
        save["api.patch('/stores/{slug}/customer', values)"]
    end
    show -->|GET| rt1["🌐 GET .../customer"]
    save -->|PATCH| rt2["🌐 PATCH .../customer"]
    rt1 --> sc1["🎛️ StoreCustomerController::show()"]
    rt2 --> sc2["🎛️ StoreCustomerController::update()"]
    sc1 --> find["StoreCustomerRepository::findOneForUserAndStore()"]
    sc2 --> getor["StoreCustomerRepository::getOrCreateForUserAndStore()<br/>(create-on-write)"]
    find --> db[("🗄️ store_customers SELECT<br/>(empty repr if none)")]
    getor --> dbw[("🗄️ store_customers INSERT/UPDATE<br/>phone, shipping, payment meta")]
```

`update()` validates payment metadata (last4 = 4 digits, expiry `MM/YY`) before persisting. No card numbers stored — only brand/last4/expiry.

---

## Favorites

```mermaid
flowchart LR
    subgraph FE["🖥️ FavoritesPanel / CardDetailsPage"]
        lst["useCustomerFavorites(slug)<br/>GET /customer/favorites"]
        addf["PUT /customer/favorites/{itemId}"]
        delf["DELETE /customer/favorites/{itemId}"]
    end
    lst --> cf1["🎛️ Controller::favorites()"]
    addf --> cf2["🎛️ Controller::addFavorite()<br/>(create customer if needed)"]
    delf --> cf3["🎛️ Controller::removeFavorite()"]
    cf1 --> q1["CustomerFavoriteRepository::findForCustomer()<br/>JOIN inventoryItem ⋈ card"]
    cf2 --> resolve["InventoryItemRepository::findOneByStoreAndId()<br/>(item must belong to this store)"]
    q1 --> db[("🗄️ customer_favorites SELECT<br/>ORDER BY createdAt DESC")]
    cf2 --> dbw[("🗄️ customer_favorites INSERT<br/>(unique customer+item)")]
    cf3 --> dbd[("🗄️ customer_favorites DELETE")]
```

The favorited item must belong to the customer's store (validated via `findOneByStoreAndId`). Unique `(customer, inventory_item)` prevents duplicates; `PUT` is idempotent.

---

## Want list

```mermaid
flowchart LR
    subgraph FE["🖥️ WantListPanel / WantListAddForm"]
        lst["useCustomerWantList(slug)<br/>GET /customer/want-list"]
        search["catalog search (see catalog doc)"]
        add["POST /customer/want-list<br/>{cardId?, cardName, setCode, isFoil, quantity, notes}"]
        del["DELETE /customer/want-list/{id}"]
    end
    lst --> w1["🎛️ Controller::wantList()"]
    add --> w2["🎛️ Controller::addWantListEntry()<br/>(create customer if needed)"]
    del --> w3["🎛️ Controller::removeWantListEntry()"]
    w1 --> q["CustomerWantListEntryRepository::findForCustomer()<br/>LEFT JOIN card"]
    w2 --> card["CardRepository::find(cardId) (optional)"]
    q --> db[("🗄️ customer_want_list_entries SELECT")]
    w2 --> dbw[("🗄️ ..._entries INSERT<br/>card_id nullable")]
    w3 --> dbd[("🗄️ ..._entries DELETE (owned by customer)")]
```

`card_id` is optional — you can want a card that isn't in the local catalog (stored by name/set). No unique constraint, so duplicates with different specs are allowed.

| Layer | Where |
|-------|-------|
| Frontend | `pages/CustomerProfilePage.tsx`, `hooks/useCustomer.ts` |
| Controller | `Controller/StoreCustomerController.php` |
| Repos | `StoreCustomerRepository`, `CustomerFavoriteRepository`, `CustomerWantListEntryRepository`, `InventoryItemRepository`, `CardRepository` |
| DB | `store_customers`, `customer_favorites`, `customer_want_list_entries` |

---

## Orders & sales reports

Orders are an **API Platform resource** (`Order`), store-scoped via the tenant filter and gated by `STORE_MANAGE`.

```mermaid
flowchart LR
    subgraph FE["🖥️ store-admin"]
        ot["OrdersTab.tsx<br/>GET /stores/{slug}/orders"]
        rt2["ReportsTab.tsx<br/>(same fetch, aggregates client-side)"]
    end
    ot & rt2 -->|GET| route["🌐 GET /api/stores/{slug}/orders"]
    route --> prov["🎛️ StoreOrderCollectionProvider::provide()"]
    prov --> repo["🗄️ OrderRepository::findByStore()<br/>WHERE store_id ORDER BY createdAt DESC"]
    repo --> db[("orders ⋈ order_lines SELECT")]
    create["POST /stores/{slug}/orders"] --> op["🎛️ StoreOrderProcessor::process()<br/>generate ref, build OrderLines, validate"]
    op --> dbw[("🗄️ orders INSERT + order_lines INSERT")]
```

- **Reports** reuse the orders list — revenue, pending, refunded totals, average order value, and per-status breakdown are all computed **client-side** in `ReportsTab.tsx`. There's no backend aggregation endpoint.
- **`StoreOrderProcessor`** generates the unique `ORD-xxxxxxxx` reference, resolves optional card references, and builds `OrderLine` rows (validating quantity ≥ 1, price ≥ 0).
- Order status transitions follow the `OrderStatus` enum (`pending → paid → shipped → completed`, or `cancelled`/`refunded`).

| Layer | Where |
|-------|-------|
| Frontend | `pages/store-admin/OrdersTab.tsx`, `ReportsTab.tsx` |
| Routes | `GET/POST /api/stores/{slug}/orders`, `GET /orders/{id}` |
| Entry | `State/StoreOrderCollectionProvider.php`, `StoreOrderItemProvider.php`, `StoreOrderProcessor.php` |
| Repo/DB | `OrderRepository`, `OrderLineRepository`, `CardRepository` → `orders`, `order_lines` |
