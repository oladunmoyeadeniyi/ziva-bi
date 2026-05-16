# Intelligent Categorization Engine (ICE) — PRD

> Part of Ziva BI. This PRD wins over any older version.  
> Last updated: May 2026

---

## 1. Purpose

ICE is Ziva BI's AI brain for financial classification. It reduces the manual work of selecting GL accounts, dimensions, and expense categories by learning from historical data and suggesting accurate classifications in real time.

ICE **never posts, never approves, never overrides humans.** It only suggests. Humans always decide.

---

## 2. The Problem It Solves

Without ICE, users must manually select:
- GL accounts
- Cost centers
- IO codes (Real, Statistical, Material)
- Location codes
- Expense categories
- Tax-related classifications

This causes:
- Human error → incorrect financial statements
- High cognitive load for non-finance staff
- Finance team spending hours correcting entries
- Slow approval cycles
- No learning from patterns over time

ICE fixes this by learning from every transaction and suggesting the right values — so users click to confirm instead of manually selecting from hundreds of options.

---

## 3. Scope

### V1.0 — What Gets Built

| Area | What ICE does |
|---|---|
| GL Prediction | Suggests most likely GL account per expense line |
| Dimension Prediction | Suggests Cost Center, Real IO, Stat IO, Material IO, Location |
| Category Prediction | Suggests expense category (Travel, Meals, etc.) |
| OCR Integration | Reads receipt/invoice text to inform predictions |
| Confidence Scoring | Rates each prediction: High (≥80%), Medium (50–79%), Low (<50%) |
| Human-in-the-loop | Employee → Approver → Finance must confirm before anything posts |
| Feedback Loop | Every correction feeds back into the model to improve it |
| Audit Logging | Every suggestion, acceptance, and override is logged immutably |
| Tenant Isolation | Each business tenant has its own isolated model and data |
| Governance Controls | Super Admin and Tenant Admin can activate, configure, and restrict ICE |

### Out of Scope — V1.0

- Auto-posting of any journal entry
- Auto-approval of any transaction
- Cross-tenant model training or shared learning
- Fraud detection (separate module)
- Real-time adaptive learning (V2+)
- Auto-blocking submissions without human validation
- Reconstructing missing/torn invoices

### Permanently Out of Scope (All Versions)

ICE will **never**:
- Post a journal entry autonomously
- Approve or reject any request
- Override tenant financial rules
- Train on another tenant's data
- Modify audit logs

---

## 4. Who Uses ICE

| Persona | How they interact with ICE |
|---|---|
| **Employee** | Sees AI suggestions when submitting expenses; accepts, edits, or rejects |
| **Line Manager / Approver** | Sees AI suggestion markers on each line; can override |
| **Finance Reviewer** | Validates every AI-influenced line before posting; corrections retrain the model |
| **Finance Manager** | Reviews AI accuracy reports; approves high-confidence patterns |
| **Tenant Admin** | Configures ICE for their company — thresholds, field rules, sensitive GLs |
| **Super Admin** | Activates ICE globally; monitors all tenants; manages model versions |
| **Internal/External Auditor** | Read-only access to AI logs and evidence bundles |
| **ICE Engine** (system actor) | Learns, predicts, scores, logs — cannot act on its own |

---

## 5. Architecture Overview

### Core Components

| Component | Role |
|---|---|
| **Feature Store** | Stores extracted attributes: OCR text, historical GLs, vendor/employee patterns |
| **Model Training Pipeline** | Prepares data, trains classification models, versions them |
| **Inference Engine** | Real-time: accepts input → returns predictions + confidence scores |
| **Confidence & Risk Scorer** | Evaluates prediction quality and policy conflicts |
| **Explainability Engine (XAI-lite)** | Shows why a GL was predicted (keywords, similar transactions) |
| **Feedback Loop Engine** | Captures every correction and feeds it into future retraining |
| **Tenant Config Gateway** | Enforces per-tenant rules — which fields AI may suggest, thresholds |
| **Model Registry** | Stores all model versions with performance history |
| **Data Privacy Isolation Layer** | Ensures zero cross-tenant data leakage |

### Data Flow (Simplified)

```
Expense Line Created
        ↓
OCR Processing (if receipt attached)
        ↓
Feature Extraction (embeddings, vendor/employee history, metadata)
        ↓
Inference Engine → GL + Dimension + Category predictions + Confidence scores
        ↓
UI shows suggestions to Employee (accept / edit / reject)
        ↓
Approver sees AI indicators → validates or overrides
        ↓
Finance Reviewer confirms or corrects → triggers posting
        ↓
All corrections → Feedback Loop Engine → Model improves
```

### Multi-Tenant Model Isolation

**V1.0 — Fully Isolated Models (default)**
- Each tenant has its own trained model
- No shared parameters between tenants
- Highest compliance and security

**Future — Shared Base + Tenant Fine-Tuning (V2)**  
**Future — Federated Learning (V3)**

---

## 6. Functional Requirements

### 6.1 GL Account Prediction

- Predict most likely GL account based on:
  - OCR text embeddings
  - Expense description (natural language)
  - Past expense-to-GL mappings for this tenant
  - Employee's historical GL choices
  - Vendor patterns
  - Policy rules
- AI suggestion must never override user input
- AI suggestions must be visually distinct in the UI
- System must record: suggested GL, user-accepted GL, final approved GL, confidence score

### 6.2 Dimension Prediction

- Predict all applicable dimensions:
  - Cost Center
  - Real IO
  - Statistical IO
  - Material IO
  - Location
- If a dimension is disabled for a tenant, ICE must not predict it
- Predictions must follow tenant configuration rules

### 6.3 Vendor Behavioral Learning

- Learn per-vendor patterns: typical GLs, dimensions, categories
- Vendor-specific patterns override tenant defaults when confidence > threshold
- Vendor profiles are tenant-scoped — never shared across tenants

### 6.4 OCR Integration

- Extract from receipts/invoices: invoice number, date, vendor name, amount, currency, description text
- Supported formats: JPG, PNG, PDF
- Generate embedding vectors from extracted text for model input
- Flag low-quality OCR output for manual correction
- OCR is a feature source — not the sole classifier

### 6.5 Confidence Scoring

| Level | Score | Action |
|---|---|---|
| High | ≥80% | Employee may accept with 1 click |
| Medium | 50–79% | Employee and Approver must review |
| Low | <50% | Employee must classify manually |

- Tenant Admin can override default thresholds
- UI must show confidence indicators clearly at all stages

### 6.6 User Interaction Rules

**Employee:**
- Must see AI suggestions with confidence indicator
- Must be able to accept, edit, or reject each suggestion
- Can disable AI suggestions if tenant permits

**Approver:**
- Must see fields marked as "AI Suggested"
- Can override any suggestion; override feeds the model

**Finance Reviewer:**
- Must confirm or correct every AI-influenced line before posting
- All corrections are captured as training feedback

### 6.7 Human-in-the-Loop (Non-negotiable)

- Every expense line must pass through: Employee → Approver → Finance
- No posting can occur without all three stages completing
- AI cannot bypass any stage

### 6.8 Retraining

Triggered by:
- Sufficient new correction data accumulated
- Super Admin manually initiates
- Tenant Admin requests
- Model accuracy drops below defined threshold

Retraining rules:
- Always creates a new model version (never overwrites old)
- Old versions retained for rollback and audit
- Retraining must not impact live inference

### 6.9 Audit Trail

Every ICE event logs:
- Model version used
- AI suggestion (GL, dimensions, category)
- Confidence score
- Who accepted or overrode (with role)
- Timestamp
- Override reason (if provided)
- Before and after values

Logs are append-only, immutable, retained minimum 7 years.

### 6.10 Error Handling

| Scenario | Behaviour |
|---|---|
| Model unavailable | Fall back to manual mode |
| OCR failure | Request manual input |
| Low confidence | Require manual classification |
| API failure | Retry with exponential backoff |
| Incomplete receipt | Partial prediction allowed; flagged |
| Foreign currency receipt | AI runs but flags currency mismatch |
| Rare expense category | Fall back to rule-based logic |

---

## 7. Workflows

### 7.1 Expense Line Classification

**Employee submits:**
1. Employee starts a new expense line
2. Attaches receipt → OCR runs
3. ICE receives: OCR text, amount, vendor name, description, employee ID, cost center
4. ICE returns: GL suggestion, dimension suggestions, category suggestion, confidence score
5. UI shows suggestions with confidence badges
6. Employee: accepts, edits, or rejects
7. Employee submits

**Approver reviews:**
8. Approver sees AI suggestion indicators and confidence levels
9. Approver: approves as-is, adjusts classification (feeds model), queries employee, or escalates

**Finance validates:**
10. Finance Reviewer validates GL accuracy, dimension validity, policy compliance
11. Finance: accepts, overrides, or sends back for correction
12. Final approval triggers posting stage
13. All corrections feed back into ICE

### 7.2 Feedback Loop

When a user corrects an AI suggestion:
1. System captures: old value, new value, reason (optional), user role
2. Stored in Feature Store
3. Evaluated during next retraining cycle
4. Model improves over time

### 7.3 Retraining

1. Trigger event fires (data threshold, manual request, accuracy drop)
2. Tenant dataset extracted (never mixed with other tenants)
3. Feature engineering re-runs
4. Old model version archived
5. New model trained, validated, versioned
6. Deployed to inference layer
7. Audit trail updated

### 7.4 Low Confidence Exception

If confidence < tenant threshold:
1. ICE highlights line in yellow
2. Employee must manually classify
3. Approver must validate manually
4. Finance must validate manually
5. Correction stored to improve future predictions

### 7.5 ICE Activation Flow

**Super Admin:**
1. Enables ICE globally
2. Sets minimum data thresholds (e.g. 30–90 days of history, minimum GL combinations)
3. Tenants become "AI-eligible" once thresholds are met

**Tenant Admin:**
4. Receives notification: "ICE Available"
5. Configures confidence thresholds, field permissions, sensitive GL restrictions
6. Enables ICE for their organisation

**End User:**
7. Notified: "AI Assistance Available"
8. Can enable or disable suggestions (if tenant permits)

---

## 8. Data Model

### 8.1 Design Principles

- `tenant_id` required on every ICE table
- No cross-tenant queries permitted
- Immutable audit logs
- Full traceability: prediction → acceptance/rejection → retraining
- Model versioning with rollback support

### 8.2 Core Tables

**`expense_line_features`**
- `feature_id` PK
- `tenant_id`
- `expense_line_id`
- `ocr_text`
- `ocr_embedding_vector`
- `normalized_amount`
- `category_hint`
- `vendor_name`
- `description_text`
- `employee_id`
- `cost_center`
- `timestamp_created`

**`vendor_behavior_profiles`**
- `vendor_profile_id` PK
- `tenant_id`
- `vendor_name`
- `top_gl_accounts` (array)
- `top_dimensions` (array)
- `pattern_strength_score`
- `sample_count`
- `last_updated`

**`employee_behavior_profiles`**
- `employee_profile_id` PK
- `tenant_id`
- `employee_id`
- `frequently_used_gl`
- `frequently_used_dimensions`
- `deviation_score`
- `last_updated`

**`ice_predictions`**
- `prediction_id` PK
- `tenant_id`
- `expense_line_id`
- `predicted_gl`
- `predicted_dimensions` (JSON)
- `confidence_score`
- `model_version`
- `timestamp`

**`ice_feedback`**
- `feedback_id` PK
- `tenant_id`
- `prediction_id` FK
- `corrected_gl`
- `corrected_dimensions` (JSON)
- `correction_reason`
- `corrected_by_user_id`
- `corrected_by_role`
- `timestamp`

**`model_registry`**
- `model_id` PK
- `tenant_id`
- `model_version`
- `training_accuracy`
- `validation_accuracy`
- `drift_score`
- `created_at`
- `activated_at`
- `deprecated_at` (nullable)
- `training_dataset_id`

**`embedding_store`**
- `embedding_id` PK
- `tenant_id`
- `expense_line_id`
- `raw_text`
- `vector` (float32 array, length 512)
- `embedding_model_version`
- `created_at`

**`training_dataset_snapshots`**
- `dataset_id` PK
- `tenant_id`
- `record_count`
- `feature_distribution_stats` (JSON)
- `created_at`

**`ice_tenant_config`**
- `config_id` PK
- `tenant_id`
- `ai_enabled` (boolean)
- `enabled_fields` (JSON — which fields ICE may suggest)
- `confidence_threshold_high` (default: 80)
- `confidence_threshold_low` (default: 50)
- `sensitive_gl_accounts` (JSON — GLs ICE must never suggest)
- `allow_user_disable` (boolean)
- `last_updated`

**`audit_log_ai`**
- `audit_id` PK
- `tenant_id`
- `event_type`
- `prediction_id` (nullable FK)
- `old_value`
- `new_value`
- `user_id`
- `user_role`
- `model_version`
- `timestamp`

### 8.3 Key Relationships

```
expense_line_features (1) ── (1) ice_predictions
ice_predictions (1) ── (0..1) ice_feedback
model_registry (1) ── (M) ice_predictions
ice_tenant_config (1) ── (M) ice_predictions
employee_behavior_profiles (1) ── (M) ice_feedback
vendor_behavior_profiles (1) ── (M) ice_predictions
embedding_store (1) ── (1) expense_line_features
audit_log_ai references ice_predictions & ice_feedback
```

### 8.4 Data Retention

| Data | Retention |
|---|---|
| Embeddings | 7 years (audit standard) |
| Predictions | 7 years |
| Feedback | Permanent (until tenant deletion) |
| Model versions | Indefinite (audit traceability) |
| Audit logs | 7 years minimum |

---

## 9. API Endpoints

### Design Principles
- RESTful JSON
- JWT authentication on all endpoints
- `tenant_id` validated against JWT claims on every request
- RBAC enforced per endpoint
- All calls logged

### Inference

```
POST /api/v1/ice/predict
```
Single-line prediction. Returns: `predicted_gl`, `predicted_dimensions`, `confidence_score`, `model_version`.

```
POST /api/v1/ice/predict/bulk
```
Batch prediction for up to 500 lines. Returns array of prediction objects.

### Feedback

```
POST /api/v1/ice/feedback
```
Submit a correction. Captures corrected GL, dimensions, who corrected, reason.

### Model Registry

```
GET  /api/v1/ice/models?tenant_id=TEN001        — list all versions
GET  /api/v1/ice/models/{model_id}               — get version metadata
POST /api/v1/ice/models/activate                 — activate a version
POST /api/v1/ice/models/deprecate                — deprecate a version
```

### Embeddings

```
POST /api/v1/ice/embeddings/create    — store embedding vector
GET  /api/v1/ice/embeddings/{id}      — retrieve embedding
```

### Configuration

```
GET  /api/v1/ice/config?tenant_id=TEN001   — get tenant AI config
POST /api/v1/ice/config/update             — update thresholds, field rules, etc.
```

### Super Admin

```
POST /api/v1/ice/global/activate    — enable ICE globally
GET  /api/v1/ice/global/stats       — global model health diagnostics
```

### Health

```
GET /api/v1/ice/health         — inference engine status
GET /api/v1/ice/diagnostics    — accuracy, drift, data completeness
```

### Error Format

```json
{
  "error_code": "ICE_403",
  "message": "Unauthorized access",
  "details": "...",
  "timestamp": "2026-01-01T12:00:00Z"
}
```

| Code | Meaning |
|---|---|
| ICE_400 | Bad request |
| ICE_401 | Authentication failed |
| ICE_403 | Forbidden |
| ICE_404 | Not found |
| ICE_409 | Conflict |
| ICE_429 | Rate limited |
| ICE_500 | Internal server error |
| ICE_503 | Model not available |

### Authorization by Role

| Role | Permitted Endpoints |
|---|---|
| Employee | predict, view suggestions |
| Approver | predict, feedback |
| Finance | predict, feedback, view model metadata |
| Tenant Admin | read/write config, view analytics |
| Super Admin | all endpoints |

---

## 10. Accounting & Posting Rules

### Non-negotiable Principles

1. ICE **never** posts a journal entry
2. ICE **never** bypasses human approval
3. ICE **never** overrides tenant financial rules
4. ICE **always** logs its influence
5. Posting requires full human validation at all three stages
6. Every posting must include AI metadata in the audit record

### Posting Metadata (stored on every posted line)

```json
{
  "ai_used": true,
  "ai_suggestions": { "gl": "742100", "cost_center": "CC120" },
  "ai_confidence": 87,
  "ai_model_version": "v1.0.5",
  "human_overrides": {
    "employee": false,
    "approver": true,
    "finance": false
  }
}
```

### Posting Blocker

If ICE detects suspicious patterns, low confidence, policy violation, or dimension anomaly → system flags "MANUAL REVIEW REQUIRED" and blocks posting until Finance approves or corrects.

### What ICE May Influence (per module)

| Module | ICE may suggest | ICE may NOT touch |
|---|---|---|
| Expense | GL, cost center, IO codes, location, category | Advance balance, overspend/underspend calc |
| AP (future) | GL per vendor line, WHT hint, dimensions | WHT calculation, VAT, final posting |
| AR (future) | Claim category, GL, reason code | Revenue recognition, customer receivables |
| Bank Rec | Category hint for transaction text | Matching rules, reconciliation logic |
| FX | Flag currency from OCR | FX rate, revaluation, tenant FX policy |

---

## 11. UI/UX Requirements

### General Rules

- AI suggestions must be visually distinct from user-entered values
- Confidence badges must be visible and intuitive
- Human overrides must require no more than one click
- Sensitive GL warnings must be shown prominently
- Tooltips must explain why a suggestion was made
- Mobile layout must support AI suggestions seamlessly
- WCAG 2.1 AA accessibility compliance

### Employee View

- Field border: soft blue glow when AI has suggested a value
- "Suggested by AI" tag on each predicted field
- Confidence badge: Green (≥80%), Yellow (50–79%), Red (<50%)
- Actions: Accept (1-click), Edit, Reject All AI
- Tooltip: "Why was this suggested?" available on every field

### Approver View

- AI suggestion tag visible on each line
- Confidence level shown
- Employee modifications highlighted (diff between AI suggestion and what employee entered)
- Actions: Approve as-is, Override, Request clarification, Escalate

### Finance Reviewer View

- Full AI influence audit trail visible
- Model version used
- Confidence details per line
- Warning badge for low-confidence lines
- Actions: Accept, Override, Add retraining note, Trigger exception workflow

### Tenant Admin Console

- AI enable/disable toggle
- Confidence threshold sliders
- Sensitive GL restrictions list
- Department-level controls
- Analytics: accuracy graphs, correction patterns, model drift alerts

### Super Admin Console

- Global activation toggle
- Minimum data threshold settings
- Retraining triggers
- Model version dashboard
- Cross-tenant health overview (aggregated — no raw tenant data)

### Explainability (XAI-lite) Panel

Shows per prediction:
- Top 5 keywords influencing the prediction
- Similar past transactions used as reference
- Reason code for the prediction
- Policy conflict explanation (if applicable)

### Error/Warning States

- Low confidence: yellow warning banner
- OCR failure: prompt for manual input
- Model unavailable: switch to manual mode with notification
- Policy conflict: red alert with explanation
- Duplicate pattern detected: flag with details

### Mobile Rules

- Linear field layout (no side-by-side columns)
- Swipe gesture to accept AI suggestion
- Minimalist confidence icons (no text, colour only)
- Sticky "Why suggested?" button
- Auto-launch mobile OCR on receipt upload

---

## 12. Security & Compliance

### Core Principles

- Zero cross-tenant data access
- Encryption at rest: AES-256
- Encryption in transit: TLS 1.2+
- Strict RBAC with least-privilege design
- Immutable, append-only audit logs
- Full AI influence transparency

### Multi-Tenant Isolation

- `tenant_id` required on every ICE table
- Embeddings stored in tenant-scoped partitions
- Model registry partitioned by tenant
- Feature store partitioned by tenant
- Super Admin sees only aggregated metadata — never raw tenant data

### Data Privacy (GDPR/NDPR)

- Right to be forgotten: employee data purged from training sets on request
- Pseudonymization where applicable
- No cross-border data movement unless tenant permits
- Data retention rules configurable per tenant

### Compliance Targets

SOC 2 Type II, ISO 27001, SOX (segregation of duties), GDPR, NDPR

### Forbidden AI Behaviours (Permanent — all versions)

ICE must **never**:
- Autonomously approve or reject requests
- Auto-post journals
- Modify financial records
- Alter audit logs
- Train across tenants
- Expose model internals to unauthorised users

---

## 13. Non-Functional Requirements

### Performance

| Metric | Target |
|---|---|
| Single-line inference | < 350ms (p95) |
| Bulk inference (500 lines) | < 2.5 seconds |
| OCR → ICE pipeline | < 1.2 seconds |
| Feedback ingestion | < 300ms |
| Model loading | < 800ms |

### Scalability

- 500,000+ expense lines per tenant per month
- 10M+ total predictions per month across all tenants
- 1,000 concurrent inference requests
- Auto-scale inference pods based on load

### Availability

- Inference API: 99.9% uptime
- Model registry: 99.9% uptime
- Automatic failover; RTO < 15 minutes; RPO < 5 minutes

### Storage (per tenant)

- Up to 5M embeddings
- Up to 3M predictions stored
- Up to 20GB training datasets
- Up to 500MB per model version

---

## 14. Configuration Options

### Super Admin Controls

- Enable/disable ICE globally
- Set minimum data thresholds for AI eligibility
- Set global default confidence thresholds
- Approve or reject model versions before deployment
- Force retraining or rollback
- Set drift detection thresholds

### Tenant Admin Controls

- Enable/disable ICE for their organisation
- Enable/disable per module (Expense, AP, AR, Bank Rec)
- Enable/disable AI suggestions per field (GL, Cost Center, IO, Location, Category)
- Set high/medium/low confidence thresholds
- Blacklist GLs from AI suggestion
- Set mandatory human review rules
- Configure department-level overrides
- Allow or restrict employees from disabling AI
- Set training frequency and data exclusions
- Set data retention and GDPR purge rules

### Employee Controls (if Tenant Admin permits)

- Enable or disable AI suggestions for their account
- Switch between "assist mode" and "strict mode"
- Show or hide explanation data

---

## 15. Reporting & Analytics

### Available Dashboards

| Dashboard | Who sees it | Key metrics |
|---|---|---|
| AI Accuracy | Tenant Admin, Finance | GL accuracy, dimension accuracy, accuracy by confidence band |
| Confidence Distribution | Tenant Admin | High/medium/low breakdown, trend over time |
| Override Trends | Tenant Admin, Finance | Overrides by role, GL, department, vendor |
| Drift Detection | Tenant Admin, Super Admin | Prediction drift %, drift by category |
| Bias Detection | Tenant Admin | Employee/department/vendor bias heatmaps |
| Retraining History | Super Admin, Tenant Admin | Dataset size, accuracy before/after, version history |
| ICE Audit Trail | Auditors, Finance | All suggestions, overrides, model version per transaction |
| SLA Analytics | Super Admin | Inference uptime, latency trends, feedback SLA |
| Exception Report | Finance, Tenant Admin | Low confidence lines, OCR failures, policy conflicts |

### Export Formats

PDF, Excel, CSV, JSON — all exports include: timestamp, tenant ID, filters applied, model version.

### Alerts

| Trigger | Notified |
|---|---|
| Model accuracy drops >10% | Tenant Admin |
| Prediction drift >15% | Tenant Admin |
| Prediction drift >25% | Super Admin + retraining recommended |
| High override rate spike | Tenant Admin |
| Inference latency exceeds SLA | Both admins |
| OCR failure rate spike | Both admins |

---

## 16. Integration Points

| System | ICE sends | ICE receives |
|---|---|---|
| Expense Module | GL + dimension + category suggestions, confidence | User overrides, corrections |
| AP Module (future) | GL suggestion per vendor line | Finance corrections |
| AR Module (future) | Claim category, GL, dimension | Finance corrections |
| Bank Rec | Category hint for transaction | Override |
| OCR Engine | (pulls from) | Raw text, metadata, confidence |
| Workflow Engine | Prediction metadata | Workflow stage for display |
| Dimensions Engine | (pulls from) | Valid dimension definitions, restrictions |
| Audit Engine | All AI events | (none — audit is write-only) |
| Notification Service | Drift alerts, accuracy drops, retraining notices | (none) |
| Super Admin Console | Global metrics, model health | Activation, threshold config |
| Tenant Admin Console | Accuracy data, override trends | ICE config changes |

**Fallback rule:** If ICE is unavailable for any reason, all dependent modules fall back to manual mode. No financial workflow is blocked — users simply classify manually.

---

## 17. Future Roadmap

> These are documented for planning only. Claude Code does not build these until formally scoped.

| Phase | Feature |
|---|---|
| V2 | Explainable AI (XAI) — natural language rationale per prediction |
| V2 | Confidence-level-based auto-routing in workflow |
| V2 | Predictive analytics (cost forecasting, budget deviation alerts) |
| V3 | Federated learning (cross-tenant learning without sharing raw data) |
| V3 | Deep AP integration — multi-line invoice auto-coding |
| V3 | Graph-based AI for vendor/employee relationship detection |
| V4 | On-device mobile OCR |
| V4 | Multilingual invoice scanning |
| V5 | Autonomous expense creation (employee only reviews final summary) |

---

## 18. Build Notes for Claude Code

ICE is a **late-stage module.** It must not be built until the following exist:

- ✅ Auth & User Management
- ✅ Tenant scaffolding
- ✅ Expense Management (at least basic submission flow)
- ✅ OCR layer (basic receipt reading)
- ✅ Dimensions Engine
- ✅ Workflow Engine

**When the time comes, build in this order:**

1. `ice_tenant_config` table + Tenant Admin toggle (on/off only)
2. Feature extraction service (pulls from existing expense line data)
3. Embedding generation for OCR text
4. Basic inference endpoint (rule-based first, ML model layered in)
5. Confidence scoring
6. UI suggestion display (employee view)
7. Feedback capture
8. Feedback loop → retraining pipeline
9. Approver and Finance UI markers
10. Audit logging
11. Reporting dashboards

**V1.0 ML approach:** Start with a simple gradient boosted classifier (e.g. XGBoost or LightGBM) trained on historical GL selections. Upgrade to transformer-based embeddings in V2.

MFA and advanced XAI are **not MVP** — build the hooks, don't block on them.

---

*End of PRD. Update this document just before building the ICE module.*
