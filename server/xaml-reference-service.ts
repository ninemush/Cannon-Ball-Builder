import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename_esm = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename_esm);

export interface ReferenceProject {
  id: string;
  name: string;
  description: string;
  pattern: string;
  systems: string[];
  frameworkVariant: string;
  frameworkFiles: string[];
  hasCodedWorkflows: boolean;
  hasProcessConstants: boolean;
  targetFramework: string;
  fileInventory: string[];
}

interface ReferenceMetadata {
  projects: ReferenceProject[];
}

const REFERENCES_DIR = path.join(__dirname_esm, "xaml-references");

let _metadata: ReferenceMetadata | null = null;

function loadMetadata(): ReferenceMetadata {
  if (_metadata) return _metadata;
  const metaPath = path.join(REFERENCES_DIR, "metadata.json");
  if (!fs.existsSync(metaPath)) {
    _metadata = { projects: [] };
    return _metadata;
  }
  _metadata = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  return _metadata!;
}

export function getProjectsByPattern(pattern: string): ReferenceProject[] {
  const meta = loadMetadata();
  return meta.projects.filter((p) => p.pattern === pattern);
}

export function getProjectsBySystem(system: string): ReferenceProject[] {
  const meta = loadMetadata();
  const sysLower = system.toLowerCase();
  return meta.projects.filter((p) =>
    p.systems.some((s) => s.toLowerCase() === sysLower),
  );
}

export function getAllReferenceProjects(): ReferenceProject[] {
  return loadMetadata().projects;
}

export function getReferenceXaml(
  projectId: string,
  filePath: string,
): string | null {
  const fullPath = path.join(REFERENCES_DIR, projectId, filePath);
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, "utf8");
}

export function getReferenceFrameworkFile(
  fileName: string,
  preferredPattern?: string,
): string | null {
  const meta = loadMetadata();
  const candidates = meta.projects.filter((p) =>
    p.frameworkFiles.includes(fileName),
  );
  if (candidates.length === 0) return null;

  let project: ReferenceProject;
  if (preferredPattern) {
    const patternMatch = candidates.find(
      (p) => p.pattern === preferredPattern,
    );
    project = patternMatch || candidates[0];
  } else {
    project = candidates[0];
  }

  return getReferenceXaml(project.id, `Framework/${fileName}`);
}

export function getCodedWorkflowsScaffold(projectId?: string): {
  connectionsFactory: string;
  connectionsManager: string;
} | null {
  const meta = loadMetadata();
  const candidates = projectId
    ? meta.projects.filter((p) => p.id === projectId && p.hasCodedWorkflows)
    : meta.projects.filter((p) => p.hasCodedWorkflows);
  if (candidates.length === 0) return null;

  const project = candidates[0];
  const factory = getReferenceXaml(
    project.id,
    ".codedworkflows/ConnectionsFactory.cs",
  );
  const manager = getReferenceXaml(
    project.id,
    ".codedworkflows/ConnectionsManager.cs",
  );
  if (!factory || !manager) return null;
  return { connectionsFactory: factory, connectionsManager: manager };
}

export function getProcessConstantsTemplate(
  projectId?: string,
): string | null {
  const meta = loadMetadata();
  const candidates = projectId
    ? meta.projects.filter(
        (p) => p.id === projectId && p.hasProcessConstants,
      )
    : meta.projects.filter((p) => p.hasProcessConstants);
  if (candidates.length === 0) return null;

  return getReferenceXaml(
    candidates[0].id,
    "Workflows_Misc/Configurations/ProcessConstants.cs",
  );
}

export function getPatternSpecificFiles(
  pattern: string,
): { fileName: string; content: string }[] {
  const meta = loadMetadata();
  const patternProjects = meta.projects.filter((p) => p.pattern === pattern);
  if (patternProjects.length === 0) return [];

  const project = patternProjects[0];
  const patternFiles: { fileName: string; content: string }[] = [];

  const optionalFrameworkFiles = [
    "BuildTransactionData.xaml",
    "CleanupAndPrep.xaml",
    "SendNotifications.xaml",
    "InitAllApplications.xaml",
    "RetryCurrentTransaction.xaml",
    "RetryInit.xaml",
  ];

  for (const fileName of optionalFrameworkFiles) {
    if (project.frameworkFiles.includes(fileName)) {
      const content = getReferenceXaml(project.id, `Framework/${fileName}`);
      if (content) {
        patternFiles.push({ fileName, content });
      }
    }
  }

  return patternFiles;
}

export function detectSystems(
  processNodes: Array<{ name?: string; description?: string; system?: string }>,
  sddContent?: string | null,
): string[] {
  const systemKeywords: Record<string, string[]> = {
    SAP: ["sap", "s/4hana", "s4hana", "sapgui"],
    Coupa: ["coupa"],
    O365: [
      "office 365",
      "o365",
      "outlook",
      "sharepoint",
      "onedrive",
      "teams",
      "microsoft 365",
    ],
    Slack: ["slack"],
    ECB: ["ecb", "european central bank"],
    Salesforce: ["salesforce", "sfdc"],
    ServiceNow: ["servicenow", "snow"],
    Jira: ["jira"],
    Workday: ["workday"],
  };

  const allText = [
    ...(processNodes || []).map(
      (n) => `${n.name || ""} ${n.description || ""} ${n.system || ""}`,
    ),
    sddContent || "",
  ]
    .join(" ")
    .toLowerCase();

  const detected: string[] = [];
  for (const [system, keywords] of Object.entries(systemKeywords)) {
    if (keywords.some((kw) => allText.includes(kw))) {
      detected.push(system);
    }
  }
  return detected;
}

export function inferAutomationSubPattern(
  processDescription?: string,
  enrichmentData?: any,
): string {
  const desc = (processDescription || "").toLowerCase();
  if (desc.includes("dispatch") || desc.includes("queue") && desc.includes("add"))
    return "dispatcher";
  if (desc.includes("transform") || desc.includes("convert") || desc.includes("map"))
    return "transformer";
  if (desc.includes("sync") || desc.includes("update") && desc.includes("status"))
    return "sync";
  return "performer";
}
