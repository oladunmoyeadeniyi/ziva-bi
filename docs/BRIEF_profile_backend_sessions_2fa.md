Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Profile backend: active sessions + 2FA (TOTP)

**Scope:** Backend only. Endpoints for listing/revoking active sessions and enrolling/verifying/disabling TOTP 2FA. The profile-page redesign (frontend) is a separate brief.

---

## STEP 0 — Read before changing anything (mandatory)
Read and report exact lines BEFORE editing:
- `backend/app/models/auth.py` — `Session` (~343: id, user, ip_address, user_agent, expires_at, created_at — confirm fields), `RefreshToken` (~382: links to session, is_revoked), `User` (~121).
- `backend/app/routers/users.py` — existing `/me`, `/me/password` patterns.
- `backend/app/routers/auth.py` — how sessions + refresh tokens are created at login (`_create_session_and_tokens`), how logout revokes.
- `backend/app/core/security.py` — hashing utilities.
- Whether `pyotp` / `qrcode` are available (check requirements); if not, state they need adding.
Report findings before editing.

---

## CHANGES

### Part A — Active sessions
1. `GET /api/users/me/sessions` — list the current user's active (non-expired, non-revoked) sessions: id, device/user_agent (parsed to a short label if easy, else raw), ip_address, created_at, expires_at, and `is_current` (matches the session_id in the caller's JWT).
2. `DELETE /api/users/me/sessions/{session_id}` — revoke a specific session (revoke its refresh token + mark session expired/revoked). Cannot revoke the current session via this (use logout for that) — return 400 if they try, OR allow and note it logs them out; state your choice.
3. `POST /api/users/me/sessions/revoke-others` — revoke ALL sessions except the current one ("sign out everywhere else"). Returns count revoked.

### Part B — 2FA (TOTP)
Add TOTP-based two-factor auth. Use `pyotp` (add to requirements if missing).
1. Schema/columns on `User` (migration, additive, reversible): `totp_secret` (String, nullable — stores the base32 secret once enrolled), `totp_enabled` (Boolean, default false). Store the secret as-is for now (note in summary that encrypting-at-rest is a future hardening).
2. `POST /api/users/me/2fa/enroll` — generate a new TOTP secret (don't enable yet), return the secret + an otpauth:// provisioning URI (issuer "ZivaBI", account = user email) so the frontend can render a QR. Persist the secret but keep `totp_enabled=false` until verified.
3. `POST /api/users/me/2fa/verify` — body `{ code }`. Verify the 6-digit TOTP against the enrolled secret; on success set `totp_enabled=true`. Return success. (This confirms enrollment.)
4. `POST /api/users/me/2fa/disable` — body `{ code }` (or current password — pick one, state which). Verify, then clear `totp_secret` + set `totp_enabled=false`.
5. **Login integration:** in `routers/auth.py` login, IF the user has `totp_enabled`, require a `totp_code` in the login request: if missing/invalid → 401/422 with a clear "2FA code required/invalid" detail; if valid → proceed. Make the `totp_code` field optional in the login schema so non-2FA users are unaffected. State exactly how you wired this so it doesn't break existing logins.
6. Expose `totp_enabled` on `GET /api/users/me` (so the profile page knows the current state).

---

## Files CC may modify
- `backend/app/models/auth.py` — User totp columns.
- `backend/alembic/versions/<new>` — additive, reversible.
- `backend/app/routers/users.py` — sessions + 2FA endpoints.
- `backend/app/routers/auth.py` — login 2FA check; ensure session revoke reuses existing logout revoke logic.
- `backend/app/schemas/users.py` (+ auth schema for login totp_code) — request/response models.
- `backend/requirements.txt` — add `pyotp` (and `qrcode` only if you render QR server-side; prefer letting the frontend render from the otpauth URI, so qrcode may not be needed — state choice).

Do NOT: touch tenant data tables, `config.py`/`ziva_dev`, CORS, the frontend. Keep existing login working for non-2FA users.

---

## House rules
- Migration upgrade/downgrade clean. Set `$env:DATABASE_URL` before alembic. Manual uvicorn restart.
- Non-2FA users must log in exactly as before (totp_code optional).
- Reuse existing session/refresh revoke logic — don't reinvent it.

---

## Acceptance / test steps (state pass/fail each)
1. `GET /me/sessions` returns the caller's sessions with is_current flagged.
2. `DELETE /me/sessions/{id}` on another session revokes it (that refresh token no longer works).
3. `revoke-others` leaves only the current session.
4. `2fa/enroll` returns a secret + otpauth URI; `totp_enabled` still false.
5. `2fa/verify` with a correct code (from the secret) sets totp_enabled true; wrong code rejected.
6. With 2FA enabled, login without totp_code → rejected; with valid code → succeeds; a non-2FA user logs in normally (no code).
7. `2fa/disable` clears it.
8. Migration up/down clean.

---

## Completion summary required
List every file changed. State: whether pyotp/qrcode were added; the disable method (code vs password); how login 2FA was wired without breaking non-2FA logins; current-session revoke choice; confirm sessions reuse existing revoke logic; confirm migration clean; confirm no frontend/tenant-data touched; note that totp_secret at-rest encryption is future hardening.
