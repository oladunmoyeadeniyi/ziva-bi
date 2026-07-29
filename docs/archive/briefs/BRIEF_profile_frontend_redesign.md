Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Profile page redesign (frontend, wired to sessions + 2FA)

**Scope:** Frontend only. Rebuild `/dashboard/profile` to the approved design: identity rail + sectioned cards (Personal, Work, Security incl. 2FA, Active sessions). Role-aware (super admin vs tenant staff). Wires to the profile backend (sessions + 2FA) just built.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `frontend/src/app/dashboard/profile/page.tsx` — current 3-section page (Personal / Work / Change Password) + existing save handlers and apiFetch calls.
- `frontend/src/contexts/AuthContext.tsx` — `user` fields (full_name, email, phone, employee_code, department, job_title, is_super_admin, role_tier, tenant_id; note `totp_enabled` now returned by /me), `impersonation`, `refreshUser`, `accessToken`.
- `frontend/src/lib/api.ts` — apiFetch.
- Whether a QR-rendering lib is available (e.g. `qrcode.react`); if not, state it must be added OR render the otpauth URI as a link + show the manual secret. Prefer adding `qrcode.react` if simple.
Report findings before editing.

---

## Backend endpoints available (just built)
- `GET /api/users/me` — now includes `totp_enabled`.
- `PATCH /api/users/me` — name/phone/employee_code/department/job_title.
- `PATCH /api/users/me/password`.
- `GET /api/users/me/sessions` — [{id, device, ip_address, created_at, expires_at, is_current}].
- `DELETE /api/users/me/sessions/{id}`.
- `POST /api/users/me/sessions/revoke-others` — {revoked, message}.
- `POST /api/users/me/2fa/enroll` — {secret, uri}.
- `POST /api/users/me/2fa/verify` — {code} → {totp_enabled, message}.
- `POST /api/users/me/2fa/disable` — {code} → {totp_enabled, message}.

---

## Target design (build to the approved wireframe)
Two-column layout in a card with a thin banner strip on top:

**Left identity rail:** avatar (initials from full_name), full_name, email, role pills, and a small meta block (member since / cost center / context). Role-aware:
- Tenant staff: pills like role + company name; meta shows tenant context.
- Super admin (is_super_admin, no tenant): pills "Super admin" / "Platform owner"; meta "Ziva BI internal · no tenant".

**Right column — sectioned cards:**
1. **Personal info** — full_name (editable), email (read-only), phone (editable). Save → PATCH /me + refreshUser.
2. **Work info** — employee_code, department, job_title. **Hidden entirely for super admin** (no tenant). For tenant staff, keep editable for now (note: these may become org-set/read-only once RBAC lands — leave editable).
3. **Security:**
   - Password: "Change password" opens the current-password/new/confirm fields (can be inline or a small expandable) → PATCH /me/password.
   - Two-factor: shows state from `user.totp_enabled`. If disabled → "Enable" button starts the enroll flow: call /2fa/enroll, render the QR from the otpauth `uri` (+ show the manual `secret`), prompt for a 6-digit code, call /2fa/verify; on success show enabled. If enabled → "Disable" button prompts for a current code → /2fa/disable. Surface errors inline.
4. **Active sessions** — list from /me/sessions: device, ip, created, mark the `is_current` one. Each non-current session has "Revoke" → DELETE /me/sessions/{id} then refresh the list. A "Sign out everywhere else" button → /me/sessions/revoke-others then refresh.

Use the existing app design language (cards, buttons, inputs like the rest of setup pages). Clean and consistent; full responsive polish is the later phase but make it not break on a narrow width.

---

## Files CC may modify
- `frontend/src/app/dashboard/profile/page.tsx` — full rebuild.
- `frontend/src/components/` — optional small subcomponents (e.g. TwoFactorCard, SessionsCard) if it keeps the page clean. State if you added any.
- `frontend/package.json` — only if adding `qrcode.react` (state it).

Do NOT: touch backend, other pages, AuthContext beyond reading, `config.py`, CORS.

---

## House rules
- `npm run type-check` = 0 errors.
- All buttons wired to real endpoints; no dead controls.
- Super admin sees no Work info; tenant staff sees it.
- Errors surfaced inline (reuse the existing Success/Error banner pattern or similar).

---

## Acceptance / test steps (state pass/fail each)
1. Profile loads with identity rail + 4 sections; super admin shows no Work info, correct pills.
2. Edit name/phone → save → persists (refreshUser reflects it).
3. Change password works (wrong current password → error shown).
4. Enable 2FA: QR + secret shown; entering a valid code enables it; state flips to enabled. Disable with a code works.
5. Active sessions list shows current session flagged; revoke a non-current session removes it; "sign out everywhere else" leaves only current.
6. type-check 0 errors.

---

## Completion summary required
List every file changed. State: whether qrcode.react (or similar) was added; any subcomponents created; how role-awareness (super admin vs staff) is determined client-side; confirm all controls wired to real endpoints; confirm no backend touched. Report acceptance pass/fail.
