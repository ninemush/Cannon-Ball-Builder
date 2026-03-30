# Developer Handoff Guide

**Project:** BirthdayGreetingsV6
**Generated:** 2026-03-30
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (19%)

**Total Estimated Effort: ~195 minutes (3.3 hours)**
**Remediations:** 13 total (0 property, 6 activity, 0 sequence, 2 structural-leaf, 5 workflow)
**Auto-Repairs:** 2
**Quality Warnings:** 19

---

## 1. Completed Work

The following 1 workflow(s) were fully generated without any stub replacements or remediation:

- `GetTodaysBirthdayEvents.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Structurally invalid (stub) |
| 2 | `GetTodaysBirthdayEvents.xaml` | Fully Generated |
| 3 | `InitAllSettings.xaml` | Generated with Remediations |
| 4 | `ResolveRecipientEmail.xaml` | Structurally invalid (stub) |
| 5 | `GenerateGreetingMessage.xaml` | Structurally invalid (stub) |
| 6 | `SendGreetingEmail.xaml` | Structurally invalid (stub) |
| 7 | `UpsertDataServiceRecords.xaml` | Structurally invalid (stub) |

### Studio Compatibility

| # | Workflow | Compatibility | Blockers |
|---|----------|--------------|----------|
| 1 | `Main.xaml` | Structurally invalid — requires fixes | [STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to ge... |
| 2 | `GetTodaysBirthdayEvents.xaml` | Openable with warnings | — |
| 3 | `InitAllSettings.xaml` | Studio-openable | — |
| 4 | `ResolveRecipientEmail.xaml` | Structurally invalid — requires fixes | [STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to ge... |
| 5 | `GenerateGreetingMessage.xaml` | Structurally invalid — requires fixes | [STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to ge... |
| 6 | `SendGreetingEmail.xaml` | Structurally invalid — requires fixes | [STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to ge... |
| 7 | `UpsertDataServiceRecords.xaml` | Structurally invalid — requires fixes | [STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to ge... |

**Summary:** 1 clean, 1 with warnings, 5 blocked

> **⚠ 5 workflow(s) have structural defects that will prevent Studio from loading or executing them.** Address the blockers listed above before importing into Studio.

## 2. AI-Resolved with Smart Defaults

The following 2 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_GENERIC` | `unknown` | Structural preservation: InitAllSettings.xaml preserved unchanged — XML is valid but blocking iss... | undefined |
| 2 | `REPAIR_GENERIC` | `unknown` | Skipped full-package stub escalation — structural-preservation stubs already cover affected files | undefined |

## 3. Manual Action Required

### Activity-Level Stubs (6)

Entire activities were replaced with TODO stubs. The surrounding workflow structure is preserved.

| # | File | Activity | Code | Developer Action | Est. Minutes |
|---|------|----------|------|-----------------|-------------|
| 1 | `Main.xaml` | Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 2 | `Main.xaml` | Stub: Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Variable" activity in Main.xaml — estimated 15 min | 15 |
| 3 | `Main.xaml` | Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 4 | `Main.xaml` | Stub: Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Variable" activity in Main.xaml — estimated 15 min | 15 |
| 5 | `Main.xaml` | Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 6 | `Main.xaml` | Stub: Variable | `STUB_ACTIVITY_UNKNOWN` | Manually implement "Stub: Variable" activity in Main.xaml — estimated 15 min | 15 |

### Structural-Leaf Stubs (2)

Individual leaf activities were stubbed while preserving the workflow skeleton (sequences, branches, try/catch, loops, invocations).

| # | File | Activity | Original Tag | Code | Developer Action | Est. Minutes |
|---|------|----------|-------------|------|-----------------|-------------|
| 1 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |
| 2 | `InitAllSettings.xaml` | — | `—` | `STUB_STRUCTURAL_LEAF` | Review and fix CATALOG_STRUCTURAL_VIOLATION issue in InitAllSettings.xaml — w... | 15 |

#### Structural Preservation Metrics

| File | Total Activities | Preserved | Stubbed | Preservation Rate | Preserved Structures |
|------|-----------------|-----------|---------|-------------------|---------------------|
| `InitAllSettings.xaml` | 84 | 84 | 0 | 100% | Activity, Sequence (Initialize All Settings), Sequence.Variables... (+6) |

### Workflow-Level Stubs (5)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `ResolveRecipientEmail.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement ResolveRecipientEmail.xaml — compliance transforms corrupt... | 15 |
| 2 | `GenerateGreetingMessage.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement GenerateGreetingMessage.xaml — compliance transforms corru... | 15 |
| 3 | `SendGreetingEmail.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement SendGreetingEmail.xaml — compliance transforms corrupted t... | 15 |
| 4 | `UpsertDataServiceRecords.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | Manually implement UpsertDataServiceRecords.xaml — compliance transforms corr... | 15 |
| 5 | `Main.xaml` | `STUB_WORKFLOW_BLOCKING` | Fix XML structure in Main.xaml — ensure proper nesting and closing tags | 15 |

### Quality Warnings (19)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Main.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `GetTodaysBirthdayEvents.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 3 | `ResolveRecipientEmail.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 4 | `GenerateGreetingMessage.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 5 | `SendGreetingEmail.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 6 | `UpsertDataServiceRecords.xaml` | placeholder-value | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 7 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "BGV6_OperatorCredential" is hardcoded — consider using a Config.xlsx entry ... | — | undefined |
| 8 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 116: asset name "BGV6_CalendarName" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 9 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 123: asset name "BGV6_RunTimeZone" is hardcoded — consider using a Config.xlsx entry or work... | — | undefined |
| 10 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV6_EmailSubjectTemplate" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 11 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 137: asset name "BGV6_SenderDisplayName" is hardcoded — consider using a Config.xlsx entry o... | — | undefined |
| 12 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 144: asset name "BGV6_GenAI_Tone" is hardcoded — consider using a Config.xlsx entry or workf... | — | undefined |
| 13 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 151: asset name "BGV6_GenAI_MaxChars" is hardcoded — consider using a Config.xlsx entry or w... | — | undefined |
| 14 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 158: asset name "BGV6_PreferEmailLabels" is hardcoded — consider using a Config.xlsx entry o... | — | undefined |
| 15 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 165: asset name "BGV6_SendEnabled" is hardcoded — consider using a Config.xlsx entry or work... | — | undefined |
| 16 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 172: asset name "BGV6_MaxBirthdaysPerRun" is hardcoded — consider using a Config.xlsx entry ... | — | undefined |
| 17 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 179: asset name "BGV6_OrchestratorFolderName" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 18 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 186: asset name "BGV6_GmailIntegrationConnectionName" is hardcoded — consider using a Config... | — | undefined |
| 19 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 193: asset name "BGV6_GmailIntegrationConnectionId" is hardcoded — consider using a Config.x... | — | undefined |

**Total manual remediation effort: ~195 minutes (3.3 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary  
The “birthday greetings V6” project will automate the daily task of checking the dedicated Google Calendar named “Birthdays” and sending personalized birthday greeting emails from the user’s Gmail account. Today, the user manually checks the calendar each morning at approximately 8:00 AM, identifies any birthday events, searches for the recipient by typing their name in Gmail (leveraging Google Contacts auto-resolve), and writes a warm, funny, and sarcastic message in their own voice. The automation will run fully autonomously on unattended robots via UiPath Orchestrator, retrieve today’s birthday events from the “Birthdays” calendar using a Google Calendar UiPath activity, resolve recipient emails via Google Contacts/Gmail connector capabilities through Integration Service (connection: **ninemush@gmail.com**), generate a personalized message using UiPath’s native AI capabilities (no OpenAI/Azure OpenAI), and send the email automatically.

Per the latest clarified requirement, if no email is found for a contact, the automation will not send anything (no fallback email/draft notification). If multiple emails exist, the automation will select the one labeled **Personal** or **Home**; otherwise it will use the first available email.

## 2. Process Scope  
This automation covers a single daily, schedule-driven process executed at 8:00 AM. In scope is the end-to-end flow from retrieving events on the current date from the Google Calendar named “Birthdays,” extracting each birthday person’s name from the event title, attempting to resolve a corresponding email address from Google Contacts, generating a personalized greeting in the user’s warm/funny/sarcastic voice, and sending the email from Gmail using the Integration Service Gmail connector with the **ninemush@gmail.com** connection.

Out of scope for V6 are the use of Google Drive, Google Photos, Slack, Microsoft Teams, Twilio, or any other external messaging channel, as well as any OpenAI/Azu...

### SDD Summary

## 1. Automation Architecture Overview

### 1.1 Chosen automation pattern and rationale
**Pattern:** **Single Orchestrator-scheduled unattended process + Agent-assisted content generation (Hybrid)**

- **Why not pure RPA only:** Calendar retrieval, contact lookup, and email send are deterministic and integration-friendly, but the requirement “message written in my voice (warm, funny, sarcastic)” is **non-deterministic** and benefits from native GenAI/Agents to produce varied, human-like text.
- **Why not Agent-only:** Agents are not ideal as the sole orchestrator for time-based runs, retries, and operational telemetry. Orchestrator provides **reliable scheduling, job history, logs, retries, and SLA monitoring**.
- **Why Hybrid is optimal:** Orchestrator handles **when/what**, integrations handle **data movement**, and a UiPath **native agent/GenAI activity** handles **copywriting**.

[AUTOMATION_TYPE: HYBRID (Integration-based RPA + UiPath Native GenAI/Agents for message generation)]

### 1.2 Platform services used (and why)
- **Orchestrator**: schedule at **8:00 AM daily**, run unattended, centralized logging, assets, and alerting.
- **Integration Service**: **mandatory** for external connectivity (per constraints). We will use:
  - **Gmail connector** connection **“ninemush@gmail.com” (ID: 0a0d5ee1-a1e8-477a-a943-58161e6f3272)** for:
    - searching contacts / resolving recipient email(s)
    - sending the email
- **Google Calendar via UiPath activities**: retrieve today’s events from calendar **“Birthdays”** (activity-based; no UI automation).
- **Agents / UiPath GenAI Activities (native)**: generate the personalized message in the required voice. **No OpenAI/Azure OpenAI**.
- **Data Service**: persist cross-run history (who was processed, which email used, send status) and support idempotency (avoid duplicate sends if the job reruns).
- **Storage Buckets**: store prompt templates, voice examples (curated), and run artifacts (e.g., generated message text, trouble...

**Automation Type:** hybrid
**Rationale:** Calendar/event retrieval and email sending are deterministic API/RPA steps, while generating a “warm/funny/sarcastic in my voice” message is best handled by an AI agent with guardrails.
**Feasibility Complexity:** medium
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | Start — 8AM Daily Schedule | System | Orchestrator Triggers | start | — |
| 2 | Retrieve Today’s Events from “Birthdays” Calendar | System | Google Calendar (UiPath Activity) | task | — |
| 3 | Any Birthday Events Today? | System | Google Calendar (UiPath Activity) | decision | — |
| 4 | End — No Birthdays Today | System | Orchestrator | end | — |
| 5 | Extract Birthday Person Name(s) from Event Titles | System | Orchestrator | task | — |
| 6 | Process Each Birthday Person | System | Orchestrator | task | — |
| 7 | Find Matching Contact + Email(s) by Name | System | Gmail Connector (Integration Service: ninemush@gmail.com) | task | — |
| 8 | Any Email Found for Contact? | System | Orchestrator | decision | — |
| 9 | Determine Preferred Email (Personal/Home) | System | Orchestrator | decision | — |
| 10 | Set Recipient Email = Personal/Home | System | Orchestrator | task | — |
| 11 | Set Recipient Email = First Available | System | Orchestrator | task | — |
| 12 | Generate Personalized Birthday Message (My Voice: Warm/Funny/Sarcastic) | System | UiPath Agents (Native) | agent-task | — |
| 13 | Generate Personalized Birthday Message (My Voice: Warm/Funny/Sarcastic) | System | UiPath Agents (Native) | agent-task | — |
| 14 | Send Birthday Email | System | Gmail Connector (Integration Service: ninemush@gmail.com) | task | — |
| 15 | Send Birthday Email | System | Gmail Connector (Integration Service: ninemush@gmail.com) | task | — |
| 16 | End — Greetings Sent | System | Orchestrator | end | — |
| 17 | Skip Person (No Email Found) | System | Orchestrator | task | — |
| 18 | End — Run Completed | System | Orchestrator | end | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath Activity)
- Orchestrator
- Gmail Connector (Integration Service: ninemush@gmail.com)
- UiPath Agents (Native)

### User Roles Involved

- System

### Decision Points (Process Map Topology)

**Any Birthday Events Today?**
  - [No] → End — No Birthdays Today
  - [Yes] → Extract Birthday Person Name(s) from Event Titles

**Any Email Found for Contact?**
  - [Yes] → Determine Preferred Email (Personal/Home)
  - [No] → Skip Person (No Email Found)

**Determine Preferred Email (Personal/Home)**
  - [Personal/Home exists] → Set Recipient Email = Personal/Home
  - [No Personal/Home label] → Set Recipient Email = First Available

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

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath Activity)
- Orchestrator
- Gmail Connector (Integration Service: ninemush@gmail.com)
- UiPath Agents (Native)

## 7. Credential & Asset Inventory

**Total:** 27 activities (13 hardcoded, 14 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BGV6_OperatorCredential` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV6_CalendarName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV6_RunTimeZone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV6_EmailSubjectTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV6_SenderDisplayName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 5 | `BGV6_GenAI_Tone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 6 | `BGV6_GenAI_MaxChars` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 7 | `BGV6_PreferEmailLabels` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 8 | `BGV6_SendEnabled` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 9 | `BGV6_MaxBirthdaysPerRun` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 10 | `BGV6_OrchestratorFolderName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 11 | `BGV6_GmailIntegrationConnectionName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 12 | `BGV6_GmailIntegrationConnectionId` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `InitAllSettings.xaml` | 106 | GetCredential | `BGV6_OperatorCredential` | Credential | — | Yes |
| `InitAllSettings.xaml` | 107 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 110 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 118 | GetAsset | `BGV6_CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 119 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 125 | GetAsset | `BGV6_RunTimeZone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 126 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 132 | GetAsset | `BGV6_EmailSubjectTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 133 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 139 | GetAsset | `BGV6_SenderDisplayName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 140 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 146 | GetAsset | `BGV6_GenAI_Tone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 147 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 153 | GetAsset | `BGV6_GenAI_MaxChars` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 154 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 160 | GetAsset | `BGV6_PreferEmailLabels` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 161 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 167 | GetAsset | `BGV6_SendEnabled` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 168 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 174 | GetAsset | `BGV6_MaxBirthdaysPerRun` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 175 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 181 | GetAsset | `BGV6_OrchestratorFolderName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 182 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 188 | GetAsset | `BGV6_GmailIntegrationConnectionName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 189 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 195 | GetAsset | `BGV6_GmailIntegrationConnectionId` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 196 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 13 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 13 aligned, 1 SDD-only, 0 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV6_CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name to query for today's birthday events. | `InitAllSettings.xaml` | 118 |
| 2 | `BGV6_RunTimeZone` | asset | **Aligned** | type: Text, value: America/New_York, description: Time zone used for date boundaries and scheduling consistency. | `InitAllSettings.xaml` | 125 |
| 3 | `BGV6_EmailSubjectTemplate` | asset | **Aligned** | type: Text, value: Happy Birthday, {Name}!, description: Email subject template. Token {Name} will be replaced with extracted contact name. | `InitAllSettings.xaml` | 132 |
| 4 | `BGV6_SenderDisplayName` | asset | **Aligned** | type: Text, value: Ninemush, description: Friendly sender display name used in the email signature/body if applicable. | `InitAllSettings.xaml` | 139 |
| 5 | `BGV6_GenAI_Tone` | asset | **Aligned** | type: Text, value: Warm, funny, and sarcastic, description: Tone instruction passed to UiPath native GenAI/Agents message generation. | `InitAllSettings.xaml` | 146 |
| 6 | `BGV6_GenAI_MaxChars` | asset | **Aligned** | type: Integer, value: 900, description: Maximum length target for generated email body to keep messages concise. | `InitAllSettings.xaml` | 153 |
| 7 | `BGV6_PreferEmailLabels` | asset | **Aligned** | type: Text, value: Personal,Home, description: Comma-separated preferred email labels for selecting recipient address when multiple emails exist. | `InitAllSettings.xaml` | 160 |
| 8 | `BGV6_SendEnabled` | asset | **Aligned** | type: Bool, value: true, description: Kill-switch to disable sending while still running the process for monitoring/logging. | `InitAllSettings.xaml` | 167 |
| 9 | `BGV6_MaxBirthdaysPerRun` | asset | **Aligned** | type: Integer, value: 50, description: Safety limit for number of birthday items processed per run. | `InitAllSettings.xaml` | 174 |
| 10 | `BGV6_OrchestratorFolderName` | asset | **Aligned** | type: Text, value: BirthdayGreetings_V6, description: Target Orchestrator folder name where processes, assets, queue, triggers, and machines are deployed. | `InitAllSettings.xaml` | 181 |
| 11 | `BGV6_GmailIntegrationConnectionName` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: Integration Service Gmail connection name used for contact lookup and email sending. | `InitAllSettings.xaml` | 188 |
| 12 | `BGV6_GmailIntegrationConnectionId` | asset | **Aligned** | type: Text, value: 0a0d5ee1-a1e8-477a-a943-58161e6f3272, description: Integration Service Gmail connection ID used for contact lookup and email sending. | `InitAllSettings.xaml` | 195 |
| 13 | `BGV6_OperatorCredential` | credential | **Aligned** | type: Credential, description: Reserved credential asset (not used for Google auth due to Integration Service connection governance). | `InitAllSettings.xaml` | 106 |
| 14 | `BGV6_BirthdayGreetings_Queue` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: Queue of birthday greeting work items (one per birthday person/event) created daily by the dispatcher and consumed by the performer for email lookup, message generation, and sending. | — | — |

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 0/27 high-risk activities inside TryCatch (0%)

### Files Without TryCatch

- `Main.xaml`
- `InitAllSettings.xaml`
- `ResolveRecipientEmail.xaml`
- `GenerateGreetingMessage.xaml`
- `SendGreetingEmail.xaml`
- `UpsertDataServiceRecords.xaml`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:106` | Get BGV6_OperatorCredential |
| 2 | `InitAllSettings.xaml:107` | ui:GetCredential |
| 3 | `InitAllSettings.xaml:110` | ui:GetCredential |
| 4 | `InitAllSettings.xaml:118` | Get BGV6_CalendarName |
| 5 | `InitAllSettings.xaml:119` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:125` | Get BGV6_RunTimeZone |
| 7 | `InitAllSettings.xaml:126` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:132` | Get BGV6_EmailSubjectTemplate |
| 9 | `InitAllSettings.xaml:133` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:139` | Get BGV6_SenderDisplayName |
| 11 | `InitAllSettings.xaml:140` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:146` | Get BGV6_GenAI_Tone |
| 13 | `InitAllSettings.xaml:147` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:153` | Get BGV6_GenAI_MaxChars |
| 15 | `InitAllSettings.xaml:154` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:160` | Get BGV6_PreferEmailLabels |
| 17 | `InitAllSettings.xaml:161` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:167` | Get BGV6_SendEnabled |
| 19 | `InitAllSettings.xaml:168` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:174` | Get BGV6_MaxBirthdaysPerRun |
| 21 | `InitAllSettings.xaml:175` | ui:GetAsset |
| 22 | `InitAllSettings.xaml:181` | Get BGV6_OrchestratorFolderName |
| 23 | `InitAllSettings.xaml:182` | ui:GetAsset |
| 24 | `InitAllSettings.xaml:188` | Get BGV6_GmailIntegrationConnectionName |
| 25 | `InitAllSettings.xaml:189` | ui:GetAsset |
| 26 | `InitAllSettings.xaml:195` | Get BGV6_GmailIntegrationConnectionId |
| 27 | `InitAllSettings.xaml:196` | ui:GetAsset |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BGV6_Daily_0800_Dispatcher | SDD-specified: BGV6_Daily_0800_Dispatcher | Cron: 0 0 8 ? * * * | Daily 8:00 AM trigger to run the dispatcher process that queries the Birthdays calendar and enqueues work items. |
| 2 | **Queue** | Defined in SDD orchestrator_artifacts: BGV6_QueueTrigger_Performer | SDD-specified: BGV6_QueueTrigger_Performer | Queue: BGV6_BirthdayGreetings_Queue | Queue trigger to run the performer process to process birthday items (email resolve, GenAI message generation, send via Gmail). |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 19 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `BGV6_OperatorCredential` | Yes |
| 5 | Assets | Provision asset: `BGV6_CalendarName` | Yes |
| 6 | Assets | Provision asset: `BGV6_RunTimeZone` | Yes |
| 7 | Assets | Provision asset: `BGV6_EmailSubjectTemplate` | Yes |
| 8 | Assets | Provision asset: `BGV6_SenderDisplayName` | Yes |
| 9 | Assets | Provision asset: `BGV6_GenAI_Tone` | Yes |
| 10 | Assets | Provision asset: `BGV6_GenAI_MaxChars` | Yes |
| 11 | Assets | Provision asset: `BGV6_PreferEmailLabels` | Yes |
| 12 | Assets | Provision asset: `BGV6_SendEnabled` | Yes |
| 13 | Assets | Provision asset: `BGV6_MaxBirthdaysPerRun` | Yes |
| 14 | Assets | Provision asset: `BGV6_OrchestratorFolderName` | Yes |
| 15 | Assets | Provision asset: `BGV6_GmailIntegrationConnectionName` | Yes |
| 16 | Assets | Provision asset: `BGV6_GmailIntegrationConnectionId` | Yes |
| 17 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 18 | Testing | Run smoke test in target environment | Yes |
| 19 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 20 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 21 | Governance | Peer code review completed | Yes |
| 22 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 23 | Governance | Business process owner validation obtained | Yes |
| 24 | Governance | CoE approval obtained | Yes |
| 25 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Not Ready — 27/50 (19%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 13 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 0% of high-risk activities covered by TryCatch; 6 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 0/10 | 19 quality warnings — significant remediation needed; 13 remediations — stub replacements need developer attention; Entry point (Main.xaml) is stubbed — package has no runnable entry point; 1/7 workflow(s) are stubs (14%) — structurally invalid |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 126 |
| Valid activities | 115 |
| Unknown → Comment stubs | 9 |
| Non-catalog properties stripped | 3 |
| Enum values auto-corrected | 23 |
| Missing required props filled | 0 |
| Total issues | 36 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 35 auto-fixed, 36 total issues |
| Post-emission (quality gate) | 32 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "GetTodaysBirthdayEvents.xaml"
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
    }
  ],
  "remediations": [
    {
      "level": "workflow",
      "file": "ResolveRecipientEmail.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 88, col 85: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement ResolveRecipientEmail.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 79, col 68: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement GenerateGreetingMessage.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "SendGreetingEmail.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 68, col 84: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement SendGreetingEmail.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "UpsertDataServiceRecords.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — XAML XML well-formedness validation failed: XML well-formedness error at line 90, col 82: Attribute 'DisplayName' is repeated. (code: InvalidAttr)",
      "classifiedCheck": "compliance-crash",
      "developerAction": "Manually implement UpsertDataServiceRecords.xaml — compliance transforms corrupted the generated XAML",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "Variable",
      "reason": "Line 60: Standalone word \"Birthdays\" may be an undeclared variable — should it be a string literal \"Birthdays\"? in expression: Birthdays",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Variable",
      "reason": "Line 60: Undeclared variable \"Birthdays\" in expression: Birthdays — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Variable\" activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "Variable",
      "reason": "Line 63: Standalone word \"Ninemush\" may be an undeclared variable — should it be a string literal \"Ninemush\"? in expression: Ninemush",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Variable",
      "reason": "Line 63: Undeclared variable \"Ninemush\" in expression: Ninemush — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Variable\" activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "Variable",
      "reason": "Line 78: Standalone word \"Started\" may be an undeclared variable — should it be a string literal \"Started\"? in expression: Started",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "activity",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "originalTag": "ui:Comment",
      "originalDisplayName": "Stub: Variable",
      "reason": "Line 78: Undeclared variable \"Started\" in expression: Started — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement \"Stub: Variable\" activity in Main.xaml — estimated 15 min",
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
    },
    {
      "level": "workflow",
      "file": "Main.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in Main.xaml — ensure proper nesting and closing tags",
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
      "check": "placeholder-value",
      "file": "GetTodaysBirthdayEvents.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "GenerateGreetingMessage.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "SendGreetingEmail.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "UpsertDataServiceRecords.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"BGV6_OperatorCredential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 116: asset name \"BGV6_CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 123: asset name \"BGV6_RunTimeZone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 130: asset name \"BGV6_EmailSubjectTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 137: asset name \"BGV6_SenderDisplayName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 144: asset name \"BGV6_GenAI_Tone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 151: asset name \"BGV6_GenAI_MaxChars\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 158: asset name \"BGV6_PreferEmailLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 165: asset name \"BGV6_SendEnabled\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 172: asset name \"BGV6_MaxBirthdaysPerRun\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 179: asset name \"BGV6_OrchestratorFolderName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 186: asset name \"BGV6_GmailIntegrationConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 193: asset name \"BGV6_GmailIntegrationConnectionId\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 195,
  "structuralPreservationMetrics": [
    {
      "file": "InitAllSettings.xaml",
      "totalActivities": 84,
      "preservedActivities": 84,
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
      "file": "Main.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to generation/compliance failure — structurally invalid"
      ]
    },
    {
      "file": "GetTodaysBirthdayEvents.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "ResolveRecipientEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to generation/compliance failure — structurally invalid"
      ]
    },
    {
      "file": "GenerateGreetingMessage.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to generation/compliance failure — structurally invalid"
      ]
    },
    {
      "file": "SendGreetingEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to generation/compliance failure — structurally invalid"
      ]
    },
    {
      "file": "UpsertDataServiceRecords.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[STUB_WORKFLOW_GENERATOR_FAILURE] Workflow was replaced with a stub due to generation/compliance failure — structurally invalid"
      ]
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 126,
    "validActivities": 115,
    "unknownActivities": 9,
    "strippedProperties": 3,
    "enumCorrections": 23,
    "missingRequiredFilled": 0,
    "commentConversions": 9,
    "issueCount": 36
  }
}
```
