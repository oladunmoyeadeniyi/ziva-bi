# CC Brief — Recreate Local Environment Files After OS Reload

## CRITICAL INSTRUCTIONS
This is a one-time operational task, not a code change. Do not modify any
application code.

---

## CONTEXT

The developer reloaded their OS and lost the local `.env` files (they were
never committed to git, as expected). This brief recreates them with safe
local development defaults. The Supabase service role key is the only value
the developer must supply manually — it will be added in a follow-up step.

---

## STEP 1 — Create `backend/.env`

Create the file `backend/.env` with exactly this content:

```
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/ziva_dev
SECRET_KEY=local-dev-secret-change-me-ziva-bi-2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
ALLOWED_ORIGINS=http://localhost:3000
SUPABASE_URL=https://qoshtcbdrudbxwrxlfgx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=PASTE_KEY_HERE
SUPABASE_BUCKET=documents
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
FRONTEND_URL=http://localhost:3000
APP_NAME=ZivaBI
DEBUG=true
```

---

## STEP 2 — Create `frontend/.env.local`

Create the file `frontend/.env.local` with exactly this content:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## STEP 3 — Confirm both files are gitignored

Check `.gitignore` (root, and `backend/.gitignore` / `frontend/.gitignore`
if they exist separately) to confirm `.env` and `.env.local` are listed
and will not be committed. If either is missing from `.gitignore`, add it.

Run `git status` afterwards to confirm neither new file appears as
"untracked" in a way that would get committed (they should not appear
at all if `.gitignore` is correct — or should appear but clearly ignored).

---

## STEP 4 — Report back

Confirm:
- `backend/.env` created
- `frontend/.env.local` created
- Both are gitignored (git status does not show them, or shows them as ignored)
- Remind the developer: "Replace SUPABASE_SERVICE_ROLE_KEY=PASTE_KEY_HERE
  in backend/.env with the real key from the Supabase dashboard
  (Settings → API → service_role key for project qoshtcbdrudbxwrxlfgx)."

---

## Files you are allowed to create:
1. `backend/.env`
2. `frontend/.env.local`

## Files you are allowed to edit (only if needed for Step 3):
1. `.gitignore` (root, backend, or frontend — whichever applies)

No other files should be touched.
