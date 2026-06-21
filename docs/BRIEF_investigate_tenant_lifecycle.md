Read docs/ZIVA_BI_ROADMAP.md and docs/MASTER_CONTEXT.md first, then follow this brief.

# Brief — Investigate existing tenant environment/lifecycle scaffolding (report only, no changes)

**Purpose:** Adeniyi wants a per-tenant implementation→live promotion workflow (a client configures/validates their setup in a staging/implementation environment, then promotes the proven configuration to live). Before designing this, we need to know exactly what already exists — the Tenants list shows `environment=live` and `lifecycle_status=in_implementation` coexisting on Red Bull, suggesting partial scaffolding. Investigate and report fully. Do NOT change any code.

---

## Investigate and report (no code changes)

1. **Tenant model:** `backend/app/models/tenant.py` (or wherever the Tenant model lives) — every field related to environment/lifecycle: `environment`, `lifecycle_status`, `parent_tenant_id`, and any others. Report exact field names, types, allowed values (enum/string set), and docstring/comments explaining intent.

2. **What does `environment` actually control?** Search the entire backend for every place `environment` is read or branched on (routers, services, middleware). Report each usage and what behavior it changes. Does it gate test vs live data anywhere? Does anything filter queries by environment?

3. **What does `lifecycle_status` actually control?** Same — every read/branch on `lifecycle_status` (values seen so far: "in_implementation", presumably "live"/"active" exists too — list ALL values used anywhere in code). What UI/permissions/behavior changes based on this status? (E.g. does the "Viewing X — Implementation" banner shown in the UI key off this?)

4. **`parent_tenant_id`:** what is this for? Is there any existing code that creates a child/staging tenant linked to a parent via this field? Any promote/clone/copy-config logic anywhere (search for "promote", "clone", "staging", "sandbox" in routers/services)? Report what exists, even if partial/unused.

5. **The `tenant_management.py` model + its router** (TenantInvitation table seen previously) — confirm if there's anything else tenant-lifecycle related here.

6. **The Super Admin Tenants UI** (`/platform/tenants`) — what data does it currently let Super Admin do regarding lifecycle/environment (create, change status, promote)? Report the page's current capabilities exactly.

7. **Search globally** for any half-built or planned promotion feature: grep for "implementation", "go-live", "go_live", "promote_to_live", "staging" across backend AND frontend. Report every hit with context — is it real logic, a TODO, a UI label only, or dead code?

8. Report current Red Bull tenant's exact values for these fields, and the Test Tenant's values too, for comparison.

---

## Output
Write the full findings to `docs/diagnosis_tenant_lifecycle.md`. Be thorough and literal — quote exact code where relevant rather than summarizing vaguely. This report will be used to design a real feature, so precision matters more than brevity. Do NOT propose a design — just report what exists.
