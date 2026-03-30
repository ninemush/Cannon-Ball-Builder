# Developer Handoff Guide

**Project:** BirthdayGreetingsV9
**Generated:** 2026-03-30
**Generation Mode:** Baseline Openable (minimal, deterministic)
**Deployment Readiness:** Not Ready (39%)

**Total Estimated Effort: ~255 minutes (4.3 hours)**
**Remediations:** 14 total (0 property, 10 activity, 1 sequence, 2 structural-leaf, 1 workflow)
**Auto-Repairs:** 3
**Quality Warnings:** 6

---

## 1. Completed Work

The following 6 workflow(s) were fully generated without any stub replacements or remediation:

- `Main.xaml`
- `GetTransactionData.xaml`
- `SetTransactionStatus.xaml`
- `CloseAllApplications.xaml`
- `KillAllProcesses.xaml`
- `AgentInvocation_Stub.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Process.xaml` | Structurally invalid — XML well-formedness failure in tree assembler |
| 2 | `InitAllSettings.xaml` | Generated with Remediations |
| 3 | `Main.xaml` | Fully Generated |
| 4 | `GetTransactionData.xaml` | Fully Generated |
| 5 | `SetTransactionStatus.xaml` | Fully Generated |
| 6 | `CloseAllApplications.xaml` | Fully Generated |
| 7 | `KillAllProcesses.xaml` | Fully Generated |
| 8 | `AgentInvocation_Stub.xaml` | Fully Generated |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Process.xaml` | Structurally invalid — not Studio-loadable | Xml Wellformedness | [XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler |
| 2 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 3 | `Main.xaml` | Studio-openable | — | — |
| 4 | `GetTransactionData.xaml` | Studio-openable | — | — |
| 5 | `SetTransactionStatus.xaml` | Studio-openable | — | — |
| 6 | `CloseAllApplications.xaml` | Studio-openable | — | — |
| 7 | `KillAllProcesses.xaml` | Studio-openable | — | — |
| 8 | `AgentInvocation_Stub.xaml` | Openable with warnings | Unclassified | — |

**Summary:** 6 Studio-loadable, 1 with warnings, 1 not Studio-loadable

> **⚠ 1 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

## 2. AI-Resolved with Smart Defaults

The following 3 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `Process.xaml` | Stripped 1 placeholder token(s) from Process.xaml | 5 |
| 2 | `REPAIR_GENERIC` | `unknown` | Structural preservation: InitAllSettings.xaml preserved unchanged — XML is valid but blocking iss... | undefined |
| 3 | `REPAIR_GENERIC` | `unknown` | Skipped full-package stub escalation — structural-preservation stubs already cover affected files | undefined |

## 3. Manual Action Required

### Activity-Level Stubs (10)

Entire activities were replaced with TODO stubs. The surrounding workflow structure is preserved.

| # | File | Activity | Code | Developer Action | Est. Minutes |
|---|------|----------|------|-----------------|-------------|
| 1 | `Process.xaml` | Decision: Any Birthdays Today? | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Decision: Any Birthdays Today?" activity in Process.xaml ... | 15 |
| 2 | `Process.xaml` | Stub: Decision: Any Birthdays Today? | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Decision: Any Birthdays Today?" activity in Process... | 15 |
| 3 | `Process.xaml` | Try Retry: Select Preferred Email (Personal &gt; Home) | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Try Retry: Select Preferred Email (Personal &gt; Home)" a... | 15 |
| 4 | `Process.xaml` | Stub: Try Retry: Select Preferred Email (Personal &amp;gt; Home) | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Try Retry: Select Preferred Email (Personal &amp;gt... | 15 |
| 5 | `Process.xaml` | Rethrow | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Rethrow" activity in Process.xaml — estimated 15 min | 15 |
| 6 | `Process.xaml` | Stub: Rethrow | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Rethrow" activity in Process.xaml — estimated 15 min | 15 |
| 7 | `Process.xaml` | Log Screenshot Failure | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Log Screenshot Failure" activity in Process.xaml — estima... | 15 |
| 8 | `Process.xaml` | Stub: Log Screenshot Failure | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Log Screenshot Failure" activity in Process.xaml — ... | 15 |
| 9 | `Process.xaml` | Execute: Get Next Person from Queue | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Execute: Get Next Person from Queue" activity in Process.... | 15 |
| 10 | `Process.xaml` | Stub: Execute: Get Next Person from Queue | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Execute: Get Next Person from Queue" activity in Pr... | 15 |

### Sequence-Level Stubs (1)

Sequence children were replaced with a single TODO stub because multiple activities in the sequence had issues.

| # | File | Sequence | Code | Developer Action | Est. Minutes |
|---|------|----------|------|-----------------|-------------|
| 1 | `Process.xaml` | Process | `STUB_SEQUENCE_MULTIPLE_FAILURES` | Re-implement 4 activities in sequence "Process" in Process.xaml | 60 |

### Structural-Leaf Stubs (2)

Individual leaf activities were stubbed while preserving the workflow skeleton (sequences, branches, try/catch, loops, invocations).

| # | File | Activity | Original Tag | Code | Developer Action | Est. Minutes |
|---|------|----------|-------------|------|-----------------|-------------|
| 1 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |
| 2 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |

#### Structural Preservation Metrics

| File | Total Activities | Preserved | Stubbed | Preservation Rate | Studio-Loadable | Preserved Structures |
|------|-----------------|-----------|---------|-------------------|----------------|---------------------|
| `InitAllSettings.xaml` | 38 | 38 | 0 | 100% | Yes | Activity, Sequence (Initialize All Settings), Sequence.Variables... (+6) |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Process.xaml` | `STUB_WORKFLOW_BLOCKING` | Fix XML structure in Process.xaml — ensure proper nesting and closing tags | 15 |

### Quality Warnings (6)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `AgentInvocation_Stub.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `Process.xaml` | invalid-type-argument | Line 71: x:TypeArguments="UiPath.Persistence.Activities.FormTask" may not be a valid .NET type | — | undefined |
| 3 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "BGV9_Timezone" is hardcoded — consider using a Config.xlsx entry or workflo... | — | undefined |
| 4 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 111: asset name "BGV9_MaxMessageChars" is hardcoded — consider using a Config.xlsx entry or ... | — | undefined |
| 5 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV9_EnableHumanReview" is hardcoded — consider using a Config.xlsx entry o... | — | undefined |
| 6 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 125: asset name "BGV9_SendRunSummaryEmail" is hardcoded — consider using a Config.xlsx entry... | — | undefined |

**Total manual remediation effort: ~255 minutes (4.3 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary  
The “birthday greetings v9” project will automate a daily birthday-check and email-greeting process that is currently performed manually at approximately 8:00 AM. The automation will run fully unattended in UiPath Orchestrator, read birthday events from a dedicated Google Calendar named “Birthdays,” look up recipient email addresses in Google Contacts, generate a warm/funny/sarcastic birthday message in the user’s voice using UiPath native GenAI capabilities (not OpenAI), and send the email through the Gmail Integration Service connector using the **`ninemush@gmail.com`** connection. The target outcome is consistent, on-time delivery of personalized birthday greetings with minimal user effort and no desktop interaction.

## 2. Process Scope  
This automation covers the end-to-end workflow from detecting birthdays scheduled for “today” in the Google Calendar “Birthdays” calendar through sending a personalized email greeting via Gmail. It includes: (a) daily scheduling at 8:00 AM, (b) retrieval of birthday event(s) from the “Birthdays” calendar, (c) identification of each birthday person, (d) contact lookup in Google Contacts, (e) selection of the preferred email address when multiple exist (preference order: **Personal > Home**), (f) AI generation of a personalized message in a warm/funny/sarcastic tone aligned to the user’s voice, and (g) sending the email from **ninemush@gmail.com**.

Out of scope for this version are: use of Google Drive; use of OpenAI/Azure OpenAI; use of Slack, Teams, or Twilio; and use of photos (including Google Photos). Additionally, relationship information is not used because it is not stored in the calendar events.

## 3. As-Is Process Description

![As-Is Process Map](/api/ideas/a9557554-4bd9-4f08-abf4-8b3259446486/process-map/image?viewType=as-is&v=1774865522544)  
In the current (manual) process, the user initiates a daily check at around 8:00 AM (As-Is Step “Daily 8am Check Starts”). The user opens Google Cale...

### SDD Summary

## 1. Automation Architecture Overview

### Chosen automation type and rationale
This process is best delivered as a **Hybrid (RPA + GenAI + exception-only Human-in-the-Loop)** solution:

- **Unattended RPA (primary path)**: deterministic orchestration (schedule, calendar read, contact lookup, email sending) is rules-based and must run fully autonomous at 8:00 AM with no UI—ideal for unattended execution.
- **GenAI (content generation)**: message writing in a warm/funny/sarcastic “your voice” is non-deterministic; UiPath **native GenAI Activities** are used with guardrails and a quality gate.
- **Action Center (rare path)**: only used when the generated message fails policy/quality checks or when downstream failures require a human decision. This preserves autonomy while providing operational safety.

### Solution pattern
**Queue-driven fan-out with dispatcher/performer + REFramework-style transaction handling**:

- **Dispatcher** (daily): pulls today’s birthdays and creates one **Orchestrator Queue** item per person.
- **Performer** (transactional): processes each person as an independent transaction, enabling retries, audit history, and parallelism if needed.
- Rationale for **Orchestrator Queues vs Data Service as the work driver**:
  - Queues provide built-in transaction states, retries, SLA-style visibility, and easy scaling for “N birthdays today”.
  - Data Service is used for **persistence and reporting** (history, idempotency), not as the transactional work engine.

### UiPath services used (and why)
- **Orchestrator**: schedules, queues, assets, logs, alerting hooks, job control; core runtime for unattended.
- **Integration Service**: mandated for external calls; used for **Gmail** and (to be provisioned) **Google Calendar** and **Google Contacts** connectors.
- **UiPath GenAI Activities**: native message generation (explicitly not OpenAI).
- **Action Center + Data Service**: optional human review for blocked messages; task payload stored/persisted in Data ...

**Automation Type:** hybrid
**Rationale:** Calendar/contact retrieval and sending are deterministic (RPA via Integration Service), but the message must be generated “in your voice” with tone control and safety checks (agentic GenAI), making a hybrid the most maintainable split.
**Feasibility Complexity:** medium
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | Daily 8:00 AM Trigger | System | Orchestrator Triggers | start | — |
| 2 | Fetch Today's Events from "Birthdays" Calendar | System | Google Calendar (Integration Service connector) | task | — |
| 3 | Any Birthdays Today? | System | Google Calendar (Integration Service connector) | decision | — |
| 4 | Build Birthday Recipient Worklist | System | Orchestrator | task | — |
| 5 | Complete Run (No Birthdays) | System | Orchestrator | end | — |
| 6 | Create Queue Items (One per Person) | System | Orchestrator Queues | task | — |
| 7 | Get Next Person from Queue | System | Orchestrator Queues | task | — |
| 8 | Lookup Contact in Google Contacts | System | Google Contacts (Integration Service connector) | task | — |
| 9 | Email Found? | System | Google Contacts (Integration Service connector) | decision | — |
| 10 | Select Preferred Email (Personal > Home) | System | Google Contacts (Integration Service connector) | task | — |
| 11 | Skip This Person (No Email Found) | System | Orchestrator | task | — |
| 12 | Generate Personalized Birthday Message (warm/funny/sarcastic voice) | System | UiPath GenAI Activities | agent-task | — |
| 13 | Message Quality/Safety OK? | System | UiPath GenAI Activities | decision | — |
| 14 | Send Birthday Email | System | Gmail (Integration Service, connection: ninemush@gmail.com) | task | — |
| 15 | Create Action Center Review Task (Draft Message) | System | Action Center | task | — |
| 16 | Mark Queue Item Successful | System | Orchestrator Queues | task | — |
| 17 | Mark Queue Item Pending Review | System | Orchestrator Queues | task | — |
| 18 | More Queue Items Remaining? | System | Orchestrator Queues | decision | — |
| 19 | More Queue Items Remaining? | System | Orchestrator Queues | decision | — |
| 20 | Get Next Person from Queue | System | Orchestrator Queues | task | — |
| 21 | Complete Run (All Processed) | System | Orchestrator | end | — |
| 22 | Get Next Person from Queue | System | Orchestrator Queues | task | — |
| 23 | Loop Back for Next Person | System | Orchestrator | task | — |
| 24 | Loop Back for Next Person | System | Orchestrator | task | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Google Calendar (Integration Service connector)
- Orchestrator
- Orchestrator Queues
- Google Contacts (Integration Service connector)
- UiPath GenAI Activities
- Gmail (Integration Service, connection: ninemush@gmail.com)
- Action Center

### User Roles Involved

- System

### Decision Points (Process Map Topology)

**Any Birthdays Today?**
  - [Yes] → Build Birthday Recipient Worklist
  - [No] → Complete Run (No Birthdays)

**Email Found?**
  - [Yes] → Select Preferred Email (Personal > Home)
  - [No] → Skip This Person (No Email Found)

**Message Quality/Safety OK?**
  - [Yes] → Send Birthday Email
  - [No] → Create Action Center Review Task (Draft Message)

**More Queue Items Remaining?**
  - [Yes] → Get Next Person from Queue
  - [No] → Complete Run (All Processed)

**More Queue Items Remaining?**
  - [Yes] → Get Next Person from Queue
  - [No] → Complete Run (All Processed)

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

Create a Modern Folder with unattended robot pool (2+ robots recommended for queue-based processing). Enable Auto-scaling if available.

### NuGet Dependencies

| # | Package |
|---|--------|
| 1 | `UiPath.System.Activities` |
| 2 | `UiPath.Excel.Activities` |
| 3 | `UiPath.UIAutomation.Activities` |
| 4 | `UiPath.Persistence.Activities` |
| 5 | `UiPath.Mail.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Google Calendar (Integration Service connector)
- Orchestrator
- Orchestrator Queues
- Google Contacts (Integration Service connector)
- UiPath GenAI Activities
- Gmail (Integration Service, connection: ninemush@gmail.com)
- Action Center

## 7. Credential & Asset Inventory

**Total:** 8 activities (4 hardcoded, 4 variable-driven)

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV9_Timezone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV9_MaxMessageChars` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV9_EnableHumanReview` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV9_SendRunSummaryEmail` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `InitAllSettings.xaml` | 104 | GetAsset | `BGV9_Timezone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 105 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 111 | GetAsset | `BGV9_MaxMessageChars` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 112 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 118 | GetAsset | `BGV9_EnableHumanReview` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 119 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 125 | GetAsset | `BGV9_SendRunSummaryEmail` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 126 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 4 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 4 aligned, 1 SDD-only, 1 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 1 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV9_Timezone` | asset | **Aligned** | type: Text, value: , description: Timezone used to compute 'today' for calendar query and SLA timing. | `InitAllSettings.xaml` | 104 |
| 2 | `BGV9_MaxMessageChars` | asset | **Aligned** | type: Integer, value: , description: Maximum allowed character length for generated email body (quality gate constraint). | `InitAllSettings.xaml` | 111 |
| 3 | `BGV9_EnableHumanReview` | asset | **Aligned** | type: Bool, value: , description: Enables Action Center review path when GenAI output fails quality/safety checks or ambiguous contact cases require a decision. | `InitAllSettings.xaml` | 118 |
| 4 | `BGV9_SendRunSummaryEmail` | asset | **Aligned** | type: Bool, value: , description: When true, sends a run-level failure/summary email via Gmail connector (disabled by default). | `InitAllSettings.xaml` | 125 |
| 5 | `BirthdayGreetingsV9_Queue` | queue | **SDD Only** | maxRetries: 3, uniqueReference: true, description: Work queue driving per-person birthday greeting transactions (dispatcher creates 1 item per person; performer processes with retries/audit). Queue item reference format: YYYYMMDD_FullName. | — | — |
| 6 | `[in_QueueName]` | queue | **XAML Only** | — | `GetTransactionData.xaml` | 63 |

## 9. Queue Management

**Pattern:** Transactional (Dispatcher/Performer)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `[in_QueueName]` | GetTransactionItem | Recommended | Yes (3x) | — | Verify exists |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BirthdayGreetingsV9_Queue` | Yes | 3x | — | Defined in SDD but no matching XAML activity — verify implementation |

### Queue Activity Summary

| Capability | Present |
|---|---|
| Add Queue Item | No |
| Get Transaction Item | Yes |
| Set Transaction Status | Yes |

### Retry Policy

Transactional pattern detected — configure Auto Retry (recommended: 3 retries) in Orchestrator Queue settings

### SLA Guidance

Configure SLA in Orchestrator: set Maximum Execution Time per transaction item and monitor Queue SLA reports. Recommended: base SLA on observed P95 processing time + 20% buffer.

### Dead-Letter / Failed Items Handling

Items exceeding max retries are marked as Failed. Review failed items in Orchestrator Queues dashboard. Consider: (1) Create a separate cleanup/reprocessing workflow for DLQ items, (2) Set up email alerts for failed transaction counts exceeding threshold, (3) Log detailed failure context in SetTransactionStatus output for troubleshooting.

> **Note:** This is a Performer process — a separate Dispatcher process is needed to populate the queue.

## 10. Exception Handling Coverage

**Coverage:** 0/10 high-risk activities inside TryCatch (0%)

### Files Without TryCatch

- `Process.xaml`
- `InitAllSettings.xaml`
- `GetTransactionData.xaml`
- `KillAllProcesses.xaml`
- `AgentInvocation_Stub.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:104` | Get BGV9_Timezone |
| 2 | `InitAllSettings.xaml:105` | ui:GetAsset |
| 3 | `InitAllSettings.xaml:111` | Get BGV9_MaxMessageChars |
| 4 | `InitAllSettings.xaml:112` | ui:GetAsset |
| 5 | `InitAllSettings.xaml:118` | Get BGV9_EnableHumanReview |
| 6 | `InitAllSettings.xaml:119` | ui:GetAsset |
| 7 | `InitAllSettings.xaml:125` | Get BGV9_SendRunSummaryEmail |
| 8 | `InitAllSettings.xaml:126` | ui:GetAsset |
| 9 | `GetTransactionData.xaml:63` | Get Queue Item |
| 10 | `GetTransactionData.xaml:64` | ui:GetTransactionItem |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BirthdayGreetingsV9_Dispatcher_Daily_0800 | SDD-specified: BirthdayGreetingsV9_Dispatcher_Daily_0800 | Cron: 0 0 8 * * ? | Runs dispatcher daily at 08:00 to read today's birthdays and enqueue transactions. |
| 2 | **Schedule** | Defined in SDD orchestrator_artifacts: BirthdayGreetingsV9_ResubmitReviewed_Every15Min | SDD-specified: BirthdayGreetingsV9_ResubmitReviewed_Every15Min | Cron: 0 0/15 * * * ? | Optional: runs every 15 minutes to poll approved Action Center reviews in Data Service and send via Gmail. |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 6 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Assets | Provision asset: `BGV9_Timezone` | Yes |
| 5 | Assets | Provision asset: `BGV9_MaxMessageChars` | Yes |
| 6 | Assets | Provision asset: `BGV9_EnableHumanReview` | Yes |
| 7 | Assets | Provision asset: `BGV9_SendRunSummaryEmail` | Yes |
| 8 | Queues | Create queue: `[in_QueueName]` | Yes |
| 9 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 10 | Testing | Run smoke test in target environment | Yes |
| 11 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 12 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 13 | Governance | Peer code review completed | Yes |
| 14 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 15 | Governance | Business process owner validation obtained | Yes |
| 16 | Governance | CoE approval obtained | Yes |
| 17 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Not Ready — 27/50 (39%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 4 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 0% of high-risk activities covered by TryCatch; 5 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | Queue configuration looks good |
| Build Quality | 0/10 | 6 quality warnings to address; 14 remediations — stub replacements need developer attention; 7/8 workflow(s) are Studio-loadable (1 blocked — 13% not loadable); 8 planned workflow(s) missing from archive |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

---

## 15. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "Main.xaml",
    "GetTransactionData.xaml",
    "SetTransactionStatus.xaml",
    "CloseAllApplications.xaml",
    "KillAllProcesses.xaml",
    "AgentInvocation_Stub.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "Process.xaml",
      "description": "Stripped 1 placeholder token(s) from Process.xaml",
      "developerAction": "Review Process.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "unknown",
      "description": "Structural preservation: InitAllSettings.xaml preserved unchanged — XML is valid but blocking issues could not be mapped to specific leaf activities"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "unknown",
      "description": "Skipped full-package stub escalation — structural-preservation stubs already cover affected files"
    }
  ],
  "remediations": [
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "If",
      "originalDisplayName": "Decision: Any Birthdays Today?",
      "reason": "Line 88: Standalone word \"Yes\" may be an undeclared variable — should it be a string literal \"Yes\"? in expression: Yes",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement \"Decision: Any Birthdays Today?\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Decision: Any Birthdays Today?",
      "reason": "Line 88: Undeclared variable \"Yes\" in expression: Yes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Decision: Any Birthdays Today?\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "TryCatch",
      "originalDisplayName": "Try Retry: Select Preferred Email (Personal &gt; Home)",
      "reason": "Line 191: Standalone word \"Yes\" may be an undeclared variable — should it be a string literal \"Yes\"? in expression: Yes",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement \"Try Retry: Select Preferred Email (Personal &gt; Home)\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Try Retry: Select Preferred Email (Personal &amp;gt; Home)",
      "reason": "Line 191: Undeclared variable \"Yes\" in expression: Yes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Try Retry: Select Preferred Email (Personal &amp;gt; Home)\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "Rethrow",
      "originalDisplayName": "Rethrow",
      "reason": "Line 362: Standalone word \"Yes\" may be an undeclared variable — should it be a string literal \"Yes\"? in expression: Yes",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement \"Rethrow\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Rethrow",
      "reason": "Line 362: Undeclared variable \"Yes\" in expression: Yes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Rethrow\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:LogMessage",
      "originalDisplayName": "Log Screenshot Failure",
      "reason": "Line 546: Standalone word \"Yes\" may be an undeclared variable — should it be a string literal \"Yes\"? in expression: Yes",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement \"Log Screenshot Failure\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Log Screenshot Failure",
      "reason": "Line 546: Undeclared variable \"Yes\" in expression: Yes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Log Screenshot Failure\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "Sequence",
      "originalDisplayName": "Execute: Get Next Person from Queue",
      "reason": "Line 559: Standalone word \"Yes\" may be an undeclared variable — should it be a string literal \"Yes\"? in expression: Yes",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement \"Execute: Get Next Person from Queue\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Process.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Execute: Get Next Person from Queue",
      "reason": "Line 559: Undeclared variable \"Yes\" in expression: Yes — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Execute: Get Next Person from Queue\" activity in Process.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "sequence",
      "file": "Process.xaml",
      "remediationCode": "STUB_SEQUENCE_MULTIPLE_FAILURES",
      "originalDisplayName": "Process",
      "reason": "4 activities in sequence failed validation",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE, UNDECLARED_VARIABLE",
      "developerAction": "Re-implement 4 activities in sequence \"Process\" in Process.xaml",
      "estimatedEffortMinutes": 60
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
    },
    {
      "level": "workflow",
      "file": "Process.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in Process.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "AgentInvocation_Stub.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "Process.xaml",
      "detail": "Line 71: x:TypeArguments=\"UiPath.Persistence.Activities.FormTask\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"BGV9_Timezone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 111: asset name \"BGV9_MaxMessageChars\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 118: asset name \"BGV9_EnableHumanReview\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 125: asset name \"BGV9_SendRunSummaryEmail\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 255,
  "structuralPreservationMetrics": [
    {
      "file": "InitAllSettings.xaml",
      "totalActivities": 38,
      "preservedActivities": 38,
      "stubbedActivities": 0,
      "preservedStructures": [
        "Activity",
        "Sequence (Initialize All Settings)",
        "Sequence.Variables",
        "ActivityAction",
        "Sequence (Read Config Sheets)",
        "ForEach (Process Settings Rows)",
        "Sequence (Process Setting Row)",
        "ForEach (Process Constants Rows)",
        "Sequence (Store Constant)"
      ],
      "studioLoadable": true
    }
  ],
  "studioCompatibility": [
    {
      "file": "Process.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "Main.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "GetTransactionData.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "SetTransactionStatus.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "CloseAllApplications.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "KillAllProcesses.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "AgentInvocation_Stub.xaml",
      "level": "studio-warnings",
      "blockers": []
    }
  ]
}
```
