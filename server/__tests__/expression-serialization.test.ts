import { describe, it, expect } from "vitest";
import { escapeXml, escapeXmlExpression, decodeXmlEntities, normalizeXmlExpression } from "../lib/xml-utils";
import { lintExpression } from "../xaml/vbnet-expression-linter";

describe("Expression Serialization — No Double Encoding", () => {
  describe("escapeXmlExpression (attribute context)", () => {
    it("encodes raw quotes correctly", () => {
      const result = escapeXmlExpression('str_Status = "Sent"');
      expect(result).toBe("str_Status = &quot;Sent&quot;");
    });

    it("does not double-encode pre-existing &quot;", () => {
      const result = escapeXmlExpression("str_Status = &quot;Sent&quot;");
      expect(result).toBe("str_Status = &quot;Sent&quot;");
    });

    it("does not double-encode pre-existing &amp;", () => {
      const result = escapeXmlExpression("str_A &amp; str_B");
      expect(result).toBe("str_A &amp; str_B");
    });

    it("encodes raw ampersand for VB concatenation", () => {
      const result = escapeXmlExpression("str_A & str_B");
      expect(result).toBe("str_A &amp; str_B");
    });

    it("handles mixed raw and pre-encoded content", () => {
      const result = escapeXmlExpression('str_Status = &quot;Sent&quot; And str_Name = "John"');
      expect(result).toBe("str_Status = &quot;Sent&quot; And str_Name = &quot;John&quot;");
    });

    it("does not double-encode &amp;quot; (triple encoding prevention)", () => {
      const result = escapeXmlExpression("str_Status = &amp;quot;Sent&amp;quot;");
      expect(result).toBe("str_Status = &quot;Sent&quot;");
    });

    it("handles &lt; and &gt; without double encoding", () => {
      const result = escapeXmlExpression("int_Count &gt; 0");
      expect(result).toBe("int_Count &gt; 0");
    });

    it("handles raw < and > correctly", () => {
      const result = escapeXmlExpression("int_Count > 0");
      expect(result).toBe("int_Count &gt; 0");
    });

    it("handles string with VB concatenation operator and quotes", () => {
      const result = escapeXmlExpression('"Hello " & str_Name & " World"');
      expect(result).toBe("&quot;Hello &quot; &amp; str_Name &amp; &quot; World&quot;");
    });

    it("idempotent: applying twice produces same result", () => {
      const expr = 'str_Status = "Sent" And int_Count > 0';
      const once = escapeXmlExpression(expr);
      const twice = escapeXmlExpression(once);
      expect(twice).toBe(once);
    });
  });

  describe("normalizeXmlExpression (element context)", () => {
    it("fixes double-encoded &amp;quot;", () => {
      const result = normalizeXmlExpression("str_Status = &amp;quot;Sent&amp;quot;");
      expect(result).toBe("str_Status = &quot;Sent&quot;");
    });

    it("fixes double-encoded &amp;amp;", () => {
      const result = normalizeXmlExpression("str_A &amp;amp; str_B");
      expect(result).toBe("str_A &amp; str_B");
    });

    it("fixes double-encoded &amp;lt; and &amp;gt;", () => {
      expect(normalizeXmlExpression("int_Count &amp;lt; 10")).toBe("int_Count &lt; 10");
      expect(normalizeXmlExpression("int_Count &amp;gt; 0")).toBe("int_Count &gt; 0");
    });

    it("leaves correctly encoded content unchanged", () => {
      const input = "str_Status = &quot;Sent&quot;";
      expect(normalizeXmlExpression(input)).toBe(input);
    });

    it("leaves raw VB operators unchanged", () => {
      const input = "[int_SeverityCode <> 10]";
      expect(normalizeXmlExpression(input)).toBe(input);
    });

    it("handles nested double-encoding (&amp;amp;quot;)", () => {
      const result = normalizeXmlExpression("str_Status = &amp;amp;quot;Sent&amp;amp;quot;");
      expect(result).toBe("str_Status = &quot;Sent&quot;");
    });
  });

  describe("decodeXmlEntities", () => {
    it("decodes all XML entities", () => {
      expect(decodeXmlEntities("&amp;")).toBe("&");
      expect(decodeXmlEntities("&quot;")).toBe('"');
      expect(decodeXmlEntities("&lt;")).toBe("<");
      expect(decodeXmlEntities("&gt;")).toBe(">");
      expect(decodeXmlEntities("&apos;")).toBe("'");
    });

    it("fully decodes all levels of encoding", () => {
      expect(decodeXmlEntities("&amp;quot;")).toBe('"');
      expect(decodeXmlEntities("&amp;amp;")).toBe("&");
      expect(decodeXmlEntities("&amp;amp;quot;")).toBe('"');
    });
  });

  describe("Linter double-encoding detection", () => {
    it("detects and repairs &amp;quot; in expressions", () => {
      const result = lintExpression("str_Status = &amp;quot;Sent&amp;quot;");
      expect(result.issues.some(i => i.code === "DOUBLE_ENCODED_QUOT")).toBe(true);
      expect(result.corrected).toContain("&quot;Sent&quot;");
      expect(result.corrected).not.toContain("&amp;quot;");
    });

    it("detects and repairs &amp;amp; in expressions", () => {
      const result = lintExpression("str_A &amp;amp; str_B");
      expect(result.issues.some(i => i.code === "DOUBLE_ENCODED_AMP")).toBe(true);
      expect(result.corrected).toContain("&amp;");
      expect(result.corrected).not.toContain("&amp;amp;");
    });

    it("detects and repairs &amp;lt; in expressions", () => {
      const result = lintExpression("int_Count &amp;lt; 10");
      expect(result.issues.some(i => i.code === "DOUBLE_ENCODED_LT")).toBe(true);
      expect(result.corrected).toContain("&lt;");
      expect(result.corrected).not.toContain("&amp;lt;");
    });

    it("detects and repairs &amp;gt; in expressions", () => {
      const result = lintExpression("int_Count &amp;gt; 0");
      expect(result.issues.some(i => i.code === "DOUBLE_ENCODED_GT")).toBe(true);
      expect(result.corrected).toContain("&gt;");
      expect(result.corrected).not.toContain("&amp;gt;");
    });

    it("leaves correctly encoded expressions untouched", () => {
      const result = lintExpression("str_Status = &quot;Sent&quot;");
      expect(result.issues.filter(i => i.code.startsWith("DOUBLE_ENCODED_")).length).toBe(0);
    });
  });

  describe("End-to-end attribute serialization scenarios", () => {
    it("raw string comparison: str_Status = \"Sent\"", () => {
      const expr = 'str_Status = "Sent"';
      const serialized = `[${escapeXmlExpression(expr)}]`;
      expect(serialized).toBe("[str_Status = &quot;Sent&quot;]");
      expect(serialized).not.toContain("&amp;quot;");
    });

    it("pre-encoded string comparison: str_Status = &quot;Sent&quot;", () => {
      const expr = "str_Status = &quot;Sent&quot;";
      const serialized = `[${escapeXmlExpression(expr)}]`;
      expect(serialized).toBe("[str_Status = &quot;Sent&quot;]");
      expect(serialized).not.toContain("&amp;quot;");
    });

    it("VB concatenation with &", () => {
      const expr = '"Hello " & str_Name';
      const serialized = `[${escapeXmlExpression(expr)}]`;
      expect(serialized).toBe("[&quot;Hello &quot; &amp; str_Name]");
      expect(serialized).not.toContain("&amp;amp;");
      expect(serialized).not.toContain("&amp;quot;");
    });

    it("mixed string literals and operators", () => {
      const expr = 'str_Name <> "" And int_Age > 18';
      const serialized = `[${escapeXmlExpression(expr)}]`;
      expect(serialized).toBe("[str_Name &lt;&gt; &quot;&quot; And int_Age &gt; 18]");
    });
  });
});
