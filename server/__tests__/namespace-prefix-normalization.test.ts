import { describe, it, expect } from "vitest";
import { getActivityPrefixStrict, validateActivityTagSemantics, validateNamespacePrefixes } from "../xaml/xaml-compliance";

describe("XAML namespace prefix normalization", () => {
  describe("getActivityPrefixStrict canonical prefix lookup", () => {
    it("returns 'ui' for Click", () => {
      expect(getActivityPrefixStrict("Click")).toBe("ui");
    });

    it("returns 'uweb' for HttpClient", () => {
      expect(getActivityPrefixStrict("HttpClient")).toBe("uweb");
    });

    it("returns '' (no prefix) for system activities like Assign", () => {
      expect(getActivityPrefixStrict("Assign")).toBe("");
    });

    it("returns null for unknown activities", () => {
      expect(getActivityPrefixStrict("CompletelyUnknownActivity")).toBeNull();
    });
  });

  describe("validateActivityTagSemantics prefix repair", () => {
    it("rewrites uia: prefix to ui: for known activities", () => {
      const xml = `<uia:Click DisplayName="Click Button" /><uia:TypeInto DisplayName="Type text" /></uia:TypeInto>`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<ui:Click ");
      expect(result.repairedXml).toContain("<ui:TypeInto ");
      expect(result.repairedXml).toContain("</ui:TypeInto>");
      expect(result.repairedXml).not.toContain("uia:");
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.valid).toBe(true);
    });

    it("rewrites uipath: prefix to ui: for known activities", () => {
      const xml = `<uipath:GetText DisplayName="Get Text" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<ui:GetText ");
      expect(result.repairedXml).not.toContain("uipath:");
      expect(result.valid).toBe(true);
    });

    it("rewrites wrong prefix to correct non-ui prefix", () => {
      const xml = `<ui:HttpClient DisplayName="HTTP Request" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<uweb:HttpClient ");
      expect(result.valid).toBe(true);
    });

    it("removes prefix for system activities with wrong prefix", () => {
      const xml = `<ui:Assign DisplayName="Set value">
        <ui:Assign.To><OutArgument x:TypeArguments="x:String">test</OutArgument></ui:Assign.To>
        <ui:Assign.Value><InArgument x:TypeArguments="x:String">value</InArgument></ui:Assign.Value>
      </ui:Assign>`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toContain("<Assign ");
      expect(result.repairedXml).toContain("</Assign>");
      expect(result.repairedXml).toContain("<Assign.To>");
      expect(result.repairedXml).not.toContain("<ui:Assign");
      expect(result.valid).toBe(true);
    });

    it("does not modify correctly-prefixed activities", () => {
      const xml = `<ui:Click DisplayName="Click" />`;
      const result = validateActivityTagSemantics(xml);
      expect(result.repairedXml).toBe(xml);
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe("semantic repair runs before namespace validation", () => {
    it("uia: prefix in tags would fail namespace validation but passes after semantic repair", () => {
      const xmlWithBadPrefix = `<uia:Click DisplayName="Click Button" />`;

      const nsResultBefore = validateNamespacePrefixes(xmlWithBadPrefix);
      expect(nsResultBefore.valid).toBe(false);
      expect(nsResultBefore.errors.some(e => e.includes("uia"))).toBe(true);

      const semanticResult = validateActivityTagSemantics(xmlWithBadPrefix);
      expect(semanticResult.repairedXml).toContain("<ui:Click ");

      const nsResultAfter = validateNamespacePrefixes(semanticResult.repairedXml);
      expect(nsResultAfter.errors.filter(e => e.includes("uia"))).toHaveLength(0);
    });
  });
});
