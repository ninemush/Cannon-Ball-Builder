import { db } from "./db";
import { uipathConnections } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getUiPathConfig } from "./uipath-integration";

export type AutomationHubIdea = {
  id: number;
  name: string;
  description: string;
  category: string;
  submittedBy: string;
  submittedByEmail: string;
  status: string;
  processDetails: string;
  estimatedBenefit: string;
  department: string;
  createdDate: string;
};

export type AutomationStoreEntry = {
  name: string;
  description: string;
  version: string;
  documentationUrl?: string;
  deploymentStatus: string;
  artifacts: string[];
  tags: string[];
};

async function getAutomationHubToken(): Promise<string | null> {
  const activeRows = await db
    .select()
    .from(uipathConnections)
    .where(eq(uipathConnections.isActive, true));
  if (activeRows.length === 0) return null;
  return activeRows[0].automationHubToken || null;
}

export async function saveAutomationHubToken(token: string): Promise<void> {
  const activeRows = await db
    .select()
    .from(uipathConnections)
    .where(eq(uipathConnections.isActive, true));
  if (activeRows.length === 0) {
    throw new Error("No active UiPath connection found. Configure an Orchestrator connection first.");
  }
  await db
    .update(uipathConnections)
    .set({ automationHubToken: token.trim() })
    .where(eq(uipathConnections.id, activeRows[0].id));
}

export async function clearAutomationHubToken(): Promise<void> {
  const activeRows = await db
    .select()
    .from(uipathConnections)
    .where(eq(uipathConnections.isActive, true));
  if (activeRows.length > 0) {
    await db
      .update(uipathConnections)
      .set({ automationHubToken: null })
      .where(eq(uipathConnections.id, activeRows[0].id));
  }
}

function getHubBaseUrl(orgName: string, tenantName: string): string {
  return `https://cloud.uipath.com/${orgName}/${tenantName}/automationhub_/api/v1`;
}

function hubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function getAutomationHubStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  message: string;
  ideaCount?: number;
}> {
  const config = await getUiPathConfig();
  if (!config) {
    return { configured: false, connected: false, message: "UiPath is not configured" };
  }

  const token = await getAutomationHubToken();
  if (!token) {
    return { configured: false, connected: false, message: "Automation Hub token not configured" };
  }

  try {
    const baseUrl = getHubBaseUrl(config.orgName, config.tenantName);
    const res = await fetch(`${baseUrl}/automations?limit=1`, {
      headers: hubHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        configured: true,
        connected: false,
        message: `Automation Hub connection failed (${res.status}): ${text.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const count =
      data.totalCount ?? data.TotalCount ?? (Array.isArray(data.data) ? data.data.length : 0);

    return {
      configured: true,
      connected: true,
      message: `Connected to Automation Hub`,
      ideaCount: count,
    };
  } catch (err: any) {
    return {
      configured: true,
      connected: false,
      message: `Automation Hub connection error: ${err.message}`,
    };
  }
}

export async function listAutomationHubIdeas(
  limit: number = 50,
  offset: number = 0,
  status?: string
): Promise<{
  success: boolean;
  ideas?: AutomationHubIdea[];
  totalCount?: number;
  message?: string;
}> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath is not configured" };
  }

  const token = await getAutomationHubToken();
  if (!token) {
    return { success: false, message: "Automation Hub token not configured" };
  }

  try {
    const baseUrl = getHubBaseUrl(config.orgName, config.tenantName);
    let url = `${baseUrl}/automations?limit=${limit}&offset=${offset}`;
    if (status) {
      url += `&status=${encodeURIComponent(status)}`;
    }

    const res = await fetch(url, { headers: hubHeaders(token) });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, message: `Failed to fetch ideas (${res.status}): ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    const rawItems = data.data || data.value || data.Data || [];
    const ideas: AutomationHubIdea[] = rawItems.map((item: any) => ({
      id: item.id || item.Id || item.automationId || 0,
      name: item.name || item.Name || item.title || "Untitled",
      description: item.description || item.Description || "",
      category: item.category?.name || item.categoryName || item.Category || "",
      submittedBy: item.submittedBy?.name || item.submittedByName || item.SubmittedBy || "",
      submittedByEmail: item.submittedBy?.email || item.submittedByEmail || "",
      status: item.status?.name || item.statusName || item.Status || "",
      processDetails: item.processDescription || item.processDetails || item.ProcessDetails || "",
      estimatedBenefit: item.estimatedBenefit || item.EstimatedBenefit || "",
      department: item.department?.name || item.departmentName || item.Department || "",
      createdDate: item.createdDate || item.CreatedDate || item.created || "",
    }));

    return {
      success: true,
      ideas,
      totalCount: data.totalCount ?? data.TotalCount ?? ideas.length,
    };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch Automation Hub ideas: ${err.message}` };
  }
}

export async function getAutomationHubIdeaDetails(ideaId: number): Promise<{
  success: boolean;
  idea?: AutomationHubIdea;
  rawData?: any;
  message?: string;
}> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath is not configured" };
  }

  const token = await getAutomationHubToken();
  if (!token) {
    return { success: false, message: "Automation Hub token not configured" };
  }

  try {
    const baseUrl = getHubBaseUrl(config.orgName, config.tenantName);
    const res = await fetch(`${baseUrl}/automations/${ideaId}`, {
      headers: hubHeaders(token),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { success: false, message: `Failed to fetch idea details (${res.status}): ${text.slice(0, 200)}` };
    }

    const item = await res.json();
    const rawData = item.data || item;

    const idea: AutomationHubIdea = {
      id: rawData.id || rawData.Id || ideaId,
      name: rawData.name || rawData.Name || rawData.title || "Untitled",
      description: rawData.description || rawData.Description || "",
      category: rawData.category?.name || rawData.categoryName || rawData.Category || "",
      submittedBy: rawData.submittedBy?.name || rawData.submittedByName || rawData.SubmittedBy || "",
      submittedByEmail: rawData.submittedBy?.email || rawData.submittedByEmail || "",
      status: rawData.status?.name || rawData.statusName || rawData.Status || "",
      processDetails: rawData.processDescription || rawData.processDetails || rawData.ProcessDetails || "",
      estimatedBenefit: rawData.estimatedBenefit || rawData.EstimatedBenefit || "",
      department: rawData.department?.name || rawData.departmentName || rawData.Department || "",
      createdDate: rawData.createdDate || rawData.CreatedDate || rawData.created || "",
    };

    return { success: true, idea, rawData };
  } catch (err: any) {
    return { success: false, message: `Failed to fetch idea details: ${err.message}` };
  }
}

export async function publishToAutomationStore(entry: {
  name: string;
  description: string;
  version: string;
  packageId?: string;
  processName?: string;
  deploymentResults?: any[];
  ideaId?: string;
}): Promise<{ success: boolean; message: string; storeId?: string }> {
  const config = await getUiPathConfig();
  if (!config) {
    return { success: false, message: "UiPath is not configured" };
  }

  const token = await getAutomationHubToken();
  if (!token) {
    return { success: false, message: "Automation Hub token not configured — skipping Store publish" };
  }

  try {
    const baseUrl = getHubBaseUrl(config.orgName, config.tenantName);

    const artifactList = (entry.deploymentResults || [])
      .filter((r: any) => r.status === "created" || r.status === "exists")
      .map((r: any) => `${r.artifact}: ${r.name}`)
      .join(", ");

    const storePayload = {
      name: entry.name,
      description: entry.description || `Automation published by Cannonball v${entry.version}`,
      version: entry.version,
      status: "Published",
      deploymentInfo: {
        orgName: config.orgName,
        tenantName: config.tenantName,
        folderId: config.folderId || null,
        packageId: entry.packageId || entry.name,
        processName: entry.processName || entry.name,
        artifacts: artifactList,
      },
      tags: ["cannonball", "auto-published"],
    };

    const res = await fetch(`${baseUrl}/automations`, {
      method: "POST",
      headers: hubHeaders(token),
      body: JSON.stringify(storePayload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`[Automation Store] Publish failed (${res.status}): ${text.slice(0, 300)}`);
      return {
        success: false,
        message: `Automation Store publish failed (${res.status}): ${text.slice(0, 200)}`,
      };
    }

    const result = await res.json();
    const storeId = result.id || result.Id || result.data?.id || "";
    console.log(`[Automation Store] Published "${entry.name}" v${entry.version} (ID: ${storeId})`);

    return {
      success: true,
      message: `Published to Automation Store: ${entry.name} v${entry.version}`,
      storeId: String(storeId),
    };
  } catch (err: any) {
    console.log(`[Automation Store] Publish error: ${err.message}`);
    return { success: false, message: `Automation Store publish error: ${err.message}` };
  }
}

export function formatHubIdeaAsContext(idea: AutomationHubIdea): string {
  const lines = [
    `## Imported from Automation Hub (ID: ${idea.id})`,
    `**Name:** ${idea.name}`,
  ];
  if (idea.description) lines.push(`**Description:** ${idea.description}`);
  if (idea.category) lines.push(`**Category:** ${idea.category}`);
  if (idea.department) lines.push(`**Department:** ${idea.department}`);
  if (idea.submittedBy) lines.push(`**Submitted by:** ${idea.submittedBy}${idea.submittedByEmail ? ` (${idea.submittedByEmail})` : ""}`);
  if (idea.status) lines.push(`**Hub Status:** ${idea.status}`);
  if (idea.processDetails) lines.push(`\n**Process Details:**\n${idea.processDetails}`);
  if (idea.estimatedBenefit) lines.push(`**Estimated Benefit:** ${idea.estimatedBenefit}`);
  return lines.join("\n");
}
