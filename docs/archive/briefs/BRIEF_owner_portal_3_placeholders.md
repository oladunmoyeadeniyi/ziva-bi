Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Owner portal #3: placeholder sections (Team, Trials, Billing, Support, Audit)

**Scope:** Frontend only (Audit may use a tiny real backend read if it exists). Build the 5 remaining owner-portal sections as honest, clean "coming soon" placeholders — EXCEPT Audit, which should show real audit log data if an endpoint exists. No fake data anywhere.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- The stub pages (if Brief #1 created them) for `/platform/team`, `/trials`, `/billing`, `/support`, `/audit`, `/settings`.
- `frontend/src/app/platform/layout.tsx` — confirm nav links exist for these.
- `backend/app/routers/platform.py` and `backend/app/models/auth.py` — is there an AuditLog read endpoint? Search for any `GET /api/platform/audit` or audit-listing. If NONE exists, Audit is also a placeholder (state this). Do NOT build a new backend endpoint in this brief.
Report findings before editing.

---

## Build each section

For **Team & delegation, Trials & signups, Billing, Support** — clean placeholder pages:
- Page title + one-line description of what the section WILL do.
- A tasteful "coming soon" state naming the milestone (Team → M9.1b delegation; Trials → M9.4 signup/trial provisioning; Billing → post-v1; Support → future).
- Optionally a faded preview of the intended layout (e.g. a disabled table header) — keep it clearly non-functional and honest. No fake rows of data.
- Existing design language; consistent with Overview/Tenants.

For **Audit log**:
- IF a real audit endpoint exists → list real entries (when, actor, action, target). Paginate simply or cap at recent N.
- IF NO endpoint exists → placeholder like the others, noting "Audit viewer coming soon" (the AuditLog table is being written to by platform actions; the viewer is future). State which path you took.

For **Settings** (if a stub exists): minimal placeholder "Platform settings — coming soon", or remove the nav item if you'd rather not show it. State choice.

---

## Files CC may modify
- `frontend/src/app/platform/team/page.tsx`
- `frontend/src/app/platform/trials/page.tsx`
- `frontend/src/app/platform/billing/page.tsx`
- `frontend/src/app/platform/support/page.tsx`
- `frontend/src/app/platform/audit/page.tsx`
- `frontend/src/app/platform/settings/page.tsx` (if used)

Do NOT: touch backend (no new endpoints), other sections, AppHeader, `config.py`, CORS. No fake data rows.

---

## House rules
- `npm run type-check` = 0 errors.
- Honest placeholders — clearly "coming soon", milestone named, NO fabricated data.
- Consistent design with the rest of the portal.

---

## Acceptance / test steps (state pass/fail each)
1. Each of Team/Trials/Billing/Support loads a clean placeholder naming its milestone; no fake data.
2. Audit shows real entries (if endpoint exists) or an honest placeholder (if not).
3. Nav highlights the active section; no broken routes.
4. type-check 0.

---

## Completion summary required
List every file changed/created. State: which sections are placeholders vs real; whether an audit endpoint existed and which path Audit took; what you did with Settings; confirm no fake data; confirm no backend touched. Report acceptance pass/fail.
