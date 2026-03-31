# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-03-31
**Generation Mode:** Full Implementation
**Deployment Readiness:** Needs Work (44%)

**Total Estimated Effort: ~245 minutes (4.1 hours)**
**Remediations:** 19 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 1 workflow)
**Auto-Repairs:** 11
**Quality Warnings:** 60

---

## 1. Completed Work

The following 4 workflow(s) were fully generated without any stub replacements or remediation:

- `Main.xaml`
- `Performer.xaml`
- `BirthdayGreetingsV12.xaml`
- `InitAllSettings.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `Dispatcher.xaml` | Fully Generated |
| 3 | `Performer.xaml` | Fully Generated |
| 4 | `LookupContactEmail.xaml` | Fully Generated |
| 5 | `GenerateGreetingMessage.xaml` | Fully Generated |
| 6 | `Finalize.xaml` | Fully Generated |
| 7 | `BirthdayGreetingsV12.xaml` | Fully Generated |
| 8 | `InitAllSettings.xaml` | Fully Generated |
| 9 | `Init.xaml` | Structurally invalid (not Studio-loadable) |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `Dispatcher.xaml` | Openable with warnings | Unclassified | — |
| 3 | `Performer.xaml` | Openable with warnings | Unclassified | — |
| 4 | `LookupContactEmail.xaml` | Openable with warnings | Unclassified | — |
| 5 | `GenerateGreetingMessage.xaml` | Openable with warnings | Unclassified | — |
| 6 | `Finalize.xaml` | Openable with warnings | Unclassified | — |
| 7 | `BirthdayGreetingsV12.xaml` | Studio-openable | — | — |
| 8 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 9 | `Init.xaml` | Openable with warnings | Unclassified | — |

**Summary:** 2 Studio-loadable, 7 with warnings, 0 not Studio-loadable

## 2. AI-Resolved with Smart Defaults

The following 11 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Dispatcher.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml | undefined |
| 2 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `LookupContactEmail.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in LookupContactEmail.xaml | undefined |
| 3 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitA... | undefined |
| 4 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 9 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 10 | `REPAIR_TYPE_MISMATCH` | `Dispatcher.xaml` | No known conversion from scg:Dictionary(x:String, x:Object) to System.Collections.Generic.Diction... | undefined |
| 11 | `REPAIR_TYPE_MISMATCH` | `LookupContactEmail.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (18)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 2 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 3 | `LookupContactEmail.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in LookupContactEmail.xaml — estimated 15 min | 15 |
| 4 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 5 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 6 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 7 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 8 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 9 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 10 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 11 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 12 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 13 | `GenerateGreetingMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min | 15 |
| 14 | `LookupContactEmail.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in LookupContactEmail.xaml — estimated 15 min | 15 |
| 15 | `Dispatcher.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath d... | 5 |
| 16 | `LookupContactEmail.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in LookupContactEmail.xaml — use valid enum from ... | 5 |
| 17 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 18 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Init.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | TODO: Implement Loads all Orchestrator assets into a config dictionary, valid... | 15 |

### Developer Implementation Required (13)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 3 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 2 | `Main.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 3 | `Dispatcher.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 4 | `Dispatcher.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 5 | `Performer.xaml` | Contains 3 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 6 | `Performer.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 7 | `LookupContactEmail.xaml` | Contains 7 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 8 | `LookupContactEmail.xaml` | Contains 7 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 9 | `GenerateGreetingMessage.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 10 | `GenerateGreetingMessage.xaml` | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 11 | `Finalize.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 12 | `Finalize.xaml` | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 13 | `Init.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (47)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Dispatcher.xaml` | hardcoded-retry-count | Line 230: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 2 | `Dispatcher.xaml` | hardcoded-retry-count | Line 238: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 3 | `Dispatcher.xaml` | hardcoded-retry-count | Line 243: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 4 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 230: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 5 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 238: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 6 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 243: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 7 | `Dispatcher.xaml` | hardcoded-queue-name | Line 427: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.x... | — | undefined |
| 8 | `Performer.xaml` | hardcoded-retry-count | Line 512: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 9 | `Performer.xaml` | hardcoded-retry-count | Line 517: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 10 | `Performer.xaml` | hardcoded-retry-interval | Line 512: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 11 | `Performer.xaml` | hardcoded-retry-interval | Line 517: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 12 | `Performer.xaml` | hardcoded-queue-name | Line 286: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.x... | — | undefined |
| 13 | `LookupContactEmail.xaml` | hardcoded-retry-count | Line 135: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 14 | `LookupContactEmail.xaml` | hardcoded-retry-count | Line 143: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 15 | `LookupContactEmail.xaml` | hardcoded-retry-count | Line 148: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 16 | `LookupContactEmail.xaml` | hardcoded-retry-interval | Line 135: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 17 | `LookupContactEmail.xaml` | hardcoded-retry-interval | Line 143: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 18 | `LookupContactEmail.xaml` | hardcoded-retry-interval | Line 148: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 19 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xls... | — | undefined |
| 20 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 21 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 139: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 22 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 148: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 23 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 157: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 24 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 166: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 25 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 175: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 26 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 184: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 27 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 193: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 28 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 202: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 29 | `Dispatcher.xaml` | TYPE_MISMATCH | Line 427: Type mismatch — variable "dict_QueueItemPayload" (scg:Dictionary(x:String, x:Object)) b... | — | undefined |
| 30 | `InitAllSettings.xaml` | BARE_TOKEN_QUOTED | Auto-quoted bare token "Settings" for uexcel:ExcelReadRange.SheetName (expected String type) — wr... | — | undefined |
| 31 | `InitAllSettings.xaml` | BARE_TOKEN_QUOTED | Auto-quoted bare token "Constants" for uexcel:ExcelReadRange.SheetName (expected String type) — w... | — | undefined |
| 32 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 33 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "JsonString" on uweb:DeserializeJson | — | undefined |
| 34 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "Result" on uweb:DeserializeJson | — | undefined |
| 35 | `LookupContactEmail.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 36 | `LookupContactEmail.xaml` | CATALOG_VIOLATION | Missing required property "JsonString" on uweb:DeserializeJson | — | undefined |
| 37 | `LookupContactEmail.xaml` | CATALOG_VIOLATION | Missing required property "Result" on uweb:DeserializeJson | — | undefined |
| 38 | `GenerateGreetingMessage.xaml` | CATALOG_VIOLATION | Missing required property "Prompt" on ugenai:UseGenAI | — | undefined |
| 39 | `Finalize.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 40 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 41 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 42 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 43 | `Performer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 44 | `Performer.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 45 | `LookupContactEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 46 | `LookupContactEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 47 | `LookupContactEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |

**Total manual remediation effort: ~245 minutes (4.1 hours)**

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
| 4 | `UiPath.DataService.Activities` |
| 5 | `UiPath.IntegrationService.Activities` |
| 6 | `UiPath.WebAPI.Activities` |
| 7 | `Newtonsoft.Json` |
| 8 | `UiPath.ComplexScenarios.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Integration Service - Google Contacts/People
- UiPath GenAI Activities
- Integration Service - Gmail (ninemush@gmail.com)

## 7. Credential & Asset Inventory

**Total:** 21 activities (10 hardcoded, 11 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BGV12.GoogleWorkspaceCredential` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV12.CalendarName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV12.Timezone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV12.FromGmailConnectionName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV12.MaxConnectorRetries` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 5 | `BGV12.RetryBackoffSeconds` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 6 | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 7 | `BGV12.PreferredEmailLabels` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 8 | `BGV12.SendEnabled` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 9 | `BGV12.OperationsDL` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
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

> **Warning:** 10 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 10 aligned, 1 SDD-only, 1 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 1 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV12.CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name containing birthday events. | `InitAllSettings.xaml` | 130 |
| 2 | `BGV12.Timezone` | asset | **Aligned** | type: Text, value: Asia/Dubai, description: Authoritative timezone for 'today' evaluation and schedule alignment. | `InitAllSettings.xaml` | 139 |
| 3 | `BGV12.FromGmailConnectionName` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: Integration Service Gmail connection name used to send greetings. | `InitAllSettings.xaml` | 148 |
| 4 | `BGV12.MaxConnectorRetries` | asset | **Aligned** | type: Integer, value: 3, description: Max retries for transient Integration Service connector failures (Calendar/People/Gmail). | `InitAllSettings.xaml` | 157 |
| 5 | `BGV12.RetryBackoffSeconds` | asset | **Aligned** | type: Integer, value: 10, description: Backoff delay between transient retries. | `InitAllSettings.xaml` | 166 |
| 6 | `BGV12.SkipOnAmbiguousContactMatch` | asset | **Aligned** | type: Bool, value: true, description: If multiple contacts match the same name, skip to avoid mis-send; log as business exception. | `InitAllSettings.xaml` | 175 |
| 7 | `BGV12.PreferredEmailLabels` | asset | **Aligned** | type: Text, value: personal,home, description: Comma-separated preferred email labels (case-insensitive). | `InitAllSettings.xaml` | 184 |
| 8 | `BGV12.SendEnabled` | asset | **Aligned** | type: Bool, value: true, description: Master kill-switch for outbound email sending (when false, generate content but do not send). | `InitAllSettings.xaml` | 193 |
| 9 | `BGV12.OperationsDL` | asset | **Aligned** | type: Text, value: , description: Optional distribution list to receive failure notifications (left blank as PDD states no notifications). | `InitAllSettings.xaml` | 202 |
| 10 | `BGV12.GoogleWorkspaceCredential` | credential | **Aligned** | type: Credential, description: Reserved credential asset for break-glass scenarios; primary auth is via Integration Service connections. | `InitAllSettings.xaml` | 118 |
| 11 | `BirthdayGreetingsV12_EmailsToSend` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: Work queue for birthday greeting email dispatch items (one per birthday event/person). Supports retry and controlled execution telemetry. | — | — |
| 12 | `&quot;BirthdayGreetingsV12_EmailsToSend&quot;` | queue | **XAML Only** | — | `Dispatcher.xaml` | 427 |

## 9. Queue Management

**Pattern:** Queue usage (non-transactional)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `&quot;BirthdayGreetingsV12_EmailsToSend&quot;` | AddQueueItem, GetTransactionItem | Optional | No | — | Create in Orchestrator |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BirthdayGreetingsV12_EmailsToSend` | Yes | 2x | — | Defined in SDD but no matching XAML activity — verify implementation |

### Queue Activity Summary

| Capability | Present |
|---|---|
| Add Queue Item | Yes |
| Get Transaction Item | Yes |
| Set Transaction Status | No |

### Retry Policy

Dispatcher pattern only — retry policies apply to the consumer process, not the dispatcher

### SLA Guidance

Monitor queue growth rate and dispatcher throughput. Set alerts for queue item age exceeding business SLA.

### Dead-Letter / Failed Items Handling

No dead-letter handling applicable — process does not consume queue items.

## 10. Exception Handling Coverage

**Coverage:** 4/25 high-risk activities inside TryCatch (16%)

### Files Without TryCatch

- `InitAllSettings.xaml`
- `Init.xaml`

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
| placeholder-value | warning | 13 | Contains 3 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] |
| hardcoded-retry-count | warning | 8 | Line 230: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("MaxRetryNumber")) |
| hardcoded-retry-interval | warning | 8 | Line 230: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx |
| hardcoded-queue-name | warning | 2 | Line 427: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.xlsx entry or workflow a... |
| hardcoded-asset-name | warning | 10 | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xlsx entry or workflow arg... |
| TYPE_MISMATCH | warning | 1 | Line 427: Type mismatch — variable "dict_QueueItemPayload" (scg:Dictionary(x:String, x:Object)) bound to ui:AddQueueItem... |
| BARE_TOKEN_QUOTED | warning | 2 | Auto-quoted bare token "Settings" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quot... |
| CATALOG_VIOLATION | warning | 8 | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest |
| RETRY_INTERVAL_DEFAULTED | warning | 8 | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow context |

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
| 10 | Assets | Provision asset: `BGV12.SkipOnAmbiguousContactMatch` | Yes |
| 11 | Assets | Provision asset: `BGV12.PreferredEmailLabels` | Yes |
| 12 | Assets | Provision asset: `BGV12.SendEnabled` | Yes |
| 13 | Assets | Provision asset: `BGV12.OperationsDL` | Yes |
| 14 | Queues | Create queue: `&quot;BirthdayGreetingsV12_EmailsToSend&quot;` | Yes |
| 15 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 16 | Testing | Run smoke test in target environment | Yes |
| 17 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 18 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 19 | Governance | Peer code review completed | Yes |
| 20 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 21 | Governance | Business process owner validation obtained | Yes |
| 22 | Governance | CoE approval obtained | Yes |
| 23 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Needs Work — 22/50 (44%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 10 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 3/10 | Only 16% of high-risk activities covered by TryCatch; 2 file(s) with no TryCatch blocks |
| Queue Management | 3/10 | GetTransactionItem found without SetTransactionStatus — incomplete transaction handling; 2 hardcoded queue name(s) — externalize to config |
| Build Quality | 1/10 | 60 quality warnings — significant remediation needed; 19 remediations — stub replacements need developer attention |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 247 |
| Valid activities | 247 |
| Unknown → Comment stubs | 0 |
| Non-catalog properties stripped | 32 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 0 |
| Total issues | 30 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 32 auto-fixed, 30 total issues |
| Post-emission (quality gate) | 79 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "Main.xaml",
    "Performer.xaml",
    "BirthdayGreetingsV12.xaml",
    "InitAllSettings.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Dispatcher.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "LookupContactEmail.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in LookupContactEmail.xaml"
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
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "Dispatcher.xaml",
      "description": "No known conversion from scg:Dictionary(x:String, x:Object) to System.Collections.Generic.Dictionary`2[System.String,System.Object] — review the variable type or activity property"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "LookupContactEmail.xaml",
      "description": "Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output"
    }
  ],
  "remediations": [
    {
      "level": "workflow",
      "file": "Init.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — Tree assembly failed — assetName.startsWith is not a function",
      "classifiedCheck": "compliance-crash",
      "developerAction": "TODO: Implement Loads all Orchestrator assets into a config dictionary, validates required connections are reachable, creates the BirthdayGreetingRun Data Service record with status Running, and returns the run context (RunId, config map, Dubai date) to Main. Fails fast on missing critical assets or auth errors.",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 271: Undeclared variable \"Result\" in expression: REVIEW_REQUIRED: Result — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 418: Undeclared variable \"From\" in expression: New Dictionary(Of String, Object) From {{\"RunId\", in_RunId},... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "LookupContactEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 181: Undeclared variable \"Result\" in expression: REVIEW_REQUIRED: Result — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in LookupContactEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 127: Undeclared variable \"subject\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 127: Undeclared variable \"body\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"subject\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"Happy\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"Birthday\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"body\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"Wishing\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"you\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"a\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateGreetingMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 383: Undeclared variable \"fantastic\" in expression: \"CORRECTION REQUIRED. Your previous response was invalid (ei... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateGreetingMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "LookupContactEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 458: Type mismatch — variable \"obj_EmailAddresses\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in LookupContactEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;GET&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "LookupContactEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;GET&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in LookupContactEmail.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;UTF8&quot;\" for \"Encoding\" on ui:WriteTextFile — valid values: UTF8, Unicode, ASCII, Default. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Finalize.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;POST&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Finalize.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Dispatcher.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Dispatcher.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
      "detail": "Contains 3 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "LookupContactEmail.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "LookupContactEmail.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GenerateGreetingMessage.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GenerateGreetingMessage.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Finalize.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Finalize.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Init.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 230: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 238: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 243: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 230: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 238: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 243: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Dispatcher.xaml",
      "detail": "Line 427: queue name \"BirthdayGreetingsV12_EmailsToSend\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Performer.xaml",
      "detail": "Line 512: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Performer.xaml",
      "detail": "Line 517: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Performer.xaml",
      "detail": "Line 512: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Performer.xaml",
      "detail": "Line 517: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Performer.xaml",
      "detail": "Line 286: queue name \"BirthdayGreetingsV12_EmailsToSend\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 135: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 143: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 148: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 135: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 143: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 148: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
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
      "check": "TYPE_MISMATCH",
      "file": "Dispatcher.xaml",
      "detail": "Line 427: Type mismatch — variable \"dict_QueueItemPayload\" (scg:Dictionary(x:String, x:Object)) bound to ui:AddQueueItem.ItemInformation (expects System.Collections.Generic.Dictionary`2[System.String,System.Object]). No known conversion from scg:Dictionary(x:String, x:Object) to System.Collections.Generic.Dictionary`2[System.String,System.Object] — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"Settings\" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"Constants\" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "Dispatcher.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "Dispatcher.xaml",
      "detail": "Missing required property \"JsonString\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "Dispatcher.xaml",
      "detail": "Missing required property \"Result\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "LookupContactEmail.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "LookupContactEmail.xaml",
      "detail": "Missing required property \"JsonString\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "LookupContactEmail.xaml",
      "detail": "Missing required property \"Result\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "GenerateGreetingMessage.xaml",
      "detail": "Missing required property \"Prompt\" on ugenai:UseGenAI",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "Finalize.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
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
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
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
      "file": "LookupContactEmail.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "LookupContactEmail.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "LookupContactEmail.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 245,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Dispatcher.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Performer.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "LookupContactEmail.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "GenerateGreetingMessage.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Finalize.xaml",
      "level": "studio-warnings",
      "blockers": []
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
    },
    {
      "file": "Init.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[GENERATION-FAILURE] Workflow generation failed — LLM output could not be parsed into valid XAML"
      ],
      "failureCategory": "generation-failure",
      "failureSummary": "Workflow generation failed — LLM output could not be parsed into valid XAML"
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 247,
    "validActivities": 247,
    "unknownActivities": 0,
    "strippedProperties": 32,
    "enumCorrections": 0,
    "missingRequiredFilled": 0,
    "commentConversions": 0,
    "issueCount": 30
  }
}
```
