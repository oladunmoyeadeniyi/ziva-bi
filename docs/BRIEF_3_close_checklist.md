# Brief 3 — Close checklist + hard-close gate (M8.3)

**Milestone:** M8.3 Period Management — Brief 3 of 4
**Scope:** Backend only. UI lands in Brief 4.
**Depends on:** Brief 1 (period engine, `hard_close_period`), Brief 2 (grace/override patterns). Fills the `# BRIEF-3: checklist gate` hook.

---

## STEP 0 — Read before changing anything (mandatory)

Read these in full, report exact files + line ranges you intend to change BEFORE editing:

- `backend/app/routers/setup.py` — the `hard_close_period` endpoint and the `# BRIEF-3: checklist gate` stub inside it (this is where the gate wires in). Also the grace CRUD endpoints from Brief 2 (to match endpoint style).
- `backend/app/models/setup.py` — the `PeriodGraceOverride` and `FuturePostingException` models (mirror their column patterns: uuid pk, tenant_id CASCADE, String enums, server_default timestamps, no cross-schema FK on user ids).
- `backend/app/models/setup.py` — `AccountingPeriod` (the gate reads its `period_type`/year-end nature; note there is no explicit `period_type` column on AccountingPeriod — year-end is "the last period of the FY", i.e. `period_no == 12` for monthly. Confirm and use that.)
- How `current_user.user_id` and `role_tier` are accessed (preparer/approver identity).

If anything conflicts with the real code, STOP and report it.

---

## Context — what Brief 3 adds

A tenant-defined **close checklist**: a list of items that must be prepared and approved before a period can be **hard-closed**. Items are tagged for **every close** or **year-end only**. Each item is marked done by a **preparer** and signed off by a **separate approver** (segregation of duties). Hard-close is **blocked** until all applicable items are signed off.

Three pieces: the checklist *template* (tenant config), the *per-period completion* records, and the *gate* in `hard_close_period`.

This brief does NOT build the year-end roll-forward or audit grace (Brief 4) or any UI (Brief 4). It only builds the checklist + gate.

---

## Models (NEW)

### `CloseChecklistItem` — the tenant's checklist template
Mirror the `PeriodGraceOverride` column style.
- `id` (uuid pk)
- `tenant_id` (fk CASCADE, indexed)
- `label` (string, e.g. "Bank reconciliation completed")
- `description` (text, nullable)
- `applies_to` (string enum): `"every_close"` | `"year_end_only"`.
- `sort_order` (int, default 0) — display order.
- `is_active` (bool, default True) — soft-disable without deleting history.
- `created_at`.

No default seeding required (unlike grace) — a tenant with no checklist items has an empty checklist, and hard-close is ungated (nothing to satisfy). State this clearly: **empty checklist ⇒ hard-close allowed.** This is intentional so existing/test tenants aren't blocked.

### `PeriodChecklistCompletion` — per-period sign-off record
One row per (period, checklist item) once work begins on it.
- `id` (uuid pk)
- `tenant_id` (fk CASCADE, indexed)
- `period_id` (fk → accounting_periods.id, CASCADE, indexed)
- `checklist_item_id` (fk → close_checklist_items.id; do NOT cascade-delete completions when an item is deactivated — keep history. Use no FK cascade or SET NULL; if SET NULL, also store `item_label_snapshot`. Prefer keeping the FK without cascade + an `item_label_snapshot` string so history survives item edits.)
- `item_label_snapshot` (string) — the label at time of completion (history-proof).
- `prepared_by` (uuid, nullable) / `prepared_at` (datetime, nullable)
- `approved_by` (uuid, nullable) / `approved_at` (datetime, nullable)
- `status` (string enum): `"pending"` | `"prepared"` | `"approved"`.
- `created_at`.
- unique on (`period_id`, `checklist_item_id`).

---

## Endpoints

### Checklist template CRUD — `/api/setup/periods/checklist`
- `GET /api/setup/periods/checklist` — list the tenant's checklist items (ordered by sort_order). Admin.
- `POST /api/setup/periods/checklist` — add an item (label, description, applies_to, sort_order). Admin.
- `PATCH /api/setup/periods/checklist/{id}` — edit label/description/applies_to/sort_order/is_active. Admin.
- `DELETE /api/setup/periods/checklist/{id}` — soft-delete (set is_active False) rather than hard delete, to preserve completion history. If you hard-delete, completions must survive via snapshot. State which you did.

### Per-period completion — `/api/setup/periods/{period_id}/checklist`
- `GET /api/setup/periods/{period_id}/checklist` — returns the **applicable** checklist items for this period, joined with their completion status. "Applicable" = active items where `applies_to == "every_close"` OR (`applies_to == "year_end_only"` AND this period is the year-end period, i.e. `period_no == 12`). For each, show pending/prepared/approved + who/when.
- `POST /api/setup/periods/{period_id}/checklist/{item_id}/prepare` — mark prepared. Sets `prepared_by = current_user.user_id`, `prepared_at = now`, status → `prepared`. Creates the completion row if it doesn't exist (snapshot the label).
- `POST /api/setup/periods/{period_id}/checklist/{item_id}/approve` — mark approved. **Segregation of duties:** refuse (409) if `approved_by would == prepared_by` — the approver must be a different user than the preparer. Also refuse if not yet prepared (409 "Item must be prepared before approval."). Sets `approved_by`, `approved_at`, status → `approved`.
- (Optional) `POST .../unprepare` / `.../reject` to revert — only if trivial; otherwise skip and note it.

Admin for all. Preparer/approver can be any admin user; the only hard rule is preparer ≠ approver.

---

## The gate — wire into `hard_close_period`

Replace the `# BRIEF-3: checklist gate` stub in `hard_close_period`. Add a helper in `services/periods.py`:

`async def checklist_complete(period, db) -> tuple[bool, list[str]]`
- Determine applicable items for `period` (every_close always; year_end_only only if `period.period_no == 12`).
- If there are **no applicable active items** → return `(True, [])` (empty checklist ⇒ allowed).
- For each applicable item, require a `PeriodChecklistCompletion` with status `approved`.
- Return `(False, [list of incomplete item labels])` if any applicable item is not approved.

In `hard_close_period`, before setting status to HARD_CLOSED (and after the sequential-close check already there):
```
ok, missing = await checklist_complete(period, db)
if not ok:
    raise HTTPException(status_code=409,
        detail=f"Close checklist incomplete: {', '.join(missing)}")
```
Keep the existing sequential-close enforcement intact — checklist is an **additional** gate, not a replacement.

Leave the `# BRIEF-4: audit log on reopen` hook in `reopen_period` untouched.

---

## Files CC may modify

- `backend/app/models/setup.py` — add `CloseChecklistItem`, `PeriodChecklistCompletion`.
- `backend/alembic/versions/<new migration>` — additive, reversible.
- `backend/app/schemas/setup.py` — checklist item + completion schemas.
- `backend/app/services/periods.py` — `checklist_complete` helper.
- `backend/app/routers/setup.py` — checklist CRUD + per-period prepare/approve endpoints; wire the gate into `hard_close_period`.

Do NOT touch: `config.py`, CORS, expense flow, frontend. Do NOT build year-end roll-forward / audit grace (Brief 4). Do NOT alter the grace/journal-block/future-exception logic from Brief 2.

---

## House rules

- Migration `upgrade`/`downgrade` clean. Manual uvicorn restart after migrating.
- Empty checklist must NOT block hard-close (state this is verified).
- Segregation of duties (preparer ≠ approver) enforced server-side, not just UI.
- No frontend.

---

## Acceptance / test steps (state pass/fail each)

1. Migration clean; both tables exist; downgrade reverts.
2. Empty checklist: hard-close a soft-closed period (earlier periods closed) → succeeds (ungated).
3. Add 2 every_close items + 1 year_end_only item. `GET /periods/{regular_period}/checklist` shows the 2 every_close items only; `GET` for the period_no==12 period shows all 3.
4. Prepare an item → status prepared, prepared_by set. Approve as the **same** user → 409 (segregation). Approve as a different user → approved.
5. Approve before prepare → 409.
6. Hard-close with an applicable item not yet approved → 409 listing the missing item(s). Approve all applicable → hard-close succeeds.
7. Deactivating a checklist item: prior completions survive (history intact via snapshot); the item no longer appears as applicable for future closes.
8. Sequential-close still enforced alongside checklist (both gates active).

---

## Completion summary required

List every file changed. State: soft-delete vs hard-delete choice for checklist items and how completion history is preserved; confirm empty-checklist ⇒ hard-close allowed; confirm preparer≠approver enforced server-side; confirm year-end detection uses `period_no == 12` (or flag if you found a better signal); confirm the `# BRIEF-4: audit log on reopen` hook is still intact; confirm sequential-close enforcement was not removed, only added to.
