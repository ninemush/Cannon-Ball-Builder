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
} from "./xaml-generator";
import { enrichWithAI, type EnrichmentResult } from "./ai-xaml-enricher";

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
  const rows = await db.select().from(appSettings).where(
    eq(appSettings.key, "uipath_org_name")
  );
  if (rows.length === 0) return null;

  const all = await db.select().from(appSettings);
  const map = new Map(all.map((r) => [r.key, r.value]));

  const orgName = map.get("uipath_org_name");
  const tenantName = map.get("uipath_tenant_name");
  const clientId = map.get("uipath_client_id");
  const clientSecret = map.get("uipath_client_secret");
  const scopes = map.get("uipath_scopes") || "OR.Default OR.Administration";
  const folderId = map.get("uipath_folder_id") || undefined;
  const folderName = map.get("uipath_folder_name") || undefined;

  if (!orgName || !tenantName || !clientId || !clientSecret) return null;

  return { orgName, tenantName, clientId, clientSecret, scopes, folderId, folderName };
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

async function buildNuGetPackage(pkg: any, version: string = "1.0.0"): Promise<{ buffer: Buffer; gaps: XamlGap[]; usedPackages: string[] }> {
  const projectName = (pkg.projectName || "Automation").replace(/\s+/g, "_");
  const sddContent = pkg._sddContent || "";
  const orchestratorArtifacts = pkg._orchestratorArtifacts || null;
  const processNodes = pkg._processNodes || [];
  const processEdges = pkg._processEdges || [];

  let enrichment: EnrichmentResult | null = null;
  if (processNodes.length > 0 && sddContent) {
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

  return new Promise<{ buffer: Buffer; gaps: XamlGap[]; usedPackages: string[] }>((resolve, reject) => {
    const buffers: Buffer[] = [];
    const passthrough = new PassThrough();
    passthrough.on("data", (chunk: Buffer) => buffers.push(chunk));
    passthrough.on("end", () => resolve({ buffer: Buffer.concat(buffers), gaps: allGaps, usedPackages: allUsedPkgs }));
    passthrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(passthrough);

    const libPath = "lib/net45";
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

    const deps: Record<string, string> = {
      "UiPath.System.Activities": "[23.10.0]",
      "UiPath.UIAutomation.Activities": "[23.10.0]",
      "UiPath.Web.Activities": "[1.18.0]",
    };
    if (pkg.dependencies) {
      for (const d of pkg.dependencies) {
        if (!deps[d]) deps[d] = "*";
      }
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
            enrichment
          );
          xamlResults.push(result);
          archive.append(makeUiPathCompliant(result.xaml), { name: `${libPath}/${wfName}.xaml` });
          if (wfName === "Main") hasMain = true;
          console.log(`[UiPath] Generated decomposed workflow "${wfName}": ${decompNodes.length} nodes, ${result.gaps.length} gaps`);
        }
      }
    }

    for (const wf of workflows) {
      const wfName = (wf.name || "Workflow").replace(/\s+/g, "_");
      const result = generateRichXamlFromSpec(wf, sddContent || undefined);
      xamlResults.push(result);
      archive.append(makeUiPathCompliant(result.xaml), { name: `${libPath}/${wfName}.xaml` });
      if (wfName === "Main") hasMain = true;
      console.log(`[UiPath] Generated rich XAML for "${wfName}": ${result.gaps.length} gaps, ${result.usedPackages.length} packages`);
    }

    if (!hasMain && processNodes.length > 0 && !enrichment?.decomposition?.length) {
      const processResult = generateRichXamlFromNodes(
        processNodes,
        processEdges,
        useReFramework ? "Process" : projectName,
        pkg.description || "",
        enrichment
      );
      xamlResults.push(processResult);
      const processFileName = useReFramework ? "Process" : projectName;
      archive.append(makeUiPathCompliant(processResult.xaml), { name: `${libPath}/${processFileName}.xaml` });
      console.log(`[UiPath] Generated process XAML from ${processNodes.length} map nodes: ${processResult.gaps.length} gaps`);
    }

    const initXaml = generateInitAllSettingsXaml(orchestratorArtifacts);
    archive.append(makeUiPathCompliant(initXaml), { name: `${libPath}/InitAllSettings.xaml` });

    if (useReFramework && !hasMain) {
      console.log(`[UiPath] Generating REFramework structure (queue: ${queueName})`);
      const mainXaml = generateReframeworkMainXaml(projectName, queueName);
      archive.append(makeUiPathCompliant(mainXaml), { name: `${libPath}/Main.xaml` });
      hasMain = true;

      const getTransXaml = generateGetTransactionDataXaml(queueName);
      archive.append(makeUiPathCompliant(getTransXaml), { name: `${libPath}/GetTransactionData.xaml` });

      const setStatusXaml = generateSetTransactionStatusXaml();
      archive.append(makeUiPathCompliant(setStatusXaml), { name: `${libPath}/SetTransactionStatus.xaml` });

      const closeAppsXaml = generateCloseAllApplicationsXaml();
      archive.append(makeUiPathCompliant(closeAppsXaml), { name: `${libPath}/CloseAllApplications.xaml` });

      const killXaml = generateKillAllProcessesXaml();
      archive.append(makeUiPathCompliant(killXaml), { name: `${libPath}/KillAllProcesses.xaml` });
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

      const closeAppsXaml = generateCloseAllApplicationsXaml();
      archive.append(makeUiPathCompliant(closeAppsXaml), { name: `${libPath}/CloseAllApplications.xaml` });

      const mainXaml = buildXaml("Main", `${projectName} - Main Workflow`, mainActivities);
      archive.append(makeUiPathCompliant(mainXaml), { name: `${libPath}/Main.xaml` });
    }

    const configCsv = generateConfigXlsx(pkg, sddContent || undefined, orchestratorArtifacts);
    archive.append(configCsv, { name: `${libPath}/Data/Config.xlsx` });

    const richPackages = aggregatePackages(xamlResults);
    const packageVersionMap: Record<string, string> = {
      "UiPath.System.Activities": "[23.10.0]",
      "UiPath.UIAutomation.Activities": "[23.10.0]",
      "UiPath.Web.Activities": "[1.18.0]",
      "UiPath.Excel.Activities": "[2.22.0]",
      "UiPath.Mail.Activities": "[1.20.0]",
      "UiPath.Database.Activities": "[1.8.0]",
    };
    for (const rp of richPackages) {
      if (!deps[rp]) {
        deps[rp] = packageVersionMap[rp] || "*";
      }
    }

    if (!deps["UiPath.Excel.Activities"]) {
      deps["UiPath.Excel.Activities"] = "[2.22.0]";
    }

    const allGaps = aggregateGaps(xamlResults);
    const allUsedPkgs = Object.keys(deps);

    const entryPointId = generateUuid();
    const projectJson = {
      name: projectName,
      description: pkg.description || "",
      main: "Main.xaml",
      dependencies: deps,
      webServices: [],
      entitiesStores: [],
      schemaVersion: "4.0",
      studioVersion: "23.10.0",
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
        projectProfile: "Developement",
        outputType: "Process",
        libraryOptions: { includeOriginalXaml: false, privateWorkflows: [] },
        processOptions: { ignoredFiles: [] },
        fileInfoCollection: [],
        modernBehavior: false,
      },
      expressionLanguage: "VisualBasic",
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
    });
    archive.append(dhg, { name: `${libPath}/DeveloperHandoffGuide.md` });
    console.log(`[UiPath] Generated Developer Handoff Guide: ${allGaps.length} gaps, ~${(allGaps.reduce((s: number, g: XamlGap) => s + g.estimatedMinutes, 0) / 60).toFixed(1)}h effort, REFramework=${useReFramework}`);

    archive.finalize();
  });
}

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

async function uploadToOrchestrator(
  config: UiPathConfig,
  token: string,
  pkg: any,
  projectName: string,
  version: string
): Promise<{ ok: boolean; status: number; responseText: string; gaps: XamlGap[] }> {
  const buildResult = await buildNuGetPackage(pkg, version);
  const nupkgBuffer = buildResult.buffer;
  console.log(`[UiPath] Built .nupkg for "${projectName}" v${version} — ${nupkgBuffer.length} bytes (${buildResult.gaps.length} gaps, ${buildResult.usedPackages.length} packages)`);

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

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body,
  });

  const responseText = await uploadRes.text();
  console.log(`[UiPath] Upload response status: ${uploadRes.status}`);
  console.log(`[UiPath] Upload response body: ${responseText.slice(0, 1000)}`);

  return { ok: uploadRes.ok, status: uploadRes.status, responseText, gaps: buildResult.gaps };
}

export async function pushToUiPath(pkg: any): Promise<{ success: boolean; message: string; details?: any }> {
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
    let result = await uploadToOrchestrator(config, token, pkg, projectName, version);

    if (result.status === 409) {
      const hourMin = now.getHours() * 100 + now.getMinutes();
      version = `1.${hourMin}.${patch}`;
      console.log(`[UiPath] Version conflict — retrying with v${version}`);
      result = await uploadToOrchestrator(config, token, pkg, projectName, version);
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
    testManager: boolean;
    storageBuckets: boolean;
    aiCenter: boolean;
  };
  grantedScopes: string[];
  summary: string;
  availableDescription: string;
  unavailableRecommendations: string;
  licenseInfo?: LicenseInfo | null;
};

export async function getPlatformCapabilities(): Promise<PlatformCapabilityProfile> {
  const empty: PlatformCapabilityProfile = {
    configured: false,
    available: { orchestrator: false, actionCenter: false, documentUnderstanding: false, testManager: false, storageBuckets: false, aiCenter: false },
    grantedScopes: [],
    summary: "UiPath is not configured. The SDD will be generated with general best practices.",
    availableDescription: "",
    unavailableRecommendations: "",
  };

  const config = await getUiPathConfig();
  if (!config) return empty;

  try {
    const token = await getAccessToken(config);
    let grantedScopes: string[] = [];
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        const scopeVal = payload.scope || payload.scp;
        if (scopeVal) grantedScopes = Array.isArray(scopeVal) ? scopeVal : scopeVal.split(/\s+/);
      }
    } catch { grantedScopes = config.scopes.split(/\s+/); }

    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const orchBase = `${base}/orchestrator_`;
    const hdrs: Record<string, string> = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    if (config.folderId) hdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;

    const probe = async (url: string): Promise<boolean> => {
      try { const r = await fetch(url, { headers: hdrs }); return r.ok; } catch { return false; }
    };

    const [orchOk, bucketOk, taskOk, tm1Ok, tm2Ok, duOk, aiOk, licenseInfo] = await Promise.all([
      probe(`${orchBase}/odata/Folders?$top=1`),
      probe(`${orchBase}/odata/Buckets?$top=1`),
      probe(`${orchBase}/odata/TaskCatalogs?$top=1`),
      probe(`${base}/testmanager_/api/v2/projects?$top=1`),
      probe(`${base}/tmapi_/api/v2/projects?$top=1`),
      probe(`${base}/du_/api/framework/projects?$top=1`),
      probe(`${base}/aifabric_/ai-deployer/v1/projects?$top=1`),
      fetchLicenseInfo(orchBase, hdrs),
    ]);

    const avail = {
      orchestrator: orchOk,
      actionCenter: taskOk,
      documentUnderstanding: duOk || aiOk,
      testManager: tm1Ok || tm2Ok,
      storageBuckets: bucketOk,
      aiCenter: aiOk,
    };

    const availNames: string[] = [];
    const unavailRecs: string[] = [];

    if (avail.orchestrator) availNames.push("UiPath Orchestrator (queues, assets, triggers, machines, environments, processes, jobs)");
    else unavailRecs.push("- **Orchestrator**: Core service not accessible. Verify connection credentials.");

    if (avail.actionCenter) availNames.push("Action Center (human-in-the-loop tasks, approvals, escalations, SLA management)");
    else unavailRecs.push("- **Action Center**: Not available. If enabled, it would allow human-in-the-loop steps — approvals, validations, exception handling escalations — directly within the automation workflow instead of external email/chat processes.");

    if (avail.documentUnderstanding) availNames.push("Document Understanding (intelligent document processing, OCR, ML classification, data extraction)");
    else unavailRecs.push("- **Document Understanding**: Not available. If enabled, it could automate document classification, data extraction from invoices/forms/contracts using ML models instead of manual data entry or rigid template-based parsing.");

    if (avail.testManager) availNames.push("Test Manager (automated test projects, test cases, test execution, regression suites)");
    else unavailRecs.push("- **Test Manager**: Not available. If enabled, it would allow automated test case management and regression testing for the automation, ensuring quality across updates.");

    if (avail.storageBuckets) availNames.push("Storage Buckets (file storage for input/output documents, templates, logs)");
    else unavailRecs.push("- **Storage Buckets**: Not available. If enabled, it could provide centralized cloud storage for automation input files, output documents, templates, and audit logs.");

    if (avail.aiCenter) availNames.push("AI Center (custom ML models, model training, AI skill deployment)");
    else unavailRecs.push("- **AI Center**: Not available. If enabled, it could power custom ML models for classification, prediction, or NLP tasks within the automation.");

    const profile: PlatformCapabilityProfile = {
      configured: true,
      available: avail,
      grantedScopes,
      summary: `Connected to ${config.orgName}/${config.tenantName}. ${availNames.length} services available.`,
      availableDescription: availNames.length > 0
        ? `The following UiPath platform services are AVAILABLE and should be used in the solution design:\n${availNames.map(n => `- ${n}`).join("\n")}`
        : "No UiPath services detected.",
      unavailableRecommendations: unavailRecs.length > 0
        ? `The following services are NOT currently available on this tenant. Include a "Platform Recommendations" section explaining how each would enhance the solution if enabled:\n${unavailRecs.join("\n")}`
        : "All major UiPath platform services are available.",
      licenseInfo,
    };

    return profile;
  } catch (err: any) {
    return { ...empty, summary: `Could not probe UiPath platform: ${err.message}. SDD will use general best practices.` };
  }
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
    let grantedScopes: string[] = [];
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
        const scopeVal = payload.scope || payload.scp;
        if (scopeVal) grantedScopes = Array.isArray(scopeVal) ? scopeVal : scopeVal.split(/\s+/);
      }
    } catch { grantedScopes = []; }

    if (grantedScopes.length === 0) {
      return { status: "ok", requestedScopes, grantedScopes: requestedScopes, missingInApp: [], extraInApp: [], message: "Token obtained. Could not decode granted scopes from JWT — assuming scopes are correct." };
    }

    const grantedSet = new Set(grantedScopes);
    const requestedSet = new Set(requestedScopes);
    const missingInApp = grantedScopes.filter(s => !requestedSet.has(s));
    const extraInApp = requestedScopes.filter(s => !grantedSet.has(s));

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
    const { tryAcquireResourceToken, getToken, getHeaders: getOrHeaders } = await import("./uipath-auth");

    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const orchBase = `${base}/orchestrator_`;

    const resourceResults = await Promise.allSettled([
      tryAcquireResourceToken("OR"),
      tryAcquireResourceToken("TM"),
      tryAcquireResourceToken("DU"),
      tryAcquireResourceToken("PM"),
      tryAcquireResourceToken("DF"),
    ]);

    const resources: Record<string, { ok: boolean; scopes: string[]; error?: string }> = {};
    const resourceNames: Array<"OR" | "TM" | "DU" | "PM" | "DF"> = ["OR", "TM", "DU", "PM", "DF"];
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
    const hdrs = await getOrHeaders();

    const serviceChecks: Record<string, { available: boolean; message: string }> = {};

    const orchRes = await fetch(`${orchBase}/odata/Folders?$top=1`, { headers: hdrs });
    serviceChecks["Orchestrator"] = orchRes.ok
      ? { available: true, message: "Connected" }
      : { available: false, message: `HTTP ${orchRes.status}` };

    const blobRes = await fetch(`${orchBase}/odata/Buckets?$top=1`, { headers: hdrs });
    serviceChecks["Storage Buckets"] = blobRes.ok
      ? { available: true, message: "Accessible" }
      : { available: false, message: `HTTP ${blobRes.status} — may need OR.Blobs scope` };

    const taskCatRes = await fetch(`${orchBase}/odata/TaskCatalogs?$top=1`, { headers: hdrs });
    serviceChecks["Action Center (Maestro)"] = taskCatRes.ok
      ? { available: true, message: "Accessible" }
      : { available: false, message: `HTTP ${taskCatRes.status} — Action Center may not be enabled or needs OR.Tasks scope` };

    if (resources.TM.ok) {
      const { getTmToken } = await import("./uipath-auth");
      const tmTok = await getTmToken();
      const tmHdrs = { Authorization: `Bearer ${tmTok}`, "Content-Type": "application/json" };
      let tmAvailable = false;
      let tmMsg = "";
      for (const tmUrl of [`${base}/testmanager_/api/v2/projects?$top=1`, `${base}/tmapi_/api/v2/projects?$top=1`]) {
        try {
          const tmRes = await fetch(tmUrl, { headers: tmHdrs });
          if (tmRes.ok) { tmAvailable = true; tmMsg = "Accessible (TM token)"; break; }
          if (tmRes.status === 401 || tmRes.status === 403) { tmAvailable = true; tmMsg = `Available (HTTP ${tmRes.status} — needs permissions)`; break; }
          tmMsg = `HTTP ${tmRes.status}`;
        } catch { tmMsg = "Not reachable"; }
      }
      if (!tmAvailable) {
        const orchTmRes = await fetch(`${orchBase}/odata/TestSets?$top=1`, { headers: hdrs }).catch(() => null);
        if (orchTmRes?.ok) { tmAvailable = true; tmMsg = "Accessible (via Orchestrator OData)"; }
      }
      serviceChecks["Test Manager"] = { available: tmAvailable, message: tmAvailable ? tmMsg : `Not available (${tmMsg})` };
    } else {
      serviceChecks["Test Manager"] = { available: false, message: `TM token unavailable: ${resources.TM.error || "scopes not configured"}` };
    }

    if (resources.DU.ok) {
      const { getDuToken } = await import("./uipath-auth");
      const duTok = await getDuToken();
      const duHdrs: Record<string, string> = { Authorization: `Bearer ${duTok}`, "Content-Type": "application/json" };
      if (config.folderId) duHdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;

      let duAvailable = false;
      let duMsg = "";
      for (const [ep, label] of [
        [`${base}/du_/api/framework/projects?api-version=1`, "DU Framework API v1"],
        [`${base}/du_/api/framework/projects?api-version=2`, "DU Framework API v2"],
        [`${base}/aifabric_/ai-deployer/v1/projects?$top=1`, "AI Center"],
      ] as const) {
        try {
          const duRes = await fetch(ep, { headers: duHdrs });
          if (duRes.ok) {
            const txt = await duRes.text();
            if (!txt.trim().startsWith("<")) { duAvailable = true; duMsg = `Accessible (${label})`; break; }
          }
          if (duRes.status === 403) { duAvailable = true; duMsg = `Available via ${label} (HTTP 403 — needs folder permissions)`; break; }
          if (duRes.status === 400) {
            const txt = await duRes.text();
            if (txt.includes("InvalidApiVersion")) { duAvailable = true; duMsg = `Available (${label} — needs valid api-version)`; }
          }
        } catch { }
      }
      serviceChecks["Document Understanding"] = { available: duAvailable, message: duAvailable ? duMsg : "DU service not reachable with DU token" };
    } else {
      const duRes = await fetch(`${base}/du_/api/framework/projects?api-version=1`, { headers: hdrs }).catch(() => null);
      if (duRes && (duRes.ok || duRes.status === 403 || duRes.status === 400)) {
        serviceChecks["Document Understanding"] = { available: true, message: `Available (no DU token — ${resources.DU.error || "scope not configured"})` };
      } else {
        serviceChecks["Document Understanding"] = { available: false, message: `DU token unavailable: ${resources.DU.error || "scopes not configured"}` };
      }
    }

    if (resources.PM.ok) {
      serviceChecks["Platform Management"] = { available: true, message: `Token acquired (${resources.PM.scopes.length} scopes)` };
    } else {
      serviceChecks["Platform Management"] = { available: false, message: `PM token unavailable: ${resources.PM.error || "scopes not configured"}` };
    }

    if (resources.DF.ok) {
      const { getDfToken } = await import("./uipath-auth");
      const dfTok = await getDfToken();
      const dfHdrs = { Authorization: `Bearer ${dfTok}`, "Content-Type": "application/json" };
      let dfAvailable = false;
      let dfMsg = "";
      const dfSwagger = await fetch(`${base}/dataservice_/swagger/index.html`, { headers: dfHdrs, redirect: "manual" }).catch(() => null);
      if (dfSwagger && dfSwagger.status === 200) {
        dfAvailable = true;
        dfMsg = "Data Service provisioned";
      } else {
        dfMsg = `Data Service not reachable (swagger: ${dfSwagger?.status || "error"})`;
      }
      serviceChecks["Data Service"] = { available: dfAvailable, message: dfMsg };
    } else {
      serviceChecks["Data Service"] = { available: false, message: `DF token unavailable: ${resources.DF.error || "scopes not configured"}` };
    }

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
  dataService: boolean;
  platformManagement: boolean;
  environments: boolean;
  triggers: boolean;
};

export async function probeServiceAvailability(): Promise<ServiceAvailabilityMap> {
  const result: ServiceAvailabilityMap = {
    configured: false, orchestrator: false, actionCenter: false,
    testManager: false, documentUnderstanding: false, dataService: false,
    platformManagement: false, environments: true, triggers: true,
  };

  const config = await getUiPathConfig();
  if (!config) return result;
  result.configured = true;

  try {
    const { getHeaders: getOrHeaders, tryAcquireResourceToken } = await import("./uipath-auth");
    const hdrs = await getOrHeaders();
    const base = `https://cloud.uipath.com/${config.orgName}/${config.tenantName}`;
    const orchBase = `${base}/orchestrator_`;

    const orchRes = await fetch(`${orchBase}/odata/Folders?$top=1`, { headers: hdrs });
    result.orchestrator = orchRes.ok;
    if (!orchRes.ok) return result;

    const [acRes, envRes, trigRes, schedRes] = await Promise.all([
      fetch(`${orchBase}/odata/TaskCatalogs?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/Environments?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/QueueTriggers?$top=1`, { headers: hdrs }).catch(() => null),
      fetch(`${orchBase}/odata/ProcessSchedules?$top=1`, { headers: hdrs }).catch(() => null),
    ]);

    if (acRes) {
      if (acRes.ok) {
        const acText = await acRes.text();
        const isHTML = acText.trim().startsWith("<");
        if (isHTML) {
          result.actionCenter = false;
        } else {
          try {
            const data = JSON.parse(acText);
            result.actionCenter = !(data.errorCode || data["odata.error"] || (data.message && typeof data.message === "string" && data.message.includes("not onboarded")));
          } catch { result.actionCenter = false; }
        }
      } else {
        result.actionCenter = false;
      }
    }

    if (envRes) {
      result.environments = envRes.ok || envRes.status === 400;
      if (envRes.status === 404 || envRes.status === 405) result.environments = false;
    }

    const queueTriggersOk = trigRes ? (trigRes.ok || trigRes.status === 400) && trigRes.status !== 404 && trigRes.status !== 405 : false;
    const processSchedulesOk = schedRes ? (schedRes.ok || schedRes.status === 400) && schedRes.status !== 404 && schedRes.status !== 405 : false;
    result.triggers = queueTriggersOk || processSchedulesOk;

    const [tmResult, duResult, pmResult, dfResult] = await Promise.allSettled([
      tryAcquireResourceToken("TM"),
      tryAcquireResourceToken("DU"),
      tryAcquireResourceToken("PM"),
      tryAcquireResourceToken("DF"),
    ]);

    if (tmResult.status === "fulfilled" && tmResult.value.ok) {
      const { getTmToken } = await import("./uipath-auth");
      const tmTok = await getTmToken();
      const tmHdrs = { Authorization: `Bearer ${tmTok}`, "Content-Type": "application/json" };
      for (const tmUrl of [`${base}/testmanager_/api/v2/projects?$top=1`, `${base}/tmapi_/api/v2/projects?$top=1`]) {
        try {
          const tmRes = await fetch(tmUrl, { headers: tmHdrs });
          if (tmRes.ok) { const txt = await tmRes.text(); if (!txt.trim().startsWith("<")) { result.testManager = true; break; } }
          if (tmRes.status === 401 || tmRes.status === 403) { result.testManager = true; break; }
        } catch { }
      }
    }

    if (duResult.status === "fulfilled" && duResult.value.ok) {
      const { getDuToken } = await import("./uipath-auth");
      const duTok = await getDuToken();
      const duHdrs: Record<string, string> = { Authorization: `Bearer ${duTok}`, "Content-Type": "application/json" };
      if (config.folderId) duHdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;
      for (const ep of [`${base}/du_/api/framework/projects?api-version=1`, `${base}/du_/api/framework/projects?api-version=2`]) {
        try {
          const duRes = await fetch(ep, { headers: duHdrs });
          if (duRes.ok || duRes.status === 403 || duRes.status === 400) { result.documentUnderstanding = true; break; }
        } catch { }
      }
    }

    if (pmResult.status === "fulfilled" && pmResult.value.ok) {
      result.platformManagement = true;
    }

    if (dfResult.status === "fulfilled" && dfResult.value.ok) {
      const dfSwagger = await fetch(`${base}/dataservice_/swagger/index.html`, { redirect: "manual" }).catch(() => null);
      if (dfSwagger && dfSwagger.status === 200) {
        result.dataService = true;
      }
    }

    return result;
  } catch {
    return result;
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
