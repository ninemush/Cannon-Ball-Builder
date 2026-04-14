import { describe, it, expect } from "vitest";
import {
  isCSharpLanguage,
  buildRootActivityAttr,
  buildRootActivityChildren,
  buildComplianceActivityAttr,
  buildComplianceChildren,
  buildTextExpressionBlocks,
  buildNamespacesXml,
  buildAssemblyRefsXml,
  getNamespacesForImplementation,
  getAssemblyReferences,
} from "../xaml/xaml-studio-references";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

describe("Task #515: Studio 25.10.7 template alignment", () => {

  describe("isCSharpLanguage detection", () => {
    it("Windows framework without expression language is VB", () => {
      expect(isCSharpLanguage("Windows")).toBe(false);
    });

    it("Portable framework without expression language is C#", () => {
      expect(isCSharpLanguage("Portable")).toBe(true);
    });

    it("Windows + CSharp expression language is C#", () => {
      expect(isCSharpLanguage("Windows", "CSharp")).toBe(true);
    });

    it("Portable + VisualBasic expression language is VB", () => {
      expect(isCSharpLanguage("Portable", "VisualBasic")).toBe(false);
    });

    it("undefined framework defaults to VB", () => {
      expect(isCSharpLanguage(undefined)).toBe(false);
    });
  });

  describe("buildRootActivityAttr — C# attribute placement", () => {
    it("returns empty string for VB (Windows)", () => {
      expect(buildRootActivityAttr("Windows")).toBe("");
    });

    it("returns ExpressionActivityEditor attribute for C# (Portable)", () => {
      const attr = buildRootActivityAttr("Portable");
      expect(attr).toContain('sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"');
    });

    it("C# attribute starts with newline for proper XML formatting", () => {
      const attr = buildRootActivityAttr("Portable");
      expect(attr.startsWith("\n")).toBe(true);
    });
  });

  describe("buildRootActivityChildren — VB Settings child element", () => {
    it("returns VisualBasic.Settings for VB (Windows)", () => {
      const children = buildRootActivityChildren("Windows");
      expect(children).toContain("<mva:VisualBasic.Settings>");
      expect(children).toContain("<x:Null />");
    });

    it("returns empty string for C# (Portable)", () => {
      expect(buildRootActivityChildren("Portable")).toBe("");
    });
  });

  describe("buildComplianceActivityAttr — compliance pass C# handling", () => {
    it("returns empty for VB", () => {
      expect(buildComplianceActivityAttr("Windows")).toBe("");
    });

    it("returns ExpressionActivityEditor for C#", () => {
      const attr = buildComplianceActivityAttr("Portable");
      expect(attr).toContain('ExpressionActivityEditor="C#"');
    });
  });

  describe("buildComplianceChildren — compliance pass child elements", () => {
    it("VB includes VisualBasic.Settings and WorkflowViewState.IdRef", () => {
      const children = buildComplianceChildren("Windows", "Main_1");
      expect(children).toContain("VisualBasic.Settings");
      expect(children).toContain("WorkflowViewState.IdRef");
      expect(children).toContain("Main_1");
    });

    it("C# includes WorkflowViewState.IdRef but NOT VisualBasic.Settings", () => {
      const children = buildComplianceChildren("Portable", "Main_1");
      expect(children).toContain("WorkflowViewState.IdRef");
      expect(children).not.toContain("VisualBasic.Settings");
    });

    it("C# compliance children do NOT include ExpressionActivityEditor attribute", () => {
      const children = buildComplianceChildren("Portable", "Main_1");
      expect(children).not.toContain("ExpressionActivityEditor");
    });

    it("both VB and C# include TextExpression namespace/assembly blocks", () => {
      const vb = buildComplianceChildren("Windows", "Main_1");
      const cs = buildComplianceChildren("Portable", "Main_1");
      expect(vb).toContain("NamespacesForImplementation");
      expect(cs).toContain("NamespacesForImplementation");
      expect(vb).toContain("ReferencesForImplementation");
      expect(cs).toContain("ReferencesForImplementation");
    });
  });

  describe("buildTextExpressionBlocks", () => {
    it("Windows includes NamespacesForImplementation", () => {
      const blocks = buildTextExpressionBlocks("Windows");
      expect(blocks).toContain("TextExpression.NamespacesForImplementation");
    });

    it("Windows includes mscorlib in assembly references (Studio baseline parity)", () => {
      const blocks = buildTextExpressionBlocks("Windows");
      expect(blocks).toContain("mscorlib");
    });

    it("Portable includes System.Runtime assemblies", () => {
      const blocks = buildTextExpressionBlocks("Portable");
      expect(blocks).toContain("System.Runtime");
    });

    it("includes UiPath.Core and UiPath.Core.Activities namespaces", () => {
      const blocks = buildTextExpressionBlocks("Windows");
      expect(blocks).toContain("UiPath.Core");
      expect(blocks).toContain("UiPath.Core.Activities");
    });
  });

  describe("getAssemblyReferences", () => {
    it("Windows includes System.Private.CoreLib", () => {
      const refs = getAssemblyReferences("Windows");
      expect(refs).toContain("System.Private.CoreLib");
    });

    it("Windows includes mscorlib (Studio baseline parity)", () => {
      const refs = getAssemblyReferences("Windows");
      expect(refs).toContain("mscorlib");
    });

    it("VB includes Microsoft.VisualBasic", () => {
      const refs = getAssemblyReferences("Windows");
      expect(refs).toContain("Microsoft.VisualBasic");
    });

    it("C# includes Microsoft.CSharp", () => {
      const refs = getAssemblyReferences("Portable");
      expect(refs).toContain("Microsoft.CSharp");
    });

    it("C# does not include Microsoft.VisualBasic", () => {
      const refs = getAssemblyReferences("Portable");
      expect(refs).not.toContain("Microsoft.VisualBasic");
    });
  });

  describe("buildAssemblyRefsXml", () => {
    it("produces valid XML structure", () => {
      const xml = buildAssemblyRefsXml("Windows");
      expect(xml).toContain("<TextExpression.ReferencesForImplementation>");
      expect(xml).toContain("</TextExpression.ReferencesForImplementation>");
      expect(xml).toContain('<sco:Collection x:TypeArguments="AssemblyReference">');
    });
  });

  describe("getNamespacesForImplementation", () => {
    it("includes standard System namespaces", () => {
      const ns = getNamespacesForImplementation("Windows");
      expect(ns).toContain("System");
      expect(ns).toContain("System.Collections.Generic");
      expect(ns).toContain("System.Linq");
    });

    it("includes UiPath namespaces", () => {
      const ns = getNamespacesForImplementation("Windows");
      expect(ns).toContain("UiPath.Core");
      expect(ns).toContain("UiPath.Core.Activities");
    });
  });

  describe("Studio baseline files", () => {
    const basePath = join(process.cwd(), "server", "xaml-references", "studio-baselines");

    it("baselines-meta.json exists and is valid", () => {
      const metaPath = join(basePath, "baselines-meta.json");
      expect(existsSync(metaPath)).toBe(true);
      const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
      expect(meta.studioVersion).toBe("25.10.7");
      expect(meta.createdAt).toBeDefined();
    });

    it("all 4 template directories exist with Main.xaml", () => {
      const templates = ["windows-vb", "crossplatform-vb", "windows-csharp", "crossplatform-csharp"];
      for (const t of templates) {
        expect(existsSync(join(basePath, t, "Main.xaml"))).toBe(true);
      }
    });

    it("baselines-meta.json includes per-file SHA-256 hashes", () => {
      const meta = JSON.parse(readFileSync(join(basePath, "baselines-meta.json"), "utf-8"));
      const templates = ["windows-vb", "crossplatform-vb", "windows-csharp", "crossplatform-csharp"];
      for (const t of templates) {
        expect(meta.templates[t].hashes).toBeDefined();
        expect(meta.templates[t].hashes["Main.xaml"]).toBeDefined();
        expect(meta.templates[t].hashes["Main.xaml"].length).toBe(64);
      }
    });

    it("baseline file hashes match actual file contents", () => {
      const meta = JSON.parse(readFileSync(join(basePath, "baselines-meta.json"), "utf-8"));
      for (const [tName, tMeta] of Object.entries(meta.templates) as [string, any][]) {
        for (const [fileName, expectedHash] of Object.entries(tMeta.hashes) as [string, string][]) {
          const filePath = join(basePath, tName, fileName);
          if (!existsSync(filePath)) continue;
          const content = readFileSync(filePath);
          const actualHash = createHash("sha256").update(content).digest("hex");
          expect(actualHash).toBe(expectedHash);
        }
      }
    });

    it("windows-vb baseline uses mscorlib in namespaces (Studio convention)", () => {
      const xaml = readFileSync(join(basePath, "windows-vb", "Main.xaml"), "utf-8");
      expect(xaml).toContain("assembly=mscorlib");
    });

    it("crossplatform-csharp baseline has ExpressionActivityEditor attribute", () => {
      const xaml = readFileSync(join(basePath, "crossplatform-csharp", "Main.xaml"), "utf-8");
      expect(xaml).toContain('ExpressionActivityEditor="C#"');
    });

    it("windows-vb baseline has VisualBasic.Settings", () => {
      const xaml = readFileSync(join(basePath, "windows-vb", "Main.xaml"), "utf-8");
      expect(xaml).toContain("VisualBasic.Settings");
    });
  });

  describe("project.json fields", () => {
    it("package-assembler includes workflowSerialization", async () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain('"NewtonsoftJson"');
    });

    it("package-assembler includes projectId generation", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain("projectId:");
      expect(content).toContain("generateUuid()");
    });

    it("package-assembler has conditional requiresUserInteraction", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toMatch(/requiresUserInteraction.*tf\s*===\s*"Windows"/);
    });

    it("package-assembler does not include includeOriginalXaml", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).not.toContain("includeOriginalXaml");
    });
  });

  describe("entry-points.json and project.uiproj emission", () => {
    it("package-assembler emits entry-points.json in archive", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain("entry-points.json");
    });

    it("package-assembler emits project.uiproj in archive", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain("project.uiproj");
    });

    it("entry-points.json uses projectJson.entryPoints for ID parity", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain("projectJson.entryPoints");
    });
  });

  describe("VB vs C# root attribute correctness in XAML output", () => {
    it("VB output has VisualBasic.Settings as child element, not as attribute", () => {
      const attr = buildRootActivityAttr("Windows");
      const children = buildRootActivityChildren("Windows");
      expect(attr).toBe("");
      expect(children).toContain("<mva:VisualBasic.Settings>");
    });

    it("C# output has ExpressionActivityEditor as attribute, not as child element", () => {
      const attr = buildRootActivityAttr("Portable");
      const children = buildRootActivityChildren("Portable");
      expect(attr).toContain("ExpressionActivityEditor");
      expect(children).toBe("");
    });

    it("C# attribute is formatted for XML attribute placement (before >)", () => {
      const attr = buildRootActivityAttr("Portable");
      expect(attr).toMatch(/^\n\s+sap2010:ExpressionActivityEditor/);
    });
  });

  describe("buildXaml framework-aware fallback generation", () => {
    it("package-assembler buildXaml passes targetFramework to shared helpers", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toContain("buildXaml(\"Main\"");
      expect(content).toMatch(/buildXaml\("Main".*,\s*tf\)/);
      expect(content).toMatch(/buildXaml\("Process".*,\s*tf\)/);
    });

    it("generateStubWithInvokePreservation accepts targetFramework parameter", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      expect(content).toMatch(/function generateStubWithInvokePreservation[\s\S]*?targetFramework\??: string/);
    });

    it("all stub call sites pass tf to generateStubWithInvokePreservation", () => {
      const content = readFileSync(join(process.cwd(), "server", "package-assembler.ts"), "utf-8");
      const lines = content.split("\n");
      const callLines = lines.filter(l => l.includes("generateStubWithInvokePreservation(") && !l.includes("function ") && !l.includes("export "));
      expect(callLines.length).toBeGreaterThanOrEqual(5);
      const tfPassLines = lines.filter(l => l.includes(", tf)") || l.includes(", tf);"));
      expect(tfPassLines.length).toBeGreaterThanOrEqual(callLines.length);
    });
  });

  describe("FRAMEWORK_ASSEMBLIES expansion", () => {
    it("uipath-shared.ts includes expanded assembly set", () => {
      const content = readFileSync(join(process.cwd(), "server", "uipath-shared.ts"), "utf-8");
      expect(content).toContain("System.Drawing.Common");
      expect(content).toContain("System.Drawing.Primitives");
      expect(content).toContain("System.Data.Common");
      expect(content).toContain("System.Data.DataSetExtensions");
      expect(content).toContain("System.Net.Mail");
      expect(content).toContain("System.ObjectModel");
      expect(content).toContain("System.Linq");
      expect(content).toContain("System.ComponentModel.TypeConverter");
      expect(content).toContain("System.Runtime.Serialization");
      expect(content).toContain("System.ServiceModel.Activities");
      expect(content).toContain("System.Private.CoreLib");
      expect(content).toContain("UiPath.Platform");
    });
  });

  describe("checkBaselineFreshness", () => {
    it("is exported from metadata-refresher", async () => {
      const mod = await import("../catalog/metadata-refresher");
      expect(typeof mod.checkBaselineFreshness).toBe("function");
    });

    it("metadata-refresher includes hash validation logic", () => {
      const content = readFileSync(join(process.cwd(), "server", "catalog", "metadata-refresher.ts"), "utf-8");
      expect(content).toContain("createHash");
      expect(content).toContain("sha256");
      expect(content).toContain("hashMismatches");
    });

    it("metadata-refresher checks baseline age against 90-day threshold", () => {
      const content = readFileSync(join(process.cwd(), "server", "catalog", "metadata-refresher.ts"), "utf-8");
      expect(content).toContain("STALE_THRESHOLD_DAYS");
      expect(content).toContain("90");
    });
  });
});
