# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-03-31
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (39%)

**Total Estimated Effort: ~480 minutes (8.0 hours)**
**Remediations:** 38 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 1 workflow)
**Auto-Repairs:** 16
**Quality Warnings:** 54

---

## 1. Completed Work

The following 1 workflow(s) were fully generated without any stub replacements or remediation:

- `InitAllSettings.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `GetTodayBirthdays.xaml` | Fully Generated |
| 3 | `ResolveRecipientEmail.xaml` | Fully Generated |
| 4 | `ComposeMessage.xaml` | Fully Generated |
| 5 | `ProcessEvent.xaml` | Fully Generated |
| 6 | `Finalize.xaml` | Structurally invalid — [EXPRESSION_SYNTAX_UNFIXABLE] Line 186: CStr() has unbalanced parentheses in expression: "{" &amp; CStr(Environment.NewLine) &amp; " \"runId\": \"" &amp; CStr(in_RunId) ...; [EXPRESSION_SYNTAX_UNFIXABLE] Line 186: .Replace() has unbalanced parentheses in expression: "{" &amp; CStr(Environment.NewLine) &amp; " \"runId\": \"" &amp; CStr(in_RunId) ... |
| 7 | `BirthdayGreetingsV12.xaml` | Fully Generated |
| 8 | `InitAllSettings.xaml` | Fully Generated |
| 9 | `Init.xaml` | Structurally invalid (not Studio-loadable) |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `GetTodayBirthdays.xaml` | Openable with warnings | Unclassified | — |
| 3 | `ResolveRecipientEmail.xaml` | Openable with warnings | Unclassified | — |
| 4 | `ComposeMessage.xaml` | Openable with warnings | Unclassified | — |
| 5 | `ProcessEvent.xaml` | Openable with warnings | Unclassified | — |
| 6 | `Finalize.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_SYNTAX_UNFIXABLE] Line 186: CStr() has unbalanced parentheses in ...; [EXPRESSION_SYNTAX_UNFIXABLE] Line 186: .Replace() has unbalanced parentheses... |
| 7 | `BirthdayGreetingsV12.xaml` | Studio-openable | — | — |
| 8 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 9 | `Init.xaml` | Openable with warnings | Unclassified | — |

**Summary:** 2 Studio-loadable, 6 with warnings, 1 not Studio-loadable

> **⚠ 1 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

## 2. AI-Resolved with Smart Defaults

The following 16 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `ResolveRecipientEmail.xaml` | Stripped 1 placeholder token(s) from ResolveRecipientEmail.xaml | 5 |
| 2 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Main.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in Main.xaml | undefined |
| 3 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `GetTodayBirthdays.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in GetTodayBirthdays.xaml | undefined |
| 4 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `ResolveRecipientEmail.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in ResolveRecipientEmail.xaml | undefined |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `ComposeMessage.xaml` | Catalog: Moved While.Condition from attribute to child-element in ComposeMessage.xaml | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `BirthdayGreetingsV12.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in BirthdayGreetingsV12.xaml | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitA... | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 9 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 10 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 11 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 12 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 13 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 14 | `REPAIR_TYPE_MISMATCH` | `GetTodayBirthdays.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |
| 15 | `REPAIR_TYPE_MISMATCH` | `ResolveRecipientEmail.xaml` | No known conversion from System.Object to Newtonsoft.Json.Linq.JObject — review the variable type... | undefined |
| 16 | `REPAIR_TYPE_MISMATCH` | `ResolveRecipientEmail.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (37)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `GetTodayBirthdays.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 2 | `GetTodayBirthdays.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 3 | `GetTodayBirthdays.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 4 | `GetTodayBirthdays.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 5 | `ComposeMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ComposeMessage.xaml — estimated 15 min | 15 |
| 6 | `ComposeMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ComposeMessage.xaml — estimated 15 min | 15 |
| 7 | `Finalize.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 8 | `Finalize.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 9 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 10 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 11 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 12 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 13 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 14 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 15 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 16 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 17 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 18 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 19 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 20 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 21 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 22 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 23 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 24 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 25 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 26 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 27 | `GetTodayBirthdays.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 28 | `ResolveRecipientEmail.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in ResolveRecipientEmail.xaml — estimated 15 min | 15 |
| 29 | `Main.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Main.xaml — use valid enum from UiPath documen... | 5 |
| 30 | `Main.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Main.xaml — use valid enum from UiPath documen... | 5 |
| 31 | `GetTodayBirthdays.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from U... | 5 |
| 32 | `ResolveRecipientEmail.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in ResolveRecipientEmail.xaml — use valid enum fr... | 5 |
| 33 | `ProcessEvent.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath... | 5 |
| 34 | `ProcessEvent.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath... | 5 |
| 35 | `ProcessEvent.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath... | 5 |
| 36 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 37 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Init.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | TODO: Implement Loads all Orchestrator assets into a config dictionary, resol... | 15 |

### Transitive Dependency Issues (1)

Activities reference packages or types that are not declared in project.json. These may cause runtime failures.

| # | File | Check | Detail | Est. Minutes |
|---|------|-------|--------|-------------|
| 1 | `ResolveRecipientEmail.xaml` | transitive-dependency-missing | Activity requires package "UiPath.Web.Activities" but it is not declared in project.json dependen... | 10 |

### Developer Implementation Required (13)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 3 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 2 | `Main.xaml` | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 3 | `GetTodayBirthdays.xaml` | Contains 6 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 4 | `GetTodayBirthdays.xaml` | Contains 6 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 5 | `ResolveRecipientEmail.xaml` | Contains 7 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 6 | `ResolveRecipientEmail.xaml` | Contains 7 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 7 | `ComposeMessage.xaml` | Contains 6 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 8 | `ComposeMessage.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 9 | `ProcessEvent.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 10 | `ProcessEvent.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 11 | `Finalize.xaml` | Contains 2 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 12 | `Finalize.xaml` | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 13 | `Init.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (40)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `ResolveRecipientEmail.xaml` | unguarded-selecttoken | Line 219: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?. | — | undefined |
| 2 | `ResolveRecipientEmail.xaml` | unguarded-selecttoken | Line 404: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?. | — | undefined |
| 3 | `ResolveRecipientEmail.xaml` | unguarded-selecttoken | Line 481: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?. | — | undefined |
| 4 | `ResolveRecipientEmail.xaml` | unguarded-selecttoken | Line 541: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?. | — | undefined |
| 5 | `ComposeMessage.xaml` | unguarded-json-access | Line 278: JObject.Parse(...)("key") without null/existence check — may throw NullReferenceExcepti... | — | undefined |
| 6 | `ComposeMessage.xaml` | unguarded-json-access | Line 323: JObject.Parse(...)("key") without null/existence check — may throw NullReferenceExcepti... | — | undefined |
| 7 | `GetTodayBirthdays.xaml` | hardcoded-retry-count | Line 204: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 8 | `GetTodayBirthdays.xaml` | hardcoded-retry-interval | Line 204: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 9 | `ResolveRecipientEmail.xaml` | hardcoded-retry-count | Line 156: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 10 | `ResolveRecipientEmail.xaml` | hardcoded-retry-interval | Line 156: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 11 | `ProcessEvent.xaml` | hardcoded-retry-count | Line 265: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 12 | `ProcessEvent.xaml` | hardcoded-retry-count | Line 311: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 13 | `ProcessEvent.xaml` | hardcoded-retry-count | Line 316: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 14 | `ProcessEvent.xaml` | hardcoded-retry-interval | Line 265: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 15 | `ProcessEvent.xaml` | hardcoded-retry-interval | Line 311: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 16 | `ProcessEvent.xaml` | hardcoded-retry-interval | Line 316: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 17 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xls... | — | undefined |
| 18 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 19 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 139: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 20 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 148: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 21 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 157: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 22 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 166: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 23 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 175: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 24 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 184: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 25 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 193: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 26 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 202: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 27 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 185: Removed 2 extra closing parenthesis(es) in expression: "{" &amp; CStr(Environment.NewLi... | — | undefined |
| 28 | `ResolveRecipientEmail.xaml` | TYPE_MISMATCH | Line 207: Type mismatch — variable "obj_ConnectorSearchResponse" (System.Object) bound to uweb:Se... | — | undefined |
| 29 | `GetTodayBirthdays.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 30 | `GetTodayBirthdays.xaml` | CATALOG_VIOLATION | Missing required property "DataTable" on ucs:AddDataRow | — | undefined |
| 31 | `ResolveRecipientEmail.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 32 | `ComposeMessage.xaml` | CATALOG_VIOLATION | Missing required property "Prompt" on ugenai:UseGenAI | — | undefined |
| 33 | `ProcessEvent.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 34 | `ProcessEvent.xaml` | CATALOG_VIOLATION | Missing required property "Input" on ucrypt:HashText | — | undefined |
| 35 | `Finalize.xaml` | CATALOG_VIOLATION | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest | — | undefined |
| 36 | `GetTodayBirthdays.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 37 | `ResolveRecipientEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 38 | `ProcessEvent.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 39 | `ProcessEvent.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 40 | `ProcessEvent.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |

**Total manual remediation effort: ~480 minutes (8.0 hours)**

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
| 5 | `UiPath.ComplexScenarios.Activities` |
| 6 | `UiPath.IntegrationService.Activities` |
| 7 | `Newtonsoft.Json` |
| 8 | `UiPath.WebAPI.Activities` |
| 9 | `UiPath.GenAI.Activities` |
| 10 | `UiPath.Cryptography.Activities` |

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

**Summary:** 10 aligned, 1 SDD-only, 0 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

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

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 1/22 high-risk activities inside TryCatch (5%)

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
| unguarded-selecttoken | warning | 4 | Line 219: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?. |
| unguarded-json-access | warning | 2 | Line 278: JObject.Parse(...)("key") without null/existence check — may throw NullReferenceException if key missing |
| hardcoded-retry-count | warning | 5 | Line 204: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("MaxRetryNumber")) |
| hardcoded-retry-interval | warning | 5 | Line 204: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx |
| hardcoded-asset-name | warning | 10 | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xlsx entry or workflow arg... |
| EXPRESSION_SYNTAX | warning | 1 | Line 185: Removed 2 extra closing parenthesis(es) in expression: "{" &amp; CStr(Environment.NewLine) &amp; " \"runId\": ... |
| TYPE_MISMATCH | warning | 1 | Line 207: Type mismatch — variable "obj_ConnectorSearchResponse" (System.Object) bound to uweb:SerializeJson.JsonObject ... |
| transitive-dependency-missing | warning | 1 | Activity requires package "UiPath.Web.Activities" but it is not declared in project.json dependencies |
| CATALOG_VIOLATION | warning | 7 | Missing required property "Endpoint" on uis:IntegrationServiceHTTPRequest |
| RETRY_INTERVAL_DEFAULTED | warning | 5 | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow context |

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

**Overall: Not Ready — 28/50 (39%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 10 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 3/10 | Only 5% of high-risk activities covered by TryCatch; 2 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 0/10 | 54 quality warnings — significant remediation needed; 38 remediations — stub replacements need developer attention; 8/9 workflow(s) are Studio-loadable (1 blocked — 11% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 281 |
| Valid activities | 281 |
| Unknown → Comment stubs | 0 |
| Non-catalog properties stripped | 45 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 1 |
| Total issues | 35 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 46 auto-fixed, 35 total issues |
| Post-emission (quality gate) | 92 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "InitAllSettings.xaml"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "ResolveRecipientEmail.xaml",
      "description": "Stripped 1 placeholder token(s) from ResolveRecipientEmail.xaml",
      "developerAction": "Review ResolveRecipientEmail.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Main.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in GetTodayBirthdays.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "ResolveRecipientEmail.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in ResolveRecipientEmail.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "ComposeMessage.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in ComposeMessage.xaml"
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
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "GetTodayBirthdays.xaml",
      "description": "Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "ResolveRecipientEmail.xaml",
      "description": "No known conversion from System.Object to Newtonsoft.Json.Linq.JObject — review the variable type or activity property"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "ResolveRecipientEmail.xaml",
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
      "developerAction": "TODO: Implement Loads all Orchestrator assets into a config dictionary, resolves the Dubai-timezone 'today' date boundaries, initialises the BirthdayGreetingRun Data Service record (status=Running), and returns the populated config and RunId to Main. Uses inline TryCatch around asset reads to detect credential-expiry or asset-not-found failures fast.",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 353: Undeclared variable \"error\" in expression: str_CalendarEventsJson.Contains(&quot;\\&quot;error\\&quot;&qu... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 474: Undeclared variable \"eventToken\" in expression: If(eventToken(\"id\") IsNot Nothing, eventToken(\"id\").ToString... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 482: Undeclared variable \"eventToken\" in expression: If(eventToken(\"summary\") IsNot Nothing, eventToken(\"summary\"... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 504: Undeclared variable \"eventToken\" in expression: If(eventToken(\"start\")(\"date\") IsNot Nothing, DateTime.Parse... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ComposeMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 123: Undeclared variable \"subject\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ComposeMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ComposeMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 123: Undeclared variable \"body\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ComposeMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: CStr() has unbalanced parentheses in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &amp; CStr(in_RunId) ...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: .Replace() has unbalanced parentheses in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &amp; CStr(in_RunId) ...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"runId\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"o\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"eventsFoundCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"sentCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"skippedNoEmailCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"skippedContactNotFoundCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"skippedAmbiguousMatchCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"failedCount\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 185: Undeclared variable \"errorSummary\" in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 182: Undeclared variable \"ex_Init\" in expression: ex_Init.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 260: Undeclared variable \"ex_GetBirthdays\" in expression: ex_GetBirthdays.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 384: Undeclared variable \"ex_ProcessEvent\" in expression: ex_ProcessEvent.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 392: Undeclared variable \"Sent\" in expression: str_ProcessEventSendStatus = Sent — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 407: Undeclared variable \"Failed\" in expression: str_ProcessEventSendStatus = Failed — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 422: Undeclared variable \"SkippedNoEmail\" in expression: str_ProcessEventSendStatus = SkippedNoEmail — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 437: Undeclared variable \"SkippedContactNotFound\" in expression: str_ProcessEventSendStatus = SkippedContactNotFound — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 452: Undeclared variable \"SkippedAmbiguousMatch\" in expression: str_ProcessEventSendStatus = SkippedAmbiguousMatch — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 571: Undeclared variable \"ex_Unhandled\" in expression: ex_Unhandled.Message — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 457: Type mismatch — variable \"obj_RawEventsArray\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ResolveRecipientEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 524: Type mismatch — variable \"obj_ContactsArray\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in ResolveRecipientEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[If(str_ProcessEventSendStatus = &quot;Failed&quot;, &quot;Warn&quot;, &quot;Info&quot;)]\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Main.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[If(bool_IsFaultedRun, &quot;Error&quot;, &quot;Info&quot;)]\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Main.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;GET&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "ResolveRecipientEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;GET&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in ResolveRecipientEmail.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "ProcessEvent.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;POST&quot;\" for \"Method\" on uis:IntegrationServiceHTTPRequest — valid values: GET, POST, PUT, DELETE, PATCH. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "ProcessEvent.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;SHA256&quot;\" for \"Algorithm\" on ucrypt:HashText — valid values: SHA256, SHA384, SHA512, MD5, SHA1, RIPEMD160. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "ProcessEvent.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;UTF-8&quot;\" for \"Encoding\" on ucrypt:HashText — valid values: UTF-8, Unicode, ASCII, UTF-32. No normalization match found.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in ProcessEvent.xaml — use valid enum from UiPath documentation",
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
      "detail": "Contains 2 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ComposeMessage.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ComposeMessage.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ProcessEvent.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "ProcessEvent.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Finalize.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
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
      "check": "unguarded-selecttoken",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 219: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?.",
      "severity": "warning"
    },
    {
      "check": "unguarded-selecttoken",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 404: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?.",
      "severity": "warning"
    },
    {
      "check": "unguarded-selecttoken",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 481: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?.",
      "severity": "warning"
    },
    {
      "check": "unguarded-selecttoken",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 541: .SelectToken() without null check — use If(token IsNot Nothing, ...) or ?.",
      "severity": "warning"
    },
    {
      "check": "unguarded-json-access",
      "file": "ComposeMessage.xaml",
      "detail": "Line 278: JObject.Parse(...)(\"key\") without null/existence check — may throw NullReferenceException if key missing",
      "severity": "warning"
    },
    {
      "check": "unguarded-json-access",
      "file": "ComposeMessage.xaml",
      "detail": "Line 323: JObject.Parse(...)(\"key\") without null/existence check — may throw NullReferenceException if key missing",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 204: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 204: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 156: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 156: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ProcessEvent.xaml",
      "detail": "Line 265: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ProcessEvent.xaml",
      "detail": "Line 311: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ProcessEvent.xaml",
      "detail": "Line 316: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ProcessEvent.xaml",
      "detail": "Line 265: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ProcessEvent.xaml",
      "detail": "Line 311: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ProcessEvent.xaml",
      "detail": "Line 316: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
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
      "file": "Finalize.xaml",
      "detail": "Line 185: Removed 2 extra closing parenthesis(es) in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &amp; CStr(in_RunId) ...",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Line 207: Type mismatch — variable \"obj_ConnectorSearchResponse\" (System.Object) bound to uweb:SerializeJson.JsonObject (expects Newtonsoft.Json.Linq.JObject). No known conversion from System.Object to Newtonsoft.Json.Linq.JObject — review the variable type or activity property",
      "severity": "warning"
    },
    {
      "check": "transitive-dependency-missing",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Activity requires package \"UiPath.Web.Activities\" but it is not declared in project.json dependencies",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Missing required property \"DataTable\" on ucs:AddDataRow",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "ComposeMessage.xaml",
      "detail": "Missing required property \"Prompt\" on ugenai:UseGenAI",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "ProcessEvent.xaml",
      "detail": "Missing required property \"Endpoint\" on uis:IntegrationServiceHTTPRequest",
      "severity": "warning"
    },
    {
      "check": "CATALOG_VIOLATION",
      "file": "ProcessEvent.xaml",
      "detail": "Missing required property \"Input\" on ucrypt:HashText",
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
      "file": "GetTodayBirthdays.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "ResolveRecipientEmail.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "ProcessEvent.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "ProcessEvent.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_DEFAULTED",
      "file": "ProcessEvent.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 480,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "GetTodayBirthdays.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ResolveRecipientEmail.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ComposeMessage.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ProcessEvent.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Finalize.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[EXPRESSION_SYNTAX_UNFIXABLE] Line 185: CStr() has unbalanced parentheses in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &amp; CStr(in_RunId) ...",
        "[EXPRESSION_SYNTAX_UNFIXABLE] Line 185: .Replace() has unbalanced parentheses in expression: \"{\" &amp; CStr(Environment.NewLine) &amp; \" \\\"runId\\\": \\\"\" &amp; CStr(in_RunId) ..."
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
    "totalActivities": 281,
    "validActivities": 281,
    "unknownActivities": 0,
    "strippedProperties": 45,
    "enumCorrections": 0,
    "missingRequiredFilled": 1,
    "commentConversions": 0,
    "issueCount": 35
  }
}
```
