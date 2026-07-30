# Step 2 — PWA Architecture Proposal
*Based on Step 1 analysis + decisions confirmed by Adeniyi 2026-07-30*

**Decisions locked:**
1. Monorepo: Turborepo — `apps/` + `packages/`
2. WebAuthn RP ID: `zivabi.com` (shared parent domain)
3. Service worker: `@ducanh2912/next-pwa`
4. Vendor auth: magic-link per invoice; full vendor portal deferred
5. httpOnly cookie: included in this architecture (not deferred)
6. First new backend endpoint: unified approvals inbox (`GET /api/approvals/inbox`)

---

## 1. Turborepo Folder Structure

```
ziva-bi/                              ← monorepo root (same git repo)
├── apps/
│   ├── ziva-bi/                      ← existing desktop app (git mv from frontend/)
│   ├── ziva-expense/                 ← new PWA
│   ├── ziva-approve/                 ← new PWA
│   ├── ziva-procure/                 ← new PWA
│   └── ziva-insights/               ← new PWA
├── packages/
│   ├── api-client/                   ← apiFetch, AuthContext, WebAuthn hooks, Push hooks
│   ├── ui/                           ← shared ShadCN components (Button, PageContainer, etc.)
│   ├── types/                        ← shared TypeScript types (API responses, User, etc.)
│   └── pwa-config/                   ← shared next-pwa config factory + VAPID public key
├── backend/                          ← unchanged; FastAPI stays at root level
├── docs/
├── turbo.json                        ← pipeline: build → lint → type-check
├── package.json                      ← workspaces: ["apps/*", "packages/*"]
└── render.yaml                       ← extended to 6 services (was 2)
```

### Migration path for existing `frontend/`
`git mv frontend apps/ziva-bi` preserves full git history. The Dockerfile, `.env.example`,
and `next.config.ts` stay inside `apps/ziva-bi/` — no content changes, only location changes.
The existing 73+ pages, components, and API routes are untouched in this step.

---

## 2. Shared Packages Design

### `packages/api-client`
Single source of truth for all backend communication. All 5 apps import from here — no duplicated API logic.

**Contents:**
- `apiFetch()` — extracted from `frontend/src/lib/api.ts`. Handles Bearer token injection, 401 refresh retry, error normalisation.
- `AuthContext` + `useAuth()` — extracted from `frontend/src/contexts/AuthContext.tsx`. Extended with httpOnly cookie path (see §5).
- `useWebAuthn()` hook — registration and authentication ceremony client logic.
- `usePushSubscription()` hook — VAPID subscribe/unsubscribe.
- All API call wrappers (typed `getExpenseReports()`, `getApprovalInbox()`, etc.).

### `packages/ui`
Shared React component library. All 5 apps import from here.

**Contents:**
- Current shared components lifted from `apps/ziva-bi/src/components/`:
  `Button`, `PageContainer`, `PageHeading`, `Banner`, `IceSuggestionBadge`, loading skeletons, modal backdrops.
- New PWA-specific components added here as they are built:
  `BiometricLoginButton`, `InstallPromptBanner`, `OfflineBanner`, `PushPermissionPrompt`.
- TailwindCSS config shared via `packages/ui/tailwind.config.ts` — each app extends it.
- ShadCN components live in `packages/ui` rather than in each app independently.

### `packages/types`
TypeScript-only package. Zero runtime code, zero dependencies.

**Contents:**
- All API response types mirroring backend Pydantic schemas.
- `CurrentUser`, `Tenant`, `TenantModule`, `ApprovalInboxItem` (new unified type).
- WebAuthn ceremony request/response types.
- Push subscription types.

### `packages/pwa-config`
Exports a factory function `createPwaConfig(appOptions)` that returns the fully configured `@ducanh2912/next-pwa` plugin. Each app's `next.config.ts` calls it with app-specific options.

**Contents:**
- `createPwaConfig({ dest, runtimeCaching, fallbackRoutes })` factory.
- `VAPID_PUBLIC_KEY` constant (same key for all apps — single keypair).
- Shared runtime caching strategies (API calls: network-first; static: cache-first).

---

## 3. WebAuthn Implementation Plan

### 3a. Env-aware RP ID (requirement added 2026-07-30)
`rpId` must be environment-aware — hardcoding `"zivabi.com"` in dev breaks WebAuthn on localhost.

```
ENVIRONMENT=production  →  rpId = "zivabi.com"
ENVIRONMENT=development →  rpId = "localhost"
```

`webauthn_service.py` reads `settings.ENVIRONMENT` (already exists in `backend/app/config.py`) and sets `rp_id` at runtime. `backend/app/config.py` gains `WEBAUTHN_RP_ID` as a computed property — no new env var needed, derived from `ENVIRONMENT`.

### 3c. Backend — new files

**Migration** (new unique ID, chains from `p9q0r1s2t3u4` — ICE):
- Table: `user_credentials`
  | Column | Type | Notes |
  |---|---|---|
  | `id` | UUID PK | |
  | `user_id` | UUID FK → users | CASCADE DELETE |
  | `credential_id` | TEXT UNIQUE | WebAuthn credential identifier (base64url) |
  | `public_key` | BYTEA | COSE-encoded public key from device |
  | `sign_count` | INT | Monotonically increasing; replay attack guard |
  | `device_name` | TEXT | e.g. "iPhone 15 Pro" — user-visible label |
  | `aaguid` | TEXT | Authenticator type (Touch ID, Face ID, etc.) |
  | `created_at` | TIMESTAMP | |
  | `last_used_at` | TIMESTAMP | Updated on every successful auth |

- Table: `push_subscriptions` (bundled in same migration — both are new auth infra)
  | Column | Type | Notes |
  |---|---|---|
  | `id` | UUID PK | |
  | `user_id` | UUID FK → users | CASCADE DELETE |
  | `endpoint` | TEXT | Browser-issued push endpoint URL |
  | `p256dh` | TEXT | Encryption key |
  | `auth` | TEXT | Auth secret |
  | `app_name` | TEXT | 'ziva-expense', 'ziva-approve', etc. |
  | `created_at` | TIMESTAMP | |
  | `last_used_at` | TIMESTAMP | |

**New backend files:**
- `backend/app/models/webauthn.py` — `UserCredential`, `PushSubscription` ORM models
- `backend/app/schemas/webauthn.py` — ceremony request/response Pydantic schemas
- `backend/app/services/webauthn_service.py` — wraps `py_webauthn`; challenge generation, registration verification, authentication verification
- `backend/app/routers/webauthn.py` — 4 endpoints:
  - `POST /api/auth/webauthn/register/begin` — generates challenge; stores in server-side session
  - `POST /api/auth/webauthn/register/complete` — verifies attestation; inserts `user_credentials` row
  - `POST /api/auth/webauthn/authenticate/begin` — generates challenge; looks up credentials by user
  - `POST /api/auth/webauthn/authenticate/complete` — verifies assertion; checks sign_count; issues JWT
- `backend/app/services/push_service.py` — wraps `pywebpush`; `send_push(user_id, app_name, title, body, data)` function
- `backend/app/routers/push.py` — 3 endpoints:
  - `GET /api/push/vapid-public-key` — serves VAPID public key to frontend (unauthenticated)
  - `POST /api/push/subscribe` — saves/updates push subscription
  - `DELETE /api/push/subscribe` — removes push subscription

**Changes to existing files:**
- `backend/requirements.txt` — add `py_webauthn`, `pywebpush`
- `backend/app/main.py` — register `webauthn_router`, `push_router`
- `backend/app/config.py` — add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_MAILTO` env vars

### 3g. WebAuthn RP configuration
- `rpId`: `"zivabi.com"` — single enrollment, works across all 5 apps
- `rpName`: `"Ziva BI"`
- `expectedOrigins`: per-request origin validation against the calling app's origin (`expense.zivabi.com`, `approve.zivabi.com`, etc.) — `py_webauthn` supports a list of expected origins
- Challenge storage: server-side in-memory cache (Redis later; `{}` dict for now keyed by `user_id`) — 5-minute TTL, single-use

### 3d. Manage Devices screen (requirement added 2026-07-30)
Required for lost-phone recovery. Added to Phase 6 scope.

Each PWA app must include a **Manage Devices** page (`/settings/devices`) where the authenticated user can:
- See all registered biometric credentials: device name, registration date, last used date
- Remove individual credentials (calls `DELETE /api/auth/webauthn/credentials/{credential_id}`)
- One new backend endpoint: `DELETE /api/auth/webauthn/credentials/{credential_id}` — scoped to `current_user.user_id` (users can only delete their own credentials)
- Plus `GET /api/auth/webauthn/credentials` — lists the user's registered devices

### 3e. Frontend — `packages/api-client`
- `useWebAuthn()` hook:
  - `register()` — calls begin → `navigator.credentials.create()` → calls complete → stores `credentialId` in localStorage
  - `authenticate()` — calls begin → `navigator.credentials.get()` → calls complete → receives JWT
  - `isSupported()` — returns `!!window.PublicKeyCredential`
- Credential ID stored in `localStorage` key `ziva_cred_id` — used to know whether to offer biometric login on app open
- `BiometricLoginButton` in `packages/ui` — conditionally rendered only when `isSupported()` and `localStorage` has a stored credential ID

---

## 4. PWA Manifest + Service Worker Plan

### Per-app manifest

| App | `name` | `short_name` | `theme_color` | `start_url` | `display` |
|---|---|---|---|---|---|
| ziva-bi | Ziva BI | Ziva BI | `#1a1a2e` | `/` | `browser` (desktop — NOT a PWA) |
| ziva-expense | Ziva Expense | Expense | `#4f46e5` | `/` | `standalone` |
| ziva-approve | Ziva Approve | Approve | `#0ea5e9` | `/inbox` | `standalone` |
| ziva-procure | Ziva Procure | Procure | `#10b981` | `/` | `standalone` |
| ziva-insights | Ziva Insights | Insights | `#f59e0b` | `/` | `standalone` |

Each PWA needs: icons at 192×192 and 512×512, a maskable icon variant, and `apple-touch-icon` (iOS home screen).

**Note:** `ziva-bi` (the desktop app) does NOT get PWA configuration — it stays as a conventional web app. `@ducanh2912/next-pwa` is not added to it.

### Service worker capabilities per app

| Capability | Expense | Approve | Procure | Insights |
|---|---|---|---|---|
| App shell caching (static) | ✅ | ✅ | ✅ | ✅ |
| Offline fallback page | ✅ | ✅ | ✅ | ✅ |
| Push notification handling | ✅ | ✅ | ✅ | ✅ |
| Background sync (offline queue) | ✅ | ❌ | ✅ | ❌ |
| API runtime caching (network-first) | ✅ | ✅ | ✅ | ✅ |

**Background sync scope:** Only Ziva Expense (expense submission) and Ziva Procure (requisition/GRN) can meaningfully queue offline actions. Approvals must not be queued offline — approving a stale item is a financial control risk. Insights is read-only.

### `@ducanh2912/next-pwa` integration
Each PWA's `next.config.ts` calls `createPwaConfig()` from `packages/pwa-config`.
The service worker is auto-generated at build time into `public/sw.js`.
Push event handling (`push`, `notificationclick`) lives in a custom service worker file
that `@ducanh2912/next-pwa` merges with the generated file via its `customWorkerSrc` option.

### iOS install prompt
iOS 16.4+ requires the app to be installed before Web Push works.
Each PWA's root layout detects:
1. `window.navigator.standalone === false` (not yet installed on iOS)
2. `userAgent` includes `iPhone` or `iPad`
3. Push permission not yet granted

If all three are true — show `InstallPromptBanner` (a dismissible bottom sheet):
"Add Ziva to your Home Screen to receive notifications."
Push opt-in is only offered AFTER install is detected (`window.navigator.standalone === true`).

---

## 5. httpOnly Cookie Migration Plan

### Problem
Refresh tokens currently in `localStorage` are accessible to any JavaScript on the page — XSS-vulnerable. For installed PWAs, this is a real attack surface.

### Solution: FastAPI sets `Set-Cookie` directly
FastAPI's `/api/auth/login` (and `/api/auth/refresh-token`) response will include a `Set-Cookie` header alongside the JSON body.

**Cookie attributes:**
```
Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Domain=.zivabi.com; Max-Age=2592000
```

- `HttpOnly` — JavaScript cannot read it
- `Secure` — HTTPS only
- `SameSite=Lax` — sent on same-site navigations; safe from CSRF for subdomains of `zivabi.com`
- `Domain=.zivabi.com` — cookie is shared across all 5 app subdomains (expense, approve, etc.) AND `api.zivabi.com`
- `Path=/api/auth` — scoped only to auth endpoints; not sent on every API request

**CORS changes needed:**
- FastAPI `CORSMiddleware`: add `allow_credentials=True`
- All 5 frontend apps: `apiFetch()` → `credentials: 'include'` on auth calls only
- `ALLOWED_ORIGINS` in Render env: add all 5 production domains

**What changes in the frontend:**
- `AuthContext.tsx`: on login, stop writing `refreshToken` to `localStorage`; let the cookie do the job
- `/api/auth/refresh-token` call: still made by `AuthContext` on page load, but the cookie is sent automatically by the browser (no need to read/inject it in JS)
- `localStorage` usage drops to: user object (non-sensitive), `ziva_cred_id` (WebAuthn credential ID, also non-sensitive)

**What stays the same:**
- Access token remains in React memory (not in localStorage, not in cookie) — correct and unchanged
- `Authorization: Bearer <access_token>` header on all API calls — unchanged
- Refresh logic in `AuthContext` — unchanged, just the token source changes

**Migration path (no flag day):**
1. Backend emits BOTH the cookie AND the JSON body `refresh_token` field during a transition period
2. Frontend updated to ignore the JSON field and rely on the cookie
3. Once all apps are deployed, remove the JSON field from the login response
4. `localStorage` `refreshToken` key cleaned up on next login (write-then-delete)

---

## 6. Push Notification Infrastructure

### VAPID keypair
Generated once via `pywebpush` CLI. Stored as Render env vars:
- `VAPID_PRIVATE_KEY` — backend only, never exposed
- `VAPID_PUBLIC_KEY` — also set as `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in all 5 frontend apps

### Push flow
```
1. PWA frontend: navigator.serviceWorker.ready → pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })
2. Frontend → POST /api/push/subscribe { endpoint, p256dh, auth, app_name }
3. Backend stores in push_subscriptions table

When a trigger event fires:
4. Backend service calls push_service.send_push(user_id, app_name, title, body, data)
5. push_service queries push_subscriptions WHERE user_id + app_name
6. pywebpush sends encrypted POST to each endpoint
7. Browser receives → service worker 'push' event fires → showNotification()
8. User taps notification → service worker 'notificationclick' → clients.openWindow(data.url)
```

### Push triggers (which service sends them)

| Trigger | Sender | Target app |
|---|---|---|
| Expense approved / rejected | `approval_service.py` (after status update) | ziva-expense |
| New item pending approval | Approval creation in expense/AP/PO/AR routers | ziva-approve |
| PO status change | `po.py` router | ziva-procure |
| Payment request status change | `ap.py` router | ziva-procure |
| Budget threshold exceeded (≥90%) | `budget_service.py` (on variance query) | ziva-insights |
| AI exception alert | `ai_intelligence.py` | ziva-insights |

Push is fire-and-forget in the sender — errors are logged but never block the main transaction.

---

## 7. Build and Deployment Approach

### Turborepo pipeline (`turbo.json`)
```
build   → depends on ^build  (packages build before apps)
lint    → depends on ^lint
type-check → depends on ^build
```
Each app and package declares its own build script. `turbo build --filter=ziva-expense` builds only `ziva-expense` and its dependencies.

### Docker — per-app builds
Each PWA app gets its own `Dockerfile` (copied from the current `apps/ziva-bi/Dockerfile`).
Turborepo's `turbo prune --scope=<app> --docker` generates a minimal build context containing only that app and its package dependencies — keeps image sizes small.

### Render — service expansion

| Service | Root directory | Build command | Domain |
|---|---|---|---|
| `ziva-bi` (existing) | `apps/ziva-bi` | `turbo build --filter=ziva-bi` | `app.zivabi.com` |
| `ziva-expense` (new) | `apps/ziva-expense` | `turbo build --filter=ziva-expense` | `expense.zivabi.com` |
| `ziva-approve` (new) | `apps/ziva-approve` | `turbo build --filter=ziva-approve` | `approve.zivabi.com` |
| `ziva-procure` (new) | `apps/ziva-procure` | `turbo build --filter=ziva-procure` | `procure.zivabi.com` |
| `ziva-insights` (new) | `apps/ziva-insights` | `turbo build --filter=ziva-insights` | `insights.zivabi.com` |
| `backend` (existing) | `backend` | unchanged | `api.zivabi.com` |

**`render.yaml`** gains 4 new `type: web` service blocks, each with its own `buildCommand`, `startCommand`, and `envVars`.

### CORS update (configuration, no code change)
Add to Render backend env `ALLOWED_ORIGINS`:
`https://app.zivabi.com,https://expense.zivabi.com,https://approve.zivabi.com,https://procure.zivabi.com,https://insights.zivabi.com`

---

## 8. SA Portal & Desktop Mobile Accessibility

### SA Portal
No 6th PWA. The SA portal stays inside `apps/ziva-bi`. Instead, a **SA mobile responsiveness pass** is added as a Phase 8+ item targeting the pages Adeniyi needs on his phone:
- Tenant list + tenant detail
- Lifecycle actions (suspend, activate, promote)
- Signups lead management page

Complex SA config (consultant panel, billing, nuke) stays desktop-only by design.

### Ziva BI Desktop — Mobile Accessibility
The desktop app is not being rebuilt mobile-first, but a **mobile accessibility pass** is added as a Phase 8+ item for:
- Login page and auth flows
- Dashboard overview
- Key report views (P&L, Balance Sheet, Budget vs Actual)
- Sidebar → hamburger menu on mobile viewport

Pages that are inherently desktop-bound (GL config, dimension setup, CoA management, approval matrix builder, financial statement templates) are excluded — these match industry practice in SAP, Oracle, and Dynamics X3.

---

## 10. Implementation Order

This sequence minimises risk by building infrastructure before features, and ensures each PR is independently reviewable.

| Phase | What | Why first |
|---|---|---|
| **Phase 1** | Turborepo restructure — `git mv frontend → apps/ziva-bi`, root `package.json` + `turbo.json`, `packages/` stubs, update `render.yaml` | Nothing else can start without this |
| **Phase 2** | httpOnly cookie migration — backend emits `Set-Cookie`; `AuthContext` stops using localStorage for refresh token | Security foundation; needed by all apps before they can auth |
| **Phase 3** | WebAuthn + Push backend — migration, models, services, routers, `requirements.txt` | Auth tables needed before any PWA skeleton is built |
| **Phase 4** | Unified approvals inbox — `GET /api/approvals/inbox` | Ziva Approve's core feature; agreed as first new endpoint |
| **Phase 5** | Skeleton PWA apps — manifest, service worker, offline page, auth flow; shared code extracted into packages at this point | Proves infra works end-to-end before feature content |
| **Phase 6** | WebAuthn frontend — `useWebAuthn()` hook + `BiometricLoginButton` wired into all 4 PWA skeletons | Biometric login working on all apps |
| **Phase 7** | Push infrastructure — service worker push handler, subscription flow, VAPID setup | Needed before per-app features |
| **Phase 8** | Ziva Expense feature pages | Largest employee base — highest impact first |
| **Phase 9** | Ziva Approve feature pages | |
| **Phase 10** | Ziva Procure feature pages | |
| **Phase 11** | Ziva Insights feature pages | |
| **Phase 12** | SA portal mobile responsiveness pass (within `apps/ziva-bi`) | |
| **Phase 13** | Ziva BI desktop mobile accessibility pass (sidebar hamburger, dashboards, key reports) | |

---

## 11. Open Items (not blocking architecture approval)

> **Icon/brand assets (added 2026-07-30):** Placeholder SVG icons in brand colours are generated programmatically in Phase 5 and embedded as `public/icon-192.png` and `public/icon-512.png` in each PWA. Colour map: Expense `#4f46e5` (indigo), Approve `#0ea5e9` (sky), Procure `#10b981` (emerald), Insights `#f59e0b` (amber). Replace with final designer assets later — the manifest `icons` array paths stay the same so no code change is needed at swap time.


| Item | Decision needed when |
|---|---|
| Purchase requisition workflow design | Before building Ziva Procure Phase 8 |
| Approver delegation / leave cover | Before building Ziva Approve Phase 8 |
| Budget monitoring service design (threshold alerts) | Before Ziva Insights Phase 8 |
| Offline queue conflict resolution strategy | Before Ziva Expense background sync |
| Icon/brand assets for 4 new apps | Before Phase 5 |

---

*End of Step 2 proposal. Awaiting approval to proceed to implementation.*
