import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import { resolveDownloadPath, type DownloadPathInput } from "../document-routes";

function buildValidNupkgBuffer(libPrefix: string, xamlFiles: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(xamlFiles)) {
    zip.addFile(`${libPrefix}${name}`, Buffer.from(content, "utf-8"));
  }
  zip.addFile(`${libPrefix}project.json`, Buffer.from("{}", "utf-8"));
  zip.addFile("_rels/.rels", Buffer.from("<Relationships/>", "utf-8"));
  zip.addFile("[Content_Types].xml", Buffer.from("<Types/>", "utf-8"));
  zip.addFile("package.nuspec", Buffer.from("<package/>", "utf-8"));
  return zip.toBuffer();
}

function makeInput(overrides: Partial<DownloadPathInput> = {}): DownloadPathInput {
  return {
    packageBuffer: Buffer.alloc(0),
    packageViable: false,
    xamlEntries: [],
    archiveManifest: [],
    projectName: "TestProject",
    dependencyMap: {},
    dhgContent: "",
    libPrefix: "lib/net45/",
    sddContent: "",
    pkgDescription: "",
    resolveProjectJson: () => JSON.stringify({ name: "TestProject", main: "Main.xaml" }),
    ...overrides,
  };
}

describe("Task 449: resolveDownloadPath — handoff-only download reconstruction", () => {

  describe("Viable package downloads normally", () => {
    it("extracts entries from a valid nupkg packageBuffer", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", {
        "Main.xaml": "<Activity>main</Activity>",
        "Process.xaml": "<Activity>process</Activity>",
      });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
      }));
      expect(result.downloadSource).toBe("viable-buffer");
      expect(result.zipEntries).not.toBeNull();
      expect(result.zipEntries!.length).toBeGreaterThanOrEqual(2);
      expect(result.isHandoffOnly).toBe(false);
      expect(result.failReason).toBeUndefined();
      const names = result.zipEntries!.map(e => e.name);
      expect(names).toContain("Main.xaml");
      expect(names).toContain("Process.xaml");
      expect(names).toContain("project.json");
      expect(names).not.toContain("_rels/.rels");
      expect(names).not.toContain("[Content_Types].xml");
    });
  });

  describe("Viable packageBuffer is not overridden by reconstruction when both are present", () => {
    it("prefers viable packageBuffer over cached XAML entries", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", {
        "Main.xaml": "<Activity>from-buffer</Activity>",
      });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
        xamlEntries: [
          { name: "Main.xaml", content: "<Activity>from-cache</Activity>" },
          { name: "Extra.xaml", content: "<Activity>extra</Activity>" },
        ],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/Extra.xaml", "lib/net45/project.json"],
      }));
      expect(result.downloadSource).toBe("viable-buffer");
      const mainEntry = result.zipEntries!.find(e => e.name === "Main.xaml");
      expect(mainEntry).toBeDefined();
      expect(mainEntry!.content.toString()).toContain("from-buffer");
    });
  });

  describe("Empty packageBuffer with cached XAML entries reconstructs successfully", () => {
    it("reconstructs from cached XAML when packageBuffer is empty", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [
          { name: "Main.xaml", content: "<Activity>main</Activity>" },
          { name: "Process.xaml", content: "<Activity>process</Activity>" },
        ],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/Process.xaml", "lib/net45/project.json"],
      }));
      expect(result.downloadSource).toBe("reconstructed-from-cache");
      expect(result.zipEntries).not.toBeNull();
      expect(result.zipEntries!.length).toBe(3);
      const names = result.zipEntries!.map(e => e.name);
      expect(names).toContain("Main.xaml");
      expect(names).toContain("Process.xaml");
      expect(names).toContain("project.json");
    });

    it("reconstructs with DHG content when available", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity/>" }],
        archiveManifest: [
          "lib/net45/Main.xaml",
          "lib/net45/project.json",
          "lib/net45/DeveloperHandoffGuide.md",
        ],
        dhgContent: "# Developer Handoff Guide\nThis package needs remediation.",
      }));
      expect(result.downloadSource).toBe("reconstructed-from-cache");
      const dhgEntry = result.zipEntries!.find(e => e.name === "DeveloperHandoffGuide.md");
      expect(dhgEntry).toBeDefined();
      expect(dhgEntry!.content).toContain("Developer Handoff Guide");
    });

    it("falls back to reconstruction when packageBuffer contains invalid zip data", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.from("not-a-valid-zip-file"),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity>reconstructed</Activity>" }],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      }));
      expect(result.downloadSource).toBe("reconstructed-from-cache");
      expect(result.zipEntries).not.toBeNull();
      const mainEntry = result.zipEntries!.find(e => e.name === "Main.xaml");
      expect(mainEntry).toBeDefined();
      expect(mainEntry!.content).toContain("reconstructed");
    });
  });

  describe("Handoff-only package remains downloadable with warnings", () => {
    it("reconstructed handoff-only package is marked as handoff-only", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity>handoff</Activity>" }],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      }));
      expect(result.downloadSource).toBe("reconstructed-from-cache");
      expect(result.isHandoffOnly).toBe(true);
      expect(result.zipEntries).not.toBeNull();
      expect(result.failReason).toBeUndefined();
    });

    it("handoff-only with valid buffer still serves from buffer with handoff flag", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", {
        "Main.xaml": "<Activity>buffered-handoff</Activity>",
      });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity>cached</Activity>" }],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      }));
      expect(result.downloadSource).toBe("viable-buffer");
      expect(result.isHandoffOnly).toBe(true);
    });
  });

  describe("Unreconstructable package fails with clear reason", () => {
    it("fails when no buffer and no cached XAML", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [],
        archiveManifest: [],
      }));
      expect(result.zipEntries).toBeNull();
      expect(result.downloadSource).toBeNull();
      expect(result.failReason).toBe("No package buffer and no cached XAML entries available.");
    });

    it("fails when buffer is empty and reconstruction has no Main.xaml", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [
          { name: "Helper.xaml", content: "<Activity>helper</Activity>" },
        ],
        archiveManifest: ["lib/net45/Helper.xaml", "lib/net45/project.json"],
      }));
      expect(result.zipEntries).toBeNull();
      expect(result.downloadSource).toBeNull();
      expect(result.failReason).toBe("Package buffer is empty and reconstruction from cached XAML entries failed.");
    });

    it("falls back to raw-nupkg when buffer exists but extraction fails and no cached XAML", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.from("corrupt-nupkg-data"),
        packageViable: false,
        xamlEntries: [],
        archiveManifest: [],
      }));
      expect(result.downloadSource).toBe("raw-nupkg");
      expect(result.zipEntries).toBeNull();
      expect(result.isHandoffOnly).toBe(true);
    });
  });

  describe("Readiness state remains not-ready for reconstructed handoff downloads", () => {
    it("reconstructed handoff is isHandoffOnly=true", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity/>" }],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      }));
      expect(result.isHandoffOnly).toBe(true);
      expect(result.downloadSource).toBe("reconstructed-from-cache");
    });

    it("viable package is isHandoffOnly=false", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", { "Main.xaml": "<Activity/>" });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
      }));
      expect(result.isHandoffOnly).toBe(false);
      expect(result.downloadSource).toBe("viable-buffer");
    });

    it("packageViable=false always produces isHandoffOnly=true regardless of download source", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", { "Main.xaml": "<Activity/>" });
      const fromBuffer = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: false,
      }));
      expect(fromBuffer.isHandoffOnly).toBe(true);
      expect(fromBuffer.downloadSource).toBe("viable-buffer");

      const fromCache = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity/>" }],
        archiveManifest: ["lib/net45/Main.xaml", "lib/net45/project.json"],
      }));
      expect(fromCache.isHandoffOnly).toBe(true);
      expect(fromCache.downloadSource).toBe("reconstructed-from-cache");
    });
  });

  describe("NuGet metadata filtering", () => {
    it("filters out _rels, package, Content_Types, and nuspec entries from nupkg extraction", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", { "Main.xaml": "<Activity/>" });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
      }));
      const names = result.zipEntries!.map(e => e.name);
      expect(names.every(n => !n.startsWith("_rels/"))).toBe(true);
      expect(names.every(n => !n.startsWith("package/"))).toBe(true);
      expect(names.every(n => n !== "[Content_Types].xml")).toBe(true);
      expect(names.every(n => !n.endsWith(".nuspec"))).toBe(true);
    });

    it("filters nuget meta from cached XAML reconstruction manifest", () => {
      const result = resolveDownloadPath(makeInput({
        packageBuffer: Buffer.alloc(0),
        packageViable: false,
        xamlEntries: [{ name: "Main.xaml", content: "<Activity/>" }],
        archiveManifest: [
          "_rels/.rels",
          "package/metadata.xml",
          "[Content_Types].xml",
          "TestProject.nuspec",
          "lib/net45/Main.xaml",
          "lib/net45/project.json",
        ],
      }));
      expect(result.downloadSource).toBe("reconstructed-from-cache");
      const names = result.zipEntries!.map(e => e.name);
      expect(names).toContain("Main.xaml");
      expect(names).toContain("project.json");
      expect(names).not.toContain("_rels/.rels");
      expect(names).not.toContain("[Content_Types].xml");
    });
  });

  describe("libPrefix stripping", () => {
    it("strips lib/net45/ prefix from entry names", () => {
      const nupkg = buildValidNupkgBuffer("lib/net45/", { "Main.xaml": "<Activity/>" });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
        libPrefix: "lib/net45/",
      }));
      const names = result.zipEntries!.map(e => e.name);
      expect(names).toContain("Main.xaml");
      expect(names.every(n => !n.startsWith("lib/net45/"))).toBe(true);
    });

    it("strips lib/net6.0/ prefix for serverless packages", () => {
      const nupkg = buildValidNupkgBuffer("lib/net6.0/", { "Main.xaml": "<Activity/>" });
      const result = resolveDownloadPath(makeInput({
        packageBuffer: nupkg,
        packageViable: true,
        libPrefix: "lib/net6.0/",
      }));
      const names = result.zipEntries!.map(e => e.name);
      expect(names).toContain("Main.xaml");
    });
  });
});
