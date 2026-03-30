# Developer Handoff Guide

**Project:** BirthdayGreetingsV10
**Generated:** 2026-03-30
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (8%)

**Total Estimated Effort: ~75 minutes (1.3 hours)**
**Remediations:** 5 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 0 workflow)
**Auto-Repairs:** 2
**Quality Warnings:** 3

---

## 1. Completed Work

The following 1 workflow(s) were fully generated without any stub replacements or remediation:

- `Main.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `GetTodaysBirthdayEvents.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 3 | `ResolveRecipientEmail.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 4 | `GenerateGreetingWithPolicyGate.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 5 | `CreatePolicyReviewTask.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 6 | `SendGreetingEmail.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 7 | `PersistAuditAndIdempotency.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 8 | `InitAllSettings.xaml` | Generated with Remediations |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `GetTodaysBirthdayEvents.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 3 | `ResolveRecipientEmail.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 4 | `GenerateGreetingWithPolicyGate.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 5 | `CreatePolicyReviewTask.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 6 | `SendGreetingEmail.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 7 | `PersistAuditAndIdempotency.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 8 | `InitAllSettings.xaml` | Studio-openable | — | — |

**Summary:** 1 Studio-loadable, 1 with warnings, 6 not Studio-loadable

> **⚠ 6 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

## 2. AI-Resolved with Smart Defaults

The following 2 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 2 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (5)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `InitAllSettings.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in InitAllSettings.xaml — estimated 15 min | 15 |
| 2 | `InitAllSettings.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in InitAllSettings.xaml — estimated 15 min | 15 |
| 3 | `InitAllSettings.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in InitAllSettings.xaml — estimated 15 min | 15 |
| 4 | `InitAllSettings.xaml` | `CATALOG_STRUCTURAL_VIOLATION` | Fix property syntax for activity in InitAllSettings.xaml — move attribute to ... | 15 |
| 5 | `InitAllSettings.xaml` | `CATALOG_STRUCTURAL_VIOLATION` | Fix property syntax for activity in InitAllSettings.xaml — move attribute to ... | 15 |

### Quality Warnings (3)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Main.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "Asset.TimeZoneId" is hardcoded — consider using a Config.xlsx entry or work... | — | undefined |
| 3 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 113: asset name "Asset.GenAI.SystemPrompt" is hardcoded — consider using a Config.xlsx entry... | — | undefined |

**Total manual remediation effort: ~75 minutes (1.3 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary
The “birthday greetings v10” automation will run autonomously every day at 8:00 AM to identify birthdays listed in a dedicated Google Calendar named “Birthdays” and send a personalized birthday greeting email from the user’s Gmail account. The automation will retrieve birthday events for the current day (supporting both all‑day and timed events), resolve the recipient’s email address via Google Contacts based on full name, select the preferred email when multiple addresses exist (prioritizing Personal/Home), generate a message in the user’s warm/funny/sarcastic voice using UiPath-native GenAI capabilities, and send the email through UiPath Integration Service using the Gmail connector connection **“ninemush@gmail.com”**. If no birthday events exist for the day, the process ends with no action. If a contact email cannot be found, the automation will do nothing (per final business rule).

## 2. Process Scope
This PDD covers the end-to-end process of daily birthday detection and email greeting delivery. The in-scope activities include: scheduled triggering at 8:00 AM, reading events from the Google Calendar “Birthdays,” parsing event names, searching Google Contacts for corresponding email addresses by full name, selecting the correct address when multiple emails are returned (Personal/Home preference), AI-assisted generation of personalized email content in the user’s voice, applying a message policy/safety gate, and sending the email from Gmail via Integration Service using connection **ninemush@gmail.com**.

Out of scope for this iteration are: usage of Google Drive, use of Microsoft Azure OpenAI (or any non-UiPath LLM endpoint), use of Slack/Teams/Twilio channels, and incorporating Google Photos or other images into the greeting content (explicitly deferred to a future iteration). Relationship metadata is also out of scope because it is not present in the calendar data.

## 3. As-Is Process Description

![As-Is Process Map](/api/ideas/f78aae...

### SDD Summary

## 1. Automation Architecture Overview

### Chosen pattern and rationale
**Pattern: Unattended single-process (REFramework-style) with optional exception-only Human-in-the-Loop (Action Center)**  
- **Why not dispatcher–performer / queues?** Daily volume is typically very small (0–N birthdays/day) and work is time-based, not backlog-based. Orchestrator **Queues** add operational overhead without meaningful scaling benefit. We will still implement **idempotency** and **audit** via **Data Service** rather than queue-based de-duplication.
- **Why not Maestro BPMN as primary orchestrator?** The happy path is a single autonomous run with minimal branching. Maestro becomes valuable if the process evolves into multi-day cases (e.g., photo selection, approvals, follow-ups). We will keep Maestro as an optional “next step” for v11+, and focus on robust Orchestrator scheduling now.
- **Why not Agents as primary executor?** The process is deterministic (read calendar → lookup email → generate text → send). Using an agent as the main runtime introduces uncertainty and additional governance needs. We will use **UiPath GenAI Activities** for controlled generation and validation rather than agent-led autonomy.

### Execution topology
- **Robots:** Unattended only (13 slots available) — **background execution**, no UI automation dependency.
- **Recommended runtime:** **Serverless / Cross-Platform unattended** (preferred) *if available in this tenant*, because the workflow uses Integration Service and cloud APIs only. If Serverless is not enabled, run on standard unattended Windows VM.
- **Trigger:** Orchestrator **time-based trigger** at **08:00 AM** in the configured timezone.

### Services used (and why)
- **Orchestrator:** scheduling, assets, logs, job control, retries, and operational visibility.
- **Integration Service:** API-first Google connectivity using managed auth; avoids brittle UI automation and disallowed custom HTTP.
- **UiPath GenAI Activities:** generate message in ...

**Automation Type:** hybrid
**Rationale:** The calendar/contact lookup and email sending are deterministic API steps (RPA), but generating a “warm/funny/sarcastic in my voice” message is best handled by an agentic/GenAI step with guardrails and fallbacks.
**Feasibility Complexity:** low
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | Daily 8AM Birthday Trigger | System | Orchestrator Triggers | start | — |
| 2 | Read Today’s Events from "Birthdays" Calendar | System | Integration Service - Google Calendar | task | — |
| 3 | Any Birthdays Today? | System | Orchestrator | decision | — |
| 4 | End (No Birthdays Today) | System | Orchestrator | end | — |
| 5 | For Each Birthday Event (Name) | System | Orchestrator | task | — |
| 6 | Lookup Contact Emails by Full Name | System | Google Contacts (UiPath Activity) | task | — |
| 7 | Email Found? | System | Orchestrator | decision | — |
| 8 | Select Preferred Email (Personal/Home First) | System | Orchestrator | task | — |
| 9 | Generate Birthday Message in My Voice | System | UiPath GenAI Activities | agent-task | — |
| 10 | Message Policy Check (No sensitive/unsafe content) | System | UiPath GenAI Activities | decision | — |
| 11 | Send Birthday Email | System | Integration Service - Gmail (connection: ninemush@gmail.com) | task | — |
| 12 | End (Greetings Sent) | System | Orchestrator | end | — |
| 13 | Create Human Review Task (Rewrite Needed) | You | Action Center | task | — |
| 14 | Apply Approved Edited Message | System | Orchestrator | task | — |
| 15 | Send Birthday Email (Reviewed) | System | Integration Service - Gmail (connection: ninemush@gmail.com) | task | — |
| 16 | End (No Email Found — Do Nothing) | System | Orchestrator | end | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Google Contacts (UiPath Activity)
- UiPath GenAI Activities
- Integration Service - Gmail (connection: ninemush@gmail.com)
- Action Center

### User Roles Involved

- System
- You

### Decision Points (Process Map Topology)

**Any Birthdays Today?**
  - [No] → End (No Birthdays Today)
  - [Yes] → For Each Birthday Event (Name)

**Email Found?**
  - [No] → End (No Email Found — Do Nothing)
  - [Yes] → Select Preferred Email (Personal/Home First)

**Message Policy Check (No sensitive/unsafe content)**
  - [Pass] → Send Birthday Email
  - [Fail] → Create Human Review Task (Rewrite Needed)

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

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Google Contacts (UiPath Activity)
- UiPath GenAI Activities
- Integration Service - Gmail (connection: ninemush@gmail.com)
- Action Center

## 7. Credential & Asset Inventory

**Total:** 4 activities (2 hardcoded, 2 variable-driven)

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `Asset.TimeZoneId` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `Asset.GenAI.SystemPrompt` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `InitAllSettings.xaml` | 104 | GetAsset | `Asset.TimeZoneId` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 105 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 113 | GetAsset | `Asset.GenAI.SystemPrompt` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 114 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 2 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 2 aligned, 0 SDD-only, 0 XAML-only

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `Asset.TimeZoneId` | asset | **Aligned** | type: Text, value: America/Los_Angeles, description: Timezone used to compute today's dayStart/dayEnd for calendar queries and audit timestamps. | `InitAllSettings.xaml` | 104 |
| 2 | `Asset.GenAI.SystemPrompt` | asset | **Aligned** | type: Text, value: , description: System instruction defining tone/voice and safety constraints for GenAI greeting generation. | `InitAllSettings.xaml` | 113 |

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 0/4 high-risk activities inside TryCatch (0%)

### Files Without TryCatch

- `GetTodaysBirthdayEvents.xaml`
- `ResolveRecipientEmail.xaml`
- `GenerateGreetingWithPolicyGate.xaml`
- `CreatePolicyReviewTask.xaml`
- `SendGreetingEmail.xaml`
- `PersistAuditAndIdempotency.xaml`
- `InitAllSettings.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:104` | Get Asset.TimeZoneId |
| 2 | `InitAllSettings.xaml:105` | ui:GetAsset |
| 3 | `InitAllSettings.xaml:113` | Get Asset.GenAI.SystemPrompt |
| 4 | `InitAllSettings.xaml:114` | ui:GetAsset |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BirthdayGreetingsV10_Autonomous - Daily 08:00 | SDD-specified: BirthdayGreetingsV10_Autonomous - Daily 08:00 | Cron: 0 0 8 * * ? | Time-based trigger to run daily at 08:00 AM in configured timezone. |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 3 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Assets | Provision asset: `Asset.TimeZoneId` | Yes |
| 5 | Assets | Provision asset: `Asset.GenAI.SystemPrompt` | Yes |
| 6 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 7 | Testing | Run smoke test in target environment | Yes |
| 8 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 9 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 10 | Governance | Peer code review completed | Yes |
| 11 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 12 | Governance | Business process owner validation obtained | Yes |
| 13 | Governance | CoE approval obtained | Yes |
| 14 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Not Ready — 28/50 (8%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 6/10 | 2 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 0% of high-risk activities covered by TryCatch; 7 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 0/10 | 5 remediation(s) to complete; 2/8 workflow(s) are Studio-loadable (6 blocked — 75% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 163 |
| Valid activities | 148 |
| Unknown → Comment stubs | 13 |
| Non-catalog properties stripped | 25 |
| Enum values auto-corrected | 20 |
| Missing required props filled | 18 |
| Total issues | 64 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 76 auto-fixed, 64 total issues |
| Post-emission (quality gate) | 8 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "Main.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "InitAllSettings.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml"
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
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 71: Undeclared variable \"Reading\" in expression: 'Reading configuration from Config.xlsx...' — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in InitAllSettings.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 71: Undeclared variable \"configuration\" in expression: 'Reading configuration from Config.xlsx...' — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in InitAllSettings.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 71: Undeclared variable \"from\" in expression: 'Reading configuration from Config.xlsx...' — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in InitAllSettings.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "Property \"WorkbookPath\" on uexcel:ExcelApplicationScope must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Fix property syntax for activity in InitAllSettings.xaml — move attribute to child-element or vice versa per UiPath catalog",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "Property \"DataTable\" on uexcel:ExcelReadRange must be a child element, not an attribute",
      "classifiedCheck": "CATALOG_STRUCTURAL_VIOLATION",
      "developerAction": "Fix property syntax for activity in InitAllSettings.xaml — move attribute to child-element or vice versa per UiPath catalog",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"Asset.TimeZoneId\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 113: asset name \"Asset.GenAI.SystemPrompt\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 75,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "GetTodaysBirthdayEvents.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "ResolveRecipientEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "GenerateGreetingWithPolicyGate.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "CreatePolicyReviewTask.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "SendGreetingEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "PersistAuditAndIdempotency.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 163,
    "validActivities": 148,
    "unknownActivities": 13,
    "strippedProperties": 25,
    "enumCorrections": 20,
    "missingRequiredFilled": 18,
    "commentConversions": 13,
    "issueCount": 64
  }
}
```
