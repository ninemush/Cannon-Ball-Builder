# Cannonball XAML Generator — Bug Report
**Project:** POInvoiceReconciliation  
**Studio Version:** 25.10.7 (Windows, VB)  
**Target Framework:** Windows  
**Reported by:** Sumeet Sangawar  
**Date:** 2026-03-16  
**Summary:** 16 distinct bugs found in AI-generated XAML that prevented the project from loading in UiPath Studio 25.x. All bugs required manual PowerShell patching to fix. Every bug is a systematic generator error — not a one-off — meaning it affects every workflow the generator produces.

---

## Bug #1 — `ContinueOnError` Added to Activities That Don't Support It

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** All generated XAML files

### What the generator does (wrong)
```xml
<ui:LogMessage ContinueOnError="False" Level="Info" Message="..." />
<Assign ContinueOnError="False" .../>
<ui:AddQueueItem ContinueOnError="False" .../>
<ui:GetTransactionItem ContinueOnError="False" .../>
<ui:SetTransactionStatus ContinueOnError="False" .../>
```

### What it should do
`ContinueOnError` is only valid on a small subset of UiPath activities (e.g. `Click`, `TypeInto`, `GetText`). It is **not a universal property**. Activities like `LogMessage`, `Assign`, `AddQueueItem`, `GetTransactionItem`, and `SetTransactionStatus` do not have this property and will throw a load error when it is present.

**Fix:** Remove `ContinueOnError` from all activities except those in the UI Automation package that explicitly support it.

---

## Bug #2 — Self-Closing `<While>` and `<RetryScope>` With No Body

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** Main.xaml, InvoicePerformer.xaml, InvoiceDispatcher.xaml

### What the generator does (wrong)
```xml
<While Condition="[someCondition]" DisplayName="While" />
<RetryScope DisplayName="RetryScope" />
```

### What it should do
`While` and `RetryScope` are container activities in WF4 — they **require a non-empty body**. A self-closing tag is structurally invalid and causes a XAML load error.

**Fix:** Always emit a body element. If the body is a placeholder, use a stub `<Sequence>` with a `<LogMessage>` inside:
```xml
<While Condition="[someCondition]" DisplayName="While">
  <While.Body>
    <ActivityAction x:TypeArguments="x:Object">
      <ActivityAction.Handler>
        <Sequence DisplayName="While Body">
          <ui:LogMessage Level="Info" Message="TODO" />
        </Sequence>
      </ActivityAction.Handler>
    </ActivityAction>
  </While.Body>
</While>
```

---

## Bug #3 — `Message` Attribute Value Starts With Single Quote (MarkupExtension Trigger)

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** All generated XAML files

### What the generator does (wrong)
```xml
<ui:LogMessage Message="'some log message text'" />
```

### What it should do
In XAML, a string attribute value that begins with `'` triggers the **MarkupExtension parser**, which then fails to parse it as an expression. This is a fundamental XAML parsing rule.

**Fix:** Wrap string literals in VB expression syntax using `[&quot;...&quot;]`:
```xml
<ui:LogMessage Message="[&quot;some log message text&quot;]" />
```
Or use a plain string without leading single-quote if it is not an expression:
```xml
<ui:LogMessage Message="some log message text" />
```

---

## Bug #4 — `InvokeWorkflowFile` Missing `ui:` Namespace Prefix

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** All generated XAML files that call sub-workflows

### What the generator does (wrong)
```xml
<InvokeWorkflowFile WorkflowFileName="Utilities\LogOutcome.xaml" ...>
```

### What it should do
`InvokeWorkflowFile` is a **UiPath activity**, not a WF4 built-in. It lives in the `ui:` namespace and must be prefixed accordingly:
```xml
<ui:InvokeWorkflowFile WorkflowFileName="Utilities\LogOutcome.xaml" ...>
```
Without the prefix, the XAML loader cannot resolve the type and throws an "unknown type" error.

---

## Bug #5 — `InvokeWorkflowFile` Input/Output Arguments in Invalid Brace Format

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** All generated XAML files that call sub-workflows

### What the generator does (wrong)
```xml
<ui:InvokeWorkflowFile WorkflowFileName="..."
    Input="{ &quot;in_Config&quot;: [config], &quot;in_TransactionItem&quot;: [item] }"
    Output="{ &quot;out_Result&quot;: [result] }" />
```

### What it should do
The `Input` and `Output` attributes do not exist on `InvokeWorkflowFile`. Arguments are passed as child XML elements inside `<ui:InvokeWorkflowFile.InputArguments>` and `<ui:InvokeWorkflowFile.OutputArguments>`. The `{ "key": value }` JSON-like format is entirely invented and is not valid XAML.

**Fix:** Remove the `Input` and `Output` attributes entirely (for exploration), or generate proper argument child elements:
```xml
<ui:InvokeWorkflowFile WorkflowFileName="...">
  <ui:InvokeWorkflowFile.InputArguments>
    <ui:Argument Direction="In" Name="in_Config">[config]</ui:Argument>
  </ui:InvokeWorkflowFile.InputArguments>
</ui:InvokeWorkflowFile>
```

---

## Bug #6 — `TakeScreenshot.OutputPath` — Invented Property Name

**Severity:** 🟠 Medium — breaks XAML loading  
**Files affected:** Main.xaml, InvoicePerformer.xaml

### What the generator does (wrong)
```xml
<ui:TakeScreenshot OutputPath="[str_ScreenshotPath]" DisplayName="Take Screenshot" />
```

### What it should do
`OutputPath` is not a property of `TakeScreenshot` in UiPath 25.x. The activity stores its result via a `Result` output argument. The correct usage is:
```xml
<ui:TakeScreenshot DisplayName="Take Screenshot">
  <ui:TakeScreenshot.Result>
    <OutArgument x:TypeArguments="ui:Image">[str_ScreenshotPath]</OutArgument>
  </ui:TakeScreenshot.Result>
</ui:TakeScreenshot>
```

**Fix for exploration:** Remove `OutputPath` attribute entirely.

---

## Bug #7 — `AddLogFields.Fields` Uses `Dictionary<String, ui:InArgument>` (Invalid Type)

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** All generated XAML files

### What the generator does (wrong)
```xml
<ui:AddLogFields DisplayName="Add Log Fields">
  <ui:AddLogFields.Fields>
    <scg:Dictionary x:TypeArguments="x:String, ui:InArgument">
      <InArgument x:TypeArguments="x:String" x:Key="ErrorStep">"step name"</InArgument>
    </scg:Dictionary>
  </ui:AddLogFields.Fields>
</ui:AddLogFields>
```

### What it should do
`ui:InArgument` does not exist as a type. `InArgument` belongs to the `System.Activities` WF4 namespace, not the UiPath `ui:` namespace. The `AddLogFields.Fields` property expects a `Dictionary<String, Object>` (or similar), not `Dictionary<String, InArgument>`.

**Fix:** The correct `Fields` format uses plain object values:
```xml
<ui:AddLogFields DisplayName="Add Log Fields">
  <ui:AddLogFields.Fields>
    <scg:Dictionary x:TypeArguments="x:String, x:Object">
      <x:String x:Key="ErrorStep">step name</x:String>
    </scg:Dictionary>
  </ui:AddLogFields.Fields>
</ui:AddLogFields>
```

---

## Bug #8 — `Switch.Cases` Uses Fake `<Case>` Wrapper Element

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** Main.xaml, InvoicePerformer.xaml, InvoiceDispatcher.xaml

### What the generator does (wrong)
```xml
<Switch x:TypeArguments="x:String" Expression="[processMode]">
  <Switch.Cases>
    <Case x:TypeArguments="x:String" Value="DISPATCHER">
      <Sequence DisplayName="Run Dispatcher">
        ...
      </Sequence>
    </Case>
  </Switch.Cases>
</Switch>
```

### What it should do
`Case` is **not a WF4 type**. It doesn't exist in `System.Activities`. In WF4 XAML, `Switch<T>.Cases` is a `Dictionary<T, Activity>` — entries are added by putting `x:Key` directly on the child activity element (no wrapper):

```xml
<Switch x:TypeArguments="x:String" Expression="[processMode]">
  <Switch.Cases>
    <Sequence x:Key="DISPATCHER" DisplayName="Run Dispatcher">
      ...
    </Sequence>
  </Switch.Cases>
  <Switch.Default>
    <Sequence DisplayName="Default">
      ...
    </Sequence>
  </Switch.Default>
</Switch>
```

---

## Bug #9 — `sap2010:WorkflowViewState.ViewStateManager` Block Present (Rejected by Studio 25.x)

**Severity:** 🔴 Critical — Studio 25.x explicitly throws `NotSupportedException`  
**Files affected:** All generated XAML files

### What the generator does (wrong)
The generator appends a large `ViewStateManager` block at the end of every XAML file:
```xml
<sap2010:WorkflowViewState.ViewStateManager>
  <sap2010:ViewStateManager>
    <sap2010:ViewStateData Id="Sequence_2" sap:VirtualizedContainerService.HintSize="400,300">
      <sap:WorkflowViewStateService.ViewState>
        <scg:Dictionary x:TypeArguments="x:String, x:Object">
          <x:Boolean x:Key="IsExpanded">True</x:Boolean>
        </scg:Dictionary>
      </sap:WorkflowViewStateService.ViewState>
    </sap2010:ViewStateData>
    ... (hundreds of lines)
  </sap2010:ViewStateManager>
</sap2010:WorkflowViewState.ViewStateManager>
```

### What it should do
Studio 25.x uses **inline view state only** — via `sap2010:WorkflowViewState.IdRef` attributes on each activity element. The `ViewStateManager` block is the **old (pre-22.x) format** and Studio 25.x throws:

> `NotSupportedException: Old XAML format using ViewStateManager is not supported.`

**Fix:** Do not emit the `ViewStateManager` block at all. The `sap2010:WorkflowViewState.IdRef` attributes already on each activity are sufficient.

---

## Bug #10 — Document Understanding Activities Without DU Package

**Severity:** 🟠 Medium — breaks XAML loading if DU package not installed  
**Files affected:** DocumentUnderstanding\ExtractInvoiceData.xaml

### What the generator does (wrong)
```xml
<ui:DigitizeDocument ... />
<ui:ClassifyDocument ... />
<ui:DataExtractionScope ... />
```

### What it should do
These activities come from `UiPath.IntelligentOCR.Activities`, which is a **separate package** that must be explicitly declared in `project.json`. The generator added these activities but did not add the package dependency, causing "unknown type" errors.

**Fix:** Either:
1. Add `UiPath.IntelligentOCR.Activities` to `project.json` dependencies, OR
2. Replace with stub `LogMessage` activities if the package is not available

---

## Bug #11 — `ExcelApplicationScope` Missing `ActivityAction` Body Wrapper

**Severity:** 🔴 High — breaks XAML loading  
**Files affected:** InitAllSettings.xaml

### What the generator does (wrong)
```xml
<ui:ExcelApplicationScope WorkbookPath="[str_ConfigFilePath]">
  <Sequence DisplayName="Excel Body">
    ...
  </Sequence>
</ui:ExcelApplicationScope>
```

### What it should do
`ExcelApplicationScope.Body` expects an `ActivityAction<WorkbookApplication>` wrapper, not a bare `Sequence`:

```xml
<ui:ExcelApplicationScope WorkbookPath="[str_ConfigFilePath]">
  <ui:ExcelApplicationScope.Body>
    <ActivityAction x:TypeArguments="x:Object">
      <ActivityAction.Handler>
        <Sequence DisplayName="Excel Body">
          ...
        </Sequence>
      </ActivityAction.Handler>
    </ActivityAction>
  </ui:ExcelApplicationScope.Body>
</ui:ExcelApplicationScope>
```

---

## Bug #12 — Package Dependency Version Mismatch (project.json)

**Severity:** 🟠 Medium — causes DLL conflict at Studio load time  
**Files affected:** project.json

### What the generator does (wrong)
The generator pinned `UiPath.UIAutomation.Activities` to version `23.10.0` while also using `UiPath.Excel.Activities 3.4.1`. These two packages shipped the same version of a shared Outlook DLL, causing a duplicate key error when Studio tried to load the project.

### What it should do
The generator should target **compatible, recent package versions** that don't have shared DLL conflicts. For Studio 25.x projects, `UiPath.UIAutomation.Activities` should be `25.x.x` (not `23.x.x`).

**Fix applied:** Upgraded `UiPath.UIAutomation.Activities` from `23.10.0` → `25.10.28` in `project.json`.

---

## Bug #13 — All Activities Wrapped in `<ui:UnresolvedActivity>`

**Severity:** 🔴 Critical — makes the entire workflow unusable and unreadable.
**Files affected:** All generated XAML files with logic.

### What the generator does (wrong)
Instead of generating a standard activity like `<ui:LogMessage ... />`, the generator wraps it in a placeholder format:

```xml
<ui:UnresolvedActivity DisplayName="Log Start (LogMessage)" ...>
  <ui:UnresolvedActivity.Body>
    <scg:List x:TypeArguments="Activity" Capacity="0" />
  </ui:UnresolvedActivity.Body>
  <ui:UnresolvedActivity.PropertiesContainer>
    <x:String x:Key="Level">Info</x:String>
    <x:String x:Key="Message">"some message"</x:String>
  </ui:UnresolvedActivity.PropertiesContainer>
</ui:UnresolvedActivity>
```

### What it should do
It should generate the standard, direct XAML for the activity itself. The `UnresolvedActivity` wrapper is a Studio-internal representation for when a package is missing, but in this case, the generator is *emitting* it as the primary format, which is fundamentally incorrect.

**Fix:** The generator must be changed to emit standard XAML for all activities, not this wrapper format. For example, the above should be:

```xml
<ui:LogMessage DisplayName="Log Start" Level="Info" Message="[&quot;some message&quot;]" />
```
This was the most complex bug to fix, requiring a recursive PowerShell script to unwrap the nested activities from the inside out.

---

## Bug #14 — `project.json` Package Pinning with `[version]` Syntax

**Severity:** 🟠 Medium — causes "package not found" errors
**Files affected:** project.json

### What the generator does (wrong)
```json
"dependencies": {
  "UiPath.Web.Activities": "[1.18.0]",
  "UiPath.Mail.Activities": "[2.7.10]"
}
```

### What it should do
The `[version]` bracket syntax pins the dependency to an **exact version**. If that specific version is not available in any of the user's configured NuGet feeds, Studio cannot resolve the dependency and marks all activities from that package as unresolved.

**Fix:** The generator should use the standard minimum-version syntax (no brackets), which allows Studio to fetch any compatible higher version available in the feeds:
```json
"dependencies": {
  "UiPath.Web.Activities": "1.18.0",
  "UiPath.Mail.Activities": "2.7.10"
}
```

---

## Bug #15 — `Assign` Activity with Invalid `ui:` Prefix and Attribute Format

**Severity:** 🔴 High — breaks XAML loading
**Files affected:** Main.xaml

### What the generator does (wrong)
```xml
<ui:Assign DisplayName="..." To="logContext" Value="New Dictionary(...) ..." />
```

### What it should do
`Assign` is a fundamental WF4 built-in activity from `System.Activities` and must **not** have a `ui:` prefix. Furthermore, it requires child elements for its `To` and `Value` properties; it does not support the attribute-based format.

**Fix:** Generate the correct, unprefixed XAML with child elements:
```xml
<Assign DisplayName="...">
  <Assign.To><OutArgument x:TypeArguments="x:Object">[logContext]</OutArgument></Assign.To>
  <Assign.Value><InArgument x:TypeArguments="x:Object">[New Dictionary(...)]</InArgument></Assign.Value>
</Assign>
```

---

## Bug #16 — Invalid VB Expressions (Missing Brackets, Double Quoting)

**Severity:** 🔴 High — causes VB compiler errors, breaking XAML loading
**Files affected:** Main.xaml

### What the generator does (wrong)
1.  **Variable Default without `[...]` wrapper:**
    ```xml
    <Variable x:TypeArguments="x:String" Default="&quot;screenshots/error_&quot; &amp; DateTime.Now.ToString(&quot;yyyyMMdd_HHmmss&quot;) &amp; &quot;.png&quot;" Name="str_ScreenshotPath" />
    ```
2.  **Log Message with double-quoted string:**
    ```xml
    <ui:LogMessage Message="[&quot;&quot;POInvoiceReconciliation Main.xaml started...&quot;]">
    ```

### What it should do
All VB expressions must be syntactically valid.
1.  All expressions, including in `Variable.Default`, must be wrapped in `[...]`.
2.  String literals inside a VB expression should be enclosed in a single pair of quotes (`"..."`), not double quotes (`""...""`).

**Fix:**
1.  Wrap the `Default` value in `[...]`.
2.  Remove the extra quotes from the `LogMessage` expression.

```xml
<Variable ... Default="[&quot;screenshots/error_&quot; &amp; DateTime.Now.ToString(&quot;yyyyMMdd_HHmmss&quot;) &amp; &quot;.png&quot;]" ... />
<ui:LogMessage Message="[&quot;POInvoiceReconciliation Main.xaml started...&quot;]">
```

---

## Summary Table

| # | Bug | Impact | XAML/JSON Location |
|---|-----|--------|-------------------|
| 1 | `ContinueOnError` on incompatible activities | Load error | All `.xaml` |
| 2 | Self-closing `While` / `RetryScope` | Load error | All `.xaml` |
| 3 | `Message="'text'"` triggers MarkupExtension parser | Load error | All `.xaml` |
| 4 | `InvokeWorkflowFile` missing `ui:` prefix | Load error | All `.xaml` |
| 5 | `Input/Output="{...}"` fake JSON format on InvokeWorkflowFile | Load error | All `.xaml` |
| 6 | `TakeScreenshot.OutputPath` — invented property | Load error | Main.xaml, InvoicePerformer.xaml |
| 7 | `AddLogFields.Fields` uses `Dictionary<String, ui:InArgument>` | Load error | All `.xaml` |
| 8 | `Switch.Cases` uses fake `<Case>` wrapper type | Load error | Main.xaml, InvoicePerformer.xaml, InvoiceDispatcher.xaml |
| 9 | `ViewStateManager` block present — rejected by Studio 25.x | **Critical** load error | All `.xaml` |
| 10 | DU activities without DU package in `project.json` | Load error | project.json + DU `.xaml` |
| 11 | `ExcelApplicationScope` missing `ActivityAction` body wrapper | Load error | InitAllSettings.xaml |
| 12 | Package version mismatch causing DLL conflict | Load error | project.json |
| 13 | All activities wrapped in `<ui:UnresolvedActivity>` | **Critical** load error | All `.xaml` |
| 14 | `project.json` package pinning with `[version]` | Load error | project.json |
| 15 | `Assign` with invalid `ui:` prefix and attribute format | Load error | Main.xaml |
| 16 | Invalid VB expressions (missing brackets, double quotes) | Load error | Main.xaml |

---

## Recommended Priority for Cannonball Fixes

1. **Bug #13** — UnresolvedActivity wrapper: most critical functional bug, affects all logic
2. **Bug #9** — ViewStateManager: easiest win, single change, affects every file
3. **Bug #4** — InvokeWorkflowFile prefix: affects every multi-file project
4. **Bug #5** — InvokeWorkflowFile arguments: affects every sub-workflow call
5. **Bug #1** — ContinueOnError: affects every generated activity
6. **Bug #3** — Message quote format: affects every LogMessage
7. **Bug #8** — Switch/Case: affects every Switch activity
8. **Bug #2** — While/RetryScope body: affects every loop/retry
9. **Bug #7** — AddLogFields type: affects every logging pattern
10. **Bug #11** — ExcelApplicationScope body: affects every Excel workflow
11. **Bug #6** — TakeScreenshot property: affects screenshot activities
12. **Bug #10** — DU package dependency: affects Document Understanding workflows
13. **Bug #6** — TakeScreenshot property: affects screenshot activities
14. **Bug #10** — DU package dependency: affects Document Understanding workflows
15. **Bug #12** — Package versions: requires version compatibility matrix
16. **Bug #14** — Package pinning: requires feed-aware logic

---

*All fixes were applied via PowerShell scripts. Fix scripts are available in the project root:*
`FixXamls.ps1`, `FixRemaining.ps1`, `FixInvokeArgs.ps1`, `FixSubQuotes.ps1`,
`FixInvokePrefix.ps1`, `FixTakeScreenshot.ps1`, `FixAddLogFields.ps1`,
`FixSwitchCases.ps1`, `FixViewStateManager.ps1`, `FixUnresolvedActivities.ps1`,
`FixUiAssign.ps1`, `FixMainExpressions.ps1`
