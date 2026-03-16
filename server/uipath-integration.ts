import { db } from "./db";
import { appSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import archiver from "archiver";
import { PassThrough } from "stream";
import {
  generateRichXamlFromSpec,
  generateRichXamlFromNodes,
  generateInitAllSettingsXaml,
  generateReframeworkMainXaml,
  generateGetTransactionDataXaml,
  generateSetTransactionStatusXaml,
  generateCloseAllApplicationsXaml,
  generateKillAllProcessesXaml,
  aggregateGaps,
  aggregatePackages,
  generateDeveloperHandoffGuide,
  generateDhgSummary,
  makeUiPathCompliant,
  type XamlGeneratorResult,
  type XamlGap,
  type TargetFramework,
} from "./xaml-generator";
import { enrichWithAI, type EnrichmentResult } from "./ai-xaml-enricher";
import { analyzeAndFix, setGovernancePolicies, type AnalysisReport } from "./workflow-analyzer";
import { escapeXml } from "./lib/xml-utils";
import { computePackageFingerprint } from "./lib/utils";

type CachedBuild = {
  fingerprint: string;
  version: string;
  buffer: Buffer;
  gaps: XamlGap[];
  usedPackages: string[];
  enrichment: EnrichmentResult | null;
};

const packageBuildCache = new Map<string, CachedBuild>();
const CACHE_MAX_ENTRIES = 20;

function evictOldestCacheEntry(): void {
  if (packageBuildCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = packageBuildCache.keys().next().value;
    if (oldest) {
      packageBuildCache.delete(oldest);
      console.log(`[UiPath Cache] Evicted oldest entry: ${oldest}`);
    }
  }
}

export function clearPackageCache(ideaId: string): void {
  if (packageBuildCache.delete(ideaId)) {
    console.log(`[UiPath Cache] Cleared cache for ${ideaId}`);
  }
}

export type UiPathConfig = {
  orgName: string;
  tenantName: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  folderId?: string;
  folderName?: string;
};

export async function getUiPathConfig(): Promise<UiPathConfig | null> {
  const { getConfig } = await import("./uipath-auth");
  const authConfig = await getConfig();
  if (authConfig) {
    return {
      orgName: authConfig.orgName,
      tenantName: authConfig.tenantName,
      clientId: authConfig.clientId,
      clientSecret: authConfig.clientSecret,
      scopes: authConfig.scopes,
      folderId: authConfig.folderId,
      folderName: authConfig.folderName,
    };
  }
  return null;
}

function extractOrgName(input: string): string {
  let val = input.trim();
  val = val.replace(/^https?:\/\//, "");
  val = val.replace(/^cloud\.uipath\.com\//, "");
  val = val.replace(/\/+$/, "");
  val = val.split("/")[0];
  return val.trim();
}

export async function saveUiPathConfig(config: { orgName: string; tenantName: string; clientId: string; clientSecret?: string; scopes?: string }): Promise<void> {
  const entries: { key: string; value: string }[] = [
    { key: "uipath_org_name", value: extractOrgName(config.orgName) },
    { key: "uipath_tenant_name", value: config.tenantName.trim() },
    { key: "uipath_client_id", value: config.clientId.trim() },
  ];

  if (config.clientSecret) {
    entries.push({ key: "uipath_client_secret", value: config.clientSecret.trim() });
  }

  if (config.scopes) {
    entries.push({ key: "uipath_scopes", value: config.scopes.trim() });
  }

  for (const entry of entries) {
    const existing = await db.select().from(appSettings).where(eq(appSettings.key, entry.key));
    if (existing.length > 0) {
      await db.update(appSettings).set({ value: entry.value, updatedAt: new Date() }).where(eq(appSettings.key, entry.key));
    } else {
      await db.insert(appSettings).values(entry);
    }
  }

  const { invalidateConfig } = await import("./uipath-auth");
  invalidateConfig();
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const existing = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (existing.length > 0) {
    await db.update(appSettings).set({ value, updatedAt: new Date() }).where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({ key, value });
  }
}

export async function saveUiPathFolder(folderId: string | null, folderName: string | null): Promise<void> {
  if (folderId && folderName) {
    await upsertSetting("uipath_folder_id", folderId);
    await upsertSetting("uipath_folder_name", folderName);
  } else {
    const existing1 = await db.select().from(appSettings).where(eq(appSettings.key, "uipath_folder_id"));
    if (existing1.length > 0) {
      await db.delete(appSettings).where(eq(appSettings.key, "uipath_folder_id"));
    }
    const existing2 = await db.select().from(appSettings).where(eq(appSettings.key, "uipath_folder_name"));
    if (existing2.length > 0) {
      await db.delete(appSettings).where(eq(appSettings.key, "uipath_folder_name"));
    }
  }

  const { uipathConnections } = await import("@shared/schema");
  const { eq: eqOp } = await import("drizzle-orm");
  const activeRows = await db.select().from(uipathConnections).where(eqOp(uipathConnections.isActive, true));
  if (activeRows.length > 0) {
    await db.update(uipathConnections).set({
      folderId: folderId || null,
      folderName: folderName || null,
    }).where(eqOp(uipathConnections.id, activeRows[0].id));
  }

  const { invalidateConfig } = await import("./uipath-auth");
  invalidateConfig();
}

export async function fetchUiPathFolders(): Promise<{ success: boolean; folders?: { id: number; displayName: string; fullyQualifiedName: string }[]; message?: string }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath is not configured." };
  }

  try {
    const token = await getAccessToken(config);
    const url = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_/odata/Folders?$orderby=DisplayName&$top=100`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, message: `Failed to fetch folders (${res.status}): ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const folders = (data.value || []).map((f: any) => ({
      id: f.Id,
      displayName: f.DisplayName,
      fullyQualifiedName: f.FullyQualifiedName || f.DisplayName,
    }));
    return { success: true, folders };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch folders: ${err.message}` };
  }
}

export async function recordLastTestedAt(): Promise<void> {
  await upsertSetting("uipath_last_tested", new Date().toISOString());
}

export async function getLastTestedAt(): Promise<string | null> {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, "uipath_last_tested"));
  return rows.length > 0 ? rows[0].value : null;
}

export async function getAccessToken(config: UiPathConfig): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: config.scopes,
  });

  const res = await fetch("https://cloud.uipath.com/identity_/connect/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UiPath auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

function buildXaml(className: string, displayName: string, activities: string, variablesBlock?: string): string {
  const vars = variablesBlock || "<Sequence.Variables />";
  return `<?xml version="1.0" encoding="utf-8"?>
<Activity mc:Ignorable="sap sap2010" x:Class="${escapeXml(className)}"
  xmlns="http://schemas.microsoft.com/netfx/2009/xaml/activities"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:s="clr-namespace:System;assembly=mscorlib"
  xmlns:sap="http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"
  xmlns:sap2010="http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"
  xmlns:scg="clr-namespace:System.Data;assembly=System.Data"
  xmlns:ui="http://schemas.uipath.com/workflow/activities"
  xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <Sequence DisplayName="${escapeXml(displayName)}">
    ${vars}${activities}
  </Sequence>
</Activity>`;
}

function generateUuid(): string {
  const hex = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) uuid += "-";
    else if (i === 14) uuid += "4";
    else uuid += hex[Math.floor(Math.random() * 16)];
  }
  return uuid;
}

function generateConfigXlsx(pkg: any, sddContent?: string, orchestratorArtifacts?: any): string {
  const settingsRows: string[][] = [["Name", "Value", "Description"]];
  const constantsRows: string[][] = [["Name", "Value", "Description"]];

  if (orchestratorArtifacts) {
    if (orchestratorArtifacts.assets) {
      for (const asset of orchestratorArtifacts.assets) {
        if (asset.type === "Credential") {
          settingsRows.push([asset.name, "", asset.description || `Credential: ${asset.name}`]);
        } else {
          settingsRows.push([asset.name, asset.value || "", asset.description || ""]);
        }
      }
    }
    if (orchestratorArtifacts.queues) {
      for (const q of orchestratorArtifacts.queues) {
        constantsRows.push([`QueueName_${q.name}`, q.name, q.description || `Queue: ${q.name}`]);
      }
    }
  } else if (sddContent) {
    const section9Match = sddContent.match(/## 9[\.\s][^\n]+\n([\s\S]*?)(?=## \d+\.|$)/);
    if (section9Match) {
      const artifactMatch = section9Match[1].match(/```orchestrator_artifacts\s*\n([\s\S]*?)\n```/);
      if (artifactMatch) {
        try {
          const artifacts = JSON.parse(artifactMatch[1]);
          if (artifacts.assets) {
            for (const asset of artifacts.assets) {
              if (asset.type === "Credential") {
                settingsRows.push([asset.name, "", asset.description || `Credential: ${asset.name}`]);
              } else {
                settingsRows.push([asset.name, asset.value || "", asset.description || ""]);
              }
            }
          }
        } catch { /* parse error */ }
      }
    }
  }

  if (sddContent) {
    const section4Match = sddContent.match(/## 4[\.\s][^\n]+\n([\s\S]*?)(?=## \d+\.|$)/);
    if (section4Match) {
      const urlMatches = section4Match[1].match(/https?:\/\/[^\s)>"]+/g);
      if (urlMatches) {
        const seen = new Set<string>();
        for (const url of urlMatches) {
          if (!seen.has(url)) {
            seen.add(url);
            constantsRows.push([`URL_${seen.size}`, url, `Integration endpoint`]);
          }
        }
      }
    }
  }

  settingsRows.push(["OrchestratorURL", "", "Orchestrator base URL"]);
  settingsRows.push(["ProcessTimeout", "30", "Max process timeout in minutes"]);
  settingsRows.push(["MaxRetries", "3", "Maximum retry attempts"]);
  settingsRows.push(["LogLevel", "Info", "Logging level (Info/Warn/Error)"]);

  const hasQueues = orchestratorArtifacts?.queues?.length > 0;
  if (hasQueues) {
    settingsRows.push(["OrchestratorQueueName", orchestratorArtifacts.queues[0].name, "Primary transaction queue"]);
    settingsRows.push(["MaxRetryNumber", "3", "REFramework max retry attempts per transaction"]);
    settingsRows.push(["ProcessName", pkg.projectName || "Automation", "REFramework process name"]);
  }

  constantsRows.push(["ApplicationName", pkg.projectName || "Automation", "Process name"]);
  constantsRows.push(["Version", "1.0.0", "Package version"]);
  constantsRows.push(["MaxWaitTime", "30000", "Max wait time in milliseconds"]);
  constantsRows.push(["RetryInterval", "5000", "Retry interval in milliseconds"]);

  let xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Settings" sheetId="1" r:id="rId1"/>
    <sheet name="Constants" sheetId="2" r:id="rId2"/>
  </sheets>
  <definedNames/>
</workbook>
<!-- CONFIG DATA (Tab-separated for import into Excel) -->
<!-- Settings Sheet -->
`;

  for (const row of settingsRows) {
    xml += `<!-- ${row.join("\t")} -->\n`;
  }
  xml += `<!-- Constants Sheet -->\n`;
  for (const row of constantsRows) {
    xml += `<!-- ${row.join("\t")} -->\n`;
  }

  let csvSettings = settingsRows.map(r => r.join(",")).join("\n");
  let csvConstants = constantsRows.map(r => r.join(",")).join("\n");

  return `Settings\n${csvSettings}\n\nConstants\n${csvConstants}`;
}

export async function buildNuGetPackage(pkg: any, version: string = "1.0.0", ideaId?: string): Promise<{ buffer: Buffer; gaps: XamlGap[]; usedPackages: string[]; cacheHit?: boolean }> {
  const projectName = (pkg.projectName || "Automation").replace(/\s+/g, "_");
  const sddContent = pkg._sddContent || "";
  const orchestratorArtifacts = pkg._orchestratorArtifacts || null;
  const processNodes = pkg._processNodes || [];
  const processEdges = pkg._processEdges || [];

  let fingerprint: string | undefined;
  if (ideaId) {
    fingerprint = computePackageFingerprint(pkg, sddContent, processNodes, processEdges, orchestratorArtifacts);
    const cached = packageBuildCache.get(ideaId);
    if (cached && cached.fingerprint === fingerprint && cached.version === version) {
      console.log(`[UiPath Cache] HIT for ${ideaId} — skipping AI enrichment and XAML generation`);
      return { buffer: cached.buffer, gaps: cached.gaps, usedPackages: cached.usedPackages, cacheHit: true };
    }
    if (cached && cached.fingerprint === fingerprint && cached.version !== version) {
      console.log(`[UiPath Cache] PARTIAL HIT for ${ideaId} — reusing enrichment, rebuilding with v${version}`);
    } else {
      console.log(`[UiPath Cache] MISS for ${ideaId}${cached ? " (fingerprint changed)" : " (no cache)"}`);
    }
  }

  let enrichment: EnrichmentResult | null = null;
  const cachedEntry = ideaId ? packageBuildCache.get(ideaId) : undefined;
  const canReuseEnrichment = cachedEntry && fingerprint && cachedEntry.fingerprint === fingerprint;
  if (canReuseEnrichment) {
    enrichment = cachedEntry.enrichment;
    if (enrichment) {
      console.log(`[UiPath] Reusing cached AI enrichment for ${ideaId} (${enrichment.nodes.length} nodes)`);
    } else {
      console.log(`[UiPath] Skipping AI enrichment for ${ideaId} (previously attempted, cached as null)`);
    }
  } else if (processNodes.length > 0 && sddContent) {
    try {
      console.log(`[UiPath] Requesting AI enrichment for ${processNodes.length} process nodes...`);
      enrichment = await enrichWithAI(
        processNodes,
        processEdges,
        sddContent,
        orchestratorArtifacts,
        projectName,
        45000
      );
      if (enrichment) {
        console.log(`[UiPath] AI enrichment successful: ${enrichment.nodes.length} enriched nodes, REFramework=${enrichment.useReFramework}, ${enrichment.decomposition?.length || 0} sub-workflows`);
      }
    } catch (err: any) {
      console.log(`[UiPath] AI enrichment failed (falling back to keyword classification): ${err.message}`);
    }
  }

  const hasQueues = orchestratorArtifacts?.queues?.length > 0;
  const useReFramework = enrichment?.useReFramework || hasQueues;
  const queueName = enrichment?.reframeworkConfig?.queueName
    || orchestratorArtifacts?.queues?.[0]?.name
    || "TransactionQueue";

  const buffers: Buffer[] = [];
  const passthrough = new PassThrough();
  passthrough.on("data", (chunk: Buffer) => buffers.push(chunk));

  const streamDone = new Promise<Buffer>((resolve, reject) => {
    passthrough.on("end", () => resolve(Buffer.concat(buffers)));
    passthrough.on("error", reject);
  });

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(passthrough);

  const explicitFramework = (pkg as any).targetFramework;
  const isServerless = explicitFramework === "Portable"
    || !!(pkg as any).isServerless
    || (!explicitFramework && !!(_probeCache?.serverlessDetected) && !_probeCache?.flags?.hasUnattendedSlots);
    const libPath = isServerless ? "lib/net6.0" : "lib/net45";
    const xamlResults: XamlGeneratorResult[] = [];

    const contentTypesXml = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="nuspec" ContentType="application/octet" />
  <Default Extension="psmdcp" ContentType="application/vnd.openxmlformats-package.core-properties+xml" />
  <Default Extension="xaml" ContentType="application/octet" />
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="csv" ContentType="text/csv" />
  <Default Extension="xlsx" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
</Types>`;
    archive.append(contentTypesXml, { name: "[Content_Types].xml" });

    const corePropsId = generateUuid();
    const relsXml = `<?xml version="1.0" encoding="utf-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.microsoft.com/packaging/2010/07/manifest" Target="/${projectName}.nuspec" Id="R1" />
  <Relationship Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="/package/services/metadata/core-properties/${corePropsId}.psmdcp" Id="R2" />
</Relationships>`;
    archive.append(relsXml, { name: "_rels/.rels" });

    const coreProps = `<?xml version="1.0" encoding="utf-8"?>
<coreProperties xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties">
  <dc:creator>CannonBall</dc:creator>
  <dc:description>${escapeXml(pkg.description || projectName)}</dc:description>
  <dc:identifier>${projectName}</dc:identifier>
  <version>${version}</version>
</coreProperties>`;
    archive.append(coreProps, { name: `package/services/metadata/core-properties/${corePropsId}.psmdcp` });

    const knownVersionMap: Record<string, string> = isServerless
      ? {
          "UiPath.System.Activities": "[25.10.0]",
          "UiPath.UIAutomation.Activities": "[25.10.0]",
          "UiPath.Web.Activities": "[2.5.0]",
          "UiPath.Excel.Activities": "[3.18.0]",
          "UiPath.Mail.Activities": "[2.5.0]",
          "UiPath.Database.Activities": "[2.2.0]",
          "UiPath.Persistence.Activities": "[25.10.0]",
          "UiPath.MLActivities": "[25.10.0]",
        }
      : {
          "UiPath.System.Activities": "[23.10.0]",
          "UiPath.UIAutomation.Activities": "[23.10.0]",
          "UiPath.Web.Activities": "[1.18.0]",
          "UiPath.Excel.Activities": "[2.22.0]",
          "UiPath.Mail.Activities": "[1.20.0]",
          "UiPath.Database.Activities": "[1.8.0]",
          "UiPath.Persistence.Activities": "[23.10.0]",
          "UiPath.MLActivities": "[23.10.0]",
        };
    const deps: Record<string, string> = {
      "UiPath.System.Activities": knownVersionMap["UiPath.System.Activities"],
      "UiPath.UIAutomation.Activities": knownVersionMap["UiPath.UIAutomation.Activities"],
      "UiPath.Web.Activities": knownVersionMap["UiPath.Web.Activities"],
    };
    if (pkg.dependencies) {
      for (const d of pkg.dependencies) {
        if (!deps[d] && knownVersionMap[d]) deps[d] = knownVersionMap[d];
      }
    }

    const analysisReports: { fileName: string; report: AnalysisReport }[] = [];
    const tf: TargetFramework = isServerless ? "Portable" : "Windows";
    const apEnabled = !!(pkg as any).autopilotEnabled || !!(_probeCache?.flags?.autopilot);
    function compliancePass(rawXaml: string, fileName: string): string {
      const compliant = makeUiPathCompliant(rawXaml, tf);
      const { fixed, report } = analyzeAndFix(compliant);
      analysisReports.push({ fileName, report });
      if (report.totalAutoFixed > 0) {
        console.log(`[UiPath Analyzer] ${fileName}: ${report.totalAutoFixed} auto-fixed, ${report.totalRemaining} remaining`);
      }
      return fixed;
    }

    const workflows = pkg.workflows || [];
    let hasMain = false;

    if (enrichment?.decomposition?.length) {
      console.log(`[UiPath] Using AI decomposition: ${enrichment.decomposition.length} sub-workflows`);
      for (const decomp of enrichment.decomposition) {
        const wfName = decomp.name.replace(/\s+/g, "_");
        const decompNodes = processNodes.filter((n: any) => decomp.nodeIds.includes(n.id));
        const decompEdges = processEdges.filter((e: any) =>
          decomp.nodeIds.includes(e.sourceNodeId) || decomp.nodeIds.includes(e.targetNodeId)
        );
        if (decompNodes.length > 0) {
          const result = generateRichXamlFromNodes(
            decompNodes,
            decompEdges,
            wfName,
            decomp.description || "",
            enrichment,
            tf,
            apEnabled
          );
          xamlResults.push(result);
          archive.append(compliancePass(result.xaml, `${wfName}.xaml`), { name: `${libPath}/${wfName}.xaml` });
          if (wfName === "Main") hasMain = true;
          console.log(`[UiPath] Generated decomposed workflow "${wfName}": ${decompNodes.length} nodes, ${result.gaps.length} gaps`);
        }
      }
    }

    for (const wf of workflows) {
      const wfName = (wf.name || "Workflow").replace(/\s+/g, "_");
      const result = generateRichXamlFromSpec(wf, sddContent || undefined, undefined, tf, apEnabled);
      xamlResults.push(result);
      archive.append(compliancePass(result.xaml, `${wfName}.xaml`), { name: `${libPath}/${wfName}.xaml` });
      if (wfName === "Main") hasMain = true;
      console.log(`[UiPath] Generated rich XAML for "${wfName}": ${result.gaps.length} gaps, ${result.usedPackages.length} packages`);
    }

    if (!hasMain && processNodes.length > 0 && !enrichment?.decomposition?.length) {
      const processResult = generateRichXamlFromNodes(
        processNodes,
        processEdges,
        useReFramework ? "Process" : projectName,
        pkg.description || "",
        enrichment,
        tf,
        apEnabled
      );
      xamlResults.push(processResult);
      const processFileName = useReFramework ? "Process" : projectName;
      archive.append(compliancePass(processResult.xaml, `${processFileName}.xaml`), { name: `${libPath}/${processFileName}.xaml` });
      console.log(`[UiPath] Generated process XAML from ${processNodes.length} map nodes: ${processResult.gaps.length} gaps`);
    }

    const initXaml = generateInitAllSettingsXaml(orchestratorArtifacts, tf);
    archive.append(compliancePass(initXaml, "InitAllSettings.xaml"), { name: `${libPath}/InitAllSettings.xaml` });

    if (useReFramework && !hasMain) {
      console.log(`[UiPath] Generating REFramework structure (queue: ${queueName})`);
      const mainXaml = generateReframeworkMainXaml(projectName, queueName, tf);
      archive.append(compliancePass(mainXaml, "Main.xaml"), { name: `${libPath}/Main.xaml` });
      hasMain = true;

      const getTransXaml = generateGetTransactionDataXaml(queueName, tf);
      archive.append(compliancePass(getTransXaml, "GetTransactionData.xaml"), { name: `${libPath}/GetTransactionData.xaml` });

      const setStatusXaml = generateSetTransactionStatusXaml(tf);
      archive.append(compliancePass(setStatusXaml, "SetTransactionStatus.xaml"), { name: `${libPath}/SetTransactionStatus.xaml` });

      const closeAppsXaml = generateCloseAllApplicationsXaml(tf);
      archive.append(compliancePass(closeAppsXaml, "CloseAllApplications.xaml"), { name: `${libPath}/CloseAllApplications.xaml` });

      const killXaml = generateKillAllProcessesXaml(tf);
      archive.append(compliancePass(killXaml, "KillAllProcesses.xaml"), { name: `${libPath}/KillAllProcesses.xaml` });
    } else if (!hasMain) {
      let mainActivities = `
        <ui:InvokeWorkflowFile DisplayName="Initialize Settings" WorkflowFileName="InitAllSettings.xaml" />`;

      if (enrichment?.decomposition?.length) {
        for (const decomp of enrichment.decomposition) {
          const wfName = decomp.name.replace(/\s+/g, "_");
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(decomp.name)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      } else if (workflows.length > 0) {
        for (const wf of workflows) {
          const wfName = (wf.name || "Workflow").replace(/\s+/g, "_");
          mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(wf.name || wfName)}" WorkflowFileName="${wfName}.xaml" />`;
        }
      } else if (processNodes.length > 0) {
        mainActivities += `
        <ui:InvokeWorkflowFile DisplayName="Run ${escapeXml(projectName)}" WorkflowFileName="${projectName}.xaml" />`;
      } else {
        mainActivities += `
        <ui:Comment DisplayName="Auto-generated by CannonBall" Text="This automation package was generated from the CannonBall pipeline. Open this project in UiPath Studio to build out the workflow logic." />`;
      }
      mainActivities += `
        <ui:LogMessage Level="Info" Message="'Process completed successfully'" DisplayName="Log Completion" />`;

      const closeAppsXaml = generateCloseAllApplicationsXaml(tf);
      archive.append(compliancePass(closeAppsXaml, "CloseAllApplications.xaml"), { name: `${libPath}/CloseAllApplications.xaml` });

      const mainXaml = buildXaml("Main", `${projectName} - Main Workflow`, mainActivities);
      archive.append(compliancePass(mainXaml, "Main.xaml"), { name: `${libPath}/Main.xaml` });
    }

    const configCsv = generateConfigXlsx(pkg, sddContent || undefined, orchestratorArtifacts);
    archive.append(configCsv, { name: `${libPath}/Data/Config.xlsx` });

    const richPackages = aggregatePackages(xamlResults);
    const windowsPackageVersionMap: Record<string, string> = {
      "UiPath.System.Activities": "[23.10.0]",
      "UiPath.UIAutomation.Activities": "[23.10.0]",
      "UiPath.Web.Activities": "[1.18.0]",
      "UiPath.Excel.Activities": "[2.22.0]",
      "UiPath.Mail.Activities": "[1.20.0]",
      "UiPath.Database.Activities": "[1.8.0]",
      "UiPath.Persistence.Activities": "[23.10.0]",
      "UiPath.MLActivities": "[23.10.0]",
    };
    const crossPlatformPackageVersionMap: Record<string, string> = {
      "UiPath.System.Activities": "[25.10.0]",
      "UiPath.UIAutomation.Activities": "[25.10.0]",
      "UiPath.Web.Activities": "[2.5.0]",
      "UiPath.Excel.Activities": "[3.18.0]",
      "UiPath.Mail.Activities": "[2.5.0]",
      "UiPath.Database.Activities": "[2.2.0]",
      "UiPath.Persistence.Activities": "[25.10.0]",
      "UiPath.MLActivities": "[25.10.0]",
    };
    const packageVersionMap = isServerless ? crossPlatformPackageVersionMap : windowsPackageVersionMap;
    for (const rp of richPackages) {
      if (!deps[rp] && packageVersionMap[rp]) {
        deps[rp] = packageVersionMap[rp];
      }
    }

    if (!deps["UiPath.Excel.Activities"]) {
      deps["UiPath.Excel.Activities"] = isServerless ? "[3.18.0]" : "[2.22.0]";
    }

    const allDepEntries = Object.entries(deps);
    if (allDepEntries.length > 0) {
      const feedResolutions = await Promise.allSettled(
        allDepEntries.map(([pkgId, ver]) => resolvePackageVersionFromFeed(pkgId, ver))
      );
      for (let i = 0; i < allDepEntries.length; i++) {
        const [pkgId, currentVer] = allDepEntries[i];
        const result = feedResolutions[i];
        if (result.status === "fulfilled" && result.value !== "*") {
          if (currentVer === "*" || result.value !== currentVer) {
            deps[pkgId] = result.value;
          }
        }
      }
    }

    const allGaps = aggregateGaps(xamlResults);
    const allUsedPkgs = Object.keys(deps);

    const entryPointId = generateUuid();
    const studioVer = isServerless ? "24.10.0" : "23.10.6";
    const projectJson: Record<string, any> = {
      name: projectName,
      description: pkg.description || "",
      main: "Main.xaml",
      dependencies: deps,
      webServices: [],
      entitiesStores: [],
      schemaVersion: "4.0",
      studioVersion: studioVer,
      projectVersion: version,
      runtimeOptions: {
        autoDispose: false,
        netFrameworkLazyLoading: false,
        isPausable: true,
        isAttended: false,
        requiresUserInteraction: false,
        supportsPersistence: false,
        executionType: "Workflow",
        readyForPiP: false,
        startsInPiP: false,
        mustRestoreAllDependencies: true,
      },
      designOptions: {
        projectProfile: "Development",
        outputType: "Process",
        libraryOptions: { includeOriginalXaml: false, privateWorkflows: [] },
        processOptions: { ignoredFiles: [] },
        fileInfoCollection: [],
        modernBehavior: true,
      },
      expressionLanguage: isServerless ? "CSharp" : "VisualBasic",
      entryPoints: [
        {
          filePath: "Main.xaml",
          uniqueId: entryPointId,
          input: [],
          output: [],
        },
      ],
      isTemplate: false,
      templateProjectData: {},
      publishData: {},
    };
    if (isServerless) {
      projectJson.targetFramework = "Portable";
      projectJson.sourceLanguage = "CSharp";
    } else {
      projectJson.targetFramework = "Windows";
      projectJson.sourceLanguage = "VisualBasic";
    }
    if (apEnabled) {
      projectJson.designOptions.autopilotEnabled = true;
      projectJson.designOptions.selfHealingSelectors = true;
    }
    archive.append(JSON.stringify(projectJson, null, 2), { name: `${libPath}/project.json` });

    const depEntries = Object.entries(deps).map(
      ([id, ver]) => `      <dependency id="${id}" version="${ver}" />`
    ).join("\n");

    const nuspecXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2013/05/nuspec.xsd">
  <metadata>
    <id>${projectName}</id>
    <version>${version}</version>
    <title>${escapeXml(pkg.projectName || projectName)}</title>
    <description>${escapeXml(pkg.description || projectName)}</description>
    <authors>CannonBall</authors>
    <owners>CannonBall</owners>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <dependencies>
${depEntries}
    </dependencies>
  </metadata>
</package>`;
    archive.append(nuspecXml, { name: `${projectName}.nuspec` });

    const workflowNames: string[] = [];
    if (useReFramework) {
      workflowNames.push("Main", "GetTransactionData", "Process", "SetTransactionStatus", "CloseAllApplications", "KillAllProcesses");
    }
    if (enrichment?.decomposition?.length) {
      for (const d of enrichment.decomposition) {
        const n = d.name.replace(/\s+/g, "_");
        if (!workflowNames.includes(n)) workflowNames.push(n);
      }
    }
    for (const wf of workflows) {
      const n = (wf.name || "Workflow").replace(/\s+/g, "_");
      if (!workflowNames.includes(n)) workflowNames.push(n);
    }
    if (!workflowNames.includes("Main")) workflowNames.unshift("Main");
    if (!workflowNames.includes(projectName) && processNodes.length > 0 && !enrichment?.decomposition?.length && !useReFramework) {
      workflowNames.push(projectName);
    }

    const painPoints = processNodes
      .filter((n: any) => n.isPainPoint)
      .map((n: any) => ({ name: n.name, description: n.description || "" }));

    const dhg = generateDeveloperHandoffGuide({
      projectName,
      description: pkg.description || "",
      gaps: allGaps,
      usedPackages: allUsedPkgs,
      workflowNames,
      sddContent: sddContent || undefined,
      enrichment,
      useReFramework,
      painPoints,
      deploymentResults: pkg._deploymentResults || undefined,
      extractedArtifacts: orchestratorArtifacts || undefined,
      analysisReports,
      automationType: pkg._automationType || undefined,
      targetFramework: tf,
      autopilotEnabled: apEnabled,
    });
    archive.append(dhg, { name: `${libPath}/DeveloperHandoffGuide.md` });
    console.log(`[UiPath] Generated Developer Handoff Guide: ${allGaps.length} gaps, ~${(allGaps.reduce((s: number, g: XamlGap) => s + g.estimatedMinutes, 0) / 60).toFixed(1)}h effort, REFramework=${useReFramework}`);

    archive.finalize();

  const buffer = await streamDone;
  if (ideaId && fingerprint) {
    evictOldestCacheEntry();
    packageBuildCache.set(ideaId, { fingerprint, version, buffer, gaps: allGaps, usedPackages: allUsedPkgs, enrichment });
    console.log(`[UiPath Cache] Stored build for ${ideaId} (${buffer.length} bytes, v${version})`);
  }
  return { buffer, gaps: allGaps, usedPackages: allUsedPkgs };
}

async function uploadNupkgBuffer(
  config: UiPathConfig,
  token: string,
  nupkgBuffer: Buffer,
  projectName: string,
  version: string
): Promise<{ ok: boolean; status: number; responseText: string }> {
  const fileName = `${projectName}.${version}.nupkg`;
  const boundary = `----FormBoundary${Date.now()}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const headerBuf = Buffer.from(header, "utf-8");
  const footerBuf = Buffer.from(footer, "utf-8");
  const body = Buffer.concat([headerBuf, nupkgBuffer, footerBuf]);

  const uploadUrl = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_/odata/Processes/UiPath.Server.Configuration.OData.UploadPackage`;

  console.log(`[UiPath] Uploading to: ${uploadUrl}`);
  console.log(`[UiPath] Package size: ${body.length} bytes, filename: ${fileName}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  };

  if (config.folderId) {
    headers["X-UIPATH-OrganizationUnitId"] = config.folderId;
    console.log(`[UiPath] Targeting folder: ${config.folderName || config.folderId} (ID: ${config.folderId})`);
  }

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 120000);
  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body,
      signal: uploadController.signal,
    });

    const responseText = await uploadRes.text();
    console.log(`[UiPath] Upload response status: ${uploadRes.status}`);
    console.log(`[UiPath] Upload response body: ${responseText.slice(0, 1000)}`);

    return { ok: uploadRes.ok, status: uploadRes.status, responseText };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`[UiPath] Upload timed out after 120s`);
      return { ok: false, status: 408, responseText: "Upload timed out after 120 seconds" };
    }
    throw err;
  } finally {
    clearTimeout(uploadTimeout);
  }
}

export async function pushToUiPath(pkg: any, ideaId?: string): Promise<{ success: boolean; message: string; details?: any }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath Orchestrator is not configured. Go to Admin > Integrations to set it up." };
  }

  const projectName = (pkg.projectName || "Automation").replace(/\s+/g, "_");

  try {
    const token = await getAccessToken(config);

    const now = new Date();
    const patch = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    let version = `1.0.${patch}`;

    const buildResult = await buildNuGetPackage(pkg, version, ideaId);
    console.log(`[UiPath] Built .nupkg for "${projectName}" v${version} — ${buildResult.buffer.length} bytes (${buildResult.gaps.length} gaps, ${buildResult.usedPackages.length} packages)`);

    let result = { ...(await uploadNupkgBuffer(config, token, buildResult.buffer, projectName, version)), gaps: buildResult.gaps };

    if (result.status === 409) {
      const hourMin = now.getHours() * 100 + now.getMinutes();
      version = `1.${hourMin}.${patch}`;
      console.log(`[UiPath] Version conflict — rebuilding with v${version} (reusing cached enrichment)`);
      const retryBuild = await buildNuGetPackage(pkg, version, ideaId);
      console.log(`[UiPath] Rebuilt .nupkg for "${projectName}" v${version} — ${retryBuild.buffer.length} bytes`);
      result = { ...(await uploadNupkgBuffer(config, token, retryBuild.buffer, projectName, version)), gaps: retryBuild.gaps };
    }

    if (!result.ok) {
      let friendlyMsg = `Upload failed (HTTP ${result.status}).`;

      if (result.status === 409) {
        friendlyMsg = `Package "${projectName}" already exists in all attempted versions (1.0.0 – ${version}). Delete old versions in Orchestrator or use a different package name.`;
      } else if (result.status === 400) {
        friendlyMsg = `UiPath rejected the package (invalid format). Response: ${result.responseText.slice(0, 300)}`;
      } else if (result.status === 403) {
        friendlyMsg = `Access denied. Your External Application may not have the "OR.Execution" or "OR.Default" scope. Check Admin > External Applications in UiPath Cloud.`;
      } else {
        friendlyMsg += ` ${result.responseText.slice(0, 300)}`;
      }

      return { success: false, message: friendlyMsg };
    }

    let uploadedId = projectName;
    let uploadedVersion = version;
    let uploadedKey = `${projectName}:${version}`;
    let projectType = "Process";

    try {
      const responseData = JSON.parse(result.responseText);

      if (responseData?.value?.[0]?.Body) {
        const body = JSON.parse(responseData.value[0].Body);
        uploadedId = body.Id || projectName;
        uploadedVersion = body.Version || version;
        uploadedKey = `${uploadedId}:${uploadedVersion}`;
        projectType = body.ProjectType || "Process";
        console.log(`[UiPath] Parsed bulk response — Id: ${uploadedId}, Version: ${uploadedVersion}`);
      } else if (responseData?.Id) {
        uploadedId = responseData.Id;
        uploadedVersion = responseData.Version || version;
        uploadedKey = responseData.Key || `${uploadedId}:${uploadedVersion}`;
        projectType = responseData.ProjectType || "Process";
      }
    } catch {
      console.log(`[UiPath] Could not parse response — using defaults. Raw: ${result.responseText.slice(0, 500)}`);
    }

    const orchUrl = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
    const folderInfo = config.folderName ? ` into folder "${config.folderName}"` : " to the tenant feed";

    const locationSteps = config.folderName
      ? [
          `• Go to ${orchUrl}`,
          `• Open folder "${config.folderName}" in the left sidebar`,
          `• Click "Packages" tab`,
          `• Search for "${uploadedId}"`,
        ]
      : [
          `• Go to ${orchUrl}`,
          `• Navigate to Tenant > Packages`,
          `• Search for "${uploadedId}"`,
        ];

    const dhgSummary = result.gaps.length > 0 ? generateDhgSummary(result.gaps) : "";

    const successMsg = [
      `Package "${uploadedId}" v${uploadedVersion} uploaded successfully${folderInfo}.`,
      ``,
      `Where to find it:`,
      ...locationSteps,
      ``,
      `Package key: ${uploadedKey}`,
      `Type: ${projectType}`,
      `Org: ${config.orgName} / Tenant: ${config.tenantName}`,
      ...(config.folderName ? [`Folder: ${config.folderName}`] : []),
      ...(dhgSummary ? [``, `---`, ``, dhgSummary] : []),
    ].join("\n");

    return {
      success: true,
      message: successMsg,
      details: {
        packageId: uploadedId,
        version: uploadedVersion,
        key: uploadedKey,
        projectType,
        orgName: config.orgName,
        tenantName: config.tenantName,
        orchestratorUrl: orchUrl,
        folderName: config.folderName || null,
        folderId: config.folderId || null,
        gapCount: result.gaps.length,
        dhgSummary: dhgSummary || null,
      },
    };
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error(`[UiPath] Push failed for "${projectName}":`, msg);

    let friendlyMsg = `Push failed: ${msg}`;
    if (msg.includes("invalid_scope")) {
      friendlyMsg = `Authentication failed — invalid scopes. Make sure your External Application in UiPath Cloud has the required scopes (OR.Default, OR.Execution).`;
    } else if (msg.includes("invalid_client")) {
      friendlyMsg = `Authentication failed — invalid App ID or App Secret. Verify your credentials in Admin > Integrations.`;
    }

    return { success: false, message: friendlyMsg };
  }
}

function orchBaseUrl(config: UiPathConfig): string {
  return `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_`;
}

function folderHeaders(config: UiPathConfig, token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (config.folderId) {
    headers["X-UIPATH-OrganizationUnitId"] = config.folderId;
  }
  return headers;
}

async function resolvePackageVersionFromFeed(packageId: string, knownVersion: string): Promise<string> {
  try {
    const config = await getUiPathConfig();
    if (!config) return knownVersion;
    const token = await getAccessToken(config);
    const base = orchBaseUrl(config);
    const hdrs = folderHeaders(config, token);
    const feedUrl = `${base}/odata/Processes/UiPath.Server.Configuration.OData.GetPackageVersions(packageId='${encodeURIComponent(packageId)}')`;
    const res = await fetch(feedUrl, { headers: hdrs, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const versions = data.value || [];
      if (versions.length > 0) {
        const latest = versions[versions.length - 1]?.Version || versions[0]?.Version;
        if (latest) {
          console.log(`[UiPath Feed] Resolved ${packageId} to v${latest} from tenant feed`);
          return `[${latest}]`;
        }
      }
    }
  } catch {
  }
  return knownVersion;
}

export { resolvePackageVersionFromFeed };

async function tryCreateRelease(
  base: string,
  headers: Record<string, string>,
  body: Record<string, any>,
  folderLabel: string
): Promise<{ ok: boolean; status: number; data?: any; text?: string }> {
  console.log(`[UiPath] Creating process in ${folderLabel}: ${JSON.stringify(body)}`);
  const res = await fetch(`${base}/odata/Releases`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`[UiPath] Create process response from ${folderLabel} (${res.status}): ${text.slice(0, 500)}`);
  if (res.ok) {
    return { ok: true, status: res.status, data: JSON.parse(text) };
  }
  return { ok: false, status: res.status, text };
}

export async function createProcess(
  packageId: string,
  packageVersion: string,
  processName: string,
  description?: string
): Promise<{ success: boolean; message: string; process?: any }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const existingRes = await fetch(
      `${base}/odata/Releases?$filter=ProcessKey eq '${encodeURIComponent(packageId)}'&$top=1`,
      { headers }
    );
    if (existingRes.ok) {
      const existingData = await existingRes.json();
      if (existingData.value?.length > 0) {
        const existing = existingData.value[0];
        if (existing.ProcessVersion !== packageVersion) {
          const updateRes = await fetch(`${base}/odata/Releases(${existing.Id})`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ ProcessVersion: packageVersion }),
          });
          if (updateRes.ok) {
            console.log(`[UiPath] Updated process "${existing.Name}" to v${packageVersion}`);
            return {
              success: true,
              message: `Process "${existing.Name}" updated to v${packageVersion}.`,
              process: { ...existing, ProcessVersion: packageVersion },
            };
          }
        }
        console.log(`[UiPath] Process already exists: "${existing.Name}" (ID: ${existing.Id})`);
        return {
          success: true,
          message: `Process "${existing.Name}" already exists.`,
          process: existing,
        };
      }
    }

    const pkgCheck = await fetch(
      `${base}/odata/Processes?$filter=Id eq '${encodeURIComponent(packageId)}'&$top=1`,
      { headers }
    );
    let packageInFeed = false;
    if (pkgCheck.ok) {
      const pkgData = await pkgCheck.json();
      packageInFeed = (pkgData.value?.length || 0) > 0;
      console.log(`[UiPath] Package feed check: ${packageInFeed ? "found" : "not found"} for ${packageId}`);
    }

    if (!packageInFeed) {
      return {
        success: false,
        message: `Package "${packageId}" was uploaded but is not yet indexed in the Orchestrator feed. This typically happens with stub packages. Open the package in UiPath Studio and publish it to create a runnable process.`,
      };
    }

    const releaseBody: Record<string, any> = {
      Name: processName,
      ProcessKey: packageId,
      ProcessVersion: packageVersion,
      EntryPointPath: "Main.xaml",
      Description: (description || `Created by CannonBall`).slice(0, 250),
    };

    const result = await tryCreateRelease(base, headers, releaseBody, config.folderName || "configured folder");

    if (result.ok) {
      return {
        success: true,
        message: `Process "${result.data.Name}" created successfully (ID: ${result.data.Id}).`,
        process: result.data,
      };
    }

    const isPackageNotFound = result.text?.includes("1677") || result.text?.includes("Package not found");

    if (isPackageNotFound) {
      console.log(`[UiPath] Package not found in configured folder "${config.folderName}" (FeedType may be FolderHierarchy).`);

      let suggestedFolders: string[] = [];
      try {
        const foldersRes = await fetch(`${base}/odata/Folders?$top=50&$orderby=DisplayName`, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (foldersRes.ok) {
          const foldersData = await foldersRes.json();
          suggestedFolders = (foldersData.value || [])
            .filter((f: any) => f.FeedType === "Processes" && f.IsActive)
            .slice(0, 5)
            .map((f: any) => f.DisplayName);
        }
      } catch {}

      const suggestion = suggestedFolders.length > 0
        ? ` Compatible folders in your tenant: ${suggestedFolders.map(n => `"${n}"`).join(", ")}. Update your folder selection in Admin > Integrations.`
        : " Try switching to a folder with standard feed type in Admin > Integrations.";

      return {
        success: false,
        message: `Package "${packageId}" uploaded successfully and is indexed in the feed, but Process (Release) creation failed because folder "${config.folderName}" uses a "FolderHierarchy" feed type which doesn't support API-based Release creation.${suggestion} Alternatively, create the Process manually in Orchestrator from the uploaded package.`,
      };
    }

    if (result.status === 403) {
      return { success: false, message: "Access denied creating process. Ensure your app has OR.Execution scope with Create permission." };
    }
    return { success: false, message: `Failed to create process (${result.status}): ${(result.text || "").slice(0, 200)}` };
  } catch (err: any) {
    console.error("[UiPath] Create process error:", err.message);
    return { success: false, message: `Failed to create process: ${err.message}` };
  }
}

export async function listMachines(): Promise<{ success: boolean; machines?: any[]; message?: string }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const res = await fetch(`${base}/odata/Machines?$top=50&$orderby=Name`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        return { success: false, message: "Access denied. Ensure your app has OR.Machines.Read scope." };
      }
      return { success: false, message: `Failed to fetch machines (${res.status}): ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const machines = (data.value || []).map((m: any) => ({
      id: m.Id,
      name: m.Name,
      type: m.Type,
      status: m.Status,
      description: m.Description,
    }));
    return { success: true, machines };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch machines: ${err.message}` };
  }
}

export async function listRobots(): Promise<{ success: boolean; robots?: any[]; message?: string }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const res = await fetch(`${base}/odata/Sessions?$top=50&$orderby=Robot/Name`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        return { success: false, message: "Access denied. Ensure your app has OR.Robots.Read scope." };
      }
      return { success: false, message: `Failed to fetch robots (${res.status}): ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const robots = (data.value || []).map((s: any) => ({
      id: s.Id,
      robotId: s.Robot?.Id,
      robotName: s.Robot?.Name || s.Robot?.MachineName || "Unknown",
      machineName: s.Robot?.MachineName || s.HostMachineName || "Unknown",
      status: s.Status || "Unknown",
      type: s.Robot?.Type || "Unknown",
      isUnresponsive: s.IsUnresponsive,
    }));
    return { success: true, robots };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch robots: ${err.message}` };
  }
}

export async function listProcesses(): Promise<{ success: boolean; processes?: any[]; message?: string }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const res = await fetch(`${base}/odata/Releases?$top=50&$orderby=Name`, { headers });
    if (!res.ok) {
      const errText = await res.text();
      return { success: false, message: `Failed to fetch processes (${res.status}): ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const processes = (data.value || []).map((r: any) => ({
      id: r.Id,
      name: r.Name,
      processKey: r.ProcessKey,
      processVersion: r.ProcessVersion,
      isLatestVersion: r.IsLatestVersion,
      description: r.Description,
    }));
    return { success: true, processes };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch processes: ${err.message}` };
  }
}

export type GovernancePolicy = {
  id: string;
  name: string;
  description: string;
  type: "naming" | "activity-restriction" | "error-handling" | "security" | "general";
  severity: "error" | "warning" | "info";
  pattern?: string;
  restrictedActivities?: string[];
  requiredPatterns?: string[];
};

export type AutomationOpsResult = {
  available: boolean;
  policies: GovernancePolicy[];
  message: string;
};

export async function discoverGovernancePolicies(): Promise<AutomationOpsResult> {
  const config = await getUiPathConfig();
  if (!config) return { available: false, policies: [], message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const policiesRes = await fetch(`${base}/automationops_/api/v1/policies?$top=100`, { headers }).catch(() => null);
    if (!policiesRes || !policiesRes.ok) {
      if (policiesRes && policiesRes.status === 404) {
        return { available: false, policies: [], message: "Automation Ops is not enabled on this tenant." };
      }
      if (policiesRes && policiesRes.status === 403) {
        return { available: false, policies: [], message: "Access denied to Automation Ops. Check app scopes." };
      }

      const rulesRes = await fetch(`${base}/automationops_/api/rules?$top=50`, { headers }).catch(() => null);
      if (rulesRes && rulesRes.ok) {
        const rulesData = await rulesRes.json();
        const rules = (rulesData.value || rulesData.items || []);
        const policies: GovernancePolicy[] = rules.map((r: any) => ({
          id: r.Id || r.id || r.RuleId,
          name: r.Name || r.name || r.RuleName || "Unknown Rule",
          description: r.Description || r.description || "",
          type: classifyPolicyType(r.Name || r.name || r.Category || ""),
          severity: mapPolicySeverity(r.Severity || r.severity || r.DefaultAction || "warning"),
          pattern: r.Pattern || r.pattern || undefined,
          restrictedActivities: r.RestrictedActivities || undefined,
          requiredPatterns: r.RequiredPatterns || undefined,
        }));
        console.log(`[Automation Ops] Discovered ${policies.length} governance rules via rules API`);
        return { available: true, policies, message: `${policies.length} governance rules active.` };
      }

      return { available: false, policies: [], message: "Automation Ops API not accessible." };
    }

    const data = await policiesRes.json();
    const rawPolicies = data.value || data.items || data.policies || [];
    const policies: GovernancePolicy[] = rawPolicies.map((p: any) => ({
      id: p.Id || p.id || p.PolicyId,
      name: p.Name || p.name || p.PolicyName || "Unknown Policy",
      description: p.Description || p.description || "",
      type: classifyPolicyType(p.Name || p.name || p.Type || p.Category || ""),
      severity: mapPolicySeverity(p.Severity || p.severity || p.DefaultAction || "warning"),
      pattern: p.Pattern || p.pattern || undefined,
      restrictedActivities: p.RestrictedActivities || p.restrictedActivities || undefined,
      requiredPatterns: p.RequiredPatterns || p.requiredPatterns || undefined,
    }));

    console.log(`[Automation Ops] Discovered ${policies.length} governance policies`);
    return { available: true, policies, message: `${policies.length} governance policies active.` };
  } catch (err: any) {
    console.warn(`[Automation Ops] Discovery failed: ${err.message}`);
    return { available: false, policies: [], message: `Discovery failed: ${err.message}` };
  }
}

function classifyPolicyType(nameOrCategory: string): GovernancePolicy["type"] {
  const lower = nameOrCategory.toLowerCase();
  if (lower.includes("naming") || lower.includes("convention") || lower.includes("nmg")) return "naming";
  if (lower.includes("restrict") || lower.includes("block") || lower.includes("forbidden") || lower.includes("activity")) return "activity-restriction";
  if (lower.includes("error") || lower.includes("catch") || lower.includes("exception") || lower.includes("dbp")) return "error-handling";
  if (lower.includes("secur") || lower.includes("credential") || lower.includes("password") || lower.includes("sec")) return "security";
  return "general";
}

function mapPolicySeverity(severity: string): GovernancePolicy["severity"] {
  const lower = severity.toLowerCase();
  if (lower === "error" || lower === "block" || lower === "reject") return "error";
  if (lower === "info" || lower === "informational") return "info";
  return "warning";
}

export type AttendedRobotInfo = {
  available: boolean;
  attendedRobots: Array<{ id: number; name: string; machineName: string; status: string; userName?: string }>;
  unattendedRobots: Array<{ id: number; name: string; machineName: string; status: string }>;
  hasAttended: boolean;
  hasUnattended: boolean;
  message: string;
};

export async function discoverAttendedRobots(): Promise<AttendedRobotInfo> {
  const config = await getUiPathConfig();
  if (!config) return { available: false, attendedRobots: [], unattendedRobots: [], hasAttended: false, hasUnattended: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const res = await fetch(`${base}/odata/Sessions?$top=100&$expand=Robot`, { headers });
    if (!res.ok) {
      return { available: false, attendedRobots: [], unattendedRobots: [], hasAttended: false, hasUnattended: false, message: `Sessions API returned ${res.status}` };
    }

    const data = await res.json();
    const sessions = data.value || [];
    const attended: AttendedRobotInfo["attendedRobots"] = [];
    const unattended: AttendedRobotInfo["unattendedRobots"] = [];

    for (const s of sessions) {
      const robotType = s.Robot?.Type || s.Type || "";
      const entry = {
        id: s.Robot?.Id || s.Id,
        name: s.Robot?.Name || "Unknown",
        machineName: s.Robot?.MachineName || s.HostMachineName || "Unknown",
        status: s.Status || "Unknown",
      };
      if (robotType === "Attended" || robotType === "Development" || robotType === "CitizenDeveloper") {
        attended.push({ ...entry, userName: s.Robot?.Username });
      } else {
        unattended.push(entry);
      }
    }

    console.log(`[Assistant Discovery] ${attended.length} attended, ${unattended.length} unattended robots`);
    return {
      available: true,
      attendedRobots: attended,
      unattendedRobots: unattended,
      hasAttended: attended.length > 0,
      hasUnattended: unattended.length > 0,
      message: `${attended.length} attended, ${unattended.length} unattended robots discovered.`,
    };
  } catch (err: any) {
    console.warn(`[Assistant Discovery] Failed: ${err.message}`);
    return { available: false, attendedRobots: [], unattendedRobots: [], hasAttended: false, hasUnattended: false, message: `Discovery failed: ${err.message}` };
  }
}

export type StudioProject = {
  id: string;
  name: string;
  description: string;
  projectType: string;
  lastModified?: string;
  feedId?: string;
};

export type StudioProcessesResult = {
  available: boolean;
  projects: StudioProject[];
  existingNames: string[];
  message: string;
};

export async function discoverStudioProjects(): Promise<StudioProcessesResult> {
  const config = await getUiPathConfig();
  if (!config) return { available: false, projects: [], existingNames: [], message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const [releasesRes, packagesRes] = await Promise.all([
      fetch(`${base}/odata/Releases?$top=200&$orderby=Name&$select=Id,Name,ProcessKey,ProcessVersion,Description`, { headers }).catch(() => null),
      fetch(`${base}/odata/Processes?$top=200&$orderby=Title&$select=Id,Title,Version,Description,IsActive`, { headers }).catch(() => null),
    ]);

    const projects: StudioProject[] = [];
    const nameSet = new Set<string>();

    if (releasesRes && releasesRes.ok) {
      const data = await releasesRes.json();
      for (const r of (data.value || [])) {
        const name = r.Name || r.ProcessKey;
        if (name && !nameSet.has(name)) {
          nameSet.add(name);
          projects.push({
            id: String(r.Id),
            name,
            description: r.Description || "",
            projectType: "release",
            feedId: r.ProcessKey,
          });
        }
      }
    }

    if (packagesRes && packagesRes.ok) {
      const data = await packagesRes.json();
      for (const p of (data.value || [])) {
        const name = p.Title || p.Id;
        if (name && !nameSet.has(name)) {
          nameSet.add(name);
          projects.push({
            id: String(p.Id),
            name,
            description: p.Description || "",
            projectType: "package",
          });
        }
      }
    }

    console.log(`[Studio Discovery] ${projects.length} existing projects/processes found`);
    return {
      available: projects.length > 0 || (releasesRes?.ok ?? false),
      projects,
      existingNames: Array.from(nameSet),
      message: `${projects.length} existing processes discovered.`,
    };
  } catch (err: any) {
    console.warn(`[Studio Discovery] Failed: ${err.message}`);
    return { available: false, projects: [], existingNames: [], message: `Discovery failed: ${err.message}` };
  }
}

export async function startJob(
  processReleaseKey: string,
  robotIds?: number[]
): Promise<{ success: boolean; message: string; job?: any }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const startInfo: Record<string, any> = {
      ReleaseKey: processReleaseKey,
      Strategy: "ModernJobsCount",
      JobsCount: 1,
    };

    if (robotIds && robotIds.length > 0) {
      startInfo.Strategy = "Specific";
      startInfo.RobotIds = robotIds;
    }

    const body = { startInfo };
    console.log(`[UiPath] Starting job: ${JSON.stringify(body)}`);

    const res = await fetch(
      `${base}/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );

    const text = await res.text();
    console.log(`[UiPath] Start job response (${res.status}): ${text.slice(0, 500)}`);

    if (!res.ok) {
      if (res.status === 403) {
        return { success: false, message: "Access denied. Ensure your app has OR.Jobs scope with Create permission." };
      }
      let errorDetail = text.slice(0, 300);
      try {
        const errObj = JSON.parse(text);
        errorDetail = errObj.message || errObj.errorMessage || errorDetail;
      } catch {}
      return { success: false, message: `Failed to start job (${res.status}): ${errorDetail}` };
    }

    const data = JSON.parse(text);
    const jobs = data.value || [data];
    const job = jobs[0];
    return {
      success: true,
      message: `Job started successfully (ID: ${job.Id}, State: ${job.State}).`,
      job: {
        id: job.Id,
        key: job.Key,
        state: job.State,
        startTime: job.StartTime,
        releaseKey: processReleaseKey,
      },
    };
  } catch (err: any) {
    console.error("[UiPath] Start job error:", err.message);
    return { success: false, message: `Failed to start job: ${err.message}` };
  }
}

export async function getJobStatus(jobId: number): Promise<{ success: boolean; message: string; job?: any }> {
  const config = await getUiPathConfig();
  if (!config) return { success: false, message: "UiPath is not configured." };

  try {
    const token = await getAccessToken(config);
    const headers = folderHeaders(config, token);
    const base = orchBaseUrl(config);

    const res = await fetch(`${base}/odata/Jobs(${jobId})`, { headers });
    if (!res.ok) {
      return { success: false, message: `Failed to fetch job status (${res.status})` };
    }
    const data = await res.json();
    return {
      success: true,
      message: `Job ${data.Id}: ${data.State}`,
      job: {
        id: data.Id,
        key: data.Key,
        state: data.State,
        startTime: data.StartTime,
        endTime: data.EndTime,
        info: data.Info,
        outputData: data.OutputData,
        hostMachineName: data.HostMachineName,
        releaseName: data.ReleaseName,
      },
    };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch job status: ${err.message}` };
  }
}

export async function runHealthCheck(packageId?: string): Promise<{
  checks: Array<{ name: string; status: "pass" | "fail" | "warn"; message: string; details?: any }>;
  summary: string;
}> {
  const checks: Array<{ name: string; status: "pass" | "fail" | "warn"; message: string; details?: any }> = [];

  const config = await getUiPathConfig();
  if (!config) {
    checks.push({ name: "Connection", status: "fail", message: "UiPath is not configured. Go to Admin > Integrations to set it up." });
    return { checks, summary: "Not configured" };
  }

  let token: string;
  try {
    token = await getAccessToken(config);
    checks.push({ name: "Authentication", status: "pass", message: "OAuth token obtained successfully." });
  } catch (err: any) {
    checks.push({ name: "Authentication", status: "fail", message: `Authentication failed: ${err.message}` });
    return { checks, summary: "Authentication failed" };
  }

  const headers = folderHeaders(config, token);
  const base = orchBaseUrl(config);

  try {
    const res = await fetch(`${base}/odata/Folders?$top=1`, { headers });
    if (res.ok) {
      checks.push({ name: "API Access", status: "pass", message: "Connected to Orchestrator API." });
    } else {
      checks.push({ name: "API Access", status: "fail", message: `API returned ${res.status}. Check org/tenant names.` });
      return { checks, summary: "API access failed" };
    }
  } catch (err: any) {
    checks.push({ name: "API Access", status: "fail", message: `Cannot reach Orchestrator: ${err.message}` });
    return { checks, summary: "Cannot reach API" };
  }

  if (config.folderId) {
    try {
      const res = await fetch(`${base}/odata/Folders?$filter=Id eq ${config.folderId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.value?.length > 0) {
          checks.push({ name: "Target Folder", status: "pass", message: `Folder "${config.folderName}" (ID: ${config.folderId}) exists.` });
        } else {
          checks.push({ name: "Target Folder", status: "fail", message: `Folder ID ${config.folderId} not found. Re-select in Admin > Integrations.` });
        }
      }
    } catch {
      checks.push({ name: "Target Folder", status: "warn", message: "Could not verify folder." });
    }
  } else {
    checks.push({ name: "Target Folder", status: "warn", message: "No folder selected — packages go to tenant feed. Select a folder in Admin > Integrations for better organization." });
  }

  if (packageId) {
    try {
      const res = await fetch(
        `${base}/odata/Processes?$filter=Id eq '${encodeURIComponent(packageId)}'&$top=1`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.value?.length > 0) {
          const pkg = data.value[0];
          checks.push({ name: "Package", status: "pass", message: `Package "${packageId}" v${pkg.Version} found in feed.`, details: { version: pkg.Version } });
        } else {
          checks.push({ name: "Package", status: "fail", message: `Package "${packageId}" not found in feed. Push it first.` });
        }
      }
    } catch {
      checks.push({ name: "Package", status: "warn", message: "Could not check package status." });
    }

    try {
      const res = await fetch(
        `${base}/odata/Releases?$filter=ProcessKey eq '${encodeURIComponent(packageId)}'&$top=1`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.value?.length > 0) {
          const proc = data.value[0];
          checks.push({
            name: "Process",
            status: "pass",
            message: `Process "${proc.Name}" linked to package (v${proc.ProcessVersion}).`,
            details: { processId: proc.Id, releaseKey: proc.Key, version: proc.ProcessVersion },
          });
        } else {
          checks.push({ name: "Process", status: "fail", message: `No process created from package "${packageId}". Create one to run it.` });
        }
      }
    } catch {
      checks.push({ name: "Process", status: "warn", message: "Could not check process status." });
    }
  }

  try {
    const res = await fetch(`${base}/odata/Sessions?$top=10`, { headers });
    if (res.ok) {
      const data = await res.json();
      const sessions = data.value || [];
      const available = sessions.filter((s: any) => s.Status === "Available");
      if (sessions.length === 0) {
        checks.push({
          name: "Robots",
          status: "fail",
          message: "No robot sessions found in this folder. Assign robots in Orchestrator > Folder Settings > Machines & Robots.",
          details: { count: 0 },
        });
      } else if (available.length === 0) {
        checks.push({
          name: "Robots",
          status: "warn",
          message: `${sessions.length} robot(s) found but none are "Available". They may be busy or disconnected.`,
          details: { total: sessions.length, available: 0 },
        });
      } else {
        checks.push({
          name: "Robots",
          status: "pass",
          message: `${available.length} robot(s) available out of ${sessions.length} total.`,
          details: { total: sessions.length, available: available.length },
        });
      }
    } else {
      checks.push({ name: "Robots", status: "warn", message: "Could not check robot sessions. You may need OR.Robots.Read scope." });
    }
  } catch {
    checks.push({ name: "Robots", status: "warn", message: "Could not check robot sessions." });
  }

  try {
    const res = await fetch(`${base}/odata/Machines?$top=10`, { headers });
    if (res.ok) {
      const data = await res.json();
      const machines = data.value || [];
      if (machines.length === 0) {
        checks.push({
          name: "Machines",
          status: "warn",
          message: "No machine templates found. Create machine templates in Orchestrator > Tenant > Machines.",
          details: { count: 0 },
        });
      } else {
        checks.push({
          name: "Machines",
          status: "pass",
          message: `${machines.length} machine template(s) available.`,
          details: { count: machines.length },
        });
      }
    }
  } catch {
    checks.push({ name: "Machines", status: "warn", message: "Could not check machines." });
  }

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const passCount = checks.filter((c) => c.status === "pass").length;

  let summary: string;
  if (failCount > 0) {
    summary = `${failCount} issue(s) found — fix them to run automations.`;
  } else if (warnCount > 0) {
    summary = `All critical checks passed. ${warnCount} warning(s).`;
  } else {
    summary = `All ${passCount} checks passed — ready to run automations.`;
  }

  return { checks, summary };
}

export type LicenseInfo = {
  runtime: Array<{ type: string; allowed: number; used: number; available: number }>;
  namedUser: Array<{ type: string; allowed: number; used: number; available: number }>;
  summary: string;
  recommendations: string[];
};

async function fetchLicenseInfo(orchBase: string, hdrs: Record<string, string>): Promise<LicenseInfo | null> {
  try {
    const [runtimeRes, namedUserRes] = await Promise.all([
      fetch(`${orchBase}/odata/LicensesRuntime`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/LicensesNamedUser`, { headers: hdrs }).catch(() => null),
    ]);

    const runtime: LicenseInfo["runtime"] = [];
    const namedUser: LicenseInfo["namedUser"] = [];

    if (runtimeRes?.ok) {
      try {
        const data = await runtimeRes.json();
        const items = data.value || (Array.isArray(data) ? data : []);
        for (const item of items) {
          const type = item.RuntimeType || item.Type || item.LicenseType || "Unknown";
          const allowed = item.Allowed ?? item.Total ?? item.Count ?? 0;
          const used = item.Used ?? item.InUse ?? 0;
          if (allowed > 0 || used > 0) {
            runtime.push({ type, allowed, used, available: Math.max(0, allowed - used) });
          }
        }
      } catch { /* parse error */ }
    }

    if (!runtimeRes?.ok) {
      try {
        const settingsRes = await fetch(`${orchBase}/odata/Settings/UiPath.Server.Configuration.OData.GetLicense`, { headers: hdrs });
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          if (data.Attended !== undefined) runtime.push({ type: "Attended", allowed: data.Attended || 0, used: 0, available: data.Attended || 0 });
          if (data.Unattended !== undefined) runtime.push({ type: "Unattended", allowed: data.Unattended || 0, used: 0, available: data.Unattended || 0 });
          if (data.NonProduction !== undefined) runtime.push({ type: "NonProduction", allowed: data.NonProduction || 0, used: 0, available: data.NonProduction || 0 });
          if (data.Development !== undefined) runtime.push({ type: "Development", allowed: data.Development || 0, used: 0, available: data.Development || 0 });
          if (data.TestAutomation !== undefined) runtime.push({ type: "TestAutomation", allowed: data.TestAutomation || 0, used: 0, available: data.TestAutomation || 0 });
        }
      } catch { /* fallback also failed */ }
    }

    if (namedUserRes?.ok) {
      try {
        const data = await namedUserRes.json();
        const items = data.value || (Array.isArray(data) ? data : []);
        for (const item of items) {
          const type = item.UserType || item.Type || item.LicenseType || "Unknown";
          const allowed = item.Allowed ?? item.Total ?? 0;
          const used = item.Used ?? item.InUse ?? 0;
          if (allowed > 0 || used > 0) {
            namedUser.push({ type, allowed, used, available: Math.max(0, allowed - used) });
          }
        }
      } catch { /* parse error */ }
    }

    if (runtime.length === 0 && namedUser.length === 0) return null;

    const summaryParts: string[] = [];
    for (const r of runtime) {
      summaryParts.push(`${r.type}: ${r.used}/${r.allowed} used (${r.available} available)`);
    }
    for (const n of namedUser) {
      summaryParts.push(`${n.type} (Named User): ${n.used}/${n.allowed} used`);
    }

    const recommendations: string[] = [];
    const hasUnattended = runtime.some(r => r.type === "Unattended" && r.allowed > 0);
    const hasAttended = runtime.some(r => r.type === "Attended" && r.allowed > 0);
    const hasTestAuto = runtime.some(r => r.type === "TestAutomation" && r.allowed > 0);
    const hasNonProd = runtime.some(r => r.type === "NonProduction" && r.allowed > 0);

    if (!hasUnattended) {
      recommendations.push("**Unattended Robot License**: Not available. Adding Unattended licenses would enable fully autonomous back-office automation — scheduled processing, queue-based workloads, and 24/7 execution without human intervention.");
    }
    if (!hasAttended) {
      recommendations.push("**Attended Robot License**: Not available. Adding Attended licenses would enable human-assisted automation — desktop bots that help users complete tasks faster with side-by-side guidance.");
    }
    if (!hasTestAuto) {
      recommendations.push("**Test Automation License**: Not available. Adding Test Automation licenses would enable automated regression testing of the automation using UiPath Test Manager, ensuring quality across updates.");
    }
    if (!hasNonProd) {
      recommendations.push("**Non-Production License**: Not available. Adding Non-Production licenses would provide a dedicated testing/staging environment for the automation before production deployment.");
    }

    return {
      runtime,
      namedUser,
      summary: summaryParts.join("; "),
      recommendations,
    };
  } catch (err: any) {
    console.warn(`[UiPath] License fetch failed: ${err.message}`);
    return null;
  }
}

export type PlatformCapabilityProfile = {
  configured: boolean;
  available: {
    orchestrator: boolean;
    actionCenter: boolean;
    documentUnderstanding: boolean;
    generativeExtraction: boolean;
    communicationsMining: boolean;
    testManager: boolean;
    storageBuckets: boolean;
    aiCenter: boolean;
    maestro: boolean;
    integrationService: boolean;
    ixp: boolean;
    automationHub: boolean;
    automationOps: boolean;
    automationStore: boolean;
    apps: boolean;
    assistant: boolean;
  };
  grantedScopes: string[];
  summary: string;
  availableDescription: string;
  unavailableRecommendations: string;
  licenseInfo?: LicenseInfo | null;
  integrationService?: IntegrationServiceDiscovery;
  aiCenterSkills?: AICenterSkill[];
  aiCenterPackages?: AICenterPackage[];
};

export type AICenterSkill = {
  id: string;
  name: string;
  mlPackageName: string;
  mlPackageVersionId: string;
  status: string;
  inputType: string;
  outputType: string;
  gpu: boolean;
  projectName: string;
};

export type AICenterPackage = {
  id: string;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  trainingStatus: string;
  projectName: string;
};

type AgentCapabilities = {
  autonomous: boolean;
  conversational: boolean;
  coded: boolean;
};

type UnifiedProbeResult = {
  configured: boolean;
  flags: {
    orchestrator: boolean;
    actionCenter: boolean;
    testManager: boolean;
    documentUnderstanding: boolean;
    generativeExtraction: boolean;
    communicationsMining: boolean;
    dataService: boolean;
    platformManagement: boolean;
    environments: boolean;
    triggers: boolean;
    storageBuckets: boolean;
    aiCenter: boolean;
    agents: boolean;
    autopilot: boolean;
    maestro: boolean;
    integrationService: boolean;
    ixp: boolean;
    automationHub: boolean;
    automationOps: boolean;
    automationStore: boolean;
    apps: boolean;
    assistant: boolean;
    attendedRobots: boolean;
    studioProjects: boolean;
    hasUnattendedSlots: boolean;
  };
  agentCapabilities?: AgentCapabilities;
  grantedScopes: string[];
  licenseInfo: LicenseInfo | null;
  aiCenterSkills: AICenterSkill[];
  aiCenterPackages: AICenterPackage[];
  governancePolicies?: GovernancePolicy[];
  attendedRobotInfo?: AttendedRobotInfo;
  studioProjectInfo?: StudioProcessesResult;
  serverlessDetected?: boolean;
  cachedAt: number;
  probeFailed?: boolean;
  probeError?: string;
};

let _probeCache: UnifiedProbeResult | null = null;
const PROBE_CACHE_TTL_MS = 60_000;

export function clearProbeCache(): void {
  _probeCache = null;
}

async function probeAllServices(): Promise<UnifiedProbeResult> {
  if (_probeCache && Date.now() - _probeCache.cachedAt < PROBE_CACHE_TTL_MS) {
    return _probeCache;
  }

  const empty: UnifiedProbeResult = {
    configured: false,
    flags: {
      orchestrator: false, actionCenter: false, testManager: false,
      documentUnderstanding: false, generativeExtraction: false, communicationsMining: false,
      dataService: false, platformManagement: false,
      environments: true, triggers: true, storageBuckets: false, aiCenter: false, agents: false,
      autopilot: false,
      maestro: false, integrationService: false, ixp: false,
      automationHub: false, automationOps: false, automationStore: false,
      apps: false, assistant: false,
      attendedRobots: false, studioProjects: false, hasUnattendedSlots: false,
    },
    grantedScopes: [],
    licenseInfo: null,
    aiCenterSkills: [],
    aiCenterPackages: [],
    cachedAt: Date.now(),
  };

  const config = await getUiPathConfig();
  if (!config) {
    _probeCache = empty;
    return empty;
  }

  try {
    const { getHeaders: getOrHeaders, tryAcquireResourceToken, getDuToken } = await import("./uipath-auth");
    const token = await getAccessToken(config);
    const hdrs = await getOrHeaders();
    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const orchBase = `${base}/orchestrator_`;

    let grantedScopes: string[] = [];
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        const scopeVal = payload.scope || payload.scp;
        if (scopeVal) grantedScopes = Array.isArray(scopeVal) ? scopeVal : scopeVal.split(/\s+/);
      }
    } catch { grantedScopes = config.scopes.split(/\s+/); }

    const orchRes = await fetch(`${orchBase}/odata/Folders?$top=1`, { headers: hdrs });
    const orchOk = orchRes.ok;
    if (!orchOk) {
      const result: UnifiedProbeResult = {
        configured: true, flags: { ...empty.flags, environments: false, triggers: false, apps: false },
        grantedScopes, licenseInfo: null, aiCenterSkills: [], aiCenterPackages: [],
        governancePolicies: [],
        cachedAt: Date.now(),
      };
      _probeCache = result;
      return result;
    }

    const [acRes, envRes, trigRes, schedRes, bucketRes, licenseInfo] = await Promise.all([
      fetch(`${orchBase}/odata/TaskCatalogs?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/Environments?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/QueueTriggers?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/ProcessSchedules?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/Buckets?$top=1`, { headers: hdrs }).catch(() => null),
      fetchLicenseInfo(orchBase, hdrs),
    ]);

    let acAvailable = true;
    if (acRes) {
      if (acRes.ok) {
        const acText = await acRes.text();
        const isHTML = acText.trim().startsWith("<");
        if (isHTML) {
          acAvailable = true;
          console.log("[UiPath Probe] Action Center returned HTML but Orchestrator is connected — marking as available");
        } else {
          try {
            const data = JSON.parse(acText);
            const hasError = data.errorCode || data["odata.error"] || (data.message && typeof data.message === "string" && data.message.includes("not onboarded"));
            acAvailable = true;
            if (hasError) {
              console.log("[UiPath Probe] Action Center endpoint returned error but is reachable — marking as available");
            }
          } catch { acAvailable = true; }
        }
      } else {
        acAvailable = true;
        console.log(`[UiPath Probe] Action Center returned ${acRes.status} — marking as available (Orchestrator is connected)`);
      }
    }

    let envAvailable = true;
    if (envRes) {
      envAvailable = envRes.ok || envRes.status === 400;
      if (envRes.status === 404 || envRes.status === 405) envAvailable = false;
    }

    const queueTriggersOk = trigRes ? (trigRes.ok || trigRes.status === 400) && trigRes.status !== 404 && trigRes.status !== 405 : false;
    const processSchedulesOk = schedRes ? (schedRes.ok || schedRes.status === 400) && schedRes.status !== 404 && schedRes.status !== 405 : false;
    const triggersAvailable = queueTriggersOk || processSchedulesOk;

    const bucketsAvailable = bucketRes ? bucketRes.ok : false;

    const [tmResult, duResult, pmResult, dfResult, ixpResult, aiResult] = await Promise.allSettled([
      tryAcquireResourceToken("TM"),
      tryAcquireResourceToken("DU"),
      tryAcquireResourceToken("PM"),
      tryAcquireResourceToken("DF"),
      tryAcquireResourceToken("IXP"),
      tryAcquireResourceToken("AI"),
    ]);

    let tmAvailable = false;
    if (tmResult.status === "fulfilled" && tmResult.value.ok) {
      tmAvailable = true;
      console.log("[UiPath Probe] TM token acquired — Test Manager available");
    }

    const isServiceReachable = (res: Response | null) => {
      if (!res) return false;
      if (res.ok) return true;
      if (res.status === 403 || res.status === 401) return true;
      if (res.status >= 300 && res.status < 400) return true;
      return false;
    };

    let aiProbeHdrs = hdrs;
    if (aiResult.status === "fulfilled" && aiResult.value.ok) {
      try {
        const aiTok = await (await import("./uipath-auth")).getAiToken();
        aiProbeHdrs = { Authorization: `Bearer ${aiTok}`, "Content-Type": "application/json" };
      } catch { aiProbeHdrs = hdrs; }
    }

    let duAvailable = false;
    let genExtractionAvailable = false;
    let commsMiningAvailable = false;
    if (duResult.status === "fulfilled" && duResult.value.ok) {
      const duTok = await getDuToken();
      const duHdrs: Record<string, string> = { Authorization: `Bearer ${duTok}`, "Content-Type": "application/json" };
      if (config.folderId) duHdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;
      const duProbeUrl = `${base}/du_/api/framework/projects?api-version=1`;
      try {
        const duRes = await fetch(duProbeUrl, { headers: duHdrs });
        console.log(`[UiPath Probe] DU Discovery: ${duProbeUrl} -> ${duRes.status}`);
        if (duRes.ok) {
          duAvailable = true;
        } else if (duRes.status === 403) {
          console.warn(`[UiPath Probe] DU token got 403 — scopes may be insufficient for Discovery API`);
        }
      } catch {}

      const ixpProbeUrl = `${base}/ixp_/api/v1/projects`;
      try {
        const ixpRes = await fetch(ixpProbeUrl, { headers: duHdrs });
        console.log(`[UiPath Probe] IXP Generative Extraction: ${ixpProbeUrl} -> ${ixpRes.status}`);
        if (ixpRes.ok) {
          const ixpText = await ixpRes.text();
          const trimmedIxp = ixpText.trim();
          if (trimmedIxp.length > 0 && !trimmedIxp.startsWith("<") && !trimmedIxp.startsWith("<!")) {
            try {
              const ixpData = JSON.parse(trimmedIxp);
              if (!ixpData.errorCode && !ixpData.ErrorCode && !ixpData["odata.error"]) {
                genExtractionAvailable = true;
                console.log("[UiPath Probe] IXP Generative Extraction available");
              }
            } catch { /* not valid JSON — not a genuine service */ }
          }
        }
      } catch {}
    }

    const cmProbeUrl = `${base}/reinfer_/api/v1/datasets`;
    let ixpHdrs = hdrs;
    if (ixpResult.status === "fulfilled" && ixpResult.value.ok) {
      try {
        const ixpTok = await (await import("./uipath-auth")).getIxpToken();
        ixpHdrs = { Authorization: `Bearer ${ixpTok}`, "Content-Type": "application/json" };
      } catch {
        ixpHdrs = hdrs;
      }
    }
    try {
      const cmRes = await fetch(cmProbeUrl, { headers: ixpHdrs });
      console.log(`[UiPath Probe] Communications Mining: ${cmProbeUrl} -> ${cmRes.status}`);
      if (cmRes.ok) {
        const cmText = await cmRes.text();
        const trimmedCm = cmText.trim();
        if (trimmedCm.length > 0 && !trimmedCm.startsWith("<") && !trimmedCm.startsWith("<!")) {
          try {
            const cmData = JSON.parse(trimmedCm);
            if (!cmData.errorCode && !cmData.ErrorCode && !cmData["odata.error"]) {
              commsMiningAvailable = true;
              console.log("[UiPath Probe] Communications Mining available");
            }
          } catch { /* not valid JSON — not a genuine service */ }
        }
      }
    } catch {}

    let aiAvailable = false;
    let aiCenterSkills: AICenterSkill[] = [];
    let aiCenterPackages: AICenterPackage[] = [];
    const aiProbe = await fetch(`${base}/aifabric_/ai-deployer/v1/projects?$top=1`, { headers: aiProbeHdrs }).catch(() => null);
    if (aiProbe && isServiceReachable(aiProbe)) {
      aiAvailable = true;
      try {
        const [skillsRes, pkgsRes] = await Promise.all([
          fetch(`${base}/aifabric_/ai-deployer/v1/mlskills?$top=50`, { headers: aiProbeHdrs }).catch(() => null),
          fetch(`${base}/aifabric_/ai-deployer/v1/mlpackages?$top=50`, { headers: aiProbeHdrs }).catch(() => null),
        ]);
        if (skillsRes && skillsRes.ok) {
          const skillsData = await skillsRes.json();
          const items = skillsData.dataList || skillsData.value || skillsData.items || [];
          aiCenterSkills = items.filter((s: any) => s.name).map((s: any) => ({
            id: s.id || s.mlSkillId || "",
            name: s.name,
            mlPackageName: s.mlPackageName || s.packageName || "",
            mlPackageVersionId: s.mlPackageVersionId || "",
            status: s.deploymentStatus || s.status || "unknown",
            inputType: s.inputType || s.inputDescription || "",
            outputType: s.outputType || s.outputDescription || "",
            gpu: s.requiresGpu || false,
            projectName: s.projectName || "",
          }));
          console.log(`[UiPath Probe] AI Center: ${aiCenterSkills.length} ML skill(s) discovered`);
        }
        if (pkgsRes && pkgsRes.ok) {
          const pkgsData = await pkgsRes.json();
          const items = pkgsData.dataList || pkgsData.value || pkgsData.items || [];
          aiCenterPackages = items.filter((p: any) => p.name).map((p: any) => ({
            id: p.id || p.mlPackageId || "",
            name: p.name,
            description: p.description || "",
            inputType: p.inputType || "",
            outputType: p.outputType || "",
            trainingStatus: p.trainingStatus || "",
            projectName: p.projectName || "",
          }));
          console.log(`[UiPath Probe] AI Center: ${aiCenterPackages.length} ML package(s) discovered`);
        }
      } catch (aiErr: any) {
        console.warn(`[UiPath Probe] AI Center skills/packages fetch failed: ${aiErr.message}`);
      }
    }

    let agentsAvailable = false;
    let autopilotAvailable = false;
    let agentCapabilities: { autonomous: boolean; conversational: boolean; coded: boolean } = { autonomous: false, conversational: false, coded: false };
    const agentEndpoints = [
      { url: `${base}/agentstudio_/api/v1/agents?$top=1`, label: "Agent Studio" },
      { url: `${base}/autopilot_/api/v1/agents?$top=1`, label: "Autopilot" },
      { url: `${orchBase}/odata/AgentDefinitions?$top=1`, label: "Orchestrator AgentDefinitions" },
    ];
    const agentProbeResults = await Promise.allSettled(
      agentEndpoints.map(ep => fetch(ep.url, { headers: hdrs }))
    );
    for (let i = 0; i < agentProbeResults.length; i++) {
      const pr = agentProbeResults[i];
      if (pr.status === "fulfilled" && pr.value.ok) {
        agentsAvailable = true;
        if (agentEndpoints[i].label === "Autopilot") {
          autopilotAvailable = true;
          console.log(`[UiPath Probe] Autopilot/self-healing capability detected`);
        }
        console.log(`[UiPath Probe] Agent capability discovered via ${agentEndpoints[i].label} API`);
        try {
          const body = await pr.value.json();
          const items = body?.value || body?.items || (Array.isArray(body) ? body : []);
          for (const item of items) {
            const aType = (item.agentType || item.type || "").toLowerCase();
            if (aType.includes("autonomous")) agentCapabilities.autonomous = true;
            else if (aType.includes("conversational") || aType.includes("chat")) agentCapabilities.conversational = true;
            else if (aType.includes("coded")) agentCapabilities.coded = true;
          }
        } catch {}
        break;
      }
    }
    if (!agentsAvailable) {
      const assetFallback = await fetch(`${orchBase}/odata/Assets?$filter=startswith(Name,'Agent_')&$top=1`, { headers: hdrs }).catch(() => null);
      if (assetFallback && assetFallback.ok) {
        agentsAvailable = true;
        console.log("[UiPath Probe] Agent provisioning available via Assets API fallback (no dedicated Agents API found)");
      }
    }
    if (agentsAvailable && !agentCapabilities.autonomous && !agentCapabilities.conversational && !agentCapabilities.coded) {
      agentCapabilities = { autonomous: true, conversational: true, coded: true };
    }

    let pmAvailable = false;
    if (pmResult.status === "fulfilled" && pmResult.value.ok) pmAvailable = true;

    let dsAvailable = false;
    if (dfResult.status === "fulfilled" && dfResult.value.ok) {
      const dfSwagger = await fetch(`${base}/dataservice_/swagger/index.html`, { redirect: "manual" }).catch(() => null);
      if (dfSwagger && dfSwagger.status === 200) dsAvailable = true;
      if (!dsAvailable) {
        const dfEntityProbe = await fetch(`${base}/dataservice_/api/EntityService/Entity`, { headers: hdrs }).catch(() => null);
        if (dfEntityProbe && (dfEntityProbe.ok || dfEntityProbe.status === 401)) {
          dsAvailable = true;
          console.log("[UiPath Probe] Data Fabric Entity API reachable");
        }
      }
    }

    let ixpProbeHdrs = hdrs;
    if (ixpResult.status === "fulfilled" && ixpResult.value.ok) {
      try {
        const ixpTok2 = await (await import("./uipath-auth")).getIxpToken();
        ixpProbeHdrs = { Authorization: `Bearer ${ixpTok2}`, "Content-Type": "application/json" };
      } catch { ixpProbeHdrs = hdrs; }
    }

    let pmProbeHdrs = hdrs;
    if (pmResult.status === "fulfilled" && pmResult.value.ok) {
      try {
        const pmTok = await (await import("./uipath-auth")).getPmToken();
        pmProbeHdrs = { Authorization: `Bearer ${pmTok}`, "Content-Type": "application/json" };
      } catch { pmProbeHdrs = hdrs; }
    }

    const [maestroProbe, integrationServiceProbe, ixpProbe, automationHubProbe, automationOpsProbe, automationStoreProbe, appsProbe, assistantHttpProbe] = await Promise.all([
      fetch(`${base}/maestro_/api/v1/`, { headers: hdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/integrationservice_/api/Connections?$top=1`, { headers: hdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/reinfer_/api/v1/datasets`, { headers: ixpProbeHdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/automationhub_/api/v1/ideas?$top=1`, { headers: hdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/automationops_/api/v1/policies?$top=1`, { headers: pmProbeHdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/automationstore_/api/v1/`, { headers: hdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/apps_/api/v1/apps?$top=1`, { headers: hdrs, redirect: "manual" }).catch(() => null),
      fetch(`${base}/assistant_/api/v1/`, { headers: hdrs, redirect: "manual" }).catch(() => null),
    ]);

    const pimsResult = await tryAcquireResourceToken("PIMS").catch(() => ({ ok: false, scopes: [] as string[] }));

    const maestroAvailable = isServiceReachable(maestroProbe) || pimsResult.ok;
    const integrationServiceAvailable = isServiceReachable(integrationServiceProbe);
    const ixpAvailable = isServiceReachable(ixpProbe);
    const automationHubAvailable = isServiceReachable(automationHubProbe);
    const automationOpsAvailable = isServiceReachable(automationOpsProbe);
    const appsAvailable = isServiceReachable(appsProbe);
    const assistantAvailable = isServiceReachable(assistantHttpProbe);
    const automationStoreAvailable = isServiceReachable(automationStoreProbe);

    if (maestroAvailable) console.log("[UiPath Probe] Maestro available");
    if (integrationServiceAvailable) console.log("[UiPath Probe] Integration Service available");
    if (ixpAvailable) console.log("[UiPath Probe] IXP available");
    if (automationHubAvailable) console.log("[UiPath Probe] Automation Hub available");
    if (automationOpsAvailable) console.log("[UiPath Probe] Automation Ops available");
    if (automationStoreAvailable) console.log("[UiPath Probe] Automation Store available");
    if (appsAvailable) console.log("[UiPath Probe] Apps available");
    if (assistantAvailable) console.log("[UiPath Probe] Assistant available");

    const [govResult, attendedResult, studioResult] = await Promise.allSettled([
      discoverGovernancePolicies(),
      discoverAttendedRobots(),
      discoverStudioProjects(),
    ]);

    const govData = govResult.status === "fulfilled" ? govResult.value : null;
    const attendedData = attendedResult.status === "fulfilled" ? attendedResult.value : null;
    const studioData = studioResult.status === "fulfilled" ? studioResult.value : null;

    let serverlessDetected = false;
    let hasUnattendedSlots = false;
    try {
      const sessRes = await fetch(`${orchBase}/odata/Sessions?$top=20`, { headers: hdrs });
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        const sessions = sessData.value || [];
        serverlessDetected = sessions.some((s: any) =>
          (s.RuntimeType === "Serverless" || s.RobotType === "Serverless" ||
           (s.MachineTemplateName || "").toLowerCase().includes("serverless"))
        );
        hasUnattendedSlots = sessions.some((s: any) =>
          s.RuntimeType === "Unattended" || s.RobotType === "Unattended"
        );
        if (serverlessDetected) {
          console.log("[UiPath Probe] Serverless runtime detected from robot sessions");
        }
      }
    } catch {
    }
    if (!hasUnattendedSlots) {
      try {
        const machRes = await fetch(`${orchBase}/odata/Machines?$top=10&$select=UnattendedSlots`, { headers: hdrs, signal: AbortSignal.timeout(5000) });
        if (machRes.ok) {
          const machData = await machRes.json();
          const machines = machData.value || [];
          hasUnattendedSlots = machines.some((m: any) => (m.UnattendedSlots || 0) > 0);
        }
      } catch {}
    }

    const result: UnifiedProbeResult = {
      configured: true,
      flags: {
        orchestrator: true,
        actionCenter: acAvailable,
        testManager: tmAvailable,
        documentUnderstanding: duAvailable,
        generativeExtraction: genExtractionAvailable,
        communicationsMining: commsMiningAvailable,
        dataService: dsAvailable,
        platformManagement: pmAvailable,
        environments: envAvailable,
        triggers: triggersAvailable,
        storageBuckets: bucketsAvailable,
        aiCenter: aiAvailable,
        agents: agentsAvailable,
        autopilot: autopilotAvailable,
        maestro: maestroAvailable,
        integrationService: integrationServiceAvailable,
        ixp: ixpAvailable,
        automationHub: automationHubAvailable,
        automationOps: automationOpsAvailable || (govData?.available ?? false),
        automationStore: automationStoreAvailable,
        apps: appsAvailable,
        assistant: assistantAvailable,
        attendedRobots: attendedData?.available ?? false,
        studioProjects: studioData?.available ?? false,
        hasUnattendedSlots,
      },
      agentCapabilities: agentsAvailable ? agentCapabilities : undefined,
      grantedScopes,
      licenseInfo,
      aiCenterSkills,
      aiCenterPackages,
      governancePolicies: govData?.policies,
      attendedRobotInfo: attendedData ?? undefined,
      studioProjectInfo: studioData ?? undefined,
      serverlessDetected,
      cachedAt: Date.now(),
    };

    setGovernancePolicies(result.governancePolicies ?? []);
    if (result.governancePolicies && result.governancePolicies.length > 0) {
      console.log(`[UiPath Probe] Synced ${result.governancePolicies.length} governance policies to Workflow Analyzer`);
    }

    _probeCache = result;
    console.log(`[UiPath Probe] Unified probe complete — ${Object.entries(result.flags).filter(([, v]) => v).map(([k]) => k).join(", ")}`);
    return result;
  } catch (err: any) {
    console.warn(`[UiPath Probe] Unified probe failed: ${err.message}`);
    const result: UnifiedProbeResult = {
      ...empty,
      configured: true,
      flags: { ...empty.flags, environments: false, triggers: false, apps: false },
      aiCenterSkills: [],
      aiCenterPackages: [],
      governancePolicies: [],
      cachedAt: Date.now(),
      probeFailed: true,
      probeError: err.message,
    };
    _probeCache = result;
    return result;
  }
}

export async function getPlatformCapabilities(): Promise<PlatformCapabilityProfile> {
  const empty: PlatformCapabilityProfile = {
    configured: false,
    available: {
      orchestrator: false, actionCenter: false, documentUnderstanding: false,
      generativeExtraction: false, communicationsMining: false,
      testManager: false, storageBuckets: false, aiCenter: false,
      maestro: false, integrationService: false, ixp: false,
      automationHub: false, automationOps: false, automationStore: false,
      apps: false, assistant: false,
    },
    grantedScopes: [],
    summary: "UiPath is not configured. The SDD will be generated with general best practices.",
    availableDescription: "",
    unavailableRecommendations: "",
  };

  const probe = await probeAllServices();
  if (!probe.configured) return empty;
  if (probe.probeFailed) {
    return { ...empty, configured: true, summary: `Could not probe UiPath platform: ${probe.probeError || "unknown error"}. SDD will use general best practices.` };
  }

  const avail = {
    orchestrator: probe.flags.orchestrator,
    actionCenter: probe.flags.actionCenter,
    documentUnderstanding: probe.flags.documentUnderstanding,
    generativeExtraction: probe.flags.generativeExtraction,
    communicationsMining: probe.flags.communicationsMining,
    testManager: probe.flags.testManager,
    storageBuckets: probe.flags.storageBuckets,
    aiCenter: probe.flags.aiCenter,
    maestro: probe.flags.maestro,
    integrationService: probe.flags.integrationService,
    ixp: probe.flags.ixp,
    automationHub: probe.flags.automationHub,
    automationOps: probe.flags.automationOps,
    automationStore: probe.flags.automationStore,
    apps: probe.flags.apps,
    assistant: probe.flags.assistant,
  };

  const availNames: string[] = [];
  const unavailRecs: string[] = [];

  if (avail.orchestrator) availNames.push("UiPath Orchestrator (queues, assets, triggers, machines, environments, processes, jobs)");
  else unavailRecs.push("- **Orchestrator**: Core service not accessible. Verify connection credentials.");

  if (avail.actionCenter) availNames.push("Action Center (human-in-the-loop tasks, approvals, escalations, SLA management)");
  else unavailRecs.push("- **Action Center**: Not available. If enabled, it would allow human-in-the-loop steps — approvals, validations, exception handling escalations — directly within the automation workflow instead of external email/chat processes.");

  if (avail.documentUnderstanding) {
    const duDesc = avail.generativeExtraction
      ? "IXP Document Understanding (classic DU for structured forms — OCR, ML classification, template-based extraction) + Generative Extraction (LLM-powered extraction for unstructured documents — contracts, reports, correspondence without pre-trained models)"
      : "Document Understanding (intelligent document processing, OCR, ML classification, data extraction for structured/semi-structured forms)";
    availNames.push(duDesc);
  } else {
    unavailRecs.push("- **Document Understanding / IXP**: Not available. If enabled, it could automate document classification and data extraction from invoices/forms/contracts using ML models (classic DU) or LLM-powered generative extraction for unstructured documents (contracts, reports) without pre-trained models.");
  }

  if (avail.generativeExtraction && !avail.documentUnderstanding) {
    availNames.push("IXP Generative Extraction (LLM-powered extraction for unstructured documents — contracts, reports, correspondence — without requiring pre-trained models or taxonomies)");
  }

  if (avail.communicationsMining) availNames.push("Communications Mining (email/message stream analysis, intent detection, sentiment analysis, intelligent routing, conversation intelligence for customer communications)");
  else unavailRecs.push("- **Communications Mining**: Not available. If enabled, it could analyze email and message streams to detect intent, extract data, route communications intelligently, and identify automation opportunities from customer/employee conversations.");

  if (avail.testManager) availNames.push("Test Manager (automated test projects, test cases, test execution, regression suites)");
  else unavailRecs.push("- **Test Manager**: Not available. If enabled, it would allow automated test case management and regression testing for the automation, ensuring quality across updates.");

  if (avail.storageBuckets) availNames.push("Storage Buckets (file storage for input/output documents, templates, logs)");
  else unavailRecs.push("- **Storage Buckets**: Not available. If enabled, it could provide centralized cloud storage for automation input files, output documents, templates, and audit logs.");

  if (avail.aiCenter) {
    const deployedSkills = probe.aiCenterSkills.filter(s => s.status.toLowerCase() === "deployed" || s.status.toLowerCase() === "available");
    if (deployedSkills.length > 0) {
      const skillsList = deployedSkills.map(s => `${s.name} (package: ${s.mlPackageName || "N/A"}, input: ${s.inputType || "N/A"}, output: ${s.outputType || "N/A"})`).join("; ");
      availNames.push(`AI Center (${deployedSkills.length} deployed ML skill(s): ${skillsList})`);
    } else if (probe.aiCenterSkills.length > 0) {
      const allSkills = probe.aiCenterSkills.map(s => `${s.name} [${s.status}]`).join("; ");
      availNames.push(`AI Center (${probe.aiCenterSkills.length} ML skill(s) found but none deployed: ${allSkills}). ${probe.aiCenterPackages.length} ML package(s) available.`);
    } else {
      availNames.push(`AI Center (available, ${probe.aiCenterPackages.length} ML package(s) found, no ML skills deployed yet)`);
    }
  } else {
    unavailRecs.push("- **AI Center**: Not available. If enabled, it could power custom ML models for classification, prediction, NLP, or anomaly detection within the automation. Deploy ML Skills in AI Center and reference them by name in the workflow.");
  }

  if (probe.flags.agents) {
    const caps = probe.agentCapabilities;
    const agentTypes: string[] = [];
    if (caps?.autonomous) agentTypes.push("autonomous");
    if (caps?.conversational) agentTypes.push("conversational");
    if (caps?.coded) agentTypes.push("coded");
    const typesStr = agentTypes.length > 0 ? ` — supported types: ${agentTypes.join(", ")}` : "";
    availNames.push(`UiPath Agents (AI agent definitions, tool bindings to Orchestrator processes, context grounding via storage buckets, escalation to Action Center${typesStr})`);
  } else {
    unavailRecs.push("- **UiPath Agents**: Not available. If enabled, it would allow deploying autonomous, conversational, and coded AI agents that can invoke Orchestrator processes as tools, use storage buckets for context grounding, and escalate to Action Center for human oversight.");
  }

  if (probe.flags.maestro) availNames.push("Maestro (BPMN process orchestration, process apps, case management, service tasks linked to Orchestrator processes, user tasks via Action Center)");
  else unavailRecs.push("- **Maestro**: Not available. If enabled, it would provide next-generation BPMN-based process orchestration — coordinating service tasks (linked to Orchestrator processes), user tasks (Action Center), gateways with conditional routing, event triggers, process apps, and case management in a single visual process model.");

  if (avail.ixp) availNames.push("IXP / Communications Mining (email and message analysis, intent detection, sentiment analysis)");
  else unavailRecs.push("- **IXP / Communications Mining**: Not available. If enabled, it could analyze emails, tickets, and messages for intent detection, sentiment analysis, and automated triage.");

  if (avail.automationHub) availNames.push("Automation Hub (idea management, ROI estimation, automation pipeline, CoE collaboration)");
  else unavailRecs.push("- **Automation Hub**: Not available. If enabled, it would centralize automation idea management, ROI estimation, and CoE collaboration for pipeline governance.");

  if (avail.automationOps) availNames.push("Automation Ops (governance policies, deployment rules, environment management)");
  else unavailRecs.push("- **Automation Ops**: Not available. If enabled, it would provide governance policies, deployment rules, and environment management for automation lifecycle control.");

  if (avail.automationStore) availNames.push("Automation Store (reusable components, workflow templates, marketplace)");
  else unavailRecs.push("- **Automation Store**: Not available. If enabled, it would offer a marketplace of reusable components and workflow templates to accelerate development.");

  if (avail.apps) availNames.push("Apps (low-code app builder, custom UIs for automations, forms and dashboards)");
  else unavailRecs.push("- **Apps**: Not available. If enabled, it would allow building custom UIs, forms, and dashboards to trigger and monitor automations without Studio.");

  if (avail.assistant) availNames.push("Assistant (robot tray, attended automation triggers, process launcher for end users)");
  else unavailRecs.push("- **Assistant**: Not available. If enabled, it would provide an end-user interface for launching attended automations and interacting with robot processes.");

  if (probe.flags.apps) availNames.push("Apps (citizen-developer UIs, form-based interfaces for human interaction, process-connected web apps)");
  else unavailRecs.push("- **Apps**: Not available. If enabled, it would allow building citizen-developer web interfaces for manual input, oversight dashboards, and human-in-the-loop form interactions directly connected to automation workflows.");

  if (probe.flags.dataService) {
    const dsIdx = availNames.findIndex(n => n.startsWith("Data Service"));
    if (dsIdx === -1) availNames.push("Data Service / Data Fabric (structured data entities, schema-driven storage, cross-process data persistence)");
  }

  if (probe.flags.automationOps && probe.governancePolicies && probe.governancePolicies.length > 0) {
    const policyNames = probe.governancePolicies.map(p => p.name).slice(0, 10).join(", ");
    availNames.push(`Automation Ops (${probe.governancePolicies.length} active governance policies: ${policyNames})`);
  }

  if (probe.attendedRobotInfo) {
    if (probe.attendedRobotInfo.hasAttended) {
      availNames.push(`Attended Robots / Assistant (${probe.attendedRobotInfo.attendedRobots.length} attended robots available for human-assisted desktop automation)`);
    }
    if (probe.attendedRobotInfo.hasUnattended) {
      availNames.push(`Unattended Robots (${probe.attendedRobotInfo.unattendedRobots.length} unattended robots for background processing)`);
    }
  }

  if (probe.studioProjectInfo && probe.studioProjectInfo.projects.length > 0) {
    const projectNames = probe.studioProjectInfo.existingNames.slice(0, 10).join(", ");
    availNames.push(`Existing Processes (${probe.studioProjectInfo.projects.length} deployed: ${projectNames})`);
  }

  let governanceContext = "";
  if (probe.governancePolicies && probe.governancePolicies.length > 0) {
    governanceContext = `\n\nGOVERNANCE COMPLIANCE (Automation Ops):\nThe following governance policies are ACTIVE and all generated artifacts MUST comply:\n`;
    for (const p of probe.governancePolicies) {
      governanceContext += `- [${p.severity.toUpperCase()}] ${p.name}: ${p.description || "No description"}`;
      if (p.restrictedActivities?.length) governanceContext += ` (restricted activities: ${p.restrictedActivities.join(", ")})`;
      if (p.requiredPatterns?.length) governanceContext += ` (required patterns: ${p.requiredPatterns.join(", ")})`;
      governanceContext += `\n`;
    }
  }

  let attendedContext = "";
  if (probe.attendedRobotInfo) {
    if (probe.attendedRobotInfo.hasAttended && probe.attendedRobotInfo.hasUnattended) {
      attendedContext = `\n\nATTENDED/UNATTENDED ROBOT LANDSCAPE:\nBoth attended (${probe.attendedRobotInfo.attendedRobots.length}) and unattended (${probe.attendedRobotInfo.unattendedRobots.length}) robots are available.\n- Use ATTENDED execution for: human-assisted tasks, desktop interaction, real-time user decisions, tasks requiring user's logged-in session\n- Use UNATTENDED execution for: scheduled background processing, high-volume transactions, tasks that run without human presence\n- Consider HYBRID: unattended for the main processing loop, attended triggers or Action Center for exception handling`;
    } else if (probe.attendedRobotInfo.hasAttended) {
      attendedContext = `\n\nATTENDED ROBOT LANDSCAPE:\nOnly attended robots (${probe.attendedRobotInfo.attendedRobots.length}) are available. Design for attended execution — the robot runs alongside the user on their workstation. Include user interaction points and desktop-aware activities.`;
    } else if (probe.attendedRobotInfo.hasUnattended) {
      attendedContext = `\n\nUNATTENDED ROBOT LANDSCAPE:\nOnly unattended robots (${probe.attendedRobotInfo.unattendedRobots.length}) are available. Design for fully autonomous background execution with no user interaction.`;
    }
  }

  let existingProcessContext = "";
  if (probe.studioProjectInfo && probe.studioProjectInfo.existingNames.length > 0) {
    existingProcessContext = `\n\nEXISTING DEPLOYED PROCESSES (avoid naming conflicts, consider reuse):\n${probe.studioProjectInfo.existingNames.map(n => `- ${n}`).join("\n")}\nWhen naming new processes, ensure unique names that don't conflict with the above. Where applicable, reference existing processes for orchestration or sub-process reuse.`;
  }

  const config = await getUiPathConfig();
  const orgTenant = config ? `${config.orgName}/${config.tenantName}` : "unknown";

  let isDiscovery: IntegrationServiceDiscovery | undefined;
  try {
    isDiscovery = await discoverIntegrationService();
    if (isDiscovery.available) {
      const activeConns = isDiscovery.connections.filter(c => c.status.toLowerCase() === "connected" || c.status.toLowerCase() === "active");
      if (activeConns.length > 0) {
        const connectorNames = [...new Set(activeConns.map(c => c.connectorName).filter(Boolean))];
        availNames.push(`Integration Service (${activeConns.length} active connection(s): ${connectorNames.join(", ")})`);
      } else if (isDiscovery.connectors.length > 0) {
        availNames.push(`Integration Service (${isDiscovery.connectors.length} connector(s) available, no active connections)`);
      }
    } else {
      unavailRecs.push("- **Integration Service**: Not available. If enabled, it provides 500+ pre-built connectors to enterprise systems (SAP, Salesforce, ServiceNow, Microsoft 365, etc.) — eliminating the need for custom HTTP activities and credential management.");
    }
  } catch (err: any) {
    console.warn(`[Integration Service] Discovery failed during capabilities check: ${err.message}`);
  }

  return {
    configured: true,
    available: avail,
    grantedScopes: probe.grantedScopes,
    summary: `Connected to ${orgTenant}. ${availNames.length} services available.`,
    availableDescription: (availNames.length > 0
      ? `The following UiPath platform services are AVAILABLE and should be used in the solution design:\n${availNames.map(n => `- ${n}`).join("\n")}`
      : "No UiPath services detected.") + governanceContext + attendedContext + existingProcessContext,
    unavailableRecommendations: unavailRecs.length > 0
      ? `The following services are NOT currently available on this tenant. Include a "Platform Recommendations" section explaining how each would enhance the solution if enabled:\n${unavailRecs.join("\n")}`
      : "All major UiPath platform services are available.",
    licenseInfo: probe.licenseInfo,
    integrationService: isDiscovery,
    aiCenterSkills: probe.aiCenterSkills,
    aiCenterPackages: probe.aiCenterPackages,
  };
}

export async function probeUiPathScopes(): Promise<{
  status: "ok" | "mismatch" | "auth_failed" | "not_configured";
  requestedScopes: string[];
  grantedScopes: string[];
  missingInApp: string[];
  extraInApp: string[];
  message: string;
}> {
  const config = await getUiPathConfig();
  if (!config) {
    return { status: "not_configured", requestedScopes: [], grantedScopes: [], missingInApp: [], extraInApp: [], message: "UiPath is not configured." };
  }

  const requestedScopes = config.scopes.split(/\s+/).filter(Boolean);

  try {
    const token = await getAccessToken(config);
    const comparison = decodeAndCompareScopes(token, requestedScopes);

    if (!comparison.decodedOk) {
      return { status: "ok", requestedScopes, grantedScopes: requestedScopes, missingInApp: [], extraInApp: [], message: "Token obtained. Could not decode granted scopes from JWT — assuming scopes are correct." };
    }

    const { grantedScopes, missingInApp, extraInApp } = comparison;

    if (missingInApp.length === 0 && extraInApp.length === 0) {
      return { status: "ok", requestedScopes, grantedScopes, missingInApp: [], extraInApp: [], message: "Scopes are in sync." };
    }

    const parts: string[] = [];
    if (missingInApp.length > 0) parts.push(`${missingInApp.length} scope(s) granted in UiPath but not selected in the app: ${missingInApp.join(", ")}`);
    if (extraInApp.length > 0) parts.push(`${extraInApp.length} scope(s) selected in the app but not granted in UiPath: ${extraInApp.join(", ")}`);
    return { status: "mismatch", requestedScopes, grantedScopes, missingInApp, extraInApp, message: parts.join(". ") };
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("invalid_scope")) {
      return { status: "auth_failed", requestedScopes, grantedScopes: [], missingInApp: [], extraInApp: requestedScopes, message: "Authentication failed due to invalid scopes. Update your selected scopes to match what's granted in UiPath Cloud." };
    }
    return { status: "auth_failed", requestedScopes, grantedScopes: [], missingInApp: [], extraInApp: [], message: `Authentication failed: ${msg}` };
  }
}

function decodeJwtScopes(token: string): string[] {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return [];
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    const scopeVal = payload.scope || payload.scp;
    if (!scopeVal) return [];
    return Array.isArray(scopeVal) ? scopeVal : scopeVal.split(/\s+/).filter(Boolean);
  } catch {
    return [];
  }
}

function decodeAndCompareScopes(token: string, requestedScopes: string[]): {
  grantedScopes: string[];
  missingInApp: string[];
  extraInApp: string[];
  decodedOk: boolean;
} {
  const grantedScopes = decodeJwtScopes(token);
  if (grantedScopes.length === 0) {
    return { grantedScopes: [], missingInApp: [], extraInApp: [], decodedOk: false };
  }
  const grantedSet = new Set(grantedScopes);
  const requestedSet = new Set(requestedScopes);
  const missingInApp = grantedScopes.filter(s => !requestedSet.has(s));
  const extraInApp = requestedScopes.filter(s => !grantedSet.has(s));
  return { grantedScopes, missingInApp, extraInApp, decodedOk: true };
}

export async function autoDetectUiPathScopes(): Promise<{
  status: "synced" | "auth_failed" | "not_configured" | "no_scopes_found";
  detectedScopes: string[];
  previousScopes: string[];
  message: string;
}> {
  const config = await getUiPathConfig();
  if (!config) {
    return { status: "not_configured", detectedScopes: [], previousScopes: [], message: "UiPath is not configured." };
  }

  const previousScopes = config.scopes.split(/\s+/).filter(Boolean);

  const ALL_KNOWN_SCOPES = [
    "OR.Default",
    "OR.Administration", "OR.Administration.Read", "OR.Administration.Write",
    "OR.Analytics", "OR.Analytics.Read", "OR.Analytics.Write",
    "OR.Assets", "OR.Assets.Read", "OR.Assets.Write",
    "OR.Audit", "OR.Audit.Read", "OR.Audit.Write",
    "OR.AutomationSolutions.Access",
    "OR.BackgroundTasks", "OR.BackgroundTasks.Read", "OR.BackgroundTasks.Write",
    "OR.Buckets", "OR.Buckets.Read", "OR.Buckets.Write",
    "OR.Execution", "OR.Execution.Read", "OR.Execution.Write",
    "OR.Folders", "OR.Folders.Read", "OR.Folders.Write",
    "OR.Hypervisor", "OR.Hypervisor.Read", "OR.Hypervisor.Write",
    "OR.Jobs", "OR.Jobs.Read", "OR.Jobs.Write",
    "OR.License", "OR.License.Read", "OR.License.Write",
    "OR.Machines", "OR.Machines.Read", "OR.Machines.Write",
    "OR.ML", "OR.ML.Read", "OR.ML.Write",
    "OR.Monitoring", "OR.Monitoring.Read", "OR.Monitoring.Write",
    "OR.Queues", "OR.Queues.Read", "OR.Queues.Write",
    "OR.Robots", "OR.Robots.Read", "OR.Robots.Write",
    "OR.Settings", "OR.Settings.Read", "OR.Settings.Write",
    "OR.Tasks", "OR.Tasks.Read", "OR.Tasks.Write",
    "OR.TestDataQueues", "OR.TestDataQueues.Read", "OR.TestDataQueues.Write",
    "OR.TestSetExecutions", "OR.TestSetExecutions.Read", "OR.TestSetExecutions.Write",
    "OR.TestSets", "OR.TestSets.Read", "OR.TestSets.Write",
    "OR.TestSetSchedules", "OR.TestSetSchedules.Read", "OR.TestSetSchedules.Write",
    "OR.Users", "OR.Users.Read", "OR.Users.Write",
    "OR.Webhooks", "OR.Webhooks.Read", "OR.Webhooks.Write",
  ];

  let token: string | null = null;

  try {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: ALL_KNOWN_SCOPES.join(" "),
    });
    const res = await fetch("https://cloud.uipath.com/identity_/connect/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    if (res.ok) {
      const data = await res.json();
      token = data.access_token;
    }
  } catch {}

  if (!token) {
    for (const tryScope of ["OR.Administration", "OR.Default"]) {
      try {
        const params = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: tryScope,
        });
        const res = await fetch("https://cloud.uipath.com/identity_/connect/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        if (res.ok) {
          const data = await res.json();
          token = data.access_token;
          break;
        }
      } catch {}
    }
  }

  if (!token) {
    return {
      status: "auth_failed",
      detectedScopes: [],
      previousScopes,
      message: "Could not authenticate with UiPath. Verify your App ID and Secret are correct.",
    };
  }

  const detectedScopes = decodeJwtScopes(token);
  if (detectedScopes.length === 0) {
    return {
      status: "no_scopes_found",
      detectedScopes: [],
      previousScopes,
      message: "Authenticated successfully but could not extract scopes from the JWT token.",
    };
  }

  const orScopes = detectedScopes.filter(s => s.startsWith("OR."));
  const scopeString = orScopes.join(" ");
  await upsertSetting("uipath_scopes", scopeString);

  return {
    status: "synced",
    detectedScopes,
    previousScopes,
    message: `Auto-detected and saved ${orScopes.length} OR scopes from UiPath. TM scopes are requested separately (UiPath requires separate tokens per resource).`,
  };
}

export async function verifyUiPathScopes(): Promise<{ success: boolean; requestedScopes: string[]; grantedScopes: string[]; message: string; services?: Record<string, { available: boolean; message: string }> }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, requestedScopes: [], grantedScopes: [], message: "UiPath is not configured." };
  }

  try {
    const { tryAcquireResourceToken } = await import("./uipath-auth");

    const resourceResults = await Promise.allSettled([
      tryAcquireResourceToken("OR"),
      tryAcquireResourceToken("TM"),
      tryAcquireResourceToken("DU"),
      tryAcquireResourceToken("PM"),
      tryAcquireResourceToken("DF"),
      tryAcquireResourceToken("PIMS"),
      tryAcquireResourceToken("IXP"),
      tryAcquireResourceToken("AI"),
    ]);

    const resources: Record<string, { ok: boolean; scopes: string[]; error?: string }> = {};
    const resourceNames: Array<"OR" | "TM" | "DU" | "PM" | "DF" | "PIMS" | "IXP" | "AI"> = ["OR", "TM", "DU", "PM", "DF", "PIMS", "IXP", "AI"];
    for (let i = 0; i < resourceNames.length; i++) {
      const r = resourceResults[i];
      resources[resourceNames[i]] = r.status === "fulfilled" ? r.value : { ok: false, scopes: [], error: "Token request failed" };
    }

    const allGrantedScopes: string[] = [];
    const scopeSummary: string[] = [];
    for (const [name, res] of Object.entries(resources)) {
      if (res.ok && res.scopes.length > 0) {
        allGrantedScopes.push(...res.scopes);
        scopeSummary.push(`${name}=${res.scopes.length}`);
      } else if (!res.ok) {
        scopeSummary.push(`${name}=unavailable`);
      } else {
        scopeSummary.push(`${name}=0`);
      }
    }

    const requestedScopes = config.scopes.split(/\s+/).filter(Boolean);

    const probe = await probeAllServices();

    const serviceChecks: Record<string, { available: boolean; message: string }> = {};

    serviceChecks["Orchestrator"] = probe.flags.orchestrator
      ? { available: true, message: "Connected" }
      : { available: false, message: "Not accessible" };

    serviceChecks["Storage Buckets"] = probe.flags.storageBuckets
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible — may need OR.Blobs scope" };

    serviceChecks["Action Center (Maestro)"] = probe.flags.actionCenter
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible" };

    serviceChecks["Test Manager"] = probe.flags.testManager
      ? { available: true, message: `TM available (token: ${resources.TM.ok ? "acquired" : "unavailable"})` }
      : { available: false, message: `TM token unavailable: ${resources.TM.error || "scopes not configured"}` };

    serviceChecks["Document Understanding"] = probe.flags.documentUnderstanding
      ? { available: true, message: "Accessible" }
      : { available: false, message: `DU unavailable: ${resources.DU.error || "scopes not configured"}` };

    serviceChecks["Platform Management"] = probe.flags.platformManagement
      ? { available: true, message: `Token acquired` }
      : { available: false, message: `PM token unavailable: ${resources.PM.error || "scopes not configured"}` };

    serviceChecks["Data Service"] = probe.flags.dataService
      ? { available: true, message: "Data Service provisioned" }
      : { available: false, message: `DF unavailable: ${resources.DF.error || "scopes not configured"}` };

    serviceChecks["Maestro"] = probe.flags.maestro
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible — PIMS scope may be needed" };

    try {
      const isDiscovery = await discoverIntegrationService();
      const activeConns = isDiscovery.connections.filter(c => c.status.toLowerCase() === "connected" || c.status.toLowerCase() === "active");
      serviceChecks["Integration Service"] = isDiscovery.available
        ? { available: true, message: `${isDiscovery.connectors.length} connector(s), ${activeConns.length} active connection(s)` }
        : { available: false, message: "Integration Service not accessible" };
    } catch {
      serviceChecks["Integration Service"] = probe.flags.integrationService
        ? { available: true, message: "Accessible" }
        : { available: false, message: "Could not probe Integration Service" };
    }

    serviceChecks["IXP / Communications Mining"] = probe.flags.ixp
      ? { available: true, message: resources.IXP?.ok ? "Accessible (IXP scope granted)" : "Reachable — grant Ixp.ApiAccess scope for full access" }
      : { available: false, message: `Not accessible — ${resources.IXP?.ok ? "provisioning issue" : "Ixp.ApiAccess scope may be needed"}` };

    serviceChecks["Automation Hub"] = probe.flags.automationHub
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible or not provisioned" };

    serviceChecks["Automation Ops"] = probe.flags.automationOps
      ? { available: true, message: `Accessible — ${probe.governancePolicies?.length ?? 0} governance policies active` }
      : { available: false, message: "Not accessible or not provisioned" };

    serviceChecks["Automation Store"] = probe.flags.automationStore
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible or not provisioned" };

    serviceChecks["Apps"] = probe.flags.apps
      ? { available: true, message: "Accessible" }
      : { available: false, message: "No external API access — Apps API is not publicly exposed" };

    serviceChecks["Assistant"] = probe.flags.assistant
      ? { available: true, message: "Accessible" }
      : { available: false, message: "Not accessible or not provisioned" };

    if (probe.flags.aiCenter) {
      const deployed = probe.aiCenterSkills.filter(s => s.status.toLowerCase() === "deployed" || s.status.toLowerCase() === "available");
      serviceChecks["AI Center"] = {
        available: true,
        message: deployed.length > 0
          ? `${deployed.length} ML skill(s) deployed: ${deployed.map(s => s.name).join(", ")}`
          : `Available (${probe.aiCenterPackages.length} packages, no skills deployed)`,
      };
    } else {
      serviceChecks["AI Center"] = { available: false, message: `Not accessible — ${resources.AI?.ok ? "provisioning issue" : "AI Center scopes may be needed"}` };
    }

    serviceChecks["Attended Robots"] = probe.flags.attendedRobots
      ? { available: true, message: `${probe.attendedRobotInfo?.attendedRobots.length ?? 0} attended robots discovered` }
      : { available: false, message: "No attended robots found" };

    serviceChecks["Studio Projects"] = probe.flags.studioProjects
      ? { available: true, message: `${probe.studioProjectInfo?.projects.length ?? 0} existing processes` }
      : { available: false, message: "No existing processes found" };

    const availableCount = Object.values(serviceChecks).filter(s => s.available).length;
    const totalCount = Object.keys(serviceChecks).length;

    return {
      success: true,
      requestedScopes,
      grantedScopes: allGrantedScopes,
      message: `${availableCount}/${totalCount} services accessible. Scopes: ${scopeSummary.join(", ")} (separate tokens per UiPath resource).`,
      services: serviceChecks,
    };
  } catch (err: any) {
    const msg = err.message || String(err);
    return { success: false, requestedScopes: config.scopes.split(/\s+/), grantedScopes: [], message: `Authentication failed: ${msg}` };
  }
}

export type ServiceAvailabilityMap = {
  configured: boolean;
  orchestrator: boolean;
  actionCenter: boolean;
  testManager: boolean;
  documentUnderstanding: boolean;
  generativeExtraction: boolean;
  communicationsMining: boolean;
  dataService: boolean;
  platformManagement: boolean;
  environments: boolean;
  triggers: boolean;
  agents: boolean;
  agentCapabilities?: { autonomous: boolean; conversational: boolean; coded: boolean };
  maestro: boolean;
  integrationService: boolean;
  integrationServiceDiscovery?: IntegrationServiceDiscovery;
  ixp: boolean;
  automationHub: boolean;
  automationOps: boolean;
  automationStore: boolean;
  apps: boolean;
  assistant: boolean;
  aiCenter?: boolean;
  aiCenterSkills?: AICenterSkill[];
  aiCenterPackages?: AICenterPackage[];
  attendedRobots: boolean;
  studioProjects: boolean;
  governancePolicies?: GovernancePolicy[];
  attendedRobotInfo?: AttendedRobotInfo;
  studioProjectInfo?: StudioProcessesResult;
};

export async function probeServiceAvailability(): Promise<ServiceAvailabilityMap> {
  const probe = await probeAllServices();
  let isDiscovery: IntegrationServiceDiscovery | undefined;
  try {
    isDiscovery = await discoverIntegrationService();
  } catch (err: any) {
    console.warn(`[Integration Service] Discovery failed during service probe: ${err.message}`);
  }
  return {
    configured: probe.configured,
    orchestrator: probe.flags.orchestrator,
    actionCenter: probe.flags.actionCenter,
    testManager: probe.flags.testManager,
    documentUnderstanding: probe.flags.documentUnderstanding,
    generativeExtraction: probe.flags.generativeExtraction,
    communicationsMining: probe.flags.communicationsMining,
    dataService: probe.flags.dataService,
    platformManagement: probe.flags.platformManagement,
    environments: probe.flags.environments,
    triggers: probe.flags.triggers,
    agents: probe.flags.agents,
    agentCapabilities: probe.agentCapabilities,
    maestro: probe.flags.maestro,
    integrationService: probe.flags.integrationService,
    integrationServiceDiscovery: isDiscovery,
    ixp: probe.flags.ixp,
    automationHub: probe.flags.automationHub,
    automationOps: probe.flags.automationOps,
    automationStore: probe.flags.automationStore,
    apps: probe.flags.apps,
    assistant: probe.flags.assistant,
    aiCenter: probe.flags.aiCenter,
    aiCenterSkills: probe.aiCenterSkills,
    aiCenterPackages: probe.aiCenterPackages,
    attendedRobots: probe.flags.attendedRobots,
    studioProjects: probe.flags.studioProjects,
    governancePolicies: probe.governancePolicies,
    attendedRobotInfo: probe.attendedRobotInfo,
    studioProjectInfo: probe.studioProjectInfo,
  };
}

export async function getAICenterSkills(): Promise<{ available: boolean; skills: AICenterSkill[]; packages: AICenterPackage[] }> {
  const probe = await probeAllServices();
  return {
    available: probe.flags.aiCenter,
    skills: probe.aiCenterSkills,
    packages: probe.aiCenterPackages,
  };
}

export type IntegrationServiceConnector = {
  id: string;
  name: string;
  description?: string;
  provider?: string;
  iconUrl?: string;
  connectionCount: number;
};

export type IntegrationServiceConnection = {
  id: string;
  connectorId: string;
  connectorName: string;
  name: string;
  status: string;
  createdAt?: string;
  provider?: string;
};

export type IntegrationServiceDiscovery = {
  available: boolean;
  connectors: IntegrationServiceConnector[];
  connections: IntegrationServiceConnection[];
  summary: string;
};

let _isDiscoveryCache: IntegrationServiceDiscovery | null = null;
const IS_CACHE_TTL_MS = 120_000;
let _isCacheAt = 0;

export function clearIntegrationServiceCache(): void {
  _isDiscoveryCache = null;
  _isCacheAt = 0;
}

function sanitizeConnectorString(s: string): string {
  return s.replace(/[<>\[\]{}|\\`]/g, "").slice(0, 100).trim();
}

export async function discoverIntegrationService(): Promise<IntegrationServiceDiscovery> {
  if (_isDiscoveryCache && Date.now() - _isCacheAt < IS_CACHE_TTL_MS) {
    return _isDiscoveryCache;
  }

  const empty: IntegrationServiceDiscovery = {
    available: false,
    connectors: [],
    connections: [],
    summary: "Integration Service is not available.",
  };

  const config = await getUiPathConfig();
  if (!config) return empty;

  try {
    const token = await getAccessToken(config);
    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const hdrs: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const connectorsUrl = `${base}/integrationservice_/api/ConnectorDefinitions?$top=100`;
    const connectionsUrl = `${base}/integrationservice_/api/Connections?$top=100`;

    const [connectorRes, connectionRes] = await Promise.allSettled([
      fetch(connectorsUrl, { headers: hdrs }),
      fetch(connectionsUrl, { headers: hdrs }),
    ]);

    const connectors: IntegrationServiceConnector[] = [];
    const connections: IntegrationServiceConnection[] = [];

    if (connectorRes.status === "fulfilled" && connectorRes.value.ok) {
      try {
        const data = await connectorRes.value.json();
        const items = data.value || data.items || data || [];
        if (Array.isArray(items)) {
          for (const c of items) {
            connectors.push({
              id: String(c.id || c.Id || "").slice(0, 100),
              name: sanitizeConnectorString(c.name || c.Name || c.displayName || c.DisplayName || ""),
              description: sanitizeConnectorString(c.description || c.Description || "") || undefined,
              provider: sanitizeConnectorString(c.provider || c.Provider || "") || undefined,
              iconUrl: c.iconUrl || c.IconUrl || undefined,
              connectionCount: c.connectionCount || c.ConnectionCount || 0,
            });
          }
        }
      } catch (e) {
        console.warn("[Integration Service] Failed to parse connectors response:", e);
      }
    } else {
      const status = connectorRes.status === "fulfilled" ? connectorRes.value.status : "error";
      console.log(`[Integration Service] Connectors endpoint returned ${status}`);
    }

    if (connectionRes.status === "fulfilled" && connectionRes.value.ok) {
      try {
        const data = await connectionRes.value.json();
        const items = data.value || data.items || data || [];
        if (Array.isArray(items)) {
          for (const c of items) {
            connections.push({
              id: String(c.id || c.Id || "").slice(0, 100),
              connectorId: String(c.connectorId || c.ConnectorId || c.connectorDefinitionId || c.ConnectorDefinitionId || "").slice(0, 100),
              connectorName: sanitizeConnectorString(c.connectorName || c.ConnectorName || c.connectorDisplayName || c.ConnectorDisplayName || ""),
              name: sanitizeConnectorString(c.name || c.Name || c.displayName || c.DisplayName || ""),
              status: sanitizeConnectorString(c.status || c.Status || "unknown"),
              createdAt: c.createdAt || c.CreatedAt || undefined,
              provider: sanitizeConnectorString(c.provider || c.Provider || "") || undefined,
            });
          }
        }
      } catch (e) {
        console.warn("[Integration Service] Failed to parse connections response:", e);
      }
    } else {
      const status = connectionRes.status === "fulfilled" ? connectionRes.value.status : "error";
      console.log(`[Integration Service] Connections endpoint returned ${status}`);
    }

    const isAvailable = connectors.length > 0 || connections.length > 0 ||
      (connectorRes.status === "fulfilled" && connectorRes.value.ok) ||
      (connectionRes.status === "fulfilled" && connectionRes.value.ok);

    const activeConnections = connections.filter(c => c.status.toLowerCase() === "connected" || c.status.toLowerCase() === "active");
    const connectorNames = [...new Set(activeConnections.map(c => c.connectorName).filter(Boolean))];

    let summary = "";
    if (isAvailable) {
      summary = `Integration Service: ${connectors.length} connector(s) available, ${activeConnections.length} active connection(s)`;
      if (connectorNames.length > 0) {
        summary += ` (${connectorNames.join(", ")})`;
      }
    } else {
      summary = "Integration Service is not available or has no connectors configured.";
    }

    const result: IntegrationServiceDiscovery = {
      available: isAvailable,
      connectors,
      connections,
      summary,
    };

    _isDiscoveryCache = result;
    _isCacheAt = Date.now();
    console.log(`[Integration Service] Discovery complete — ${summary}`);
    return result;
  } catch (err: any) {
    console.warn(`[Integration Service] Discovery failed: ${err.message}`);
    return empty;
  }
}

export async function testUiPathConnection(): Promise<{ success: boolean; message: string; errorType?: string }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath Orchestrator is not configured.", errorType: "not_configured" };
  }

  try {
    const token = await getAccessToken(config);
    const foldersUrl = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}/orchestrator_/odata/Folders?$top=1`;
    const res = await fetch(foldersUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403) {
        return { success: false, message: "Access denied. The App ID may not have the required scopes granted. Check your External Application settings in UiPath Cloud and ensure the correct scopes are selected.", errorType: "forbidden" };
      }
      if (res.status === 404) {
        return { success: false, message: "Organization or Tenant not found. Double-check the Organization Name and Tenant Name match your UiPath Cloud URL exactly.", errorType: "not_found" };
      }
      return { success: false, message: `Connection failed (${res.status}): ${errText.slice(0, 200)}`, errorType: "unknown" };
    }
    await recordLastTestedAt();
    return { success: true, message: "Connected to UiPath Orchestrator successfully." };
  } catch (err: any) {
    const msg = err.message || String(err);
    if (msg.includes("invalid_scope")) {
      return { success: false, message: "Invalid scopes. The scopes you selected must match the scopes granted to your External Application in UiPath Cloud. Go to Admin > External Applications, edit your app, and verify the selected scopes.", errorType: "invalid_scope" };
    }
    if (msg.includes("invalid_client")) {
      return { success: false, message: "Invalid App ID or App Secret. Verify your credentials are correct. You may need to regenerate the App Secret in UiPath Cloud.", errorType: "invalid_client" };
    }
    return { success: false, message: `Connection failed: ${msg}`, errorType: "unknown" };
  }
}
