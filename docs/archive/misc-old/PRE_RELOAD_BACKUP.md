# CC Brief — Pre-OS-Reload Backup

## CRITICAL INSTRUCTIONS
This is a one-time operational task, not a code change. Do not modify any
application code. Execute the steps below in order and report results clearly.

---

## CONTEXT

The developer is about to reload their Windows OS. Everything in the git
repo (including `docs/`) must be pushed and confirmed clean. Files that are
NOT tracked by git (`.env` files, local database) must be backed up to a
folder on the Desktop so the developer can move them off-device before
reloading.

---

## STEPS

### Step 1 — Create backup folder

```powershell
mkdir C:\Users\oladu\Desktop\ziva-env-backup -ErrorAction SilentlyContinue
```

### Step 2 — Backup backend .env

```powershell
copy C:\Users\oladu\Projects\ziva-bi\backend\.env C:\Users\oladu\Desktop\ziva-env-backup\backend.env
```

### Step 3 — Backup any frontend env files

Check for and copy any of the following that exist:
```powershell
cd C:\Users\oladu\Projects\ziva-bi\frontend
dir .env*
```

For each file found (`.env`, `.env.local`, `.env.development.local`,
`.env.production.local` etc.), copy it to the backup folder preserving
its name, e.g.:
```powershell
copy .env.local C:\Users\oladu\Desktop\ziva-env-backup\frontend.env.local
```

If none exist, note that in the final report — this is expected and fine.

### Step 4 — Dump the PostgreSQL database

```powershell
$env:PGPASSWORD = "postgres"
pg_dump -U postgres -d ziva_dev -F c -f C:\Users\oladu\Desktop\ziva-env-backup\ziva_dev_backup.dump
```

If `pg_dump` is not recognized, find the correct path under
`C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe` and use the full path:
```powershell
$env:PGPASSWORD = "postgres"
& "C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe" -U postgres -d ziva_dev -F c -f C:\Users\oladu\Desktop\ziva-env-backup\ziva_dev_backup.dump
```

Verify the dump file was created and has a non-zero size.

### Step 5 — Ensure git is fully committed and pushed

```powershell
cd C:\Users\oladu\Projects\ziva-bi
git status
```

If anything is uncommitted (including anything under `docs/`):
```powershell
git add -A
git commit -m "chore: save all docs and pending changes before OS reload"
git push origin main
git status
```

Confirm the final output says `nothing to commit, working tree clean` and
`Your branch is up to date with 'origin/main'`.

### Step 6 — Final report

List the contents of the backup folder with file sizes:
```powershell
dir C:\Users\oladu\Desktop\ziva-env-backup
```

Report to the developer:
- Confirmation that `backend.env` was copied
- List of any frontend env files copied (or note that none exist)
- Confirmation that the database dump was created, with its file size
- Confirmation that git is clean and pushed
- A clear reminder: **"Copy the entire ziva-env-backup folder to a USB
  drive, cloud storage, or email it to yourself BEFORE reloading the OS —
  the Desktop will be wiped during reinstall."**

---

## Files you are allowed to change:
None — this is an operational backup task only. No application code,
configuration files, or documentation should be modified.
