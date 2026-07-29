# Brief 2 — Grace overrides + manual-journal block + future-dated exception (M8.3)

**Milestone:** M8.3 Period Management — Brief 2 of 4
**Scope:** Backend only. UI for these settings lands in Brief 4.
**Depends on:** Brief 1 (period engine). Fills the `# BRIEF-2: grace override` hook in `is_date_postable`.

---

## STEP 0 — Read before changing anything (mandatory)

Read these in full and report exact files + line ranges you intend to change BEFORE editing:

- `backend/app/services/periods.py` — `is_date_postable` (the `# BRIEF-2` hook is on the OPEN/SOFT_CLOSED/OVERDUE branch), and `apply_auto_soft_close`.
- `backend/app/routers/setup.py` — the `/periods` endpoints group (generate, list, check, soft-close, hard-close, reopen).
- `backend/app/models/setup.py` — `AccountingPeriod` (note: `grace_expires_at` column already exists, nullable — this brief populates it).
- `backend/app/models/setup.py` — `TenantOrgConfig` (for `period_closing_frequency`, and where tenant-level settings live).
- How `current_user.role_tier` is read and how `UserTenant` / user records map a user to a tenant (needed for "specific users" in overrides).

If anything conflicts with the real code, STOP and report it.

---

## Context — what Brief 2 adds

Brief 1 made SOFT_CLOSED simply "postable." Brief 2 makes that conditional on a **grace window** governed by a configurable override table, adds a **manual-journal block** into a new month while the prior isn't hard-closed, and adds a **logged future-dated exception** so permitted roles can post into a FUTURE period.

Three sub-features, all backend. Each is independently testable.

Definitions to keep straight (don't conflate):
- **Month-end grace** = days after a period soft-closes during which posting is still allowed, per the override table. Measured in **workdays or calendar days, per override row**.
- This is distinct from the year-level **audit grace** (Brief 4) — do not build that here.

---

## SUB-FEATURE A — Grace override table

### Model (NEW) — `PeriodGraceOverride`
Tenant-scoped rows. The tenant-wide default is row-zero; override rows are exceptions.

Fields:
- `id` (uuid pk)
- `tenant_id` (fk, indexed)
- `module` (string) — for now the valid values are `"default"`, `"expense"`, `"manual_journal"`. Store free-text but validate against this set in the endpoint (reject others with 422). Framework is built so more modules slot in later.
- `applies_to_type` (string enum): `"all"` | `"role"` | `"user"`.
- `applies_to_role` (string, nullable) — one of `consultant` | `power_admin` | `functional_admin`, required when `applies_to_type == "role"`.
- `applies_to_user_id` (uuid, nullable) — required when `applies_to_type == "user"`. (References the user; store the id, resolve name in the response.)
- `period_type` (string enum): `"regular"` | `"year_end"`.
- `grace_value` (int) — number of days.
- `grace_unit` (string enum): `"workdays"` | `"calendar_days"`. **Per-row** (each override picks its own unit).
- `is_default` (bool) — exactly one row per tenant should be the default (module=`default`, applies_to=`all`, period_type=`regular`). Seed one on first access with sensible defaults: grace_value=3, grace_unit=workdays. (3 here is the month-end default; do not confuse with the 3-**month** audit grace.)
- `created_at`.

Unique-ish guard: don't hard-constrain at DB level (too many nullable combos), but in the endpoint prevent exact-duplicate rows (same module + applies_to + period_type).

### Endpoints (under `/api/setup/periods/grace`)
- `GET /api/setup/periods/grace` — list all override rows for the tenant (seed the default row if none exist). Resolve `applies_to_user_id` → name in the response.
- `POST /api/setup/periods/grace` — add an override row. Validate module + enums + required conditional fields.
- `PATCH /api/setup/periods/grace/{id}` — edit a row. The default row's `module`/`applies_to`/`period_type` are locked (only its grace_value/unit editable) — enforce.
- `DELETE /api/setup/periods/grace/{id}` — remove a row. Refuse deleting the default row (409).

Admin-only (consultant configures, but power_admin can view/edit too — match the pattern used by other setup endpoints; `_require_admin`).

### Grace computation
Add a helper in `services/periods.py`:
`def compute_grace_expiry(soft_closed_at, grace_value, grace_unit, tenant_id, db) -> datetime`
- `calendar_days`: soft_closed date + grace_value calendar days.
- `workdays`: soft_closed date + grace_value business days (skip Sat/Sun). **Holidays:** there is no holiday calendar yet — skip weekends only, and leave a `# FUTURE: subtract public holidays` comment. Do not invent a holiday table.

When a period auto-soft-closes (`apply_auto_soft_close`), compute and persist `grace_expires_at` using the **default regular-period grace row** for that tenant. (Per-user/per-module grace is evaluated at posting time, not stored on the period — see below.)

### Wire into `is_date_postable`
Replace the `# BRIEF-2: grace override` stub. New logic for SOFT_CLOSED / OVERDUE:
- `is_date_postable` currently takes `(tenant_id, target_date, db)`. **Add optional params** `user_id: Optional[UUID] = None`, `module: Optional[str] = None` so callers can pass context. Keep them optional so existing/simple callers still work (when absent, fall back to the default grace row).
- For a SOFT_CLOSED/OVERDUE period: find the most-specific matching grace row (user-specific > role > default; matching module if given, else default module; matching period_type). Compute the effective grace expiry from `soft_closed_at`. If `now <= expiry` → postable. If past expiry → NOT postable, reason "Grace period for posting into this period has expired."
- Also set/refresh the period's `status` to `OVERDUE` when grace has expired but it's not hard-closed (so the flag the UI shows is real). Persist that transition (similar pattern to auto-soft-close). OVERDUE still blocks routine posting once expired — it's not just cosmetic once grace is gone. (Earlier design called OVERDUE "visual only" at the *period-grid* level for the close action; but for *posting*, expired grace means no more routine posts. These are consistent: the period stays soft-closed/reopenable, but the grace window for casual posting is over.)

> If this OVERDUE-blocks-posting behaviour conflicts with how you read the earlier design, STOP and flag it rather than guessing. The intent: grace open = post freely; grace expired = only hard-close or adjustment paths remain.

---

## SUB-FEATURE B — Manual-journal block into new month

A tenant-level toggle, default ON: block manual journal entries dated in a period when an **earlier** period is not yet HARD_CLOSED.

- Store the toggle on `TenantOrgConfig` as a new boolean column `block_journal_into_open_prior` (default `True`), OR in the `org_configuration` JSONB under a clear key — prefer a real column for a hard rule like this. State which you chose.
- Add to `is_date_postable`: when `module == "manual_journal"`, after the normal status checks, additionally check — does any period with an earlier `start_date` (same tenant) have status != HARD_CLOSED? If yes AND the toggle is on → NOT postable, reason "Cannot post a manual journal into this period while an earlier period is not hard-closed."
- This check only applies when `module == "manual_journal"` is passed. Other modules are unaffected.
- Endpoint to read/set the toggle: extend the existing org PATCH, or a small `PATCH /api/setup/periods/journal-block {enabled: bool}`. Pick one, state which.

---

## SUB-FEATURE C — Future-dated posting exception (logged)

FUTURE periods are hard-blocked (Brief 1). Brief 2 adds a controlled exception: a permitted role can post a future-dated entry that is **logged**.

### Model (NEW) — `FuturePostingException`
- `id`, `tenant_id`, `created_by` (uuid), `target_date` (date), `module` (string), `reason` (text), `created_at`.
This is the audit log of deliberate future-dated posts.

### Permission
Reuse the grace override framework: a grace override row with `module="future_exception"` (add this to the allowed module set) and an `applies_to` (role/user/all) defines **who may post future-dated**. If no such row exists, default-permitted role is `consultant` only.

### Endpoint
- `POST /api/setup/periods/future-exception` — body `{ target_date, module, reason }`. Checks the caller is permitted (consultant, or matches a `future_exception` grace row). Writes a `FuturePostingException` row. Returns it.
- This endpoint does NOT itself post a journal — it records the *permission grant + audit trail*. The future posting engine (later) will check for a valid exception before allowing the dated entry. For now, also extend `is_date_postable`: if period is FUTURE and a `FuturePostingException` exists for that tenant+date (+module), return postable with reason "Future-dated exception on record." Otherwise FUTURE stays blocked.

---

## Files CC may modify

- `backend/app/models/setup.py` — add `PeriodGraceOverride`, `FuturePostingException`; add `block_journal_into_open_prior` column to `TenantOrgConfig` (if chosen).
- `backend/alembic/versions/<new migration>` — additive: new tables + new column. Reversible.
- `backend/app/schemas/setup.py` — request/response schemas for grace rows, journal-block toggle, future-exception.
- `backend/app/services/periods.py` — `compute_grace_expiry`; extend `is_date_postable` signature + logic; populate `grace_expires_at` in `apply_auto_soft_close`.
- `backend/app/routers/setup.py` — grace CRUD endpoints, journal-block toggle endpoint, future-exception endpoint.

Do NOT touch: `config.py`, CORS, the expense flow, the frontend. Do NOT build the year-level audit grace (Brief 4) or the close checklist (Brief 3) — only their neighbours.

---

## House rules

- Migration `upgrade`/`downgrade` both clean. Manual uvicorn restart after migrating (reload unreliable).
- Keep `is_date_postable`'s new params **optional** — don't break the Brief 1 signature for callers that don't pass user/module.
- Each new module value validated against an allowed set; reject unknowns with 422.
- No frontend.

---

## Acceptance / test steps (state pass/fail each)

1. Migration clean; new tables exist; `downgrade` reverts; `grace_expires_at` now populated on soft-close.
2. `GET /periods/grace` seeds and returns a default row (3 workdays, regular, all). 
3. Add an override (module=expense, role=power_admin, regular, 6 workdays) → persists; duplicate add refused.
4. Default row: cannot change its module/applies_to/period_type; cannot delete it (409). grace_value/unit editable.
5. `compute_grace_expiry`: workdays skips weekends (soft-close Fri + 1 workday = Mon); calendar_days doesn't.
6. `is_date_postable` for a SOFT_CLOSED period: within grace → postable; past grace → not postable + period flips to OVERDUE.
7. Manual-journal block: with toggle ON and an earlier non-hard-closed period, `is_date_postable(..., module="manual_journal")` for the later period → not postable; toggle OFF → postable; other modules unaffected.
8. Future exception: `POST /periods/future-exception` as consultant → records row; as functional_admin with no permitting grace row → 403. After a valid exception, `is_date_postable` for that FUTURE date+module → postable.
9. `is_date_postable` called the old way (no user_id/module) still works (falls back to default grace).

---

## Completion summary required

List every file changed. State: column-vs-JSONB choice for the journal-block toggle and which endpoint sets it; how holidays are handled in workday math (confirm weekends-only + comment left); confirm `is_date_postable` new params are optional and old callers unaffected; list the new allowed `module` values; confirm the `# BRIEF-3` and `# BRIEF-4` hooks from Brief 1 are still intact and untouched.
