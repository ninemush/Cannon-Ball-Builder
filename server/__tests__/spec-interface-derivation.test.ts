import { describe, it, expect } from "vitest";
import { deriveSpecInterfaces } from "../spec-interface-derivation";
import { buildPreEmissionContractMap } from "../workflow-tree-assembler";
import type { WorkflowSpec } from "../workflow-spec-types";

function makeSpec(name: string, args: WorkflowSpec["arguments"] = [], children: any[] = []): { name: string; spec: WorkflowSpec } {
  return {
    name,
    spec: {
      name,
      description: "",
      variables: [],
      arguments: args,
      rootSequence: {
        kind: "sequence",
        displayName: name,
        children,
      },
      useReFramework: false,
      dhgNotes: [],
      decomposition: [],
    },
  };
}

function makeInvokeNode(targetFile: string, extraProps: Record<string, string> = {}): any {
  return {
    kind: "activity",
    template: "InvokeWorkflowFile",
    displayName: `Invoke ${targetFile}`,
    properties: {
      WorkflowFileName: targetFile,
      ...extraProps,
    },
    errorHandling: "none",
  };
}

describe("deriveSpecInterfaces", () => {
  it("populates empty arguments from caller evidence with in_ prefix", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("ProcessData.xaml", {
        in_FilePath: "str_InputFile",
        out_Result: "str_OutputResult",
      }),
    ]);
    const callee = makeSpec("ProcessData", []);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(result.derivedCount).toBeGreaterThan(0);
    expect(callee.spec.arguments.length).toBe(2);

    const inArg = callee.spec.arguments.find(a => a.name === "in_FilePath");
    expect(inArg).toBeDefined();
    expect(inArg!.direction).toBe("InArgument");

    const outArg = callee.spec.arguments.find(a => a.name === "out_Result");
    expect(outArg).toBeDefined();
    expect(outArg!.direction).toBe("OutArgument");
  });

  it("derives direction from in_/out_/io_ prefixes", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_Input: "str_Hello",
        out_Output: "str_Result",
        io_Config: "str_Settings",
      }),
    ]);
    const callee = makeSpec("Worker", []);

    deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(3);
    expect(callee.spec.arguments.find(a => a.name === "in_Input")!.direction).toBe("InArgument");
    expect(callee.spec.arguments.find(a => a.name === "out_Output")!.direction).toBe("OutArgument");
    expect(callee.spec.arguments.find(a => a.name === "io_Config")!.direction).toBe("InOutArgument");
  });

  it("infers type from existing type inference utilities", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_Data: "dt_MainTable",
        out_Count: "int_Total",
      }),
    ]);
    const callee = makeSpec("Worker", []);

    deriveSpecInterfaces([caller, callee]);

    const dtArg = callee.spec.arguments.find(a => a.name === "in_Data");
    expect(dtArg).toBeDefined();
    expect(dtArg!.type).toBe("scg2:DataTable");

    const intArg = callee.spec.arguments.find(a => a.name === "out_Count");
    expect(intArg).toBeDefined();
    expect(intArg!.type).toBe("x:Int32");
  });

  it("parses Dictionary-packed caller bindings for individual argument extraction", () => {
    const dictValue = 'New Dictionary(Of String, Object) From {{"in_Name", str_CustomerName}, {"out_Status", str_Result}}';
    const caller = makeSpec("Main", [], [
      makeInvokeNode("ProcessCustomer.xaml", {
        Arguments: dictValue,
      }),
    ]);
    const callee = makeSpec("ProcessCustomer", []);

    deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(2);
    expect(callee.spec.arguments.find(a => a.name === "in_Name")).toBeDefined();
    expect(callee.spec.arguments.find(a => a.name === "in_Name")!.direction).toBe("InArgument");
    expect(callee.spec.arguments.find(a => a.name === "out_Status")).toBeDefined();
    expect(callee.spec.arguments.find(a => a.name === "out_Status")!.direction).toBe("OutArgument");
  });

  it("produces conflict diagnostic and withholds both when callers imply conflicting directions for same base name", () => {
    const caller1 = makeSpec("Caller1", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Input1",
      }),
    ]);
    const caller2 = makeSpec("Caller2", [], [
      makeInvokeNode("Shared.xaml", {
        out_Data: "str_Output2",
      }),
    ]);
    const callee = makeSpec("Shared", []);

    const result = deriveSpecInterfaces([caller1, caller2, callee]);

    expect(result.conflictCount).toBeGreaterThan(0);
    expect(callee.spec.arguments.length).toBe(0);
    const conflictDiag = result.diagnostics.find(d => d.kind === "conflict" && d.targetWorkflow === "Shared");
    expect(conflictDiag).toBeDefined();
    expect(conflictDiag!.withheldArguments).toBeDefined();
  });

  it("does not invent interface for framework-owned workflows not in spec set", () => {
    const caller = makeSpec("ProcessTransaction", [], [
      makeInvokeNode("InitAllSettings.xaml", {
        in_ConfigPath: "str_Path",
      }),
    ]);

    const result = deriveSpecInterfaces([caller]);

    const frameworkDiag = result.diagnostics.find(d => d.kind === "framework_skip");
    expect(frameworkDiag).toBeDefined();
  });

  it("skips framework scaffold workflow even when in spec set with existing arguments", () => {
    const existingArgs: WorkflowSpec["arguments"] = [
      { name: "in_Config", direction: "InArgument", type: "Dictionary<String, Object>" },
    ];

    const caller = makeSpec("Main", [], [
      makeInvokeNode("InitAllSettings.xaml", {
        in_Config: "str_Config",
        in_Extra: "str_Extra",
      }),
    ]);
    const callee = makeSpec("InitAllSettings", [...existingArgs]);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].name).toBe("in_Config");
    const frameworkDiag = result.diagnostics.find(d => d.kind === "framework_skip");
    expect(frameworkDiag).toBeDefined();
  });

  it("skips framework scaffold workflow in spec set even with empty arguments", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("InitAllSettings.xaml", {
        in_ConfigPath: "str_Path",
      }),
    ]);
    const callee = makeSpec("InitAllSettings", []);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(0);
    const frameworkDiag = result.diagnostics.find(d => d.kind === "framework_skip");
    expect(frameworkDiag).toBeDefined();
  });

  it("derives interface for ProcessTransaction (business workflow, not framework-only)", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("ProcessTransaction.xaml", {
        in_TransactionItem: "str_Item",
        in_Config: "str_Config",
        out_Result: "str_Result",
      }),
    ]);
    const callee = makeSpec("ProcessTransaction", []);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(3);
    expect(callee.spec.arguments.find(a => a.name === "in_TransactionItem")).toBeDefined();
    expect(callee.spec.arguments.find(a => a.name === "in_Config")).toBeDefined();
    expect(callee.spec.arguments.find(a => a.name === "out_Result")).toBeDefined();
    expect(result.derivedCount).toBeGreaterThan(0);
  });

  it("business workflow with framework-like name is not incorrectly skipped when in spec set", () => {
    const caller = makeSpec("Dispatcher", [], [
      makeInvokeNode("Main.xaml", {
        in_Data: "str_Input",
      }),
    ]);
    const callee = makeSpec("Main", []);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].name).toBe("in_Data");
    const frameworkDiag = result.diagnostics.find(d => d.kind === "framework_skip");
    expect(frameworkDiag).toBeUndefined();
  });

  it("does not invent interface for unresolved (not in spec set) workflows", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("ExternalWorkflow.xaml", {
        in_Param: "str_Value",
      }),
    ]);

    const result = deriveSpecInterfaces([caller]);

    expect(result.skippedCount).toBeGreaterThan(0);
    const skipDiag = result.diagnostics.find(d => d.kind === "unresolved_target");
    expect(skipDiag).toBeDefined();
  });

  it("preserves existing non-empty explicit arguments and does not overwrite", () => {
    const existingArgs: WorkflowSpec["arguments"] = [
      { name: "in_Config", direction: "InArgument", type: "Dictionary<String, Object>" },
      { name: "out_Status", direction: "OutArgument", type: "String" },
    ];

    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_Config: "str_Config",
        out_Status: "str_Status",
      }),
    ]);
    const callee = makeSpec("Worker", [...existingArgs]);

    deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(2);
    expect(callee.spec.arguments[0].name).toBe("in_Config");
    expect(callee.spec.arguments[0].type).toBe("Dictionary<String, Object>");
    expect(callee.spec.arguments[1].name).toBe("out_Status");
    expect(callee.spec.arguments[1].type).toBe("String");
  });

  it("emits diagnostic when caller evidence conflicts with existing explicit declaration direction", () => {
    const existingArgs: WorkflowSpec["arguments"] = [
      { name: "in_Data", direction: "InArgument", type: "String" },
    ];

    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        out_Data: "str_Output",
      }),
    ]);
    const callee = makeSpec("Worker", [...existingArgs]);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].name).toBe("in_Data");
    expect(callee.spec.arguments[0].direction).toBe("InArgument");
    expect(result.conflictCount).toBeGreaterThan(0);
    const conflictDiag = result.diagnostics.find(d => d.kind === "conflict" && d.details.includes("base name"));
    expect(conflictDiag).toBeDefined();
  });

  it("pre-emission contract map now contains business workflow contracts that were previously empty", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("SubProcess.xaml", {
        in_Input: "str_Data",
        out_Output: "str_Result",
      }),
    ]);
    const callee = makeSpec("SubProcess", []);

    expect(callee.spec.arguments.length).toBe(0);

    deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(2);
    expect(callee.spec.arguments.some(a => a.name === "in_Input")).toBe(true);
    expect(callee.spec.arguments.some(a => a.name === "out_Output")).toBe(true);
  });

  it("supplements missing arguments to existing interface without replacing existing ones", () => {
    const existingArgs: WorkflowSpec["arguments"] = [
      { name: "in_Config", direction: "InArgument", type: "Dictionary<String, Object>" },
    ];

    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_Config: "str_Config",
        in_NewParam: "str_Extra",
        out_Result: "str_Result",
      }),
    ]);
    const callee = makeSpec("Worker", [...existingArgs]);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(3);
    expect(callee.spec.arguments.find(a => a.name === "in_Config")!.type).toBe("Dictionary<String, Object>");
    expect(callee.spec.arguments.find(a => a.name === "in_NewParam")).toBeDefined();
    expect(callee.spec.arguments.find(a => a.name === "out_Result")).toBeDefined();
    expect(result.supplementedCount).toBeGreaterThan(0);
  });

  it("handles multiple callers with consistent evidence", () => {
    const caller1 = makeSpec("Caller1", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Input1",
        out_Result: "str_Output1",
      }),
    ]);
    const caller2 = makeSpec("Caller2", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Input2",
        out_Result: "str_Output2",
      }),
    ]);
    const callee = makeSpec("Shared", []);

    deriveSpecInterfaces([caller1, caller2, callee]);

    expect(callee.spec.arguments.length).toBe(2);
    expect(callee.spec.arguments.find(a => a.name === "in_Data")!.direction).toBe("InArgument");
    expect(callee.spec.arguments.find(a => a.name === "out_Result")!.direction).toBe("OutArgument");
  });

  it("returns empty result when no invoke activities exist", () => {
    const spec1 = makeSpec("Main", [], [
      {
        kind: "activity",
        template: "LogMessage",
        displayName: "Log Something",
        properties: { Level: "Info", Message: '"Hello"' },
        errorHandling: "none",
      },
    ]);

    const result = deriveSpecInterfaces([spec1]);

    expect(result.derivedCount).toBe(0);
    expect(result.supplementedCount).toBe(0);
    expect(result.conflictCount).toBe(0);
    expect(result.incompleteCount).toBe(0);
  });

  it("handles invoke inside nested control flow structures", () => {
    const caller = makeSpec("Main", [], [
      {
        kind: "tryCatch",
        displayName: "TryCatch",
        tryChildren: [
          makeInvokeNode("DeepWorker.xaml", {
            in_Param: "str_Value",
          }),
        ],
        catchChildren: [],
        finallyChildren: [],
      },
    ]);
    const callee = makeSpec("DeepWorker", []);

    deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].name).toBe("in_Param");
  });

  it("produces conflict diagnostic when callers have conflicting types for same argument", () => {
    const caller1 = makeSpec("Caller1", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "dt_Table",
      }),
    ]);
    const caller2 = makeSpec("Caller2", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Text",
      }),
    ]);
    const callee = makeSpec("Shared", []);

    const result = deriveSpecInterfaces([caller1, caller2, callee]);

    expect(result.conflictCount).toBeGreaterThan(0);
    expect(callee.spec.arguments.find(a => a.name === "in_Data")).toBeUndefined();
    const conflictDiag = result.diagnostics.find(d => d.kind === "conflict" && d.targetWorkflow === "Shared");
    expect(conflictDiag).toBeDefined();
  });

  it("handles invoke inside if/else branches", () => {
    const caller = makeSpec("Main", [], [
      {
        kind: "if",
        displayName: "Check Condition",
        condition: "True",
        thenChildren: [
          makeInvokeNode("ThenWorker.xaml", {
            in_Data: "str_ThenInput",
          }),
        ],
        elseChildren: [
          makeInvokeNode("ElseWorker.xaml", {
            in_Data: "str_ElseInput",
          }),
        ],
      },
    ]);
    const thenCallee = makeSpec("ThenWorker", []);
    const elseCallee = makeSpec("ElseWorker", []);

    deriveSpecInterfaces([caller, thenCallee, elseCallee]);

    expect(thenCallee.spec.arguments.length).toBe(1);
    expect(elseCallee.spec.arguments.length).toBe(1);
  });

  it("withholds argument with incomplete type evidence and emits incomplete diagnostic", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_UnknownThing: "someVariable",
      }),
    ]);
    const callee = makeSpec("Worker", []);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(0);
    expect(result.incompleteCount).toBeGreaterThan(0);
    const incompleteDiag = result.diagnostics.find(d => d.kind === "incomplete");
    expect(incompleteDiag).toBeDefined();
    expect(incompleteDiag!.withheldArguments).toContain("in_UnknownThing");
  });

  it("declares argument when at least one caller provides type evidence and others match", () => {
    const caller1 = makeSpec("Caller1", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Input1",
      }),
    ]);
    const caller2 = makeSpec("Caller2", [], [
      makeInvokeNode("Shared.xaml", {
        in_Data: "str_Input2",
      }),
    ]);
    const callee = makeSpec("Shared", []);

    deriveSpecInterfaces([caller1, caller2, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].type).toBe("x:String");
  });

  it("separates framework_skip from unresolved_target diagnostics", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("InitAllSettings.xaml", { in_Config: "str_Path" }),
      makeInvokeNode("MissingWorkflow.xaml", { in_Data: "str_Data" }),
    ]);

    const result = deriveSpecInterfaces([caller]);

    const frameworkDiag = result.diagnostics.find(d => d.kind === "framework_skip");
    const unresolvedDiag = result.diagnostics.find(d => d.kind === "unresolved_target");
    expect(frameworkDiag).toBeDefined();
    expect(unresolvedDiag).toBeDefined();
    expect(frameworkDiag!.targetWorkflow).toContain("initallsettings");
    expect(unresolvedDiag!.targetWorkflow).toContain("missingworkflow");
  });

  it("emits incomplete diagnostic for dictionary entries lacking direction prefix", () => {
    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        Arguments: 'New Dictionary(Of String, Object) From {{"NoPrefixArg", str_Value}, {"in_Valid", str_Data}}',
      }),
    ]);
    const callee = makeSpec("Worker", []);

    const result = deriveSpecInterfaces([caller, callee]);

    const incompleteDiag = result.diagnostics.find(
      d => d.kind === "incomplete" && d.withheldArguments?.includes("NoPrefixArg")
    );
    expect(incompleteDiag).toBeDefined();
    expect(incompleteDiag!.details).toContain("lacks direction prefix");
    expect(callee.spec.arguments.find(a => a.name === "NoPrefixArg")).toBeUndefined();
    expect(callee.spec.arguments.find(a => a.name === "in_Valid")).toBeDefined();
  });

  it("emits type conflict diagnostic when caller type differs from existing explicit arg type", () => {
    const existingArgs: WorkflowSpec["arguments"] = [
      { name: "in_Data", direction: "InArgument", type: "x:String" },
    ];

    const caller = makeSpec("Main", [], [
      makeInvokeNode("Worker.xaml", {
        in_Data: "dt_Records",
      }),
    ]);
    const callee = makeSpec("Worker", [...existingArgs]);

    const result = deriveSpecInterfaces([caller, callee]);

    expect(callee.spec.arguments.length).toBe(1);
    expect(callee.spec.arguments[0].type).toBe("x:String");
    const typeConflictDiag = result.diagnostics.find(
      d => d.kind === "conflict" && d.details.includes("conflicting type")
    );
    expect(typeConflictDiag).toBeDefined();
    expect(typeConflictDiag!.details).toContain("caller=scg2:DataTable");
    expect(typeConflictDiag!.details).toContain("existing=x:String");
    expect(typeConflictDiag!.details).toContain("Preserving existing declaration");
  });

  it("produces non-empty pre-emission contract map after derivation in benchmark-like invoke chain", () => {
    const main = makeSpec("Main", [], [
      makeInvokeNode("ProcessTransaction.xaml", {
        in_TransactionItem: "str_Item",
        in_Config: "str_Config",
        out_Result: "str_Result",
      }),
    ]);
    const processTransaction = makeSpec("ProcessTransaction", []);

    const specEntries = [main, processTransaction];
    deriveSpecInterfaces(specEntries);

    expect(processTransaction.spec.arguments.length).toBe(3);

    const contractMap = buildPreEmissionContractMap(specEntries);

    expect(contractMap.size).toBeGreaterThan(0);
    const ptContract = contractMap.get("processtransaction.xaml");
    expect(ptContract).toBeDefined();
    expect(ptContract!.arguments.length).toBe(3);
    expect(ptContract!.arguments.find(a => a.name === "in_TransactionItem")).toBeDefined();
    expect(ptContract!.arguments.find(a => a.name === "out_Result")).toBeDefined();
  });
});
