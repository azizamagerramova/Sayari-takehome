# Transaction Simulator Info Guide

This document explains the additions I made to the codebase, how to run them, and how they fit into the existing architecture.

---

## What I built

**Goal:** add a standalone transaction generator and a small set of HTTP endpoints to create, bulk‑generate, and continuously generate mock transactions that flow through the same API path as real ones.

**Key additions:**

1. **Transaction simulator service** (`backend/services/transactionSimulatorService.ts`)
   - Generates realistic mock transactions and **POSTs** them to the existing API (`/api/transactions`) using `fetch`
   - Uses the same contract as the UI/clients
2. **New transactions routes** (in `backend/routes/transactions.ts`)
   - `POST /api/transactions/generate-mock-transactions` — one‑shot batch generation using provided number of transactions.
   - `POST /api/transactions/start-generating-mock-transactions` — starts a background interval to generate batches every _N_ seconds (defaults to 3 seconds) using provided number of transactions.
   - `POST /api/transactions/stop-generating-mock-transactions` — stops the interval.
   - Small tweaks: return codes and lightweight validation.

These additions were designed to be minimal, consistent with existing endpoints, and easy to reason about.

---

## Endpoints Overview

| Method | Path | Purpose | Request Body | Response |
| ------ | --------------------------------------------- | ---------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| **POST** | `/api/transactions/generate-mock-transactions` | **One-shot**: generate _N_ mock transactions (in parallel) | `{ numTransactions: number }` | `201 { success, data: Transaction[] }` |
| **POST** | `/api/transactions/start-generating-mock-transactions` | **Continuous**: every `RATE_SECONDS`, generate _N_ transactions | `{ numTransactions: number }` | `201 { success, message, intervalSeconds, numTransactions }` |
| **POST** | `/api/transactions/stop-generating-mock-transactions` | Stop continuous generation | – | `200 { success, message }` |

> **Note:** All endpoints return an object with `{ success, ... }


---

## How the simulator works

- **Input:** a positive integer `numTransactions`.
- **Business selection:** picks two distinct businesses from `businessService.getAllBusinesses()`.
- **Payload:**
  ```json
  {
    "from": "<business_id>",
    "to": "<business_id>",
    "amount": 10000,
    "timestamp": "ISO 8601"
  }
  ```
- **HTTP client:** native `fetch`. Reads `BACKEND_URL` or defaults to `http://localhost:3000/api/transactions`.
- **Batching:** one‑shot endpoint batches with `Promise.all` for speed. Continuous endpoint schedules batches using `setInterval`.

**Design choice:** the simulator calls the **HTTP API**, not the DB directly. This ensures we exercise the same validation/emit paths the app uses. It also avoids duplicating DB credentials in the simulator.

---

## Configuration

- **Env vars** (backend):
  - `BACKEND_URL` — simulator posts here (defaults to `http://localhost:3000/api/transactions`). When using Docker Compose, set to `http://backend:3000/api/transactions`.
- **Interval:** `RATE_SECONDS` is set in `routes/transactions.ts` (default `3`). Adjust as needed or make it request‑configurable.

---

## Run instructions (local)

1. **Start backend** (ensure `express.json()` is enabled before routes).
2. **Start Memgraph/SQLite** per the project’s `SETUP.md`.
3. **Generate once:**
   ```bash
   curl -X POST http://localhost:3000/api/transactions/generate-mock-transactions \
     -H 'Content-Type: application/json' \
     -d '{"numTransactions": 10}'
   ```
4. **Start continuous:**
   ```bash
   curl -X POST http://localhost:3000/api/transactions/start-generating-mock-transactions \
     -H 'Content-Type: application/json' \
     -d '{"numTransactions": 5}'
   ```
5. **Stop:**
   ```bash
   curl -X POST http://localhost:3000/api/transactions/stop-generating-mock-transactions
   ```

---

## Error handling & consistency notes

- **Single response rule:** every route returns exactly once; early `return` after `res.json(...)` to avoid `ERR_HTTP_HEADERS_SENT`.
- **Validation:** minimal coercion on `numTransactions` (`Number()` + positivity check). I intentionally kept validation lightweight to match the existing style.
- **Emits:** in `POST /api/transactions` I moved the Socket.IO emit to fire‑and‑forget (`emitGraphUpdate(...).catch(console.error)`) so the HTTP response isn’t blocked by client notifications. This mirrors how the generator runs background work.
- **Timers:** `intervalId` typed as `ReturnType<typeof setInterval>` and guarded before `clearInterval`.

---

## Data flow

1. Simulator builds a payload and `POST`s `/api/transactions`.
2. The transactions route delegates to `transactionService.createTransaction()` (DB write), then `enrichTransaction()` (for graph/UI), and finally triggers `emitGraphUpdate`.
3. Frontend listeners receive graph updates via Socket.IO.

---

## Concurrency conflicts (Memgraph) & retry policy

Memgraph uses optimistic concurrency. When many writes touch overlapping nodes/edges, it may abort one with an error like:

~Cannot resolve conflicting transactions. Retry this transaction when the conflicting transaction is finished.

To make creation robust under parallel load, the service wraps the DB write in a small retry with exponential backoff. Only conflicts (or other retryable signals) are retried; anything else fails fast. This keeps the API predictable while smoothing transient contention.

---

## Trade‑offs & alternatives

- **Idempotency:** intentionally skipped here (per task scope). If needed later, add `Idempotency-Key` support in the route + a uniqueness constraint or key table.
- **Throughput:** current approach uses `Promise.all` for batch speed. For very large `numTransactions`, consider chunking (e.g., 20 at a time) to protect the API.

---

## Testing ideas (not included but easy to add)

- Unit test `transactionSimulatorService.generateMockTransactions` by mocking `fetch`.
- Integration test the `POST /api/transactions` path with a test Memgraph and assert nodes/edges.
- A smoke test that starts the generator, waits ~2 ticks, and asserts DB counts increased.

---

## File map (new/modified)

- `backend/services/transactionSimulatorService.ts` — **new**. Generates and posts mock transactions.
- `backend/routes/transactions.ts` — **modified**. Added three endpoints and small consistency tweaks.

---

## Summary

The simulator and endpoints provide a clean, minimal way to seed and stress the system using the same API surface as real clients. The changes emphasize consistency (status codes, response shape), resilience (single response rule, guarded timers), and clarity (small, focused endpoints).
