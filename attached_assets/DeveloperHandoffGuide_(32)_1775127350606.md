# Developer Handoff Guide

**Project:** BirthdayGreetingsV20
**Generated:** 2026-04-02
**Generation Mode:** Baseline Openable (minimal, deterministic)
**Deployment Readiness:** Not Ready (19%)

**19 workflows: 6 fully generated, 0 with handoff blocks, 13 workflow-level stubs**
**Total Estimated Effort: ~1515 minutes (25.3 hours)**
**Remediations:** 101 total (0 property, 0 activity, 0 sequence, 0 structural-leaf, 8 workflow)
**Auto-Repairs:** 13
**Quality Warnings:** 104

---

### Per-Workflow Preservation Summary

| # | Workflow | Tier | Business Steps (SDD) | Preserved | Degraded (Handoff) | Manual | Bind Points |
|---|----------|------|-------------|-----------|-------------------|--------|-------------|
| 1 | `Main.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 2 | `CalendarReader.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 3 | `QueueDispatcher.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 4 | `PerformerMain.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 5 | `ProcessTransaction.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 6 | `ContactResolver.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 7 | `MessageGenerator.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 8 | `EmailSender.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 9 | `InitAllSettings.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 10 | `{type:literal,value:CalendarReader.xaml}.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 11 | `{type:literal,value:QueueDispatcher.xaml}.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 12 | `{type:literal,value:ProcessTransaction.xaml}.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 13 | `{type:literal,value:ContactResolver.xaml}.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 14 | `{type:literal,value:MessageGenerator.xaml}.xaml` | Generated | 1 | 1 | 0 | 0 | 0 |
| 15 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 16 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 17 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 18 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |
| 19 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}.xaml` | Stub | 1 | 0 | 0 | 1 | 0 |

## 1. Generated Logic (ready to use)

Generated XAML that is Studio-openable and does not contain handoff blocks or workflow-level stubs. May include auto-resolved property remediations or placeholders for fine-tuning.

The following 6 workflow(s) were fully generated and are ready to use:

| # | Workflow | Status | Studio Compatibility |
|---|----------|--------|---------------------|
| 1 | `PerformerMain.xaml` | Generated with Remediations | Openable with warnings |
| 2 | `{type:literal,value:CalendarReader.xaml}.xaml` | Generated with Placeholders | Openable with warnings |
| 3 | `{type:literal,value:QueueDispatcher.xaml}.xaml` | Generated with Placeholders | Openable with warnings |
| 4 | `{type:literal,value:ProcessTransaction.xaml}.xaml` | Generated with Placeholders | Openable with warnings |
| 5 | `{type:literal,value:ContactResolver.xaml}.xaml` | Generated with Placeholders | Openable with warnings |
| 6 | `{type:literal,value:MessageGenerator.xaml}.xaml` | Generated with Placeholders | Openable with warnings |

### AI-Resolved with Smart Defaults (13)

The following issue(s) were automatically corrected during the build pipeline. **No developer action required.**

| # | Code | File | Description | Est. Minutes Saved |
|---|------|------|-------------|-------------------|
| 1 | `REPAIR_PLACEHOLDER_CLEANUP` | `{type:literal,value:CalendarReader.xaml}` | Stripped 1 placeholder token(s) from {type:literal,value:CalendarReader.xaml} | 5 |
| 2 | `REPAIR_PLACEHOLDER_CLEANUP` | `{type:literal,value:QueueDispatcher.xaml}` | Stripped 1 placeholder token(s) from {type:literal,value:QueueDispatcher.xaml} | 5 |
| 3 | `REPAIR_PLACEHOLDER_CLEANUP` | `{type:literal,value:ProcessTransaction.xaml}` | Stripped 1 placeholder token(s) from {type:literal,value:ProcessTransaction.xaml} | 5 |
| 4 | `REPAIR_PLACEHOLDER_CLEANUP` | `{type:literal,value:ContactResolver.xaml}` | Stripped 1 placeholder token(s) from {type:literal,value:ContactResolver.xaml} | 5 |
| 5 | `REPAIR_PLACEHOLDER_CLEANUP` | `{type:literal,value:MessageGenerator.xaml}` | Stripped 1 placeholder token(s) from {type:literal,value:MessageGenerator.xaml} | 5 |
| 6 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved MultipleAssign.Assignments from attribute to child-element in Main.xaml | undefined |
| 7 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml | undefined |
| 8 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml | undefined |
| 9 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml | undefined |
| 10 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml | undefined |
| 11 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved MultipleAssign.Assignments from attribute to child-element in Main.xaml | undefined |
| 12 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved uds:CreateEntity.EntityObject from attribute to child-element in Main.xaml | undefined |
| 13 | `REPAIR_GENERIC` | `Main.xaml` | Catalog (fallback): Moved uds:CreateEntity.EntityObject from attribute to child-element in Main.xaml | undefined |

### Studio Compatibility

| # | Workflow | Compatibility | Failure Category | Blockers |
|---|----------|--------------|-----------------|----------|
| 1 | `Main.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 2 | `CalendarReader.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 3 | `QueueDispatcher.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 4 | `PerformerMain.xaml` | Openable with warnings | Unclassified | — |
| 5 | `ProcessTransaction.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 6 | `ContactResolver.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 7 | `MessageGenerator.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 8 | `EmailSender.xaml` | Structurally invalid — not Studio-loadable | Unclassified | [EXPRESSION_IN_LITERAL_SLOT] Line 57: Variable Default="&amp;quot;screenshots... |
| 9 | `InitAllSettings.xaml` | Studio-openable | — | — |
| 10 | `{type:literal,value:CalendarReader.xaml}` | Openable with warnings | Unclassified | — |
| 11 | `{type:literal,value:QueueDispatcher.xaml}` | Openable with warnings | Unclassified | — |
| 12 | `{type:literal,value:ProcessTransaction.xaml}` | Openable with warnings | Unclassified | — |
| 13 | `{type:literal,value:ContactResolver.xaml}` | Openable with warnings | Unclassified | — |
| 14 | `{type:literal,value:MessageGenerator.xaml}` | Openable with warnings | Unclassified | — |
| 15 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}` | Openable with warnings | Unclassified | — |
| 16 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}` | Openable with warnings | Unclassified | — |
| 17 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}` | Openable with warnings | Unclassified | — |
| 18 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}` | Openable with warnings | Unclassified | — |
| 19 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}` | Openable with warnings | Unclassified | — |

**Summary:** 1 Studio-loadable, 11 with warnings, 7 not Studio-loadable

> **⚠ 7 workflow(s) are not Studio-loadable** — they will fail to open in UiPath Studio. Address the blockers listed above before importing.

## 2. Handoff Blocks (business logic preserved, implementation required)

Blocks where business logic is preserved as documentation but implementation requires manual Studio work. Each entry includes the workflow file, block type, business description from the SDD (when available), expected inputs/outputs, and the developer action required.

No handoff blocks — all logic was fully generated.

## 3. Manual Work Remaining

Consolidated developer TODO list organized by workflow, with estimated effort per item.

**205 items remaining — ~2560 minutes (42.7 hours) total estimated effort**

### CalendarReader.xaml (16 items, ~210 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 1 | High | Workflow Stub | Entire workflow `CalendarReader.xaml` replaced with Studio-openable stub | Fix XML structure in CalendarReader.xaml — ensure proper nesting and closing ... | 15 |
| 2 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 3 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 4 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 5 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 6 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 7 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 8 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 9 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in CalendarReader.xaml — estimated 15 min | 15 |
| 10 | Low | Selector Warning | SELECTOR_LOW_QUALITY: Line 191: Read today&apos;s events from Google Calendar... | Fix selector in Studio | 15 |
| 11 | Low | Quality Warning | invalid-activity-property: Line 227: property "Result" is not a known propert... | Review and address | 10 |
| 12 | Low | Quality Warning | hardcoded-retry-count: Line 131: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 13 | Low | Quality Warning | hardcoded-retry-count: Line 186: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 14 | Low | Quality Warning | hardcoded-retry-interval: Line 131: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |
| 15 | Low | Quality Warning | hardcoded-retry-interval: Line 136: retry interval hardcoded as "{&quot;type&... | Review and address | 10 |
| 16 | Low | Quality Warning | hardcoded-retry-interval: Line 186: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |

### ContactResolver.xaml (10 items, ~130 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 17 | High | Workflow Stub | Entire workflow `ContactResolver.xaml` replaced with Studio-openable stub | Fix XML structure in ContactResolver.xaml — ensure proper nesting and closing... | 15 |
| 18 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 19 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 20 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 21 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 22 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ContactResolver.xaml — estimated 15 min | 15 |
| 23 | Low | Quality Warning | hardcoded-retry-count: Line 191: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 24 | Low | Quality Warning | hardcoded-retry-interval: Line 89: retry interval hardcoded as "{&quot;type&q... | Review and address | 10 |
| 25 | Low | Quality Warning | hardcoded-retry-interval: Line 191: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |
| 26 | Low | Quality Warning | COMPLEX_EXPRESSION_PASSTHROUGH: Line 64: Complex expression (lambdas, LINQ, n... | Review and address | 10 |

### EmailSender.xaml (20 items, ~280 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 27 | High | Workflow Stub | Entire workflow `EmailSender.xaml` replaced with Studio-openable stub | Fix XML structure in EmailSender.xaml — ensure proper nesting and closing tags | 15 |
| 28 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 29 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 30 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 31 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 32 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 33 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 34 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 35 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 36 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 37 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 38 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 39 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 40 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 41 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 42 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in EmailSender.xaml — estimated 15 min | 15 |
| 43 | Low | Quality Warning | hardcoded-retry-count: Line 351: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 44 | Low | Quality Warning | hardcoded-retry-interval: Line 101: retry interval hardcoded as "{&quot;type&... | Review and address | 10 |
| 45 | Low | Quality Warning | hardcoded-retry-interval: Line 351: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |
| 46 | Low | Quality Warning | COMPLEX_EXPRESSION_PASSTHROUGH: Line 69: Complex expression (lambdas, LINQ, n... | Review and address | 10 |

### InitAllSettings.xaml (31 items, ~315 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 47 | High | Workflow Stub | Entire workflow `InitAllSettings.xaml` replaced with Studio-openable stub | Fix XML structure in InitAllSettings.xaml — ensure proper nesting and closing... | 15 |
| 48 | Low | Quality Warning | hardcoded-asset-name: Line 102: asset name "BGV20_GoogleOAuth_Credential" is ... | Review and address | 10 |
| 49 | Low | Quality Warning | hardcoded-asset-name: Line 107: asset name "BGV20_GoogleCalendar_Name" is har... | Review and address | 10 |
| 50 | Low | Quality Warning | hardcoded-asset-name: Line 116: asset name "BGV20_Gmail_FromConnectionName" i... | Review and address | 10 |
| 51 | Low | Quality Warning | hardcoded-asset-name: Line 125: asset name "BGV20_RunTimeZone" is hardcoded —... | Review and address | 10 |
| 52 | Low | Quality Warning | hardcoded-asset-name: Line 134: asset name "BGV20_EmailSubjectTemplate" is ha... | Review and address | 10 |
| 53 | Low | Quality Warning | hardcoded-asset-name: Line 143: asset name "BGV20_EmailPreferenceLabels" is h... | Review and address | 10 |
| 54 | Low | Quality Warning | hardcoded-asset-name: Line 152: asset name "BGV20_SkipIfAmbiguousContactMatch... | Review and address | 10 |
| 55 | Low | Quality Warning | hardcoded-asset-name: Line 161: asset name "BGV20_QueueItemDeferMinutes_OnRat... | Review and address | 10 |
| 56 | Low | Quality Warning | hardcoded-asset-name: Line 170: asset name "BGV20_LogMaskEmails" is hardcoded... | Review and address | 10 |
| 57 | Low | Quality Warning | hardcoded-asset-name: Line 179: asset name "BGV20_GenAI_Temperature" is hardc... | Review and address | 10 |
| 58 | Low | Quality Warning | hardcoded-asset-name: Line 188: asset name "BGV20_GenAI_MaxChars" is hardcode... | Review and address | 10 |
| 59 | Low | Quality Warning | hardcoded-asset-name: Line 197: asset name "BGV20_MaxBirthdaysPerRun" is hard... | Review and address | 10 |
| 60 | Low | Quality Warning | hardcoded-asset-name: Line 206: asset name "BGV20_BusinessSLA_SendByLocalTime... | Review and address | 10 |
| 61 | Low | Quality Warning | hardcoded-asset-name: Line 215: asset name "BGV20_OrchestratorFolderName" is ... | Review and address | 10 |
| 62 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "Settings" for uexcel:ExcelReadRang... | Review and address | 10 |
| 63 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "Constants" for uexcel:ExcelReadRan... | Review and address | 10 |
| 64 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_GoogleOAuth_Credential" for ... | Review and address | 10 |
| 65 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_GoogleCalendar_Name" for ui:... | Review and address | 10 |
| 66 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_Gmail_FromConnectionName" fo... | Review and address | 10 |
| 67 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_RunTimeZone" for ui:GetAsset... | Review and address | 10 |
| 68 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_EmailSubjectTemplate" for ui... | Review and address | 10 |
| 69 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_EmailPreferenceLabels" for u... | Review and address | 10 |
| 70 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_SkipIfAmbiguousContactMatch"... | Review and address | 10 |
| 71 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_QueueItemDeferMinutes_OnRate... | Review and address | 10 |
| 72 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_LogMaskEmails" for ui:GetAss... | Review and address | 10 |
| 73 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_GenAI_Temperature" for ui:Ge... | Review and address | 10 |
| 74 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_GenAI_MaxChars" for ui:GetAs... | Review and address | 10 |
| 75 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_MaxBirthdaysPerRun" for ui:G... | Review and address | 10 |
| 76 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_BusinessSLA_SendByLocalTime"... | Review and address | 10 |
| 77 | Low | Quality Warning | BARE_TOKEN_QUOTED: Auto-quoted bare token "BGV20_OrchestratorFolderName" for ... | Review and address | 10 |

### Main.xaml (9 items, ~105 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 78 | High | Workflow Stub | Entire workflow `Main.xaml` replaced with Studio-openable stub | Fix XML structure in Main.xaml — ensure proper nesting and closing tags | 15 |
| 79 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 80 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in Main.xaml — estimated 15 min | 15 |
| 81 | Low | Quality Warning | invalid-activity-property: Line 266: property "Arguments" is not a known prop... | Review and address | 10 |
| 82 | Low | Quality Warning | invalid-activity-property: Line 327: property "Arguments" is not a known prop... | Review and address | 10 |
| 83 | Low | Quality Warning | hardcoded-asset-name: Line 69: asset name "{&quot;type&quot;:&quot;literal&qu... | Review and address | 10 |
| 84 | Low | Quality Warning | hardcoded-asset-name: Line 108: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 85 | Low | Quality Warning | hardcoded-asset-name: Line 147: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 86 | Low | Quality Warning | hardcoded-asset-name: Line 186: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |

### MessageGenerator.xaml (26 items, ~360 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 87 | High | Workflow Stub | Entire workflow `MessageGenerator.xaml` replaced with Studio-openable stub | Fix XML structure in MessageGenerator.xaml — ensure proper nesting and closin... | 15 |
| 88 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 89 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 90 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 91 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 92 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 93 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 94 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 95 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 96 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 97 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 98 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 99 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 100 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 101 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 102 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 103 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 104 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 105 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 106 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in MessageGenerator.xaml — estimated 15 min | 15 |
| 107 | Low | Quality Warning | hardcoded-retry-count: Line 146: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 108 | Low | Quality Warning | hardcoded-retry-count: Line 196: retry count hardcoded as 3 — consider extern... | Review and address | 10 |
| 109 | Low | Quality Warning | hardcoded-retry-interval: Line 146: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |
| 110 | Low | Quality Warning | hardcoded-retry-interval: Line 151: retry interval hardcoded as "{&quot;type&... | Review and address | 10 |
| 111 | Low | Quality Warning | hardcoded-retry-interval: Line 196: retry interval hardcoded as "00:00:05" — ... | Review and address | 10 |
| 112 | Low | Quality Warning | COMPLEX_EXPRESSION_PASSTHROUGH: Line 333: Complex expression (lambdas, LINQ, ... | Review and address | 10 |

### ProcessTransaction.xaml (38 items, ~505 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 113 | High | Workflow Stub | Entire workflow `ProcessTransaction.xaml` replaced with Studio-openable stub | Fix XML structure in ProcessTransaction.xaml — ensure proper nesting and clos... | 15 |
| 114 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 115 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 116 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 117 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 118 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 119 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 120 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 121 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 122 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 123 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 124 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 125 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 126 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 127 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 128 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 129 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 130 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 131 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 132 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 133 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 134 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 135 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 136 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 137 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in ProcessTransaction.xaml — estimated 15 min | 15 |
| 138 | Low | Quality Warning | invalid-activity-property: Line 138: property "Arguments" is not a known prop... | Review and address | 10 |
| 139 | Low | Quality Warning | invalid-activity-property: Line 138: property "InFullName" is not a known pro... | Review and address | 10 |
| 140 | Low | Quality Warning | invalid-activity-property: Line 138: property "InPreferenceLabels" is not a k... | Review and address | 10 |
| 141 | Low | Quality Warning | invalid-activity-property: Line 138: property "InSkipIfAmbiguous" is not a kn... | Review and address | 10 |
| 142 | Low | Quality Warning | invalid-activity-property: Line 138: property "OutResolvedEmail" is not a kno... | Review and address | 10 |
| 143 | Low | Quality Warning | invalid-activity-property: Line 138: property "OutResolvedEmailLabel" is not ... | Review and address | 10 |
| 144 | Low | Quality Warning | invalid-activity-property: Line 138: property "OutContactOutcome" is not a kn... | Review and address | 10 |
| 145 | Low | Quality Warning | invalid-activity-property: Line 138: property "OutIsAmbiguousMatch" is not a ... | Review and address | 10 |
| 146 | Low | Quality Warning | invalid-activity-property: Line 337: property "InRecipientName" is not a know... | Review and address | 10 |
| 147 | Low | Quality Warning | invalid-activity-property: Line 337: property "InFirstName" is not a known pr... | Review and address | 10 |
| 148 | Low | Quality Warning | invalid-activity-property: Line 337: property "InDateLocal" is not a known pr... | Review and address | 10 |
| 149 | Low | Quality Warning | EXPRESSION_SYNTAX: Line 197: Unbalanced parentheses: 2 open vs 1 close — appe... | Review and address | 10 |
| 150 | Low | Quality Warning | EXPRESSION_SYNTAX: Line 202: Unbalanced parentheses: 3 open vs 6 close — remo... | Review and address | 10 |

### QueueDispatcher.xaml (17 items, ~255 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 151 | High | Workflow Stub | Entire workflow `QueueDispatcher.xaml` replaced with Studio-openable stub | Fix XML structure in QueueDispatcher.xaml — ensure proper nesting and closing... | 15 |
| 152 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 153 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 154 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 155 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 156 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 157 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 158 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 159 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 160 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 161 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 162 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 163 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 164 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 165 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 166 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |
| 167 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in QueueDispatcher.xaml — estimated 15 min | 15 |

### {&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 168 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Impleme... | Implement in Studio | 10 |

### {&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 169 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Impleme... | Implement in Studio | 10 |

### {&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 170 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Impleme... | Implement in Studio | 10 |

### {&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 171 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Impleme... | Implement in Studio | 10 |

### {&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 172 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bPLACEHOLDER\b" [Developer Impleme... | Implement in Studio | 10 |

### {type:literal,value:CalendarReader.xaml}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 173 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation... | Implement in Studio | 10 |

### {type:literal,value:ContactResolver.xaml}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 174 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation... | Implement in Studio | 10 |

### {type:literal,value:MessageGenerator.xaml}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 175 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation... | Implement in Studio | 10 |

### {type:literal,value:ProcessTransaction.xaml}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 176 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation... | Implement in Studio | 10 |

### {type:literal,value:QueueDispatcher.xaml}.xaml (1 item, ~10 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 177 | Low | Implementation Required | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation... | Implement in Studio | 10 |

### PerformerMain.xaml (16 items, ~180 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 178 | Low | Validation Finding | Quality gate finding: `unprefixed-activity` | Manually implement activity in PerformerMain.xaml — estimated 15 min | 15 |
| 179 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in PerformerMain.xaml — estimated 15 min | 15 |
| 180 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in PerformerMain.xaml — estimated 15 min | 15 |
| 181 | Low | Validation Finding | Quality gate finding: `UNDECLARED_VARIABLE` | Manually implement activity in PerformerMain.xaml — estimated 15 min | 15 |
| 182 | Low | Quality Warning | invalid-activity-property: Line 606: property "Arguments" is not a known prop... | Review and address | 10 |
| 183 | Low | Quality Warning | invalid-activity-property: Line 606: property "OutArguments" is not a known p... | Review and address | 10 |
| 184 | Low | Quality Warning | hardcoded-asset-name: Line 126: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 185 | Low | Quality Warning | hardcoded-asset-name: Line 165: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 186 | Low | Quality Warning | hardcoded-asset-name: Line 204: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 187 | Low | Quality Warning | hardcoded-asset-name: Line 243: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 188 | Low | Quality Warning | hardcoded-asset-name: Line 282: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 189 | Low | Quality Warning | hardcoded-asset-name: Line 321: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 190 | Low | Quality Warning | hardcoded-asset-name: Line 360: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 191 | Low | Quality Warning | hardcoded-asset-name: Line 399: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 192 | Low | Quality Warning | hardcoded-asset-name: Line 438: asset name "{&quot;type&quot;:&quot;literal&q... | Review and address | 10 |
| 193 | Low | Quality Warning | EXPRESSION_SYNTAX: Line 543: C# '?.' null-conditional operator converted to V... | Review and address | 10 |

### orchestrator.xaml (12 items, ~120 min)

| # | Priority | Category | Description | Developer Action | Est. Minutes |
|---|----------|----------|-------------|-----------------|-------------|
| 194 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_GoogleCalendar_Name}" is r... | Review and address | 10 |
| 195 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_RunTimeZone}" is reference... | Review and address | 10 |
| 196 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_MaxBirthdaysPerRun}" is re... | Review and address | 10 |
| 197 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_OrchestratorFolderName}" i... | Review and address | 10 |
| 198 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_Gmail_FromConnectionName}"... | Review and address | 10 |
| 199 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_EmailSubjectTemplate}" is ... | Review and address | 10 |
| 200 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_EmailPreferenceLabels}" is... | Review and address | 10 |
| 201 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_SkipIfAmbiguousContactMatc... | Review and address | 10 |
| 202 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_QueueItemDeferMinutes_OnRa... | Review and address | 10 |
| 203 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_LogMaskEmails}" is referen... | Review and address | 10 |
| 204 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_GenAI_Temperature}" is ref... | Review and address | 10 |
| 205 | Low | Quality Warning | undeclared-asset: Asset "{type:literal,value:BGV20_GenAI_MaxChars}" is refere... | Review and address | 10 |

## 4. Process Context (from Pipeline)

### Idea Description

Automate birthday greetings to friends and family

### PDD Summary

## 1. Executive Summary
The “birthday greetings V20” project automates the daily routine of checking a dedicated Google Calendar (“Birthdays”) at 8:00 AM and sending personalized birthday greetings from the user’s Gmail account. Today, the user manually reviews the calendar, looks up an email address in Google Contacts, writes a message in a warm, funny, sarcastic voice, and sends an email. Because the activity is manual, birthdays can occasionally be missed. The future-state design uses UiPath Orchestrator scheduling and queue-based processing to run fully autonomously in the background using unattended robots. The automation reads today’s birthday events from the “Birthdays” calendar, determines the correct recipient email from Google Contacts (preferring “Personal/Home” when multiple exist), generates a highly personal message in the user’s voice using UiPath’s native GenAI/Agents capabilities (without OpenAI), and sends exactly one email per person using the Gmail Integration Service connector configured as `ninemush@gmail.com`. If no email is found, the automation will take no action.

## 2. Process Scope
This PDD covers the end-to-end automated process for sending one birthday email per person whose birthday appears on the current day in the Google Calendar named “Birthdays.” The calendar entries contain the person’s full name (no relationship metadata is stored). Recipient email addresses are sourced from Google Contacts and are labeled as “home” or “personal” when present. The automation’s scope includes: daily scheduling, calendar event retrieval, transaction creation (one transaction per birthday person), contacts lookup, selection of the preferred email address when multiple are available, AI-based message generation in the user’s warm/funny/sarcastic voice using UiPath native capabilities, and sending via Gmail Integration Service using connection `ninemush@gmail.com`.

Out of scope for this iteration are: attaching or selecting photos (e.g., from Google...

### SDD Summary

## 1. Automation Architecture Overview

### 1.1 Chosen automation pattern and rationale
**Pattern:** **Queue-driven fan-out with Dispatcher/Performer** (REFramework-style transaction handling, modernized for integration activities).

**Why this pattern fits:**
- **One email per person** is naturally modeled as **one queue item per birthday person**.
- Provides **transaction-level traceability**, retries, and isolation of failures (one bad contact does not stop all greetings).
- Scales horizontally if multiple birthdays exist (11 unattended slots available).

### 1.2 Automation type selection (RPA vs Agent vs Hybrid)
**Automation type:** **Hybrid (Deterministic RPA + GenAI/Agent)**  
- Deterministic steps (schedule, calendar read, queue, contacts lookup, email send) are best as **unattended RPA** for reliability and auditability.
- Message drafting in a “warm, funny, sarcastic voice” benefits from **UiPath-native GenAI** (Agents / GenAI Activities) to generate natural language while staying on-platform and avoiding OpenAI/Azure OpenAI connectors.

**No Human-in-the-Loop**: The PDD explicitly requires fully autonomous execution and “if no email is found, don’t do anything.” Therefore:
- **Action Center is not in the critical path** and no approval/review tasks are created.
- Action Center will be used only for **optional operational escalation** (non-blocking) if platform operations request it; by default it’s disabled.

### 1.3 Platform services used and why
- **Orchestrator**: schedules 8:00 AM run, manages assets/config, queues, logging, alerts, package deployment.
- **Triggers**: time trigger at 08:00 daily; optional queue trigger for performer scale-out.
- **Queues**: enforces one transaction per birthday person; supports retries and reporting.
- **Integration Service**:
  - **Gmail connector** (connection **`ninemush@gmail.com`**, ID **0a0d5ee1-a1e8-477a-a943-58161e6f3272**) for sending emails.
  - **UiPath GenAI Activities connector** (connection **`prajwal.sha...

**Automation Type:** hybrid
**Rationale:** Calendar/contact retrieval and email sending are deterministic (RPA), but generating a “your voice” warm/funny/sarcastic message is best handled by an AI Agent/GenAI step with guardrails and fallback.
**Feasibility Complexity:** medium
**Effort Estimate:** 1-2 weeks

## 5. Business Process Overview

### Process Steps

| # | Step | Role | System | Type | Pain Point |
|---|------|------|--------|------|------------|
| 1 | 8am Daily Trigger | System | Orchestrator Triggers | start | — |
| 2 | Read Today’s Events from "Birthdays" Calendar | System | Google Calendar (UiPath activity) | task | — |
| 3 | Any Birthday Events Today? | System | Google Calendar (UiPath activity) | decision | — |
| 4 | Create Queue Items (1 per birthday person) | System | Orchestrator Queue | task | — |
| 5 | No Birthdays End | System | Orchestrator | end | — |
| 6 | Dequeue Birthday Person | System | Orchestrator Queue | task | — |
| 7 | Look Up Contact Record by Full Name | System | Google Contacts (UiPath activity) | task | — |
| 8 | Any Email Addresses Found? | System | Google Contacts (UiPath activity) | decision | — |
| 9 | Determine Recipient Email (prefer Personal/Home) | System | Google Contacts (UiPath activity) | task | — |
| 10 | Generate Birthday Message in My Voice | System | UiPath Agents / UiPath GenAI Activities (native) | agent-task | — |
| 11 | Message Meets Tone & Safety Rules? | System | UiPath Agents | agent-decision | — |
| 12 | Send Birthday Email | System | Gmail (Integration Service) - connection "ninemush@gmail.com" | task | — |
| 13 | Greeting Sent End | System | Orchestrator | end | — |
| 14 | Create Human Review Task (low confidence / unsafe content) | System | Action Center | task | — |
| 15 | Approved to Send? | You | Action Center | decision | — |
| 16 | Send Birthday Email (post-approval) | System | Gmail (Integration Service) - connection "ninemush@gmail.com" | task | — |
| 17 | Do Not Send End | System | Orchestrator | end | — |
| 18 | Skip (No Email Found) | System | Orchestrator | task | — |
| 19 | Done End | System | Orchestrator | end | — |

### Target Applications / Systems

The following applications were identified from the process map and must be accessible from the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath activity)
- Orchestrator Queue
- Orchestrator
- Google Contacts (UiPath activity)
- UiPath Agents / UiPath GenAI Activities (native)
- UiPath Agents
- Gmail (Integration Service) - connection "ninemush@gmail.com"
- Action Center

### User Roles Involved

- System
- You

### Decision Points (Process Map Topology)

**Any Birthday Events Today?**
  - [Yes] → Create Queue Items (1 per birthday person)
  - [No] → No Birthdays End

**Any Email Addresses Found?**
  - [Yes] → Determine Recipient Email (prefer Personal/Home)
  - [No] → Skip (No Email Found)

**Approved to Send?**
  - [Yes] → Send Birthday Email (post-approval)
  - [No] → Do Not Send End

## 6. Environment Setup

| Requirement | Value |
|---|---|
| Target Framework | Windows or Portable |
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
| 4 | `UiPath.DataService.Activities` |
| 5 | `UiPath.WebAPI.Activities` |
| 6 | `UiPath.Database.Activities` |

### Target Applications (from Process Map)

The following applications were identified from the business process map. Ensure network connectivity and access credentials are configured on the robot machine:

- Orchestrator Triggers
- Google Calendar (UiPath activity)
- Orchestrator Queue
- Orchestrator
- Google Contacts (UiPath activity)
- UiPath Agents / UiPath GenAI Activities (native)
- UiPath Agents
- Gmail (Integration Service) - connection "ninemush@gmail.com"
- Action Center

## 7. Credential & Asset Inventory

**Total:** 9 activities (9 hardcoded, 0 variable-driven)

### Orchestrator Assets to Provision

| # | Asset Name | Value Type | Consuming Activity | File | Action |
|---|-----------|-----------|-------------------|------|--------|
| 1 | `{type:literal,value:BGV20_Gmail_FromConnectionName}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 2 | `{type:literal,value:BGV20_EmailSubjectTemplate}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 3 | `{type:literal,value:BGV20_EmailPreferenceLabels}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 4 | `{type:literal,value:BGV20_SkipIfAmbiguousContactMatch}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 5 | `{type:literal,value:BGV20_QueueItemDeferMinutes_OnRateLimit}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 6 | `{type:literal,value:BGV20_LogMaskEmails}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 7 | `{type:literal,value:BGV20_GenAI_Temperature}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 8 | `{type:literal,value:BGV20_GenAI_MaxChars}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |
| 9 | `{type:literal,value:BGV20_RunTimeZone}` | Unknown | — | `PerformerMain.xaml` | Create in Orchestrator before deployment |

### Detailed Usage Map

| File | Line | Activity | Asset/Credential | Type | Variable | Hardcoded |
|------|------|----------|-----------------|------|----------|----------|
| `PerformerMain.xaml` | 141 | GetAsset | `{type:literal,value:BGV20_Gmail_FromConnectionName}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 180 | GetAsset | `{type:literal,value:BGV20_EmailSubjectTemplate}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 219 | GetAsset | `{type:literal,value:BGV20_EmailPreferenceLabels}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 258 | GetAsset | `{type:literal,value:BGV20_SkipIfAmbiguousContactMatch}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 297 | GetAsset | `{type:literal,value:BGV20_QueueItemDeferMinutes_OnRateLimit}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 336 | GetAsset | `{type:literal,value:BGV20_LogMaskEmails}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 375 | GetAsset | `{type:literal,value:BGV20_GenAI_Temperature}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 414 | GetAsset | `{type:literal,value:BGV20_GenAI_MaxChars}` | Unknown | — | Yes |
| `PerformerMain.xaml` | 453 | GetAsset | `{type:literal,value:BGV20_RunTimeZone}` | Unknown | — | Yes |

> **Warning:** 9 asset/credential name(s) are hardcoded. Consider externalizing to Orchestrator Config assets for environment portability.

## 8. SDD × XAML Artifact Reconciliation

**Summary:** 0 aligned, 15 SDD-only, 10 XAML-only

> **Warning:** 15 artifact(s) declared in the SDD were not found in the generated XAML. These must be provisioned in Orchestrator but are not referenced in code — verify the SDD spec or add the corresponding activities.

> **Warning:** 10 artifact(s) found in XAML are not declared in the SDD. Update the SDD orchestrator_artifacts block to include these, or the deployment manifest will be incomplete.

| # | Name | Type | Status | SDD Config | XAML File | XAML Line |
|---|------|------|--------|-----------|----------|----------|
| 1 | `BGV20_GoogleCalendar_Name` | asset | **SDD Only** | type: Text, value: Birthdays, description: Target Google Calendar name to read birthday events from. | — | — |
| 2 | `BGV20_Gmail_FromConnectionName` | asset | **SDD Only** | type: Text, value: ninemush@gmail.com, description: Integration Service Gmail connection name used as the sender identity. | — | — |
| 3 | `BGV20_RunTimeZone` | asset | **SDD Only** | type: Text, value: America/New_York, description: Time zone used to compute 'today' for calendar queries and to align the 8:00 AM schedule. | — | — |
| 4 | `BGV20_EmailSubjectTemplate` | asset | **SDD Only** | type: Text, value: Happy Birthday, {FirstName}!, description: Email subject template. Workflow replaces tokens using contact/event-derived data. | — | — |
| 5 | `BGV20_EmailPreferenceLabels` | asset | **SDD Only** | type: Text, value: home,personal, description: Comma-separated preferred Google Contacts email labels (case-insensitive). | — | — |
| 6 | `BGV20_SkipIfAmbiguousContactMatch` | asset | **SDD Only** | type: Bool, value: true, description: If multiple Google Contacts match the same full name, skip sending to avoid wrong recipient. If false, use deterministic first exact match and log ambiguity. | — | — |
| 7 | `BGV20_QueueItemDeferMinutes_OnRateLimit` | asset | **SDD Only** | type: Integer, value: 15, description: If rate limits/transient connector errors occur, defer queue item by N minutes before retry. | — | — |
| 8 | `BGV20_LogMaskEmails` | asset | **SDD Only** | type: Bool, value: true, description: Mask recipient emails in logs to reduce PII exposure while preserving traceability. | — | — |
| 9 | `BGV20_GenAI_Temperature` | asset | **SDD Only** | type: Integer, value: 30, description: GenAI creativity control expressed as an integer percent (0-100). Workflow maps to model temperature (e.g., 0.30). | — | — |
| 10 | `BGV20_GenAI_MaxChars` | asset | **SDD Only** | type: Integer, value: 1200, description: Maximum characters for generated email body to keep messages concise and reduce quota risk. | — | — |
| 11 | `BGV20_MaxBirthdaysPerRun` | asset | **SDD Only** | type: Integer, value: 50, description: Safety cap to prevent runaway runs if the calendar query returns unexpected results. | — | — |
| 12 | `BGV20_BusinessSLA_SendByLocalTime` | asset | **SDD Only** | type: Text, value: 09:00, description: Operational SLA target: all greetings should be sent by this local time on the run day (best-effort; monitoring/alerts should key off this). | — | — |
| 13 | `BGV20_OrchestratorFolderName` | asset | **SDD Only** | type: Text, value: BirthdayGreetings, description: Target Orchestrator folder name where processes/queues/triggers are deployed (used for operator clarity). | — | — |
| 14 | `BGV20_GoogleOAuth_Credential` | credential | **SDD Only** | type: Credential, description: Reserved credential asset for Google OAuth/client secrets if a non-Integration-Service fallback is ever required (not used when Integration Service connections are healthy). | — | — |
| 15 | `{type:literal,value:BGV20_Gmail_FromConnectionName}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 141 |
| 16 | `{type:literal,value:BGV20_EmailSubjectTemplate}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 180 |
| 17 | `{type:literal,value:BGV20_EmailPreferenceLabels}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 219 |
| 18 | `{type:literal,value:BGV20_SkipIfAmbiguousContactMatch}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 258 |
| 19 | `{type:literal,value:BGV20_QueueItemDeferMinutes_OnRateLimit}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 297 |
| 20 | `{type:literal,value:BGV20_LogMaskEmails}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 336 |
| 21 | `{type:literal,value:BGV20_GenAI_Temperature}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 375 |
| 22 | `{type:literal,value:BGV20_GenAI_MaxChars}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 414 |
| 23 | `{type:literal,value:BGV20_RunTimeZone}` | asset | **XAML Only** | — | `PerformerMain.xaml` | 453 |
| 24 | `BGV20_BirthdayGreetings_Transactions` | queue | **SDD Only** | maxRetries: 2, uniqueReference: true, description: One transaction per birthday person (from Google Calendar 'Birthdays') to enforce exactly one email per person, enable retries, and provide auditability. | — | — |
| 25 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_BirthdayGreetings_Transactions&quot;}` | queue | **XAML Only** | — | `PerformerMain.xaml` | 503 |

## 9. Queue Management

**Pattern:** Transactional (Dispatcher/Performer)

### Queues to Provision

| # | Queue Name | Activities | Unique Reference | Auto Retry | SLA | Action |
|---|-----------|------------|-----------------|------------|-----|--------|
| 1 | `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_BirthdayGreetings_Transactions&quot;}` | GetTransactionItem | Recommended | Yes (3x) | — | Create in Orchestrator |

### SDD-Defined Queues (Not Yet in XAML)

| # | Queue Name | Unique Reference | Max Retries | SLA | Note |
|---|-----------|-----------------|-------------|-----|------|
| 1 | `BGV20_BirthdayGreetings_Transactions` | Yes | 2x | — | Defined in SDD but no matching XAML activity — verify implementation |

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

**Coverage:** 13/13 high-risk activities inside TryCatch (100%)

### Files Without TryCatch

- `Main.xaml`
- `CalendarReader.xaml`
- `QueueDispatcher.xaml`
- `ProcessTransaction.xaml`
- `ContactResolver.xaml`
- `MessageGenerator.xaml`
- `EmailSender.xaml`
- `InitAllSettings.xaml`
- `{type:literal,value:CalendarReader.xaml}`
- `{type:literal,value:QueueDispatcher.xaml}`
- `{type:literal,value:ProcessTransaction.xaml}`
- `{type:literal,value:ContactResolver.xaml}`
- `{type:literal,value:MessageGenerator.xaml}`
- `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}`
- `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}`
- `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}`
- `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}`
- `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}`

## 11. Trigger Configuration

Based on the process analysis, the following trigger configuration is recommended:

| # | Trigger Type | Reason | Configuration |
|---|-------------|--------|---------------|
| 1 | **Schedule** | Defined in SDD orchestrator_artifacts: BGV20_08AM_Daily_Dispatcher | SDD-specified: BGV20_08AM_Daily_Dispatcher | Cron: 0 0 8 ? * * * | Daily 8:00 AM local-time dispatcher trigger: reads today's birthdays and enqueues one transaction per person. |
| 2 | **Queue** | Defined in SDD orchestrator_artifacts: BGV20_Queue_Consumer | SDD-specified: BGV20_Queue_Consumer | Queue: BGV20_BirthdayGreetings_Transactions | Queue trigger to process birthday-person transactions (lookup contact, generate message, send email). |

## 12. Upstream Quality Findings

The following quality warnings were produced by upstream pipeline stages (selector scoring, type validation, expression linting, etc.) and should be addressed during development:

| Code | Severity | Count | Sample Message |
|------|----------|-------|----------------|
| placeholder-value | warning | 10 | Contains 1 placeholder value(s) matching "\bTODO\b" [Developer Implementation Required] |
| undeclared-asset | warning | 12 | Asset "{type:literal,value:BGV20_GoogleCalendar_Name}" is referenced in XAML but not declared in orchestrator artifacts |
| invalid-activity-property | warning | 16 | Line 266: property "Arguments" is not a known property of ui:InvokeWorkflowFile |
| hardcoded-asset-name | warning | 27 | Line 69: asset name "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_GoogleCalendar_Name&quot;}" is ... |
| hardcoded-retry-count | warning | 6 | Line 131: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config("MaxRetryNumber")) |
| hardcoded-retry-interval | warning | 10 | Line 131: retry interval hardcoded as "00:00:05" — consider externalizing to Config.xlsx |
| EXPRESSION_SYNTAX | warning | 3 | Line 543: C# '?.' null-conditional operator converted to VB.NET 'If(obj IsNot Nothing, obj.Prop, Nothing)' in expression... |
| COMPLEX_EXPRESSION_PASSTHROUGH | warning | 3 | Line 64: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in... |
| BARE_TOKEN_QUOTED | warning | 16 | Auto-quoted bare token "Settings" for uexcel:ExcelReadRange.SheetName (expected String type) — wrapped in VB string quot... |
| SELECTOR_LOW_QUALITY | warning | 1 | Line 191: Read today&apos;s events from Google Calendar &apos;Birthdays&apos; has low-quality selector (score 0/20) — co... |

## 13. Pre-Deployment Checklist

| # | Category | Task | Required |
|---|----------|------|----------|
| 1 | Deployment | Publish package to Orchestrator feed | Yes |
| 2 | Deployment | Create Process in target folder | Yes |
| 3 | Environment | Verify Orchestrator connection from robot | Yes |
| 4 | Assets | Provision asset: `{type:literal,value:BGV20_Gmail_FromConnectionName}` | Yes |
| 5 | Assets | Provision asset: `{type:literal,value:BGV20_EmailSubjectTemplate}` | Yes |
| 6 | Assets | Provision asset: `{type:literal,value:BGV20_EmailPreferenceLabels}` | Yes |
| 7 | Assets | Provision asset: `{type:literal,value:BGV20_SkipIfAmbiguousContactMatch}` | Yes |
| 8 | Assets | Provision asset: `{type:literal,value:BGV20_QueueItemDeferMinutes_OnRateLimit}` | Yes |
| 9 | Assets | Provision asset: `{type:literal,value:BGV20_LogMaskEmails}` | Yes |
| 10 | Assets | Provision asset: `{type:literal,value:BGV20_GenAI_Temperature}` | Yes |
| 11 | Assets | Provision asset: `{type:literal,value:BGV20_GenAI_MaxChars}` | Yes |
| 12 | Assets | Provision asset: `{type:literal,value:BGV20_RunTimeZone}` | Yes |
| 13 | Queues | Create queue: `{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_BirthdayGreetings_Transactions&quot;}` | Yes |
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

**Overall: Not Ready — 31/50 (19%)**

| Section | Score | Notes |
|---------|-------|-------|
| Credentials & Assets | 5/10 | 9 hardcoded asset name(s) — use Orchestrator assets/config |
| Exception Handling | 7/10 | 18 file(s) with no TryCatch blocks |
| Queue Management | 9/10 | 1 hardcoded queue name(s) — externalize to config |
| Build Quality | 0/10 | 104 quality warnings — significant remediation needed; 101 remediations — stub replacements need developer attention; Entry point (Main.xaml) is stubbed — package has no runnable entry point; 12/19 workflow(s) are Studio-loadable (7 blocked — 37% not loadable) |
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
| Post-emission (quality gate) | 205 warnings/remediations |

---

## 16. Structured Report (JSON)

The following JSON appendix contains the full pipeline outcome report for programmatic consumption:

```json
{
  "fullyGeneratedFiles": [
    "{type:literal,value:CalendarReader.xaml}",
    "{type:literal,value:QueueDispatcher.xaml}",
    "{type:literal,value:ProcessTransaction.xaml}",
    "{type:literal,value:ContactResolver.xaml}",
    "{type:literal,value:MessageGenerator.xaml}"
  ],
  "autoRepairs": [
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "{type:literal,value:CalendarReader.xaml}",
      "description": "Stripped 1 placeholder token(s) from {type:literal,value:CalendarReader.xaml}",
      "developerAction": "Review {type:literal,value:CalendarReader.xaml} for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "{type:literal,value:QueueDispatcher.xaml}",
      "description": "Stripped 1 placeholder token(s) from {type:literal,value:QueueDispatcher.xaml}",
      "developerAction": "Review {type:literal,value:QueueDispatcher.xaml} for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "{type:literal,value:ProcessTransaction.xaml}",
      "description": "Stripped 1 placeholder token(s) from {type:literal,value:ProcessTransaction.xaml}",
      "developerAction": "Review {type:literal,value:ProcessTransaction.xaml} for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "{type:literal,value:ContactResolver.xaml}",
      "description": "Stripped 1 placeholder token(s) from {type:literal,value:ContactResolver.xaml}",
      "developerAction": "Review {type:literal,value:ContactResolver.xaml} for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_PLACEHOLDER_CLEANUP",
      "file": "{type:literal,value:MessageGenerator.xaml}",
      "description": "Stripped 1 placeholder token(s) from {type:literal,value:MessageGenerator.xaml}",
      "developerAction": "Review {type:literal,value:MessageGenerator.xaml} for Comment elements marking where placeholder activities were removed",
      "estimatedEffortMinutes": 5
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved MultipleAssign.Assignments from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved ui:GetAsset.Value from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved MultipleAssign.Assignments from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved uds:CreateEntity.EntityObject from attribute to child-element in Main.xaml"
    },
    {
      "repairCode": "REPAIR_GENERIC",
      "file": "Main.xaml",
      "description": "Catalog (fallback): Moved uds:CreateEntity.EntityObject from attribute to child-element in Main.xaml"
    }
  ],
  "remediations": [
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Activity \"MultipleAssign\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:MultipleAssign\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "Main.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 226: Activity \"MultipleAssign\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:MultipleAssign\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in Main.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Activity \"BuildDataTable\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:BuildDataTable\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 71: Activity \"BuildDataTable\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:BuildDataTable\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 191: Activity \"GoogleSheetsApplicationScope\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:GoogleSheetsApplicationScope\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 328: Activity \"RemoveDuplicateRows\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:RemoveDuplicateRows\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 407: Activity \"AddDataRow\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:AddDataRow\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "PerformerMain.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 484: Activity \"MultipleAssign\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:MultipleAssign\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in PerformerMain.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 61: Activity \"MultipleAssign\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:MultipleAssign\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 196: Activity \"GmailGetMessages\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:GmailGetMessages\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 201: Activity \"HttpClientRequest\" has no namespace prefix — Studio will fail to resolve it. Expected a prefix like \"ui:HttpClientRequest\"",
      "classifiedCheck": "unprefixed-activity",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 385: Undeclared variable \"Summary\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 389: Undeclared variable \"Id\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 393: Undeclared variable \"Start\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in CalendarReader.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Undeclared variable \"yyyy\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Undeclared variable \"dd\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 108: Undeclared variable \"FullName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 112: Undeclared variable \"EventId\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 116: Undeclared variable \"EventStartDate\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 120: Undeclared variable \"_\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 137: Undeclared variable \"FullName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 137: Undeclared variable \"EventId\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 137: Undeclared variable \"EventStartDate\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 137: Undeclared variable \"RunDate\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 137: Undeclared variable \"RunId\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 187: Undeclared variable \"Unknown\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 187: Undeclared variable \"error\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 187: Undeclared variable \"during\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 187: Undeclared variable \"AddQueueItem\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 208: Undeclared variable \"CompletedNoBirthdays\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in QueueDispatcher.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "PerformerMain.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 543: Undeclared variable \"FullName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in PerformerMain.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "PerformerMain.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 543: Undeclared variable \"UnknownPerson\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in PerformerMain.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "PerformerMain.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 807: Undeclared variable \"value\" in expression: value — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in PerformerMain.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 66: Undeclared variable \"FullName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Undeclared variable \"RunDate\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Undeclared variable \"yyyy\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 70: Undeclared variable \"dd\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 74: Undeclared variable \"EventId\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 78: Undeclared variable \"_\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 175: Undeclared variable \"NoEmailFound\" in expression: {&quot;type&quot;:&quot;expression&quot;,&quot;left&quot;:&q... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"No\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"resolvable\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"email\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"address\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"IsAmbiguous\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"sent\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"per\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"business\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 197: Undeclared variable \"rule\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"Duplicate\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"Sent\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"record\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"found\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"TransactionId\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"Email\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"re\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 321: Undeclared variable \"sent\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ProcessTransaction.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 232: Undeclared variable \"unauthorized\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 232: Undeclared variable \"invalid_grant\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 315: Undeclared variable \"emailAddresses\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in ContactResolver.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"artificial\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"intelligence\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"ai\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"generated\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"automation\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"robot\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"machine\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"learning\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"language\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"model\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"chatgpt\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"openai\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"azure\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 64: Undeclared variable \"by\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 68: Undeclared variable \"RecipientName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 72: Undeclared variable \"FirstName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 76: Undeclared variable \"DateLocal\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 80: Undeclared variable \"Notes\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in MessageGenerator.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 74: Undeclared variable \"FirstName\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 90: Undeclared variable \"Happy\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 90: Undeclared variable \"Birthday\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 276: Undeclared variable \"unauthorized\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 276: Undeclared variable \"token\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 276: Undeclared variable \"expired\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 276: Undeclared variable \"authentication\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"invalid\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"recipient\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"address\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"does\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"exist\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"no\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"such\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "validation-finding",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_ACTIVITY_UNKNOWN",
      "reason": "Line 280: Undeclared variable \"user\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot... — variable is not declared in any <Variable> block in scope",
      "classifiedCheck": "UNDECLARED_VARIABLE",
      "developerAction": "Manually implement activity in EmailSender.xaml — estimated 15 min",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "InitAllSettings.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in InitAllSettings.xaml — ensure proper nesting and closing tags",
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
    },
    {
      "level": "workflow",
      "file": "CalendarReader.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in CalendarReader.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "QueueDispatcher.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in QueueDispatcher.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "ProcessTransaction.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in ProcessTransaction.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "ContactResolver.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in ContactResolver.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "MessageGenerator.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in MessageGenerator.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    },
    {
      "level": "workflow",
      "file": "EmailSender.xaml",
      "remediationCode": "STUB_WORKFLOW_BLOCKING",
      "reason": "Final validation: XAML well-formedness violations — replaced with stub",
      "classifiedCheck": "xml-wellformedness",
      "developerAction": "Fix XML structure in EmailSender.xaml — ensure proper nesting and closing tags",
      "estimatedEffortMinutes": 15
    }
  ],
  "propertyRemediations": [],
  "downgradeEvents": [],
  "qualityWarnings": [
    {
      "check": "placeholder-value",
      "file": "{type:literal,value:CalendarReader.xaml}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{type:literal,value:QueueDispatcher.xaml}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{type:literal,value:ProcessTransaction.xaml}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{type:literal,value:ContactResolver.xaml}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{type:literal,value:MessageGenerator.xaml}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bTODO\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "placeholder-value",
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}",
      "detail": "Contains 1 placeholder value(s) matching \"\\bPLACEHOLDER\\b\" [Developer Implementation Required]",
      "severity": "warning",
      "stubCategory": "handoff"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_GoogleCalendar_Name}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_RunTimeZone}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_MaxBirthdaysPerRun}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_OrchestratorFolderName}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_Gmail_FromConnectionName}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_EmailSubjectTemplate}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_EmailPreferenceLabels}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_SkipIfAmbiguousContactMatch}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_QueueItemDeferMinutes_OnRateLimit}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_LogMaskEmails}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_GenAI_Temperature}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "undeclared-asset",
      "file": "orchestrator",
      "detail": "Asset \"{type:literal,value:BGV20_GenAI_MaxChars}\" is referenced in XAML but not declared in orchestrator artifacts",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "Main.xaml",
      "detail": "Line 266: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "Main.xaml",
      "detail": "Line 327: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "CalendarReader.xaml",
      "detail": "Line 227: property \"Result\" is not a known property of ui:ShouldRetry",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "PerformerMain.xaml",
      "detail": "Line 606: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "PerformerMain.xaml",
      "detail": "Line 606: property \"OutArguments\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"Arguments\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"InFullName\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"InPreferenceLabels\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"InSkipIfAmbiguous\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"OutResolvedEmail\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"OutResolvedEmailLabel\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"OutContactOutcome\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 138: property \"OutIsAmbiguousMatch\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 337: property \"InRecipientName\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 337: property \"InFirstName\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "invalid-activity-property",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 337: property \"InDateLocal\" is not a known property of ui:InvokeWorkflowFile",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 69: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_GoogleCalendar_Name&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 108: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_RunTimeZone&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 147: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_MaxBirthdaysPerRun&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "Main.xaml",
      "detail": "Line 186: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_OrchestratorFolderName&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "CalendarReader.xaml",
      "detail": "Line 131: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "CalendarReader.xaml",
      "detail": "Line 186: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "CalendarReader.xaml",
      "detail": "Line 131: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "CalendarReader.xaml",
      "detail": "Line 136: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:10&quot;}\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "CalendarReader.xaml",
      "detail": "Line 186: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 126: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_Gmail_FromConnectionName&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 165: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_EmailSubjectTemplate&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 204: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_EmailPreferenceLabels&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 243: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_SkipIfAmbiguousContactMatch&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 282: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_QueueItemDeferMinutes_OnRateLimit&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 321: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_LogMaskEmails&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 360: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_GenAI_Temperature&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 399: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_GenAI_MaxChars&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "PerformerMain.xaml",
      "detail": "Line 438: asset name \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;BGV20_RunTimeZone&quot;}\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "ContactResolver.xaml",
      "detail": "Line 191: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 89: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:10&quot;}\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "ContactResolver.xaml",
      "detail": "Line 191: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageGenerator.xaml",
      "detail": "Line 146: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "MessageGenerator.xaml",
      "detail": "Line 196: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageGenerator.xaml",
      "detail": "Line 146: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageGenerator.xaml",
      "detail": "Line 151: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:15&quot;}\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "MessageGenerator.xaml",
      "detail": "Line 196: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-count",
      "file": "EmailSender.xaml",
      "detail": "Line 351: retry count hardcoded as 3 — consider externalizing to Config.xlsx (e.g., in_Config(\"MaxRetryNumber\"))",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 101: retry interval hardcoded as \"{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;00:00:30&quot;}\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-retry-interval",
      "file": "EmailSender.xaml",
      "detail": "Line 351: retry interval hardcoded as \"00:00:05\" — consider externalizing to Config.xlsx",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 102: asset name \"BGV20_GoogleOAuth_Credential\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 107: asset name \"BGV20_GoogleCalendar_Name\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 116: asset name \"BGV20_Gmail_FromConnectionName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 125: asset name \"BGV20_RunTimeZone\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 134: asset name \"BGV20_EmailSubjectTemplate\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 143: asset name \"BGV20_EmailPreferenceLabels\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 152: asset name \"BGV20_SkipIfAmbiguousContactMatch\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 161: asset name \"BGV20_QueueItemDeferMinutes_OnRateLimit\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 170: asset name \"BGV20_LogMaskEmails\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 179: asset name \"BGV20_GenAI_Temperature\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 188: asset name \"BGV20_GenAI_MaxChars\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 197: asset name \"BGV20_MaxBirthdaysPerRun\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 206: asset name \"BGV20_BusinessSLA_SendByLocalTime\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "hardcoded-asset-name",
      "file": "InitAllSettings.xaml",
      "detail": "Line 215: asset name \"BGV20_OrchestratorFolderName\" is hardcoded — consider using a Config.xlsx entry or workflow argument",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "PerformerMain.xaml",
      "detail": "Line 543: C# '?.' null-conditional operator converted to VB.NET 'If(obj IsNot Nothing, obj.Prop, Nothing)' in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(transacti...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 197: Unbalanced parentheses: 2 open vs 1 close — appended 1 closing paren(s) | max nesting depth: 2, first imbalance near position 273, fragment: \"&quot;}\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;\\&quot;No re...",
      "severity": "warning"
    },
    {
      "check": "EXPRESSION_SYNTAX",
      "file": "ProcessTransaction.xaml",
      "detail": "Line 202: Unbalanced parentheses: 3 open vs 6 close — removed 3 extra closing paren(s) | max nesting depth: 0, first imbalance near position 177, fragment: \"@\\&quot;), resolvedEmail.Substring(0,2\" in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(InLogMask...",
      "severity": "warning"
    },
    {
      "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
      "file": "ContactResolver.xaml",
      "detail": "Line 64: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;InPreference...",
      "severity": "warning"
    },
    {
      "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
      "file": "MessageGenerator.xaml",
      "detail": "Line 333: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;forbiddenPhr...",
      "severity": "warning"
    },
    {
      "check": "COMPLEX_EXPRESSION_PASSTHROUGH",
      "file": "EmailSender.xaml",
      "detail": "Line 69: Complex expression (lambdas, LINQ, nested calls, or 3+ operators) — emitting as-is to avoid regex corruption in expression: {&quot;type&quot;:&quot;vb_expression&quot;,&quot;value&quot;:&quot;If(InToEmail...",
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
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_GoogleOAuth_Credential\" for ui:GetCredential.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_GoogleCalendar_Name\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_Gmail_FromConnectionName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_RunTimeZone\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_EmailSubjectTemplate\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_EmailPreferenceLabels\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_SkipIfAmbiguousContactMatch\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_QueueItemDeferMinutes_OnRateLimit\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_LogMaskEmails\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_GenAI_Temperature\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_GenAI_MaxChars\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_MaxBirthdaysPerRun\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_BusinessSLA_SendByLocalTime\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "BARE_TOKEN_QUOTED",
      "file": "InitAllSettings.xaml",
      "detail": "Auto-quoted bare token \"BGV20_OrchestratorFolderName\" for ui:GetAsset.AssetName (expected String type) — wrapped in VB string quotes",
      "severity": "warning"
    },
    {
      "check": "SELECTOR_LOW_QUALITY",
      "file": "CalendarReader.xaml",
      "detail": "Line 191: Read today&apos;s events from Google Calendar &apos;Birthdays&apos; has low-quality selector (score 0/20) — consider adding automationid, name, or aaname attributes. Selector: tag:calendar-events-list api:Google-Calendar-v3 scope:BirthdaysCalendar filterDa",
      "severity": "warning",
      "businessContext": "UI interaction \"Read today&apos;s events from Google Calendar &apos;Birthdays&apos;\" should target a specific UI element but selector relies on fragile attributes — add automationid, name, or aaname for resilience"
    }
  ],
  "totalEstimatedEffortMinutes": 1515,
  "studioCompatibility": [
    {
      "file": "Main.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "CalendarReader.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "QueueDispatcher.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "PerformerMain.xaml",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "ProcessTransaction.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "ContactResolver.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "MessageGenerator.xaml",
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
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "InitAllSettings.xaml",
      "level": "studio-blocked",
      "blockers": [
        "[XML-WELLFORMEDNESS] XML well-formedness failure in tree assembler"
      ],
      "failureCategory": "xml-wellformedness",
      "failureSummary": "XML well-formedness failure in tree assembler"
    },
    {
      "file": "{type:literal,value:CalendarReader.xaml}",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "{type:literal,value:QueueDispatcher.xaml}",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "{type:literal,value:ProcessTransaction.xaml}",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "{type:literal,value:ContactResolver.xaml}",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "{type:literal,value:MessageGenerator.xaml}",
      "level": "studio-warnings",
      "blockers": []
    },
    {
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;CalendarReader.xaml&quot;}",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;QueueDispatcher.xaml&quot;}",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ProcessTransaction.xaml&quot;}",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;ContactResolver.xaml&quot;}",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    },
    {
      "file": "{&quot;type&quot;:&quot;literal&quot;,&quot;value&quot;:&quot;MessageGenerator.xaml&quot;}",
      "level": "studio-blocked",
      "blockers": [
        "[COMPLIANCE-FAILURE] Compliance or quality gate failure requiring manual remediation"
      ],
      "failureCategory": "compliance-failure",
      "failureSummary": "Compliance or quality gate failure requiring manual remediation"
    }
  ],
  "emissionGateViolations": {
    "totalViolations": 5,
    "stubbed": 0,
    "corrected": 5,
    "blocked": 0,
    "degraded": 0,
    "details": [
      {
        "file": "{type:literal,value:CalendarReader.xaml}",
        "line": 57,
        "type": "sentinel-expression",
        "detail": "Sentinel expression \"HANDOFF_TODO\" found and replaced with TODO stub",
        "resolution": "corrected"
      },
      {
        "file": "{type:literal,value:QueueDispatcher.xaml}",
        "line": 57,
        "type": "sentinel-expression",
        "detail": "Sentinel expression \"HANDOFF_TODO\" found and replaced with TODO stub",
        "resolution": "corrected"
      },
      {
        "file": "{type:literal,value:ProcessTransaction.xaml}",
        "line": 57,
        "type": "sentinel-expression",
        "detail": "Sentinel expression \"HANDOFF_TODO\" found and replaced with TODO stub",
        "resolution": "corrected"
      },
      {
        "file": "{type:literal,value:ContactResolver.xaml}",
        "line": 57,
        "type": "sentinel-expression",
        "detail": "Sentinel expression \"HANDOFF_TODO\" found and replaced with TODO stub",
        "resolution": "corrected"
      },
      {
        "file": "{type:literal,value:MessageGenerator.xaml}",
        "line": 57,
        "type": "sentinel-expression",
        "detail": "Sentinel expression \"HANDOFF_TODO\" found and replaced with TODO stub",
        "resolution": "corrected"
      }
    ]
  },
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
