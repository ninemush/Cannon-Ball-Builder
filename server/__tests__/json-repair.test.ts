import { describe, it, expect } from "vitest";
import { sanitizeAndParseJson, balanceBrackets, diagnoseJsonFailure } from "../lib/json-utils";
import { repairTruncatedPackageJson } from "../uipath-prompts";

describe("sanitizeAndParseJson bracket-balancing", () => {
  it("parses valid JSON normally", () => {
    const result = sanitizeAndParseJson('{"name": "test", "value": 42}');
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("repairs missing closing brace", () => {
    const result = sanitizeAndParseJson('{"name": "test", "value": 42');
    expect(result).toEqual({ name: "test", value: 42 });
  });

  it("repairs missing closing bracket and brace", () => {
    const result = sanitizeAndParseJson('{"items": [1, 2, 3');
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("repairs trailing comma before missing close", () => {
    const result = sanitizeAndParseJson('{"a": 1, "b": 2,}');
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("throws cleanly for irreparable input", () => {
    expect(() => sanitizeAndParseJson("not json at all")).toThrow();
  });
});

describe("balanceBrackets", () => {
  it("closes unclosed braces", () => {
    const result = balanceBrackets('{"a": 1');
    expect(JSON.parse(result)).toEqual({ a: 1 });
  });

  it("closes nested unclosed structures", () => {
    const result = balanceBrackets('{"a": [{"b": 1');
    expect(JSON.parse(result)).toEqual({ a: [{ b: 1 }] });
  });

  it("handles truncated mid-string by closing the string", () => {
    const result = balanceBrackets('{"name": "hel');
    expect(result).toContain('"');
    expect(result).toMatch(/}$/);
  });

  it("strips trailing commas before closing brackets", () => {
    const result = balanceBrackets('{"items": [1, 2,]}');
    expect(JSON.parse(result)).toEqual({ items: [1, 2] });
  });

  it("returns unchanged text when already balanced", () => {
    const input = '{"a": 1}';
    expect(balanceBrackets(input)).toBe(input);
  });
});

describe("repairTruncatedPackageJson", () => {
  it("repairs truncated mid-array", () => {
    const input = '{"workflows": [{"name": "Main", "steps": [{"activity": "Login"}, {"activity": "Click"';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.workflows).toBeDefined();
    expect(result.workflows[0].steps.length).toBeGreaterThanOrEqual(1);
  });

  it("repairs truncated mid-string value", () => {
    const input = '{"projectName": "TestProject", "description": "A long description that gets trun';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.projectName).toBe("TestProject");
  });

  it("repairs trailing comma after last property", () => {
    const input = '{"projectName": "Test", "description": "desc",}';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.projectName).toBe("Test");
    expect(result.description).toBe("desc");
  });

  it("repairs trailing comma in nested array", () => {
    const input = '{"items": ["a", "b", "c",]}';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.items).toEqual(["a", "b", "c"]);
  });

  it("repairs partially written property name", () => {
    const input = '{"name": "Test", "desc';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.name).toBe("Test");
  });

  it("repairs partial property with colon but no value", () => {
    const input = '{"name": "Test", "description": ';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.name).toBe("Test");
  });

  it("handles code-fenced input", () => {
    const input = '```json\n{"name": "Test"}\n```';
    const result = repairTruncatedPackageJson(input);
    expect(result).toEqual({ name: "Test" });
  });

  it("returns null for non-JSON input", () => {
    const result = repairTruncatedPackageJson("This is not JSON at all");
    expect(result).toBeNull();
  });

  it("returns null for irreparable malformed JSON", () => {
    const result = repairTruncatedPackageJson("{{{{{");
    expect(result).toBeNull();
  });

  it("repairs partial object value truncation", () => {
    const input = '{"arr":[{"k":';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("arr");
  });

  it("repairs deeply nested truncation", () => {
    const input = '{"workflows": [{"name": "Main", "variables": [{"name": "var1", "type": "String"}, {"name": "var2", "type": "Int32"';
    const result = repairTruncatedPackageJson(input);
    expect(result).not.toBeNull();
    expect(result.workflows[0].variables.length).toBeGreaterThanOrEqual(1);
  });
});

describe("diagnoseJsonFailure", () => {
  it("detects truncated mid-string", () => {
    const diag = diagnoseJsonFailure('{"name": "hello worl');
    expect(diag.endsInString).toBe(true);
    expect(diag.truncationHint).toBe("truncated_mid_string");
    expect(diag.totalLength).toBe(20);
  });

  it("detects unclosed brackets", () => {
    const diag = diagnoseJsonFailure('{"items": [1, 2, 3');
    expect(diag.bracketDepth).toBe(2);
    expect(diag.truncationHint).toBe("unclosed_brackets_depth_2");
  });

  it("detects trailing comma on balanced JSON", () => {
    const diag = diagnoseJsonFailure('{"a": 1, "b": 2},');
    expect(diag.truncationHint).toBe("trailing_comma");
  });

  it("detects unclosed brackets with trailing comma", () => {
    const diag = diagnoseJsonFailure('{"a": 1, "b": 2,');
    expect(diag.bracketDepth).toBe(1);
    expect(diag.truncationHint).toContain("unclosed_brackets");
  });

  it("detects balanced but invalid JSON", () => {
    const diag = diagnoseJsonFailure('{not valid json}');
    expect(diag.truncationHint).toBe("balanced_but_invalid");
  });

  it("redacts credential-like patterns", () => {
    const diag = diagnoseJsonFailure('{"api_key": "sk-abc123456789xyz", "name": "test"}');
    expect(diag.head).not.toContain("sk-abc123456789xyz");
    expect(diag.head).toContain("[REDACTED]");
  });

  it("redacts Authorization Bearer tokens", () => {
    const diag = diagnoseJsonFailure('{"Authorization": "Bearer eyJhbGciOiJSUzI1NiJ9.payload.sig", "data": "ok"}');
    expect(diag.head).not.toContain("eyJhbGciOiJSUzI1NiJ9");
    expect(diag.head).toContain("[REDACTED]");
  });

  it("redacts password fields", () => {
    const diag = diagnoseJsonFailure('{"password": "mySuperSecret123!", "user": "admin"}');
    expect(diag.head).not.toContain("mySuperSecret123!");
  });

  it("redacts multiple secret fields", () => {
    const diag = diagnoseJsonFailure('{"token": "tok_abc123456", "secret": "sec_xyz789012"}');
    expect(diag.head).not.toContain("tok_abc123456");
    expect(diag.head).not.toContain("sec_xyz789012");
  });

  it("provides head and tail for long inputs", () => {
    const longStr = '{"data": "' + "x".repeat(3000) + '"}';
    const diag = diagnoseJsonFailure(longStr);
    expect(diag.head.length).toBeLessThanOrEqual(1500);
    expect(diag.tail.length).toBeLessThanOrEqual(500);
    expect(diag.tail.length).toBeGreaterThan(0);
  });
});
