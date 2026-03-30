# Developer Handoff Guide

**Project:** BirthdayGreetingsV11
**Generated:** 2026-03-30
**Generation Mode:** Full Implementation
**Deployment Readiness:** Not Ready (19%)

**Total Estimated Effort: ~465 minutes (7.8 hours)**
**Remediations:** 31 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 1 workflow)
**Auto-Repairs:** 69
**Quality Warnings:** 138

---

## 1. Completed Work

The following 8 workflow(s) were fully generated without any stub replacements or remediation:

- `CalendarReader.xaml`
- `Main.xaml`
- `GetTransactionData.xaml`
- `SetTransactionStatus.xaml`
- `CloseAllApplications.xaml`
- `KillAllProcesses.xaml`
- `Process.xaml`
- `&quot;CalendarReader.xaml&quot;`

### Workflow Inventory

| # | Workflow | Status |
|---|----------|--------|
| 1 | `Main_Dispatcher.xaml` | Structurally invalid (not Studio-loadable) |
| 2 | `CalendarReader.xaml` | Fully Generated |
| 3 | `Main_Performer.xaml` | Structurally invalid (not Studio-loadable) |
| 4 | `ContactResolver.xaml` | Structurally invalid — Expression syntax errors that could not be auto-corrected |
| 5 | `MessageComposer.xaml` | Structurally invalid — XML well-formedness failure in tree assembler |
| 6 | `EmailSender.xaml` | Structurally invalid — Compliance or quality gate failure requiring manual remediation |
| 7 | `InitAllSettings.xaml` | Generated with Remediations |
| 8 | `Main.xaml` | Fully Generated |
| 9 | `GetTransactionData.xaml` | Fully Generated |
| 10 | `SetTransactionStatus.xaml` | Fully Generated |
| 11 | `CloseAllApplications.xaml` | Fully Generated |
| 12 | `KillAllProcesses.xaml` | Fully Generated |
| 13 | `Process.xaml` | Fully Generated |
| 14 | `&quot;CalendarReader.xaml&quot;.xaml` | Fully Generated |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main_Dispatcher.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [undeclared-variable] Line 138: variable "str_AssetValue" is used in expressi...; [undeclared-variable] Line 188: variable "str_AssetValue" is used in expressi...; [undeclared-variable] Line 238: variable "str_AssetValue" is used in expressi... |
| 2 | `CalendarReader.xaml` | Openable with warnings | Unclassified | — |
| 3 | `Main_Performer.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [undeclared-variable] Line 125: variable "str_AssetValue" is used in expressi...; [undeclared-variable] Line 167: variable "str_AssetValue" is used in expressi...; [undeclared-variable] Line 209: variable "str_AssetValue" is used in expressi... |
| 4 | `ContactResolver.xaml` | Structurally invalid — not Studio-loadable | Expression Syntax | [EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected |
| 5 | `MessageComposer.xaml` | Structurally invalid — not Studio-loadable | Xml Wellformedness | [XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler |
| 6 | `EmailSender.xaml` | Structurally invalid — not Studio-loadable | Compliance Failure | [COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual reme... |
| 7 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 8 | `Main.xaml` | Openable with warnings | Unclassified | — |
| 9 | `GetTransactionData.xaml` | Studio-openable | — | — |
| 10 | `SetTransactionStatus.xaml` | Studio-openable | — | — |
| 11 | `CloseAllApplications.xaml` | Studio-openable | — | — |
| 12 | `KillAllProcesses.xaml` | Studio-openable | — | — |
| 13 | `Process.xaml` | Studio-openable | — | — |
| 14 | `&quot;CalendarReader.xaml&quot;` | Openable with warnings | Unclassified | — |

**Summary:** 6 Studio-loadable, 3 with warnings, 5 not Studio-loadable

> **⚠ 5 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

**Blocked by category:**
- Unknown: 2 workflow(s)
- Expression syntax errors that could not be auto-corrected: 1 workflow(s)
- XML well-formedness failure in tree assembler: 1 workflow(s)
- Compliance or quality gate failure requiring manual remediation: 1 workflow(s)

## 2. AI-Resolved with Smart Defaults

The following 69 issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes |
|---|------|------|-------------|-------------|
| 1 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `Main_Performer.xaml` | Catalog: Moved While.Condition from attribute to child-element in Main_Performer.xaml | undefined |
| 2 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `ContactResolver.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in ContactResolver.xaml | undefined |
| 3 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `ContactResolver.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in ContactResolver.xaml | undefined |
| 4 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 5 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Username from attribute to child-element in InitAllSettings.xaml | undefined |
| 6 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ui:GetCredential.Password from attribute to child-element in InitAllSettings.xaml | undefined |
| 7 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `InitAllSettings.xaml` | Catalog: Moved ForEach.Values from attribute to child-element in InitAllSettings.xaml | undefined |
| 8 | `REPAIR_CATALOG_PROPERTY_SYNTAX` | `GetTransactionData.xaml` | Catalog: Moved ui:GetTransactionItem.TransactionItem from attribute to child-element in GetTransa... | undefined |
| 9 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "dt_RunStartTimeUtc" type from s:DateTime to x:Object to match Assign.To output ... | undefined |
| 10 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_CalendarName" type from x:String to x:Object to match Assign.To output type | undefined |
| 11 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_SenderEmail" type from x:String to x:Object to match Assign.To output type | undefined |
| 12 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_EmailSubjectTemplate" type from x:String to x:Object to match Assign.To out... | undefined |
| 13 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_ConfigTimezone" type from x:String to x:Object to match Assign.To output type | undefined |
| 14 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_EmailLabelPrimary" type from x:String to x:Object to match Assign.To output... | undefined |
| 15 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_EmailLabelFallback" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 16 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "bool_SafetyGateEnabled" type from x:Boolean to x:Object to match Assign.To outp... | undefined |
| 17 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "int_SafetyGateMaxBodyChars" type from x:Int32 to x:Object to match Assign.To ou... | undefined |
| 18 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_GenAiTemperature" type from x:String to x:Object to match Assign.To output ... | undefined |
| 19 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "int_GenAiMaxTokens" type from x:Int32 to x:Object to match Assign.To output type | undefined |
| 20 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_OrchestratorFolder" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 21 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "dict_ConfigDictionary" type from scg:Dictionary(x:String, x:Object) to x:Object... | undefined |
| 22 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "dt_RunDateLocal" type from s:DateTime to x:Object to match Assign.To output type | undefined |
| 23 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Dispatcher.xaml` | Changed variable "str_RunDateString" type from x:String to x:Object to match Assign.To output type | undefined |
| 24 | `REPAIR_TYPE_VARIABLE_CHANGE` | `CalendarReader.xaml` | Changed variable "dt_BirthdayEventsTable" type from scg2:DataTable to x:Object to match Assign.To... | undefined |
| 25 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "dict_ConfigDict" type from scg:Dictionary(x:String, x:Object) to x:Object to ma... | undefined |
| 26 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "bool_IsInitialized" type from x:Boolean to x:Object to match Assign.To output type | undefined |
| 27 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_PerformerRunId" type from x:String to x:Object to match Assign.To output type | undefined |
| 28 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_TransactionReference" type from x:String to x:Object to match Assign.To out... | undefined |
| 29 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_QueueItemId" type from x:String to x:Object to match Assign.To output type | undefined |
| 30 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "dict_SpecificContent" type from scg:Dictionary(x:String, x:Object) to x:Object ... | undefined |
| 31 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_FullName" type from x:String to x:Object to match Assign.To output type | undefined |
| 32 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_RunDate" type from x:String to x:Object to match Assign.To output type | undefined |
| 33 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_CalendarEventId" type from x:String to x:Object to match Assign.To output type | undefined |
| 34 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_Tone" type from x:String to x:Object to match Assign.To output type | undefined |
| 35 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_FirstName" type from x:String to x:Object to match Assign.To output type | undefined |
| 36 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_ResolvedEmail" type from x:String to x:Object to match Assign.To output type | undefined |
| 37 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_EmailLabelUsed" type from x:String to x:Object to match Assign.To output type | undefined |
| 38 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_ComposedSubject" type from x:String to x:Object to match Assign.To output type | undefined |
| 39 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_ComposedBody" type from x:String to x:Object to match Assign.To output type | undefined |
| 40 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_ItemOutcome" type from x:String to x:Object to match Assign.To output type | undefined |
| 41 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main_Performer.xaml` | Changed variable "str_ItemOutcomeReason" type from x:String to x:Object to match Assign.To output... | undefined |
| 42 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_NormalizedFullName" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 43 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_ResolvedFirstName" type from x:String to x:Object to match Assign.To output... | undefined |
| 44 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "bool_ContactFound" type from x:Boolean to x:Object to match Assign.To output type | undefined |
| 45 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_PrimaryEmailFound" type from x:String to x:Object to match Assign.To output... | undefined |
| 46 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_FallbackEmailFound" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 47 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "bool_EmailSelectionDone" type from x:Boolean to x:Object to match Assign.To out... | undefined |
| 48 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_SingleEmailLabel" type from x:String to x:Object to match Assign.To output ... | undefined |
| 49 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_SingleEmailValue" type from x:String to x:Object to match Assign.To output ... | undefined |
| 50 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_ResolvedEmail" type from x:String to x:Object to match Assign.To output type | undefined |
| 51 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_ResolvedLabel" type from x:String to x:Object to match Assign.To output type | undefined |
| 52 | `REPAIR_TYPE_VARIABLE_CHANGE` | `ContactResolver.xaml` | Changed variable "str_ExceptionMessage" type from x:String to x:Object to match Assign.To output ... | undefined |
| 53 | `REPAIR_TYPE_MISMATCH` | `ContactResolver.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |
| 54 | `REPAIR_TYPE_MISMATCH` | `ContactResolver.xaml` | Object variable is bound to a property expecting IEnumerable — retype the variable to the correct... | undefined |
| 55 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "str_ResolvedFirstName" type from x:String to x:Object to match Assign.To output... | undefined |
| 56 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "str_PromptText" type from x:String to x:Object to match Assign.To output type | undefined |
| 57 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "int_AttemptCount" type from x:Int32 to x:Object to match Assign.To output type | undefined |
| 58 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "bool_GenAIRateLimitHit" type from x:Boolean to x:Object to match Assign.To outp... | undefined |
| 59 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "str_ParsedBodyText" type from x:String to x:Object to match Assign.To output type | undefined |
| 60 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "str_ParsedSafetyStatus" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 61 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "str_ParsedSafetyReason" type from x:String to x:Object to match Assign.To outpu... | undefined |
| 62 | `REPAIR_TYPE_VARIABLE_CHANGE` | `MessageComposer.xaml` | Changed variable "bool_ParseErrorOccurred" type from x:Boolean to x:Object to match Assign.To out... | undefined |
| 63 | `REPAIR_TYPE_VARIABLE_CHANGE` | `EmailSender.xaml` | Changed variable "str_RecipientEmailNormalized" type from x:String to x:Object to match Assign.To... | undefined |
| 64 | `REPAIR_TYPE_VARIABLE_CHANGE` | `EmailSender.xaml` | Changed variable "int_SendAttemptNumber" type from x:Int32 to x:Object to match Assign.To output ... | undefined |
| 65 | `REPAIR_TYPE_VARIABLE_CHANGE` | `EmailSender.xaml` | Changed variable "dt_SentTimestampUtc" type from s:DateTime to x:Object to match Assign.To output... | undefined |
| 66 | `REPAIR_TYPE_VARIABLE_CHANGE` | `EmailSender.xaml` | Changed variable "bool_EmailSentSuccessfully" type from x:Boolean to x:Object to match Assign.To ... | undefined |
| 67 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main.xaml` | Changed variable "bool_SystemReady" type from x:Boolean to x:Object to match Assign.To output type | undefined |
| 68 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main.xaml` | Changed variable "int_RetryNumber" type from x:Int32 to x:Object to match Assign.To output type | undefined |
| 69 | `REPAIR_TYPE_VARIABLE_CHANGE` | `Main.xaml` | Changed variable "str_ErrorScreenshotPath" type from x:String to x:Object to match Assign.To outp... | undefined |

## 3. Manual Action Required

### Validation Issues — Requires Manual Attention (30)

The following issues were detected by the quality gate and require developer review. No automated remediation was applied — workflows are preserved as-generated.

| # | File | Check | Developer Action | Est. Minutes |
|---|------|-------|-----------------|-------------|
| 1 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 2 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 3 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 4 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 5 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 6 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 7 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 8 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 9 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 10 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 11 | `Main_Dispatcher.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Dispatcher.xaml — estimated 15 min | 15 |
| 12 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 13 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 14 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 15 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 16 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 17 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 18 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 19 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 20 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 21 | `Main_Performer.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in Main_Performer.xaml — estimated 15 min | 15 |
| 22 | `ContactResolver.xaml` | `EXPRESSION_SYNTAX_UNFIXABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 23 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 24 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 25 | `ContactResolver.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 26 | `EmailSender.xaml` | `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 27 | `ContactResolver.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 28 | `ContactResolver.xaml` | `OBJECT_TO_IENUMERABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 29 | `InitAllSettings.xaml` | `CATALOG_STRUCTURAL_VIOLATION` | Fix property syntax for activity in InitAllSettings.xaml — move attribute to ... | 15 |
| 30 | `InitAllSettings.xaml` | `CATALOG_STRUCTURAL_VIOLATION` | Fix property syntax for activity in InitAllSettings.xaml — move attribute to ... | 15 |

### Workflow-Level Stubs (1)

Entire workflows were replaced with Studio-openable stubs (XAML was not parseable for structural preservation).

| # | File | Code | Developer Action | Est. Minutes |
|---|------|------|-----------------|-------------|
| 1 | `MessageComposer.xaml` | `STUB_WORKFLOW_BLOCKING` | Fix XML structure in MessageComposer.xaml — ensure proper nesting and closing... | 15 |

### Quality Warnings (138)

| # | File | Check | Detail | Developer Action | Est. Minutes |
|---|------|-------|--------|-----------------|-------------|
| 1 | `Main_Dispatcher.xaml` | placeholder-value | Contains 2 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 2 | `Main_Dispatcher.xaml` | placeholder-value | Contains 2 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 3 | `CalendarReader.xaml` | placeholder-value | Contains 2 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 4 | `Main_Performer.xaml` | placeholder-value | Contains 4 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 5 | `Main_Performer.xaml` | placeholder-value | Contains 6 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 6 | `ContactResolver.xaml` | placeholder-value | Contains 9 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 7 | `ContactResolver.xaml` | placeholder-value | Contains 12 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 8 | `MessageComposer.xaml` | placeholder-value | Contains 6 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 9 | `MessageComposer.xaml` | placeholder-value | Contains 9 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 10 | `EmailSender.xaml` | placeholder-value | Contains 7 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 11 | `EmailSender.xaml` | placeholder-value | Contains 5 placeholder value(s) matching "\bPLACEHOLDER\b" | — | undefined |
| 12 | `&quot;CalendarReader.xaml&quot;` | placeholder-value | Contains 1 placeholder value(s) matching "\bTODO\b" | — | undefined |
| 13 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_CalendarName&quot;" is referenced in XAML but not declared in orchestrat... | — | undefined |
| 14 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_SenderEmail&quot;" is referenced in XAML but not declared in orchestrato... | — | undefined |
| 15 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_EmailSubjectTemplate&quot;" is referenced in XAML but not declared in or... | — | undefined |
| 16 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_Timezone&quot;" is referenced in XAML but not declared in orchestrator a... | — | undefined |
| 17 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_EmailLabelPreferencePrimary&quot;" is referenced in XAML but not declare... | — | undefined |
| 18 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_EmailLabelPreferenceFallback&quot;" is referenced in XAML but not declar... | — | undefined |
| 19 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_SafetyGateEnabled&quot;" is referenced in XAML but not declared in orche... | — | undefined |
| 20 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;" is referenced in XAML but not declared in... | — | undefined |
| 21 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_GenAI_Temperature&quot;" is referenced in XAML but not declared in orche... | — | undefined |
| 22 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_GenAI_MaxTokens&quot;" is referenced in XAML but not declared in orchest... | — | undefined |
| 23 | `orchestrator` | undeclared-asset | Asset "&quot;BG11_Config_OrchestratorFolder&quot;" is referenced in XAML but not declared in orch... | — | undefined |
| 24 | `Main_Performer.xaml` | potentially-null-dereference | Line 610: "obj_TransactionItem.Reference" accessed without visible null guard in scope — verify n... | — | undefined |
| 25 | `Main_Performer.xaml` | potentially-null-dereference | Line 618: "obj_TransactionItem.Id" accessed without visible null guard in scope — verify null che... | — | undefined |
| 26 | `Main_Performer.xaml` | potentially-null-dereference | Line 626: "obj_TransactionItem.SpecificContent" accessed without visible null guard in scope — ve... | — | undefined |
| 27 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 136: asset name "&quot;BG11_Config_CalendarName&quot;" is hardcoded — consider using a Confi... | — | undefined |
| 28 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 186: asset name "&quot;BG11_Config_SenderEmail&quot;" is hardcoded — consider using a Config... | — | undefined |
| 29 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 236: asset name "&quot;BG11_Config_EmailSubjectTemplate&quot;" is hardcoded — consider using... | — | undefined |
| 30 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 286: asset name "&quot;BG11_Config_Timezone&quot;" is hardcoded — consider using a Config.xl... | — | undefined |
| 31 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 336: asset name "&quot;BG11_Config_EmailLabelPreferencePrimary&quot;" is hardcoded — conside... | — | undefined |
| 32 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 386: asset name "&quot;BG11_Config_EmailLabelPreferenceFallback&quot;" is hardcoded — consid... | — | undefined |
| 33 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 436: asset name "&quot;BG11_Config_SafetyGateEnabled&quot;" is hardcoded — consider using a ... | — | undefined |
| 34 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 486: asset name "&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;" is hardcoded — consider us... | — | undefined |
| 35 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 536: asset name "&quot;BG11_Config_GenAI_Temperature&quot;" is hardcoded — consider using a ... | — | undefined |
| 36 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 586: asset name "&quot;BG11_Config_GenAI_MaxTokens&quot;" is hardcoded — consider using a Co... | — | undefined |
| 37 | `Main_Dispatcher.xaml` | hardcoded-asset-name | Line 636: asset name "&quot;BG11_Config_OrchestratorFolder&quot;" is hardcoded — consider using a... | — | undefined |
| 38 | `Main_Performer.xaml` | hardcoded-retry-count | Line 573: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 39 | `Main_Performer.xaml` | hardcoded-retry-count | Line 576: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 40 | `Main_Performer.xaml` | hardcoded-retry-interval | Line 573: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 41 | `Main_Performer.xaml` | hardcoded-retry-interval | Line 576: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 42 | `Main_Performer.xaml` | hardcoded-queue-name | Line 579: queue name "BG11_BirthdayGreetings_WorkItems" is hardcoded — consider using a Config.xl... | — | undefined |
| 43 | `Main_Performer.xaml` | hardcoded-asset-name | Line 123: asset name "&quot;BG11_Config_SenderEmail&quot;" is hardcoded — consider using a Config... | — | undefined |
| 44 | `Main_Performer.xaml` | hardcoded-asset-name | Line 165: asset name "&quot;BG11_Config_EmailSubjectTemplate&quot;" is hardcoded — consider using... | — | undefined |
| 45 | `Main_Performer.xaml` | hardcoded-asset-name | Line 207: asset name "&quot;BG11_Config_Timezone&quot;" is hardcoded — consider using a Config.xl... | — | undefined |
| 46 | `Main_Performer.xaml` | hardcoded-asset-name | Line 249: asset name "&quot;BG11_Config_EmailLabelPreferencePrimary&quot;" is hardcoded — conside... | — | undefined |
| 47 | `Main_Performer.xaml` | hardcoded-asset-name | Line 291: asset name "&quot;BG11_Config_EmailLabelPreferenceFallback&quot;" is hardcoded — consid... | — | undefined |
| 48 | `Main_Performer.xaml` | hardcoded-asset-name | Line 333: asset name "&quot;BG11_Config_SafetyGateEnabled&quot;" is hardcoded — consider using a ... | — | undefined |
| 49 | `Main_Performer.xaml` | hardcoded-asset-name | Line 375: asset name "&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;" is hardcoded — consider us... | — | undefined |
| 50 | `Main_Performer.xaml` | hardcoded-asset-name | Line 417: asset name "&quot;BG11_Config_GenAI_Temperature&quot;" is hardcoded — consider using a ... | — | undefined |
| 51 | `Main_Performer.xaml` | hardcoded-asset-name | Line 459: asset name "&quot;BG11_Config_GenAI_MaxTokens&quot;" is hardcoded — consider using a Co... | — | undefined |
| 52 | `ContactResolver.xaml` | hardcoded-retry-count | Line 115: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 53 | `ContactResolver.xaml` | hardcoded-retry-count | Line 125: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 54 | `ContactResolver.xaml` | hardcoded-retry-interval | Line 115: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 55 | `ContactResolver.xaml` | hardcoded-retry-interval | Line 125: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 56 | `MessageComposer.xaml` | hardcoded-retry-count | Line 135: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 57 | `MessageComposer.xaml` | hardcoded-retry-count | Line 145: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 58 | `MessageComposer.xaml` | hardcoded-retry-count | Line 447: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 59 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 135: retry interval hardcoded as "00:00:15" — consider externalizing to Config.xlsx | — | undefined |
| 60 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 145: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 61 | `MessageComposer.xaml` | hardcoded-retry-interval | Line 447: retry interval hardcoded as "00:00:20" — consider externalizing to Config.xlsx | — | undefined |
| 62 | `EmailSender.xaml` | hardcoded-retry-count | Line 141: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 63 | `EmailSender.xaml` | hardcoded-retry-count | Line 161: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("Ma... | — | undefined |
| 64 | `EmailSender.xaml` | hardcoded-retry-interval | Line 141: retry interval hardcoded as "00:00:30" — consider externalizing to Config.xlsx | — | undefined |
| 65 | `EmailSender.xaml` | hardcoded-retry-interval | Line 161: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx | — | undefined |
| 66 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 107: asset name "BG11_Cred_Google_Workspace_ServiceUser" is hardcoded — consider using a Con... | — | undefined |
| 67 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 119: asset name "BG11_Config_CalendarName" is hardcoded — consider using a Config.xlsx entry... | — | undefined |
| 68 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 128: asset name "BG11_Config_SenderEmail" is hardcoded — consider using a Config.xlsx entry ... | — | undefined |
| 69 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 137: asset name "BG11_Config_EmailSubjectTemplate" is hardcoded — consider using a Config.xl... | — | undefined |
| 70 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 146: asset name "BG11_Config_Timezone" is hardcoded — consider using a Config.xlsx entry or ... | — | undefined |
| 71 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 155: asset name "BG11_Config_EmailLabelPreferencePrimary" is hardcoded — consider using a Co... | — | undefined |
| 72 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 164: asset name "BG11_Config_EmailLabelPreferenceFallback" is hardcoded — consider using a C... | — | undefined |
| 73 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 173: asset name "BG11_Config_SafetyGateEnabled" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 74 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 182: asset name "BG11_Config_SafetyGate_MaxBodyChars" is hardcoded — consider using a Config... | — | undefined |
| 75 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 191: asset name "BG11_Config_GenAI_Temperature" is hardcoded — consider using a Config.xlsx ... | — | undefined |
| 76 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 200: asset name "BG11_Config_GenAI_MaxTokens" is hardcoded — consider using a Config.xlsx en... | — | undefined |
| 77 | `InitAllSettings.xaml` | hardcoded-asset-name | Line 209: asset name "BG11_Config_OrchestratorFolder" is hardcoded — consider using a Config.xlsx... | — | undefined |
| 78 | `MessageComposer.xaml` | EXPRESSION_SYNTAX | Line 351: C# '+' for string concatenation should be VB.NET '&' in expression: "Primary GenAI resp... | — | undefined |
| 79 | `MessageComposer.xaml` | EXPRESSION_SYNTAX | Line 415: C# '+' for string concatenation should be VB.NET '&' in expression: "Primary GenAI JSON... | — | undefined |
| 80 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 103: Auto-repaired — changed variable "dt_RunStartTimeUtc" type from s:DateTime to x:Object ... | — | undefined |
| 81 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 173: Auto-repaired — changed variable "str_CalendarName" type from x:String to x:Object to m... | — | undefined |
| 82 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 223: Auto-repaired — changed variable "str_SenderEmail" type from x:String to x:Object to ma... | — | undefined |
| 83 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 273: Auto-repaired — changed variable "str_EmailSubjectTemplate" type from x:String to x:Obj... | — | undefined |
| 84 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 323: Auto-repaired — changed variable "str_ConfigTimezone" type from x:String to x:Object to... | — | undefined |
| 85 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 373: Auto-repaired — changed variable "str_EmailLabelPrimary" type from x:String to x:Object... | — | undefined |
| 86 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 423: Auto-repaired — changed variable "str_EmailLabelFallback" type from x:String to x:Objec... | — | undefined |
| 87 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 473: Auto-repaired — changed variable "bool_SafetyGateEnabled" type from x:Boolean to x:Obje... | — | undefined |
| 88 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 523: Auto-repaired — changed variable "int_SafetyGateMaxBodyChars" type from x:Int32 to x:Ob... | — | undefined |
| 89 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 573: Auto-repaired — changed variable "str_GenAiTemperature" type from x:String to x:Object ... | — | undefined |
| 90 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 623: Auto-repaired — changed variable "int_GenAiMaxTokens" type from x:Int32 to x:Object to ... | — | undefined |
| 91 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 673: Auto-repaired — changed variable "str_OrchestratorFolder" type from x:String to x:Objec... | — | undefined |
| 92 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 681: Auto-repaired — changed variable "dict_ConfigDictionary" type from scg:Dictionary(x:Str... | — | undefined |
| 93 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 736: Auto-repaired — changed variable "dt_RunDateLocal" type from s:DateTime to x:Object to ... | — | undefined |
| 94 | `Main_Dispatcher.xaml` | TYPE_MISMATCH | Line 744: Auto-repaired — changed variable "str_RunDateString" type from x:String to x:Object to ... | — | undefined |
| 95 | `CalendarReader.xaml` | TYPE_MISMATCH | Line 73: Auto-repaired — changed variable "dt_BirthdayEventsTable" type from scg2:DataTable to x:... | — | undefined |
| 96 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 496: Auto-repaired — changed variable "dict_ConfigDict" type from scg:Dictionary(x:String, x... | — | undefined |
| 97 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 504: Auto-repaired — changed variable "bool_IsInitialized" type from x:Boolean to x:Object t... | — | undefined |
| 98 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 555: Auto-repaired — changed variable "str_PerformerRunId" type from x:String to x:Object to... | — | undefined |
| 99 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 606: Auto-repaired — changed variable "str_TransactionReference" type from x:String to x:Obj... | — | undefined |
| 100 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 614: Auto-repaired — changed variable "str_QueueItemId" type from x:String to x:Object to ma... | — | undefined |
| 101 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 622: Auto-repaired — changed variable "dict_SpecificContent" type from scg:Dictionary(x:Stri... | — | undefined |
| 102 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 630: Auto-repaired — changed variable "str_FullName" type from x:String to x:Object to match... | — | undefined |
| 103 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 638: Auto-repaired — changed variable "str_RunDate" type from x:String to x:Object to match ... | — | undefined |
| 104 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 646: Auto-repaired — changed variable "str_CalendarEventId" type from x:String to x:Object t... | — | undefined |
| 105 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 654: Auto-repaired — changed variable "str_Tone" type from x:String to x:Object to match Ass... | — | undefined |
| 106 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 662: Auto-repaired — changed variable "str_FirstName" type from x:String to x:Object to matc... | — | undefined |
| 107 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 671: Auto-repaired — changed variable "str_ResolvedEmail" type from x:String to x:Object to ... | — | undefined |
| 108 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 679: Auto-repaired — changed variable "str_EmailLabelUsed" type from x:String to x:Object to... | — | undefined |
| 109 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 687: Auto-repaired — changed variable "str_ComposedSubject" type from x:String to x:Object t... | — | undefined |
| 110 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 695: Auto-repaired — changed variable "str_ComposedBody" type from x:String to x:Object to m... | — | undefined |
| 111 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 703: Auto-repaired — changed variable "str_ItemOutcome" type from x:String to x:Object to ma... | — | undefined |
| 112 | `Main_Performer.xaml` | TYPE_MISMATCH | Line 711: Auto-repaired — changed variable "str_ItemOutcomeReason" type from x:String to x:Object... | — | undefined |
| 113 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 80: Auto-repaired — changed variable "str_NormalizedFullName" type from x:String to x:Object... | — | undefined |
| 114 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 88: Auto-repaired — changed variable "str_ResolvedFirstName" type from x:String to x:Object ... | — | undefined |
| 115 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 136: Auto-repaired — changed variable "bool_ContactFound" type from x:Boolean to x:Object to... | — | undefined |
| 116 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 154: Auto-repaired — changed variable "str_PrimaryEmailFound" type from x:String to x:Object... | — | undefined |
| 117 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 162: Auto-repaired — changed variable "str_FallbackEmailFound" type from x:String to x:Objec... | — | undefined |
| 118 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 170: Auto-repaired — changed variable "bool_EmailSelectionDone" type from x:Boolean to x:Obj... | — | undefined |
| 119 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 220: Auto-repaired — changed variable "str_SingleEmailLabel" type from x:String to x:Object ... | — | undefined |
| 120 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 228: Auto-repaired — changed variable "str_SingleEmailValue" type from x:String to x:Object ... | — | undefined |
| 121 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 252: Auto-repaired — changed variable "str_ResolvedEmail" type from x:String to x:Object to ... | — | undefined |
| 122 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 260: Auto-repaired — changed variable "str_ResolvedLabel" type from x:String to x:Object to ... | — | undefined |
| 123 | `ContactResolver.xaml` | TYPE_MISMATCH | Line 408: Auto-repaired — changed variable "str_ExceptionMessage" type from x:String to x:Object ... | — | undefined |
| 124 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 97: Auto-repaired — changed variable "str_ResolvedFirstName" type from x:String to x:Object ... | — | undefined |
| 125 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 107: Auto-repaired — changed variable "str_PromptText" type from x:String to x:Object to mat... | — | undefined |
| 126 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 156: Auto-repaired — changed variable "int_AttemptCount" type from x:Int32 to x:Object to ma... | — | undefined |
| 127 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 204: Auto-repaired — changed variable "bool_GenAIRateLimitHit" type from x:Boolean to x:Obje... | — | undefined |
| 128 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 266: Auto-repaired — changed variable "str_ParsedBodyText" type from x:String to x:Object to... | — | undefined |
| 129 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 274: Auto-repaired — changed variable "str_ParsedSafetyStatus" type from x:String to x:Objec... | — | undefined |
| 130 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 282: Auto-repaired — changed variable "str_ParsedSafetyReason" type from x:String to x:Objec... | — | undefined |
| 131 | `MessageComposer.xaml` | TYPE_MISMATCH | Line 331: Auto-repaired — changed variable "bool_ParseErrorOccurred" type from x:Boolean to x:Obj... | — | undefined |
| 132 | `EmailSender.xaml` | TYPE_MISMATCH | Line 92: Auto-repaired — changed variable "str_RecipientEmailNormalized" type from x:String to x:... | — | undefined |
| 133 | `EmailSender.xaml` | TYPE_MISMATCH | Line 153: Auto-repaired — changed variable "int_SendAttemptNumber" type from x:Int32 to x:Object ... | — | undefined |
| 134 | `EmailSender.xaml` | TYPE_MISMATCH | Line 172: Auto-repaired — changed variable "dt_SentTimestampUtc" type from s:DateTime to x:Object... | — | undefined |
| 135 | `EmailSender.xaml` | TYPE_MISMATCH | Line 180: Auto-repaired — changed variable "bool_EmailSentSuccessfully" type from x:Boolean to x:... | — | undefined |
| 136 | `Main.xaml` | TYPE_MISMATCH | Line 75: Auto-repaired — changed variable "bool_SystemReady" type from x:Boolean to x:Object to m... | — | undefined |
| 137 | `Main.xaml` | TYPE_MISMATCH | Line 126: Auto-repaired — changed variable "int_RetryNumber" type from x:Int32 to x:Object to mat... | — | undefined |
| 138 | `Main.xaml` | TYPE_MISMATCH | Line 142: Auto-repaired — changed variable "str_ErrorScreenshotPath" type from x:String to x:Obje... | — | undefined |

**Total manual remediation effort: ~465 minutes (7.8 hours)**

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary
The “birthday greetings v11” project will automate the daily task of sending personalized birthday emails on behalf of the SME. Today, the SME manually checks a dedicated Google Calendar named **“Birthdays”** each morning at **8:00 AM**, identifies whose birthday it is from the event title (full name), looks up the recipient’s email address in **Google Contacts**, drafts a message in a **warm, funny, sarcastic** voice, and sends the greeting from Gmail. The primary objective of the automation is to eliminate the risk of forgetting and ensure consistent, timely delivery of highly personal birthday greetings, using **unattended, fully autonomous execution**.

The future-state solution will run on UiPath Orchestrator with a scheduled trigger at 8:00 AM, read birthdays from the “Birthdays” calendar using a UiPath Google Calendar activity, look up contacts in Google Contacts, select the **Personal** email address when multiple emails exist (fallback to Home if needed), generate an AI-written message in the SME’s voice using **UiPath native GenAI capabilities (not OpenAI)**, and send the email using the **Gmail connector (Integration Service) – `ninemush@gmail.com`**. When no birthdays are present, the process ends without action. When no email is found, the process performs no action (per SME’s final instruction).

## 2. Process Scope
This PDD covers the end-to-end process of detecting birthdays and sending birthday greeting emails based on entries in the SME’s Google Calendar “Birthdays” calendar. The scope includes: (a) daily scheduled execution at 8:00 AM; (b) extracting today’s birthday events from the “Birthdays” calendar; (c) parsing each event title as a full name; (d) looking up the person by full name in Google Contacts; (e) choosing the correct email address (Personal preferred); (f) generating a message in the SME’s warm/funny/sarcastic voice using UiPath native GenAI tooling; and (g) sending emails from `ninemush@gmail.com` via the Int...

### SDD Summary

## 1. Automation Architecture Overview

### 1.1 Chosen automation pattern and rationale
**Pattern:** **Queue-driven fan-out with REFramework-style worker** (dispatcher/performer split)

- **Why queue-driven fan-out:** Multiple birthdays can occur on the same day. Creating **one queue item per recipient** isolates failures, enables per-item retries, and provides clean operational visibility (success/fault per person) without reprocessing the whole day.
- **Why Dispatcher/Performer:** Dispatcher is light (calendar read + enqueue). Performer does the heavier work (contacts lookup, GenAI message, send email). This improves recoverability and scaling (you can run multiple performers if needed).
- **Why Hybrid (RPA + GenAI) not “agent-only”:** Deterministic work (Calendar/Contacts/Gmail) is best as **unattended RPA with Integration Service connectors** for reliability, auditability, and least privilege. The only non-deterministic part is writing “in your voice”, which is handled by **UiPath native GenAI Activities**.  
- **No Human-in-the-loop (Action Center):** The PDD requires **fully autonomous** execution. Action Center is therefore **not** in the critical path. We still design for operability (logging, safe content gate, and an optional “quarantine” mechanism using queues/Data Service rather than approvals).

[AUTOMATION_TYPE: HYBRID (Unattended RPA + UiPath native GenAI)]

### 1.2 UiPath services used (and why)
- **Orchestrator**
  - **Scheduled trigger** at 8:00 AM (daily).
  - **Queues** for per-recipient work items and retry semantics.
  - **Assets** for configuration (calendar name, sender, tone prompt, guardrail thresholds).
  - **Monitoring** via job/queue dashboards and alert rules.
- **Integration Service**
  - **Gmail connector** (send email from `ninemush@gmail.com`) – mandated.
  - **Google Calendar / Contacts access:** implemented using supported UiPath Google activities (see packages); Integration Service is still used for Gmail, and avoids custom HTTP....

**Automation Type:** hybrid
**Rationale:** Calendar/contact retrieval and sending emails are deterministic API actions (RPA), while generating a “warm, funny, sarcastic” message in your voice is best handled by an AI agent using UiPath’s native GenAI/Agents with guardrails.
**Feasibility Complexity:** medium
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | Daily 8AM Birthday Greeting Trigger | System | Orchestrator Triggers | start | — |
| 2 | Read Today's Birthdays from "Birthdays" Calendar | System | Google Calendar (UiPath activity) | task | — |
| 3 | Any Birthdays Today? | System | Google Calendar (UiPath activity) | decision | — |
| 4 | End (No Birthdays) | System | Orchestrator | end | — |
| 5 | Create Birthday Recipient Work Items | System | Orchestrator Queue | task | — |
| 6 | Get Next Birthday Work Item | System | Orchestrator Queue | task | — |
| 7 | Lookup Contact by Full Name | System | Google Contacts (UiPath activity) | task | — |
| 8 | Email Found in Contacts? | System | Google Contacts (UiPath activity) | decision | — |
| 9 | Select Personal Email (fallback Home) | System | Google Contacts (UiPath activity) | task | — |
| 10 | Generate Message in My Voice (warm/funny/sarcastic) | System | UiPath Agents + UiPath GenAI Activities | agent-task | — |
| 11 | Safety/Policy Check Passed? (no sensitive/awkward content) | System | UiPath Agents | agent-decision | — |
| 12 | Send Birthday Email to Recipient | System | Gmail Connector (Integration Service) - ninemush@gmail.com | task | — |
| 13 | Mark Work Item Complete | System | Orchestrator Queue | task | — |
| 14 | More Birthdays Pending? | System | Orchestrator Queue | decision | — |
| 15 | Continue Processing Next Work Item | System | Orchestrator Queue | task | — |
| 16 | Birthday Greetings Sent End | System | Orchestrator | end | — |
| 17 | No Email Found — Do Nothing | System | Orchestrator | task | — |
| 18 | More Birthdays Pending? | System | Orchestrator Queue | decision | — |
| 19 | Continue Processing Next Work Item | System | Orchestrator Queue | task | — |
| 20 | Birthday Run Completed End | System | Orchestrator | end | — |
| 21 | Create Human Review Task (Content Needs Tweak) | System | Action Center | task | — |
| 22 | User Revises/Approves Message | Me | Action Center | task | — |
| 23 | Send Approved Birthday Email | System | Gmail Connector (Integration Service) - ninemush@gmail.com | task | — |
| 24 | Mark Work Item Complete | System | Orchestrator Queue | task | — |
| 25 | More Birthdays Pending? | System | Orchestrator Queue | decision | — |
| 26 | Continue Processing Next Work Item | System | Orchestrator Queue | task | — |
| 27 | Birthday Greetings Sent End (After Review) | System | Orchestrator | end | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath activity)
- Orchestrator
- Orchestrator Queue
- Google Contacts (UiPath activity)
- UiPath Agents + UiPath GenAI Activities
- UiPath Agents
- Gmail Connector (Integration Service) - ninemush@gmail.com
- Action Center

### User Roles Involved

- System
- Me

### Decision Points (Process Map Topology)

**Any Birthdays Today?**
  - [No] → End (No Birthdays)
  - [Yes] → Create Birthday Recipient Work Items

**Email Found in Contacts?**
  - [Yes] → Select Personal Email (fallback Home)
  - [No] → No Email Found — Do Nothing

**More Birthdays Pending?**
  - [Yes] → Continue Processing Next Work Item
  - [No] → Birthday Greetings Sent End

**More Birthdays Pending?**
  - [Yes] → Continue Processing Next Work Item
  - [No] → Birthday Run Completed End

**More Birthdays Pending?**
  - [Yes] → Continue Processing Next Work Item
  - [No] → Birthday Greetings Sent End (After Review)

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
| 4 | `Newtonsoft.Json` |
| 5 | `UiPath.Web.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath activity)
- Orchestrator
- Orchestrator Queue
- Google Contacts (UiPath activity)
- UiPath Agents + UiPath GenAI Activities
- UiPath Agents
- Gmail Connector (Integration Service) - ninemush@gmail.com
- Action Center

## 7. Credential & Asset Inventory

**Total:** 65 activities (32 hardcoded, 33 variable-driven)

### Orchestrator Credentials to Provision

| # | Credential Name | Type | Consuming Activity | File | Action |
|---|----------------|------|-------------------|------|--------|
| 1 | `BG11_Cred_Google_Workspace_ServiceUser` | Credential | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `&quot;BG11_Config_CalendarName&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 2 | `&quot;BG11_Config_SenderEmail&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 3 | `&quot;BG11_Config_EmailSubjectTemplate&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 4 | `&quot;BG11_Config_Timezone&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 5 | `&quot;BG11_Config_EmailLabelPreferencePrimary&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 6 | `&quot;BG11_Config_EmailLabelPreferenceFallback&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 7 | `&quot;BG11_Config_SafetyGateEnabled&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 8 | `&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 9 | `&quot;BG11_Config_GenAI_Temperature&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 10 | `&quot;BG11_Config_GenAI_MaxTokens&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 11 | `&quot;BG11_Config_OrchestratorFolder&quot;` | Unknown | — | `Main_Dispatcher.xaml` | Create in Orchestrator before deployment |
| 12 | `BG11_Config_CalendarName` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 13 | `BG11_Config_SenderEmail` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 14 | `BG11_Config_EmailSubjectTemplate` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 15 | `BG11_Config_Timezone` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 16 | `BG11_Config_EmailLabelPreferencePrimary` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 17 | `BG11_Config_EmailLabelPreferenceFallback` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 18 | `BG11_Config_SafetyGateEnabled` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 19 | `BG11_Config_SafetyGate_MaxBodyChars` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 20 | `BG11_Config_GenAI_Temperature` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 21 | `BG11_Config_GenAI_MaxTokens` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |
| 22 | `BG11_Config_OrchestratorFolder` | Unknown | — | `InitAllSettings.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `Main_Dispatcher.xaml` | 142 | GetAsset | `&quot;BG11_Config_CalendarName&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 143 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 192 | GetAsset | `&quot;BG11_Config_SenderEmail&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 193 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 242 | GetAsset | `&quot;BG11_Config_EmailSubjectTemplate&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 243 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 292 | GetAsset | `&quot;BG11_Config_Timezone&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 293 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 342 | GetAsset | `&quot;BG11_Config_EmailLabelPreferencePrimary&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 343 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 392 | GetAsset | `&quot;BG11_Config_EmailLabelPreferenceFallback&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 393 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 442 | GetAsset | `&quot;BG11_Config_SafetyGateEnabled&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 443 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 492 | GetAsset | `&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 493 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 542 | GetAsset | `&quot;BG11_Config_GenAI_Temperature&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 543 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 592 | GetAsset | `&quot;BG11_Config_GenAI_MaxTokens&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 593 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Dispatcher.xaml` | 642 | GetAsset | `&quot;BG11_Config_OrchestratorFolder&quot;` | Unknown | — | Yes |
| `Main_Dispatcher.xaml` | 643 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 129 | GetAsset | `&quot;BG11_Config_SenderEmail&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 130 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 171 | GetAsset | `&quot;BG11_Config_EmailSubjectTemplate&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 172 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 213 | GetAsset | `&quot;BG11_Config_Timezone&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 214 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 255 | GetAsset | `&quot;BG11_Config_EmailLabelPreferencePrimary&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 256 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 297 | GetAsset | `&quot;BG11_Config_EmailLabelPreferenceFallback&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 298 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 339 | GetAsset | `&quot;BG11_Config_SafetyGateEnabled&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 340 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 381 | GetAsset | `&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 382 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 423 | GetAsset | `&quot;BG11_Config_GenAI_Temperature&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 424 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `Main_Performer.xaml` | 465 | GetAsset | `&quot;BG11_Config_GenAI_MaxTokens&quot;` | Unknown | — | Yes |
| `Main_Performer.xaml` | 466 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 107 | GetCredential | `BG11_Cred_Google_Workspace_ServiceUser` | Credential | — | Yes |
| `InitAllSettings.xaml` | 108 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 111 | GetCredential | `UNKNOWN` | Credential | — | No |
| `InitAllSettings.xaml` | 119 | GetAsset | `BG11_Config_CalendarName` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 120 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 128 | GetAsset | `BG11_Config_SenderEmail` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 129 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 137 | GetAsset | `BG11_Config_EmailSubjectTemplate` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 138 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 146 | GetAsset | `BG11_Config_Timezone` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 147 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 155 | GetAsset | `BG11_Config_EmailLabelPreferencePrimary` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 156 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 164 | GetAsset | `BG11_Config_EmailLabelPreferenceFallback` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 165 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 173 | GetAsset | `BG11_Config_SafetyGateEnabled` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 174 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 182 | GetAsset | `BG11_Config_SafetyGate_MaxBodyChars` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 183 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 191 | GetAsset | `BG11_Config_GenAI_Temperature` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 192 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 200 | GetAsset | `BG11_Config_GenAI_MaxTokens` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 201 | GetAsset | `UNKNOWN` | Unknown | — | No |
| `InitAllSettings.xaml` | 209 | GetAsset | `BG11_Config_OrchestratorFolder` | Unknown | — | Yes |
| `InitAllSettings.xaml` | 210 | GetAsset | `UNKNOWN` | Unknown | — | No |

> **Warning:** 32 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 12 aligned, 1 SDD-only, 13 XAML-only

> **Warning:** 1 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 13 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BG11_Config_CalendarName` | asset | **Aligned** | type: Text, value: Birthdays, description: Google Calendar name to query for birthday events. | `InitAllSettings.xaml` | 119 |
| 2 | `BG11_Config_SenderEmail` | asset | **Aligned** | type: Text, value: ninemush@gmail.com, description: From-address for outbound birthday greetings (Gmail Integration Service connection identity). | `InitAllSettings.xaml` | 128 |
| 3 | `BG11_Config_EmailSubjectTemplate` | asset | **Aligned** | type: Text, value: Happy Birthday, {FirstName}!, description: Subject template for birthday emails. | `InitAllSettings.xaml` | 137 |
| 4 | `BG11_Config_Timezone` | asset | **Aligned** | type: Text, value: America/New_York, description: Business timezone used for 'today' calculation and scheduling alignment. | `InitAllSettings.xaml` | 146 |
| 5 | `BG11_Config_EmailLabelPreferencePrimary` | asset | **Aligned** | type: Text, value: Personal, description: Preferred Google Contacts email label. | `InitAllSettings.xaml` | 155 |
| 6 | `BG11_Config_EmailLabelPreferenceFallback` | asset | **Aligned** | type: Text, value: Home, description: Fallback Google Contacts email label if primary is missing. | `InitAllSettings.xaml` | 164 |
| 7 | `BG11_Config_SafetyGateEnabled` | asset | **Aligned** | type: Bool, value: true, description: Enables automated content safety gate prior to sending. | `InitAllSettings.xaml` | 173 |
| 8 | `BG11_Config_SafetyGate_MaxBodyChars` | asset | **Aligned** | type: Integer, value: 1500, description: Hard cap for generated email body length; longer content should be trimmed/regenerated. | `InitAllSettings.xaml` | 182 |
| 9 | `BG11_Config_GenAI_Temperature` | asset | **Aligned** | type: Text, value: 0.4, description: Generation randomness control used by the native GenAI step/agent. | `InitAllSettings.xaml` | 191 |
| 10 | `BG11_Config_GenAI_MaxTokens` | asset | **Aligned** | type: Integer, value: 500, description: Max tokens for message generation. | `InitAllSettings.xaml` | 200 |
| 11 | `BG11_Config_OrchestratorFolder` | asset | **Aligned** | type: Text, value: BirthdayGreetings/Prod, description: Target Orchestrator folder path convention used by deployment (informational/config for runtime). | `InitAllSettings.xaml` | 209 |
| 12 | `BG11_Cred_Google_Workspace_ServiceUser` | credential | **Aligned** | type: Credential, description: Reserved credential asset for Google Workspace service user (not used by Integration Service connectors, but required for standardized operations/runbooks). | `InitAllSettings.xaml` | 107 |
| 13 | `&quot;BG11_Config_CalendarName&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 142 |
| 14 | `&quot;BG11_Config_SenderEmail&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 192 |
| 15 | `&quot;BG11_Config_EmailSubjectTemplate&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 242 |
| 16 | `&quot;BG11_Config_Timezone&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 292 |
| 17 | `&quot;BG11_Config_EmailLabelPreferencePrimary&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 342 |
| 18 | `&quot;BG11_Config_EmailLabelPreferenceFallback&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 392 |
| 19 | `&quot;BG11_Config_SafetyGateEnabled&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 442 |
| 20 | `&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 492 |
| 21 | `&quot;BG11_Config_GenAI_Temperature&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 542 |
| 22 | `&quot;BG11_Config_GenAI_MaxTokens&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 592 |
| 23 | `&quot;BG11_Config_OrchestratorFolder&quot;` | asset | **XAML Only** | — | `Main_Dispatcher.xaml` | 642 |
| 24 | `BG11_BirthdayGreetings_WorkItems` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: One item per birthday recipient discovered from the 'Birthdays' Google Calendar for reliable fan-out processing, retries, and independent completion. | — | — |
| 25 | `&quot;BG11_BirthdayGreetings_WorkItems&quot;` | queue | **XAML Only** | — | `Main_Performer.xaml` | 585 |
| 26 | `[in_QueueName]` | queue | **XAML Only** | — | `GetTransactionData.xaml` | 63 |

## 9. Queue Management

**Pattern:** Transactional (Dispatcher/Performer)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `&quot;BG11_BirthdayGreetings_WorkItems&quot;` | GetTransactionItem | Recommended | Yes (3x) | — | Create in Orchestrator |
| 2 | `[in_QueueName]` | GetTransactionItem | Recommended | Yes (3x) | — | Verify exists |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BG11_BirthdayGreetings_WorkItems` | Yes | 2x | — | Defined in SDD but no matching XAML activity — verify implementation |

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

**Coverage:** 40/69 high-risk activities inside TryCatch (58%)

### Files Without TryCatch

- `MessageComposer.xaml`
- `InitAllSettings.xaml`
- `GetTransactionData.xaml`
- `KillAllProcesses.xaml`
- `Process.xaml`
- `&quot;CalendarReader.xaml&quot;`

### Uncovered High-Risk Activities

| # | Location | Activity |
|---|----------|----------|
| 1 | `Main_Performer.xaml:585` | Get Transaction Item from BG11_BirthdayGreetings_WorkItems |
| 2 | `Main_Performer.xaml:586` | ui:GetTransactionItem |
| 3 | `InitAllSettings.xaml:107` | Get BG11_Cred_Google_Workspace_ServiceUser |
| 4 | `InitAllSettings.xaml:108` | ui:GetCredential |
| 5 | `InitAllSettings.xaml:111` | ui:GetCredential |
| 6 | `InitAllSettings.xaml:119` | Get BG11_Config_CalendarName |
| 7 | `InitAllSettings.xaml:120` | ui:GetAsset |
| 8 | `InitAllSettings.xaml:128` | Get BG11_Config_SenderEmail |
| 9 | `InitAllSettings.xaml:129` | ui:GetAsset |
| 10 | `InitAllSettings.xaml:137` | Get BG11_Config_EmailSubjectTemplate |
| 11 | `InitAllSettings.xaml:138` | ui:GetAsset |
| 12 | `InitAllSettings.xaml:146` | Get BG11_Config_Timezone |
| 13 | `InitAllSettings.xaml:147` | ui:GetAsset |
| 14 | `InitAllSettings.xaml:155` | Get BG11_Config_EmailLabelPreferencePrimary |
| 15 | `InitAllSettings.xaml:156` | ui:GetAsset |
| 16 | `InitAllSettings.xaml:164` | Get BG11_Config_EmailLabelPreferenceFallback |
| 17 | `InitAllSettings.xaml:165` | ui:GetAsset |
| 18 | `InitAllSettings.xaml:173` | Get BG11_Config_SafetyGateEnabled |
| 19 | `InitAllSettings.xaml:174` | ui:GetAsset |
| 20 | `InitAllSettings.xaml:182` | Get BG11_Config_SafetyGate_MaxBodyChars |
| 21 | `InitAllSettings.xaml:183` | ui:GetAsset |
| 22 | `InitAllSettings.xaml:191` | Get BG11_Config_GenAI_Temperature |
| 23 | `InitAllSettings.xaml:192` | ui:GetAsset |
| 24 | `InitAllSettings.xaml:200` | Get BG11_Config_GenAI_MaxTokens |
| 25 | `InitAllSettings.xaml:201` | ui:GetAsset |
| 26 | `InitAllSettings.xaml:209` | Get BG11_Config_OrchestratorFolder |
| 27 | `InitAllSettings.xaml:210` | ui:GetAsset |
| 28 | `GetTransactionData.xaml:63` | Get Queue Item |
| 29 | `GetTransactionData.xaml:64` | ui:GetTransactionItem |

> **Recommendation:** Wrap these activities in TryCatch blocks with appropriate exception types (BusinessRuleException for data errors, System.Exception for general failures).

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BG11_TRG_Daily_Dispatcher_0800 | SDD-specified: BG11_TRG_Daily_Dispatcher_0800 | Cron: 0 0 8 ? * * * | Daily 08:00 trigger to run the Dispatcher (calendar scan + queue add). |
| 2 | **Queue** | Defined in SDD orchestrator_artifacts: BG11_TRG_Queue_Performer | SDD-specified: BG11_TRG_Queue_Performer | Queue: BG11_BirthdayGreetings_WorkItems | Queue trigger to run the Performer for each birthday work item (contact lookup + GenAI message + safety gate + Gmail send). |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| undefined | warning | 138 |  |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Credentials | Provision credential: `BG11_Cred_Google_Workspace_ServiceUser` | Yes |
| 5 | Assets | Provision asset: `&quot;BG11_Config_CalendarName&quot;` | Yes |
| 6 | Assets | Provision asset: `&quot;BG11_Config_SenderEmail&quot;` | Yes |
| 7 | Assets | Provision asset: `&quot;BG11_Config_EmailSubjectTemplate&quot;` | Yes |
| 8 | Assets | Provision asset: `&quot;BG11_Config_Timezone&quot;` | Yes |
| 9 | Assets | Provision asset: `&quot;BG11_Config_EmailLabelPreferencePrimary&quot;` | Yes |
| 10 | Assets | Provision asset: `&quot;BG11_Config_EmailLabelPreferenceFallback&quot;` | Yes |
| 11 | Assets | Provision asset: `&quot;BG11_Config_SafetyGateEnabled&quot;` | Yes |
| 12 | Assets | Provision asset: `&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;` | Yes |
| 13 | Assets | Provision asset: `&quot;BG11_Config_GenAI_Temperature&quot;` | Yes |
| 14 | Assets | Provision asset: `&quot;BG11_Config_GenAI_MaxTokens&quot;` | Yes |
| 15 | Assets | Provision asset: `&quot;BG11_Config_OrchestratorFolder&quot;` | Yes |
| 16 | Assets | Provision asset: `BG11_Config_CalendarName` | Yes |
| 17 | Assets | Provision asset: `BG11_Config_SenderEmail` | Yes |
| 18 | Assets | Provision asset: `BG11_Config_EmailSubjectTemplate` | Yes |
| 19 | Assets | Provision asset: `BG11_Config_Timezone` | Yes |
| 20 | Assets | Provision asset: `BG11_Config_EmailLabelPreferencePrimary` | Yes |
| 21 | Assets | Provision asset: `BG11_Config_EmailLabelPreferenceFallback` | Yes |
| 22 | Assets | Provision asset: `BG11_Config_SafetyGateEnabled` | Yes |
| 23 | Assets | Provision asset: `BG11_Config_SafetyGate_MaxBodyChars` | Yes |
| 24 | Assets | Provision asset: `BG11_Config_GenAI_Temperature` | Yes |
| 25 | Assets | Provision asset: `BG11_Config_GenAI_MaxTokens` | Yes |
| 26 | Assets | Provision asset: `BG11_Config_OrchestratorFolder` | Yes |
| 27 | Queues | Create queue: `&quot;BG11_BirthdayGreetings_WorkItems&quot;` | Yes |
| 28 | Queues | Create queue: `[in_QueueName]` | Yes |
| 29 | Trigger | Configure trigger (schedule/queue/API) | Yes |
| 30 | Testing | Run smoke test in target environment | Yes |
| 31 | Monitoring | Verify logging output in Orchestrator | Recommended |
| 32 | Governance | UAT test execution completed and sign-off obtained | Yes |
| 33 | Governance | Peer code review completed | Yes |
| 34 | Governance | All quality gate warnings addressed or risk-accepted | Yes |
| 35 | Governance | Business process owner validation obtained | Yes |
| 36 | Governance | CoE approval obtained | Yes |
| 37 | Governance | Production readiness assessment completed (monitoring, alerting, rollback plan documented) | Yes |

## 14. Deployment Readiness Score

**Overall: Not Ready — 28/50 (19%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 32 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 4/10 | 58% coverage — consider wrapping remaining activities; 6 file(s) with no TryCatch blocks |
| Queue Management | 9/10 | 1 hardcoded queue name(s) — externalize to config |
| Build Quality | 0/10 | 138 quality warnings — significant remediation needed; 31 remediations — stub replacements need developer attention; 9/14 workflow(s) are Studio-loadable (5 blocked — 36% not loadable) |
| Environment Setup | 10/10 | Environment requirements are straightforward |

> **Action Required:** Address the items above before deploying to production. Focus on sections with the lowest scores first.

## 15. Pre-emission Spec Validation

Validation was performed on the WorkflowSpec tree before XAML assembly. Issues caught at this stage are cheaper to fix than post-emission quality gate findings.

| Metric | Count |
|---|---|
| Total activities checked | 175 |
| Valid activities | 172 |
| Unknown → Comment stubs | 3 |
| Non-catalog properties stripped | 23 |
| Enum values auto-corrected | 2 |
| Missing required props filled | 0 |
| Total issues | 28 |

### Pre-emission vs Post-emission

| Stage | Issues Caught/Fixed |
|---|---|
| Pre-emission (spec validation) | 28 auto-fixed, 28 total issues |
| Post-emission (quality gate) | 169 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "CalendarReader.xaml",
    "Main.xaml",
    "GetTransactionData.xaml",
    "SetTransactionStatus.xaml",
    "CloseAllApplications.xaml",
    "KillAllProcesses.xaml",
    "Process.xaml",
    "&quot;CalendarReader.xaml&quot;"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "Main_Performer.xaml",
      "description": "Catalog: Moved While.Condition from attribute to child-element in Main_Performer.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "ContactResolver.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in ContactResolver.xaml"
    },
    {
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "ContactResolver.xaml",
      "description": "Catalog: Moved ForEach.Values from attribute to child-element in ContactResolver.xaml"
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
      "repairCode": "REPAIR_CATALOG_PROPERTY_SYNTAX",
      "file": "GetTransactionData.xaml",
      "description": "Catalog: Moved ui:GetTransactionItem.TransactionItem from attribute to child-element in GetTransactionData.xaml"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"dt_RunStartTimeUtc\" type from s:DateTime to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_CalendarName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_SenderEmail\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_EmailSubjectTemplate\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_ConfigTimezone\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_EmailLabelPrimary\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_EmailLabelFallback\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"bool_SafetyGateEnabled\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"int_SafetyGateMaxBodyChars\" type from x:Int32 to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_GenAiTemperature\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"int_GenAiMaxTokens\" type from x:Int32 to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_OrchestratorFolder\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"dict_ConfigDictionary\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"dt_RunDateLocal\" type from s:DateTime to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Dispatcher.xaml",
      "description": "Changed variable \"str_RunDateString\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "CalendarReader.xaml",
      "description": "Changed variable \"dt_BirthdayEventsTable\" type from scg2:DataTable to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"dict_ConfigDict\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"bool_IsInitialized\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_PerformerRunId\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_TransactionReference\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_QueueItemId\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"dict_SpecificContent\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_FullName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_RunDate\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_CalendarEventId\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_Tone\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_FirstName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_ResolvedEmail\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_EmailLabelUsed\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_ComposedSubject\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_ComposedBody\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_ItemOutcome\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main_Performer.xaml",
      "description": "Changed variable \"str_ItemOutcomeReason\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_NormalizedFullName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_ResolvedFirstName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"bool_ContactFound\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_PrimaryEmailFound\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_FallbackEmailFound\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"bool_EmailSelectionDone\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_SingleEmailLabel\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_SingleEmailValue\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_ResolvedEmail\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_ResolvedLabel\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "ContactResolver.xaml",
      "description": "Changed variable \"str_ExceptionMessage\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "description": "Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output"
    },
    {
      "repairCode": "REPAIR_TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "description": "Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"str_ResolvedFirstName\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"str_PromptText\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"int_AttemptCount\" type from x:Int32 to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"bool_GenAIRateLimitHit\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"str_ParsedBodyText\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"str_ParsedSafetyStatus\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"str_ParsedSafetyReason\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "MessageComposer.xaml",
      "description": "Changed variable \"bool_ParseErrorOccurred\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "EmailSender.xaml",
      "description": "Changed variable \"str_RecipientEmailNormalized\" type from x:String to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "EmailSender.xaml",
      "description": "Changed variable \"int_SendAttemptNumber\" type from x:Int32 to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "EmailSender.xaml",
      "description": "Changed variable \"dt_SentTimestampUtc\" type from s:DateTime to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "EmailSender.xaml",
      "description": "Changed variable \"bool_EmailSentSuccessfully\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main.xaml",
      "description": "Changed variable \"bool_SystemReady\" type from x:Boolean to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main.xaml",
      "description": "Changed variable \"int_RetryNumber\" type from x:Int32 to x:Object to match Assign.To output type"
    },
    {
      "repairCode": "REPAIR_TYPE_VARIABLE_CHANGE",
      "file": "Main.xaml",
      "description": "Changed variable \"str_ErrorScreenshotPath\" type from x:String to x:Object to match Assign.To output type"
    }
  ],
  "remediations": [
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 138: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 188: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 238: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 288: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 338: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 388: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 438: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 488: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 538: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 588: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Dispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 638: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Dispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 125: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 167: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 209: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 251: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 293: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 335: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 377: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 419: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 461: Undeclared variable \"str_AssetValue\" in expression: str_AssetValue — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main_Performer.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 666: Undeclared variable \"c\" in expression: If(str_FullName.Contains(\" \"), str_FullName.Split(\" \"c)(0), ... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in Main_Performer.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 84: .Replace() expects 2 argument(s) but got 3 in expression: System.Text.RegularExpressions.Regex.Replace(In_FullName.Trim(), \"\\s+\", \" \")",
      "classifiedCheck": "EXPRESSION_SYNTAX_UNFIXABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 92: Undeclared variable \"c\" in expression: If(str_NormalizedFullName.Contains(\" \"), str_NormalizedFullN... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 224: Undeclared variable \"c\" in expression: If(obj_SingleEmailEntry IsNot Nothing, obj_SingleEmailEntry.... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 232: Undeclared variable \"c\" in expression: If(obj_SingleEmailEntry IsNot Nothing, obj_SingleEmailEntry.... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"EmailSender\" in expression: EmailSender — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 178: Type mismatch — variable \"obj_ContactEmailsList\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 206: Type mismatch — variable \"obj_CurrentEmailEntries\" (System.Object) bound to ForEach.Values (expects System.Collections.IEnumerable). Object variable is bound to a property expecting IEnumerable — retype the variable to the correct concrete collection type (e.g., List(Of String), DataTable) based on the upstream activity output",
      "classifiedCheck": "OBJECT_TO_IENUMERABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
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
    },
    {
      "level": "workflow",
      "file": "MessageComposer.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in MessageComposer.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "Main_Dispatcher.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "Main_Dispatcher.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "CalendarReader.xaml",
      "detail": "Contains 2 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "Main_Performer.xaml",
      "detail": "Contains 4 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "Main_Performer.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ContactResolver.xaml",
      "detail": "Contains 9 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "ContactResolver.xaml",
      "detail": "Contains 12 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "MessageComposer.xaml",
      "detail": "Contains 6 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "MessageComposer.xaml",
      "detail": "Contains 9 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 7 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "EmailSender.xaml",
      "detail": "Contains 5 placeholder value(s) matching \"\\bPLACEHOLDER\\b\"",
      "severity": "warning"
    },
    {
      "check": "placeholder-value",
      "file": "&quot;CalendarReader.xaml&quot;",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\"",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_CalendarName&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_SenderEmail&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_EmailSubjectTemplate&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_Timezone&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_EmailLabelPreferencePrimary&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_EmailLabelPreferenceFallback&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_SafetyGateEnabled&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_GenAI_Temperature&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_GenAI_MaxTokens&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"&quot;BG11_Config_OrchestratorFolder&quot;\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Main_Performer.xaml",
      "detail": "Line 610: \"obj_TransactionItem.Reference\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Main_Performer.xaml",
      "detail": "Line 618: \"obj_TransactionItem.Id\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "potentially-null-dereference",
      "file": "Main_Performer.xaml",
      "detail": "Line 626: \"obj_TransactionItem.SpecificContent\" accessed without visible null guard in scope — verify null check exists in enclosing If/TryCatch",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 136: asset name \"&quot;BG11_Config_CalendarName&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 186: asset name \"&quot;BG11_Config_SenderEmail&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 236: asset name \"&quot;BG11_Config_EmailSubjectTemplate&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 286: asset name \"&quot;BG11_Config_Timezone&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 336: asset name \"&quot;BG11_Config_EmailLabelPreferencePrimary&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 386: asset name \"&quot;BG11_Config_EmailLabelPreferenceFallback&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 436: asset name \"&quot;BG11_Config_SafetyGateEnabled&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 486: asset name \"&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 536: asset name \"&quot;BG11_Config_GenAI_Temperature&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 586: asset name \"&quot;BG11_Config_GenAI_MaxTokens&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 636: asset name \"&quot;BG11_Config_OrchestratorFolder&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Main_Performer.xaml",
      "detail": "Line 573: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "Main_Performer.xaml",
      "detail": "Line 576: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Main_Performer.xaml",
      "detail": "Line 573: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "Main_Performer.xaml",
      "detail": "Line 576: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-queue-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 579: queue name \"BG11_BirthdayGreetings_WorkItems\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 123: asset name \"&quot;BG11_Config_SenderEmail&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 165: asset name \"&quot;BG11_Config_EmailSubjectTemplate&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 207: asset name \"&quot;BG11_Config_Timezone&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 249: asset name \"&quot;BG11_Config_EmailLabelPreferencePrimary&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 291: asset name \"&quot;BG11_Config_EmailLabelPreferenceFallback&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 333: asset name \"&quot;BG11_Config_SafetyGateEnabled&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 375: asset name \"&quot;BG11_Config_SafetyGate_MaxBodyChars&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 417: asset name \"&quot;BG11_Config_GenAI_Temperature&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main_Performer.xaml",
      "detail": "Line 459: asset name \"&quot;BG11_Config_GenAI_MaxTokens&quot;\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ContactResolver.xaml",
      "detail": "Line 115: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ContactResolver.xaml",
      "detail": "Line 125: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 115: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 125: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 135: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 145: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageComposer.xaml",
      "detail": "Line 447: retry count hardcoded as 2 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 135: retry interval hardcoded as \"00:00:15\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 145: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageComposer.xaml",
      "detail": "Line 447: retry interval hardcoded as \"00:00:20\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 141: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 161: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 141: retry interval hardcoded as \"00:00:30\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 161: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 107: asset name \"BG11_Cred_Google_Workspace_ServiceUser\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 119: asset name \"BG11_Config_CalendarName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 128: asset name \"BG11_Config_SenderEmail\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 137: asset name \"BG11_Config_EmailSubjectTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 146: asset name \"BG11_Config_Timezone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 155: asset name \"BG11_Config_EmailLabelPreferencePrimary\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 164: asset name \"BG11_Config_EmailLabelPreferenceFallback\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 173: asset name \"BG11_Config_SafetyGateEnabled\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 182: asset name \"BG11_Config_SafetyGate_MaxBodyChars\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 191: asset name \"BG11_Config_GenAI_Temperature\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 200: asset name \"BG11_Config_GenAI_MaxTokens\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 209: asset name \"BG11_Config_OrchestratorFolder\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "MessageComposer.xaml",
      "detail": "Line 351: C# '+' for string concatenation should be VB.NET '&' in expression: \"Primary GenAI response could not be parsed as valid JSON. JsonException: \" + ex...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "MessageComposer.xaml",
      "detail": "Line 415: C# '+' for string concatenation should be VB.NET '&' in expression: \"Primary GenAI JSON field extraction failed (\" + exception.GetType().Name + \"): ...",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 103: Auto-repaired — changed variable \"dt_RunStartTimeUtc\" type from s:DateTime to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 173: Auto-repaired — changed variable \"str_CalendarName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 223: Auto-repaired — changed variable \"str_SenderEmail\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 273: Auto-repaired — changed variable \"str_EmailSubjectTemplate\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 323: Auto-repaired — changed variable \"str_ConfigTimezone\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 373: Auto-repaired — changed variable \"str_EmailLabelPrimary\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 423: Auto-repaired — changed variable \"str_EmailLabelFallback\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 473: Auto-repaired — changed variable \"bool_SafetyGateEnabled\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 523: Auto-repaired — changed variable \"int_SafetyGateMaxBodyChars\" type from x:Int32 to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 573: Auto-repaired — changed variable \"str_GenAiTemperature\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 623: Auto-repaired — changed variable \"int_GenAiMaxTokens\" type from x:Int32 to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 673: Auto-repaired — changed variable \"str_OrchestratorFolder\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 681: Auto-repaired — changed variable \"dict_ConfigDictionary\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 736: Auto-repaired — changed variable \"dt_RunDateLocal\" type from s:DateTime to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Dispatcher.xaml",
      "detail": "Line 744: Auto-repaired — changed variable \"str_RunDateString\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "CalendarReader.xaml",
      "detail": "Line 73: Auto-repaired — changed variable \"dt_BirthdayEventsTable\" type from scg2:DataTable to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 496: Auto-repaired — changed variable \"dict_ConfigDict\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 504: Auto-repaired — changed variable \"bool_IsInitialized\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 555: Auto-repaired — changed variable \"str_PerformerRunId\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 606: Auto-repaired — changed variable \"str_TransactionReference\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 614: Auto-repaired — changed variable \"str_QueueItemId\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 622: Auto-repaired — changed variable \"dict_SpecificContent\" type from scg:Dictionary(x:String, x:Object) to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 630: Auto-repaired — changed variable \"str_FullName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 638: Auto-repaired — changed variable \"str_RunDate\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 646: Auto-repaired — changed variable \"str_CalendarEventId\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 654: Auto-repaired — changed variable \"str_Tone\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 662: Auto-repaired — changed variable \"str_FirstName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 671: Auto-repaired — changed variable \"str_ResolvedEmail\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 679: Auto-repaired — changed variable \"str_EmailLabelUsed\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 687: Auto-repaired — changed variable \"str_ComposedSubject\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 695: Auto-repaired — changed variable \"str_ComposedBody\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 703: Auto-repaired — changed variable \"str_ItemOutcome\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main_Performer.xaml",
      "detail": "Line 711: Auto-repaired — changed variable \"str_ItemOutcomeReason\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 80: Auto-repaired — changed variable \"str_NormalizedFullName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 88: Auto-repaired — changed variable \"str_ResolvedFirstName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 136: Auto-repaired — changed variable \"bool_ContactFound\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 154: Auto-repaired — changed variable \"str_PrimaryEmailFound\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 162: Auto-repaired — changed variable \"str_FallbackEmailFound\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 170: Auto-repaired — changed variable \"bool_EmailSelectionDone\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 220: Auto-repaired — changed variable \"str_SingleEmailLabel\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 228: Auto-repaired — changed variable \"str_SingleEmailValue\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 252: Auto-repaired — changed variable \"str_ResolvedEmail\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 260: Auto-repaired — changed variable \"str_ResolvedLabel\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "ContactResolver.xaml",
      "detail": "Line 408: Auto-repaired — changed variable \"str_ExceptionMessage\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 97: Auto-repaired — changed variable \"str_ResolvedFirstName\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 107: Auto-repaired — changed variable \"str_PromptText\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 156: Auto-repaired — changed variable \"int_AttemptCount\" type from x:Int32 to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 204: Auto-repaired — changed variable \"bool_GenAIRateLimitHit\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 266: Auto-repaired — changed variable \"str_ParsedBodyText\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 274: Auto-repaired — changed variable \"str_ParsedSafetyStatus\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 282: Auto-repaired — changed variable \"str_ParsedSafetyReason\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "MessageComposer.xaml",
      "detail": "Line 331: Auto-repaired — changed variable \"bool_ParseErrorOccurred\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "EmailSender.xaml",
      "detail": "Line 92: Auto-repaired — changed variable \"str_RecipientEmailNormalized\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "EmailSender.xaml",
      "detail": "Line 153: Auto-repaired — changed variable \"int_SendAttemptNumber\" type from x:Int32 to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "EmailSender.xaml",
      "detail": "Line 172: Auto-repaired — changed variable \"dt_SentTimestampUtc\" type from s:DateTime to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "EmailSender.xaml",
      "detail": "Line 180: Auto-repaired — changed variable \"bool_EmailSentSuccessfully\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main.xaml",
      "detail": "Line 75: Auto-repaired — changed variable \"bool_SystemReady\" type from x:Boolean to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main.xaml",
      "detail": "Line 126: Auto-repaired — changed variable \"int_RetryNumber\" type from x:Int32 to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    },
    {
      "check": "TYPE_MISMATCH",
      "file": "Main.xaml",
      "detail": "Line 142: Auto-repaired — changed variable \"str_ErrorScreenshotPath\" type from x:String to x:Object to match Assign.To (System.Object)",
      "severity": "warning"
    }
  ],
  "totalEstimatedEffortMinutes": 465,
  "studioCompatibility": [
    {
      "file": "Main_Dispatcher.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[undeclared-variable] Line 138: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 188: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 238: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 288: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 338: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 388: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 438: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 488: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 538: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 588: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 638: variable \"str_AssetValue\" is used in expression but not declared in this workflow"
      ]
    },
    {
      "file": "CalendarReader.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "Main_Performer.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[undeclared-variable] Line 125: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 167: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 209: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 251: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 293: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 335: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 377: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 419: variable \"str_AssetValue\" is used in expression but not declared in this workflow",
        "[undeclared-variable] Line 461: variable \"str_AssetValue\" is used in expression but not declared in this workflow"
      ]
    },
    {
      "file": "ContactResolver.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[EXPRESSION-SYNTAX] Expression syntax errors that could not be auto-corrected"
      ],
      "failureCategory": "expression-syntax",
      "failureSummary": "Expression syntax errors that could not be auto-corrected"
    },
    {
      "file": "MessageComposer.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "EmailSender.xaml",
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
      "file": "Main.xaml",
      "level": "studio-warnings",
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
      "file": "&quot;CalendarReader.xaml&quot;",
      "level": "studio-warnings",
      "blockers": []
    }
  ],
  "preEmissionValidation": {
    "totalActivities": 175,
    "validActivities": 172,
    "unknownActivities": 3,
    "strippedProperties": 23,
    "enumCorrections": 2,
    "missingRequiredFilled": 0,
    "commentConversions": 3,
    "issueCount": 28
  }
}
```
