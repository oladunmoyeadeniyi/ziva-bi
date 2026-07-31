# BRIEF: Mode-Aware Implementation Portal (Sidebar + Pages)

**Status:** Approved — build next  
**Date:** 2026-07-13  
**Relates to:** Three-Mode Architecture (§3b, §4.2 of MASTER_CONTEXT.md)

---

## Problem

Task #51 made the **setup dashboard checklist** mode-aware (which steps appear, which are blocking). But the **sidebar navigation** and **individual pages** remain mode-blind:

- A Lite-mode tenant sees sidebar links for Chart of Accounts, Dimensions, Account Mapping, Tax, Currencies — none of which apply to them
- Direct URL navigation to those pages still renders the full page
- Expense coding config shows all 5 GL coding levels even in Lite (no GL exists)

Result: consultants waste time on irrelevant config; the product looks misconfigured for the mode.

---

## Goal

The implementation portal sidebar and each setup page must reflect only what applies to the tenant's `posting_mode`. A Lite-mode consultant opens the sidebar and sees exactly what they need to configure — nothing else.

---

## Mode visibility rules (from MASTER_CONTEXT §4.2 — authoritative)

| Section | Lite | Connected | Full ERP |
|---|---|---|---|
| Organisation | ✅ | ✅ | ✅ |
| Module Activation | ✅ | ✅ | ✅ |
| Chart of Accounts | ❌ hidden | ✅ | ✅ |
| Dimensions | ❌ hidden | ✅ optional | ✅ |
| Employees | ✅ | ✅ | ✅ |
| Currencies & FX | ❌ hidden | ✅ optional | ✅ |
| Tax & Statutory | ❌ hidden | ✅ optional | ✅ |
| Roles & Permissions | ✅ | ✅ | ✅ |
| Approval Workflows | ✅ | ✅ | ✅ |
| Account Mapping | ❌ hidden | ✅ | ✅ |
| Bank Accounts | ✅ optional | ✅ optional | ✅ optional |
| Accounting Periods | ✅ optional | ✅ optional | ✅ optional |
| Document Rules | ✅ optional | ✅ optional | ✅ |
| Module Setup | ✅ | ✅ | ✅ |
| Readiness & Go-live | ✅ | ✅ | ✅ |

> Bank Accounts and Accounting Periods remain visible in all modes (they're optional but may legitimately be needed — e.g. bank details for expense reimbursement in Lite, periods for internal audit trail).

---

## What to build

### Build 1 — Extend layout.tsx to read posting_mode

**File:** `frontend/src/app/dashboard/business/layout.tsx`

The sidebar already fetches `/api/setup/org` and reads `org_configuration` for `use_dimensions` and `use_multi_currency`. Extend this:

```typescript
// Current state type
const [orgConfig, setOrgConfig] = useState<{
  use_dimensions?: boolean;
  use_multi_currency?: boolean;
} | null>(null);

// Extend to:
const [orgConfig, setOrgConfig] = useState<{
  use_dimensions?: boolean;
  use_multi_currency?: boolean;
} | null>(null);
const [postingMode, setPostingMode] = useState<'lite' | 'connected' | 'full_erp' | null>(null);
```

`/api/setup/org` already returns `posting_mode` at the top level of the response (not inside `org_configuration`). Parse it alongside the existing fetch:

```typescript
const data = await apiFetch<{
  org_configuration?: { use_dimensions?: boolean; use_multi_currency?: boolean };
  posting_mode?: string;
}>("/api/setup/org", { token: accessToken });

if (data.org_configuration) setOrgConfig(data.org_configuration);
if (data.posting_mode) setPostingMode(data.posting_mode as 'lite' | 'connected' | 'full_erp');
```

---

### Build 2 — Mode-conditional sidebar nav items

**File:** `frontend/src/app/dashboard/business/layout.tsx`

Using the rules table above, wrap the relevant nav links:

```tsx
{/* Chart of Accounts — hidden in Lite */}
{postingMode !== 'lite' && (
  <NavLink href="/dashboard/business/settings/chart-of-accounts" label="Chart of accounts" icon="file-spreadsheet" />
)}

{/* Dimensions — hidden in Lite; existing use_dimensions check still applies in Connected/Full ERP */}
{postingMode !== 'lite' && orgConfig?.use_dimensions && (
  <NavLink href="/dashboard/business/settings/dimensions" label="Dimensions" icon="vector" />
)}

{/* Currencies & FX — hidden in Lite; existing use_multi_currency check still applies */}
{postingMode !== 'lite' && orgConfig?.use_multi_currency && (
  <NavLink href="/dashboard/business/setup/currencies" label="Currencies & FX" icon="currency-dollar" />
)}

{/* Tax & Statutory — hidden in Lite */}
{postingMode !== 'lite' && (
  <NavLink href="/dashboard/business/setup/tax" label="Tax & statutory" icon="receipt-tax" />
)}

{/* Account Mapping — hidden in Lite */}
{postingMode !== 'lite' && (
  <NavLink href="/dashboard/business/setup/account-mapping" label="Account mapping" icon="arrows-transfer-up" />
)}
```

Bank Accounts and Accounting Periods keep their existing nav links (no mode gate).

> **Fallback while loading:** If `postingMode` is null (still fetching), default to showing all links. Never hide links just because the fetch is in progress.

---

### Build 3 — Page-level mode guard component

**New file:** `frontend/src/components/ModeNotAvailable.tsx`

Renders when a user navigates directly to a page that is hidden for their mode (e.g. typing the URL):

```tsx
interface ModeNotAvailableProps {
  pageName: string;           // e.g. "Chart of Accounts"
  availableIn: string[];      // e.g. ["Connected", "Full ERP"]
  currentMode: string;        // e.g. "lite"
}
```

**Visual design:**
- Grey/neutral — not an error, not a warning; just informational
- Icon: lock or info circle (Tabler outline)
- Heading: `"[Page Name] is not available in [Mode Label] mode"`
- Body: `"This section is available in [Available In] mode. Your posting mode is set by your PRAD consultant in the system configuration."`
- Single button: `"Back to setup dashboard"` → navigates to `/dashboard/business/setup`

Mode display labels:
```typescript
const MODE_LABELS = {
  lite: 'Lite',
  connected: 'Connected',
  full_erp: 'Full ERP',
};
```

---

### Build 4 — Apply mode guard to relevant pages

Each hidden-in-Lite page fetches its own data anyway — the cleanest approach is to fetch `posting_mode` inside the page (from `/api/setup/org` which it likely already calls, or a simple separate fetch) and conditionally render `<ModeNotAvailable>` before the main content.

**Pages to guard:**

| Page file | Guard condition | availableIn |
|---|---|---|
| `settings/chart-of-accounts/page.tsx` | `postingMode === 'lite'` | `["Connected", "Full ERP"]` |
| `settings/dimensions/page.tsx` | `postingMode === 'lite'` | `["Connected", "Full ERP"]` |
| `setup/currencies/page.tsx` | `postingMode === 'lite'` | `["Connected", "Full ERP"]` |
| `setup/tax/page.tsx` | `postingMode === 'lite'` | `["Connected", "Full ERP"]` |
| `setup/account-mapping/page.tsx` | `postingMode === 'lite'` | `["Connected", "Full ERP"]` |

**Pattern for each page:**

```tsx
// Near the top of the page, after fetching org data:
if (postingMode === 'lite') {
  return (
    <PageContainer>
      <ModeNotAvailable
        pageName="Chart of Accounts"
        availableIn={["Connected", "Full ERP"]}
        currentMode="lite"
      />
    </PageContainer>
  );
}
```

Each of these pages already fetches `/api/setup/org` or has access to org config. Add `posting_mode` to the fetch type and extract it. If a page doesn't currently fetch org config, add a lightweight fetch — just `posting_mode` from the response.

---

### Build 5 — Expense coding level lock in Lite mode

**File:** `frontend/src/app/dashboard/business/settings/expense-config/page.tsx`

In Lite mode, GL coding is meaningless (no GL exists). The coding level must be locked to 0.

**Changes:**
1. Fetch `posting_mode` from `/api/setup/org` (this page likely already fetches it or fetches expense config which may include mode)
2. If `postingMode === 'lite'`:
   - Show an amber `Banner` (variant="warning") above the coding level cards:
     > "GL coding is not available in Lite mode. Your expenses will be approved and exported without GL account coding. To enable GL coding, upgrade to Connected or Full ERP mode."
   - Disable all 5 coding level radio cards (greyed out, pointer-events: none)
   - If `coding_level` is currently > 0 (misconfigured), display the amber banner but do NOT auto-reset it server-side — just prevent the user from saving a level > 0. Show a note: "Your current coding level will be ignored in Lite mode."

---

## What NOT to change

- **Backend:** No changes. `posting_mode` is already on `OrgConfigResponse`. No new endpoints.
- **Setup dashboard checklist** (`setup/page.tsx`): Already mode-aware from task #51. Do not touch.
- **Expense form itself:** GL fields already don't appear when `coding_level = 0`. The lock on expense config (Build 5) enforces this indirectly.
- **Bank Accounts page:** Visible in all modes — no guard needed.
- **Accounting Periods page:** Visible in all modes — no guard needed.
- **Module Setup pages** (`setup/modules/*`): Visible in all modes — no guard needed.

---

## Files changed (summary)

| File | Change |
|---|---|
| `frontend/src/app/dashboard/business/layout.tsx` | Add `postingMode` state; parse from org fetch; wrap sidebar links |
| `frontend/src/components/ModeNotAvailable.tsx` | NEW — mode gate component |
| `frontend/src/app/dashboard/business/settings/chart-of-accounts/page.tsx` | Add mode guard |
| `frontend/src/app/dashboard/business/settings/dimensions/page.tsx` | Add mode guard |
| `frontend/src/app/dashboard/business/setup/currencies/page.tsx` | Add mode guard |
| `frontend/src/app/dashboard/business/setup/tax/page.tsx` | Add mode guard |
| `frontend/src/app/dashboard/business/setup/account-mapping/page.tsx` | Add mode guard |
| `frontend/src/app/dashboard/business/settings/expense-config/page.tsx` | Add coding level lock in Lite |

**No backend changes. No migrations. No new API endpoints.**

---

## Acceptance criteria

1. A Lite-mode tenant's sidebar shows NO links for CoA, Dimensions, Currencies, Tax, Account Mapping.
2. Navigating directly to `/settings/chart-of-accounts` in Lite mode shows `ModeNotAvailable`, not the CoA editor.
3. Same for all 4 other guarded pages.
4. Expense config page in Lite mode shows amber banner + disabled coding level cards.
5. A Connected or Full ERP tenant's sidebar is unchanged from today.
6. While `posting_mode` is loading (null), all links remain visible (no flash of missing links).
7. `tsc --noEmit` — 0 errors.

---

## Out of scope (defer)

- Mode-aware banners inside pages that ARE visible across modes (e.g. a "Periods are optional in Lite" note on the Periods page) — cosmetic, low value, do later.
- Posting Batches page (Connected-only) — already conditionally rendered in the expense flow; sidebar link not yet present at all.
- Dimension values sub-page (`/settings/dimensions/[id]/values`) — inherits the Dimensions page guard automatically.
