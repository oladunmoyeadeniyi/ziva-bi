# Diagnosis — Bank Accounts "Failed to fetch" on Update
**Date:** 2026-06-20

---

## Routes the bank-accounts page calls

| Action | Method | Route | Called from |
|---|---|---|---|
| Page load — accounts list | GET | `/api/setup/bank-accounts` | `load()` via `apiFetch` |
| Page load — GL picker data | GET | `/api/config/coa?active_only=true&limit=10000` | `load()` via `apiFetch` |
| Page load — currency dropdown | GET | `/api/setup/currencies` | `load()` via `apiFetch` |
| Click Update (edit form) | PUT | `/api/setup/bank-accounts/{id}` | `saveForm()` via `apiFetch` |
| Toggle active | PUT | `/api/setup/bank-accounts/{id}` | `toggleActive()` via `apiFetch` |
| Delete | DELETE | `/api/setup/bank-accounts/{id}` | `deleteAccount()` via `apiFetch` |

All calls go through `apiFetch` in `src/lib/api.ts`, which constructs the full URL as `http://localhost:8000{path}` using `NEXT_PUBLIC_API_URL`.

---

## HTTP status — live server (port 8000)

| Request | HTTP Status | Body / Notes |
|---|---|---|
| `GET /api/setup/bank-accounts` | **200** | Returns 2 accounts (NGN + EUR) |
| `PUT /api/setup/bank-accounts/e891c569-aa50-4e10-83bf-ba71b6c884cc` | **200** | Returns updated account JSON |

Both confirmed via:
1. Direct PowerShell request to the live uvicorn on port 8000 with a valid token
2. Full ASGI stack test through the imported `app` object
3. Full PUT-then-load() sequence (4 requests) — all 200

No backend traceback: the PUT handler raises no exception. The response serialises and returns correctly.

---

## Detailed PUT response (confirmed working)

**Request body sent:**
```json
{
  "bank_name": "Standard Charter Bank",
  "account_name": "Red Bull Nigeria Limited - NGN",
  "account_number": "0005334186",
  "currency": "NGN",
  "gl_account_id": "a569f55c-dd69-45bd-b64d-3bc4f47a7f0a",
  "is_default": true
}
```

**Response (200):**
```json
{
  "id": "e891c569-aa50-4e10-83bf-ba71b6c884cc",
  "bank_name": "Standard Charter Bank",
  "account_name": "Red Bull Nigeria Limited - NGN",
  "account_number": "0005334186",
  "currency": "NGN",
  "gl_account_id": "a569f55c-dd69-45bd-b64d-3bc4f47a7f0a",
  "gl_number": "280000",
  "gl_name": "Bank deposits (NGN)",
  "gl_account_type": "SOFP",
  "is_default": true,
  "is_active": true,
  ...
}
```

**`BankAccountUpdate` schema** (`schemas/bank_account.py`): all fields optional, `gl_account_id: Optional[UUID]` — Pydantic accepts UUID strings. No issues.

**`get_db` dependency** (`database.py:81`): calls `await session.commit()` automatically after the handler returns. No missing commit in the router.

**Live uvicorn code version:** confirmed running **new code** — OpenAPI schema contains `enabled_currencies` (our currency consolidation changes). The bank_accounts router is correctly registered at `main.py:177`.

---

## CORS preflight for PUT

```
OPTIONS /api/setup/bank-accounts/{id}
Origin: http://localhost:3000
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: authorization,content-type

→ HTTP 200
  Access-Control-Allow-Origin:      http://localhost:3000
  Access-Control-Allow-Methods:     DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT
  Access-Control-Allow-Headers:     authorization,content-type
  Access-Control-Allow-Credentials: true
  Access-Control-Max-Age:           600
```

PUT is explicitly listed. Credentials allowed. Origin matches. Headers match. **Preflight is valid.**

---

## Source of "Failed to fetch"

`"Failed to fetch"` is a browser `TypeError` thrown by the native `fetch()` API when the HTTP layer itself fails — before any HTTP response is received. It is NOT a 4xx or 5xx error; those produce `Error("Request failed (500)")` or `Error("Invalid or expired token.")` from `apiFetch`.

Since the backend returns 200 and CORS is correct, the error originates in the browser environment. All server-side reproduction attempts return 200.

---

## What the browser does differently — key finding

**`frontend/next.config.ts`** contains:

```typescript
async rewrites() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return [
    {
      source: "/api/:path*",
      destination: `${apiUrl}/api/:path*`,
    },
  ];
},
```

This rewrite proxies requests to `/api/*` through the Next.js dev server to the backend. It is intended for production deployments where the frontend and backend are on different origins.

**In local dev**, `apiFetch` in `api.ts` constructs **absolute URLs** (`http://localhost:8000/api/...`), which bypass Next.js rewrites entirely — the browser sends the request directly to port 8000. This is why GET works fine.

However: if `NEXT_PUBLIC_API_URL` is an **empty string** `""` in the browser bundle (e.g. the dev server was started before `.env.local` was created, or the env var was not correctly loaded), then:
- `BASE = "" ` (`??` does not catch empty string; only catches `null`/`undefined`)
- URL becomes `/api/setup/bank-accounts/...` (relative path)
- Browser sends request to `http://localhost:3000/api/setup/bank-accounts/...`
- Next.js rewrite proxy intercepts and forwards to `http://localhost:8000/api/setup/bank-accounts/...`

For **GET** requests, this proxy path works fine. For **PUT** requests with a JSON body, **Next.js's rewrite proxy in dev mode does not reliably forward the request body**, causing the PUT to arrive at the backend with an empty body. The backend then returns a validation error or drops the connection, and the browser sees `TypeError: Failed to fetch`.

**Confirming the env var:**
```
frontend/.env.local → NEXT_PUBLIC_API_URL=http://localhost:8000
```
This is correctly set. If the Next.js dev server picked up this file at startup, `BASE = "http://localhost:8000"` and all calls are absolute-URL direct. **But if the dev server was started with the env var unset and the `.env.local` was added later, a restart is required.**

---

## Summary of findings

| Check | Result |
|---|---|
| `GET /api/setup/bank-accounts` — HTTP status | **200** |
| `PUT /api/setup/bank-accounts/{id}` — HTTP status | **200** |
| CORS preflight (OPTIONS) for PUT | **200**, PUT in allowed methods |
| Backend traceback on PUT | **None** — handler completes without exception |
| `BankAccountUpdate` schema | Valid — all fields optional, UUID string accepted |
| `get_db` commit | Auto-committed by dependency after handler returns |
| Live uvicorn code version | New code (enabled_currencies in openapi schema) |
| `NEXT_PUBLIC_API_URL` in `.env.local` | `http://localhost:8000` — correctly set |
| `next.config.ts` rewrite | `/api/*` → backend — **bypassed when env var is set and absolute URL is used; active if env var is empty** |
| "Failed to fetch" reproducible from server side | **No** — all tests return 200 |

---

## Probable cause

The `NEXT_PUBLIC_API_URL` env var was not picked up by the Next.js dev server (server started before `.env.local` was present, or `.env.local` was created mid-session). This causes `BASE = ""` in the browser bundle, making `apiFetch` send relative-path requests that flow through the Next.js rewrite proxy. The proxy does not forward the PUT request body, causing the backend to reject or drop the connection, and the browser sees `TypeError: Failed to fetch`.

## Fix

Restart the Next.js dev server (`npm run dev`) from the `frontend/` directory with `.env.local` in place, so `NEXT_PUBLIC_API_URL=http://localhost:8000` is baked into the client bundle. After restart, `apiFetch` will use absolute URLs again and all PUT/POST/DELETE calls will reach the backend directly.
