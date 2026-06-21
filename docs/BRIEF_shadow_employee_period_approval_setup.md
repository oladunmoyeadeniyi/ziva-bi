Read docs/ZIVA_BI_ROADMAP.md, docs/MASTER_CONTEXT.md, and docs/TEST_TENANT.md first, then follow this brief.

# BRIEF — Make the New Test Shadow Actually Testable: Employees, Period, Mapping, Approval Matrix

## Context

The new test shadow `e8a2fd8c-5466-4618-bb37-97681a8bfb05` (per `docs/TEST_TENANT.md`) is a structurally complete clone of live Red Bull — org structure, CoA, dimensions, mappings all present. But per the doc's own "What this tenant still needs" list, it cannot run an actual submit → approve → GL test yet because it has zero employees, no open accounting period, and no people in the approval matrix.

This brief sets that up using real Red Bull employee data, uploaded via the bulk employee template.

## STEP 0 — Mandatory safety check before any upload (do not skip)

1. **Check whether the self-onboarding invite email actually sends from this environment.** Find the email-sending code path triggered by employee invite/creation (search for wherever "Send self-onboarding invite" in the frontend calls a backend endpoint, and trace what that endpoint does — does it call a real email provider/SMTP, or is email sending currently stubbed/disabled/not yet wired up?). Report exactly what you find: does it fire a real email today, yes or no, and to what provider/service if so.
2. **If real emails WOULD fire**: stop here. Do not proceed to Part A. Report this finding back and wait for Adeniyi's explicit instruction on how to proceed (e.g. temporarily disable email sending for this tenant, use a test email domain instead, or get explicit confirmation real colleagues are fine with it).
3. **If real emails would NOT fire** (sending is stubbed, not yet built, or there's a tenant-level/environment-level flag that already prevents it): confirm this clearly, with evidence (code reference), and proceed to Part A.
4. Also confirm: does the plain "Add Employee" or bulk upload path (NOT the invite path) trigger any email at all? Report this separately, since the brief may end up using bulk upload without inviting.

## STEP 0b — Confirm current real Red Bull employee data structure

Before uploading anything, confirm what data Adeniyi will actually provide:
- Report the exact bulk template columns now in use (per the recent template-format-fix brief): Name fields, email, cost center code dropdown, head-of-cost-center column, any others.
- Do not invent or guess employee data. Adeniyi will supply the real names/emails/cost centers/roles separately — this STEP is just to confirm the template shape is ready to receive that data correctly.

## Part A — Employees (only after STEP 0 clears)

- Adeniyi will download the current employee bulk template from the new shadow tenant and fill in real Red Bull employee data (at minimum: one employee who will submit an expense, one who will approve it — more if Adeniyi provides them).
- Once Adeniyi confirms the filled file is ready, upload it via the existing bulk upload endpoint against tenant `e8a2fd8c-5466-4618-bb37-97681a8bfb05`.
- Confirm upload result: employees created, cost centers correctly assigned via the dropdown-validated column, any head-of-cost-center flags correctly resolved into `CostCenterConfig`.
- Report any row errors clearly.

## Part B — Accounting period

- Per `docs/MASTER_CONTEXT.md`, M8.3 Period Management may or may not be built yet — confirm current state (check `backend/app/models/` for an `AccountingPeriod`-type model and `backend/app/routers/` for a periods endpoint).
- If period management exists: open at least one period on the test shadow (the current month, or whatever's appropriate) so `is_date_in_open_period()` (or equivalent) allows postings.
- If period management does NOT exist yet (M8.3 not yet built): report this clearly and confirm whether the expense→GL posting flow has any period gate at all today, or whether it posts without checking period status currently. Do not build period management as part of this brief — that's M8.3's own scope. Just confirm what gate (if any) currently exists and whether it blocks testing.

## Part C — employee_payable mapping

- Confirm whether `employee_payable` is already mapped in `tenant_account_mappings` for this shadow (it should have been cloned from live if live has it — check). If live Red Bull does NOT have this mapped yet either, report this clearly; it would need to be set up on live first, then re-synced or set up directly on the shadow as a one-off for testing purposes — ask Adeniyi which approach before proceeding if this is the case.

## Part D — Required dimension for expense debit lines

- Confirm at least one cost center (or whatever dimension is required for expense GL coding) is usable for test expense lines — this should already be present from the org structure clone; just confirm with a direct query, don't assume.

## Part E — Approval matrix

- Confirm the approval matrix config was cloned (per `docs/TEST_TENANT.md`, it should be — "approval_matrix | 1 | ... config").
- Once Part A's employees exist, confirm whether the approval matrix needs explicit employee assignment (e.g. "this cost center's approver is employee X") or whether it resolves dynamically some other way (e.g. by role, by line manager). Report how approval resolution actually works in this codebase before assuming it needs manual wiring.
- If manual assignment is needed, wire the approver employee from Part A into the matrix for at least one cost center, so a full submit → approve test is possible.

## Files CC is allowed to modify

- None expected for STEP 0 (investigation only).
- If Part E requires assigning an approver, whatever config/data write the existing approval matrix UI or endpoint already supports — no new code expected unless a genuine gap is found. Flag and ask before writing new approval-matrix code; this brief is about USING what's already built, not building new features.

## Do NOT touch

- Live Red Bull tenant — read-only reference only
- GL posting engine logic itself
- CoA, dimensions, employee bulk-upload code (already correct, do not refactor)
- Anything outside the list above without flagging it first

## Acceptance tests (state pass/fail for each)

1. STEP 0 email-safety check completed and reported BEFORE any upload — this is a hard gate, not optional.
2. If real emails would fire: brief stops here, reported back, no upload performed.
3. If safe: bulk employee upload completed against `e8a2fd8c-...`, at least 2 real employees created (submitter + approver), cost centers correctly assigned via dropdown, no unexpected row errors.
4. Period status confirmed and reported (open period exists / or no gate exists yet / or M8.3 not built — whichever is true).
5. `employee_payable` mapping confirmed present (or absence clearly flagged with a recommended next step).
6. At least one usable cost center/dimension confirmed for expense debit lines.
7. Approval matrix resolution mechanism explained; approver wired in if manual assignment is required.
8. All work performed against `e8a2fd8c-5466-4618-bb37-97681a8bfb05` only — never live Red Bull.

## Completion summary must include

- STEP 0 findings verbatim, with explicit yes/no on whether real emails would fire and the code evidence for that conclusion
- Whether the brief proceeded past STEP 0 or stopped there
- If proceeded: employee upload results, period status, mapping status, dimension status, approval matrix wiring status — one clear paragraph per part (A–E)
- A final readiness statement: is the shadow now ready for a full submit → approve → GL walkthrough, yes or no, and if no, exactly what's still missing
