# Brief — Phase 1a: Wire role_tier to accounts + make _require_admin tier-aware

**Milestone:** Phase 1 (Foundation) — role model
**Scope:** Backend only. Small. Populates the existing-but-null `role_tier`, sets the current user to consultant, makes the central admin guard tier-aware, and confirms the consultant override path works end-to-end.
**Depends on:** nothing new. `role_tier` column, JWT carriage, and `CurrentUser.role_tier` all already exist — they're just null/under-used.

---

## STEP 0 — Read before changing anything (mandatory)

Read and report exact files + line ranges BEFORE editing:
- `backend/app/middleware/auth.py` — `CurrentUser` (has `role_tier`, `is_tenant_admin`, `is_super_admin`).
- `backend/app/routers/auth.py` — `_build_token_payload` (~line 130) and `login` (~340): confirm `role_tier=getattr(user_tenant, "role_tier", None)` is already included at login, refresh, signup. (It is — verify, don't add twice.)
- `backend/app/routers/setup.py` — `_require_admin` (~line 188; currently `is_tenant_admin or is_super_admin`), and every `role_tier == "consultant"` check (e.g. reopen ~1320).
- `backend/app/models/auth.py` — `UserTenant.role_tier` column (exists, nullable).

If anything conflicts with the real code, STOP and report.

---

## Context — what's actually broken

`role_tier` plumbing is complete: DB column → login reads it into JWT → `CurrentUser.role_tier`. But it's **null on every account**, so all consultant-gated behaviour (reopen, the planned checklist self-approve) is unreachable. This brief populates it. We are NOT retiring `is_tenant_admin` (that's a 25-site refactor for later) — we keep it and make the single `_require_admin` chokepoint tier-aware so tier and the legacy flag coexist.

The three tiers (on `UserTenant.role_tier`):
- `consultant` — implementer, full override (reopen, self-approve during implementation)
- `power_admin` — client senior admin (broad config)
- `functional_admin` — function-scoped admin

`is_super_admin` is a SEPARATE axis (Ziva owner) — do NOT touch it.

---

## CHANGES

### 1. Set the current user's tier (data)
- Set `role_tier = 'consultant'` for `adeniyi.oladunmoye@redbull.com` in `user_tenants`.
- Provide this as a **one-line, repeatable script** (`backend/scripts/set_role_tier.py` or a documented SQL one-liner) that takes an email + tier, so tiers can be assigned to other accounts later without ad-hoc DB edits. State the exact command to run.
- Do NOT bulk-set other accounts. Leave `adeniyioladunmoye@gmail.com` as-is unless instructed.

### 2. Make `_require_admin` tier-aware (one function)
- Current: `if not current_user.is_tenant_admin and not current_user.is_super_admin: raise 403`.
- New: also pass if `role_tier` is one of `consultant` or `power_admin`. So the guard accepts: `is_super_admin` OR `is_tenant_admin` OR `role_tier in (consultant, power_admin)`.
- This means a future power_admin/consultant who is NOT flagged `is_tenant_admin` still gets admin access. `functional_admin` does NOT pass `_require_admin` by default (it's function-scoped) — state this so it's intentional.
- One function change only. Do not touch the 25 call sites.

### 3. Confirm consultant checks fire (no logic change, just verify)
- The reopen endpoint (`role_tier != "consultant"` → 403) already exists. With the current user now consultant, verify reopen works for them.
- Leave any `# BRIEF-4`/checklist-override hooks as-is (the checklist self-approve is briefed separately in the polish brief — do NOT implement it here, just don't break the path).

### 4. (Optional, only if trivial) helper for tier checks
- If useful, add a small `require_consultant(current_user)` helper mirroring `_require_admin`, so future consultant-gated endpoints read cleanly. Skip if it adds noise. State your choice.

---

## Files CC may modify
- `backend/app/routers/setup.py` — `_require_admin` only (+ optional `require_consultant` helper).
- `backend/scripts/set_role_tier.py` (NEW, or a documented SQL command) — the repeatable tier-setter.
- NO migration (column exists). NO change to `auth.py` router/middleware (carriage already works). NO touching `is_super_admin`, CORS, `config.py`, `ziva_dev`, or the frontend.

If you believe a migration or any other file is needed, STOP and explain why.

---

## House rules
- Backend starts clean; manual uvicorn restart after the data change.
- After setting the tier, the user must **log out and back in** to get a fresh JWT carrying `role_tier: consultant` — state this explicitly in your summary as the required manual step.
- Smallest possible change. No refactor of `is_tenant_admin`.

---

## Acceptance / test steps (state pass/fail each)
1. The tier-setter script sets `role_tier='consultant'` for the redbull email; re-running it is safe (idempotent).
2. After re-login, decode/inspect confirms the JWT now carries `role_tier: "consultant"` for that user (or confirm via an endpoint that echoes it — e.g. the existing one at setup.py ~1202 that returns role_tier).
3. `_require_admin` still passes for the consultant user (admin pages work).
4. Reopen a hard-closed period as the consultant → succeeds (previously impossible with null tier).
5. A user with only `is_tenant_admin` (no tier) still passes `_require_admin` (legacy unbroken).
6. `functional_admin` (if you set a test one) does NOT pass `_require_admin` — confirm intended.

---

## Completion summary required
List every file changed. Give the exact command to set a tier for any email. Confirm: no migration needed; `is_tenant_admin` NOT retired (still works); `is_super_admin` untouched; the required log-out/log-in step for the JWT to refresh; reopen now works for the consultant; functional_admin intentionally excluded from `_require_admin`.
