# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-03-31
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (28%)

**Total Estimated Effort: ~305 minutes (5.1 hours)**
**Remediations:** 23 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 1 workflow)
**Auto-Repairs:** 12
**Quality Warnings:** 60

---

## 1. Completed Work

The following 2 workflow(s) were fully generated without any stub replacements or remediation:

- `Main.xaml`
- `InitAllSettings.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `Dispatcher.xaml` | Structurally invalid — [object-object] Line 190: contains "[object Object]" — serialization failure; [object-object] Line 332: contains "[object Object]" — serialization failure |
| 3 | `Performer.xaml` | Fully Generated |
| 4 | `ContactLookup.xaml` | Structurally invalid — [UNDECLARED_ARGUMENT] Argument "in_FullName" is referenced in expressions but not declared in <x:Members> or as a <Variable> |
| 5 | `MessageComposer.xaml` | Fully Generated |
| 6 | `EmailSender.xaml` | Fully Generated |
| 7 | `Finalize.xaml` | Structurally invalid — [EXPRESSION_SYNTAX_UNFIXABLE] Line 143: String.Format() expects 2-10 argument(s) but got 20 in expression: String.Format("{{""RunId"":""{0}"",""Status"":""{1}"",""EventsFoundCount"":{2},"...; [STRING_FORMAT_OVERFLOW] Line 143: String.Format has 20 total arguments with highest placeholder index {0} — UiPath Studio may have issues with >10 format arguments. Consider splitting into multiple Format calls or using string concatenation. in expression: String.Format("{{""RunId"":""{0}"",""Status"":""{1}"",""EventsFoundCount"":{2},"... |
| 8 | `BirthdayGreetingsV12.xaml` | Fully Generated |
| 9 | `InitAllSettings.xaml` | Fully Generated |
| 10 | `Init.xaml` | Structurally invalid (not Studio-loadable) |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `Dispatcher.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [object-object] Line 190: contains "[object Object]" — serialization failure; [object-object] Line 332: contains "[object Object]" — serialization failure |
| 3 | `Performer.xaml` | Openable with warnings | Unclassified | — |
| 4 | `ContactLookup.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [UNDECLARED_ARGUMENT] Argument "in_FullName" is referenced in expressions but... |
| 5 | `MessageComposer.xaml` | Openable with warnings | Unclassified | — |
| 6 | `EmailSender.xaml` | Openable with warnings | Unclassified | — |
| 7 | `Finalize.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_SYNTAX_UNFIXABLE] Line 143: String.Format() expects 2-10 argument...; [STRING_FORMAT_OVERFLOW] Line 143: String.Format has 20 total arguments with ... |
| 8 | `BirthdayGreetingsV12.xaml` | Openable with warnings | Unclassified | — |
| 9 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 10 | `Init.xaml` | Openable with warnings | Unclassified | — |

**Summary:** 1 Studio-loadable, 6 with warnings, 3 not Studio-loadable

> **⚠ 3 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

**Blocked by category:**
- [object-object] Line 190: contains "[object Object]" — serialization failure; [object-object] Line 332: contains "[object Object]" — serialization failure: 1 workflow(s)
- [UNDECLARED_ARGUMENT] Argument "in_FullName" is referenced in expressions but not declared in <x:Members> or as a <Variable>: 1 workflow(s)
- [EXPRESSION_SYNTAX_UNFIXABLE] Line 143: String.Format() expects 2-10 argument(s) but got 20 in expression: String.Format("{{""RunId"":""{0}"",""Status"":""{1}"",""EventsFoundCount"":{2},"...; [STRING_FORMAT_OVERFLOW] Line 143: String.Format has 20 total arguments with highest placeholder index {0} — UiPath Studio may have issues with >10 format arguments. Consider splitting into multiple Format calls or using string concatenation. in expression: String.Format("{{""RunId"":""{0}"",""Status"":""{1}"",""EventsFoundCount"":{2},"...: 1 workflow(s)

## 2. AI-Resolved with Smart Defaults

The following 12 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Dispatcher.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml | undefined |
| 2 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Performer.xaml` | Catalog: Moved While.Condition from attribute to child-element in Performer.xaml | undefined |
| 3 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `MessageComposer.xaml` | Catalog: Moved While.Condition from attribute to child-element in MessageComposer.xaml | undefined |
| 4 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitA... | undefined |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 9 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 10 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 11 | `REPAIR_TYPE_MISMATCH` | `Dispatcher.xaml` | No known conversion from scg:Dictionary(x:String, x:Object) to System.Collections.Generic.Diction... | undefined |
| 12 | `REPAIR_TYPE_MISMATCH` | `EmailSender.xaml` | No known conversion from System.String to System.TimeSpan — review the variable type or activity ... | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (22)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Dispatcher.xaml` | `object-object` | Fix serialization failure for activity in Dispatcher.xaml — replace [object O... | 20 |
| 2 | `Dispatcher.xaml` | `object-object` | Fix serialization failure for activity in Dispatcher.xaml — replace [object O... | 20 |
| 3 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 4 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 5 | `Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Performer.xaml — estimated 15 min | 15 |
| 6 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 7 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 8 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 9 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 10 | `MessageComposer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in MessageComposer.xaml — estimated 15 min | 15 |
| 11 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 12 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 13 | `Finalize.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 14 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 15 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 16 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 17 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 18 | `Dispatcher.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath d... | 5 |
| 19 | `EmailSender.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in EmailSender.xaml — use valid enum from UiPath ... | 5 |
| 20 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 21 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 22 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Init.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | TODO: Implement Reads all BGV12 Orchestrator assets, builds the config Dictio... | 15 |

### Transitive Dependency Issues (2)

Activities reference packages or types that are not declared in project.json. These may cause runtime failures.

| # | File | Check | Detail | Est. Minutes |
|---|------|-------|--------|-------------|
| 1 | `Dispatcher.xaml` | transitive-dependency-missing | Activity requires package "UiPath.Web.Activities" but it is not declared in project.json dependen... | 10 |
| 2 | `MessageComposer.xaml` | transitive-dependency-missing | Activity requires package "UiPath.Web.Activities" but it is not declared in project.json dependen... | 10 |

### Developer Implementation Required (13)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 2 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 2 | `Main.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 3 | `Dispatcher.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 4 | `Dispatcher.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 5 | `Performer.xaml` | Contains 3 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 6 | `Performer.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 7 | `MessageComposer.xaml` | Contains 5 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 8 | `MessageComposer.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 9 | `EmailSender.xaml` | Contains 7 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 10 | `EmailSender.xaml` | Contains 6 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 11 | `Finalize.xaml` | Contains 5 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 12 | `Finalize.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 13 | `Init.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (45)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Performer.xaml` | potentially-null-dereference | Line 274: "obj_TransactionItem.SpecificContent" accessed without visible null guard in scope — ve... | — | undefined |
| 2 | `Performer.xaml` | potentially-null-dereference | Line 319: "obj_TransactionItem.SpecificContent" accessed without visible null guard in scope — ve... | — | undefined |
| 3 | `Performer.xaml` | potentially-null-dereference | Line 364: "obj_TransactionItem.SpecificContent" accessed without visible null guard in scope — ve... | — | undefined |
| 4 | `Performer.xaml` | potentially-null-dereference | Line 403: "obj_TransactionItem.Reference" accessed without visible null guard in scope — verify n... | — | undefined |
| 5 | `Dispatcher.xaml` | hardcoded-retry-count | Line 184: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 6 | `Dispatcher.xaml` | hardcoded-retry-count | Line 192: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 7 | `Dispatcher.xaml` | hardcoded-retry-count | Line 197: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 8 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 184: retry interval hardcoded as "[object Object]" — consider externalizing to Config.xlsx | — | undefined |
| 9 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 192: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 10 | `Dispatcher.xaml` | hardcoded-retry-interval | Line 197: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 11 | `Dispatcher.xaml` | hardcoded-queue-name | Line 421: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.x... | — | undefined |
| 12 | `Performer.xaml` | hardcoded-queue-name | Line 211: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.x... | — | undefined |
| 13 | `EmailSender.xaml` | hardcoded-retry-count | Line 153: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 14 | `EmailSender.xaml` | hardcoded-retry-count | Line 170: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 15 | `EmailSender.xaml` | hardcoded-retry-count | Line 175: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 16 | `EmailSender.xaml` | hardcoded-retry-interval | Line 153: retry interval hardcoded as "[str_BackoffDuration]" — consider externalizing to Config.... | — | undefined |
| 17 | `EmailSender.xaml` | hardcoded-retry-interval | Line 170: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 18 | `EmailSender.xaml` | hardcoded-retry-interval | Line 175: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
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
| 29 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 421: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: str_CurrentEventId &amp;... | — | undefined |
| 30 | `Dispatcher.xaml` | TYPE_MISMATCH | Line 421: Type mismatch — variable "dict_QueueItemContent" (scg:Dictionary(x:String, x:Object)) b... | — | undefined |
| 31 | `EmailSender.xaml` | TYPE_MISMATCH | Line 153: Type mismatch — variable "str_BackoffDuration" (System.String) bound to ui:RetryScope.R... | — | undefined |
| 32 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 33 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "JsonString" on uweb:DeserializeJson | — | undefined |
| 34 | `Dispatcher.xaml` | CATALOG_VIOLATION | Missing required property "Result" on uweb:DeserializeJson | — | undefined |
| 35 | `MessageComposer.xaml` | CATALOG_VIOLATION | Missing required property "Prompt" on ugenai:UseGenAI | — | undefined |
| 36 | `MessageComposer.xaml` | CATALOG_VIOLATION | Missing required property "JsonString" on uweb:DeserializeJson | — | undefined |
| 37 | `MessageComposer.xaml` | CATALOG_VIOLATION | Missing required property "Result" on uweb:DeserializeJson | — | undefined |
| 38 | `EmailSender.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 39 | `Finalize.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 40 | `Dispatcher.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[object Object]" was bracket-wrapped from a variable/expression — ver... | — | undefined |
| 41 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 42 | `Dispatcher.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 43 | `EmailSender.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[str_BackoffDuration]" was bracket-wrapped from a variable/expression... | — | undefined |
| 44 | `EmailSender.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 45 | `EmailSender.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |

**Total manual remediation effort: ~305 minutes (5.1 hours)**

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
| 9 | `UiPath.GenAI.Activities` |

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

- `ContactLookup.xaml`
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
| placeholder-value | warning | 13 | Contains 2 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] |
| potentially-null-dereference | warning | 4 | Line 274: "obj_TransactionItem.SpecificContent" accessed without visible null guard in scope — verify null check exists ... |
| hardcoded-retry-count | warning | 6 | Line 184: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("MaxRetryNumber")) |
| hardcoded-retry-interval | warning | 6 | Line 184: retry interval hardcoded as "[object Object]" — consider externalizing to Config.xlsx |
| hardcoded-queue-name | warning | 2 | Line 421: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.xlsx entry or workflow a... |
| hardcoded-asset-name | warning | 10 | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xlsx entry or workflow arg... |
| EXPRESSION_SYNTAX | warning | 1 | Line 421: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: str_CurrentEventId &amp;amp; &quot;_&quot; &amp... |
| TYPE_MISMATCH | warning | 2 | Line 421: Type mismatch — variable "dict_QueueItemContent" (scg:Dictionary(x:String, x:Object)) bound to ui:AddQueueItem... |
| transitive-dependency-missing | warning | 2 | Activity requires package "UiPath.Web.Activities" but it is not declared in project.json dependencies |
| CATALOG_VIOLATION | warning | 8 | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest |
| RETRY_INTERVAL_EXPRESSION_WRAPPED | warning | 2 | Post-repair: RetryInterval="[object Object]" was bracket-wrapped from a variable/expression — verify the referenced vari... |
| RETRY_INTERVAL_DEFAULTED | warning | 4 | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow context |

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

**Overall: Not Ready — 20/50 (28%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 10 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 16% of high-risk activities covered by TryCatch; 3 file(s) with no TryCatch blocks |
| Queue Management | 3/10 | GetTransactionItem found without SetTransactionStatus — incomplete transaction handling; 2 hardcoded queue name(s) — externalize to config |
| Build Quality | 0/10 | 60 quality warnings — significant remediation needed; 23 remediations — stub replacements need developer attention; 7/10 workflow(s) are Studio-loadable (3 blocked — 30% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 275 |
| Valid activities | 275 |
| Unknown → Comment stubs | 0 |
| Non-catalog properties stripped | 65 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 2 |
| Total issues | 48 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 67 auto-fixed, 48 total issues |
| Post-emission (quality gate) | 83 warnings/remediations |

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
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Dispatcher.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Performer.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in Performer.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "MessageComposer.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in MessageComposer.xaml"
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
      "file": "EmailSender.xaml",
      "description": "No known conversion from System.String to System.TimeSpan — review the variable type or activity property"
    }
  ],
  "remediations": [
    {
      "level": "workflow",
      "file": "Init.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — Tree assembly failed — assetName.startsWith is not a function",
      "classifiedCheck": "compliance-crash",
      "developerAction": "TODO: Implement Reads all BGV12 Orchestrator assets, builds the config Dictionary<String,Object>, resolves today's date in Asia/Dubai timezone, and creates the BirthdayGreetingRun Data Service entity with Status=Running. Returns the populated config dictionary and the new RunId to Main.",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_OBJECT_OBJECT",
      "reason": "Line 184: contains \"[object Object]\" — serialization failure",
      "classifiedCheck": "object-object",
      "developerAction": "Fix serialization failure for activity in Dispatcher.xaml — replace [object Object] with actual values",
      "estimatedEffortMinutes": 20
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_OBJECT_OBJECT",
      "reason": "Line 326: contains \"[object Object]\" — serialization failure",
      "classifiedCheck": "object-object",
      "developerAction": "Fix serialization failure for activity in Dispatcher.xaml — replace [object Object] with actual values",
      "estimatedEffortMinutes": 20
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 228: Undeclared variable \"Result\" in expression: REVIEW_REQUIRED: Result — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 412: Undeclared variable \"From\" in expression: New Dictionary(Of String, Object) From {{\"FullName\", str_Cur... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 421: Undeclared variable \"From\" in expression: New Dictionary(Of String, Object) From {{&quot;ItemId&quot;,... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 156: Undeclared variable \"subject\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 156: Undeclared variable \"Happy\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 156: Undeclared variable \"Birthday\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 156: Undeclared variable \"body\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 253: Undeclared variable \"Result\" in expression: REVIEW_REQUIRED: Result — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageComposer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 97: Undeclared variable \"EmailSender\" in expression: EmailSender — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 227: Undeclared variable \"ex\" in expression: ex.GetType().Name &amp; \": \" &amp; ex.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 142: String.Format() expects 2-10 argument(s) but got 20 in expression: String.Format(\"{{\"\"RunId\"\":\"\"{0}\"\",\"\"Status\"\":\"\"{1}\"\",\"\"EventsFoundCount\"\":{2},\"...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 341: Undeclared variable \"Completed\" in expression: str_FinalStatus &lt;&gt; Completed — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 205: Undeclared variable \"ex_Init\" in expression: ex_Init.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 294: Undeclared variable \"ex_Dispatcher\" in expression: ex_Dispatcher.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 363: Undeclared variable \"ex_Performer\" in expression: ex_Performer.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
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
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;POST&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in EmailSender.xaml — use valid enum from UiPath documentation",
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
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;PUT&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Finalize.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[If(str_FinalStatus = &quot;Faulted&quot;, &quot;Error&quot;, &quot;Warn&quot;)]\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. No normalization match found.",
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
      "detail": "Contains 2 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
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
      "file": "MessageComposer.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "MessageComposer.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
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
      "check": "placeholder-value",
      "file": "Init.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 274: \"obj_TransactionItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 319: \"obj_TransactionItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 364: \"obj_TransactionItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 403: \"obj_TransactionItem.Reference\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 184: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 192: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Dispatcher.xaml",
      "detail": "Line 197: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 184: retry interval hardcoded as \"[object Object]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 192: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Dispatcher.xaml",
      "detail": "Line 197: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Dispatcher.xaml",
      "detail": "Line 421: queue name \"BirthdayGreetingsV12_EmailsToSend\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Performer.xaml",
      "detail": "Line 211: queue name \"BirthdayGreetingsV12_EmailsToSend\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 153: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 170: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 175: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 153: retry interval hardcoded as \"[str_BackoffDuration]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 170: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 175: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
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
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 421: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: str_CurrentEventId &amp;amp; &quot;_&quot; &amp;amp; in_TodayDubai.ToString(&quo...",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Dispatcher.xaml",
      "detail": "Line 421: Type mismatch — variable \"dict_QueueItemContent\" (scg:Dictionary(x:String, x:Object)) bound to ui:AddQueueItem.ItemInformation (expects System.Collections.Generic.Dictionary`2[System.String,System.Object]). No known conversion from scg:Dictionary(x:String, x:Object) to System.Collections.Generic.Dictionary`2[System.String,System.Object] — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "EmailSender.xaml",
      "detail": "Line 153: Type mismatch — variable \"str_BackoffDuration\" (System.String) bound to ui:RetryScope.RetryInterval (expects System.TimeSpan). No known conversion from System.String to System.TimeSpan — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "transitive-dependency-missing",
      "file": "Dispatcher.xaml",
      "detail": "Activity requires package \"UiPath.Web.Activities\" but it is not declared in project.json dependencies",
      "severity": "warning"
    },
    {
      "check": "transitive-dependency-missing",
      "file": "MessageComposer.xaml",
      "detail": "Activity requires package \"UiPath.Web.Activities\" but it is not declared in project.json dependencies",
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
      "file": "MessageComposer.xaml",
      "detail": "Missing required property \"Prompt\" on ugenai:UseGenAI",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "MessageComposer.xaml",
      "detail": "Missing required property \"JsonString\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "MessageComposer.xaml",
      "detail": "Missing required property \"Result\" on uweb:DeserializeJson",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "EmailSender.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "Finalize.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "Dispatcher.xaml",
      "detail": "Post-repair: RetryInterval=\"[object Object]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
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
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "EmailSender.xaml",
      "detail": "Post-repair: RetryInterval=\"[str_BackoffDuration]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "EmailSender.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "EmailSender.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 305,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Dispatcher.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[object-object] Line 184: contains \"[object Object]\" — serialization failure",
        "[object-object] Line 326: contains \"[object Object]\" — serialization failure"
      ]
    },
    {
      "file": "Performer.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ContactLookup.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[UNDECLARED_ARGUMENT] Argument \"in_FullName\" is referenced in expressions but not declared in <x:Members> or as a <Variable>",
        "[UNDECLARED_ARGUMENT] Post-repair: Argument \"in_FullName\" referenced but not declared in x:Members or Variables"
      ]
    },
    {
      "file": "MessageComposer.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "EmailSender.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Finalize.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[EXPRESSION_SYNTAX_UNFIXABLE] Line 142: String.Format() expects 2-10 argument(s) but got 20 in expression: String.Format(\"{{\"\"RunId\"\":\"\"{0}\"\",\"\"Status\"\":\"\"{1}\"\",\"\"EventsFoundCount\"\":{2},\"...",
        "[STRING_FORMAT_OVERFLOW] Line 142: String.Format has 20 total arguments with highest placeholder index {0} — UiPath Studio may have issues with >10 format arguments. Consider splitting into multiple Format calls or using string concatenation. in expression: String.Format(\"{{\"\"RunId\"\":\"\"{0}\"\",\"\"Status\"\":\"\"{1}\"\",\"\"EventsFoundCount\"\":{2},\"..."
      ]
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
    "totalActivities": 275,
    "validActivities": 275,
    "unknownActivities": 0,
    "strippedProperties": 65,
    "enumCorrections": 0,
    "missingRequiredFilled": 2,
    "commentConversions": 0,
    "issueCount": 48
  }
}
```
