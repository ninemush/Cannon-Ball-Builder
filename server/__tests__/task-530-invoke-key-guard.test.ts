import { describe, it, expect, beforeEach } from "vitest";
import {
  applyInvokeBindingKeyGuard,
  validateBindingKey,
  resetInvokeKeyGuardDiagnostics,
  getInvokeKeyGuardDiagnostics,
  type CalleeContractView,
  type InvokeBindingInput,
} from "../xaml/invoke-binding-key-guard";
import { isStubCause, STUB_CAUSE_VALUES, type StubCause } from "../lib/stub-cause";

const setTransactionStatusContract: CalleeContractView = {
  argumentNames: new Map<string, string>([
    ["in_transactionitem", "in_TransactionItem"],
    ["in_status", "in_Status"],
    ["io_config", "io_Config"],
  ]),
};

function asInputs(rawKeys: unknown[]): InvokeBindingInput[] {
  return rawKeys.map((k, i) => ({
    key: k,
    direction: "In" as const,
    value: `"value-${i}"`,
  }));
}

describe("Task #530 — invoke binding key guard", () => {
  beforeEach(() => resetInvokeKeyGuardDiagnostics());

  describe("StubCause type contract", () => {
    it("includes the four authoritative cause tags", () => {
      const expected: StubCause[] = [
        "todo-attribute",
        "null-key-invoke",
        "pipeline-fallback-compliance-crash",
        "other",
      ];
      expect([...STUB_CAUSE_VALUES].sort()).toEqual(expected.slice().sort());
    });
    it("isStubCause narrows correctly", () => {
      expect(isStubCause("null-key-invoke")).toBe(true);
      expect(isStubCause("Nothing")).toBe(false);
      expect(isStubCause(null)).toBe(false);
    });
  });

  describe("validateBindingKey — invalid resolved-key forms", () => {
    const cases: Array<[string, unknown]> = [
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
      ["whitespace only", "   "],
      ["VB keyword Nothing", "Nothing"],
      ["VB keyword True", "True"],
      ["VB keyword False", "False"],
      ["VB keyword Me", "Me"],
      ["VB keyword MyBase", "MyBase"],
      ["VB keyword MyClass", "MyClass"],
    ];
    for (const [label, key] of cases) {
      it(`rejects ${label}`, () => {
        const result = validateBindingKey(key);
        expect(result.valid).toBe(false);
      });
    }
    it("accepts a normal argument name", () => {
      expect(validateBindingKey("in_Status").valid).toBe(true);
    });
  });

  describe("emission-time guard — catches all invalid keys pre-XAML", () => {
    it("flags every invalid form and degrades the invoke when no contract is present", () => {
      const inputs = asInputs([null, undefined, "", "   ", "Nothing", "True", "Me"]);
      const result = applyInvokeBindingKeyGuard(inputs, {
        invokeDisplayName: "Set transaction status",
        targetWorkflow: "SetTransactionStatus",
        contract: null,
      });
      expect(result.requiresInvokeLevelDegradation).toBe(true);
      expect(result.hardFail).toBe(false);
      expect(result.stubCause).toBe<StubCause>("null-key-invoke");
      expect(result.diagnostics.length).toBe(inputs.length);
      for (const d of result.diagnostics) {
        expect(d.step === 1 || d.step === 2 || d.step === 3).toBe(true);
        expect(d.invokeDisplayName).toBe("Set transaction status");
        expect(d.targetWorkflow).toBe("SetTransactionStatus");
      }
    });

    it("repairs an invalid key when the spec-declared name matches a contract argument (Step 1)", () => {
      const inputs: InvokeBindingInput[] = [{
        key: "Nothing",
        specDeclaredName: "in_Status",
        direction: "In",
        value: '"Successful"',
      }];
      const result = applyInvokeBindingKeyGuard(inputs, {
        invokeDisplayName: "Set transaction status: Successful",
        targetWorkflow: "SetTransactionStatus",
        contract: setTransactionStatusContract,
      });
      expect(result.requiresInvokeLevelDegradation).toBe(false);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].key).toBe("in_Status");
      expect(result.resolved[0].value).toBe('"Successful"');
      expect(result.resolved[0].repairedFromInvalidKey).toBe(true);
      expect(result.resolved[0].repairProvenance).toBe("spec-declared");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].step).toBe(1);
    });

    it("does not silently drop, dedupe, or omit when repair is impossible", () => {
      const inputs = asInputs(["Nothing", "Nothing"]);
      const result = applyInvokeBindingKeyGuard(inputs, {
        invokeDisplayName: "Set transaction status",
        targetWorkflow: "SetTransactionStatus",
        contract: setTransactionStatusContract,
      });
      expect(result.requiresInvokeLevelDegradation).toBe(true);
      expect(result.diagnostics).toHaveLength(2);
      expect(result.resolved).toHaveLength(0);
    });

    it("rejects a structurally valid but contract-unknown key when no repair is viable", () => {
      const inputs: InvokeBindingInput[] = [{
        key: "in_NotARealArg",
        direction: "In",
        value: '"x"',
      }];
      const result = applyInvokeBindingKeyGuard(inputs, {
        invokeDisplayName: "Foo",
        targetWorkflow: "SetTransactionStatus",
        contract: setTransactionStatusContract,
      });
      expect(result.requiresInvokeLevelDegradation).toBe(true);
      expect(result.diagnostics[0].reason).toBe("contract-mismatch");
    });

    it("preserves bound values verbatim — repair never rewrites the value", () => {
      const inputs: InvokeBindingInput[] = [
        { key: "Nothing", specDeclaredName: "in_Status", direction: "In", value: '"Successful"' },
        { key: "Nothing", specDeclaredName: "in_TransactionItem", direction: "In", value: "[qi_TransactionItem]" },
      ];
      const result = applyInvokeBindingKeyGuard(inputs, {
        invokeDisplayName: "Set transaction status",
        targetWorkflow: "SetTransactionStatus",
        contract: setTransactionStatusContract,
      });
      expect(result.requiresInvokeLevelDegradation).toBe(false);
      const byKey = new Map(result.resolved.map(r => [r.key, r]));
      expect(byKey.get("in_Status")?.value).toBe('"Successful"');
      expect(byKey.get("in_TransactionItem")?.value).toBe("[qi_TransactionItem]");
    });

    it("never produces Step-3 hits in the regression fixtures", () => {
      // Repeated guard invocations across mixed-fixture inputs simulate
      // the named regression runs: Step 3 must never fire.
      const fixtures: InvokeBindingInput[][] = [
        asInputs([null]),
        asInputs(["Nothing", "Nothing"]),
        asInputs(["", "in_Status"]),
        [{ key: "in_Status", direction: "In", value: '"Failed"' }],
      ];
      for (const inputs of fixtures) {
        applyInvokeBindingKeyGuard(inputs, {
          invokeDisplayName: "fixture",
          targetWorkflow: "SetTransactionStatus",
          contract: setTransactionStatusContract,
        });
      }
      expect(getInvokeKeyGuardDiagnostics().step3Count).toBe(0);
    });
  });

  describe("module diagnostics surface", () => {
    it("collects diagnostics across calls and resets cleanly", () => {
      applyInvokeBindingKeyGuard(asInputs(["Nothing"]), {
        invokeDisplayName: "a",
        targetWorkflow: "X",
        contract: null,
      });
      applyInvokeBindingKeyGuard(asInputs([""]), {
        invokeDisplayName: "b",
        targetWorkflow: "Y",
        contract: null,
      });
      expect(getInvokeKeyGuardDiagnostics().diagnostics.length).toBe(2);
      resetInvokeKeyGuardDiagnostics();
      expect(getInvokeKeyGuardDiagnostics().diagnostics.length).toBe(0);
    });
  });
});
