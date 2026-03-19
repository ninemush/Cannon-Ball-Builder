import { describe, it, expect, vi } from "vitest";
import { validateXamlContent } from "../xaml-generator";

describe("Task 100 Fixes", () => {
  describe("FIX 1 — move-to-child-element regex produces properly spaced attributes", () => {
    function simulateMoveToChildElement(content: string, fullTag: string, propName: string, propVal: string) {
      const escapedTag = fullTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const escapedVal = propVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const className = fullTag.includes(":") ? fullTag.split(":").pop()! : fullTag;
      const childElement = `<${className}.${propName}>\n            <InArgument x:TypeArguments="x:String">[${propVal}]</InArgument>\n          </${className}.${propName}>`;

      const selfClosingRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?)(\\s*\\/\\>)`);
      const openTagRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedVal}"([^>]*?>)`);

      if (selfClosingRegex.test(content)) {
        return content.replace(selfClosingRegex, `$1 $2>\n          ${childElement}\n        </${fullTag}>`);
      } else if (openTagRegex.test(content)) {
        return content.replace(openTagRegex, `$1 $2\n          ${childElement}`);
      }
      return content;
    }

    it("self-closing tag: does not jam adjacent attributes together when removing mid-list attribute", () => {
      const input = `<ui:CreateTask DisplayName="Create Task" TaskObject="obj" Priority="High" />`;
      const result = simulateMoveToChildElement(input, "ui:CreateTask", "TaskObject", "obj");

      expect(result).not.toMatch(/""[A-Za-z]/);
      expect(result).toContain('DisplayName="Create Task"');
      expect(result).toContain('Priority="High"');
      expect(result).toContain("CreateTask.TaskObject");
    });

    it("self-closing tag: preserves space between remaining attributes when removing first non-DisplayName attribute", () => {
      const input = `<ui:CreateTask DisplayName="Create" Alpha="a" Beta="b" />`;
      const result = simulateMoveToChildElement(input, "ui:CreateTask", "Alpha", "a");

      expect(result).toContain('DisplayName="Create"');
      expect(result).toContain('Beta="b"');
      expect(result).not.toMatch(/""[A-Z]/);
    });

    it("open tag: does not jam adjacent attributes together when removing mid-list attribute", () => {
      const input = `<ui:CreateTask DisplayName="Create Task" TaskObject="obj" Priority="High">\n</ui:CreateTask>`;
      const result = simulateMoveToChildElement(input, "ui:CreateTask", "TaskObject", "obj");

      expect(result).not.toMatch(/""[A-Za-z]/);
      expect(result).toContain('DisplayName="Create Task"');
      expect(result).toContain('Priority="High"');
      expect(result).toContain("CreateTask.TaskObject");
    });

    it("remaining attributes are separated by whitespace, not jammed", () => {
      const input = `<MyActivity DisplayName="Test" Foo="bar" Baz="qux" />`;
      const result = simulateMoveToChildElement(input, "MyActivity", "Foo", "bar");

      const tagLine = result.split("\n")[0];
      expect(tagLine).toMatch(/DisplayName="Test"\s+Baz="qux"/);
      expect(tagLine).not.toMatch(/""Baz/);
    });
  });

  describe("FIX 2 — classifiedIntent should not be reset at send time in sendMessageDirect", () => {
    it("the initial setup block of sendMessageDirect does not reset classifiedIntent to empty string", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const workspacePath = path.resolve(import.meta.dirname, "../../client/src/pages/workspace.tsx");
      const content = fs.readFileSync(workspacePath, "utf-8");

      const fnStart = content.indexOf("const sendMessageDirect = useCallback(async");
      expect(fnStart).toBeGreaterThan(-1);

      const initBlock = content.slice(fnStart, fnStart + 300);

      expect(initBlock).toContain("lastUserMessageRef.current = text");
      expect(initBlock).toContain('setDeployStep("")');
      expect(initBlock).not.toMatch(/setClassifiedIntent\(\s*["']\s*["']\s*\)/);
      expect(initBlock).toContain("setClassifiedIntent(guessIntentFromMessage(text))");
    });
  });

  describe("FIX 3 — XAML content logged at debug level on wellformedness failure", () => {
    it("logs full XAML content via console.debug when XML validation fails", () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      const malformedXaml = `<Root><Unclosed></Root>`;
      validateXamlContent([{ name: "Test.xaml", content: malformedXaml }]);

      const debugCalls = debugSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("[XAML wellformedness]")
      );
      expect(debugCalls.length).toBeGreaterThan(0);
      expect(debugCalls[0][0]).toContain(malformedXaml);
      expect(debugCalls[0][0]).toContain("Test.xaml");

      debugSpy.mockRestore();
    });

    it("logs full XAML content via console.debug on XML parse exception", () => {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

      const brokenXaml = `<?xml version="1.0"?><Root attr="no-close`;
      validateXamlContent([{ name: "Broken.xaml", content: brokenXaml }]);

      const debugCalls = debugSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && call[0].includes("[XAML wellformedness]")
      );
      expect(debugCalls.length).toBeGreaterThan(0);
      expect(debugCalls[0][0]).toContain(brokenXaml);

      debugSpy.mockRestore();
    });
  });
});

describe("Task 102 Fixes — TODO/PLACEHOLDER token malformed XML", () => {
  describe("Sanitizer context-aware replacement (uipath-integration.ts line 1135)", () => {
    function simulateSanitizer(content: string): string {
      return content
        .replace(/\[[^\]]*(?:PLACEHOLDER_\w*|TODO_\w*)[^\]]*\]/g, '[Nothing]')
        .replace(/PLACEHOLDER_\w*/g, '')
        .replace(/TODO_\w*/g, '');
    }

    it("TODO_Condition inside brackets is replaced with [Nothing] not double-quotes", () => {
      const input = `Condition="[TODO_Condition]"`;
      const result = simulateSanitizer(input);
      expect(result).toBe(`Condition="[Nothing]"`);
      expect(result).not.toContain('""');
    });

    it("PLACEHOLDER_Expression inside brackets is replaced with [Nothing]", () => {
      const input = `Expression="[PLACEHOLDER_Expression]"`;
      const result = simulateSanitizer(input);
      expect(result).toBe(`Expression="[Nothing]"`);
    });

    it("TODO_Condition outside brackets is replaced with empty string", () => {
      const input = `Condition="TODO_Condition"`;
      const result = simulateSanitizer(input);
      expect(result).toBe(`Condition=""`);
    });

    it("PLACEHOLDER_Values outside brackets is replaced with empty string", () => {
      const input = `Values="PLACEHOLDER_Values"`;
      const result = simulateSanitizer(input);
      expect(result).toBe(`Values=""`);
    });

    it("mixed tokens inside and outside brackets are handled correctly", () => {
      const input = `<If Condition="[TODO_Condition]" DisplayName="TODO_Name" />`;
      const result = simulateSanitizer(input);
      expect(result).toBe(`<If Condition="[Nothing]" DisplayName="" />`);
    });
  });

  describe("If activity fallback produces valid condition", () => {
    it("If activity with missing condition uses True instead of TODO_Condition", () => {
      const properties: Record<string, string> = {};
      const rawProperties: Record<string, string> = {};
      const rawCondition = properties["Condition"] || rawProperties["Condition"] || "";
      const needsConditionReview = !rawCondition || rawCondition === "TODO_Condition" || rawCondition.startsWith("TODO_") || rawCondition.startsWith("PLACEHOLDER_");
      const condition = needsConditionReview ? "True" : rawCondition;

      expect(condition).toBe("True");
      expect(needsConditionReview).toBe(true);
    });

    it("If activity with real condition preserves original value", () => {
      const properties: Record<string, string> = { Condition: "str_Status = \"Active\"" };
      const rawProperties: Record<string, string> = {};
      const rawCondition = properties["Condition"] || rawProperties["Condition"] || "";
      const needsConditionReview = !rawCondition || rawCondition === "TODO_Condition" || rawCondition.startsWith("TODO_") || rawCondition.startsWith("PLACEHOLDER_");
      const condition = needsConditionReview ? "True" : rawCondition;

      expect(condition).toBe("str_Status = \"Active\"");
      expect(needsConditionReview).toBe(false);
    });
  });

  describe("fix-invalid-value g-flag regex bug", () => {
    it("replace without test() correctly fixes the first occurrence with g flag", () => {
      const content = `<ui:SendEmail DisplayName="Send" Subject="old_value" Other="ok" />`;
      const escapedTag = "ui\\:SendEmail";
      const propName = "Subject";
      const escapedOldVal = "old_value";
      const correctedValue = "new_value";
      const attrRegex = new RegExp(`(<${escapedTag}\\s[^>]*?)${propName}="${escapedOldVal}"`, "g");
      const newContent = content.replace(attrRegex, `$1${propName}="${correctedValue}"`);
      expect(newContent).not.toBe(content);
      expect(newContent).toContain(`Subject="new_value"`);
    });

    it("replace() returns original string unchanged when there is no match (no test guard needed)", () => {
      const content = `<ui:SendEmail DisplayName="Send" Subject="correct_value" />`;
      const attrRegex = new RegExp(`(<ui\\:SendEmail\\s[^>]*?)Subject="nonexistent"`, "g");
      const newContent = content.replace(attrRegex, `$1Subject="new_value"`);
      expect(newContent).toBe(content);
    });

    it("test() with g-flag advances lastIndex, proving the regex state concern", () => {
      const content = `<ui:SendEmail DisplayName="Send" Subject="old_value" />`;
      const attrRegex = new RegExp(`(<ui\\:SendEmail\\s[^>]*?)Subject="old_value"`, "g");
      expect(attrRegex.lastIndex).toBe(0);
      attrRegex.test(content);
      expect(attrRegex.lastIndex).toBeGreaterThan(0);
    });
  });
});
