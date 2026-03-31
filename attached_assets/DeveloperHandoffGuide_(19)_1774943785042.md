# Developer Handoff Guide

**Project:** BirthdayGreetingsV12
**Generated:** 2026-03-31
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (18%)

**Total Estimated Effort: ~385 minutes (6.4 hours)**
**Remediations:** 37 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 2 workflow)
**Auto-Repairs:** 17
**Quality Warnings:** 142

---

## 1. Completed Work

The following 1 workflow(s) were fully generated without any stub replacements or remediation:

- `InitAllSettings.xaml`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main.xaml` | Generated with Placeholders |
| 2 | `GetTodayBirthdays.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 3 | `Dispatcher.xaml` | Generated with Placeholders |
| 4 | `GenerateBirthdayMessage.xaml` | Structurally invalid — Expression syntax errors that could not be auto-corrected |
| 5 | `SendBirthdayEmail.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 6 | `Performer.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 7 | `Finalize.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 8 | `InitAllSettings.xaml` | Fully Generated |
| 9 | `&quot;Init.xaml&quot;.xaml` | Generated with Placeholders |
| 10 | `&quot;GetTodayBirthdays.xaml&quot;.xaml` | Generated with Placeholders |
| 11 | `&quot;Dispatcher.xaml&quot;.xaml` | Generated with Placeholders |
| 12 | `&quot;Finalize.xaml&quot;.xaml` | Generated with Placeholders |
| 13 | `&quot;LookupContactEmail.xaml&quot;.xaml` | Generated with Placeholders |
| 14 | `&quot;GenerateBirthdayMessage.xaml&quot;.xaml` | Generated with Placeholders |
| 15 | `&quot;SendBirthdayEmail.xaml&quot;.xaml` | Generated with Placeholders |
| 16 | `Init.xaml` | Structurally invalid — Workflow generation failed — LLM output could not be parsed into valid XAML |
| 17 | `LookupContactEmail.xaml` | Structurally invalid — Workflow generation failed — LLM output could not be parsed into valid XAML |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 2 | `GetTodayBirthdays.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 3 | `Dispatcher.xaml` | Openable with warnings | Unclassified | — |
| 4 | `GenerateBirthdayMessage.xaml` | Structurally invalid — not Studio-loadable | Expression Syntax | [EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected |
| 5 | `SendBirthdayEmail.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 6 | `Performer.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 7 | `Finalize.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 8 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 9 | `&quot;Init.xaml&quot;` | Openable with warnings | Unclassified | — |
| 10 | `&quot;GetTodayBirthdays.xaml&quot;` | Openable with warnings | Unclassified | — |
| 11 | `&quot;Dispatcher.xaml&quot;` | Openable with warnings | Unclassified | — |
| 12 | `&quot;Finalize.xaml&quot;` | Openable with warnings | Unclassified | — |
| 13 | `&quot;LookupContactEmail.xaml&quot;` | Openable with warnings | Unclassified | — |
| 14 | `&quot;GenerateBirthdayMessage.xaml&quot;` | Openable with warnings | Unclassified | — |
| 15 | `&quot;SendBirthdayEmail.xaml&quot;` | Openable with warnings | Unclassified | — |
| 16 | `Init.xaml` | Structurally invalid — not Studio-loadable | Generation Failure | [GENERATION-FAILURE] Workflow generation failed — LLM output could not be par... |
| 17 | `LookupContactEmail.xaml` | Structurally invalid — not Studio-loadable | Generation Failure | [GENERATION-FAILURE] Workflow generation failed — LLM output could not be par... |

**Summary:** 1 Studio-loadable, 9 with warnings, 7 not Studio-loadable

> **⚠ 7 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

**Blocked by category:**
- Compliance or quality gate failure requiring manual remediation: 4 workflow(s)
- Expression syntax errors that could not be auto-corrected: 1 workflow(s)
- Workflow generation failed — LLM output could not be parsed into valid XAML: 2 workflow(s)

## 2. AI-Resolved with Smart Defaults

The following 17 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `GetTodayBirthdays.xaml` | Stripped 10 placeholder token(s) from GetTodayBirthdays.xaml | 5 |
| 2 | `REPAIR_PLACEHOLDER_CLEANUP` | `Dispatcher.xaml` | Stripped 4 placeholder token(s) from Dispatcher.xaml | 5 |
| 3 | `REPAIR_PLACEHOLDER_CLEANUP` | `GenerateBirthdayMessage.xaml` | Stripped 1 placeholder token(s) from GenerateBirthdayMessage.xaml | 5 |
| 4 | `REPAIR_PLACEHOLDER_CLEANUP` | `Finalize.xaml` | Stripped 4 placeholder token(s) from Finalize.xaml | 5 |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `GetTodayBirthdays.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in GetTodayBirthdays.xaml | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Dispatcher.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `GenerateBirthdayMessage.xaml` | Catalog: Moved While.Condition from attribute to child-element in GenerateBirthdayMessage.xaml | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Finalize.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in Finalize.xaml | undefined |
| 9 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelApplicationScope.WorkbookPath from attribute to child-element in InitA... | undefined |
| 10 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 11 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved uexcel:ExcelReadRange.DataTable from attribute to child-element in InitAllSettings... | undefined |
| 12 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 13 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 14 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 15 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 16 | `REPAIR_TYPE_MISMATCH` | `GetTodayBirthdays.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |
| 17 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Finalize.xaml` | Changed variable "dt_BirthdayItems" type from scg2:DataTable to System.Collections.Generic.List`1... | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (35)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 2 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 3 | `Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Dispatcher.xaml — estimated 15 min | 15 |
| 4 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 5 | `GenerateBirthdayMessage.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 6 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 7 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 8 | `GenerateBirthdayMessage.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 9 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 10 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 11 | `GenerateBirthdayMessage.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 12 | `GenerateBirthdayMessage.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min | 15 |
| 13 | `SendBirthdayEmail.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min | 15 |
| 14 | `SendBirthdayEmail.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min | 15 |
| 15 | `Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Performer.xaml — estimated 15 min | 15 |
| 16 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 17 | `Finalize.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Finalize.xaml — estimated 15 min | 15 |
| 18 | `GetTodayBirthdays.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min | 15 |
| 19 | `Main.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Main.xaml — use valid enum from UiPath documen... | 5 |
| 20 | `Main.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Main.xaml — use valid enum from UiPath documen... | 5 |
| 21 | `GetTodayBirthdays.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from U... | 5 |
| 22 | `GetTodayBirthdays.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from U... | 5 |
| 23 | `Dispatcher.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath d... | 5 |
| 24 | `Dispatcher.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath d... | 5 |
| 25 | `Dispatcher.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath d... | 5 |
| 26 | `GenerateBirthdayMessage.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum ... | 5 |
| 27 | `GenerateBirthdayMessage.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum ... | 5 |
| 28 | `GenerateBirthdayMessage.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum ... | 5 |
| 29 | `SendBirthdayEmail.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from U... | 5 |
| 30 | `SendBirthdayEmail.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from U... | 5 |
| 31 | `SendBirthdayEmail.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from U... | 5 |
| 32 | `Performer.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Performer.xaml — use valid enum from UiPath do... | 5 |
| 33 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 34 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |
| 35 | `Finalize.xaml` | `ENUM_VIOLATION` | Fix enum value for activity in Finalize.xaml — use valid enum from UiPath doc... | 5 |

### Workflow-Level Stubs (2)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `Init.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | TODO: Implement Loads all Orchestrator assets into a config dictionary, valid... | 15 |
| 2 | `LookupContactEmail.xaml` | `STUB_WORKFLOW_GENERATOR_FAILURE` | TODO: Implement Searches Google Contacts/People connector by FullName (exact ... | 15 |

### Developer Implementation Required (23)

These placeholders represent intentional handoff points where developer implementation is expected.

| # | File | Detail | Est. Minutes |
|---|------|--------|-------------|
| 1 | `Main.xaml` | Contains 2 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 2 | `Main.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 3 | `GetTodayBirthdays.xaml` | Contains 9 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 4 | `GetTodayBirthdays.xaml` | Contains 8 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 5 | `Dispatcher.xaml` | Contains 4 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 6 | `Dispatcher.xaml` | Contains 3 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 7 | `GenerateBirthdayMessage.xaml` | Contains 6 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 8 | `GenerateBirthdayMessage.xaml` | Contains 4 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 9 | `SendBirthdayEmail.xaml` | Contains 6 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 10 | `SendBirthdayEmail.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 11 | `Performer.xaml` | Contains 10 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 12 | `Performer.xaml` | Contains 6 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 13 | `Finalize.xaml` | Contains 5 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 14 | `Finalize.xaml` | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 15 | `&quot;Init.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 16 | `&quot;GetTodayBirthdays.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 17 | `&quot;Dispatcher.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 18 | `&quot;Finalize.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 19 | `&quot;LookupContactEmail.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 20 | `&quot;GenerateBirthdayMessage.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 21 | `&quot;SendBirthdayEmail.xaml&quot;` | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] | 10 |
| 22 | `Init.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |
| 23 | `LookupContactEmail.xaml` | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Implementation Required] | 10 |

### Quality Warnings (119)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Performer.xaml` | potentially-null-dereference | Line 121: "obj_QueueItem.SpecificContent" accessed without visible null guard in scope — verify n... | — | undefined |
| 2 | `Performer.xaml` | potentially-null-dereference | Line 166: "obj_QueueItem.SpecificContent" accessed without visible null guard in scope — verify n... | — | undefined |
| 3 | `Performer.xaml` | potentially-null-dereference | Line 211: "obj_QueueItem.SpecificContent" accessed without visible null guard in scope — verify n... | — | undefined |
| 4 | `Performer.xaml` | potentially-null-dereference | Line 256: "obj_QueueItem.SpecificContent" accessed without visible null guard in scope — verify n... | — | undefined |
| 5 | `Performer.xaml` | potentially-null-dereference | Line 295: "obj_QueueItem.SpecificContent" accessed without visible null guard in scope — verify n... | — | undefined |
| 6 | `GetTodayBirthdays.xaml` | hardcoded-retry-count | Line 203: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 7 | `GetTodayBirthdays.xaml` | hardcoded-retry-count | Line 264: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 8 | `GetTodayBirthdays.xaml` | hardcoded-retry-interval | Line 203: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse Time... | — | undefined |
| 9 | `GetTodayBirthdays.xaml` | hardcoded-retry-interval | Line 264: retry interval hardcoded as "[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse Time... | — | undefined |
| 10 | `Dispatcher.xaml` | hardcoded-queue-name | Line 293: queue name "BirthdayGreetingsV12_EmailsToSend" is hardcoded — consider using a Config.x... | — | undefined |
| 11 | `SendBirthdayEmail.xaml` | hardcoded-retry-count | Line 139: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 12 | `SendBirthdayEmail.xaml` | hardcoded-retry-interval | Line 139: retry interval hardcoded as "[TimeSpan.FromSeconds(in_RetryBackoffSeconds) = True]" — c... | — | undefined |
| 13 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 118: asset name "BGV12.GoogleWorkspaceCredential" is hardcoded — consider using a Config.xls... | — | undefined |
| 14 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 130: asset name "BGV12.CalendarName" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 15 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 139: asset name "BGV12.Timezone" is hardcoded — consider using a Config.xlsx entry or workfl... | — | undefined |
| 16 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 148: asset name "BGV12.FromGmailConnectionName" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 17 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 157: asset name "BGV12.MaxConnectorRetries" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 18 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 166: asset name "BGV12.RetryBackoffSeconds" is hardcoded — consider using a Config.xlsx entr... | — | undefined |
| 19 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 175: asset name "BGV12.SkipOnAmbiguousContactMatch" is hardcoded — consider using a Config.x... | — | undefined |
| 20 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 184: asset name "BGV12.PreferredEmailLabels" is hardcoded — consider using a Config.xlsx ent... | — | undefined |
| 21 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 193: asset name "BGV12.SendEnabled" is hardcoded — consider using a Config.xlsx entry or wor... | — | undefined |
| 22 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 202: asset name "BGV12.OperationsDL" is hardcoded — consider using a Config.xlsx entry or wo... | — | undefined |
| 23 | `Main.xaml` | EXPRESSION_SYNTAX | Line 85: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main]... | — | undefined |
| 24 | `Main.xaml` | EXPRESSION_SYNTAX | Line 85: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Ma... | — | undefined |
| 25 | `Main.xaml` | EXPRESSION_SYNTAX | Line 147: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 26 | `Main.xaml` | EXPRESSION_SYNTAX | Line 147: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 27 | `Main.xaml` | EXPRESSION_SYNTAX | Line 197: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 28 | `Main.xaml` | EXPRESSION_SYNTAX | Line 197: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 29 | `Main.xaml` | EXPRESSION_SYNTAX | Line 246: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 30 | `Main.xaml` | EXPRESSION_SYNTAX | Line 246: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 31 | `Main.xaml` | EXPRESSION_SYNTAX | Line 247: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 32 | `Main.xaml` | EXPRESSION_SYNTAX | Line 247: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 33 | `Main.xaml` | EXPRESSION_SYNTAX | Line 297: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 34 | `Main.xaml` | EXPRESSION_SYNTAX | Line 297: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 35 | `Main.xaml` | EXPRESSION_SYNTAX | Line 298: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main... | — | undefined |
| 36 | `Main.xaml` | EXPRESSION_SYNTAX | Line 298: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][M... | — | undefined |
| 37 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 102: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBir... | — | undefined |
| 38 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 102: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetToday... | — | undefined |
| 39 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 193: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBir... | — | undefined |
| 40 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 193: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetToday... | — | undefined |
| 41 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 263: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBir... | — | undefined |
| 42 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 263: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetToday... | — | undefined |
| 43 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 317: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBir... | — | undefined |
| 44 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 317: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetToday... | — | undefined |
| 45 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 400: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBir... | — | undefined |
| 46 | `GetTodayBirthdays.xaml` | EXPRESSION_SYNTAX | Line 400: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetToday... | — | undefined |
| 47 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 117: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 48 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 117: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 49 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 167: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 50 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 167: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 51 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 175: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 52 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 175: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 53 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 266: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 54 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 266: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 55 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 333: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 56 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 333: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 57 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 350: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 58 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 350: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 59 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 403: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 60 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 403: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 61 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 404: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Disp... | — | undefined |
| 62 | `Dispatcher.xaml` | EXPRESSION_SYNTAX | Line 404: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][D... | — | undefined |
| 63 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 95: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirt... | — | undefined |
| 64 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 95: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateB... | — | undefined |
| 65 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 146: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBir... | — | undefined |
| 66 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 146: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Generate... | — | undefined |
| 67 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 210: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBir... | — | undefined |
| 68 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 210: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Generate... | — | undefined |
| 69 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 257: C# $"..." string interpolation should use String.Format() in expression: System.Text.Re... | — | undefined |
| 70 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 434: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBir... | — | undefined |
| 71 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 434: Double-encoded '&amp;gt;' corrected to '&gt;' in expression: &amp;quot;[GenerateBirthda... | — | undefined |
| 72 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 434: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Generate... | — | undefined |
| 73 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 466: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: If(bool_ValidationPass... | — | undefined |
| 74 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 466: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBir... | — | undefined |
| 75 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 466: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Generate... | — | undefined |
| 76 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 467: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBir... | — | undefined |
| 77 | `GenerateBirthdayMessage.xaml` | EXPRESSION_SYNTAX | Line 467: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Generate... | — | undefined |
| 78 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 82: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthday... | — | undefined |
| 79 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 82: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEm... | — | undefined |
| 80 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 121: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 81 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 121: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 82 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 155: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 83 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 155: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 84 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 234: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 85 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 234: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 86 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 237: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 87 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 237: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 88 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 245: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 89 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 245: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 90 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 267: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthda... | — | undefined |
| 91 | `SendBirthdayEmail.xaml` | EXPRESSION_SYNTAX | Line 267: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayE... | — | undefined |
| 92 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 306: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Perf... | — | undefined |
| 93 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 306: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][P... | — | undefined |
| 94 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 375: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Perf... | — | undefined |
| 95 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 375: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][P... | — | undefined |
| 96 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 405: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Perf... | — | undefined |
| 97 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 405: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][P... | — | undefined |
| 98 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 467: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Perf... | — | undefined |
| 99 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 467: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][P... | — | undefined |
| 100 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 536: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Perf... | — | undefined |
| 101 | `Performer.xaml` | EXPRESSION_SYNTAX | Line 536: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][P... | — | undefined |
| 102 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 100: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] S... | — | undefined |
| 103 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 100: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 104 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 163: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] R... | — | undefined |
| 105 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 163: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 106 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 237: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] U... | — | undefined |
| 107 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 237: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 108 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 238: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] A... | — | undefined |
| 109 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 238: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 110 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 277: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] R... | — | undefined |
| 111 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 277: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 112 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 333: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] B... | — | undefined |
| 113 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 333: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 114 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 377: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] S... | — | undefined |
| 115 | `Finalize.xaml` | EXPRESSION_SYNTAX | Line 377: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize... | — | undefined |
| 116 | `Finalize.xaml` | TYPE_MISMATCH | Line 131: Auto-repaired — changed variable "dt_BirthdayItems" type from scg2:DataTable to System.... | — | undefined |
| 117 | `GetTodayBirthdays.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSe... | — | undefined |
| 118 | `GetTodayBirthdays.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSe... | — | undefined |
| 119 | `SendBirthdayEmail.xaml` | RETRY_INTERVAL_EXPRESSION_WRAPPED | Post-repair: RetryInterval="[TimeSpan.FromSeconds(in_RetryBackoffSeconds) = True]" was bracket-wr... | — | undefined |

**Total manual remediation effort: ~385 minutes (6.4 hours)**

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
| 5 | `UiPath.Web.Activities` |
| 6 | `UiPath.ComplexScenarios.Activities` |
| 7 | `UiPath.DataService.Activities` |

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
| 12 | `&quot;BirthdayGreetingsV12_EmailsToSend&quot;` | queue | **XAML Only** | — | `Dispatcher.xaml` | 295 |

## 9. Queue Management

**Pattern:** Queue usage (non-transactional)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `&quot;BirthdayGreetingsV12_EmailsToSend&quot;` | AddQueueItem | Optional | No | — | Create in Orchestrator |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BirthdayGreetingsV12_EmailsToSend` | Yes | 2x | — | Defined in SDD but no matching XAML activity — verify implementation |

### Queue Activity Summary

| Capability | Present |
|---|---|
| Add Queue Item | Yes |
| Get Transaction Item | No |
| Set Transaction Status | No |

### Retry Policy

Dispatcher pattern only — retry policies apply to the consumer process, not the dispatcher

### SLA Guidance

Monitor queue growth rate and dispatcher throughput. Set alerts for queue item age exceeding business SLA.

### Dead-Letter / Failed Items Handling

No dead-letter handling applicable — process does not consume queue items.

## 10. Exception Handling Coverage

**Coverage:** 1/22 high-risk activities inside TryCatch (5%)

### Files Without TryCatch

- `InitAllSettings.xaml`
- `&quot;Init.xaml&quot;`
- `&quot;GetTodayBirthdays.xaml&quot;`
- `&quot;Dispatcher.xaml&quot;`
- `&quot;Finalize.xaml&quot;`
- `&quot;LookupContactEmail.xaml&quot;`
- `&quot;GenerateBirthdayMessage.xaml&quot;`
- `&quot;SendBirthdayEmail.xaml&quot;`
- `Init.xaml`
- `LookupContactEmail.xaml`

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
| undefined | warning | 142 |  |

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

**Overall: Not Ready — 26/50 (18%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 10 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 2/10 | Only 5% of high-risk activities covered by TryCatch; 10 file(s) with no TryCatch blocks |
| Queue Management | 9/10 | 1 hardcoded queue name(s) — externalize to config |
| Build Quality | 0/10 | 142 quality warnings — significant remediation needed; 37 remediations — stub replacements need developer attention; 10/17 workflow(s) are Studio-loadable (7 blocked — 41% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 265 |
| Valid activities | 252 |
| Unknown → Comment stubs | 13 |
| Non-catalog properties stripped | 92 |
| Enum values auto-corrected | 0 |
| Missing required props filled | 21 |
| Total issues | 70 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 126 auto-fixed, 70 total issues |
| Post-emission (quality gate) | 179 warnings/remediations |

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
      "file": "GetTodayBirthdays.xaml",
      "description": "Stripped 10 placeholder token(s) from GetTodayBirthdays.xaml",
      "developerAction": "Review GetTodayBirthdays.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "Dispatcher.xaml",
      "description": "Stripped 4 placeholder token(s) from Dispatcher.xaml",
      "developerAction": "Review Dispatcher.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "GenerateBirthdayMessage.xaml",
      "description": "Stripped 1 placeholder token(s) from GenerateBirthdayMessage.xaml",
      "developerAction": "Review GenerateBirthdayMessage.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "Finalize.xaml",
      "description": "Stripped 4 placeholder token(s) from Finalize.xaml",
      "developerAction": "Review Finalize.xaml for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in GetTodayBirthdays.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Dispatcher.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in Dispatcher.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in GenerateBirthdayMessage.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Finalize.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in Finalize.xaml"
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
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Finalize.xaml",
      "description": "Changed variable \"dt_BirthdayItems\" type from scg2:DataTable to System.Collections.Generic.List`1[UiPath.DataService.DataServiceEntity] to match uds:QueryEntity.Result output type"
    }
  ],
  "remediations": [
    {
      "level": "workflow",
      "file": "Init.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — Tree assembly failed — assetName.startsWith is not a function",
      "classifiedCheck": "compliance-crash",
      "developerAction": "TODO: Implement Loads all Orchestrator assets into a config dictionary, validates connectivity prerequisites, initialises the BirthdayGreetingRun Data Service record with status Running, and returns the run-level context (RunId, today's Dubai date, config map) to the caller. Inline TryCatch handles asset-not-found and Data Service write failures with fast-fail semantics.",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "LookupContactEmail.xaml",
      "remediationCode": "STUB_WORKFLOW_GENERATOR_FAILURE",
      "reason": "Compliance transform failed — Tree assembly failed — [HttpClient] Activity \"Invoke Integration Service: Search Google Contacts/People by display name\" is missing a required Endpoint/URL property — cannot emit HttpClient without a valid endpoint.",
      "classifiedCheck": "compliance-crash",
      "developerAction": "TODO: Implement Searches Google Contacts/People connector by FullName (exact display-name match). Applies email label preference (Personal > Home > first available). Returns the selected email address and label, plus a ContactMatchStatus enum-string (Matched/NotFound/Ambiguous). Inline RetryScope handles transient connector failures. Ambiguous multi-match result is handled as a BusinessRuleException and returns status Ambiguous with empty email. Reused by both Performer and any future test harness workflows.",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 239: Undeclared variable \"currentEventRow\" in expression: currentEventRow(\"EventId\").ToString().Trim() = True — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 247: Undeclared variable \"currentEventRow\" in expression: currentEventRow(\"FullName\").ToString().Trim() = True — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 255: Undeclared variable \"currentEventRow\" in expression: currentEventRow(\"EventStartDubai\").ToString().Trim() = True — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 101: Undeclared variable \"c\" in expression: If(in_FullName.Contains(\" \"), in_FullName.Split(\" \"c)(0).Tri... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 109: .ToString() expects 0-1 argument(s) but got 2 in expression: in_TodayDubai.ToString(\"MMMM d, yyyy\") = True",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 210: Undeclared variable \"genAIEx\" in expression: &amp;quot;[GenerateBirthdayMessage] GenAI Generate Text FAIL... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 216: Undeclared variable \"genAIEx\" in expression: \"GenAI attempt \" &amp; int_AttemptCount.ToString() &amp; \" f... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 257: .Replace() expects 2 argument(s) but got 4 in expression: System.Text.RegularExpressions.Regex.Replace(str_RawGenAIResponse.Trim(), \"^```(...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 434: Undeclared variable \"parseEx\" in expression: &amp;quot;[GenerateBirthdayMessage] JSON parse FAILED on att... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 440: Undeclared variable \"parseEx\" in expression: \"JSON parse attempt \" &amp; int_AttemptCount.ToString() &amp... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 455: .Split() expects 1-3 argument(s) but got 4 in expression: If(String.IsNullOrWhiteSpace(str_ParsedBody), 0, str_ParsedBody.Split(New Char()...",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 455: Undeclared variable \"c\" in expression: If(String.IsNullOrWhiteSpace(str_ParsedBody), 0, str_ParsedB... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in GenerateBirthdayMessage.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 77: Undeclared variable \"ninemush\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 77: Undeclared variable \"gmail\" in expression: ninemush@gmail.com — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in SendBirthdayEmail.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 402: Undeclared variable \"c\" in expression: If(str_RecipientEmail.Contains(\"@\"), str_RecipientEmail.Subs... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 93: Undeclared variable \"run\" in expression: run-summary.json — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 93: Undeclared variable \"summary\" in expression: run-summary.json — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Finalize.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 326: Type mismatch — variable \"obj_RawEventsList\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in GetTodayBirthdays.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Info&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Main.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Error&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Main.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Info&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GetTodayBirthdays.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Debug&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GetTodayBirthdays.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Information&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Normal&quot;\" for \"Priority\" on ui:AddQueueItem — valid values: Low, Normal, High. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Warning&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Dispatcher.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Information&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Warning&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "GenerateBirthdayMessage.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"[If(bool_ValidationPassed, &amp;quot;Information&amp;quot;, &amp;quot;Warning&amp;quot;) = True]\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in GenerateBirthdayMessage.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Information&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Warning&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "SendBirthdayEmail.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Error&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in SendBirthdayEmail.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Information&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Performer.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Information&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Finalize.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Warning&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
      "classifiedCheck": "ENUM_VIOLATION",
      "developerAction": "Fix enum value for activity in Finalize.xaml — use valid enum from UiPath documentation",
      "estimatedEffortMinutes": 5
    },
    {
      "level": "validation-finding",
      "file": "Finalize.xaml",
      "remediationCode": "STUB_ACTIVITY_CATALOG_VIOLATION",
      "reason": "ENUM_VIOLATION: Invalid value \"&quot;Error&quot;\" for \"Level\" on ui:LogMessage — valid values: Trace, Info, Warn, Error, Fatal. This is a generation failure — enum violations must not be auto-corrected.",
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
      "file": "GetTodayBirthdays.xaml",
      "detail": "Contains 9 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Contains 8 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
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
      "detail": "Contains 3 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
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
      "detail": "Contains 6 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
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
      "file": "Performer.xaml",
      "detail": "Contains 10 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "Performer.xaml",
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
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;Init.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;GetTodayBirthdays.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;Dispatcher.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;Finalize.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;LookupContactEmail.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;GenerateBirthdayMessage.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;SendBirthdayEmail.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
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
      "check": "placeholder-value",
      "file": "LookupContactEmail.xaml",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 121: \"obj_QueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 166: \"obj_QueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 211: \"obj_QueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 256: \"obj_QueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Performer.xaml",
      "detail": "Line 295: \"obj_QueueItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 203: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 264: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 203: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSeconds(10)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 264: retry interval hardcoded as \"[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSeconds(10)]\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Dispatcher.xaml",
      "detail": "Line 293: queue name \"BirthdayGreetingsV12_EmailsToSend\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
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
      "detail": "Line 139: retry interval hardcoded as \"[TimeSpan.FromSeconds(in_RetryBackoffSeconds) = True]\" — consider externalizing to Config.xlsx",
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
      "file": "Main.xaml",
      "detail": "Line 85: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] Dispatcher process started. JobStartUtc=&amp;quot; + dt_...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 85: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] Dispatcher process started. JobStartUtc=&amp;quot; + dt_...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 147: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] Init completed. RunId=&amp;quot; + str_RunId + &amp;quot...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 147: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] Init completed. RunId=&amp;quot; + str_RunId + &amp;quot...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 197: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] Google Calendar query complete. RunId=&amp;quot; + str_R...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 197: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] Google Calendar query complete. RunId=&amp;quot; + str_R...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 246: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] Dispatcher completed. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 246: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] Dispatcher completed. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 247: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] No birthday events found for today in Dubai timezone. Ru...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 247: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] No birthday events found for today in Dubai timezone. Ru...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 297: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] Dispatcher run completed. RunId=&amp;quot; + str_RunId +...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 297: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] Dispatcher run completed. RunId=&amp;quot; + str_RunId +...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 298: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Main] UNHANDLED SYSTEM EXCEPTION. RunId=&amp;quot; + str_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Main.xaml",
      "detail": "Line 298: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Main] UNHANDLED SYSTEM EXCEPTION. RunId=&amp;quot; + str_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 102: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBirthdays] Starting. TodayDubai=&amp;quot; OrElse in_TodayDub...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 102: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetTodayBirthdays] Starting. TodayDubai=&amp;quot; OrElse in_TodayDub...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 193: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBirthdays] UTC query window: TimeMin=&amp;quot; OrElse dt_Tod...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 193: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetTodayBirthdays] UTC query window: TimeMin=&amp;quot; OrElse dt_Tod...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 263: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBirthdays] Resolved str_CalendarId=&amp;quot; OrElse str_Cale...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 263: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetTodayBirthdays] Resolved str_CalendarId=&amp;quot; OrElse str_Cale...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 317: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBirthdays] Google Calendar returned &amp;quot; OrElse int_Eve...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 317: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetTodayBirthdays] Google Calendar returned &amp;quot; OrElse int_Eve...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 400: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GetTodayBirthdays] EventId=&amp;quot; OrElse str_CurrentEventId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Line 400: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GetTodayBirthdays] EventId=&amp;quot; OrElse str_CurrentEventId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 117: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] Init completed. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 117: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] Init completed. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 167: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] RunId=&amp;quot; + str_RunId + &amp;quot;; TodayDu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 167: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] RunId=&amp;quot; + str_RunId + &amp;quot;; TodayDu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 175: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] RunId=&amp;quot; + str_RunId + &amp;quot;; No birt...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 175: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] RunId=&amp;quot; + str_RunId + &amp;quot;; No birt...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 266: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] Enqueuing item. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 266: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] Enqueuing item. RunId=&amp;quot; + str_RunId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 333: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] WARN: Failed to enqueue queue item. RunId=&amp;quo...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 333: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] WARN: Failed to enqueue queue item. RunId=&amp;quo...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 350: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] Enqueue loop completed. RunId=&amp;quot; + str_Run...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 350: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] Enqueue loop completed. RunId=&amp;quot; + str_Run...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 403: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] WARN: &amp;quot; + int_QueueItemsFailedCount.ToStr...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 403: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] WARN: &amp;quot; + int_QueueItemsFailedCount.ToStr...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 404: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Dispatcher] Dispatcher completed. RunId=&amp;quot; + str_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Dispatcher.xaml",
      "detail": "Line 404: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Dispatcher] Dispatcher completed. RunId=&amp;quot; + str_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 95: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] START — FullName=&apos;&amp;quot; + in_FullN...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 95: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] START — FullName=&apos;&amp;quot; + in_FullN...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 146: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] GenAI attempt &amp;quot; + int_AttemptCount....",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 146: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] GenAI attempt &amp;quot; + int_AttemptCount....",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 210: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] GenAI Generate Text FAILED on attempt &amp;q...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 210: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] GenAI Generate Text FAILED on attempt &amp;q...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 257: C# $\"...\" string interpolation should use String.Format() in expression: System.Text.RegularExpressions.Regex.Replace(str_RawGenAIResponse.Trim(), \"^```(...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 434: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] JSON parse FAILED on attempt &amp;quot; + in...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 434: Double-encoded '&amp;gt;' corrected to '&gt;' in expression: &amp;quot;[GenerateBirthdayMessage] JSON parse FAILED on attempt &amp;quot; + in...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 434: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] JSON parse FAILED on attempt &amp;quot; + in...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 466: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: If(bool_ValidationPassed, &amp;quot;Information&amp;quot;, &amp;quot;Warning&amp...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 466: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] Validation &amp;quot; + If(bool_ValidationPa...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 466: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] Validation &amp;quot; + If(bool_ValidationPa...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 467: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[GenerateBirthdayMessage] Generation loop exited. AttemptCount=&amp;qu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "GenerateBirthdayMessage.xaml",
      "detail": "Line 467: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[GenerateBirthdayMessage] Generation loop exited. AttemptCount=&amp;qu...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 82: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] ENTER | Recipient=&amp;quot; &amp;amp; in_Recipien...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 82: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] ENTER | Recipient=&amp;quot; &amp;amp; in_Recipien...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 121: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] KILL-SWITCH ACTIVE (BGV12.SendEnabled=False) — ema...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 121: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] KILL-SWITCH ACTIVE (BGV12.SendEnabled=False) — ema...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 155: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] Attempting Gmail send | Attempt=&amp;quot; &amp;am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 155: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] Attempting Gmail send | Attempt=&amp;quot; &amp;am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 234: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] Gmail connector failure on attempt &amp;quot; &amp...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 234: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] Gmail connector failure on attempt &amp;quot; &amp...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 237: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] Email SENT successfully | Attempt=&amp;quot; &amp;...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 237: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] Email SENT successfully | Attempt=&amp;quot; &amp;...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 245: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] FAILED after all retries | To=&amp;quot; &amp;amp;...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 245: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] FAILED after all retries | To=&amp;quot; &amp;amp;...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 267: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[SendBirthdayEmail] EXIT | To=&amp;quot; &amp;amp; in_RecipientEmail &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Line 267: Double-encoded '&amp;amp;' corrected to '&amp;' in expression: &amp;quot;[SendBirthdayEmail] EXIT | To=&amp;quot; &amp;amp; in_RecipientEmail &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 306: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Performer] Dequeued item — ItemId: &amp;quot; + str_ItemId + &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 306: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Performer] Dequeued item — ItemId: &amp;quot; + str_ItemId + &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 375: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Performer] Contact lookup result — ItemId: &amp;quot; + str_It...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 375: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Performer] Contact lookup result — ItemId: &amp;quot; + str_It...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 405: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Performer] Contact resolved — proceeding to GenAI generation. ...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 405: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Performer] Contact resolved — proceeding to GenAI generation. ...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 467: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Performer] GenAI generation result — ItemId: &amp;quot; + str_...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 467: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Performer] GenAI generation result — ItemId: &amp;quot; + str_...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 536: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[BGV12][Performer] Send result — ItemId: &amp;quot; + str_ItemId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Performer.xaml",
      "detail": "Line 536: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[BGV12][Performer] Send result — ItemId: &amp;quot; + str_ItemId + &am...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 100: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Starting finalization for RunId=&apos;&amp;quot; + in_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 100: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Starting finalization for RunId=&apos;&amp;quot; + in_RunId...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 163: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Retrieved &amp;quot; + If(dt_BirthdayItems IsNot Nothing, d...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 163: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Retrieved &amp;quot; + If(dt_BirthdayItems IsNot Nothing, d...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 237: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Unrecognised SendStatus=&apos;&amp;quot; + str_CurrentSendS...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 237: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Unrecognised SendStatus=&apos;&amp;quot; + str_CurrentSendS...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 238: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Aggregated counts for RunId=&apos;&amp;quot; + in_RunId + &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 238: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Aggregated counts for RunId=&apos;&amp;quot; + in_RunId + &...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 277: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Resolved final status=&apos;&amp;quot; + str_ResolvedFinalS...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 277: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Resolved final status=&apos;&amp;quot; + str_ResolvedFinalS...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 333: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] BirthdayGreetingRun record updated successfully for RunId=&...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 333: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] BirthdayGreetingRun record updated successfully for RunId=&...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 377: Double-encoded '&amp;quot;' corrected to '&quot;' in expression: &amp;quot;[Finalize] Storage bucket upload failed for artifact=&apos;&amp;quot; ...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "Finalize.xaml",
      "detail": "Line 377: C# '+' for string concatenation should be VB.NET '&' in expression: &amp;quot;[Finalize] Storage bucket upload failed for artifact=&apos;&amp;quot; ...",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Finalize.xaml",
      "detail": "Line 131: Auto-repaired — changed variable \"dt_BirthdayItems\" type from scg2:DataTable to System.Collections.Generic.List`1[UiPath.DataService.DataServiceEntity] to match uds:QueryEntity.Result (System.Collections.Generic.List`1[UiPath.DataService.DataServiceEntity])",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSeconds(10)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "GetTodayBirthdays.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(int_RetryBackoffSeconds) OrElse TimeSpan.FromSeconds(10)]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    },
    {
      "check": "RETRY_INTERVAL_EXPRESSION_WRAPPED",
      "file": "SendBirthdayEmail.xaml",
      "detail": "Post-repair: RetryInterval=\"[TimeSpan.FromSeconds(in_RetryBackoffSeconds) = True]\" was bracket-wrapped from a variable/expression — verify the referenced variable is declared",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 385,
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
      "file": "Dispatcher.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "GenerateBirthdayMessage.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected"
      ],
      "failureCategory": "expression-syntax",
      "failureSummary": "Expression syntax errors that could not be auto-corrected"
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
      "file": "Performer.xaml",
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
      "file": "InitAllSettings.xaml",
      "level": "studio-clean",
      "blockers": []
    },
    {
      "file": "&quot;Init.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;GetTodayBirthdays.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;Dispatcher.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;Finalize.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;LookupContactEmail.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;GenerateBirthdayMessage.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "&quot;SendBirthdayEmail.xaml&quot;",
      "level": "studio-warnings",
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
    },
    {
      "file": "LookupContactEmail.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[GENERATION-FAILURE] Workflow generation failed — LLM output could not be parsed into valid XAML"
      ],
      "failureCategory": "generation-failure",
      "failureSummary": "Workflow generation failed — LLM output could not be parsed into valid XAML"
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 265,
    "validActivities": 252,
    "unknownActivities": 13,
    "strippedProperties": 92,
    "enumCorrections": 0,
    "missingRequiredFilled": 21,
    "commentConversions": 13,
    "issueCount": 70
  }
}
```
