# Developer Handoff Guide

**Project:** BirthdayGreetingsV3
**Generated:** 2026-03-29
**Generation Mode:** Full Implementation
**Mode Reason:** Pattern "transactional-queue" supports full implementation with REFramework (profile: 25.10, framework: Windows)
**Deployment Readiness:** Needs Work (56%)

**Total Estimated Effort: ~170 minutes (2.8 hours)**
**Remediations:** 12 total (0 property, 0 activity, 0 sequence, 11 structural-leaf, 1 workflow)
**Auto-Repairs:** 0
**Quality Warnings:** 88

---

## 1. Completed Work

The following 2 workflow(s) were fully generated without any stub replacements or remediation:

- `WF_Dispatcher.xaml`
- `WF_ResolveContact.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Generated with Remediations |
| 2 | `WF_Init.xaml` | Generated with Remediations |
| 3 | `WF_Dispatcher.xaml` | Fully Generated |
| 4 | `WF_ProcessBirthdayItem.xaml` | Generated with Remediations |
| 5 | `WF_ResolveContact.xaml` | Fully Generated |
| 6 | `WF_GenerateAndValidateMessage.xaml` | Generated with Remediations |
| 7 | `WF_End.xaml` | Generated with Remediations |
| 8 | `InitAllSettings.xaml` | Generated with Remediations |

### Studio Compatibility

| # | Workflow | Compatibility | Blockers |
|---|----------|--------------|----------|
| 1 | `Main.xaml` | Studio-openable | — |
| 2 | `WF_Init.xaml` | Structurally invalid — requires fixes | [empty-container] Line 697: empty <Sequence> "Phase 1 Catch — Asset Read Fail... |
| 3 | `WF_Dispatcher.xaml` | Studio-openable | — |
| 4 | `WF_ProcessBirthdayItem.xaml` | Studio-openable | — |
| 5 | `WF_ResolveContact.xaml` | Openable with warnings | — |
| 6 | `WF_GenerateAndValidateMessage.xaml` | Structurally invalid — requires fixes | [empty-container] Line 67: empty <Sequence> "Initialize workflow-level variab... |
| 7 | `WF_End.xaml` | Openable with warnings | — |
| 8 | `InitAllSettings.xaml` | Studio-openable | — |

**Summary:** 4 clean, 2 with warnings, 2 blocked

> **⚠ 2 workflow(s) have structural defects that will prevent Studio from loading or executing them.** Address the blockers listed above before importing into Studio.

## 2. AI-Resolved with Smart Defaults

No auto-repairs were applied.

## 3. Manual Action Required

### Structural-Leaf Stubs (11)

Individual leaf activities were stubbed while preserving the workflow skeleton (sequences, branches, try/catch, loops, invocations).

| # | File | Activity | Original Tag | Code | Developer Action | Est. Minutes |
|---|------|----------|-------------|------|-----------------|-------------|
| 1 | `WF_Init.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_Init.xaml — workflow ... | 15 |
| 2 | `WF_Init.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_Init.xaml — workflow ... | 15 |
| 3 | `WF_ProcessBirthdayItem.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_ProcessBirthdayItem.x... | 15 |
| 4 | `WF_ProcessBirthdayItem.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_ProcessBirthdayItem.x... | 15 |
| 5 | `WF_GenerateAndValidateMessage.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_GenerateAndValidateMe... | 15 |
| 6 | `WF_GenerateAndValidateMessage.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_GenerateAndValidateMe... | 15 |
| 7 | `WF_GenerateAndValidateMessage.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix ENUM_VIOLATION issue in WF_GenerateAndValidateMessage.xaml — w... | 5 |
| 8 | `WF_End.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_End.xaml — workflow s... | 15 |
| 9 | `WF_End.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_End.xaml — workflow s... | 15 |
| 10 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |
| 11 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Main.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement Main.xaml — compliance transforms corrupted the generated ... | 15 |

### Quality Warnings (88)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `WF_ResolveContact.xaml` | placeholder-value | Contains 12 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `WF_ResolveContact.xaml` | invalid-activity-property | Line 148: property "numberRetries" is not a known property of ui:RetryScope | — | undefined |
| 3 | `WF_ResolveContact.xaml` | invalid-activity-property | Line 148: property "retryInterval" is not a known property of ui:RetryScope | — | undefined |
| 4 | `WF_ResolveContact.xaml` | invalid-activity-property | Line 148: property "body" is not a known property of ui:RetryScope | — | undefined |
| 5 | `WF_End.xaml` | invalid-type-argument | Line 513: x:TypeArguments="Object" may not be a valid .NET type | — | undefined |
| 6 | `WF_End.xaml` | invalid-type-argument | Line 518: x:TypeArguments="Object" may not be a valid .NET type | — | undefined |
| 7 | `WF_End.xaml` | invalid-type-argument | Line 520: x:TypeArguments="Object" may not be a valid .NET type | — | undefined |
| 8 | `WF_Init.xaml` | hardcoded-retry-count | Line 841: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 9 | `WF_Init.xaml` | hardcoded-retry-count | Line 844: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 10 | `WF_Init.xaml` | hardcoded-retry-count | Line 893: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 11 | `WF_Init.xaml` | hardcoded-retry-interval | Line 841: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 12 | `WF_Init.xaml` | hardcoded-retry-interval | Line 844: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 13 | `WF_Init.xaml` | hardcoded-retry-interval | Line 893: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 14 | `WF_ResolveContact.xaml` | hardcoded-retry-count | Line 145: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 15 | `WF_ResolveContact.xaml` | hardcoded-retry-count | Line 199: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 16 | `WF_ResolveContact.xaml` | hardcoded-retry-interval | Line 145: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 17 | `WF_ResolveContact.xaml` | hardcoded-retry-interval | Line 199: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 18 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 269: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 19 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 272: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 20 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 321: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 21 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 473: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 22 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 476: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 23 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-count | Line 525: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 24 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 269: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 25 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 272: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 26 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 321: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 27 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 473: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 28 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 476: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 29 | `WF_GenerateAndValidateMessage.xaml` | hardcoded-retry-interval | Line 525: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 30 | `WF_End.xaml` | hardcoded-retry-count | Line 134: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 31 | `WF_End.xaml` | hardcoded-retry-count | Line 137: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 32 | `WF_End.xaml` | hardcoded-retry-count | Line 186: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 33 | `WF_End.xaml` | hardcoded-retry-count | Line 297: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 34 | `WF_End.xaml` | hardcoded-retry-count | Line 300: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 35 | `WF_End.xaml` | hardcoded-retry-count | Line 349: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 36 | `WF_End.xaml` | hardcoded-retry-count | Line 457: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 37 | `WF_End.xaml` | hardcoded-retry-interval | Line 134: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 38 | `WF_End.xaml` | hardcoded-retry-interval | Line 137: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 39 | `WF_End.xaml` | hardcoded-retry-interval | Line 186: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 40 | `WF_End.xaml` | hardcoded-retry-interval | Line 297: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 41 | `WF_End.xaml` | hardcoded-retry-interval | Line 300: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 42 | `WF_End.xaml` | hardcoded-retry-interval | Line 349: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 43 | `WF_End.xaml` | hardcoded-retry-interval | Line 457: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 44 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "BGV3_OrchestratorCredential_GoogleWorkspace" is hardcoded — consider using ... | — | undefined |
| 45 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 116: asset name "BGV3_CalendarName" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 46 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 123: asset name "BGV3_GmailConnectionName" is hardcoded — consider using a Config.xlsx entry... | — | undefined |
| 47 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV3_GmailConnectionId" is hardcoded — consider using a Config.xlsx entry o... | — | undefined |
| 48 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 137: asset name "BGV3_EmailSubjectTemplate" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 49 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 144: asset name "BGV3_PreferredEmailLabels" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 50 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 151: asset name "BGV3_SenderEmailAddress" is hardcoded — consider using a Config.xlsx entry ... | — | undefined |
| 51 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 158: asset name "BGV3_RunLocalTimeZone" is hardcoded — consider using a Config.xlsx entry or... | — | undefined |
| 52 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 165: asset name "BGV3_AllowSendIfSafetyCheckLowConfidence" is hardcoded — consider using a C... | — | undefined |
| 53 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 172: asset name "BGV3_AISafetyMinScore" is hardcoded — consider using a Config.xlsx entry or... | — | undefined |
| 54 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 179: asset name "BGV3_MaxBirthdaysPerRun" is hardcoded — consider using a Config.xlsx entry ... | — | undefined |
| 55 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 186: asset name "BGV3_NotificationEmail_OnFailure" is hardcoded — consider using a Config.xl... | — | undefined |
| 56 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "One" in expression: New ApplicationException([obj_WFInit]... | — | undefined |
| 57 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "or" in expression: New ApplicationException([obj_WFInit] ... | — | undefined |
| 58 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "more" in expression: New ApplicationException([obj_WFInit... | — | undefined |
| 59 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "critical" in expression: New ApplicationException([obj_WF... | — | undefined |
| 60 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "Orchestrator" in expression: New ApplicationException([ob... | — | undefined |
| 61 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "assets" in expression: New ApplicationException([obj_WFIn... | — | undefined |
| 62 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "have" in expression: New ApplicationException([obj_WFInit... | — | undefined |
| 63 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "empty" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 64 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "whitespace" in expression: New ApplicationException([obj_... | — | undefined |
| 65 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "values" in expression: New ApplicationException([obj_WFIn... | — | undefined |
| 66 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "Assets" in expression: New ApplicationException([obj_WFIn... | — | undefined |
| 67 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "checked" in expression: New ApplicationException([obj_WFI... | — | undefined |
| 68 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "Aborting" in expression: New ApplicationException([obj_WF... | — | undefined |
| 69 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 655: Possible undeclared variable "run" in expression: New ApplicationException([obj_WFInit]... | — | undefined |
| 70 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "Fatal" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 71 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "failure" in expression: New ApplicationException([obj_WFI... | — | undefined |
| 72 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "during" in expression: New ApplicationException([obj_WFIn... | — | undefined |
| 73 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "Orchestrator" in expression: New ApplicationException([ob... | — | undefined |
| 74 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "asset" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 75 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "read" in expression: New ApplicationException([obj_WFInit... | — | undefined |
| 76 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "phase" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 77 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "RunId" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 78 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "runId" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 79 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "Inner" in expression: New ApplicationException([obj_WFIni... | — | undefined |
| 80 | `WF_Init.xaml` | EXPRESSION_SYNTAX | Line 739: Possible undeclared variable "assetException" in expression: New ApplicationException([... | — | undefined |
| 81 | `WF_GenerateAndValidateMessage.xaml` | EXPRESSION_SYNTAX | Line 167: Possible undeclared variable "currentAttempt" in expression: currentAttempt &lt; maxGen... | — | undefined |
| 82 | `WF_GenerateAndValidateMessage.xaml` | EXPRESSION_SYNTAX | Line 167: Possible undeclared variable "maxGenAIRetries" in expression: currentAttempt &lt; maxGe... | — | undefined |
| 83 | `WF_GenerateAndValidateMessage.xaml` | EXPRESSION_SYNTAX | Line 167: Possible undeclared variable "generationSucceeded" in expression: currentAttempt &lt; m... | — | undefined |
| 84 | `WF_GenerateAndValidateMessage.xaml` | TYPE_MISMATCH | Line 401: Type mismatch — variable "obj_LocalChecksPass" (System.Object) bound to If.Condition (e... | — | undefined |
| 85 | `WF_End.xaml` | TYPE_MISMATCH | Line 514: Type mismatch — variable "obj_OpsTasks" (System.Object) bound to ForEach.Values (expect... | — | undefined |
| 86 | `WF_ResolveContact.xaml` | CATALOG_VIOLATION | Missing required property "To" on Assign | — | undefined |
| 87 | `WF_ResolveContact.xaml` | CATALOG_VIOLATION | Missing required property "Value" on Assign | — | undefined |
| 88 | `WF_ResolveContact.xaml` | CATALOG_VIOLATION | Missing required property "Message" on ui:LogMessage | — | undefined |

**Total manual remediation effort: ~170 minutes (2.8 hours)**

## 4. Environment Setup

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
| 4 | `UiPath.Web.Activities` |
| 5 | `Newtonsoft.Json` |

## 5. Credential & Asset Inventory

**Total:** 25 activities (12 hardcoded, 13 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BGV3_OrchestratorCredential_GoogleWorkspace` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV3_CalendarName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV3_GmailConnectionName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV3_GmailConnectionId` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV3_EmailSubjectTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 5 | `BGV3_PreferredEmailLabels` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 6 | `BGV3_SenderEmailAddress` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 7 | `BGV3_RunLocalTimeZone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 8 | `BGV3_AllowSendIfSafetyCheckLowConfidence` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 9 | `BGV3_AISafetyMinScore` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 10 | `BGV3_MaxBirthdaysPerRun` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 11 | `BGV3_NotificationEmail_OnFailure` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `InitAllSettings.xaml` | 104 | GetCredential | `BGV3_OrchestratorCredential_GoogleWorkspace` | Credential | — | Yes |
| `InitAllSettings.xaml` | 105 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 108 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 116 | GetAsset | `BGV3_CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 117 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 123 | GetAsset | `BGV3_GmailConnectionName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 124 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 130 | GetAsset | `BGV3_GmailConnectionId` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 131 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 137 | GetAsset | `BGV3_EmailSubjectTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 138 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 144 | GetAsset | `BGV3_PreferredEmailLabels` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 145 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 151 | GetAsset | `BGV3_SenderEmailAddress` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 152 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 158 | GetAsset | `BGV3_RunLocalTimeZone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 159 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 165 | GetAsset | `BGV3_AllowSendIfSafetyCheckLowConfidence` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 166 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 172 | GetAsset | `BGV3_AISafetyMinScore` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 173 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 179 | GetAsset | `BGV3_MaxBirthdaysPerRun` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 180 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 186 | GetAsset | `BGV3_NotificationEmail_OnFailure` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 187 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 12 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 6. Queue Management

No queue activities detected in the package.

## 7. Exception Handling Coverage

**Coverage:** 0/25 high-risk activities inside TryCatch (0%)

### Files Without TryCatch

- `Main.xaml`
- `InitAllSettings.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:104` | Get BGV3_OrchestratorCredential_GoogleWorkspace |
| 2 | `InitAllSettings.xaml:105` | ui:GetCredential |
| 3 | `InitAllSettings.xaml:108` | ui:GetCredential |
| 4 | `InitAllSettings.xaml:116` | Get BGV3_CalendarName |
| 5 | `InitAllSettings.xaml:117` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:123` | Get BGV3_GmailConnectionName |
| 7 | `InitAllSettings.xaml:124` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:130` | Get BGV3_GmailConnectionId |
| 9 | `InitAllSettings.xaml:131` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:137` | Get BGV3_EmailSubjectTemplate |
| 11 | `InitAllSettings.xaml:138` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:144` | Get BGV3_PreferredEmailLabels |
| 13 | `InitAllSettings.xaml:145` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:151` | Get BGV3_SenderEmailAddress |
| 15 | `InitAllSettings.xaml:152` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:158` | Get BGV3_RunLocalTimeZone |
| 17 | `InitAllSettings.xaml:159` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:165` | Get BGV3_AllowSendIfSafetyCheckLowConfidence |
| 19 | `InitAllSettings.xaml:166` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:172` | Get BGV3_AISafetyMinScore |
| 21 | `InitAllSettings.xaml:173` | ui:GetAsset |
| 22 | `InitAllSettings.xaml:179` | Get BGV3_MaxBirthdaysPerRun |
| 23 | `InitAllSettings.xaml:180` | ui:GetAsset |
| 24 | `InitAllSettings.xaml:186` | Get BGV3_NotificationEmail_OnFailure |
| 25 | `InitAllSettings.xaml:187` | ui:GetAsset |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 8. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **API/Webhook** | Agent/hybrid automation — consider API trigger or webhook for on-demand invocation | POST /odata/Jobs/UiPath.Server.Configuration.OData.StartJobs | Include InputArguments in request body |

## 9. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `BGV3_OrchestratorCredential_GoogleWorkspace` | Yes |
| 5 | Assets | Provision asset: `BGV3_CalendarName` | Yes |
| 6 | Assets | Provision asset: `BGV3_GmailConnectionName` | Yes |
| 7 | Assets | Provision asset: `BGV3_GmailConnectionId` | Yes |
| 8 | Assets | Provision asset: `BGV3_EmailSubjectTemplate` | Yes |
| 9 | Assets | Provision asset: `BGV3_PreferredEmailLabels` | Yes |
| 10 | Assets | Provision asset: `BGV3_SenderEmailAddress` | Yes |
| 11 | Assets | Provision asset: `BGV3_RunLocalTimeZone` | Yes |
| 12 | Assets | Provision asset: `BGV3_AllowSendIfSafetyCheckLowConfidence` | Yes |
| 13 | Assets | Provision asset: `BGV3_AISafetyMinScore` | Yes |
| 14 | Assets | Provision asset: `BGV3_MaxBirthdaysPerRun` | Yes |
| 15 | Assets | Provision asset: `BGV3_NotificationEmail_OnFailure` | Yes |
| 16 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 17 | Testing | Run smoke test in target environment | Yes |
| 18 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 19 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 20 | Governance | Peer code review completed | Yes |
| 21 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 22 | Governance | Business process owner validation obtained | Yes |
| 23 | Governance | CoE approval obtained | Yes |
| 24 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 10. Deployment Readiness Score

**Overall: Needs Work — 28/50 (56%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 12 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 3/10 | Only 0% of high-risk activities covered by TryCatch; 2 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 0/10 | 88 quality warnings — significant remediation needed; 12 remediations — stub replacements need developer attention; 5 planned workflow(s) missing from archive |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

---

## 11. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "WF_Dispatcher.xaml",
    "WF_ResolveContact.xaml"
  ],
  "autoRepairs": [],
  "remediations": [
    {
      "level": "workflow",
      "file": "Main.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML namespace validation failed: Namespace prefix \"upers\" is used in activity tags but has no corresponding xmlns declaration",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement Main.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_Init.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"To\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_Init.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_Init.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"Value\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_Init.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_ProcessBirthdayItem.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"To\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_ProcessBirthdayItem.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_ProcessBirthdayItem.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"Value\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_ProcessBirthdayItem.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"To\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_GenerateAndValidateMessage.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"Value\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_GenerateAndValidateMessage.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "ENUM_VIOLATION: Invalid value \"Information\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Review and fix ENUM_VIOLATION issue in WF_GenerateAndValidateMessage.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "structural-leaf",
      "file": "WF_End.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"To\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_End.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "WF_End.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"Value\" on Assign must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in WF_End.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"WorkbookPath\" on uexcel:ExcelApplicationScope must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "structural-leaf",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_STRUCTURAL_LEAF",
      "reason": "Property \"DataTable\" on uexcel:ExcelReadRange must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — workflow structure was preserved intact",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "WF_ResolveContact.xaml",
      "detail": "Contains 12 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 148: property \"numberRetries\" is not a known property of ui:RetryScope",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 148: property \"retryInterval\" is not a known property of ui:RetryScope",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 148: property \"body\" is not a known property of ui:RetryScope",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "WF_End.xaml",
      "detail": "Line 513: x:TypeArguments=\"Object\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "WF_End.xaml",
      "detail": "Line 518: x:TypeArguments=\"Object\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "WF_End.xaml",
      "detail": "Line 520: x:TypeArguments=\"Object\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_Init.xaml",
      "detail": "Line 841: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_Init.xaml",
      "detail": "Line 844: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_Init.xaml",
      "detail": "Line 893: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_Init.xaml",
      "detail": "Line 841: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_Init.xaml",
      "detail": "Line 844: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_Init.xaml",
      "detail": "Line 893: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 145: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 199: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 145: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_ResolveContact.xaml",
      "detail": "Line 199: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 269: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 272: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 321: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 473: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 476: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 525: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 269: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 272: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 321: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 473: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 476: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 525: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 134: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 137: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 186: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 297: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 300: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 349: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "WF_End.xaml",
      "detail": "Line 457: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 134: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 137: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 186: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 297: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 300: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 349: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "WF_End.xaml",
      "detail": "Line 457: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"BGV3_OrchestratorCredential_GoogleWorkspace\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 116: asset name \"BGV3_CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 123: asset name \"BGV3_GmailConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 130: asset name \"BGV3_GmailConnectionId\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 137: asset name \"BGV3_EmailSubjectTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 144: asset name \"BGV3_PreferredEmailLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 151: asset name \"BGV3_SenderEmailAddress\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 158: asset name \"BGV3_RunLocalTimeZone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 165: asset name \"BGV3_AllowSendIfSafetyCheckLowConfidence\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 172: asset name \"BGV3_AISafetyMinScore\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 179: asset name \"BGV3_MaxBirthdaysPerRun\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 186: asset name \"BGV3_NotificationEmail_OnFailure\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"One\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"or\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"more\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"critical\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"Orchestrator\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"assets\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"have\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"empty\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"whitespace\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"values\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"Assets\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"checked\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"Aborting\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 655: Possible undeclared variable \"run\" in expression: New ApplicationException([obj_WFInit] FATAL: One or more cri...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"Fatal\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"failure\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"during\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"Orchestrator\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"asset\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"read\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"phase\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"RunId\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"runId\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"Inner\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_Init.xaml",
      "detail": "Line 739: Possible undeclared variable \"assetException\" in expression: New ApplicationException([obj_WFInit] Fatal failure during O...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 167: Possible undeclared variable \"currentAttempt\" in expression: currentAttempt &lt; maxGenAIRetries AndAlso Not generationSu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 167: Possible undeclared variable \"maxGenAIRetries\" in expression: currentAttempt &lt; maxGenAIRetries AndAlso Not generationSu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 167: Possible undeclared variable \"generationSucceeded\" in expression: currentAttempt &lt; maxGenAIRetries AndAlso Not generationSu...",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "WF_GenerateAndValidateMessage.xaml",
      "detail": "Line 401: Type mismatch — variable \"obj_LocalChecksPass\" (System.Object) bound to If.Condition (expects System.Boolean). No known conversion from System.Object to System.Boolean — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "WF_End.xaml",
      "detail": "Line 514: Type mismatch — variable \"obj_OpsTasks\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). No known conversion from System.Object to System.Collections.IEnumerable — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "WF_ResolveContact.xaml",
      "detail": "Missing required property \"To\" on Assign",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "WF_ResolveContact.xaml",
      "detail": "Missing required property \"Value\" on Assign",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "WF_ResolveContact.xaml",
      "detail": "Missing required property \"Message\" on ui:LogMessage",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 170,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "WF_Init.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[empty-container] Line 697: empty <Sequence> \"Phase 1 Catch — Asset Read Failure\" — may indicate dropped generation output"
      ]
    },
    {
      "file": "WF_Dispatcher.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "WF_ProcessBirthdayItem.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "WF_ResolveContact.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "WF_GenerateAndValidateMessage.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[empty-container] Line 67: empty <Sequence> \"Initialize workflow-level variables from InConfig dictionary\" — may indicate dropped generation output"
      ]
    },
    {
      "file": "WF_End.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    }
  ]
}
```
