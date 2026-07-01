# CSV import

Bulk inventory import via CSV. Uploads are parsed, persisted as a job plus rows, then processed in the background by a Symfony Messenger worker that resolves each card and writes inventory. The frontend polls for progress.

> Requires a running worker. Rows stay `queued` until `php bin/console messenger:consume async` is running. Transport: `doctrine://default?queue_name=csv_import` (see [messenger.yaml](../backend/config/packages/messenger.yaml)).

All routes are under `StoreCsvImportController` at `/api/stores/{slug}/csv-imports`, gated by `ROLE_USER` and `STORE_MANAGE`.

| Action | Route |
|--------|-------|
| Upload | `POST /api/stores/{slug}/csv-imports` |
| List runs | `GET /api/stores/{slug}/csv-imports` |
| Current run | `GET /api/stores/{slug}/csv-imports/current` |
| Run detail (+ row window) | `GET /api/stores/{slug}/csv-imports/{id}` |
| Pause / Resume / Retry / Retry-failed / Cancel | `POST /api/stores/{slug}/csv-imports/{id}/{action}` |
| Preview failed row matches | `POST /api/stores/{slug}/csv-imports/{id}/failed/preview` |
| Finalize matched failed rows | `POST /api/stores/{slug}/csv-imports/{id}/failed/manual-import` |
| Manually resolve one failed row | `POST /api/stores/{slug}/csv-imports/{id}/rows/{rowIndex}/manual-import` |

---

## Full lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Owner
    participant FE as CsvTab.tsx
    participant Ctl as StoreCsvImportController
    participant P as CsvImportParser
    participant DB as PostgreSQL
    participant Bus as MessageBus
    participant W as ProcessCsvImportMessageHandler (worker)
    participant R as CatalogCardResolver
    participant SC as ScryfallClient
    participant IW as StoreInventoryWriter

    Owner->>FE: choose CSV file
    FE->>Ctl: POST /csv-imports (multipart file)
    Ctl->>P: parse(content)
    P-->>Ctl: rows[] + warnings (validate headers, <=50k rows)
    Ctl->>DB: INSERT csv_import_jobs (status=queued)
    Ctl->>DB: INSERT csv_import_rows[] (status=queued)
    Ctl->>Bus: dispatch ProcessCsvImportMessage(jobId)
    Ctl-->>FE: 201 CsvImportJob

    Note over FE: poll every 3s while status active
    FE->>Ctl: GET /csv-imports/current (rowLimit=75)

    loop until no queued rows
        Bus->>W: ProcessCsvImportMessage(jobId)
        W->>DB: job.status = processing, startedAt
        W->>DB: claimNextQueued(job, 25): SELECT FOR UPDATE SKIP LOCKED, mark 25 processing
        loop each of the 25 rows
            W->>R: resolve(name, set, collector#, rarity, finish)
            alt card resolved
                W->>IW: write(store, card, qty, cond, foil) [flush=false]
                W->>DB: row.status = imported, importedItemId
            else not found
                W->>DB: row.status = error, error msg
            end
        end
        W->>DB: flush batch (inventory_items + rows + job counters)
        alt more queued rows
            W->>Bus: dispatch next ProcessCsvImportMessage
        else
            W->>DB: job.status = completed, finishedAt
        end
    end
```

---

## Why batched + self-dispatching?

Rather than one long-running handler, each message processes **25 rows** then enqueues the next batch. This gives:

- **Exactly-once rows** - `CsvImportRowRepository::claimNextQueued()` wraps a `SELECT ... FOR UPDATE SKIP LOCKED` plus `UPDATE ... status='processing'` in a transaction, so concurrent workers never grab the same rows and a crash mid-batch does not double-import.
- **Bounded memory / flushes** - inventory writes use `flush=false` and are flushed once per batch, not per row.
- **Progress visibility** - job counters (`processed/imported/failed_rows`) are recomputed and flushed each batch, so polling shows steady movement.

```mermaid
stateDiagram-v2
    [*] --> queued: upload
    queued --> processing: worker claims rows
    processing --> completed: no rows left
    processing --> failed: unhandled exception
    processing --> paused: POST /pause
    paused --> queued: POST /resume (requeue)
    failed --> queued: POST /retry
    completed --> queued: POST /retry-failed (legacy requeue)
    completed --> completed: manual failed-row recovery
    queued --> cancelled: POST /cancel
    processing --> cancelled: POST /cancel
```

Row states: `queued -> processing -> imported | error`. The legacy `retry-failed` endpoint flips `error` rows back to `queued` and re-dispatches. The owner-facing failed-card flow now previews matches and moves confirmed rows directly from `error` to `imported`.

---

## Failed row recovery

Failed rows can be recovered without re-running the worker:

```mermaid
sequenceDiagram
    autonumber
    actor Owner
    participant FE as ImportRunDetailsPage
    participant Ctl as StoreCsvImportController
    participant R as CatalogCardResolver
    participant IW as StoreInventoryWriter
    participant DB as PostgreSQL

    Owner->>FE: click Retry failed cards
    FE->>Ctl: POST /csv-imports/{id}/failed/preview
    Ctl->>R: local match by name/set/collector/rarity/finish
    Ctl->>SC: batch collection lookup by set + collector
    SC-->>Ctl: matched cards, upserted locally
    Ctl-->>FE: matched/unmatched rows
    FE->>Owner: confirmation modal
    Owner->>FE: finalize matched cards
    FE->>Ctl: POST /csv-imports/{id}/failed/manual-import
    loop each selected match
        Ctl->>IW: write(store, card, qty, condition, foil)
        Ctl->>DB: row.status = imported, error = null
    end
    Ctl->>DB: recompute job counters
    Ctl-->>FE: updated CsvImportJob
```

- `failed/preview` checks local cards first, then uses Scryfall's collection endpoint in 75-card batches by set + collector number. This avoids one HTTP search per failed row.
- The confirmation modal shows matched cards and rows that still need review. Finalize imports only the matched rows.
- `rows/{rowIndex}/manual-import` powers the one-row Resolve button from the failed table.
- Both manual import paths use the same `StoreInventoryWriter`, so recovered rows merge into existing inventory lines by `(store, card, condition, is_foil)`.

---

## Status polling & run details

```mermaid
flowchart LR
    subgraph FE["Frontend (TanStack Query polling)"]
        cur["CsvTab: GET /csv-imports/current<br/>refetch 3s while active"]
        det["ImportRunDetailsPage:<br/>GET /csv-imports/{id}?rowStatus=imported|error<br/>refetch 3s while active"]
        plat["PlatformStoreImportsPage:<br/>GET /csv-imports (refetch 5s)"]
    end
    cur & det & plat --> ctl["StoreCsvImportController<br/>show() / list() / current()"]
    ctl --> win["CsvImportRowRepository::findWindow()<br/>(offset/limit/status)"]
    ctl --> recent["CsvImportJobRepository::findRecentByStore(50)"]
    win --> db[("csv_import_rows SELECT window")]
    recent --> db2[("csv_import_jobs SELECT DESC 50")]
```

The detail page renders two windows: imported rows (paginated) and failed rows. It also exposes pause/resume/retry/cancel controls, per-row Resolve actions, and the batch Retry failed cards review modal. Polling switches off automatically once the job reaches a terminal state (`completed/failed/cancelled/paused`).

---

## Where to go

| Concern | File |
|---------|------|
| HTTP endpoints | `Controller/StoreCsvImportController.php` |
| CSV parsing & header aliases | `Service/CsvImport/CsvImportParser.php` |
| Async message + handler | `Message/ProcessCsvImportMessage.php`, `MessageHandler/ProcessCsvImportMessageHandler.php` |
| Row claiming / counters | `Repository/CsvImportRowRepository.php` (`claimNextQueued`, `countByStatus`, `findWindow`, `retryFailedRows`) |
| Job persistence | `Repository/CsvImportJobRepository.php`, `Entity/CsvImportJob.php`, `Entity/CsvImportRow.php` |
| Card resolution | `Service/Catalog/CatalogCardResolver.php` (see [catalog-and-inventory.md](catalog-and-inventory.md#card-resolution-cascade)) |
| Inventory write | `Service/Inventory/StoreInventoryWriter.php` |
| Transport config | `config/packages/messenger.yaml` |
| Frontend | `pages/store-admin/CsvTab.tsx`, `ImportRunDetailsPage.tsx`, `csv-shared.tsx`, `pages/PlatformStoreImportsPage.tsx` |
| DB tables | `csv_import_jobs`, `csv_import_rows`, `messenger_messages`, `inventory_items`, `cards` |
