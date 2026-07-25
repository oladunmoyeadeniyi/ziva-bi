# M10 — OCR & Receipt Scanning PRD

**Milestone:** M10  
**Module:** OCR & Receipt Scanning  
**Status:** Building (2026-07-25)  
**Mode scope:** All modes — mode-agnostic  
**Depends on:** M3–M9 Expense module (already shipped)  
**PRD authority:** This document. If it conflicts with MASTER_CONTEXT.md on scope, MASTER_CONTEXT.md wins on architecture; this document wins on M10 feature detail.

---

## 1. OVERVIEW

M10 adds **AI-powered receipt and invoice scanning** to the expense submission form. An employee taps a camera/upload icon on an expense line, uploads or photographs a receipt, and the system extracts all relevant financial fields — vendor, date, amount, currency, description, line items — and pre-fills the form instantly.

The AI model used is **Anthropic claude-haiku-4-5-20251001** via the Anthropic Messages API with vision capability. This model is fast (<3 s per image), cheap, and accurate enough for financial document extraction.

OCR is **mode-agnostic**: it works identically in Lite, Connected, and Full ERP mode. It does not affect GL posting or journal entries — it only pre-fills the form before the employee submits.

---

## 2. GOALS

1. Eliminate manual data entry from paper receipts and printed invoices.
2. Reduce submission time by 70 %+ for receipt-heavy expense reports.
3. Achieve <5 % error rate on amount extraction (by design: all extracted fields are editable before submission).
4. Work across Nigerian NGN receipts (dominant use case) and international receipts.
5. Provide a toggleable OCR switch per tenant (`ocr_enabled` on `TenantExpenseConfig`).

---

## 3. SCOPE

### 3.1 In Scope (M10)

| Feature | Detail |
|---|---|
| Receipt/invoice scan endpoint | `POST /api/ocr/receipt` — accepts image or PDF, returns structured JSON |
| Supported file types | JPEG, PNG, WEBP, PDF (first page) |
| Extracted fields | vendor_name, date, total_amount, currency, description, tax_amount, tax_type, line_items |
| Confidence scores | Per-field float 0.0–1.0 |
| OcrScanModal component | Upload zone + image preview + extracted data panel with editable fields |
| Expense form integration | Scan button on each line card (new and edit pages) |
| Apply to form | "Apply to this line" fills: amount, description, invoice_date (if date field exists), notes vendor |
| Multi-line suggestion | If line_items has >1 item, offer "Add as split lines" |
| Tenant toggle | `ocr_enabled BOOL DEFAULT TRUE` on `tenant_expense_config` |
| Expense config UI | OCR toggle card on Settings → Expense Config page |

### 3.2 Out of Scope (Phase 2 / future)

| Feature | Reason |
|---|---|
| OCR on AP invoices | Separate module — will be added when M11 matures |
| Continuous learning / feedback loop | Phase 2 — requires storing correction data |
| Duplicate invoice detection using OCR | Phase 2 |
| GL code prediction from extracted description | Phase 2 — needs training data |
| OCR on bank statements | Already handled by `bank_recon_parser.py` (CSV/XLSX, not images) |
| Multi-page PDF scanning | Phase 2 |
| Camera capture (native mobile) | Phase 2 — current upload-only is sufficient for MVP |

---

## 4. DATA MODEL

### 4.1 Schema Changes

**Migration `b0c1d2e3f4g5`** covers two things:

**A) `tenant_expense_config` — add OCR toggle**

| Column | Type | Default | Purpose |
|---|---|---|---|
| `ocr_enabled` | `BOOL NOT NULL` | `TRUE` | Consultant/admin toggle for OCR feature per tenant |

**B) New table: `ai_predictions`**

Required by AI Engine Module PRD §12 — every AI action must be auditable.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `tenant_id` | UUID FK → tenants | Multi-tenant isolation |
| `user_id` | UUID FK → users | Who triggered the prediction |
| `prediction_type` | TEXT | `'ocr'`, `'classify'`, `'duplicate'`, `'fraud'`, etc. |
| `source_document_id` | UUID nullable | FK → expense_documents if linked |
| `input_hash` | TEXT | SHA-256 of input (dedup / replay protection) |
| `model_used` | TEXT | e.g. `'claude-haiku-4-5-20251001'` |
| `prediction_json` | JSONB | Full extraction result |
| `confidence_overall` | NUMERIC(5,4) | 0.0000–1.0000 |
| `accepted` | BOOL nullable | NULL = not yet acted on; True = accepted; False = overridden |
| `created_at` | TIMESTAMPTZ | auto |

**C) New table: `ai_learning_overrides`** (stub for M20 — created now, populated later)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `prediction_id` | UUID FK → ai_predictions | |
| `tenant_id` | UUID FK → tenants | |
| `user_id` | UUID FK → users | Finance reviewer who overrode |
| `field_name` | TEXT | Which field was overridden |
| `original_value` | JSONB | AI's suggestion |
| `override_value` | JSONB | What Finance chose instead |
| `created_at` | TIMESTAMPTZ | auto |

### 4.2 tenant_expense_config additions (summary)

| Column | Type | Default | Purpose |
|---|---|---|---|
| `ocr_enabled` | `BOOL NOT NULL` | `TRUE` | Consultant/admin toggle for OCR feature per tenant |

---

## 5. API DESIGN

> The AI Engine Module PRD (§9) specifies a central `/api/ai/` router as the hub for all AI features. M10 builds the first endpoint in that router. Subsequent milestones (M20) will add `/api/ai/classify`, `/api/ai/detect-duplicate`, `/api/ai/reconcile`, etc.

### 5.1 POST /api/ai/ocr

**Auth:** JWT required (any authenticated user)  
**Request:** `multipart/form-data`  

| Field | Type | Required | Description |
|---|---|---|---|
| `file` | UploadFile | ✅ | Image (JPEG/PNG/WEBP) or PDF — max 10 MB |
| `tenant_currency` | string (query param) | ❌ | ISO currency hint (e.g. `NGN`). Used as fallback if OCR cannot detect currency. |

**Response 200:**
```json
{
  "vendor_name": "Shell Nigeria Limited",
  "vendor_name_confidence": 0.92,
  "date": "2026-07-24",
  "date_confidence": 0.88,
  "total_amount": 45500.00,
  "total_amount_confidence": 0.97,
  "currency": "NGN",
  "currency_confidence": 0.85,
  "description": "Fuel purchase — PMS",
  "description_confidence": 0.80,
  "tax_amount": null,
  "tax_type": null,
  "line_items": [
    {
      "description": "Premium Motor Spirit (PMS)",
      "quantity": 60.26,
      "unit_price": 755.0,
      "amount": 45496.30,
      "confidence": 0.90
    }
  ],
  "raw_text": "SHELL SERVICE STATION ... TOTAL: ₦45,500.00",
  "ocr_model": "claude-haiku-4-5-20251001",
  "processing_ms": 1842
}
```

**Error responses:**
- `400` — Unsupported file type
- `400` — File too large (>10 MB)
- `400` — OCR disabled for this tenant (`ocr_enabled = False`)
- `503` — Anthropic API unavailable (with `retry_after` hint)

### 5.2 POST /api/ai/override (stub — M20 implements fully)

Records a finance override of an AI prediction to feed the learning loop. In M10 this endpoint is created as a stub returning `{"status": "recorded"}` — the actual learning engine ships in M20.

**Body:** `{ prediction_id: uuid, field: string, original_value: any, override_value: any }`

### 5.3 PATCH /api/expense-config (updated)

`ocr_enabled: bool` added to `TenantExpenseConfigCreate` and `TenantExpenseConfigResponse`.

### 5.4 GET /api/expense-config/form-config (updated)

Returns `ocr_enabled: bool` so the expense form can conditionally show the scan button without an extra API call.

---

## 6. SERVICE DESIGN (backend/app/services/ocr.py)

### 6.1 Anthropic Vision API call

```python
client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

response = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=2048,
    messages=[{
        "role": "user",
        "content": [
            {
                "type": "image",   # or "document" for PDF
                "source": {
                    "type": "base64",
                    "media_type": mime_type,
                    "data": base64_data,
                }
            },
            {"type": "text", "text": EXTRACTION_PROMPT}
        ]
    }]
)
```

### 6.2 Extraction Prompt

```
You are a financial document extraction engine. Extract all financial data from this receipt or invoice.

Return ONLY a valid JSON object — no explanation, no markdown fences, no text outside the JSON.

Required fields (set to null if not found or unclear):
{
  "vendor_name": string | null,
  "vendor_name_confidence": float (0.0-1.0),
  "date": "YYYY-MM-DD" | null,
  "date_confidence": float,
  "total_amount": number | null (no currency symbols, pure numeric),
  "total_amount_confidence": float,
  "currency": "ISO 4217 code" | null (e.g. "NGN", "USD", "GBP"),
  "currency_confidence": float,
  "description": string | null (concise summary: what was purchased, max 120 chars),
  "description_confidence": float,
  "tax_amount": number | null,
  "tax_type": string | null (e.g. "VAT", "WHT"),
  "line_items": [
    {
      "description": string,
      "quantity": number | null,
      "unit_price": number | null,
      "amount": number,
      "confidence": float
    }
  ],
  "raw_text": string (full text extracted from the document, verbatim)
}

Rules:
- Remove all currency symbols (₦, $, £, €) from amounts — return pure numbers.
- Use ISO 4217 for currency (NGN for Naira, USD for US Dollar, GBP for Pound, EUR for Euro).
- If the document is in Nigerian Naira and no currency is shown, set currency = "NGN" with confidence 0.7.
- date must be formatted as YYYY-MM-DD. If only month/year is visible, use the first day of the month.
- total_amount is the grand total payable (after tax, after discounts).
- If the receipt is a photo of a screen/POS terminal, extract the displayed amount.
- If you cannot extract a field reliably, set it to null and set its confidence to 0.0.
- Confidence of 0.95+ means you are certain. 0.70–0.94 means probable. Below 0.70 means uncertain.
```

### 6.3 PDF handling

For PDF files, use the Anthropic `document` content type:
```python
{
    "type": "document",
    "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": base64_pdf,
    }
}
```
Only the first page is processed (Anthropic API handles PDF page selection internally for single-page extraction).

### 6.4 Error handling

- Anthropic `APIConnectionError` → 503 response
- Anthropic `RateLimitError` → 429 response (surface `retry-after` header)
- Anthropic `APIStatusError` → 502 response
- JSON parse failure on model response → return partial result with `parse_error: true` flag
- If `ANTHROPIC_API_KEY` is blank → 501 `"OCR service not configured"` (graceful — doesn't crash)

---

## 7. FRONTEND DESIGN

### 7.1 OcrScanModal Component

**File:** `frontend/src/components/expenses/OcrScanModal.tsx`

**Props:**
```ts
interface OcrScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: OcrApplyData) => void;
  currencyHint?: string;   // functional currency — sent as query param
}

interface OcrApplyData {
  amount?: number;
  description?: string;
  invoice_date?: string;   // YYYY-MM-DD
  vendor_name?: string;
  line_items?: OcrLineItem[];  // only when user requests "add as split lines"
}
```

**States:**
1. **Upload** — drag-and-drop zone (Tabler `ti-scan` icon) + "Choose file" button
2. **Scanning** — spinner + "Extracting data..." message
3. **Results** — two-column layout:
   - Left: image thumbnail preview
   - Right: extracted fields panel (editable inputs with confidence badges)
4. **Error** — error message + retry button

**Extracted fields shown in results panel:**
| Field | Input type | Shown if |
|---|---|---|
| Vendor | text (readonly) | vendor_name ≠ null |
| Date | date input (pre-filled) | date ≠ null |
| Amount | number input (pre-filled) | total_amount ≠ null |
| Currency | text (readonly) | currency ≠ null |
| Description | textarea (pre-filled) | description ≠ null |
| VAT/Tax | number (readonly) | tax_amount ≠ null |
| Line items | collapsible table | line_items.length > 1 |

**Confidence badge colours:**
- `≥ 0.90` → green `bg-green-50 text-green-700` "High"
- `0.70–0.89` → amber `bg-amber-50 text-amber-700` "Medium"
- `< 0.70` → red `bg-red-50 text-red-700` "Low — verify"

**Actions:**
- "Apply to this line" — fills the parent line's amount + description + invoice_date
- "Add as split lines" (only shown when line_items.length > 1) — creates multiple split lines from line_items
- "Cancel" — closes modal, no changes

### 7.2 Expense Form Integration

**Trigger:** Small camera/scan icon button on each line card (shown when `formConfig.ocr_enabled === true`)

**Placement on the line card:** In the line card header row, alongside the existing "Delete line" button. Icon: `ti-scan` (Tabler). Tooltip: "Scan receipt".

**Pages modified:**
- `frontend/src/app/dashboard/business/expenses/new/page.tsx`
- `frontend/src/app/dashboard/business/expenses/[report_id]/edit/page.tsx`

**Integration logic:**
1. User clicks scan icon on line N
2. `OcrScanModal` opens (bound to line N index)
3. After apply: `setLines(...)` updates line N with extracted values
4. Modal closes

### 7.3 Expense Config UI

**Page:** `frontend/src/app/dashboard/business/settings/expense-config/page.tsx`

Add an "OCR & Receipt Scanning" toggle card below the existing coding-level cards:
- Toggle on/off (`ocr_enabled`)
- Description: "When enabled, employees can scan receipts directly from the expense form. Uses Anthropic AI to extract vendor, date, amount, and line items."
- PATCH to `/api/expense-config` on save

---

## 8. ENVIRONMENT VARIABLES

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes (for OCR) | Anthropic API key. If blank, OCR endpoint returns 501. |

Add to:
- `backend/.env.example`
- `backend/app/config.py` (`anthropic_api_key: str = ""`)
- `render.yaml` (sync: false)

---

## 9. DEPENDENCY

Add to `requirements.txt`:
```
anthropic>=0.40.0
```

---

## 10. ACCEPTANCE CRITERIA

- [ ] `POST /api/ocr/receipt` with a JPEG receipt returns extracted JSON within 5 s
- [ ] Extracted `total_amount` matches receipt total with 0 formatting errors (pure number, no ₦)
- [ ] With `ocr_enabled = False`, endpoint returns 400 "OCR is disabled for this tenant"
- [ ] Scan button appears on expense lines when `formConfig.ocr_enabled = true`
- [ ] After applying OCR result, line amount, description, and date are pre-filled
- [ ] If line_items.length > 1, "Add as split lines" button appears in modal
- [ ] `tsc --noEmit` 0 errors
- [ ] `py_compile` clean on all new backend files
- [ ] `ANTHROPIC_API_KEY=""` → 501 response, no crash
- [ ] Confidence badges show correct colour coding (green/amber/red)

---

## 11. DEFERRED (tracked — not blocking M10 ship)

| # | Item | When |
|---|---|---|
| D1 | OCR correction feedback loop (store accepted vs rejected suggestions) | Phase 2 |
| D2 | GL code prediction from vendor+description using Anthropic | Phase 2 (after sufficient data) |
| D3 | AP invoice OCR (vendor invoice scanning on AP new invoice form) | After M11 matures |
| D4 | Multi-page PDF (>1 page extraction) | Phase 2 |
| D5 | Camera capture (PWA getUserMedia) | Phase 2 |
| D6 | OCR on bank statement images (as alternative to CSV import) | Phase 2 |

---

*PRD written 2026-07-25 before any M10 code was written. Per CLAUDE.md requirement.*
