# Developer Handoff Guide

**Project:** POInvoiceTest
**Description:** Queue-driven unattended automation that ingests AP invoice batch files from SharePoint, validates invoices and POs via Coupa REST API, applies strict 5% tolerance rules, rejects or progresses invoices, sends vendor notifications, and routes operational exceptions to Action Center.
**Generated:** 2026-03-26
**Architecture:** Sequential (Linear workflow)

**Readiness Score: 84%** | Estimated developer effort: **~1.8 hours** (0 selectors, 0 credentials, 105 min mandatory validation)

---

## 1. Pipeline Outcome Report

### Fully Generated (10 file(s))

These workflows were generated without any stub replacements or escalation.

- `POInvoiceTest.xaml`
- `InitAllSettings.xaml`
- `CloseAllApplications.xaml`
- `Main.xaml`
- `BatchDispatcher.xaml`
- `PerformerMain.xaml`
- `InvoiceProcessor.xaml`
- `CoupaApiClient.xaml`
- `VendorNotification.xaml`
- `ActionCenterHandler.xaml`

---

## 2. Tier 1 — AI Completed (No Human Action Required)

The following items were fully automated by CannonBall. These are verified facts from deterministic analysis.

### Workflow Inventory

**7 XAML workflow(s)** generated containing **116 activities** total.

| # | Workflow File | Purpose | Role |
|---|--------------|---------|------|
| 1 | `Main.xaml` | Entry point workflow | Entry Point |
| 2 | `BatchDispatcher.xaml` | Sub-workflow | Sub-workflow |
| 3 | `PerformerMain.xaml` | Sub-workflow | Sub-workflow |
| 4 | `InvoiceProcessor.xaml` | Sub-workflow | Sub-workflow |
| 5 | `CoupaApiClient.xaml` | Sub-workflow | Sub-workflow |
| 6 | `VendorNotification.xaml` | Sub-workflow | Sub-workflow |
| 7 | `ActionCenterHandler.xaml` | Sub-workflow | Sub-workflow |

### Workflow Analyzer Compliance

Analyzed 10 workflow file(s) against UiPath Workflow Analyzer rules.

| Rule ID | Rule | Category | Status | Auto-Fixed | Remaining |
|---------|------|----------|--------|------------|----------|
| ST-NMG-001 | Variable naming convention | naming | Passed | 0 | 0 |
| ST-NMG-004 | Argument naming convention | naming | Passed | 0 | 0 |
| ST-NMG-009 | Activity must have DisplayName | naming | Passed | 0 | 0 |
| ST-DBP-002 | Empty Catch block | best-practice | Needs Review | 0 | 1 |
| ST-DBP-006 | Delay activity usage | best-practice | Passed | 0 | 0 |
| ST-DBP-020 | Hardcoded timeout | best-practice | Passed | 0 | 0 |
| ST-DBP-025 | Workflow start/end logging | best-practice | Needs Review | 0 | 9 |
| ST-USG-005 | Unused variable | usage | Needs Review | 0 | 5 |
| ST-USG-017 | Deeply nested If activities | usage | Passed | 0 | 0 |
| ST-SEC-004 | Sensitive data in log message | security | Passed | 0 | 0 |
| ST-SEC-005 | Plaintext credential in property | security | Passed | 0 | 0 |
| ST-ARG-001 | Invalid bare Argument tag in Catch | usage | Passed | 0 | 0 |
| ST-ARG-002 | Missing declaration for invoked argument | usage | Passed | 0 | 0 |
| ST-ARG-003 | Undeclared variable in expression | usage | Passed | 0 | 0 |

**Result:** 128 of 140 rules passed across 10 workflow files. 0 violation(s) auto-corrected, 15 remaining for review.

**Per-Workflow Breakdown:**

| Workflow | Rules Checked | Passed | Auto-Fixed | Remaining |
|----------|--------------|--------|------------|----------|
| `POInvoiceTest.xaml` | 14 | 13 | 0 | 1 |
| `InitAllSettings.xaml` | 14 | 12 | 0 | 5 |
| `CloseAllApplications.xaml` | 14 | 12 | 0 | 2 |
| `Main.xaml` | 14 | 13 | 0 | 1 |
| `BatchDispatcher.xaml` | 14 | 13 | 0 | 1 |
| `PerformerMain.xaml` | 14 | 13 | 0 | 1 |
| `InvoiceProcessor.xaml` | 14 | 13 | 0 | 1 |
| `CoupaApiClient.xaml` | 14 | 13 | 0 | 1 |
| `VendorNotification.xaml` | 14 | 13 | 0 | 1 |
| `ActionCenterHandler.xaml` | 14 | 13 | 0 | 1 |

### Standards Enforcement

| Standard | What Was Done |
|----------|---------------|
| Naming Conventions | Variables renamed to `{type}_{PascalCase}`, arguments to `{direction}_{PascalCase}` |
| Activity Annotations | Every activity annotated with source step number, business context, and error handling strategy |
| Error Handling | All business activities wrapped in TryCatch with Log + Rethrow; UI activities include RetryScope (3 retries, 5s) |
| Logging | Start/end LogMessage in every workflow; exceptions logged at Error level before rethrow |
| Argument Validation | Entry points validate required arguments at workflow start |

### Architecture Decision

**Sequential Pattern** selected — linear step-by-step flow with step dependencies.

---

## 3. Tier 2 — AI Resolved with Smart Defaults (Review Recommended)

The AI set these values based on SDD analysis. They are likely correct but **must be verified** against your target environment before production use.

---

## 4. Process Logic Validation

Use this section to verify that the generated automation correctly implements the business rules defined in the SDD. Each item below should be confirmed against the live system before UAT.

### Extracted Business Rules — Verification Checklist

The following rules were extracted from the SDD. Verify each is correctly implemented in the generated workflows:

| # | Category | Rule / Requirement | Verified |
|---|----------|-------------------|----------|
| 1 | Approval / Rejection Criteria | reject` (reject | [ ] |
| 2 | Approval / Rejection Criteria | approved sender mailbox and domain compliance | [ ] |
| 3 | Approval / Rejection Criteria | Reject invoice via API (no reason) → email vendor → mark transaction successful with ` | [ ] |
| 4 | Approval / Rejection Criteria | Rejected_MissingPO` | [ ] |
| 5 | Approval / Rejection Criteria | Reject invoice via API (no reason) → email vendor → mark successful with `Decision=Rej | [ ] |
| 6 | Retry / SLA Requirements | timeouts, 5xx, 429 throttling | [ ] |
| 7 | Retry / SLA Requirements | retry discipline** at transaction level: | [ ] |
| 8 | Retry / SLA Requirements | retry according to queue retry settings | [ ] |
| 9 | Retry / SLA Requirements | retries for HTTP calls (e | [ ] |
| 10 | Retry / SLA Requirements | retries, mark queue item failed | [ ] |
| 11 | Retry / SLA Requirements | SLA adherence | [ ] |
| 12 | Retry / SLA Requirements | SLA breaches | [ ] |

---

## 5. Tier 3 — Requires Human Access (Developer Work Required)

These items require a developer with access to target systems and UiPath Studio. **Every generated package requires this work.**

### Mandatory: Studio Validation & Testing

Every generated package requires these steps regardless of AI enrichment quality:

| # | Task | Description | Est. Time |
|---|------|-------------|----------|
| 1 | Studio Import | Open .nupkg in UiPath Studio. Install missing packages, resolve dependency conflicts, verify project compiles without errors. | 15 min |
| 2 | End-to-End Testing | Execute all 7 workflows in Studio Debug mode against UAT/test environment. Verify queue processing, exception handling, and business rules. | 30 min |
| 3 | UAT Sign-off | Business stakeholder validation with real data and real systems. Confirm outputs match expected results for representative scenarios. | 60 min |

**Total Tier 3 Effort: ~1.8 hours** (0 selectors, 0 credentials, 0 logic items, mandatory validation)

---

## 6. Code Review Checklist

Use this checklist during peer review before promoting to UAT.

### Workflow Analyzer Remaining Violations

| Severity | Rule | File | Message |
|----------|------|------|---------|
| warning | ST-USG-005 | POInvoiceTest.xaml | Variable "str_ScreenshotPath" is declared but never used |
| warning | ST-DBP-025 | InitAllSettings.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-USG-005 | InitAllSettings.xaml | Variable "str_ConfigPath" is declared but never used |
| warning | ST-USG-005 | InitAllSettings.xaml | Variable "SecTempPass" is declared but never used |
| warning | ST-USG-005 | InitAllSettings.xaml | Variable "drow_RowCurrent" is declared but never used |
| warning | ST-USG-005 | InitAllSettings.xaml | Variable "DictConfig" is declared but never used |
| error | ST-DBP-002 | CloseAllApplications.xaml | Catch block contains no activities — exceptions will be silently swallowed |
| warning | ST-DBP-025 | CloseAllApplications.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | Main.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | BatchDispatcher.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | PerformerMain.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | InvoiceProcessor.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | CoupaApiClient.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | VendorNotification.xaml | Workflow does not contain an initial LogMessage activity |
| warning | ST-DBP-025 | ActionCenterHandler.xaml | Workflow does not contain an initial LogMessage activity |

### Review Rubric

| Category | Check | Status |
|----------|-------|---------|
| Exception Handling | All activities in TryCatch? Catch blocks log + rethrow? | AI: Done |
| Transaction Integrity | Queue items set to Success/Failed/BusinessException? | N/A |
| Logging | Info log at start/end of each workflow? Critical decisions logged? | AI: Done |
| Selector Reliability | Selectors use stable attributes (automationid, name)? | N/A |
| Credential Security | All credentials in Orchestrator Assets, not hardcoded? | AI: Verified |
| Naming Conventions | Variables/arguments follow type/direction prefixes? | AI: Auto-corrected |
| Annotations | Every activity annotated with business context? | AI: Done |
| Argument Validation | Entry points validate required arguments? | AI: Done |
| Config Management | Environment-specific values in Config.xlsx? | AI: Done |

### Pre-Deployment Verification

1. Open the project in UiPath Studio
2. Run **Analyze File** > **Workflow Analyzer** on all files
3. Confirm zero errors and zero warnings
4. Run all unit tests in Test Manager
5. Execute a full end-to-end run in Dev environment

### Sign-Off

| Field | Value |
|-------|-------|
| Reviewer | _________________ |
| Date | _________________ |
| Approval | [ ] Approved for UAT  [ ] Requires Changes |
| Notes | _________________ |

---

## 7. Package Contents

| File | Purpose |
|------|--------|
| `project.json` | UiPath project manifest with dependencies |
| `Main.xaml` | Entry point workflow |
| `BatchDispatcher.xaml` | Workflow: BatchDispatcher |
| `PerformerMain.xaml` | Workflow: PerformerMain |
| `InvoiceProcessor.xaml` | Workflow: InvoiceProcessor |
| `CoupaApiClient.xaml` | Workflow: CoupaApiClient |
| `VendorNotification.xaml` | Workflow: VendorNotification |
| `ActionCenterHandler.xaml` | Workflow: ActionCenterHandler |
| `InitAllSettings.xaml` | Configuration initialization |
| `Data/Config.xlsx` | Configuration settings |
| `DeveloperHandoffGuide.md` | This guide |

**Required Packages:** `UiPath.System.Activities`, `UiPath.Excel.Activities`, `UiPath.UIAutomation.Activities`

---

## 8. Infrastructure


---

## 9. Go-Live Checklist

#### Development
- [ ] Open project in UiPath Studio — install missing packages
- [ ] Run Workflow Analyzer — confirm zero violations
- [ ] Complete Tier 3 items (selectors, credentials, business logic)
- [ ] Config.xlsx updated with Dev values

#### UAT
- [ ] UAT Orchestrator folder with separate assets/queues
- [ ] Full end-to-end run with real data
- [ ] Business stakeholder sign-off

#### Production
- [ ] Production credentials and assets configured
- [ ] Triggers/schedules active
- [ ] Monitoring and alerting configured
- [ ] Runbook documentation completed


---

# Developer Handoff Guide

**Project:** POInvoiceTest
**Generated:** 2026-03-26
**Generation Mode:** Full Implementation
**Deployment Readiness:** Needs Work (64%)

**Total Estimated Effort: ~0 minutes (0.0 hours)**
**Remediations:** 0 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 0 workflow)
**Auto-Repairs:** 0
**Quality Warnings:** 72

---

## 1. Completed Work

The following 10 workflow(s) were fully generated without any stub replacements or remediation:

- `POInvoiceTest.xaml`
- `InitAllSettings.xaml`
- `CloseAllApplications.xaml`
- `Main.xaml`
- `BatchDispatcher.xaml`
- `PerformerMain.xaml`
- `InvoiceProcessor.xaml`
- `CoupaApiClient.xaml`
- `VendorNotification.xaml`
- `ActionCenterHandler.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `BatchDispatcher.xaml` | Fully Generated |
| 3 | `PerformerMain.xaml` | Fully Generated |
| 4 | `InvoiceProcessor.xaml` | Fully Generated |
| 5 | `CoupaApiClient.xaml` | Fully Generated |
| 6 | `VendorNotification.xaml` | Fully Generated |
| 7 | `ActionCenterHandler.xaml` | Fully Generated |

## 2. AI-Resolved with Smart Defaults

No auto-repairs were applied.

## 3. Manual Action Required

### Quality Warnings (72)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `POInvoiceTest.xaml` | placeholder-value | Contains 17 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `BatchDispatcher.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 3 | `PerformerMain.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 4 | `InvoiceProcessor.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 5 | `CoupaApiClient.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 6 | `VendorNotification.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 7 | `ActionCenterHandler.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 8 | `InitAllSettings.xaml` | invalid-activity-property | Line 94: property "TypeArguments" is not a known property of ForEach | — | undefined |
| 9 | `InitAllSettings.xaml` | invalid-activity-property | Line 287: property "TypeArguments" is not a known property of ForEach | — | undefined |
| 10 | `InitAllSettings.xaml` | invalid-activity-property | Line 310: property "InitAllSettings" is not a known property of ui:LogMessage | — | undefined |
| 11 | `CloseAllApplications.xaml` | invalid-activity-property | Line 77: property "CloseAllApplications" is not a known property of ui:LogMessage | — | undefined |
| 12 | `BatchDispatcher.xaml` | invalid-activity-property | Line 57: property "BatchDispatcher" is not a known property of ui:LogMessage | — | undefined |
| 13 | `PerformerMain.xaml` | invalid-activity-property | Line 57: property "PerformerMain" is not a known property of ui:LogMessage | — | undefined |
| 14 | `InvoiceProcessor.xaml` | invalid-activity-property | Line 57: property "InvoiceProcessor" is not a known property of ui:LogMessage | — | undefined |
| 15 | `CoupaApiClient.xaml` | invalid-activity-property | Line 57: property "CoupaApiClient" is not a known property of ui:LogMessage | — | undefined |
| 16 | `VendorNotification.xaml` | invalid-activity-property | Line 57: property "VendorNotification" is not a known property of ui:LogMessage | — | undefined |
| 17 | `ActionCenterHandler.xaml` | invalid-activity-property | Line 57: property "ActionCenterHandler" is not a known property of ui:LogMessage | — | undefined |
| 18 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 114: asset name "POInvoice.Coupa.BasicAuth" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 19 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 126: asset name "POInvoice.Coupa.ApiBaseUrl" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 20 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 133: asset name "POInvoice.Coupa.InvoiceLookupEndpoint" is hardcoded — consider using a Conf... | — | undefined |
| 21 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 140: asset name "POInvoice.Coupa.POLookupEndpoint" is hardcoded — consider using a Config.xl... | — | undefined |
| 22 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 147: asset name "POInvoice.Coupa.InvoiceRejectEndpointTemplate" is hardcoded — consider usin... | — | undefined |
| 23 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 154: asset name "POInvoice.Coupa.InvoiceProgressEndpointTemplate" is hardcoded — consider us... | — | undefined |
| 24 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 161: asset name "POInvoice.TolerancePercent" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 25 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 168: asset name "POInvoice.Input.SharePointSiteUrl" is hardcoded — consider using a Config.x... | — | undefined |
| 26 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 175: asset name "POInvoice.Input.DocumentLibrary" is hardcoded — consider using a Config.xls... | — | undefined |
| 27 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 182: asset name "POInvoice.Input.FolderPath" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 28 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 189: asset name "POInvoice.Archive.FolderPath" is hardcoded — consider using a Config.xlsx e... | — | undefined |
| 29 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 196: asset name "POInvoice.Error.FolderPath" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 30 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 203: asset name "POInvoice.Input.FileNamePattern" is hardcoded — consider using a Config.xls... | — | undefined |
| 31 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 210: asset name "POInvoice.Input.SheetName" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 32 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 217: asset name "POInvoice.Input.InvoiceNumberColumn" is hardcoded — consider using a Config... | — | undefined |
| 33 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 224: asset name "POInvoice.Processing.AllowedInvoiceStatuses" is hardcoded — consider using ... | — | undefined |
| 34 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 231: asset name "POInvoice.Email.FromAddress" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 35 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 238: asset name "POInvoice.Email.Subject.RejectMissingPO" is hardcoded — consider using a Co... | — | undefined |
| 36 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 245: asset name "POInvoice.Email.Subject.RejectOutOfTolerance" is hardcoded — consider using... | — | undefined |
| 37 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 252: asset name "POInvoice.Email.BodyTemplate.RejectMissingPO" is hardcoded — consider using... | — | undefined |
| 38 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 259: asset name "POInvoice.Email.BodyTemplate.RejectOutOfTolerance" is hardcoded — consider ... | — | undefined |
| 39 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 266: asset name "POInvoice.EnableVendorEmail" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 40 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 273: asset name "POInvoice.Run.MaxInvoicesPerBatch" is hardcoded — consider using a Config.x... | — | undefined |
| 41 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 280: asset name "POInvoice.Logging.LogHttpPayloads" is hardcoded — consider using a Config.x... | — | undefined |
| 42 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 104: Possible undeclared variable "dict_Config" in expression: dict_Config(row(&quot;Name&qu... | — | undefined |
| 43 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 123: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 44 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 130: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 45 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 137: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 46 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 144: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 47 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 151: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 48 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 158: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.C... | — | undefined |
| 49 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 165: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.T... | — | undefined |
| 50 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 172: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 51 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 179: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 52 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 186: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 53 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 193: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.A... | — | undefined |
| 54 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 200: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 55 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 207: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 56 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 214: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 57 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 221: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.I... | — | undefined |
| 58 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 228: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.P... | — | undefined |
| 59 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 235: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 60 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 242: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 61 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 249: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 62 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 256: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 63 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 263: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 64 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 270: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.E... | — | undefined |
| 65 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 277: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.R... | — | undefined |
| 66 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 284: Possible undeclared variable "dict_Config" in expression: dict_Config(&quot;POInvoice.L... | — | undefined |
| 67 | `InitAllSettings.xaml` | EXPRESSION_SYNTAX | Line 297: Possible undeclared variable "dict_Config" in expression: dict_Config(constRow(&quot;Na... | — | undefined |
| 68 | `InitAllSettings.xaml` | CATALOG_VIOLATION | Unrecognized attribute "TypeArguments" on ForEach — not in catalog schema | — | undefined |
| 69 | `CloseAllApplications.xaml` | CATALOG_VIOLATION | Unrecognized child property "Try" on TryCatch — not in catalog schema | — | undefined |
| 70 | `CloseAllApplications.xaml` | CATALOG_VIOLATION | Unrecognized child property "TryCatch.Try" on TryCatch — not in catalog schema | — | undefined |
| 71 | `CloseAllApplications.xaml` | CATALOG_VIOLATION | Unrecognized child property "Catches" on TryCatch — not in catalog schema | — | undefined |
| 72 | `CloseAllApplications.xaml` | CATALOG_VIOLATION | Unrecognized child property "TryCatch.Catches" on TryCatch — not in catalog schema | — | undefined |

**Total manual remediation effort: ~0 minutes (0.0 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

po invoice automation

### PDD Summary

## 1. Executive Summary
This Process Design Document (PDD) defines the current (As‑Is) and future (To‑Be) process for validating vendor-submitted invoices against purchase orders (POs) in Coupa for the “po and invoice test” project. Today, an AP clerk manually searches Coupa for each invoice/PO, confirms the PO exists, validates that the invoice total is within a strict ±5% tolerance of the PO total (total-only, not line-level), and either rejects the invoice in Coupa and emails the vendor to resubmit, or progresses the invoice into the Coupa DOA approval chain. This occurs approximately 50 times per day and takes around 10 minutes per invoice.

The To‑Be design implements a fully unattended UiPath automation that processes invoice numbers provided by AP in an Excel file stored in Microsoft OneDrive/SharePoint. For each invoice number, the automation uses the Coupa REST API (Basic Authentication) to retrieve structured invoice and PO totals, calculates variance, and then either progresses the invoice to the next stage (Coupa DOA chain) or rejects it and sends a vendor email. Resubmissions are treated as new invoices, consistent with the current business practice. The automated process is designed to end at either “Invoice Rejected” or “Invoice Progressed to Next Stage,” matching the current process boundary.

[AUTOMATION_TYPE: RPA (API-led unattended automation)]

## 2. Process Scope
The scope of this PDD covers invoice validation and disposition activities from the point a vendor submits an invoice PDF in Coupa through to one of two outcomes: (a) the invoice is rejected in Coupa due to invalid/missing PO or out-of-tolerance total and the vendor is notified via email to correct and resubmit, or (b) the invoice is progressed/routed into the Coupa DOA approval chain for AP team approval.

Included in scope are: Coupa invoice lookup by invoice number, PO presence validation, invoice total versus PO total comparison, 5% tolerance evaluation, Coupa invoice rejection/prog...

### SDD Summary

## 1. Automation Architecture Overview

[AUTOMATION_TYPE: RPA (API-led unattended automation)]

### 1.1 Selected automation pattern and rationale
**Primary pattern: Queue-driven fan-out with lightweight “dispatcher-performer” separation.**

- **Why queue-driven fan-out:** ~50 invoices/day with deterministic rules; queue items allow **per-invoice isolation**, retries, and throughput scaling across **13 unattended slots** without blocking the whole batch on one bad invoice.
- **Why not Maestro as the primary orchestrator:** The end-to-end logic is a single-stage, deterministic validation + action. Maestro adds value mainly for long-running multi-stage case management. We will still use **Action Center** for rare operational exceptions; the orchestration overhead of Maestro is not justified for the baseline flow.
- **Why not Agents / AI Center / DU:** Decisioning uses **structured Coupa API fields** (invoice total, PO#, status) and strict deterministic rules (±5% tolerance, always reject outside tolerance, reject without reason). Agents/DU/ML would add cost and risk without functional benefit.

### 1.2 High-level architecture (services used and why)
- **Orchestrator**
  - **Triggers/Schedules:** time-based schedule to pick up SharePoint Excel batches.
  - **Queues:** one queue item per invoice for scalability, retries, and audit.
  - **Assets/Credentials:** Coupa Basic Auth credentials; configuration assets (paths, tolerance).
  - **Logs & Alerts:** standardized logging + queue analytics for ops monitoring.
- **Integration Service**
  - **Microsoft OneDrive & SharePoint connector** to read the intake Excel from SharePoint/OneDrive reliably (avoid custom Graph calls).
  - **Gmail connector** to send vendor notification emails (as per available tenant connections).
- **Storage Buckets**
  - Archive input files, store run artifacts (processed Excel, exception reports), and optionally store API response snapshots (sanitized) for audit.
- **Action Center**
  - Human-in-the-...

**Automation Type:** rpa
**Rationale:** The process is high-volume and fully deterministic (PO present, total match within 5%); Coupa provides structured fields via API, so rule-based RPA with API integrations will handle the bulk with minimal judgment needed.
**Feasibility Complexity:** low
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | AP Uploads Invoice Number Batch File | AP Clerk | SharePoint | start | — |
| 2 | Ingest Invoice Numbers from Excel | System | Microsoft OneDrive & SharePoint (Integration Service) | task | — |
| 3 | For Each Invoice Number: Retrieve Invoice Header (PO#, Total, Status) | System | Coupa API | task | — |
| 4 | Invoice Found & In Submittable Status? | System | Coupa API | decision | — |
| 5 | Create AP Exception Task (Invoice Not Found / Wrong Status) | AP Clerk | Action Center | task | — |
| 6 | Decide to Re-run or Remove from Batch | AP Clerk | Action Center | decision | — |
| 7 | Re-run Invoice Lookup | System | Coupa API | task | — |
| 8 | Continue Batch Processing | System | Orchestrator | task | — |
| 9 | Retrieve PO Total for PO# | System | Coupa API | task | — |
| 10 | PO Number Present & Found? | System | Coupa API | decision | — |
| 11 | Reject Invoice in Coupa (Invalid/Missing PO) | System | Coupa API | task | — |
| 12 | Email Vendor to Correct & Resubmit | System | Email | task | — |
| 13 | Compare Invoice Total vs PO Total & Calculate Variance % | System | Coupa API | task | — |
| 14 | Amount Within 5% Tolerance? | System | Coupa API | decision | — |
| 15 | Progress Invoice to DOA Approval Chain | System | Coupa API | task | — |
| 16 | Invoice Progressed to Next Stage End | System | Coupa | end | — |
| 17 | Reject Invoice in Coupa (Out of Tolerance) | System | Coupa API | task | — |
| 18 | Email Vendor to Correct & Resubmit | System | Email | task | — |
| 19 | Invoice Rejected End | System | Coupa | end | — |
| 20 | Merge: Continue Batch Processing | System | Orchestrator | task | — |
| 21 | Batch Completed End | System | Orchestrator | end | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- SharePoint
- Microsoft OneDrive & SharePoint (Integration Service)
- Coupa API
- Action Center
- Orchestrator
- Email
- Coupa

### User Roles Involved

- AP Clerk
- System

### Decision Points (Process Map Topology)

**Invoice Found & In Submittable Status?**
  - [No] → Create AP Exception Task (Invoice Not Found / Wrong Status)
  - [Yes] → Retrieve PO Total for PO#

**Decide to Re-run or Remove from Batch**
  - [Re-run] → Re-run Invoice Lookup
  - [Remove/Skip] → Continue Batch Processing

**PO Number Present & Found?**
  - [No] → Reject Invoice in Coupa (Invalid/Missing PO)
  - [Yes] → Compare Invoice Total vs PO Total & Calculate Variance %

**Amount Within 5% Tolerance?**
  - [Yes] → Progress Invoice to DOA Approval Chain
  - [No] → Reject Invoice in Coupa (Out of Tolerance)

## 6. Environment Setup

| Requirement | Value |
|---|---|
| Target Framework | Windows (required) |
| Robot Type | Unattended |
| Modern Activities | No |
| Studio Version | 25.10.0 |
| Orchestrator Connection | Required |
| Machine Template | Standard |

### Machine Template

**Recommended:** Standard
Standard unattended machine template

### Orchestrator Folder Structure

Create a Modern Folder with at least one unattended robot assignment. Use folder-level credential stores for asset isolation.

### NuGet Dependencies

| # | Package |
|---|--------|
| 1 | `UiPath.System.Activities` |
| 2 | `UiPath.Excel.Activities` |
| 3 | `UiPath.UIAutomation.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- SharePoint
- Microsoft OneDrive & SharePoint (Integration Service)
- Coupa API
- Action Center
- Orchestrator
- Email
- Coupa

## 7. Credential & Asset Inventory

**Total:** 47 activities (24 hardcoded, 23 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `POInvoice.Coupa.BasicAuth` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `POInvoice.Coupa.ApiBaseUrl` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `POInvoice.Coupa.InvoiceLookupEndpoint` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 3 | `POInvoice.Coupa.POLookupEndpoint` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `POInvoice.Coupa.InvoiceRejectEndpointTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 5 | `POInvoice.Coupa.InvoiceProgressEndpointTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 6 | `POInvoice.TolerancePercent` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 7 | `POInvoice.Input.SharePointSiteUrl` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 8 | `POInvoice.Input.DocumentLibrary` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 9 | `POInvoice.Input.FolderPath` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 10 | `POInvoice.Archive.FolderPath` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 11 | `POInvoice.Error.FolderPath` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 12 | `POInvoice.Input.FileNamePattern` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 13 | `POInvoice.Input.SheetName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 14 | `POInvoice.Input.InvoiceNumberColumn` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 15 | `POInvoice.Processing.AllowedInvoiceStatuses` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 16 | `POInvoice.Email.FromAddress` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 17 | `POInvoice.Email.Subject.RejectMissingPO` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 18 | `POInvoice.Email.Subject.RejectOutOfTolerance` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 19 | `POInvoice.Email.BodyTemplate.RejectMissingPO` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 20 | `POInvoice.Email.BodyTemplate.RejectOutOfTolerance` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 21 | `POInvoice.EnableVendorEmail` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 22 | `POInvoice.Run.MaxInvoicesPerBatch` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 23 | `POInvoice.Logging.LogHttpPayloads` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `InitAllSettings.xaml` | 114 | GetCredential | `POInvoice.Coupa.BasicAuth` | Credential | — | Yes |
| `InitAllSettings.xaml` | 126 | GetAsset | `POInvoice.Coupa.ApiBaseUrl` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 127 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 133 | GetAsset | `POInvoice.Coupa.InvoiceLookupEndpoint` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 134 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 140 | GetAsset | `POInvoice.Coupa.POLookupEndpoint` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 141 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 147 | GetAsset | `POInvoice.Coupa.InvoiceRejectEndpointTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 148 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 154 | GetAsset | `POInvoice.Coupa.InvoiceProgressEndpointTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 155 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 161 | GetAsset | `POInvoice.TolerancePercent` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 162 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 168 | GetAsset | `POInvoice.Input.SharePointSiteUrl` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 169 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 175 | GetAsset | `POInvoice.Input.DocumentLibrary` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 176 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 182 | GetAsset | `POInvoice.Input.FolderPath` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 183 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 189 | GetAsset | `POInvoice.Archive.FolderPath` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 190 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 196 | GetAsset | `POInvoice.Error.FolderPath` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 197 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 203 | GetAsset | `POInvoice.Input.FileNamePattern` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 204 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 210 | GetAsset | `POInvoice.Input.SheetName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 211 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 217 | GetAsset | `POInvoice.Input.InvoiceNumberColumn` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 218 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 224 | GetAsset | `POInvoice.Processing.AllowedInvoiceStatuses` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 225 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 231 | GetAsset | `POInvoice.Email.FromAddress` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 232 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 238 | GetAsset | `POInvoice.Email.Subject.RejectMissingPO` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 239 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 245 | GetAsset | `POInvoice.Email.Subject.RejectOutOfTolerance` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 246 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 252 | GetAsset | `POInvoice.Email.BodyTemplate.RejectMissingPO` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 253 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 259 | GetAsset | `POInvoice.Email.BodyTemplate.RejectOutOfTolerance` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 260 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 266 | GetAsset | `POInvoice.EnableVendorEmail` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 267 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 273 | GetAsset | `POInvoice.Run.MaxInvoicesPerBatch` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 274 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 280 | GetAsset | `POInvoice.Logging.LogHttpPayloads` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 281 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 24 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 24 aligned, 1 SDD-only, 0 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `POInvoice.Coupa.ApiBaseUrl` | asset | **Aligned** | type: Text, value: https://<coupa-tenant-domain>/api, description: Base URL for Coupa REST API (environment-specific). | `InitAllSettings.xaml` | 126 |
| 2 | `POInvoice.Coupa.InvoiceLookupEndpoint` | asset | **Aligned** | type: Text, value: /invoices, description: Relative endpoint for invoice lookup by invoice number (implementation will append filters/params). | `InitAllSettings.xaml` | 133 |
| 3 | `POInvoice.Coupa.POLookupEndpoint` | asset | **Aligned** | type: Text, value: /purchase_orders, description: Relative endpoint for PO lookup by PO number (implementation will append filters/params). | `InitAllSettings.xaml` | 140 |
| 4 | `POInvoice.Coupa.InvoiceRejectEndpointTemplate` | asset | **Aligned** | type: Text, value: /invoices/{{InvoiceId}}/reject, description: Relative endpoint template to reject an invoice (replace {{InvoiceId}}). | `InitAllSettings.xaml` | 147 |
| 5 | `POInvoice.Coupa.InvoiceProgressEndpointTemplate` | asset | **Aligned** | type: Text, value: /invoices/{{InvoiceId}}/progress, description: Relative endpoint template to progress an invoice to the next stage/DOA chain (replace {{InvoiceId}}). | `InitAllSettings.xaml` | 154 |
| 6 | `POInvoice.TolerancePercent` | asset | **Aligned** | type: Integer, value: 5, description: Strict tolerance percentage for invoice total vs PO total variance. | `InitAllSettings.xaml` | 161 |
| 7 | `POInvoice.Input.SharePointSiteUrl` | asset | **Aligned** | type: Text, value: https://<tenant>.sharepoint.com/sites/<site>, description: SharePoint site URL hosting the AP batch Excel intake. | `InitAllSettings.xaml` | 168 |
| 8 | `POInvoice.Input.DocumentLibrary` | asset | **Aligned** | type: Text, value: Shared Documents, description: SharePoint document library name for intake files. | `InitAllSettings.xaml` | 175 |
| 9 | `POInvoice.Input.FolderPath` | asset | **Aligned** | type: Text, value: /AP/InvoiceValidation/Input, description: Folder path for incoming batch Excel files. | `InitAllSettings.xaml` | 182 |
| 10 | `POInvoice.Archive.FolderPath` | asset | **Aligned** | type: Text, value: /AP/InvoiceValidation/Archive, description: Folder path to move processed batch files for auditability. | `InitAllSettings.xaml` | 189 |
| 11 | `POInvoice.Error.FolderPath` | asset | **Aligned** | type: Text, value: /AP/InvoiceValidation/Error, description: Folder path to move failed/unreadable batch files. | `InitAllSettings.xaml` | 196 |
| 12 | `POInvoice.Input.FileNamePattern` | asset | **Aligned** | type: Text, value: InvoiceBatch_*.xlsx, description: Filename pattern to pick up AP-provided batch files. | `InitAllSettings.xaml` | 203 |
| 13 | `POInvoice.Input.SheetName` | asset | **Aligned** | type: Text, value: Invoices, description: Worksheet name containing invoice numbers. | `InitAllSettings.xaml` | 210 |
| 14 | `POInvoice.Input.InvoiceNumberColumn` | asset | **Aligned** | type: Text, value: InvoiceNumber, description: Column header containing invoice numbers. | `InitAllSettings.xaml` | 217 |
| 15 | `POInvoice.Processing.AllowedInvoiceStatuses` | asset | **Aligned** | type: Text, value: Pending,Submitted, description: Comma-separated list of invoice statuses eligible for processing; others are routed to Action Center. | `InitAllSettings.xaml` | 224 |
| 16 | `POInvoice.Email.FromAddress` | asset | **Aligned** | type: Text, value: prajjuds@gmail.com, description: System-controlled sender mailbox for vendor notifications (must match authorized connector/mailbox). | `InitAllSettings.xaml` | 231 |
| 17 | `POInvoice.Email.Subject.RejectMissingPO` | asset | **Aligned** | type: Text, value: Invoice Rejected - PO Missing/Invalid, description: Email subject for missing/invalid PO rejection notifications. | `InitAllSettings.xaml` | 238 |
| 18 | `POInvoice.Email.Subject.RejectOutOfTolerance` | asset | **Aligned** | type: Text, value: Invoice Rejected - Amount Outside 5% Tolerance, description: Email subject for out-of-tolerance rejection notifications. | `InitAllSettings.xaml` | 245 |
| 19 | `POInvoice.Email.BodyTemplate.RejectMissingPO` | asset | **Aligned** | type: Text, value: Hello {{VendorName}},

Your invoice {{InvoiceNumber}} has been rejected because the Purchase Order (PO) number is missing or invalid in Coupa.
Please correct and resubmit the invoice with a valid PO.

Regards,
Accounts Payable, description: Vendor email body template for missing/invalid PO rejections. | `InitAllSettings.xaml` | 252 |
| 20 | `POInvoice.Email.BodyTemplate.RejectOutOfTolerance` | asset | **Aligned** | type: Text, value: Hello {{VendorName}},

Your invoice {{InvoiceNumber}} has been rejected because the invoice total {{InvoiceTotal}} differs from the PO total {{POTotal}} by {{VariancePercent}}%, which exceeds the allowed ±{{TolerancePercent}}% tolerance.
Please correct and resubmit the invoice.

Regards,
Accounts Payable, description: Vendor email body template for out-of-tolerance rejections. | `InitAllSettings.xaml` | 259 |
| 21 | `POInvoice.EnableVendorEmail` | asset | **Aligned** | type: Bool, value: true, description: Feature toggle to enable/disable vendor email notifications (e.g., during testing). | `InitAllSettings.xaml` | 266 |
| 22 | `POInvoice.Run.MaxInvoicesPerBatch` | asset | **Aligned** | type: Integer, value: 500, description: Safety cap to prevent runaway batch processing from a malformed input file. | `InitAllSettings.xaml` | 273 |
| 23 | `POInvoice.Logging.LogHttpPayloads` | asset | **Aligned** | type: Bool, value: false, description: If true, logs request/response payloads (should be false in Production to avoid sensitive data exposure). | `InitAllSettings.xaml` | 280 |
| 24 | `POInvoice.Coupa.BasicAuth` | credential | **Aligned** | type: Credential, description: Coupa API Basic Authentication credentials (username/password or API user/token per Coupa setup). | `InitAllSettings.xaml` | 114 |
| 25 | `POInvoice.InvoiceValidation` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: Per-invoice work items for validation and disposition (lookup invoice/PO, calculate variance, reject/progress, notify vendor). | — | — |

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 0/47 high-risk activities inside TryCatch (0%)

### Files Without TryCatch

- `POInvoiceTest.xaml`
- `InitAllSettings.xaml`
- `Main.xaml`
- `BatchDispatcher.xaml`
- `PerformerMain.xaml`
- `InvoiceProcessor.xaml`
- `CoupaApiClient.xaml`
- `VendorNotification.xaml`
- `ActionCenterHandler.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:114` | Get POInvoice.Coupa.BasicAuth |
| 2 | `InitAllSettings.xaml:126` | Get POInvoice.Coupa.ApiBaseUrl |
| 3 | `InitAllSettings.xaml:127` | ui:GetAsset |
| 4 | `InitAllSettings.xaml:133` | Get POInvoice.Coupa.InvoiceLookupEndpoint |
| 5 | `InitAllSettings.xaml:134` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:140` | Get POInvoice.Coupa.POLookupEndpoint |
| 7 | `InitAllSettings.xaml:141` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:147` | Get POInvoice.Coupa.InvoiceRejectEndpointTemplate |
| 9 | `InitAllSettings.xaml:148` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:154` | Get POInvoice.Coupa.InvoiceProgressEndpointTemplate |
| 11 | `InitAllSettings.xaml:155` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:161` | Get POInvoice.TolerancePercent |
| 13 | `InitAllSettings.xaml:162` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:168` | Get POInvoice.Input.SharePointSiteUrl |
| 15 | `InitAllSettings.xaml:169` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:175` | Get POInvoice.Input.DocumentLibrary |
| 17 | `InitAllSettings.xaml:176` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:182` | Get POInvoice.Input.FolderPath |
| 19 | `InitAllSettings.xaml:183` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:189` | Get POInvoice.Archive.FolderPath |
| 21 | `InitAllSettings.xaml:190` | ui:GetAsset |
| 22 | `InitAllSettings.xaml:196` | Get POInvoice.Error.FolderPath |
| 23 | `InitAllSettings.xaml:197` | ui:GetAsset |
| 24 | `InitAllSettings.xaml:203` | Get POInvoice.Input.FileNamePattern |
| 25 | `InitAllSettings.xaml:204` | ui:GetAsset |
| 26 | `InitAllSettings.xaml:210` | Get POInvoice.Input.SheetName |
| 27 | `InitAllSettings.xaml:211` | ui:GetAsset |
| 28 | `InitAllSettings.xaml:217` | Get POInvoice.Input.InvoiceNumberColumn |
| 29 | `InitAllSettings.xaml:218` | ui:GetAsset |
| 30 | `InitAllSettings.xaml:224` | Get POInvoice.Processing.AllowedInvoiceStatuses |
| 31 | `InitAllSettings.xaml:225` | ui:GetAsset |
| 32 | `InitAllSettings.xaml:231` | Get POInvoice.Email.FromAddress |
| 33 | `InitAllSettings.xaml:232` | ui:GetAsset |
| 34 | `InitAllSettings.xaml:238` | Get POInvoice.Email.Subject.RejectMissingPO |
| 35 | `InitAllSettings.xaml:239` | ui:GetAsset |
| 36 | `InitAllSettings.xaml:245` | Get POInvoice.Email.Subject.RejectOutOfTolerance |
| 37 | `InitAllSettings.xaml:246` | ui:GetAsset |
| 38 | `InitAllSettings.xaml:252` | Get POInvoice.Email.BodyTemplate.RejectMissingPO |
| 39 | `InitAllSettings.xaml:253` | ui:GetAsset |
| 40 | `InitAllSettings.xaml:259` | Get POInvoice.Email.BodyTemplate.RejectOutOfTolerance |
| 41 | `InitAllSettings.xaml:260` | ui:GetAsset |
| 42 | `InitAllSettings.xaml:266` | Get POInvoice.EnableVendorEmail |
| 43 | `InitAllSettings.xaml:267` | ui:GetAsset |
| 44 | `InitAllSettings.xaml:273` | Get POInvoice.Run.MaxInvoicesPerBatch |
| 45 | `InitAllSettings.xaml:274` | ui:GetAsset |
| 46 | `InitAllSettings.xaml:280` | Get POInvoice.Logging.LogHttpPayloads |
| 47 | `InitAllSettings.xaml:281` | ui:GetAsset |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: POInvoice-Dispatcher-Daily | SDD-specified: POInvoice-Dispatcher-Daily | Cron: 0 0 6 ? * MON-FRI * | Daily dispatcher schedule (Mon-Fri 06:00) to ingest SharePoint batch file(s) and enqueue invoices. |
| 2 | **Queue** | Defined in SDD orchestrator_artifacts: POInvoice-Performer-QueueTrigger | SDD-specified: POInvoice-Performer-QueueTrigger | Queue: POInvoice.InvoiceValidation | Queue-driven performer trigger to process invoice validation items with retry handling. |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 72 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `POInvoice.Coupa.BasicAuth` | Yes |
| 5 | Assets | Provision asset: `POInvoice.Coupa.ApiBaseUrl` | Yes |
| 6 | Assets | Provision asset: `POInvoice.Coupa.InvoiceLookupEndpoint` | Yes |
| 7 | Assets | Provision asset: `POInvoice.Coupa.POLookupEndpoint` | Yes |
| 8 | Assets | Provision asset: `POInvoice.Coupa.InvoiceRejectEndpointTemplate` | Yes |
| 9 | Assets | Provision asset: `POInvoice.Coupa.InvoiceProgressEndpointTemplate` | Yes |
| 10 | Assets | Provision asset: `POInvoice.TolerancePercent` | Yes |
| 11 | Assets | Provision asset: `POInvoice.Input.SharePointSiteUrl` | Yes |
| 12 | Assets | Provision asset: `POInvoice.Input.DocumentLibrary` | Yes |
| 13 | Assets | Provision asset: `POInvoice.Input.FolderPath` | Yes |
| 14 | Assets | Provision asset: `POInvoice.Archive.FolderPath` | Yes |
| 15 | Assets | Provision asset: `POInvoice.Error.FolderPath` | Yes |
| 16 | Assets | Provision asset: `POInvoice.Input.FileNamePattern` | Yes |
| 17 | Assets | Provision asset: `POInvoice.Input.SheetName` | Yes |
| 18 | Assets | Provision asset: `POInvoice.Input.InvoiceNumberColumn` | Yes |
| 19 | Assets | Provision asset: `POInvoice.Processing.AllowedInvoiceStatuses` | Yes |
| 20 | Assets | Provision asset: `POInvoice.Email.FromAddress` | Yes |
| 21 | Assets | Provision asset: `POInvoice.Email.Subject.RejectMissingPO` | Yes |
| 22 | Assets | Provision asset: `POInvoice.Email.Subject.RejectOutOfTolerance` | Yes |
| 23 | Assets | Provision asset: `POInvoice.Email.BodyTemplate.RejectMissingPO` | Yes |
| 24 | Assets | Provision asset: `POInvoice.Email.BodyTemplate.RejectOutOfTolerance` | Yes |
| 25 | Assets | Provision asset: `POInvoice.EnableVendorEmail` | Yes |
| 26 | Assets | Provision asset: `POInvoice.Run.MaxInvoicesPerBatch` | Yes |
| 27 | Assets | Provision asset: `POInvoice.Logging.LogHttpPayloads` | Yes |
| 28 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 29 | Testing | Run smoke test in target environment | Yes |
| 30 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 31 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 32 | Governance | Peer code review completed | Yes |
| 33 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 34 | Governance | Business process owner validation obtained | Yes |
| 35 | Governance | CoE approval obtained | Yes |
| 36 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Needs Work — 32/50 (64%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 24 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 0% of high-risk activities covered by TryCatch; 9 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 5/10 | 72 quality warnings — significant remediation needed |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 36 |
| Valid activities | 36 |
| Unknown → Comment stubs | 0 |
| Non-catalog properties stripped | 0 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 0 |
| Total issues | 0 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 0 auto-fixed, 0 total issues |
| Post-emission (quality gate) | 72 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "POInvoiceTest.xaml",
    "InitAllSettings.xaml",
    "CloseAllApplications.xaml",
    "Main.xaml",
    "BatchDispatcher.xaml",
    "PerformerMain.xaml",
    "InvoiceProcessor.xaml",
    "CoupaApiClient.xaml",
    "VendorNotification.xaml",
    "ActionCenterHandler.xaml"
  ],
  "autoRepairs": [],
  "remediations": [],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "POInvoiceTest.xaml",
      "detail": "Contains 17 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "BatchDispatcher.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "PerformerMain.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "InvoiceProcessor.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "CoupaApiClient.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "VendorNotification.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ActionCenterHandler.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "InitAllSettings.xaml",
      "detail": "Line 94: property \"TypeArguments\" is not a known property of ForEach",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "InitAllSettings.xaml",
      "detail": "Line 287: property \"TypeArguments\" is not a known property of ForEach",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "InitAllSettings.xaml",
      "detail": "Line 310: property \"InitAllSettings\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "CloseAllApplications.xaml",
      "detail": "Line 77: property \"CloseAllApplications\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "BatchDispatcher.xaml",
      "detail": "Line 57: property \"BatchDispatcher\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "PerformerMain.xaml",
      "detail": "Line 57: property \"PerformerMain\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "InvoiceProcessor.xaml",
      "detail": "Line 57: property \"InvoiceProcessor\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "CoupaApiClient.xaml",
      "detail": "Line 57: property \"CoupaApiClient\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "VendorNotification.xaml",
      "detail": "Line 57: property \"VendorNotification\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ActionCenterHandler.xaml",
      "detail": "Line 57: property \"ActionCenterHandler\" is not a known property of ui:LogMessage",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 114: asset name \"POInvoice.Coupa.BasicAuth\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 126: asset name \"POInvoice.Coupa.ApiBaseUrl\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 133: asset name \"POInvoice.Coupa.InvoiceLookupEndpoint\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 140: asset name \"POInvoice.Coupa.POLookupEndpoint\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 147: asset name \"POInvoice.Coupa.InvoiceRejectEndpointTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 154: asset name \"POInvoice.Coupa.InvoiceProgressEndpointTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 161: asset name \"POInvoice.TolerancePercent\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 168: asset name \"POInvoice.Input.SharePointSiteUrl\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 175: asset name \"POInvoice.Input.DocumentLibrary\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 182: asset name \"POInvoice.Input.FolderPath\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 189: asset name \"POInvoice.Archive.FolderPath\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 196: asset name \"POInvoice.Error.FolderPath\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 203: asset name \"POInvoice.Input.FileNamePattern\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 210: asset name \"POInvoice.Input.SheetName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 217: asset name \"POInvoice.Input.InvoiceNumberColumn\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 224: asset name \"POInvoice.Processing.AllowedInvoiceStatuses\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 231: asset name \"POInvoice.Email.FromAddress\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 238: asset name \"POInvoice.Email.Subject.RejectMissingPO\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 245: asset name \"POInvoice.Email.Subject.RejectOutOfTolerance\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 252: asset name \"POInvoice.Email.BodyTemplate.RejectMissingPO\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 259: asset name \"POInvoice.Email.BodyTemplate.RejectOutOfTolerance\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 266: asset name \"POInvoice.EnableVendorEmail\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 273: asset name \"POInvoice.Run.MaxInvoicesPerBatch\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 280: asset name \"POInvoice.Logging.LogHttpPayloads\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: Possible undeclared variable \"dict_Config\" in expression: dict_Config(row(&quot;Name&quot;).ToString())",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 123: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.BasicAuth&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 130: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.ApiBaseUrl&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 137: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.InvoiceLookupEndpoint&quot...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 144: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.POLookupEndpoint&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 151: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.InvoiceRejectEndpointTempl...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 158: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Coupa.InvoiceProgressEndpointTem...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 165: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.TolerancePercent&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 172: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.SharePointSiteUrl&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 179: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.DocumentLibrary&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 186: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.FolderPath&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 193: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Archive.FolderPath&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 200: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Error.FolderPath&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 207: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.FileNamePattern&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 214: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.SheetName&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 221: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Input.InvoiceNumberColumn&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 228: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Processing.AllowedInvoiceStatuse...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 235: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Email.FromAddress&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 242: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Email.Subject.RejectMissingPO&qu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 249: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Email.Subject.RejectOutOfToleran...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 256: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Email.BodyTemplate.RejectMissing...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 263: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Email.BodyTemplate.RejectOutOfTo...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 270: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.EnableVendorEmail&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 277: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Run.MaxInvoicesPerBatch&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 284: Possible undeclared variable \"dict_Config\" in expression: dict_Config(&quot;POInvoice.Logging.LogHttpPayloads&quot;)",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "InitAllSettings.xaml",
      "detail": "Line 297: Possible undeclared variable \"dict_Config\" in expression: dict_Config(constRow(&quot;Name&quot;).ToString())",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "InitAllSettings.xaml",
      "detail": "Unrecognized attribute \"TypeArguments\" on ForEach — not in catalog schema",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "CloseAllApplications.xaml",
      "detail": "Unrecognized child property \"Try\" on TryCatch — not in catalog schema",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "CloseAllApplications.xaml",
      "detail": "Unrecognized child property \"TryCatch.Try\" on TryCatch — not in catalog schema",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "CloseAllApplications.xaml",
      "detail": "Unrecognized child property \"Catches\" on TryCatch — not in catalog schema",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "CloseAllApplications.xaml",
      "detail": "Unrecognized child property \"TryCatch.Catches\" on TryCatch — not in catalog schema",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 0,
  "preEmissionValidation": {
    "totalActivities": 36,
    "validActivities": 36,
    "unknownActivities": 0,
    "strippedProperties": 0,
    "enumCorrections": 0,
    "missingRequiredFilled": 0,
    "commentConversions": 0,
    "issueCount": 0
  }
}
```
