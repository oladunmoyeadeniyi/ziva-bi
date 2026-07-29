Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Catalogue cleanup: remove bank/cash roles, add goods_in_transit, add per-tenant role relevance

**Scope:** Backend only. Small. Three changes to the posting-role catalogue: (1) remove `default_bank` + `cash` (they become a Bank Accounts register, separate brief), (2) add `goods_in_transit`, (3) add a per-tenant role-relevance (enable/hide) flag so tenants only see roles relevant to them. Reseed. No UI (the mapping UI already reads the catalogue; a small UI tweak for the relevance toggle is a later brief — backend only here).

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/account_mapping.py` — PostingRole (statement, group, subgroup, display_order, expected_account_type, is_control_account…), TenantAccountMapping, TenantPostingRoleSettings (the control-override table).
- The latest catalogue migration `c9d0e1f2g3h4_catalogue_redesign.py` — the NEW_CATALOGUE seed list + how it seeds, so the reseed follows the same approach.
- `backend/app/routers/account_mapping.py` — GET /roles (so the relevance flag can be exposed) + the control endpoint pattern (to mirror for a relevance endpoint).
- Search for any references to role keys `default_bank`, `cash` anywhere (router/service/module/test). Report. (Expense not wired yet → likely only seed + tests.)
Report findings before editing.

---

## Changes

### 1. Remove default_bank + cash from the catalogue
- Remove both roles from the seed. In the migration, also delete any `tenant_account_mappings` and `tenant_posting_role_settings` rows referencing them (report if any existed — likely the Red Bull `default_bank`/`cash` mappings shown in setup do exist, so clean them).
- Rationale (comment): bank/cash accounts move to a dedicated Bank Accounts register (multiple per currency) — they are accounts, not determination roles.

### 2. Add goods_in_transit
- New role: role_key `goods_in_transit`, label "Goods in Transit", statement BS, group current_assets, subgroup inventory, expected_account_type BS, is_control_account default false (state if you think it should be control — it's a clearing-ish inventory account; recommend control=false unless you justify), sensible display_order within inventory.

### 3. Per-tenant role relevance (enable/hide)
- Add to TenantPostingRoleSettings a nullable `is_relevant` (Boolean, nullable) — NULL = use default (relevant/shown); False = tenant has hidden this role as not-applicable; True = explicitly relevant. (Reuse the existing per-tenant settings table rather than a new one — it already keys (tenant_id, role_key). Confirm this fits.)
- GET /roles: include `is_relevant_effective` (False only if explicitly hidden, else True) so the UI can show/hide or visually de-emphasise hidden roles. Do NOT remove hidden roles from the response (admin still needs to unhide) — just flag them.
- New endpoint `PUT /api/setup/account-mapping/{role_key}/relevance` body { is_relevant: bool | null } (null clears → default relevant). Guard: super admin only (same as the control endpoint).
- IMPORTANT: relevance is a UI/onboarding convenience — it does NOT change posting behaviour. resolve_account still works for any role regardless of relevance (a module that needs a role still resolves it; hiding is cosmetic for setup). State this clearly in code comments so no one later makes hiding block posting.

Reseed/migrate cleanly (additive column + catalogue changes). Up/down clean.

---

## Files CC may modify
- `backend/app/models/account_mapping.py` — is_relevant column on TenantPostingRoleSettings.
- `backend/alembic/versions/<new>` — remove 2 roles + their mappings/settings, add goods_in_transit, add is_relevant column.
- `backend/app/routers/account_mapping.py` — GET includes is_relevant_effective; new relevance endpoint.
- `backend/app/schemas/account_mapping.py` — response + request updates.
- Update test scripts referencing removed roles.

Do NOT: touch gl/posting/CoA logic, the resolver's posting behaviour (relevance must NOT gate resolution), frontend, `config.py`/`ziva_dev`, CORS.

---

## House rules
- Migration up/down clean; removed-role rows cleaned (report counts).
- Relevance is cosmetic for setup ONLY — never blocks resolve_account/posting.
- Super-admin-gated relevance endpoint.

---

## Acceptance / test steps (state pass/fail each — via script)
1. GET /roles: default_bank + cash GONE; goods_in_transit PRESENT (BS/current_assets/inventory).
2. Any prior default_bank/cash mappings removed (report how many).
3. PUT /{role_key}/relevance hides a role (is_relevant=false) → GET shows is_relevant_effective=false; clearing (null) → true again.
4. resolve_account still resolves a role even if marked not-relevant (relevance does NOT block posting).
5. Migration up/down clean.

---

## Completion summary required
List every file changed. State: references to removed roles found; how many default_bank/cash mapping rows were cleaned; goods_in_transit taxonomy + control default + rationale; that is_relevant reuses TenantPostingRoleSettings; confirmation that relevance is cosmetic and does NOT affect resolve_account/posting; the relevance endpoint guard; migration clean. Report acceptance pass/fail.
