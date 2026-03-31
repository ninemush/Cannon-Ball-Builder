# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-03-31
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (9%)

**Total Estimated Effort: ~1380 minutes (23.0 hours)**
**Remediations:** 94 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 0 workflow)
**Auto-Repairs:** 12
**Quality Warnings:** 93

---

## 1. Completed Work

The following 2 workflow(s) were fully generated without any stub replacements or remediation:

- `Main.xaml`
- `InitAllSettings.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `Init.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 3 | `Dispatcher.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 4 | `Performer.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 5 | `ContactResolver.xaml` | Structurally invalid — Expression syntax errors that could not be auto-corrected |
| 6 | `MessageComposer.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 7 | `EmailSender.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 8 | `Finalize.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 9 | `BirthdayGreetingsV12.xaml` | Generated with Remediations |
| 10 | `InitAllSettings.xaml` | Fully Generated |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `Init.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 3 | `Dispatcher.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 4 | `Performer.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 5 | `ContactResolver.xaml` | Structurally invalid — not Studio-loadable | Expression Syntax | [EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected |
| 6 | `MessageComposer.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 7 | `EmailSender.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 8 | `Finalize.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 9 | `BirthdayGreetingsV12.xaml` | Studio-openable | — | — |
| 10 | `InitAllSettings.xaml` | Studio-openable | — | — |

**Summary:** 2 Studio-loadable, 1 with warnings, 7 not Studio-loadable

> **⚠ 7 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

**Blocked by category:**
- Compliance or quality gate failure requiring manual remediation: 6 workflow(s)
- Expression syntax errors that could not be auto-corrected: 1 workflow(s)

## 2. AI-Resolved with Smart Defaults

The following 12 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `Dispatcher.xaml` | Stripped 18 placeholder token(s) from Dispatcher.xaml | 5 |
| 2 | `REPAIR_PLACEHOLDER_CLEANUP` | `MessageComposer.xaml` | Stripped 17 placeholder token(s) from MessageComposer.xaml | 5 |
| 3 | `REPAIR_PLACEHOLDER_CLEANUP` | `BirthdayGreetingsV12.xaml` | Stripped 1 placeholder token(s) from BirthdayGreetingsV12.xaml | 5 |
| 4 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Performer.xaml` | Catalog: Moved While.Condition from attribute to child-element in Performer.xaml | undefined |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `BirthdayGreetingsV12.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in BirthdayGreetingsV12.xaml | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitA... | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 9 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 10 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 11 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 12 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (94)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Performer.xaml — estimated 15 min | 15 |
| 2 | `Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Performer.xaml — estimated 15 min | 15 |
| 3 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 4 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 5 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 6 | `ContactResolver.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 7 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 8 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 9 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 10 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 11 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 12 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 13 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 14 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 15 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 16 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 17 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 18 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 19 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 20 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 21 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 22 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 23 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 24 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 25 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 26 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 27 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 28 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 29 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 30 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 31 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 32 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 33 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 34 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 35 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 36 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 37 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 38 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 39 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 40 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 41 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 42 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 43 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 44 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 45 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 46 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 47 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 48 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 49 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 50 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 51 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 52 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 53 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 54 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 55 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 56 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 57 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 58 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 59 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 60 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 61 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 62 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 63 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 64 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 65 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 66 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 67 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 68 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 69 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 70 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 71 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 72 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 73 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 74 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 75 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 76 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 77 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 78 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 79 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 80 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 81 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 82 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 83 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 84 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 85 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 86 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 87 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 88 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 89 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 90 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 91 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 92 | `ContactResolver.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in ContactResolver.xaml — use valid enum from UiP... | 5 |
| 93 | `BirthdayGreetingsV12.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in BirthdayGreetingsV12.xaml — use valid enum fro... | 5 |
| 94 | `BirthdayGreetingsV12.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in BirthdayGreetingsV12.xaml — use valid enum fro... | 5 |

### Developer Implementation Required (15)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 2 | `Init.xaml` | Contains 8 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 3 | `Init.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 4 | `Dispatcher.xaml` | Contains 8 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 5 | `Dispatcher.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 6 | `Performer.xaml` | Contains 9 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 7 | `Performer.xaml` | Contains 10 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 8 | `ContactResolver.xaml` | Contains 7 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 9 | `ContactResolver.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 10 | `MessageComposer.xaml` | Contains 11 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 11 | `MessageComposer.xaml` | Contains 14 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 12 | `EmailSender.xaml` | Contains 11 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 13 | `EmailSender.xaml` | Contains 9 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 14 | `Finalize.xaml` | Contains 5 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 15 | `Finalize.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (78)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Performer.xaml` | potentially-null-dereference | Line 333: "obj_CurrentQueueItem.SpecificContent" accessed without visible null guard in scope — v... | — | undefined |
| 2 | `Dispatcher.xaml` | hardcoded-retry-count | Line 117: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 3 | `Dispatcher.xaml` | hardcoded-retry-count | Line 125: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 4 | `Dispatcher.xaml` | hardcoded-retry-count | Line 176: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 5 | `Dispatcher.xaml` | hardcoded-retry-count | Line 184: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 6 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 117: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" — conside... | — | undefined |
| 7 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 125: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 8 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 176: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" — conside... | — | undefined |
| 9 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 184: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 10 | `Performer.xaml` | hardcoded-retry-count | Line 162: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 11 | `Performer.xaml` | hardcoded-retry-count | Line 452: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 12 | `Performer.xaml` | hardcoded-retry-count | Line 457: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 13 | `Performer.xaml` | hardcoded-retry-interval | Line 162: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 14 | `Performer.xaml` | hardcoded-retry-interval | Line 452: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 15 | `Performer.xaml` | hardcoded-retry-interval | Line 457: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 16 | `ContactResolver.xaml` | hardcoded-retry-count | Line 170: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 17 | `ContactResolver.xaml` | hardcoded-retry-count | Line 179: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 18 | `ContactResolver.xaml` | hardcoded-retry-interval | Line 170: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" — conside... | — | undefined |
| 19 | `ContactResolver.xaml` | hardcoded-retry-interval | Line 179: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 20 | `MessageComposer.xaml` | hardcoded-retry-count | Line 216: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 21 | `MessageComposer.xaml` | hardcoded-retry-count | Line 224: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 22 | `MessageComposer.xaml` | hardcoded-retry-count | Line 410: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 23 | `MessageComposer.xaml` | hardcoded-retry-count | Line 418: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 24 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 216: retry interval hardcoded as "00:00:08" — consider externalizing to Config.xlsx | — | undefined |
| 25 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 224: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 26 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 410: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 27 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 418: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 28 | `EmailSender.xaml` | hardcoded-retry-count | Line 275: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 29 | `EmailSender.xaml` | hardcoded-retry-interval | Line 275: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" — conside... | — | undefined |
| 30 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 693: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 31 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 698: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 32 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 839: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 33 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 844: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 34 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 970: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 35 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-count | Line 975: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 36 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 693: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 37 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 698: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 38 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 839: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 39 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 844: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 40 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 970: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 41 | `BirthdayGreetingsV12.xaml` | hardcoded-retry-interval | Line 975: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 42 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 146: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 43 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 196: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 44 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 245: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 45 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 294: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 46 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 351: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 47 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 408: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 48 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 465: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 49 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 522: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 50 | `BirthdayGreetingsV12.xaml` | hardcoded-asset-name | Line 571: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 51 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xls... | — | undefined |
| 52 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 53 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 139: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 54 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 148: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 55 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 157: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 56 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 166: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 57 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 175: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 58 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 184: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 59 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 193: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 60 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 202: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 61 | `BirthdayGreetingsV12.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 62 | `BirthdayGreetingsV12.xaml` | CATALOG_VIOLATION | Missing required property "Prompt" on ugenai:UseGenAI | — | undefined |
| 63 | `BirthdayGreetingsV12.xaml` | CATALOG_VIOLATION | Missing required property "Body" on ugs:GmailSendMessage | — | undefined |
| 64 | `Dispatcher.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" was bracket-wrapped ... | — | undefined |
| 65 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 66 | `Dispatcher.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" was bracket-wrapped ... | — | undefined |
| 67 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 68 | `Performer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 69 | `Performer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 70 | `Performer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 71 | `ContactResolver.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" was bracket-wrapped ... | — | undefined |
| 72 | `ContactResolver.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 73 | `MessageComposer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 74 | `MessageComposer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 75 | `EmailSender.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]" was bracket-wrapped ... | — | undefined |
| 76 | `BirthdayGreetingsV12.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 77 | `BirthdayGreetingsV12.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 78 | `BirthdayGreetingsV12.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |

**Total manual remediation effort: ~1380 minutes (23.0 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary
The “birthday greetings v12” automation will send birthday greeting emails every day at 8:00 AM Dubai time on your behalf. The birthdays are maintained in a dedicated Google Calendar named “Birthdays”, where each event contains the person’s full name. The automation will retrieve today’s birthday events from that calendar, look up each person in Google Contacts, select the preferred email address (Personal/Home; in practice the SME confirmed one email per person), generate a warm, funny, sarcastic message in your voice using UiPath’s native GenAI capabilities, and send the email from the Gmail account connected in Integration Service as **ninemush@gmail.com**. The solution is designed for fully unattended, autonomous execution using UiPath Orchestrator triggers and Integration Service connectors (no Google Drive, no Slack/Teams/Twilio, and no external OpenAI usage).

## 2. Process Scope
This PDD covers a single daily process: sending birthday greetings by email for people whose birthdays fall “today” in the Dubai timezone. The scope begins with a scheduled 8:00 AM trigger and ends when all greetings for that day have been sent or skipped according to rules.

In scope are: reading events from the Google Calendar “Birthdays”; extracting the full name from the event; searching Google Contacts/People for the corresponding contact; selecting the appropriate email address label (Personal/Home preferred; SME confirmed one email per person); generating the email text in your voice (warm, funny, sarcastic) using UiPath GenAI Activities; and sending the email via Gmail from **ninemush@gmail.com**.

Out of scope for this iteration are: using Google Photos or any photos in messages, any “relationship” personalization sourced from the calendar (relationship is not stored), any notifications via Slack/Teams/Twilio, any use of Google Drive, and any use of external OpenAI/Azure OpenAI connectors.

## 3. As-Is Process Description

![As-Is Process Map](/api/id...

### SDD Summary

## 1. Automation Architecture Overview

### 1.1 Chosen automation approach and rationale
**[AUTOMATION_TYPE: HYBRID]**

- **RPA (deterministic integration + orchestration):** Reading Google Calendar events, looking up Google Contacts, and sending email are deterministic API operations. These are best implemented as an unattended Orchestrator process using **Integration Service connectors** (more reliable and supportable than UI automation; avoids custom HTTP per requirement).
- **GenAI (content generation):** The “warm, funny, sarcastic in my voice” message is non-deterministic content creation and is best handled via **UiPath GenAI Activities** (native, approved; explicitly not using OpenAI/Azure OpenAI).
- **No human-in-the-loop:** SME rule is “if no email is found, don’t do anything,” and “no forgot scenario when there are no birthdays.” Therefore **Action Center / Maestro user tasks are not on the critical path**. We still design for operability and future extensibility (e.g., optional approval later).

### 1.2 High-level architecture (platform services used)
- **Orchestrator**
  - Hosts the package and process **BirthdayGreetingsV12** (unique name; avoids conflicts with V3/V6/V8/V3GenAI already deployed).
  - Runs unattended jobs on the available **11 unattended slots**.
  - Central logging, retries, alerting hooks, and job history/audit trail.
- **Triggers**
  - **Time-based schedule**: daily 08:00 **Asia/Dubai**.
- **Integration Service**
  - **Google Calendar connector**: read events from calendar named **“Birthdays”** for “today” in Dubai timezone.
  - **Google Contacts/People connector**: look up by full name; retrieve email addresses and labels; select **Personal/Home preferred**.
  - **Gmail connector**: send email via connection **ninemush@gmail.com**.
- **UiPath GenAI Activities**
  - Generate subject/body in “your voice” with constraints/guardrails.
- **Data Service**
  - Persist run-level and per-recipient outcomes (sent/skipped/errors) for auditabil...

**Automation Type:** hybrid
**Rationale:** The Calendar/Contacts/Gmail interactions are structured and best handled via Integration Service (RPA-style), while drafting “in your voice” is generative and judgment-based, best handled by a GenAI/Agent component.
**Feasibility Complexity:** medium
**Effort Estimate:** 3-5 days

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | 8:00 AM Dubai Time Trigger | System | Orchestrator Triggers | start | — |
| 2 | Get Today’s Birthday Events (Birthdays calendar) | System | Integration Service - Google Calendar | task | — |
| 3 | Any Birthdays Today? | System | Orchestrator | decision | — |
| 4 | End — No Birthdays to Send | System | Orchestrator | end | — |
| 5 | Process Each Birthday Event | System | Orchestrator | task | — |
| 6 | Lookup Contact by Full Name | System | Integration Service - Google Contacts/People | task | — |
| 7 | Email Available? | System | Integration Service - Google Contacts/People | decision | — |
| 8 | Skip Person (No Email Found) | System | Orchestrator | task | — |
| 9 | Select Preferred Email (Personal/Home) | System | Integration Service - Google Contacts/People | task | — |
| 10 | Multiple Emails Present? | System | Orchestrator | decision | — |
| 11 | Choose Personal Email | System | Integration Service - Google Contacts/People | task | — |
| 12 | Use Only Available Email | System | Integration Service - Google Contacts/People | task | — |
| 13 | Generate Birthday Message in Your Voice (warm/funny/sarcastic) | System | UiPath GenAI Activities | agent-task | — |
| 14 | Send Birthday Email from ninemush@gmail.com | System | Integration Service - Gmail (ninemush@gmail.com) | task | — |
| 15 | More Events Remaining? | System | Orchestrator | decision | — |
| 16 | End — All Birthday Emails Sent | System | Orchestrator | end | — |
| 17 | Continue Loop | System | Orchestrator | task | — |
| 18 | Loop Back to Next Event | System | Orchestrator | task | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Integration Service - Google Contacts/People
- UiPath GenAI Activities
- Integration Service - Gmail (ninemush@gmail.com)

### User Roles Involved

- System

### Decision Points (Process Map Topology)

**Any Birthdays Today?**
  - [No] → End — No Birthdays to Send
  - [Yes] → Process Each Birthday Event

**Email Available?**
  - [No] → Skip Person (No Email Found)
  - [Yes] → Select Preferred Email (Personal/Home)

**Multiple Emails Present?**
  - [Yes] → Choose Personal Email
  - [No] → Use Only Available Email

**More Events Remaining?**
  - [No] → End — All Birthday Emails Sent
  - [Yes] → Continue Loop

## 6. Environment Setup

| Requirement | Value |
|---|---|
| Target Framework | Windows (required) |
| Robot Type | Unattended |
| Modern Activities | No |
| Studio Version | 25.10.0 |
| Orchestrator Connection | Required |
| Machine Template | Standard |
| Data Service | Required |

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
| 4 | `UiPath.ComplexScenarios.Activities` |
| 5 | `Newtonsoft.Json` |
| 6 | `UiPath.IntegrationService.Activities` |
| 7 | `UiPath.GenAI.Activities` |
| 8 | `UiPath.GSuite.Activities` |
| 9 | `UiPath.Web.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Integration Service - Google Contacts/People
- UiPath GenAI Activities
- Integration Service - Gmail (ninemush@gmail.com)

## 7. Credential & Asset Inventory

**Total:** 39 activities (19 hardcoded, 20 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BGV12.GoogleWorkspaceCredential` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV12.CalendarName` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV12.Timezone` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV12.FromGmailConnectionName` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV12.MaxConnectorRetries` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 5 | `BGV12.RetryBackoffSeconds` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 6 | `BGV12.SendEnabled` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 7 | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 8 | `BGV12.PreferredEmailLabels` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |
| 9 | `BGV12.OperationsDL` | Unknown | — | `BirthdayGreetingsV12.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `BirthdayGreetingsV12.xaml` | 152 | GetAsset | `BGV12.CalendarName` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 153 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 202 | GetAsset | `BGV12.Timezone` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 203 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 251 | GetAsset | `BGV12.FromGmailConnectionName` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 252 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 300 | GetAsset | `BGV12.MaxConnectorRetries` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 301 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 357 | GetAsset | `BGV12.RetryBackoffSeconds` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 358 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 414 | GetAsset | `BGV12.SendEnabled` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 415 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 471 | GetAsset | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 472 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 528 | GetAsset | `BGV12.PreferredEmailLabels` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 529 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 577 | GetAsset | `BGV12.OperationsDL` | Unknown | — | Yes |
| `BirthdayGreetingsV12.xaml` | 578 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 118 | GetCredential | `BGV12.GoogleWorkspaceCredential` | Credential | — | Yes |
| `InitAllSettings.xaml` | 119 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 122 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 130 | GetAsset | `BGV12.CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 131 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 139 | GetAsset | `BGV12.Timezone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 140 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 148 | GetAsset | `BGV12.FromGmailConnectionName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 149 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 157 | GetAsset | `BGV12.MaxConnectorRetries` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 158 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 166 | GetAsset | `BGV12.RetryBackoffSeconds` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 167 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 175 | GetAsset | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 176 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 184 | GetAsset | `BGV12.PreferredEmailLabels` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 185 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 193 | GetAsset | `BGV12.SendEnabled` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 194 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 202 | GetAsset | `BGV12.OperationsDL` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 203 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 19 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 10 aligned, 1 SDD-only, 0 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV12.CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name containing birthday events. | `BirthdayGreetingsV12.xaml` | 152 |
| 2 | `BGV12.Timezone` | asset | **Aligned** | type: Text, value: Asia/Dubai, description: Authoritative timezone for 'today' evaluation and schedule alignment. | `BirthdayGreetingsV12.xaml` | 202 |
| 3 | `BGV12.FromGmailConnectionName` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: Integration Service Gmail connection name used to send greetings. | `BirthdayGreetingsV12.xaml` | 251 |
| 4 | `BGV12.MaxConnectorRetries` | asset | **Aligned** | type: Integer, value: 3, description: Max retries for transient Integration Service connector failures (Calendar/People/Gmail). | `BirthdayGreetingsV12.xaml` | 300 |
| 5 | `BGV12.RetryBackoffSeconds` | asset | **Aligned** | type: Integer, value: 10, description: Backoff delay between transient retries. | `BirthdayGreetingsV12.xaml` | 357 |
| 6 | `BGV12.SkipOnAmbiguousContactMatch` | asset | **Aligned** | type: Bool, value: true, description: If multiple contacts match the same name, skip to avoid mis-send; log as business exception. | `BirthdayGreetingsV12.xaml` | 471 |
| 7 | `BGV12.PreferredEmailLabels` | asset | **Aligned** | type: Text, value: personal,home, description: Comma-separated preferred email labels (case-insensitive). | `BirthdayGreetingsV12.xaml` | 528 |
| 8 | `BGV12.SendEnabled` | asset | **Aligned** | type: Bool, value: true, description: Master kill-switch for outbound email sending (when false, generate content but do not send). | `BirthdayGreetingsV12.xaml` | 414 |
| 9 | `BGV12.OperationsDL` | asset | **Aligned** | type: Text, value: , description: Optional distribution list to receive failure notifications (left blank as PDD states no notifications). | `BirthdayGreetingsV12.xaml` | 577 |
| 10 | `BGV12.GoogleWorkspaceCredential` | credential | **Aligned** | type: Credential, description: Reserved credential asset for break-glass scenarios; primary auth is via Integration Service connections. | `InitAllSettings.xaml` | 118 |
| 11 | `BirthdayGreetingsV12_EmailsToSend` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: Work queue for birthday greeting email dispatch items (one per birthday event/person). Supports retry and controlled execution telemetry. | — | — |

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 19/40 high-risk activities inside TryCatch (48%)

### Files Without TryCatch

- `InitAllSettings.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:118` | Get BGV12.GoogleWorkspaceCredential |
| 2 | `InitAllSettings.xaml:119` | ui:GetCredential |
| 3 | `InitAllSettings.xaml:122` | ui:GetCredential |
| 4 | `InitAllSettings.xaml:130` | Get BGV12.CalendarName |
| 5 | `InitAllSettings.xaml:131` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:139` | Get BGV12.Timezone |
| 7 | `InitAllSettings.xaml:140` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:148` | Get BGV12.FromGmailConnectionName |
| 9 | `InitAllSettings.xaml:149` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:157` | Get BGV12.MaxConnectorRetries |
| 11 | `InitAllSettings.xaml:158` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:166` | Get BGV12.RetryBackoffSeconds |
| 13 | `InitAllSettings.xaml:167` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:175` | Get BGV12.SkipOnAmbiguousContactMatch |
| 15 | `InitAllSettings.xaml:176` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:184` | Get BGV12.PreferredEmailLabels |
| 17 | `InitAllSettings.xaml:185` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:193` | Get BGV12.SendEnabled |
| 19 | `InitAllSettings.xaml:194` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:202` | Get BGV12.OperationsDL |
| 21 | `InitAllSettings.xaml:203` | ui:GetAsset |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BGV12_DailyDispatcher_0800_Dubai | SDD-specified: BGV12_DailyDispatcher_0800_Dubai | Cron: 0 0 8 ? * * * | Daily 08:00 Dubai-time dispatcher schedule to fetch today's birthdays and enqueue items. |
| 2 | **Queue** | Defined in SDD orchestrator_artifacts: BGV12_QueuePerformer_EmailsToSend | SDD-specified: BGV12_QueuePerformer_EmailsToSend | Queue: BirthdayGreetingsV12_EmailsToSend | Queue trigger to run performer jobs for each birthday greeting item. |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 93 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `BGV12.GoogleWorkspaceCredential` | Yes |
| 5 | Assets | Provision asset: `BGV12.CalendarName` | Yes |
| 6 | Assets | Provision asset: `BGV12.Timezone` | Yes |
| 7 | Assets | Provision asset: `BGV12.FromGmailConnectionName` | Yes |
| 8 | Assets | Provision asset: `BGV12.MaxConnectorRetries` | Yes |
| 9 | Assets | Provision asset: `BGV12.RetryBackoffSeconds` | Yes |
| 10 | Assets | Provision asset: `BGV12.SendEnabled` | Yes |
| 11 | Assets | Provision asset: `BGV12.SkipOnAmbiguousContactMatch` | Yes |
| 12 | Assets | Provision asset: `BGV12.PreferredEmailLabels` | Yes |
| 13 | Assets | Provision asset: `BGV12.OperationsDL` | Yes |
| 14 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 15 | Testing | Run smoke test in target environment | Yes |
| 16 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 17 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 18 | Governance | Peer code review completed | Yes |
| 19 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 20 | Governance | Business process owner validation obtained | Yes |
| 21 | Governance | CoE approval obtained | Yes |
| 22 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Not Ready — 29/50 (9%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 19 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 4/10 | Only 48% of high-risk activities covered by TryCatch; 1 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 0/10 | 93 quality warnings — significant remediation needed; 94 remediations — stub replacements need developer attention; 3/10 workflow(s) are Studio-loadable (7 blocked — 70% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 282 |
| Valid activities | 261 |
| Unknown → Comment stubs | 20 |
| Non-catalog properties stripped | 52 |
| Enum values auto-corrected | 9 |
| Missing required props filled | 35 |
| Total issues | 96 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 116 auto-fixed, 96 total issues |
| Post-emission (quality gate) | 187 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "Main.xaml",
    "InitAllSettings.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "Dispatcher.xaml",
      "description": "Stripped 18 placeholder token(s) from Dispatcher.xaml",
      "developerAction": "Review Dispatcher.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "MessageComposer.xaml",
      "description": "Stripped 17 placeholder token(s) from MessageComposer.xaml",
      "developerAction": "Review MessageComposer.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "BirthdayGreetingsV12.xaml",
      "description": "Stripped 1 placeholder token(s) from BirthdayGreetingsV12.xaml",
      "developerAction": "Review BirthdayGreetingsV12.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Performer.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in Performer.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "BirthdayGreetingsV12.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in BirthdayGreetingsV12.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml"
    }
  ],
  "remediations": [
    {
      "level": "validation-finding",
      "file": "Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 134: Undeclared variable \"hasMoreItems\" in expression: hasMoreItems — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 488: Undeclared variable \"c\" in expression: If(str_ResolvedEmail.Contains(\"@\"), str_ResolvedEmail.Substr... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 97: Undeclared variable \"ContactResolver\" in expression: ContactResolver — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 139: Undeclared variable \"c\" in expression: str_PreferredLabelsRaw.Split(\",\"c).Select(Function(l) l.Trim... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 139: Undeclared variable \"l\" in expression: str_PreferredLabelsRaw.Split(\",\"c).Select(Function(l) l.Trim... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 225: Possible missing comma or operator between \")\" and \"CType(\" — check expression syntax in expression: ContactList.Where(Function(c) CType(c, Newtonsoft.Json.Linq.JObject)(\"names\") Is...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 225: Undeclared variable \"c\" in expression: ContactList.Where(Function(c) CType(c, Newtonsoft.Json.Linq.... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"Write\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"a\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"short\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"birthday\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"email\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"in\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"my\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"voice\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"warm\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"funny\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"sarcastic\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"light\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"kind\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"Recipient\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"full_name\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"Requirements\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"subject\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"chars\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"body\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"words\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"no\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"emojis\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"links\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"relationship\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"mentions\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"offensive\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"content\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"Output\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 75: Undeclared variable \"exactly\" in expression: Write a short birthday email in my voice: warm, funny, sarca... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"You\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"output\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"valid\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"with\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"exactly\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"two\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"keys\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"subject\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"string\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"max\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"characters\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"and\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"body\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"words\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"Recipient\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"full\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"name\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"full_name\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"Tone\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"warm\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"funny\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"sarcastic\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"No\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"emojis\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"no\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"links\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"relationship\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"references\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"offensive\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"content\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"not\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"include\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"any\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"explanation\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"or\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"markdown\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"Output\" in expression: STRICT MODE. You MUST output ONLY valid JSON with exactly tw... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 66: Undeclared variable \"ninemush\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 66: Undeclared variable \"gmail\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 177: Undeclared variable \"c\" in expression: If(in_RecipientEmail.Contains(\"@\"), in_RecipientEmail.Substr... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 85: Undeclared variable \"run\" in expression: run-summary.json — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 85: Undeclared variable \"summary\" in expression: run-summary.json — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 146: Undeclared variable \"From\" in expression: Newtonsoft.Json.JsonConvert.SerializeObject(New Dictionary(O... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 237: Undeclared variable \"artifactBytes\" in expression: artifactBytes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 87: Undeclared variable \"Asia\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 87: Undeclared variable \"Dubai\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 88: Undeclared variable \"ninemush\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 88: Undeclared variable \"gmail\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 705: Undeclared variable \"calendar\" in expression: /calendar/v3/calendars/primary/events — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 705: Undeclared variable \"v3\" in expression: /calendar/v3/calendars/primary/events — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 705: Undeclared variable \"calendars\" in expression: /calendar/v3/calendars/primary/events — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 705: Undeclared variable \"primary\" in expression: /calendar/v3/calendars/primary/events — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 705: Undeclared variable \"events\" in expression: /calendar/v3/calendars/primary/events — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 878: Undeclared variable \"c\" in expression: str_CurrentFullName.Split(\" \"c)(0) — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 1144: Undeclared variable \"UTF8\" in expression: UTF8 — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"Verbose\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in ContactResolver.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[GET]\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in BirthdayGreetingsV12.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[UTF8]\" for \"Encoding\" on ui:WriteTextFile — valid values: UTF8, Unicode, ASCII, Default. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in BirthdayGreetingsV12.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Init.xaml",
      "detail": "Contains 8 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Init.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Dispatcher.xaml",
      "detail": "Contains 8 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Dispatcher.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
      "detail": "Contains 9 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
      "detail": "Contains 10 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ContactResolver.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ContactResolver.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "MessageComposer.xaml",
      "detail": "Contains 11 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "MessageComposer.xaml",
      "detail": "Contains 14 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 11 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 9 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Finalize.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Finalize.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 333: \"obj_CurrentQueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 117: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 125: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 176: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 184: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 117: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 125: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 176: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 184: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Performer.xaml",
      "detail": "Line 162: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Performer.xaml",
      "detail": "Line 452: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Performer.xaml",
      "detail": "Line 457: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Performer.xaml",
      "detail": "Line 162: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Performer.xaml",
      "detail": "Line 452: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Performer.xaml",
      "detail": "Line 457: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ContactResolver.xaml",
      "detail": "Line 170: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ContactResolver.xaml",
      "detail": "Line 179: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 170: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 179: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 216: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 224: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 410: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 418: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 216: retry interval hardcoded as \"00:00:08\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 224: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 410: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 418: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 275: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 275: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 693: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 698: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 839: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 844: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 970: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 975: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 693: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 698: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 839: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 844: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 970: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 975: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 146: asset name \"BGV12.CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 196: asset name \"BGV12.Timezone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 245: asset name \"BGV12.FromGmailConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 294: asset name \"BGV12.MaxConnectorRetries\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 351: asset name \"BGV12.RetryBackoffSeconds\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 408: asset name \"BGV12.SendEnabled\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 465: asset name \"BGV12.SkipOnAmbiguousContactMatch\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 522: asset name \"BGV12.PreferredEmailLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Line 571: asset name \"BGV12.OperationsDL\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 118: asset name \"BGV12.GoogleWorkspaceCredential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 130: asset name \"BGV12.CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 139: asset name \"BGV12.Timezone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 148: asset name \"BGV12.FromGmailConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 157: asset name \"BGV12.MaxConnectorRetries\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 166: asset name \"BGV12.RetryBackoffSeconds\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 175: asset name \"BGV12.SkipOnAmbiguousContactMatch\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 184: asset name \"BGV12.PreferredEmailLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 193: asset name \"BGV12.SendEnabled\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 202: asset name \"BGV12.OperationsDL\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Missing required property \"Prompt\" on ugenai:UseGenAI",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Missing required property \"Body\" on ugs:GmailSendMessage",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "Performer.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "Performer.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "Performer.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "ContactResolver.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "ContactResolver.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "MessageComposer.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "MessageComposer.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "EmailSender.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "BirthdayGreetingsV12.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 1380,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Init.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "Dispatcher.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "Performer.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "ContactResolver.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected"
      ],
      "failureCategory": "expression-syntax",
      "failureSummary": "Expression syntax errors that could not be auto-corrected"
    },
    {
      "file": "MessageComposer.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "EmailSender.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "Finalize.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "BirthdayGreetingsV12.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 282,
    "validActivities": 261,
    "unknownActivities": 20,
    "strippedProperties": 52,
    "enumCorrections": 9,
    "missingRequiredFilled": 35,
    "commentConversions": 20,
    "issueCount": 96
  }
}
```
