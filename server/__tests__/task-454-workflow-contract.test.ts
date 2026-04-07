import { describe, it, expect } from "vitest";
import { parseInvokeArguments, type InvokeArgumentBinding } from "../workflow-tree-assembler";
import { buildCrossWorkflowArgContracts, REFRAMEWORK_INFRASTRUCTURE_FILES, ensureReframeworkWiringOnMain, isChainOrderCorrect, canonicalizeChainOrder, type CrossWorkflowContractDefect } from "../package-assembler";
import { validateWorkflowGraph } from "../xaml/workflow-graph-validator";

describe("Task 454: Workflow contract and REFramework wiring", () => {

  describe("T001: InvokeWorkflowFile argument parsing from tree spec", () => {

    it("should parse individual in_/out_/io_ named properties as typed argument bindings", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Process.xaml",
        DisplayName: "Invoke Process",
        in_TransactionItem: "qi_TransactionItem",
        out_Status: "str_Status",
        io_Config: "dict_Config",
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(3);

      const inBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "in_TransactionItem");
      expect(inBinding).toBeDefined();
      expect(inBinding!.direction).toBe("InArgument");

      const outBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "out_Status");
      expect(outBinding).toBeDefined();
      expect(outBinding!.direction).toBe("OutArgument");

      const ioBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "io_Config");
      expect(ioBinding).toBeDefined();
      expect(ioBinding!.direction).toBe("InOutArgument");
    });

    it("should decompose Dictionary(Of String, Object) From {...} into individual typed bindings", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Init.xaml",
        DisplayName: "Invoke Init",
        Arguments: 'Dictionary(Of String, Object) From {{"out_Config", dictConfig}, {"in_MaxRetry", int_MaxRetry}}',
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(2);

      const outConfig = bindings.find((b: InvokeArgumentBinding) => b.name === "out_Config");
      expect(outConfig).toBeDefined();
      expect(outConfig!.direction).toBe("OutArgument");
      expect(outConfig!.type).toBe("");
      expect(outConfig!.typeInferredFromDefault).toBe(true);

      const inMaxRetry = bindings.find((b: InvokeArgumentBinding) => b.name === "in_MaxRetry");
      expect(inMaxRetry).toBeDefined();
      expect(inMaxRetry!.direction).toBe("InArgument");
      expect(inMaxRetry!.type).toBe("x:Int32");
      expect(inMaxRetry!.typeInferredFromDefault).toBe(false);
    });

    it("should produce no bindings when no argument properties are present", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Process.xaml",
        DisplayName: "Invoke Process",
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(0);
    });

    it("should handle mixed-case direction prefixes correctly", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Process.xaml",
        Out_Status: "str_Status",
        IO_Config: "dict_Config",
        IN_Name: "str_Name",
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(3);

      const outBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "Out_Status");
      expect(outBinding).toBeDefined();
      expect(outBinding!.direction).toBe("OutArgument");

      const ioBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "IO_Config");
      expect(ioBinding).toBeDefined();
      expect(ioBinding!.direction).toBe("InOutArgument");

      const inBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "IN_Name");
      expect(inBinding).toBeDefined();
      expect(inBinding!.direction).toBe("InArgument");
    });

    it("should infer types from value prefixes (not argument name prefixes)", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Process.xaml",
        in_Name: "str_Name",
        in_Count: "int_Count",
        out_Success: "bool_Success",
        io_DataTable: "dt_Results",
      };
      const bindings = parseInvokeArguments(props);

      const strBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "in_Name");
      expect(strBinding!.type).toBe("x:String");
      expect(strBinding!.typeInferredFromDefault).toBe(false);

      const intBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "in_Count");
      expect(intBinding!.type).toBe("x:Int32");
      expect(intBinding!.typeInferredFromDefault).toBe(false);

      const boolBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "out_Success");
      expect(boolBinding!.type).toBe("x:Boolean");

      const dtBinding = bindings.find((b: InvokeArgumentBinding) => b.name === "io_DataTable");
      expect(dtBinding!.type).toBe("scg2:DataTable");
    });

    it("should emit empty type and flag typeInferredFromDefault when value has no recognizable prefix", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Process.xaml",
        in_Data: "myVariable",
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(1);
      expect(bindings[0].type).toBe("");
      expect(bindings[0].typeInferredFromDefault).toBe(true);
    });

    it("should skip non-argument system properties", () => {
      const props: Record<string, any> = {
        WorkflowFileName: "Workflow.xaml",
        DisplayName: "Test",
        ContinueOnError: "True",
        Timeout: "00:00:30",
        Isolated: "False",
        in_Input: "str_Value",
      };
      const bindings = parseInvokeArguments(props);
      expect(bindings.length).toBe(1);
      expect(bindings[0].name).toBe("in_Input");
    });
  });

  describe("T002: Cross-workflow argument contract with evidence gate", () => {

    it("should declare arguments on target workflow from upstream InvokeWorkflowFile bindings", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Invoke Process">
      <ui:InvokeWorkflowFile.Arguments>
        <InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Name]</InArgument>
        <OutArgument x:TypeArguments="x:Boolean" x:Key="out_Success">[bool_Result]</OutArgument>
      </ui:InvokeWorkflowFile.Arguments>
    </ui:InvokeWorkflowFile>
  </Sequence>
</Activity>`);
      deferredWrites.set("lib/Process.xaml", `<Activity x:Class="Process">
  <Sequence DisplayName="Process">
    <ui:LogMessage Level="Info" Message="Processing" />
  </Sequence>
</Activity>`);

      const xamlEntries: Array<{ name: string; content: string }> = [];
      const result = buildCrossWorkflowArgContracts(deferredWrites, xamlEntries, "lib");

      expect(result.declarationsEmitted).toBe(2);
      expect(result.defects.length).toBe(0);

      const processContent = deferredWrites.get("lib/Process.xaml")!;
      expect(processContent).toContain('x:Property Name="in_Name"');
      expect(processContent).toContain('x:Property Name="out_Success"');
    });

    it("should detect caller-conflict when two callers disagree on argument direction", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/CallerA.xaml", `<Activity x:Class="CallerA">
  <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
    <ui:InvokeWorkflowFile.Arguments>
      <InArgument x:TypeArguments="x:String" x:Key="io_Config">[str_Config]</InArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Activity>`);
      deferredWrites.set("lib/CallerB.xaml", `<Activity x:Class="CallerB">
  <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
    <ui:InvokeWorkflowFile.Arguments>
      <OutArgument x:TypeArguments="x:String" x:Key="io_Config">[str_Config]</OutArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Activity>`);
      deferredWrites.set("lib/Target.xaml", `<Activity x:Class="Target">
  <Sequence DisplayName="Target">
    <ui:LogMessage Level="Info" Message="Target" />
  </Sequence>
</Activity>`);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      expect(result.defects.length).toBe(1);
      expect(result.defects[0].defectType).toBe("caller_conflict");
      expect(result.defects[0].argumentName).toBe("io_Config");
      expect(result.declarationsEmitted).toBe(0);
    });

    it("should detect caller-conflict when two callers disagree on argument type", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/CallerA.xaml", `<Activity x:Class="CallerA">
  <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
    <ui:InvokeWorkflowFile.Arguments>
      <InArgument x:TypeArguments="x:String" x:Key="in_Data">[str_Data]</InArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Activity>`);
      deferredWrites.set("lib/CallerB.xaml", `<Activity x:Class="CallerB">
  <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
    <ui:InvokeWorkflowFile.Arguments>
      <InArgument x:TypeArguments="x:Int32" x:Key="in_Data">[int_Data]</InArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Activity>`);
      deferredWrites.set("lib/Target.xaml", `<Activity x:Class="Target">
  <Sequence DisplayName="Target">
    <ui:LogMessage Level="Info" Message="Target" />
  </Sequence>
</Activity>`);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      expect(result.defects.length).toBe(1);
      expect(result.defects[0].defectType).toBe("caller_conflict");
      expect(result.defects[0].argumentName).toBe("in_Data");
    });

    it("should insert x:Members directly after Activity open tag, not inside Sequence", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Caller.xaml", `<Activity x:Class="Caller">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
      <ui:InvokeWorkflowFile.Arguments>
        <InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Name]</InArgument>
      </ui:InvokeWorkflowFile.Arguments>
    </ui:InvokeWorkflowFile>
  </Sequence>
</Activity>`);
      deferredWrites.set("lib/Target.xaml", `<Activity x:Class="Target">
  <Sequence DisplayName="Target">
    <ui:LogMessage Level="Info" Message="hello" />
  </Sequence>
</Activity>`);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      expect(result.declarationsEmitted).toBe(1);

      const targetContent = deferredWrites.get("lib/Target.xaml")!;
      const activityCloseIdx = targetContent.indexOf('>', targetContent.indexOf('<Activity'));
      const membersIdx = targetContent.indexOf('<x:Members>');
      const sequenceIdx = targetContent.indexOf('<Sequence');
      expect(membersIdx).toBeGreaterThan(activityCloseIdx);
      expect(membersIdx).toBeLessThan(sequenceIdx);
    });

    it("should not duplicate existing argument declarations", () => {
      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", `<Activity x:Class="Main">
  <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml">
    <ui:InvokeWorkflowFile.Arguments>
      <InArgument x:TypeArguments="x:String" x:Key="in_Name">[str_Name]</InArgument>
    </ui:InvokeWorkflowFile.Arguments>
  </ui:InvokeWorkflowFile>
</Activity>`);
      deferredWrites.set("lib/Process.xaml", `<Activity x:Class="Process">
  <x:Members>
    <x:Property Name="in_Name" Type="InArgument(x:String)" />
  </x:Members>
  <Sequence DisplayName="Process">
    <ui:LogMessage Level="Info" Message="Processing" />
  </Sequence>
</Activity>`);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      expect(result.declarationsEmitted).toBe(0);
      expect(result.defects.length).toBe(0);
    });
  });

  describe("T003: REFramework wiring and idempotence", () => {

    it("should detect REFramework wiring in properly wired Main.xaml", () => {
      const mainXaml = `<Activity x:Class="Main">
  <StateMachine>
    <State DisplayName="Init">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Get Transaction Data">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Process">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Set Transaction Status">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" />
        </Sequence>
      </State.Entry>
    </State>
  </StateMachine>
</Activity>`;

      const entries = [
        { name: "Main.xaml", content: mainXaml },
        { name: "Init.xaml", content: '<Activity x:Class="Init"><Sequence><ui:InvokeWorkflowFile WorkflowFileName="InitAllSettings.xaml" /></Sequence></Activity>' },
        { name: "InitAllSettings.xaml", content: '<Activity x:Class="InitAllSettings"><Sequence /></Activity>' },
        { name: "GetTransactionData.xaml", content: '<Activity x:Class="GetTransactionData"><Sequence /></Activity>' },
        { name: "Process.xaml", content: '<Activity x:Class="Process"><Sequence /></Activity>' },
        { name: "SetTransactionStatus.xaml", content: '<Activity x:Class="SetTransactionStatus"><Sequence /></Activity>' },
        { name: "CloseAllApplications.xaml", content: '<Activity x:Class="CloseAllApplications"><Sequence /></Activity>' },
        { name: "KillAllProcesses.xaml", content: '<Activity x:Class="KillAllProcesses"><Sequence /></Activity>' },
      ];

      const result = validateWorkflowGraph(entries);
      const orphanDefects = result.workflowGraphDefects.filter(
        d => d.defectType === "orphan_workflow" || d.defectType === "decomposed_unwired_workflow"
      );
      const infraOrphans = orphanDefects.filter(d => {
        const basename = d.file.split("/").pop() || d.file;
        return REFRAMEWORK_INFRASTRUCTURE_FILES.has(basename);
      });
      expect(infraOrphans.length).toBe(0);
    });
  });

  describe("T004: Infrastructure file classification alignment", () => {

    it("should have REFRAMEWORK_INFRASTRUCTURE_FILES include all expected infrastructure files", () => {
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("InitAllSettings.xaml")).toBe(true);
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("CloseAllApplications.xaml")).toBe(true);
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("KillAllProcesses.xaml")).toBe(true);
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("Init.xaml")).toBe(true);
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("GetTransactionData.xaml")).toBe(true);
      expect(REFRAMEWORK_INFRASTRUCTURE_FILES.has("SetTransactionStatus.xaml")).toBe(true);
    });

    it("should not flag REFramework infrastructure files as orphans when REFramework is detected", () => {
      const mainXaml = `<Activity x:Class="Main">
  <StateMachine>
    <State DisplayName="Init">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Get Transaction">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Process">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" />
        </Sequence>
      </State.Entry>
    </State>
    <State DisplayName="Set Status">
      <State.Entry>
        <Sequence>
          <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" />
        </Sequence>
      </State.Entry>
    </State>
  </StateMachine>
</Activity>`;

      const entries = [
        { name: "Main.xaml", content: mainXaml },
        { name: "Init.xaml", content: '<Activity x:Class="Init"><Sequence /></Activity>' },
        { name: "InitAllSettings.xaml", content: '<Activity x:Class="InitAllSettings"><Sequence /></Activity>' },
        { name: "GetTransactionData.xaml", content: '<Activity x:Class="GetTransactionData"><Sequence /></Activity>' },
        { name: "Process.xaml", content: '<Activity x:Class="Process"><Sequence /></Activity>' },
        { name: "SetTransactionStatus.xaml", content: '<Activity x:Class="SetTransactionStatus"><Sequence /></Activity>' },
        { name: "CloseAllApplications.xaml", content: '<Activity x:Class="CloseAllApplications"><Sequence /></Activity>' },
        { name: "KillAllProcesses.xaml", content: '<Activity x:Class="KillAllProcesses"><Sequence /></Activity>' },
      ];

      const result = validateWorkflowGraph(entries);

      const infraDefects = result.workflowGraphDefects.filter(d => {
        const basename = d.file.split("/").pop() || d.file;
        return REFRAMEWORK_INFRASTRUCTURE_FILES.has(basename) &&
               (d.defectType === "orphan_workflow" || d.defectType === "decomposed_unwired_workflow");
      });
      expect(infraDefects.length).toBe(0);

      const wiringDefects = result.workflowGraphDefects.filter(d =>
        d.defectType === "reframework_wiring_inconsistency"
      );
      expect(wiringDefects.length).toBe(0);

      const discontinuityDefects = result.workflowGraphDefects.filter(d =>
        d.defectType === "graph_discontinuity"
      );
      expect(discontinuityDefects.length).toBe(0);
    });

    it("should not report infra files as orphans when Sequence-based Main.xaml invokes REFramework targets", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const entries = [
        { name: "Main.xaml", content: mainXaml },
        { name: "Init.xaml", content: '<Activity x:Class="Init"><Sequence><ui:InvokeWorkflowFile WorkflowFileName="InitAllSettings.xaml" /></Sequence></Activity>' },
        { name: "InitAllSettings.xaml", content: '<Activity x:Class="InitAllSettings"><Sequence /></Activity>' },
        { name: "GetTransactionData.xaml", content: '<Activity x:Class="GetTransactionData"><Sequence /></Activity>' },
        { name: "Process.xaml", content: '<Activity x:Class="Process"><Sequence /></Activity>' },
        { name: "SetTransactionStatus.xaml", content: '<Activity x:Class="SetTransactionStatus"><Sequence /></Activity>' },
        { name: "CloseAllApplications.xaml", content: '<Activity x:Class="CloseAllApplications"><Sequence /></Activity>' },
        { name: "KillAllProcesses.xaml", content: '<Activity x:Class="KillAllProcesses"><Sequence /></Activity>' },
      ];

      const result = validateWorkflowGraph(entries);

      const infraDefects = result.workflowGraphDefects.filter(d => {
        const basename = d.file.split("/").pop() || d.file;
        return REFRAMEWORK_INFRASTRUCTURE_FILES.has(basename) &&
               (d.defectType === "orphan_workflow" || d.defectType === "decomposed_unwired_workflow");
      });
      expect(infraDefects.length).toBe(0);

      const wiringDefects = result.workflowGraphDefects.filter(d =>
        d.defectType === "reframework_wiring_inconsistency"
      );
      expect(wiringDefects.length).toBe(0);

      const discontinuityDefects = result.workflowGraphDefects.filter(d =>
        d.defectType === "graph_discontinuity"
      );
      expect(discontinuityDefects.length).toBe(0);
    });
  });

  describe("T005: REFramework wiring idempotence", () => {

    it("should not modify Main.xaml if REFramework invocations are already present", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      expect(deferredWrites.get("lib/Main.xaml")).toBe(mainXaml);
    });

    it("should produce byte-identical output on second pass for a correctly-wired Main.xaml", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const deferredWrites1 = new Map<string, string>();
      deferredWrites1.set("lib/Main.xaml", mainXaml);
      ensureReframeworkWiringOnMain(deferredWrites1, [], "lib");
      const result1 = deferredWrites1.get("lib/Main.xaml");

      const deferredWrites2 = new Map<string, string>();
      deferredWrites2.set("lib/Main.xaml", mainXaml);
      ensureReframeworkWiringOnMain(deferredWrites2, [], "lib");
      const result2 = deferredWrites2.get("lib/Main.xaml");

      expect(result1).toBe(mainXaml);
      expect(result2).toBe(mainXaml);
      expect(result1).toBe(result2);
    });

    it("should insert invocations into existing Sequence inside State.Entry for StateMachine Main.xaml", () => {
      const mainXaml = `<Activity x:Class="Main">
  <StateMachine>
    <State DisplayName="Init State">
      <State.Entry>
        <Sequence>
          <ui:LogMessage Level="Info" Message="Starting" />
        </Sequence>
      </State.Entry>
    </State>
  </StateMachine>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const result = deferredWrites.get("lib/Main.xaml")!;

      expect(result).toContain('WorkflowFileName="Init.xaml"');
      const initCount = (result.match(/WorkflowFileName="Init\.xaml"/g) || []).length;
      expect(initCount).toBe(1);

      const stateEntryCount = (result.match(/<\/State\.Entry>/g) || []).length;
      expect(stateEntryCount).toBe(1);
      const sequenceCount = (result.match(/<Sequence/g) || []).length;
      expect(sequenceCount).toBe(1);
    });

    it("should ensure Init.xaml invokes InitAllSettings.xaml when missing", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
  </Sequence>
</Activity>`;

      const initXaml = `<Activity x:Class="Init">
  <Sequence>
    <ui:LogMessage Level="Info" Message="Initializing" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);
      deferredWrites.set("lib/Init.xaml", initXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const updatedInit = deferredWrites.get("lib/Init.xaml")!;

      expect(updatedInit).toContain('WorkflowFileName="InitAllSettings.xaml"');
    });

    it("should repair Init.xaml even when Main.xaml already has all REFramework invocations", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const initXaml = `<Activity x:Class="Init">
  <Sequence>
    <ui:LogMessage Level="Info" Message="LLM init without InitAllSettings" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);
      deferredWrites.set("lib/Init.xaml", initXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const updatedMain = deferredWrites.get("lib/Main.xaml")!;
      expect(updatedMain).toBe(mainXaml);

      const updatedInit = deferredWrites.get("lib/Init.xaml")!;
      expect(updatedInit).toContain('WorkflowFileName="InitAllSettings.xaml"');
    });

    it("should not duplicate InitAllSettings invocation when already present in Init.xaml", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Invoke Init" />
  </Sequence>
</Activity>`;

      const initXaml = `<Activity x:Class="Init">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="InitAllSettings.xaml" DisplayName="Init All Settings" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);
      deferredWrites.set("lib/Init.xaml", initXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const updatedInit = deferredWrites.get("lib/Init.xaml")!;

      const count = (updatedInit.match(/InitAllSettings\.xaml/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe("T005b: REFramework chain order canonicalization", () => {

    it("should detect misordered chain as incorrect", () => {
      const content = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;
      expect(isChainOrderCorrect(content)).toBe(false);
    });

    it("should detect correctly ordered chain", () => {
      const content = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;
      expect(isChainOrderCorrect(content)).toBe(true);
    });

    it("should canonicalize misordered invocations into correct Init→GetTransactionData→Process→SetTransactionStatus order", () => {
      const misordered = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
  </Sequence>
</Activity>`;
      const result = canonicalizeChainOrder(misordered);
      expect(isChainOrderCorrect(result)).toBe(true);

      const initIdx = result.indexOf('WorkflowFileName="Init.xaml"');
      const getIdx = result.indexOf('WorkflowFileName="GetTransactionData.xaml"');
      const procIdx = result.indexOf('WorkflowFileName="Process.xaml"');
      const setIdx = result.indexOf('WorkflowFileName="SetTransactionStatus.xaml"');
      expect(initIdx).toBeLessThan(getIdx);
      expect(getIdx).toBeLessThan(procIdx);
      expect(procIdx).toBeLessThan(setIdx);
    });

    it("should fix misordered Main.xaml during ensureReframeworkWiringOnMain when all targets present", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const result = deferredWrites.get("lib/Main.xaml")!;

      expect(isChainOrderCorrect(result)).toBe(true);
      expect(result).not.toBe(mainXaml);
    });

    it("should produce correct chain order when injecting missing targets into partial Main.xaml", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const result = deferredWrites.get("lib/Main.xaml")!;

      expect(isChainOrderCorrect(result)).toBe(true);

      const initIdx = result.indexOf('WorkflowFileName="Init.xaml"');
      const procIdx = result.indexOf('WorkflowFileName="Process.xaml"');
      expect(initIdx).toBeLessThan(procIdx);
    });

    it("should be idempotent and byte-stable on already-correct content", () => {
      const mainXaml = `<Activity x:Class="Main">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Init.xaml" DisplayName="Init" />
    <ui:InvokeWorkflowFile WorkflowFileName="GetTransactionData.xaml" DisplayName="Get Data" />
    <ui:InvokeWorkflowFile WorkflowFileName="Process.xaml" DisplayName="Process" />
    <ui:InvokeWorkflowFile WorkflowFileName="SetTransactionStatus.xaml" DisplayName="Set Status" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Main.xaml", mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const result1 = deferredWrites.get("lib/Main.xaml")!;
      expect(result1).toBe(mainXaml);

      ensureReframeworkWiringOnMain(deferredWrites, [], "lib");
      const result2 = deferredWrites.get("lib/Main.xaml")!;
      expect(result2).toBe(mainXaml);
    });
  });

  describe("T006: Incomplete evidence defect emission", () => {

    it("should emit incomplete_evidence defect when arg tag is missing x:TypeArguments", () => {
      const callerXaml = `<Activity x:Class="Caller">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
      <ui:InvokeWorkflowFile.Arguments>
        <InArgument x:Key="in_Name">[str_Name]</InArgument>
      </ui:InvokeWorkflowFile.Arguments>
    </ui:InvokeWorkflowFile>
  </Sequence>
</Activity>`;

      const targetXaml = `<Activity x:Class="Target">
  <Sequence>
    <ui:LogMessage Level="Info" Message="[in_Name]" />
  </Sequence>
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Caller.xaml", callerXaml);
      deferredWrites.set("lib/Target.xaml", targetXaml);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      const incompleteDefects = result.defects.filter(
        (d: CrossWorkflowContractDefect) => d.defectType === "incomplete_evidence"
      );
      expect(incompleteDefects.length).toBeGreaterThan(0);
      expect(incompleteDefects[0].argumentName).toBe("in_Name");
    });

    it("should emit incomplete_evidence defect when arg tag is missing x:Key", () => {
      const callerXaml = `<Activity x:Class="Caller">
  <Sequence>
    <ui:InvokeWorkflowFile WorkflowFileName="Target.xaml">
      <ui:InvokeWorkflowFile.Arguments>
        <InArgument x:TypeArguments="x:String">[str_Name]</InArgument>
      </ui:InvokeWorkflowFile.Arguments>
    </ui:InvokeWorkflowFile>
  </Sequence>
</Activity>`;

      const targetXaml = `<Activity x:Class="Target">
  <Sequence />
</Activity>`;

      const deferredWrites = new Map<string, string>();
      deferredWrites.set("lib/Caller.xaml", callerXaml);
      deferredWrites.set("lib/Target.xaml", targetXaml);

      const result = buildCrossWorkflowArgContracts(deferredWrites, [], "lib");
      const incompleteDefects = result.defects.filter(
        (d: CrossWorkflowContractDefect) => d.defectType === "incomplete_evidence"
      );
      expect(incompleteDefects.length).toBeGreaterThan(0);
      expect(incompleteDefects[0].details).toContain("x:Key");
    });
  });
});
