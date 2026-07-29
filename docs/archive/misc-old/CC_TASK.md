# CC Task — Apply pending migration

Run:
```bash
cd backend
alembic upgrade head
```

Expected: migration `j1k2l3m4n5o6` applies, adding `lead_status`, `implementation_notes`, and `ix_tenants_lead_status` to the `tenants` table.

After running, write `docs/CC_RESULT.md` with the alembic output (success or error).
