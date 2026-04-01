# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-04-01
**Generation Mode:** Full Implementation
**Deployment Readiness:** Needs Work (60%)

**Total Estimated Effort: ~120 minutes (2.0 hours)**
**Remediations:** 8 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 0 workflow)
**Auto-Repairs:** 13
**Quality Warnings:** 46

---

## 1. Completed Work

The following 7 workflow(s) were fully generated without any stub replacements or remediation:

- `InitAllSettings.xaml`
- `CreateRunRecord.xaml`
- `[GetTodayBirthdays.xaml]`
- `[LookupContactEmail.xaml]`
- `[GenerateBirthdayMessage.xaml]`
- `[SendBirthdayEmail.xaml]`
- `[FinalizeRun.xaml]`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Fully Generated |
| 2 | `GetTodayBirthdays.xaml` | Fully Generated |
| 3 | `ProcessBirthdayEvent.xaml` | Fully Generated |
| 4 | `LookupContactEmail.xaml` | Fully Generated |
| 5 | `GenerateBirthdayMessage.xaml` | Fully Generated |
| 6 | `SendBirthdayEmail.xaml` | Fully Generated |
| 7 | `FinalizeRun.xaml` | Fully Generated |
| 8 | `BirthdayGreetingsV12.xaml` | Fully Generated |
| 9 | `InitAllSettings.xaml` | Fully Generated |
| 10 | `CreateRunRecord.xaml` | Fully Generated |
| 11 | `[GetTodayBirthdays.xaml].xaml` | Fully Generated |
| 12 | `[LookupContactEmail.xaml].xaml` | Fully Generated |
| 13 | `[GenerateBirthdayMessage.xaml].xaml` | Fully Generated |
| 14 | `[SendBirthdayEmail.xaml].xaml` | Fully Generated |
| 15 | `[FinalizeRun.xaml].xaml` | Fully Generated |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `GetTodayBirthdays.xaml` | Openable with warnings | Unclassified | — |
| 3 | `ProcessBirthdayEvent.xaml` | Studio-openable | — | — |
| 4 | `LookupContactEmail.xaml` | Openable with warnings | Unclassified | — |
| 5 | `GenerateBirthdayMessage.xaml` | Openable with warnings | Unclassified | — |
| 6 | `SendBirthdayEmail.xaml` | Openable with warnings | Unclassified | — |
| 7 | `FinalizeRun.xaml` | Openable with warnings | Unclassified | — |
| 8 | `BirthdayGreetingsV12.xaml` | Studio-openable | — | — |
| 9 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 10 | `CreateRunRecord.xaml` | Studio-openable | — | — |
| 11 | `[GetTodayBirthdays.xaml]` | Studio-openable | — | — |
| 12 | `[LookupContactEmail.xaml]` | Studio-openable | — | — |
| 13 | `[GenerateBirthdayMessage.xaml]` | Studio-openable | — | — |
| 14 | `[SendBirthdayEmail.xaml]` | Studio-openable | — | — |
| 15 | `[FinalizeRun.xaml]` | Studio-openable | — | — |

**Summary:** 9 Studio-loadable, 6 with warnings, 0 not Studio-loadable

## 2. AI-Resolved with Smart Defaults

The following 13 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `Main.xaml` | Stripped 1 placeholder token(s) from Main.xaml | 5 |
| 2 | `REPAIR_PLACEHOLDER_CLEANUP` | `GetTodayBirthdays.xaml` | Stripped 21 placeholder token(s) from GetTodayBirthdays.xaml | 5 |
| 3 | `REPAIR_PLACEHOLDER_CLEANUP` | `ProcessBirthdayEvent.xaml` | Stripped 22 placeholder token(s) from ProcessBirthdayEvent.xaml | 5 |
| 4 | `REPAIR_PLACEHOLDER_CLEANUP` | `LookupContactEmail.xaml` | Stripped 22 placeholder token(s) from LookupContactEmail.xaml | 5 |
| 5 | `REPAIR_PLACEHOLDER_CLEANUP` | `GenerateBirthdayMessage.xaml` | Stripped 6 placeholder token(s) from GenerateBirthdayMessage.xaml | 5 |
| 6 | `REPAIR_PLACEHOLDER_CLEANUP` | `SendBirthdayEmail.xaml` | Stripped 9 placeholder token(s) from SendBirthdayEmail.xaml | 5 |
| 7 | `REPAIR_PLACEHOLDER_CLEANUP` | `FinalizeRun.xaml` | Stripped 7 placeholder token(s) from FinalizeRun.xaml | 5 |
| 8 | `REPAIR_PLACEHOLDER_CLEANUP` | `CreateRunRecord.xaml` | Stripped 1 placeholder token(s) from CreateRunRecord.xaml | 5 |
| 9 | `REPAIR_PLACEHOLDER_CLEANUP` | `[GetTodayBirthdays.xaml]` | Stripped 1 placeholder token(s) from [GetTodayBirthdays.xaml] | 5 |
| 10 | `REPAIR_PLACEHOLDER_CLEANUP` | `[LookupContactEmail.xaml]` | Stripped 1 placeholder token(s) from [LookupContactEmail.xaml] | 5 |
| 11 | `REPAIR_PLACEHOLDER_CLEANUP` | `[GenerateBirthdayMessage.xaml]` | Stripped 1 placeholder token(s) from [GenerateBirthdayMessage.xaml] | 5 |
| 12 | `REPAIR_PLACEHOLDER_CLEANUP` | `[SendBirthdayEmail.xaml]` | Stripped 1 placeholder token(s) from [SendBirthdayEmail.xaml] | 5 |
| 13 | `REPAIR_PLACEHOLDER_CLEANUP` | `[FinalizeRun.xaml]` | Stripped 1 placeholder token(s) from [FinalizeRun.xaml] | 5 |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (8)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Main.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 2 | `Main.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 3 | `LookupContactEmail.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in LookupContactEmail.xaml — estimated 15 min | 15 |
| 4 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 5 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 6 | `SendBirthdayEmail.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min | 15 |
| 7 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |
| 8 | `BirthdayGreetingsV12.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min | 15 |

### Developer Implementation Required (6)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 2 | `GetTodayBirthdays.xaml` | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 3 | `LookupContactEmail.xaml` | Contains 13 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 4 | `GenerateBirthdayMessage.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 5 | `SendBirthdayEmail.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 6 | `FinalizeRun.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (40)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `orchestrator` | undeclared-asset | Asset "[BGV12.CalendarName]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 2 | `orchestrator` | undeclared-asset | Asset "[BGV12.Timezone]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 3 | `orchestrator` | undeclared-asset | Asset "[BGV12.FromGmailConnectionName]" is referenced in XAML but not declared in orchestrator ar... | — | undefined |
| 4 | `orchestrator` | undeclared-asset | Asset "[BGV12.MaxConnectorRetries]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 5 | `orchestrator` | undeclared-asset | Asset "[BGV12.RetryBackoffSeconds]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 6 | `orchestrator` | undeclared-asset | Asset "[BGV12.SendEnabled]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 7 | `orchestrator` | undeclared-asset | Asset "[BGV12.SkipOnAmbiguousContactMatch]" is referenced in XAML but not declared in orchestrato... | — | undefined |
| 8 | `orchestrator` | undeclared-asset | Asset "[BGV12.PreferredEmailLabels]" is referenced in XAML but not declared in orchestrator artif... | — | undefined |
| 9 | `orchestrator` | undeclared-asset | Asset "[BGV12.OperationsDL]" is referenced in XAML but not declared in orchestrator artifacts | — | undefined |
| 10 | `Main.xaml` | hardcoded-asset-name | Line 134: asset name "&quot;BGV12.CalendarName&quot;" is hardcoded — consider using a Config.xlsx... | — | undefined |
| 11 | `Main.xaml` | hardcoded-asset-name | Line 184: asset name "&quot;BGV12.Timezone&quot;" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 12 | `Main.xaml` | hardcoded-asset-name | Line 234: asset name "&quot;BGV12.FromGmailConnectionName&quot;" is hardcoded — consider using a ... | — | undefined |
| 13 | `Main.xaml` | hardcoded-asset-name | Line 284: asset name "&quot;BGV12.MaxConnectorRetries&quot;" is hardcoded — consider using a Conf... | — | undefined |
| 14 | `Main.xaml` | hardcoded-asset-name | Line 334: asset name "&quot;BGV12.RetryBackoffSeconds&quot;" is hardcoded — consider using a Conf... | — | undefined |
| 15 | `Main.xaml` | hardcoded-asset-name | Line 384: asset name "&quot;BGV12.SkipOnAmbiguousContactMatch&quot;" is hardcoded — consider usin... | — | undefined |
| 16 | `Main.xaml` | hardcoded-asset-name | Line 434: asset name "&quot;BGV12.PreferredEmailLabels&quot;" is hardcoded — consider using a Con... | — | undefined |
| 17 | `Main.xaml` | hardcoded-asset-name | Line 484: asset name "&quot;BGV12.SendEnabled&quot;" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 18 | `Main.xaml` | hardcoded-asset-name | Line 534: asset name "&quot;BGV12.OperationsDL&quot;" is hardcoded — consider using a Config.xlsx... | — | undefined |
| 19 | `GetTodayBirthdays.xaml` | hardcoded-retry-count | Line 150: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 20 | `GetTodayBirthdays.xaml` | hardcoded-retry-count | Line 241: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 21 | `GetTodayBirthdays.xaml` | hardcoded-retry-interval | Line 150: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 22 | `GetTodayBirthdays.xaml` | hardcoded-retry-interval | Line 241: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 23 | `LookupContactEmail.xaml` | hardcoded-retry-count | Line 115: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 24 | `LookupContactEmail.xaml` | hardcoded-retry-interval | Line 115: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 25 | `SendBirthdayEmail.xaml` | hardcoded-retry-count | Line 139: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 26 | `SendBirthdayEmail.xaml` | hardcoded-retry-interval | Line 139: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 27 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 104: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xls... | — | undefined |
| 28 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 109: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 29 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 30 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 127: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 31 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 136: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 32 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 145: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 33 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 154: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 34 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 163: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 35 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 172: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 36 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 181: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 37 | `GetTodayBirthdays.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 38 | `GetTodayBirthdays.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 39 | `LookupContactEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |
| 40 | `SendBirthdayEmail.xaml` | RETRY_INTERVAL_DEFAULTED | Post-repair: RetryInterval defaulted to "00:00:05" — verify this is appropriate for the workflow ... | — | undefined |

**Total manual remediation effort: ~120 minutes (2.0 hours)**

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
| 4 | `Newtonsoft.Json` |
| 5 | `UiPath.WebAPI.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Integration Service - Google Calendar
- Orchestrator
- Integration Service - Google Contacts/People
- UiPath GenAI Activities
- Integration Service - Gmail (ninemush@gmail.com)

## 7. Credential & Asset Inventory

**Total:** 55 activities (19 hardcoded, 36 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BGV12.GoogleWorkspaceCredential` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `BGV12.CalendarName` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 2 | `BGV12.Timezone` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 3 | `BGV12.FromGmailConnectionName` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 4 | `BGV12.MaxConnectorRetries` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 5 | `BGV12.RetryBackoffSeconds` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 6 | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 7 | `BGV12.PreferredEmailLabels` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 8 | `BGV12.SendEnabled` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 9 | `BGV12.OperationsDL` | Unknown | — | `Main.xaml` | Create in Orchestrator before deployment |
| 10 | `[BGV12.CalendarName]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 11 | `[BGV12.Timezone]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 12 | `[BGV12.FromGmailConnectionName]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 13 | `[BGV12.MaxConnectorRetries]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 14 | `[BGV12.RetryBackoffSeconds]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 15 | `[BGV12.SendEnabled]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 16 | `[BGV12.SkipOnAmbiguousContactMatch]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 17 | `[BGV12.PreferredEmailLabels]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |
| 18 | `[BGV12.OperationsDL]` | Unknown | — | `BirthdayGreetingsV12.xaml` | Verify exists in target environment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `Main.xaml` | 134 | GetAsset | `BGV12.CalendarName` | Unknown | — | Yes |
| `Main.xaml` | 135 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 184 | GetAsset | `BGV12.Timezone` | Unknown | — | Yes |
| `Main.xaml` | 185 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 234 | GetAsset | `BGV12.FromGmailConnectionName` | Unknown | — | Yes |
| `Main.xaml` | 235 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 284 | GetAsset | `BGV12.MaxConnectorRetries` | Unknown | — | Yes |
| `Main.xaml` | 285 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 334 | GetAsset | `BGV12.RetryBackoffSeconds` | Unknown | — | Yes |
| `Main.xaml` | 335 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 384 | GetAsset | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | Yes |
| `Main.xaml` | 385 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 434 | GetAsset | `BGV12.PreferredEmailLabels` | Unknown | — | Yes |
| `Main.xaml` | 435 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 484 | GetAsset | `BGV12.SendEnabled` | Unknown | — | Yes |
| `Main.xaml` | 485 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main.xaml` | 534 | GetAsset | `BGV12.OperationsDL` | Unknown | — | Yes |
| `Main.xaml` | 535 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 178 | GetAsset | `[BGV12.CalendarName]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 179 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 202 | GetAsset | `[BGV12.Timezone]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 203 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 226 | GetAsset | `[BGV12.FromGmailConnectionName]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 227 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 250 | GetAsset | `[BGV12.MaxConnectorRetries]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 251 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 282 | GetAsset | `[BGV12.RetryBackoffSeconds]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 283 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 314 | GetAsset | `[BGV12.SendEnabled]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 315 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 346 | GetAsset | `[BGV12.SkipOnAmbiguousContactMatch]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 347 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 378 | GetAsset | `[BGV12.PreferredEmailLabels]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 379 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 402 | GetAsset | `[BGV12.OperationsDL]` | Unknown | — | No |
| `BirthdayGreetingsV12.xaml` | 403 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 104 | GetCredential | `BGV12.GoogleWorkspaceCredential` | Credential | — | Yes |
| `InitAllSettings.xaml` | 109 | GetAsset | `BGV12.CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 110 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 118 | GetAsset | `BGV12.Timezone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 119 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 127 | GetAsset | `BGV12.FromGmailConnectionName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 128 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 136 | GetAsset | `BGV12.MaxConnectorRetries` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 137 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 145 | GetAsset | `BGV12.RetryBackoffSeconds` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 146 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 154 | GetAsset | `BGV12.SkipOnAmbiguousContactMatch` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 155 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 163 | GetAsset | `BGV12.PreferredEmailLabels` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 164 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 172 | GetAsset | `BGV12.SendEnabled` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 173 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 181 | GetAsset | `BGV12.OperationsDL` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 182 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 19 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 10 aligned, 1 SDD-only, 9 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 9 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV12.CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name containing birthday events. | `Main.xaml` | 134 |
| 2 | `BGV12.Timezone` | asset | **Aligned** | type: Text, value: Asia/Dubai, description: Authoritative timezone for 'today' evaluation and schedule alignment. | `Main.xaml` | 184 |
| 3 | `BGV12.FromGmailConnectionName` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: Integration Service Gmail connection name used to send greetings. | `Main.xaml` | 234 |
| 4 | `BGV12.MaxConnectorRetries` | asset | **Aligned** | type: Integer, value: 3, description: Max retries for transient Integration Service connector failures (Calendar/People/Gmail). | `Main.xaml` | 284 |
| 5 | `BGV12.RetryBackoffSeconds` | asset | **Aligned** | type: Integer, value: 10, description: Backoff delay between transient retries. | `Main.xaml` | 334 |
| 6 | `BGV12.SkipOnAmbiguousContactMatch` | asset | **Aligned** | type: Bool, value: true, description: If multiple contacts match the same name, skip to avoid mis-send; log as business exception. | `Main.xaml` | 384 |
| 7 | `BGV12.PreferredEmailLabels` | asset | **Aligned** | type: Text, value: personal,home, description: Comma-separated preferred email labels (case-insensitive). | `Main.xaml` | 434 |
| 8 | `BGV12.SendEnabled` | asset | **Aligned** | type: Bool, value: true, description: Master kill-switch for outbound email sending (when false, generate content but do not send). | `Main.xaml` | 484 |
| 9 | `BGV12.OperationsDL` | asset | **Aligned** | type: Text, value: , description: Optional distribution list to receive failure notifications (left blank as PDD states no notifications). | `Main.xaml` | 534 |
| 10 | `BGV12.GoogleWorkspaceCredential` | credential | **Aligned** | type: Credential, description: Reserved credential asset for break-glass scenarios; primary auth is via Integration Service connections. | `InitAllSettings.xaml` | 104 |
| 11 | `[BGV12.CalendarName]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 178 |
| 12 | `[BGV12.Timezone]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 202 |
| 13 | `[BGV12.FromGmailConnectionName]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 226 |
| 14 | `[BGV12.MaxConnectorRetries]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 250 |
| 15 | `[BGV12.RetryBackoffSeconds]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 282 |
| 16 | `[BGV12.SendEnabled]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 314 |
| 17 | `[BGV12.SkipOnAmbiguousContactMatch]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 346 |
| 18 | `[BGV12.PreferredEmailLabels]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 378 |
| 19 | `[BGV12.OperationsDL]` | asset | **XAML Only** | — | `BirthdayGreetingsV12.xaml` | 402 |
| 20 | `BirthdayGreetingsV12_EmailsToSend` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: Work queue for birthday greeting email dispatch items (one per birthday event/person). Supports retry and controlled execution telemetry. | — | — |

## 9. Queue Management

No queue activities detected in the package.

## 10. Exception Handling Coverage

**Coverage:** 36/55 high-risk activities inside TryCatch (65%)

### Files Without TryCatch

- `InitAllSettings.xaml`
- `CreateRunRecord.xaml`
- `[GetTodayBirthdays.xaml]`
- `[LookupContactEmail.xaml]`
- `[GenerateBirthdayMessage.xaml]`
- `[SendBirthdayEmail.xaml]`
- `[FinalizeRun.xaml]`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `InitAllSettings.xaml:104` | Get BGV12.GoogleWorkspaceCredential |
| 2 | `InitAllSettings.xaml:109` | Get BGV12.CalendarName |
| 3 | `InitAllSettings.xaml:110` | ui:GetAsset |
| 4 | `InitAllSettings.xaml:118` | Get BGV12.Timezone |
| 5 | `InitAllSettings.xaml:119` | ui:GetAsset |
| 6 | `InitAllSettings.xaml:127` | Get BGV12.FromGmailConnectionName |
| 7 | `InitAllSettings.xaml:128` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:136` | Get BGV12.MaxConnectorRetries |
| 9 | `InitAllSettings.xaml:137` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:145` | Get BGV12.RetryBackoffSeconds |
| 11 | `InitAllSettings.xaml:146` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:154` | Get BGV12.SkipOnAmbiguousContactMatch |
| 13 | `InitAllSettings.xaml:155` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:163` | Get BGV12.PreferredEmailLabels |
| 15 | `InitAllSettings.xaml:164` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:172` | Get BGV12.SendEnabled |
| 17 | `InitAllSettings.xaml:173` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:181` | Get BGV12.OperationsDL |
| 19 | `InitAllSettings.xaml:182` | ui:GetAsset |

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
| placeholder-value | warning | 6 | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] |
| undeclared-asset | warning | 9 | Asset "[BGV12.CalendarName]" is referenced in XAML but not declared in orchestrator artifacts |
| hardcoded-asset-name | warning | 19 | Line 134: asset name "&quot;BGV12.CalendarName&quot;" is hardcoded — consider using a Config.xlsx entry or workflow argu... |
| hardcoded-retry-count | warning | 4 | Line 150: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("MaxRetryNumber")) |
| hardcoded-retry-interval | warning | 4 | Line 150: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx |
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
| 14 | Assets | Provision asset: `[BGV12.CalendarName]` | Yes |
| 15 | Assets | Provision asset: `[BGV12.Timezone]` | Yes |
| 16 | Assets | Provision asset: `[BGV12.FromGmailConnectionName]` | Yes |
| 17 | Assets | Provision asset: `[BGV12.MaxConnectorRetries]` | Yes |
| 18 | Assets | Provision asset: `[BGV12.RetryBackoffSeconds]` | Yes |
| 19 | Assets | Provision asset: `[BGV12.SendEnabled]` | Yes |
| 20 | Assets | Provision asset: `[BGV12.SkipOnAmbiguousContactMatch]` | Yes |
| 21 | Assets | Provision asset: `[BGV12.PreferredEmailLabels]` | Yes |
| 22 | Assets | Provision asset: `[BGV12.OperationsDL]` | Yes |
| 23 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 24 | Testing | Run smoke test in target environment | Yes |
| 25 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 26 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 27 | Governance | Peer code review completed | Yes |
| 28 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 29 | Governance | Business process owner validation obtained | Yes |
| 30 | Governance | CoE approval obtained | Yes |
| 31 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Needs Work — 30/50 (60%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 19 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 4/10 | 65% coverage — consider wrapping remaining activities; 7 file(s) with no TryCatch blocks |
| Queue Management | 10/10 | No queue activities — section not applicable |
| Build Quality | 1/10 | 46 quality warnings — significant remediation needed; 8 remediations — stub replacements need developer attention |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 0 |
| Valid activities | 0 |
| Unknown → Comment stubs | 0 |
| Non-catalog properties stripped | 0 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 0 |
| Total issues | 0 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 0 auto-fixed, 0 total issues |
| Post-emission (quality gate) | 54 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "InitAllSettings.xaml",
    "CreateRunRecord.xaml",
    "[GetTodayBirthdays.xaml]",
    "[LookupContactEmail.xaml]",
    "[GenerateBirthdayMessage.xaml]",
    "[SendBirthdayEmail.xaml]",
    "[FinalizeRun.xaml]"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "Main.xaml",
      "description": "Stripped 1 placeholder token(s) from Main.xaml",
      "developerAction": "Review Main.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "GetTodayBirthdays.xaml",
      "description": "Stripped 21 placeholder token(s) from GetTodayBirthdays.xaml",
      "developerAction": "Review GetTodayBirthdays.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "ProcessBirthdayEvent.xaml",
      "description": "Stripped 22 placeholder token(s) from ProcessBirthdayEvent.xaml",
      "developerAction": "Review ProcessBirthdayEvent.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "LookupContactEmail.xaml",
      "description": "Stripped 22 placeholder token(s) from LookupContactEmail.xaml",
      "developerAction": "Review LookupContactEmail.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "GenerateBirthdayMessage.xaml",
      "description": "Stripped 6 placeholder token(s) from GenerateBirthdayMessage.xaml",
      "developerAction": "Review GenerateBirthdayMessage.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "SendBirthdayEmail.xaml",
      "description": "Stripped 9 placeholder token(s) from SendBirthdayEmail.xaml",
      "developerAction": "Review SendBirthdayEmail.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "FinalizeRun.xaml",
      "description": "Stripped 7 placeholder token(s) from FinalizeRun.xaml",
      "developerAction": "Review FinalizeRun.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "CreateRunRecord.xaml",
      "description": "Stripped 1 placeholder token(s) from CreateRunRecord.xaml",
      "developerAction": "Review CreateRunRecord.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "[GetTodayBirthdays.xaml]",
      "description": "Stripped 1 placeholder token(s) from [GetTodayBirthdays.xaml]",
      "developerAction": "Review [GetTodayBirthdays.xaml] for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "[LookupContactEmail.xaml]",
      "description": "Stripped 1 placeholder token(s) from [LookupContactEmail.xaml]",
      "developerAction": "Review [LookupContactEmail.xaml] for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "[GenerateBirthdayMessage.xaml]",
      "description": "Stripped 1 placeholder token(s) from [GenerateBirthdayMessage.xaml]",
      "developerAction": "Review [GenerateBirthdayMessage.xaml] for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "[SendBirthdayEmail.xaml]",
      "description": "Stripped 1 placeholder token(s) from [SendBirthdayEmail.xaml]",
      "developerAction": "Review [SendBirthdayEmail.xaml] for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "[FinalizeRun.xaml]",
      "description": "Stripped 1 placeholder token(s) from [FinalizeRun.xaml]",
      "developerAction": "Review [FinalizeRun.xaml] for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    }
  ],
  "remediations": [
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 74: Undeclared variable \"Asia\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 74: Undeclared variable \"Dubai\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "LookupContactEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 506: Undeclared variable \"preferredLabel\" in expression: String.Equals(str_CurrentLabel, preferredLabel, StringCompar... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in LookupContactEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 95: Undeclared variable \"subject\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 95: Undeclared variable \"body\" in expression: \"Write a short birthday email in my voice: warm, funny, sarc... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 237: Undeclared variable \"caughtEx\" in expression: caughtEx.Message &amp; \" | InnerException: \" &amp; If(caught... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 91: Undeclared variable \"Asia\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "BirthdayGreetingsV12.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 91: Undeclared variable \"Dubai\" in expression: Asia/Dubai — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in BirthdayGreetingsV12.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "Main.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "LookupContactEmail.xaml",
      "detail": "Contains 13 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "FinalizeRun.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.CalendarName]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.Timezone]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.FromGmailConnectionName]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.MaxConnectorRetries]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.RetryBackoffSeconds]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.SendEnabled]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.SkipOnAmbiguousContactMatch]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.PreferredEmailLabels]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"[BGV12.OperationsDL]\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 134: asset name \"&quot;BGV12.CalendarName&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 184: asset name \"&quot;BGV12.Timezone&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 234: asset name \"&quot;BGV12.FromGmailConnectionName&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 284: asset name \"&quot;BGV12.MaxConnectorRetries&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 334: asset name \"&quot;BGV12.RetryBackoffSeconds&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 384: asset name \"&quot;BGV12.SkipOnAmbiguousContactMatch&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 434: asset name \"&quot;BGV12.PreferredEmailLabels&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 484: asset name \"&quot;BGV12.SendEnabled&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 534: asset name \"&quot;BGV12.OperationsDL&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 150: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 241: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 150: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 241: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 115: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "LookupContactEmail.xaml",
      "detail": "Line 115: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 139: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 139: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 104: asset name \"BGV12.GoogleWorkspaceCredential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 109: asset name \"BGV12.CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 118: asset name \"BGV12.Timezone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 127: asset name \"BGV12.FromGmailConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 136: asset name \"BGV12.MaxConnectorRetries\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 145: asset name \"BGV12.RetryBackoffSeconds\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 154: asset name \"BGV12.SkipOnAmbiguousContactMatch\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 163: asset name \"BGV12.PreferredEmailLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 172: asset name \"BGV12.SendEnabled\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 181: asset name \"BGV12.OperationsDL\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
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
      "file": "GetTodayBirthdays.xaml",
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
      "file": "SendBirthdayEmail.xaml",
      "detail": "Post-repair: RetryInterval defaulted to \"00:00:05\" — verify this is appropriate for the workflow context",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 120,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "GetTodayBirthdays.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "ProcessBirthdayEvent.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "LookupContactEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "GenerateBirthdayMessage.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "SendBirthdayEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "FinalizeRun.xaml",
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
    },
    {
      "file": "CreateRunRecord.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "[GetTodayBirthdays.xaml]",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "[LookupContactEmail.xaml]",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "[GenerateBirthdayMessage.xaml]",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "[SendBirthdayEmail.xaml]",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "[FinalizeRun.xaml]",
      "level": "studio-clean",
      "blockers": []
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 0,
    "validActivities": 0,
    "unknownActivities": 0,
    "strippedProperties": 0,
    "enumCorrections": 0,
    "missingRequiredFilled": 0,
    "commentConversions": 0,
    "issueCount": 0
  }
}
```
