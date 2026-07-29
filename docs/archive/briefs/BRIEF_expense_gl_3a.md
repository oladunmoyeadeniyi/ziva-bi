Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Expense → GL 3a: post real journal on final approval

**Scope:** When an expense report reaches FINAL approval (the existing `else` branch in `approve()` at the point `report.status = "APPROVED"` is set, in `backend/app/routers/approvals.py`), build and post a balanced GL journal: Dr each expense line's GL with its dimensions, Cr the `employee_payable` control account (resolved via account determination). Synchronous, same transaction — if posting fails, approval fails too (full rollback). No WHT in this brief.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/routers/approvals.py` — the EXACT final-approval block (around line 975-989: `else: report.status = "APPROVED"` ...). Confirm this is the ONLY place `report.status = "APPROVED"` is set (grep to be sure — confirm no other path sets it, e.g. via refer-back). Confirm `report` has `.lines` loaded/loadable (relationship to ExpenseLine) at this point, or whether it needs an explicit query.
- `backend/app/models/expenses.py` — ExpenseLine: gl_id, dimension_values (JSONB), amount, description, line_number. ExpenseReport: report_number, employee_id, report_date, currency, total_amount.
- `backend/app/services/gl_posting.py` — `post_journal(db, tenant_id, *, entry_date, description, source, source_reference, lines, created_by, module=, status=)` signature, `PostingError`, `JournalLineInput` schema (debit/credit/gl_account_id/dimensions/description/bank_account_id).
- `backend/app/services/account_determination.py` — `resolve_account(db, tenant_id, role_key)` → gl_account_id or raises AccountMappingError.
- `backend/app/services/periods.py` — `is_date_postable` signature (already called inside post_journal — confirm no double-call needed here).
- Confirm `employee_payable` exists in the posting_roles catalogue (it does — control account, BS, current_liabilities, payables).
- Check how `tenant_id` and `current_user.user_id` (for created_by) are available in the `approve()` function scope.
Report findings before editing.

---

## Build

### Posting logic (new function, e.g. in a new `backend/app/services/expense_posting.py`, or inline in approvals.py — your call, state which and why)

`post_expense_to_gl(db, tenant_id, report, created_by) -> JournalEntry`:

1. **Load lines** for the report (if not already loaded).
2. **Validate full GL coding:** if ANY line has `gl_id is None`, RAISE an error (PostingError or a new ExpensePostingError) — do NOT post. Message should be clear: e.g. "Cannot post: N line(s) missing GL coding." This must surface back to the approver as a 422 (approval blocked), not a silent skip.
3. **Resolve employee_payable** via `resolve_account(db, tenant_id, "employee_payable")`. If unmapped, this raises AccountMappingError — let it propagate (blocks approval, clear message: Finance must map employee_payable first).
4. **Build journal lines:**
   - One DEBIT line per expense line: `gl_account_id=line.gl_id`, `debit=line.amount`, `credit=0`, `dimensions=line.dimension_values`, `description=line.description` (or report_number + line description).
   - One CREDIT line: `gl_account_id=<resolved employee_payable>`, `credit=report.total_amount`, `debit=0`, `description=f"Employee payable — {report.report_number}"`.
   - Confirm Σdebit (sum of line amounts) == report.total_amount before posting (if they don't match, that's a data integrity error — raise clearly rather than letting post_journal's balance check produce a vaguer message).
5. **Call post_journal:**
   ```
   entry_date=report.report_date,
   description=f"Expense retirement — {report.report_number}",
   source="expense",
   source_reference=report.report_number,
   lines=[... built above ...],
   created_by=created_by,
   module="expense",
   status="POSTED",
   ```
6. Return the created JournalEntry (or its id/reference_number) so the approve() response/audit log can reference it.

### Wire into approve()
In the final-approval `else` branch, AFTER setting `report.status = "APPROVED"` (or immediately before — pick the order that makes a failure correctly prevent the status change in the same transaction; explain your choice) call `post_expense_to_gl(...)`. If it raises:
- Catch and re-raise as HTTPException 422 with the clear underlying message (uncoded lines / unmapped role / balance mismatch).
- Because this is the same `db` session/transaction and the router's `get_db` commits only on success, an exception here must prevent the commit — confirm this is true (no partial commit happened earlier in the function before this point that would already be durable). State your finding.
- Add the journal reference_number to the audit log entry for EXPENSE_APPROVED (extend the existing `_write_audit_log` call's metadata dict) and ideally to the response if convenient (state if you added it to ExpenseReportResponse — only if trivial; don't force a schema change if awkward, note as follow-up instead).

### Re-test the refer-back final-approval path
Confirm whether refer-back can ALSO reach a final "no more pending levels" state that should trigger posting (re-check the grep — if `report.status = "APPROVED"` truly only happens in the one place, refer-back always returns to a pending level and never directly finalizes; state this clearly, and if you find a second path, wire posting there too).

---

## Files CC may modify
- `backend/app/routers/approvals.py` — wire the call into the final-approval branch.
- NEW `backend/app/services/expense_posting.py` (recommended) — the post_expense_to_gl function. (Or inline — state choice.)
- Possibly `backend/app/schemas/expenses.py` if you add journal reference to the response (optional, only if trivial).

Do NOT: touch the GL posting service's core validation, account determination resolver logic, the submit/reject/refer-back code paths beyond the final-approval branch, period logic, `config.py`, CORS. No WHT logic. No migration expected (state if one is needed and why, but this should be code-only).

---

## House rules
- BLOCK posting (and therefore approval) if any line lacks gl_id — clear 422 message, no silent skip.
- Synchronous, same transaction: posting failure prevents the approval commit.
- No WHT in this brief.
- Reuses existing post_journal/resolve_account — no duplicate validation logic.
- `npm run type-check` n/a (backend only) — confirm backend imports clean.

---

## Acceptance / test steps (state pass/fail each — script preferred, real Red Bull tenant if feasible)
1. Fully-GL-coded report → final approval → journal posted: Dr expense GLs (with dimensions) = Cr employee_payable = report.total_amount; entry.source="expense", source_reference=report_number, status POSTED.
2. Report with one line missing gl_id → final approval attempt → 422, clear message, report.status NOT changed to APPROVED (still PENDING_APPROVAL), no journal created (verify via TB/ledger or count).
3. employee_payable unmapped for tenant → final approval attempt → 422 clear message, no partial state change.
4. Multi-line report (3+ lines, different GLs/dimensions) posts correctly; trial balance reflects it.
5. Non-final approval (more levels pending) does NOT trigger posting.
6. Refer-back path confirmed to never independently finalize (or, if it can, posting wired there too — state which).
7. Audit log EXPENSE_APPROVED entry includes the journal reference_number.
8. Backend imports clean.

---

## Completion summary required
List every file created/changed. State: where post_expense_to_gl lives and why; the exact order of status-set vs posting call and why that ordering is safe within the transaction; confirmation that a posting failure prevents the approval commit (with reasoning); how the Σdebit vs total_amount check works; the employee_payable resolution; the audit log extension; the refer-back finding. Report acceptance pass/fail with specifics (actual journal reference numbers, TB excerpt if helpful).
