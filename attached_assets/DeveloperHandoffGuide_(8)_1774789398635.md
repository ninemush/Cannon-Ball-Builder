# Developer Handoff Guide

**Project:** BirthdayGreetingsV4
**Generated:** 2026-03-29
**Generation Mode:** Full Implementation
**Deployment Readiness:** Needs Work (56%)

**Total Estimated Effort: ~90 minutes (1.5 hours)**
**Remediations:** 6 total (0 property, 0 activity, 0 sequence, 2 structural-leaf, 4 workflow)
**Auto-Repairs:** 3
**Quality Warnings:** 36

---

## 1. Completed Work

The following 5 workflow(s) were fully generated without any stub replacements or remediation:

- `GetTransactionData.xaml`
- `SetTransactionStatus.xaml`
- `CloseAllApplications.xaml`
- `KillAllProcesses.xaml`
- `Process.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Dispatcher.xaml` | Generated with Placeholders |
| 2 | `ContactResolver.xaml` | Generated with Placeholders |
| 3 | `ActionCenterSender.xaml` | Generated with Placeholders |
| 4 | `InitAllSettings.xaml` | Generated with Remediations |
| 5 | `Main.xaml` | Generated with Remediations |
| 6 | `GetTransactionData.xaml` | Fully Generated |
| 7 | `SetTransactionStatus.xaml` | Fully Generated |
| 8 | `CloseAllApplications.xaml` | Fully Generated |
| 9 | `KillAllProcesses.xaml` | Fully Generated |
| 10 | `Process.xaml` | Fully Generated |
| 11 | `Performer.xaml` | Generated with Placeholders |
| 12 | `TransactionProcessor.xaml` | Generated with Placeholders |
| 13 | `ActionCenterReviewer.xaml` | Generated with Placeholders |

### Studio Compatibility

| # | Workflow | Compatibility | Blockers |
|---|----------|--------------|----------|
| 1 | `Dispatcher.xaml` | Structurally invalid — requires fixes | [empty-container] Line 129: empty <Sequence> "Then" — may indicate dropped ge... |
| 2 | `ContactResolver.xaml` | Structurally invalid — requires fixes | [empty-container] Line 136: empty <Sequence> "Then" — may indicate dropped ge...; [empty-container] Line 172: empty <Sequence> "Then" — may indicate dropped ge...; [empty-container] Line 179: empty <Sequence> "Then" — may indicate dropped ge... |
| 3 | `ActionCenterSender.xaml` | Structurally invalid — requires fixes | [empty-container] Line 220: empty <Sequence> "Retry Body" — may indicate drop...; [empty-container] Line 245: empty <Sequence> "Then" — may indicate dropped ge...; [empty-container] Line 258: empty <Sequence> "Body" — may indicate dropped ge... |
| 4 | `InitAllSettings.xaml` | Studio-openable | — |
| 5 | `Main.xaml` | Studio-openable | — |
| 6 | `GetTransactionData.xaml` | Studio-openable | — |
| 7 | `SetTransactionStatus.xaml` | Studio-openable | — |
| 8 | `CloseAllApplications.xaml` | Studio-openable | — |
| 9 | `KillAllProcesses.xaml` | Studio-openable | — |
| 10 | `Process.xaml` | Studio-openable | — |
| 11 | `Performer.xaml` | Openable with warnings | — |
| 12 | `TransactionProcessor.xaml` | Openable with warnings | — |
| 13 | `ActionCenterReviewer.xaml` | Openable with warnings | — |

**Summary:** 7 clean, 3 with warnings, 3 blocked

> **⚠ 3 workflow(s) have structural defects that will prevent Studio from loading or executing them.** Address the blockers listed above before importing into Studio.

## 2. AI-Resolved with Smart Defaults

The following 3 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_GENERIC` | `unknown` | Structural preservation: InitAllSettings.xaml preserved unchanged — XML is valid but blocking iss... | undefined |
| 2 | `REPAIR_GENERIC` | `unknown` | Skipped full-package stub escalation — structural-preservation stubs already cover affected files | undefined |
| 3 | `REPAIR_TYPE_MISMATCH` | `ActionCenterSender.xaml` | No known conversion from System.Object to System.Collections.IEnumerable — review the variable ty... | undefined |

## 3. Manual Action Required

### Structural-Leaf Stubs (2)

Individual leaf activities were stubbed while preserving the workflow skeleton (sequences, branches, try/catch, loops, invocations).

| # | File | Activity | Original Tag | Code | Developer Action | Est. Minutes |
|---|------|----------|-------------|------|-----------------|-------------|
| 1 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |
| 2 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |

#### Structural Preservation Metrics

| File | Total Activities | Preserved | Stubbed | Preservation Rate | Preserved Structures |
|------|-----------------|-----------|---------|-------------------|---------------------|
| `InitAllSettings.xaml` | 74 | 74 | 0 | 100% | Activity, Sequence (Initialize All Settings), Sequence.Variables... (+6) |

### Workflow-Level Stubs (4)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Main.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement Main.xaml — compliance transforms corrupted the generated ... | 15 |
| 2 | `Performer.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement Performer.xaml — compliance transforms corrupted the gener... | 15 |
| 3 | `TransactionProcessor.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement TransactionProcessor.xaml — compliance transforms corrupte... | 15 |
| 4 | `ActionCenterReviewer.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement ActionCenterReviewer.xaml — compliance transforms corrupte... | 15 |

### Quality Warnings (36)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Dispatcher.xaml` | placeholder-value | Contains 2 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `ContactResolver.xaml` | placeholder-value | Contains 3 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 3 | `ActionCenterSender.xaml` | placeholder-value | Contains 5 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 4 | `Performer.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 5 | `TransactionProcessor.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 6 | `ActionCenterReviewer.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 7 | `ActionCenterSender.xaml` | invalid-type-argument | Line 250: x:TypeArguments="UiPath.Persistence.Activities.Models.TaskData" may not be a valid .NET... | — | undefined |
| 8 | `ActionCenterSender.xaml` | invalid-type-argument | Line 254: x:TypeArguments="UiPath.Persistence.Activities.Models.TaskData" may not be a valid .NET... | — | undefined |
| 9 | `ActionCenterSender.xaml` | invalid-type-argument | Line 256: x:TypeArguments="UiPath.Persistence.Activities.Models.TaskData" may not be a valid .NET... | — | undefined |
| 10 | `ContactResolver.xaml` | potentially-null-dereference | Line 108: "obj_InEmailLabelsPriority.Split" accessed without visible null guard in scope — verify... | — | undefined |
| 11 | `ContactResolver.xaml` | potentially-null-dereference | Line 108: "obj_StringSplitOptions.RemoveEmptyEntries" accessed without visible null guard in scop... | — | undefined |
| 12 | `ContactResolver.xaml` | potentially-null-dereference | Line 134: "obj_ContactSearchResults.Any" accessed without visible null guard in scope — verify nu... | — | undefined |
| 13 | `ActionCenterSender.xaml` | hardcoded-retry-count | Line 218: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 14 | `ActionCenterSender.xaml` | hardcoded-retry-count | Line 228: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 15 | `ActionCenterSender.xaml` | hardcoded-retry-count | Line 358: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 16 | `ActionCenterSender.xaml` | hardcoded-retry-count | Line 368: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 17 | `ActionCenterSender.xaml` | hardcoded-retry-count | Line 403: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 18 | `ActionCenterSender.xaml` | hardcoded-retry-interval | Line 218: retry interval hardcoded as "00:00:10" — consider externalizing to Config.xlsx | — | undefined |
| 19 | `ActionCenterSender.xaml` | hardcoded-retry-interval | Line 228: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 20 | `ActionCenterSender.xaml` | hardcoded-retry-interval | Line 358: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 21 | `ActionCenterSender.xaml` | hardcoded-retry-interval | Line 368: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 22 | `ActionCenterSender.xaml` | hardcoded-retry-interval | Line 403: retry interval hardcoded as "00:00:08" — consider externalizing to Config.xlsx | — | undefined |
| 23 | `ActionCenterSender.xaml` | hardcoded-asset-name | Line 124: asset name "BDAYGREETINGS_V4_SenderEmail" is hardcoded — consider using a Config.xlsx e... | — | undefined |
| 24 | `ActionCenterSender.xaml` | hardcoded-asset-name | Line 164: asset name "BDAYGREETINGS_V4_LogStorageBucketName" is hardcoded — consider using a Conf... | — | undefined |
| 25 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "BDAYGREETINGS_V4_GoogleAuth" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 26 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 116: asset name "BDAYGREETINGS_V4_CalendarName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 27 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 123: asset name "BDAYGREETINGS_V4_SenderEmail" is hardcoded — consider using a Config.xlsx e... | — | undefined |
| 28 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BDAYGREETINGS_V4_EmailSubjectTemplate" is hardcoded — consider using a Conf... | — | undefined |
| 29 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 137: asset name "BDAYGREETINGS_V4_TimezoneId" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 30 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 144: asset name "BDAYGREETINGS_V4_IncludeAllDayEvents" is hardcoded — consider using a Confi... | — | undefined |
| 31 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 151: asset name "BDAYGREETINGS_V4_ContactEmailLabels_Priority" is hardcoded — consider using... | — | undefined |
| 32 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 158: asset name "BDAYGREETINGS_V4_GenAI_ModelTemperature" is hardcoded — consider using a Co... | — | undefined |
| 33 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 165: asset name "BDAYGREETINGS_V4_ContentValidation_MinChars" is hardcoded — consider using ... | — | undefined |
| 34 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 172: asset name "BDAYGREETINGS_V4_ContentValidation_RequirePhrase" is hardcoded — consider u... | — | undefined |
| 35 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 179: asset name "BDAYGREETINGS_V4_LogStorageBucketName" is hardcoded — consider using a Conf... | — | undefined |
| 36 | `ActionCenterSender.xaml` | TYPE_MISMATCH | Line 251: Type mismatch — variable "obj_ApprovedTasks" (System.Object) bound to ForEach.Values (e... | — | undefined |

**Total manual remediation effort: ~90 minutes (1.5 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary
The “birthday greetings v4” project will automate the daily task of sending personalized birthday greeting emails. Today, at approximately 8:00 AM, you manually check a dedicated Google Calendar named “Birthdays,” identify who has a birthday that day, look up each person in Google Contacts to find a “Personal” or “Home” email address, write a message in your warm, funny, sarcastic voice, and send the email from Gmail. The automation will run fully autonomously on unattended robots, execute on a daily schedule, retrieve birthdays for the local calendar day (including all-day events), obtain the correct recipient email from Google Contacts (Personal preferred, else Home), generate an AI-written message using UiPath native GenAI capabilities (no OpenAI), and send the email via the Integration Service Gmail connector using the `ninemush@gmail.com` connection. If no Personal/Home email is found for a contact, the item will be skipped and no email will be sent.

## 2. Process Scope
This automation covers the end-to-end flow from reading the “Birthdays” Google Calendar each day through sending birthday greeting emails from `ninemush@gmail.com`. It includes: daily triggering at 8:00 AM; reading events for the local day; creating a per-person work item; matching a Google Contact by full name; selecting an email address only from “Personal” or “Home” labels with Personal taking precedence; generating the email body in your voice; and sending the email through the UiPath Integration Service Gmail connector.

Out of scope for this iteration are: using Google Drive; using OpenAI or Azure OpenAI directly; Slack, Teams, or Twilio notifications; and any use of Google Photos (photos will be reviewed in a later iteration). Relationship metadata is not used because it is not stored in the calendar events.

## 3. As-Is Process Description

![As-Is Process Map](/api/ideas/0e3da6cf-b1b5-489b-bc0b-f6e522dde569/process-map/image?viewType=as-is&v=1774775183246)
The c...

### SDD Summary

## 1. Automation Architecture Overview

### 1.1 Chosen automation type and rationale
**Pattern: Queue-driven fan-out + REFramework-style transaction processing (unattended).**  
- **RPA** is best for the deterministic parts (calendar read, contact lookup, email send, logging).  
- **Native GenAI (UiPath GenAI Activities)** is best for the creative message generation in your warm/funny/sarcastic voice.  
- Therefore the optimal approach is **Hybrid (RPA + GenAI)**, not a pure “Agent-first” solution. An autonomous agent could be added later, but today the workflow is highly structured and benefits more from operable queue-based processing and predictable SLAs.

### 1.2 Deployment and runtime topology
- **Execution**: 100% **unattended** (12 unattended slots available). No UI automation required; integrations are API/connector-based.
- **Robots**: recommend **Serverless / Cross-Platform** runtime if available for this tenant (best for background API automations). If serverless is not enabled, use classic unattended Windows robots on a non-interactive VM pool.
- **Orchestration**: Orchestrator scheduled trigger at **08:00 local time**.

### 1.3 Platform services used (and why)
- **Orchestrator**
  - **Triggers**: daily schedule at 08:00.
  - **Queues**: one queue item per birthday person for auditability, retries, and per-person status.
  - **Assets**: configuration (calendar name, subject template, tone prompt, timezone).
  - **Logs**: structured logging for operations.
- **Integration Service**
  - **Gmail connector** (must use): sending emails from the existing connection **`ninemush@gmail.com`**.
  - Rationale vs custom SMTP/HTTP: lower maintenance, credential handling through managed connection, better observability.
- **UiPath GSuite activities**
  - Read Google Calendar “Birthdays” and query Google Contacts with labeled emails **Personal** and **Home**.
  - Rationale: avoids UI automation and respects “no Google Drive”.
- **UiPath GenAI Activities**
  - Generates...

**Automation Type:** hybrid
**Rationale:** Core steps (calendar query, contact lookup, email send) are deterministic and best as RPA via Google activities + Integration Service Gmail; the “write in my warm/funny/sarcastic voice” requirement is generative and best handled by a UiPath Agent/GenAI capability with guardrails.
**Feasibility Complexity:** medium
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | Start — Daily 8:00 AM Trigger | System | Orchestrator Triggers | start | — |
| 2 | Read today’s events from Google Calendar “Birthdays” (local day, incl all-day) | System | UiPath Google Calendar Activity | task | — |
| 3 | Any birthdays found today? | System | UiPath Google Calendar Activity | decision | — |
| 4 | End — No birthdays today | System | Orchestrator | end | — |
| 5 | Create birthday run items (one per person) | System | Orchestrator Queue | task | — |
| 6 | Get next person from queue | System | Orchestrator Queue | task | — |
| 7 | Find matching Google Contact by full name | System | UiPath Google Contacts/People Activity | task | — |
| 8 | Personal or Home email found? | System | UiPath Google Contacts/People Activity | decision | — |
| 9 | Mark queue item as Skipped (no Personal/Home email) | System | Orchestrator Queue | task | — |
| 10 | More queue items remaining? | System | Orchestrator Queue | decision | — |
| 11 | End — Completed for today | System | Orchestrator | end | — |
| 12 | Get next person from queue | System | Orchestrator Queue | task | — |
| 13 | Select recipient email (prefer Personal, else Home) | System | UiPath Google Contacts/People Activity | task | — |
| 14 | Retrieve minimal context for personalization (name, optional notes from calendar event text if present) | System | Google Calendar | task | — |
| 15 | Generate birthday email draft in your voice (warm/funny/sarcastic) | System | UiPath Agents / UiPath GenAI Activities | agent-task | — |
| 16 | Draft meets safety/quality checks? (no sensitive data, not offensive, includes “Happy Birthday”, length OK) | System | UiPath Agents | agent-decision | — |
| 17 | Create Action Center task to review/edit message | System | Action Center | task | — |
| 18 | Use reviewed message from Action Center | System | Action Center | task | — |
| 19 | Send birthday email via Gmail connector (ninemush@gmail.com) | System | Integration Service — Gmail (ninemush@gmail.com) | task | — |
| 20 | Mark queue item as Successful | System | Orchestrator Queue | task | — |
| 21 | More queue items remaining? | System | Orchestrator Queue | decision | — |
| 22 | Get next person from queue | System | Orchestrator Queue | task | — |
| 23 | Loop back to contact lookup | System | Orchestrator | task | — |
| 24 | Find matching Google Contact by full name | System | UiPath Google Contacts/People Activity | task | — |
| 25 | Send birthday email via Gmail connector (ninemush@gmail.com) | System | Integration Service — Gmail (ninemush@gmail.com) | task | — |
| 26 | Mark queue item as Successful | System | Orchestrator Queue | task | — |
| 27 | More queue items remaining? | System | Orchestrator Queue | decision | — |
| 28 | Get next person from queue | System | Orchestrator Queue | task | — |
| 29 | Loop back to contact lookup | System | Orchestrator | task | — |
| 30 | Find matching Google Contact by full name | System | UiPath Google Contacts/People Activity | task | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- UiPath Google Calendar Activity
- Orchestrator
- Orchestrator Queue
- UiPath Google Contacts/People Activity
- Google Calendar
- UiPath Agents / UiPath GenAI Activities
- UiPath Agents
- Action Center
- Integration Service — Gmail (ninemush@gmail.com)

### User Roles Involved

- System

### Decision Points (Process Map Topology)

**Any birthdays found today?**
  - [No] → End — No birthdays today
  - [Yes] → Create birthday run items (one per person)

**Personal or Home email found?**
  - [No] → Mark queue item as Skipped (no Personal/Home email)
  - [Yes] → Select recipient email (prefer Personal, else Home)

**More queue items remaining?**
  - [No] → End — Completed for today
  - [Yes] → Get next person from queue

**More queue items remaining?**
  - [No] → End — Completed for today
  - [Yes] → Get next person from queue

**More queue items remaining?**
  - [No] → End — Completed for today
  - [Yes] → Get next person from queue

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

Create a Modern Folder with unattended robot pool (2+ robots recommended for queue-based processing). Enable Auto-scaling if available.

### NuGet Dependencies

| # | Package |
|---|--------|
| 1 | `UiPath.System.Activities` |
| 2 | `UiPath.Excel.Activities` |
| 3 | `UiPath.UIAutomation.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- UiPath Google Calendar Activity
- Orchestrator
- Orchestrator Queue
- UiPath Google Contacts/People Activity
- Google Calendar
- UiPath Agents / UiPath GenAI Activities
- UiPath Agents
- Action Center
- Integration Service — Gmail (ninemush@gmail.com)

## 7. Credential & Asset Inventory

**Total:** 27 activities (13 hardcoded, 14 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BDAYGREETINGS_V4_GoogleAuth` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BDAYGREETINGS_V4_SenderEmail` | Unknown | — | `ActionCenterSender.xaml` | Create in Orchestrator before deployment |
| 2 | `BDAYGREETINGS_V4_LogStorageBucketName` | Unknown | — | `ActionCenterSender.xaml` | Create in Orchestrator before deployment |
| 3 | `BDAYGREETINGS_V4_CalendarName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `BDAYGREETINGS_V4_EmailSubjectTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 5 | `BDAYGREETINGS_V4_TimezoneId` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 6 | `BDAYGREETINGS_V4_IncludeAllDayEvents` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 7 | `BDAYGREETINGS_V4_ContactEmailLabels_Priority` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 8 | `BDAYGREETINGS_V4_GenAI_ModelTemperature` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 9 | `BDAYGREETINGS_V4_ContentValidation_MinChars` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 10 | `BDAYGREETINGS_V4_ContentValidation_RequirePhrase` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `ActionCenterSender.xaml` | 124 | GetAsset | `BDAYGREETINGS_V4_SenderEmail` | Unknown | — | Yes |
| `ActionCenterSender.xaml` | 125 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `ActionCenterSender.xaml` | 164 | GetAsset | `BDAYGREETINGS_V4_LogStorageBucketName` | Unknown | — | Yes |
| `ActionCenterSender.xaml` | 165 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 106 | GetCredential | `BDAYGREETINGS_V4_GoogleAuth` | Credential | — | Yes |
| `InitAllSettings.xaml` | 107 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 110 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 118 | GetAsset | `BDAYGREETINGS_V4_CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 119 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 125 | GetAsset | `BDAYGREETINGS_V4_SenderEmail` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 126 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 132 | GetAsset | `BDAYGREETINGS_V4_EmailSubjectTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 133 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 139 | GetAsset | `BDAYGREETINGS_V4_TimezoneId` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 140 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 146 | GetAsset | `BDAYGREETINGS_V4_IncludeAllDayEvents` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 147 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 153 | GetAsset | `BDAYGREETINGS_V4_ContactEmailLabels_Priority` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 154 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 160 | GetAsset | `BDAYGREETINGS_V4_GenAI_ModelTemperature` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 161 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 167 | GetAsset | `BDAYGREETINGS_V4_ContentValidation_MinChars` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 168 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 174 | GetAsset | `BDAYGREETINGS_V4_ContentValidation_RequirePhrase` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 175 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 181 | GetAsset | `BDAYGREETINGS_V4_LogStorageBucketName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 182 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 13 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 11 aligned, 1 SDD-only, 1 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 1 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BDAYGREETINGS_V4_CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name to read birthday events from. | `InitAllSettings.xaml` | 118 |
| 2 | `BDAYGREETINGS_V4_SenderEmail` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: Sender mailbox used by Gmail Integration Service connection. | `ActionCenterSender.xaml` | 124 |
| 3 | `BDAYGREETINGS_V4_EmailSubjectTemplate` | asset | **Aligned** | type: Text, value: Happy Birthday, {Name}!, description: Subject template. Token {Name} will be replaced with recipient display name. | `InitAllSettings.xaml` | 132 |
| 4 | `BDAYGREETINGS_V4_TimezoneId` | asset | **Aligned** | type: Text, value: America/New_York, description: IANA timezone used to define the local day boundaries (00:00–23:59) for calendar queries. | `InitAllSettings.xaml` | 139 |
| 5 | `BDAYGREETINGS_V4_IncludeAllDayEvents` | asset | **Aligned** | type: Bool, value: true, description: Whether to include all-day birthday events in today's selection. | `InitAllSettings.xaml` | 146 |
| 6 | `BDAYGREETINGS_V4_ContactEmailLabels_Priority` | asset | **Aligned** | type: Text, value: Personal,Home, description: Comma-separated priority list of accepted Google Contacts email labels. Personal is preferred over Home. | `InitAllSettings.xaml` | 153 |
| 7 | `BDAYGREETINGS_V4_GenAI_ModelTemperature` | asset | **Aligned** | type: Integer, value: 3, description: GenAI temperature *10 (e.g., 3 = 0.3) used for consistent tone and reduced variance. | `InitAllSettings.xaml` | 160 |
| 8 | `BDAYGREETINGS_V4_ContentValidation_MinChars` | asset | **Aligned** | type: Integer, value: 80, description: Minimum character count for generated email body before considering it valid. | `InitAllSettings.xaml` | 167 |
| 9 | `BDAYGREETINGS_V4_ContentValidation_RequirePhrase` | asset | **Aligned** | type: Text, value: Happy Birthday, description: Required phrase to be present in generated email body for basic safety/quality gating. | `InitAllSettings.xaml` | 174 |
| 10 | `BDAYGREETINGS_V4_LogStorageBucketName` | asset | **Aligned** | type: Text, value: BDAYGREETINGS_V4_BKT_GenAI_Audit, description: Storage Bucket name used for prompt/output logging and audit (minimal context only). | `ActionCenterSender.xaml` | 164 |
| 11 | `BDAYGREETINGS_V4_GoogleAuth` | credential | **Aligned** | type: Credential, description: Credential placeholder for Google access if any non-IntegrationService auth is required by activities (kept empty for secure provisioning). | `InitAllSettings.xaml` | 106 |
| 12 | `BDAYGREETINGS_V4_Q_BirthdayPeople` | queue | **SDD Only** | maxRetries: 1, uniqueReference: true, description: One queue item per person with a birthday today (from Google Calendar 'Birthdays') for reliable unattended processing and auditability. | — | — |
| 13 | `[in_QueueName]` | queue | **XAML Only** | — | `GetTransactionData.xaml` | 63 |

## 9. Queue Management

**Pattern:** Transactional (Dispatcher/Performer)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `[in_QueueName]` | GetTransactionItem | Recommended | Yes (3x) | — | Verify exists |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BDAYGREETINGS_V4_Q_BirthdayPeople` | Yes | 1x | — | Defined in SDD but no matching XAML activity — verify implementation |

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

**Coverage:** 4/29 high-risk activities inside TryCatch (14%)

### Files Without TryCatch

- `InitAllSettings.xaml`
- `GetTransactionData.xaml`
- `KillAllProcesses.xaml`
- `Process.xaml`
- `Performer.xaml`
- `TransactionProcessor.xaml`
- `ActionCenterReviewer.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:106` | Get BDAYGREETINGS_V4_GoogleAuth |
| 2 | `InitAllSettings.xaml:107` | ui:GetCredential |
| 3 | `InitAllSettings.xaml:110` | ui:GetCredential |
| 4 | `InitAllSettings.xaml:118` | Get BDAYGREETINGS_V4_CalendarName |
| 5 | `InitAllSettings.xaml:119` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:125` | Get BDAYGREETINGS_V4_SenderEmail |
| 7 | `InitAllSettings.xaml:126` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:132` | Get BDAYGREETINGS_V4_EmailSubjectTemplate |
| 9 | `InitAllSettings.xaml:133` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:139` | Get BDAYGREETINGS_V4_TimezoneId |
| 11 | `InitAllSettings.xaml:140` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:146` | Get BDAYGREETINGS_V4_IncludeAllDayEvents |
| 13 | `InitAllSettings.xaml:147` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:153` | Get BDAYGREETINGS_V4_ContactEmailLabels_Priority |
| 15 | `InitAllSettings.xaml:154` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:160` | Get BDAYGREETINGS_V4_GenAI_ModelTemperature |
| 17 | `InitAllSettings.xaml:161` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:167` | Get BDAYGREETINGS_V4_ContentValidation_MinChars |
| 19 | `InitAllSettings.xaml:168` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:174` | Get BDAYGREETINGS_V4_ContentValidation_RequirePhrase |
| 21 | `InitAllSettings.xaml:175` | ui:GetAsset |
| 22 | `InitAllSettings.xaml:181` | Get BDAYGREETINGS_V4_LogStorageBucketName |
| 23 | `InitAllSettings.xaml:182` | ui:GetAsset |
| 24 | `GetTransactionData.xaml:63` | Get Queue Item |
| 25 | `GetTransactionData.xaml:64` | ui:GetTransactionItem |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BDAYGREETINGS_V4_TRG_Daily_0800_Local | SDD-specified: BDAYGREETINGS_V4_TRG_Daily_0800_Local | Cron: 0 0 8 ? * * * | Daily scheduled trigger at 08:00 local time to run dispatcher + performer (queue-based) flow. |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 36 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `BDAYGREETINGS_V4_GoogleAuth` | Yes |
| 5 | Assets | Provision asset: `BDAYGREETINGS_V4_SenderEmail` | Yes |
| 6 | Assets | Provision asset: `BDAYGREETINGS_V4_LogStorageBucketName` | Yes |
| 7 | Assets | Provision asset: `BDAYGREETINGS_V4_CalendarName` | Yes |
| 8 | Assets | Provision asset: `BDAYGREETINGS_V4_EmailSubjectTemplate` | Yes |
| 9 | Assets | Provision asset: `BDAYGREETINGS_V4_TimezoneId` | Yes |
| 10 | Assets | Provision asset: `BDAYGREETINGS_V4_IncludeAllDayEvents` | Yes |
| 11 | Assets | Provision asset: `BDAYGREETINGS_V4_ContactEmailLabels_Priority` | Yes |
| 12 | Assets | Provision asset: `BDAYGREETINGS_V4_GenAI_ModelTemperature` | Yes |
| 13 | Assets | Provision asset: `BDAYGREETINGS_V4_ContentValidation_MinChars` | Yes |
| 14 | Assets | Provision asset: `BDAYGREETINGS_V4_ContentValidation_RequirePhrase` | Yes |
| 15 | Queues | Create queue: `[in_QueueName]` | Yes |
| 16 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 17 | Testing | Run smoke test in target environment | Yes |
| 18 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 19 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 20 | Governance | Peer code review completed | Yes |
| 21 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 22 | Governance | Business process owner validation obtained | Yes |
| 23 | Governance | CoE approval obtained | Yes |
| 24 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Needs Work — 28/50 (56%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 13 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 14% of high-risk activities covered by TryCatch; 7 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | Queue configuration looks good |
| Build Quality | 1/10 | 36 quality warnings — significant remediation needed; 6 remediations — stub replacements need developer attention |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 135 |
| Valid activities | 126 |
| Unknown → Comment stubs | 7 |
| Non-catalog properties stripped | 79 |
| Enum values auto-corrected | 20 |
| Missing required props filled | 68 |
| Total issues | 142 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 174 auto-fixed, 142 total issues |
| Post-emission (quality gate) | 42 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "GetTransactionData.xaml",
    "SetTransactionStatus.xaml",
    "CloseAllApplications.xaml",
    "KillAllProcesses.xaml",
    "Process.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "unknown",
      "description": "Structural preservation: InitAllSettings.xaml preserved unchanged — XML is valid but blocking issues could not be mapped to specific leaf activities"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "unknown",
      "description": "Skipped full-package stub escalation — structural-preservation stubs already cover affected files"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "ActionCenterSender.xaml",
      "description": "No known conversion from System.Object to System.Collections.IEnumerable — review the variable type or activity property"
    }
  ],
  "remediations": [
    {
      "level": "workflow",
      "file": "Main.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 129, col 92: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement Main.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "Performer.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 84, col 80: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement Performer.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "TransactionProcessor.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 93, col 75: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement TransactionProcessor.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "ActionCenterReviewer.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 77, col 65: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement ActionCenterReviewer.xaml — compliance transforms corrupted the generated XAML",
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
      "file": "Dispatcher.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ContactResolver.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ActionCenterSender.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "TransactionProcessor.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ActionCenterReviewer.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 250: x:TypeArguments=\"UiPath.Persistence.Activities.Models.TaskData\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 254: x:TypeArguments=\"UiPath.Persistence.Activities.Models.TaskData\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "invalid-type-argument",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 256: x:TypeArguments=\"UiPath.Persistence.Activities.Models.TaskData\" may not be a valid .NET type",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "ContactResolver.xaml",
      "detail": "Line 108: \"obj_InEmailLabelsPriority.Split\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "ContactResolver.xaml",
      "detail": "Line 108: \"obj_StringSplitOptions.RemoveEmptyEntries\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "ContactResolver.xaml",
      "detail": "Line 134: \"obj_ContactSearchResults.Any\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 218: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 228: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 358: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 368: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 403: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 218: retry interval hardcoded as \"00:00:10\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 228: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 358: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 368: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 403: retry interval hardcoded as \"00:00:08\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 124: asset name \"BDAYGREETINGS_V4_SenderEmail\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 164: asset name \"BDAYGREETINGS_V4_LogStorageBucketName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"BDAYGREETINGS_V4_GoogleAuth\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 116: asset name \"BDAYGREETINGS_V4_CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 123: asset name \"BDAYGREETINGS_V4_SenderEmail\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 130: asset name \"BDAYGREETINGS_V4_EmailSubjectTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 137: asset name \"BDAYGREETINGS_V4_TimezoneId\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 144: asset name \"BDAYGREETINGS_V4_IncludeAllDayEvents\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 151: asset name \"BDAYGREETINGS_V4_ContactEmailLabels_Priority\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 158: asset name \"BDAYGREETINGS_V4_GenAI_ModelTemperature\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 165: asset name \"BDAYGREETINGS_V4_ContentValidation_MinChars\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 172: asset name \"BDAYGREETINGS_V4_ContentValidation_RequirePhrase\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 179: asset name \"BDAYGREETINGS_V4_LogStorageBucketName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ActionCenterSender.xaml",
      "detail": "Line 251: Type mismatch — variable \"obj_ApprovedTasks\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). No known conversion from System.Object to System.Collections.IEnumerable — review the variable type or activity property",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 90,
  "structuralPreservationMetrics": [
    {
      "file": "InitAllSettings.xaml",
      "totalActivities": 74,
      "preservedActivities": 74,
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
      ]
    }
  ],
  "studioCompatibility": [
    {
      "file": "Dispatcher.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[empty-container] Line 129: empty <Sequence> \"Then\" — may indicate dropped generation output"
      ]
    },
    {
      "file": "ContactResolver.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[empty-container] Line 136: empty <Sequence> \"Then\" — may indicate dropped generation output",
        "[empty-container] Line 172: empty <Sequence> \"Then\" — may indicate dropped generation output",
        "[empty-container] Line 179: empty <Sequence> \"Then\" — may indicate dropped generation output"
      ]
    },
    {
      "file": "ActionCenterSender.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[empty-container] Line 220: empty <Sequence> \"Retry Body\" — may indicate dropped generation output",
        "[empty-container] Line 245: empty <Sequence> \"Then\" — may indicate dropped generation output",
        "[empty-container] Line 258: empty <Sequence> \"Body\" — may indicate dropped generation output",
        "[empty-container] Line 326: empty <Sequence> \"Then\" — may indicate dropped generation output",
        "[empty-container] Line 333: empty <Sequence> \"Then\" — may indicate dropped generation output",
        "[empty-container] Line 360: empty <Sequence> \"Retry Body\" — may indicate dropped generation output",
        "[empty-container] Line 405: empty <Sequence> \"Retry Body\" — may indicate dropped generation output"
      ]
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
      "file": "Process.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "Performer.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "TransactionProcessor.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ActionCenterReviewer.xaml",
      "level": "studio-warnings",
      "blockers": []
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 135,
    "validActivities": 126,
    "unknownActivities": 7,
    "strippedProperties": 79,
    "enumCorrections": 20,
    "missingRequiredFilled": 68,
    "commentConversions": 7,
    "issueCount": 142
  }
}
```
