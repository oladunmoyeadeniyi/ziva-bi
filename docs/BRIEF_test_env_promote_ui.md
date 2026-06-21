Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Phase 2: Super Admin UI for create-test-environment + promote

**Context:** Two real, working backend endpoints have zero UI: `POST /api/tenant/create-test-environment` (creates a live tenant's test shadow) and `POST /api/tenant/promote` (copies org_config/tax/fx from test→live; CoA/dimensions/periods deferred — Phase 3). Both currently require manual API calls. Surface them on the Super Admin tenant detail page, guarded to Super Admin only (matches existing backend guards).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/tenant.py` — `create-test-environment` (~line 150) and `promote` (~line 259) full implementations: exact request/response schemas (`PromoteRequest{sections}`, `PromoteResponse{promoted, deferred, message}`), guard conditions (who can call, which tenant state required — e.g. promote requires caller to be ON the test tenant, not live), and `_DEFERRED_SECTIONS`.
- `frontend/src/app/platform/tenants/[id]/page.tsx` — the full current page: existing buttons (Enter tenant/live/test, lifecycle dropdown, suspend/reactivate), how `TestEnvSummary` (mentioned in the diagnosis as populated when a live tenant has a test shadow) is already returned/displayed if at all, and the API client pattern used for other actions on this page (so new calls match style).
- Confirm the exact tenant detail response shape — does it already tell the frontend whether a test shadow exists (`test_environment` field mentioned in diagnosis)? Report its shape.
- Confirm how Super Admin authenticates calls to `/api/tenant/...` endpoints from the PLATFORM context (these endpoints are tenant-router endpoints, normally called by tenant users — confirm how Super Admin calls them on a tenant's behalf, e.g. via impersonation token, or whether a platform-level wrapper is needed). This is important — report clearly whether a NEW platform-level proxy endpoint is needed, or whether the existing tenant endpoints work directly from the Super Admin's impersonation session.
Report findings before editing.

---

## Build

### A. "Create test environment" button
On the tenant detail page, for a LIVE tenant (`environment="live"`) with NO existing test shadow:
- Show a "Create test environment" button/card explaining what it does (creates a sandbox copy of this tenant's config + mirrors user access, for implementation rehearsal).
- On click: calls `create-test-environment` (via whatever auth path STEP 0 determined is correct). On success, refresh the tenant detail so the test-shadow info now shows (and the existing "Enter test (edit)" button, if not already conditionally shown, appears).
- If a test shadow already exists, instead show its summary (created date, user count) — no duplicate-create button (the backend is idempotent but the UI shouldn't invite redundant calls).

### B. "Promote config" button + confirmation dialog
For a tenant that HAS a test shadow:
- Show a "Promote configuration to live" button.
- On click, open a confirmation dialog that explicitly lists:
  - **Will be promoted:** Organisation config, Tax config, FX config (the 3 implemented sections) — with a one-line description of each.
  - **NOT included (deferred):** Chart of Accounts, Dimensions, Periods — with a short note why (these require careful ID remapping and are handled separately/manually for now).
  - A clear "this will overwrite the live tenant's org/tax/fx configuration" warning.
  - Checkboxes per section (org_config/tax/fx) defaulting to checked, OR a single "promote all 3" if per-section selection adds complexity you'd rather avoid — your call, state which (the backend already accepts a `sections` list, so per-section checkboxes are a natural fit if not much extra work).
  - Confirm / Cancel.
- On confirm: call `promote` with the selected sections. Show the response (`promoted`, `deferred`, `message`) clearly — e.g. a success toast/banner listing what was promoted and reminding what's still deferred.
- Guard: only render this entire section for Super Admin (matches backend `is_super_admin` requirement — no change needed there, just don't show it to anyone else in the UI).

### C. Layout
Place both under a clear "Test Environment" section on the tenant detail page, near the existing Enter-tenant buttons (logical grouping). Keep visual style consistent with the rest of the page.

---

## Files CC may modify
- `frontend/src/app/platform/tenants/[id]/page.tsx` (primary).
- A new small confirmation-dialog component if one doesn't already exist for similar use elsewhere — check first, reuse if possible.
- ONLY if STEP 0 determines a platform-level proxy endpoint is genuinely needed (Super Admin can't call the tenant endpoints directly): a new minimal backend endpoint that forwards to the existing logic, guarded `is_super_admin`. State clearly if this was needed and why.

Do NOT: touch the backend create-test-environment/promote logic itself (it works), the deferred-sections list, enter_tenant logic, lifecycle PATCH, go-live (Phase 1, done). No migration expected.

---

## House rules
- Super Admin only — both visually and respecting existing backend guards.
- Promote confirmation dialog must explicitly show promoted vs deferred sections before any action.
- Idempotent create — no duplicate-shadow UI invitation once one exists.
- type-check 0 errors.

---

## Acceptance / test steps (state pass/fail each)
1. On a live tenant with no test shadow: "Create test environment" button visible; clicking it creates the shadow (verify via DB or the page refreshing to show it).
2. On a live tenant WITH a test shadow: create button replaced by shadow summary; no duplicate-create option shown.
3. "Promote configuration" button visible only when a test shadow exists; opens a dialog listing org_config/tax/fx as promoted and CoA/dimensions/periods as deferred, with a clear overwrite warning.
4. Confirming promote calls the real endpoint; response (promoted/deferred/message) surfaced to the user.
5. Neither button visible to a non-super-admin viewing the page (if reachable at all by them — confirm route guard).
6. type-check 0 errors; no backend logic changes unless STEP 0 proved a proxy endpoint was required (state clearly either way).

---

## Completion summary required
List every file changed/created. State: STEP 0 findings on how Super Admin calls tenant-router endpoints (proxy needed or not, and why); the exact UI flow for both actions; the confirmation dialog's exact promoted/deferred content; per-section checkboxes vs single action (and why); confirm Super-Admin-only gating; confirm backend untouched (or what minimal proxy was added and why). Report acceptance pass/fail.
