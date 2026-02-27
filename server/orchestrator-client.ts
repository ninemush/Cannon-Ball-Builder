import {
  getToken,
  getHeaders,
  getConfig,
  getBaseUrl,
  getActionsBaseUrl,
  getTestManagerBaseUrl,
  invalidateToken,
  UiPathAuthError,
  type UiPathAuthConfig,
} from "./uipath-auth";

export class OrchestratorAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public endpoint: string,
    public responseBody?: string
  ) {
    super(message);
    this.name = "OrchestratorAPIError";
  }
}

interface RetryOptions {
  maxRetries?: number;
  timeoutMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30000;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
}

async function orchRequest<T = any>(
  path: string,
  options: RequestInit & RetryOptions = {}
): Promise<T> {
  const { maxRetries = DEFAULT_MAX_RETRIES, timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOpts } = options;

  const config = await getConfig();
  if (!config) throw new UiPathAuthError("UiPath is not configured.");

  const baseUrl = getBaseUrl(config);
  const url = path.startsWith("http") ? path : `${baseUrl}${path}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers = await getHeaders();
    const mergedHeaders = { ...headers, ...(fetchOpts.headers as Record<string, string> || {}) };

    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(url, {
        ...fetchOpts,
        headers: mergedHeaders,
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(tid);
      if (attempt < maxRetries && err.name !== "AbortError") {
        const delay = 1000 * Math.pow(2, attempt);
        console.log(`[Orchestrator] Network error on ${path} (attempt ${attempt + 1}/${maxRetries + 1}): ${err.message}, retrying in ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw new OrchestratorAPIError(
        err.name === "AbortError" ? `Request timed out after ${timeoutMs}ms` : err.message,
        0,
        path
      );
    }
    clearTimeout(tid);

    if (res.status === 401 && attempt === 0) {
      console.log(`[Orchestrator] 401 on ${path}, refreshing token...`);
      invalidateToken();
      continue;
    }

    if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < maxRetries) {
      let delay = 1000 * Math.pow(2, attempt);
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        if (retryAfter) {
          const parsed = parseInt(retryAfter, 10) * 1000;
          if (!isNaN(parsed) && parsed > 0 && parsed < 60000) delay = parsed;
        }
      }
      console.log(`[Orchestrator] ${res.status} on ${path} (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`);
      await sleep(delay);
      continue;
    }

    const text = await res.text();

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const data = JSON.parse(text);
        errorMsg = data.message || data.Message || data.errorCode || data.ErrorCode || errorMsg;
        if (data["odata.error"]) {
          errorMsg = data["odata.error"].message?.value || data["odata.error"].code || errorMsg;
        }
      } catch {}
      throw new OrchestratorAPIError(errorMsg, res.status, path, text.slice(0, 500));
    }

    if (!text || text.trim().length === 0) {
      return undefined as unknown as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  throw new OrchestratorAPIError("Max retries exhausted", 0, path);
}

export interface ODataResponse<T> {
  "@odata.count"?: number;
  value: T[];
}

export interface QueueDefinition {
  Id: number;
  Name: string;
  Description?: string;
  MaxNumberOfRetries?: number;
  EnforceUniqueReference?: boolean;
}

export interface QueueItem {
  Id: number;
  QueueDefinitionId: number;
  Status: string;
  Reference?: string;
  SpecificContent?: Record<string, any>;
  Priority?: string;
}

export interface ProcessRelease {
  Id: number;
  Key: string;
  Name: string;
  ProcessKey: string;
  ProcessVersion: string;
  Description?: string;
  IsLatestVersion?: boolean;
  CurrentVersion?: { Version: string };
}

export interface Job {
  Id: number;
  Key: string;
  State: string;
  StartTime?: string;
  EndTime?: string;
  Info?: string;
  ReleaseName?: string;
  Source?: string;
}

export interface Robot {
  Id: number;
  Name: string;
  MachineName?: string;
  Type?: string;
  LicenseKey?: string;
  Status?: string;
}

export interface Session {
  Id: number;
  State: string;
  Robot?: Robot;
  MachineId?: number;
}

export interface Machine {
  Id: number;
  Name: string;
  Type?: string;
  Status?: string;
  NonProductionSlots?: number;
  UnattendedSlots?: number;
}

export interface ActionCatalog {
  Id: number;
  Name: string;
  Description?: string;
}

export interface ActionTask {
  Id: number;
  Title: string;
  Status: string;
  Type?: string;
  Data?: any;
  AssignedToUser?: string;
  CreationTime?: string;
  LastModificationTime?: string;
  CatalogName?: string;
}

export interface TestSet {
  Id: string;
  Name: string;
  Description?: string;
  PackageIdentifier?: string;
}

export interface TestExecution {
  Id: string;
  Status: string;
  StartDate?: string;
  EndDate?: string;
  PassedCount?: number;
  FailedCount?: number;
  TotalCount?: number;
}

export interface Trigger {
  Id: number;
  Name: string;
  Enabled: boolean;
  ReleaseId?: number;
  ReleaseName?: string;
  QueueId?: number;
}

export interface QueueStats {
  queueId: number;
  queueName: string;
  totalItems: number;
  newItems: number;
  inProgress: number;
  successful: number;
  failed: number;
}

export interface FolderStats {
  folderId: string;
  folderName: string;
  processCount: number;
  machineCount: number;
  robotCount: number;
  queueCount: number;
}

export async function getQueues(folderId?: number): Promise<QueueDefinition[]> {
  const extra = folderId ? `&$filter=FolderId eq ${folderId}` : "";
  const res = await orchRequest<ODataResponse<QueueDefinition>>(`/odata/QueueDefinitions?$top=100${extra}`);
  return res?.value || [];
}

export async function getQueueByName(name: string): Promise<QueueDefinition | null> {
  const res = await orchRequest<ODataResponse<QueueDefinition>>(
    `/odata/QueueDefinitions?$filter=Name eq '${odataEscape(name)}'&$top=1`
  );
  return res?.value?.[0] || null;
}

export async function getQueueItems(queueId: number, status?: string, limit = 50): Promise<QueueItem[]> {
  let filter = `QueueDefinitionId eq ${queueId}`;
  if (status) filter += ` and Status eq '${odataEscape(status)}'`;
  const res = await orchRequest<ODataResponse<QueueItem>>(
    `/odata/QueueItems?$filter=${filter}&$top=${limit}&$orderby=Id desc`
  );
  return res?.value || [];
}

export async function addQueueItem(
  queueName: string,
  reference: string,
  payload: Record<string, any>,
  priority = "Normal"
): Promise<QueueItem> {
  return orchRequest<QueueItem>("/odata/Queues/UiPathODataSvc.AddQueueItem", {
    method: "POST",
    body: JSON.stringify({
      itemData: {
        Name: queueName,
        Priority: priority,
        Reference: reference,
        SpecificContent: payload,
      },
    }),
  });
}

export async function bulkAddQueueItems(
  queueName: string,
  items: Array<{ reference: string; payload: Record<string, any>; priority?: string }>
): Promise<{ addedCount: number; failedCount: number }> {
  const commitItems = items.map((item) => ({
    Name: queueName,
    Priority: item.priority || "Normal",
    Reference: item.reference,
    SpecificContent: item.payload,
  }));

  const res = await orchRequest<any>("/odata/Queues/UiPathODataSvc.BulkAddQueueItems", {
    method: "POST",
    body: JSON.stringify({ commitType: "AllOrNothing", queueName, queueItems: commitItems }),
  });

  return { addedCount: commitItems.length, failedCount: 0 };
}

export async function getProcesses(folderId?: number): Promise<ProcessRelease[]> {
  const res = await orchRequest<ODataResponse<ProcessRelease>>("/odata/Releases?$top=100");
  return res?.value || [];
}

export async function getProcessByName(name: string): Promise<ProcessRelease | null> {
  const res = await orchRequest<ODataResponse<ProcessRelease>>(
    `/odata/Releases?$filter=Name eq '${odataEscape(name)}' or ProcessKey eq '${odataEscape(name)}'&$top=1`
  );
  return res?.value?.[0] || null;
}

export async function uploadPackage(nupkgBuffer: Buffer): Promise<any> {
  const config = await getConfig();
  if (!config) throw new UiPathAuthError("UiPath is not configured.");

  const token = await getToken();
  const baseUrl = getBaseUrl(config);

  const boundary = `----FormBoundary${Date.now()}`;
  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="package.nupkg"\r\n`,
    `Content-Type: application/octet-stream\r\n\r\n`,
  ];
  const headerBuf = Buffer.from(bodyParts.join(""));
  const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([headerBuf, nupkgBuffer, footerBuf]);

  const hdrs: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  };
  if (config.folderId) hdrs["X-UIPATH-OrganizationUnitId"] = config.folderId;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 120000);

  const res = await fetch(`${baseUrl}/odata/Processes/UiPath.Server.Configuration.OData.UploadPackage`, {
    method: "POST",
    headers: hdrs,
    body: fullBody,
    signal: controller.signal,
  });
  clearTimeout(tid);

  const text = await res.text();
  if (!res.ok) {
    throw new OrchestratorAPIError(`Upload failed (${res.status}): ${text.slice(0, 200)}`, res.status, "UploadPackage", text);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { uploaded: true };
  }
}

export async function createProcess(
  packageName: string,
  packageVersion: string,
  processName?: string,
  description?: string
): Promise<ProcessRelease> {
  return orchRequest<ProcessRelease>("/odata/Releases", {
    method: "POST",
    body: JSON.stringify({
      Name: processName || packageName,
      ProcessKey: packageName,
      ProcessVersion: packageVersion,
      Description: description || "",
    }),
  });
}

export async function deleteProcess(processKey: string): Promise<boolean> {
  const process = await getProcessByName(processKey);
  if (!process) return false;
  await orchRequest(`/odata/Releases(${process.Id})`, { method: "DELETE" });
  return true;
}

export async function startJob(
  processKey: string,
  robotIds?: number[],
  jobsCount = 1
): Promise<Job> {
  const body: any = {
    startInfo: {
      ReleaseKey: processKey,
      Strategy: robotIds?.length ? "Specific" : "ModernJobsCount",
      JobsCount: jobsCount,
      Source: "CannonBall",
    },
  };

  if (robotIds?.length) {
    body.startInfo.RobotIds = robotIds;
    body.startInfo.Strategy = "Specific";
  }

  const res = await orchRequest<any>("/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const jobs = res?.value || [];
  return jobs[0] || res;
}

export async function getJob(jobId: number): Promise<Job> {
  return orchRequest<Job>(`/odata/Jobs(${jobId})`);
}

export async function getJobs(processName?: string, status?: string): Promise<Job[]> {
  const filters: string[] = [];
  if (processName) filters.push(`ReleaseName eq '${odataEscape(processName)}'`);
  if (status) filters.push(`State eq '${odataEscape(status)}'`);
  const filter = filters.length > 0 ? `?$filter=${filters.join(" and ")}&$top=50&$orderby=Id desc` : "?$top=50&$orderby=Id desc";
  const res = await orchRequest<ODataResponse<Job>>(`/odata/Jobs${filter}`);
  return res?.value || [];
}

export async function stopJob(jobId: number, strategy = "SoftStop"): Promise<boolean> {
  await orchRequest(`/odata/Jobs(${jobId})/UiPath.Server.Configuration.OData.StopJob`, {
    method: "POST",
    body: JSON.stringify({ strategy }),
  });
  return true;
}

export async function getRobots(folderId?: number): Promise<Robot[]> {
  const res = await orchRequest<ODataResponse<Robot>>("/odata/Robots?$top=100");
  return res?.value || [];
}

export async function getRobot(robotId: number): Promise<Robot> {
  return orchRequest<Robot>(`/odata/Robots(${robotId})`);
}

export async function getSessions(robotId?: number): Promise<Session[]> {
  const filter = robotId ? `?$filter=Robot/Id eq ${robotId}` : "";
  const res = await orchRequest<ODataResponse<Session>>(`/odata/Sessions${filter}`);
  return res?.value || [];
}

export async function getMachines(): Promise<Machine[]> {
  const res = await orchRequest<ODataResponse<Machine>>("/odata/Machines?$top=100");
  return res?.value || [];
}

export async function getActionCatalog(): Promise<ActionCatalog[]> {
  try {
    const config = await getConfig();
    if (!config) return [];
    const actionsBase = getActionsBaseUrl(config);
    const headers = await getHeaders();
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${actionsBase}/api/v1/TaskCatalogs?$top=50`, {
      headers,
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (res.ok) {
      const data = await res.json();
      return data?.value || data?.items || [];
    }
    if (res.status === 404 || res.status === 403) return [];
    const fallback = await orchRequest<ODataResponse<ActionCatalog>>("/odata/TaskCatalogs?$top=50");
    return fallback?.value || [];
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 403) return [];
    throw err;
  }
}

export async function getTasks(status?: string, assignee?: string): Promise<ActionTask[]> {
  const filters: string[] = [];
  if (status) filters.push(`Status eq '${odataEscape(status)}'`);
  if (assignee) filters.push(`AssignedToUser eq '${odataEscape(assignee)}'`);
  const filter = filters.length > 0 ? `?$filter=${filters.join(" and ")}&$top=50` : "?$top=50";

  try {
    const res = await orchRequest<ODataResponse<ActionTask>>(`/odata/Tasks${filter}`);
    return res?.value || [];
  } catch (err: any) {
    if (err.statusCode === 404 || err.statusCode === 403) return [];
    throw err;
  }
}

export async function getTask(taskId: number): Promise<ActionTask> {
  return orchRequest<ActionTask>(`/odata/Tasks(${taskId})`);
}

export async function completeTask(taskId: number, action: string, data?: Record<string, any>): Promise<any> {
  return orchRequest(`/odata/Tasks(${taskId})/UiPathODataSvc.CompleteTask`, {
    method: "POST",
    body: JSON.stringify({ Action: action, Data: data || {} }),
  });
}

export async function assignTask(taskId: number, assignee: string): Promise<any> {
  return orchRequest(`/odata/Tasks(${taskId})/UiPathODataSvc.AssignTask`, {
    method: "POST",
    body: JSON.stringify({ UserId: assignee }),
  });
}

export async function getTestSets(projectId?: string): Promise<TestSet[]> {
  try {
    const config = await getConfig();
    if (!config) return [];
    const tmBase = getTestManagerBaseUrl(config);
    const filter = projectId ? `?projectId=${projectId}` : "";
    const headers = await getHeaders();
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${tmBase}/api/TestSets${filter}`, { headers, signal: controller.signal });
    clearTimeout(tid);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.value || data || [];
  } catch {
    return [];
  }
}

export async function startTestExecution(testSetId: string): Promise<TestExecution> {
  const config = await getConfig();
  if (!config) throw new UiPathAuthError("UiPath is not configured.");
  const tmBase = getTestManagerBaseUrl(config);
  const headers = await getHeaders();

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 30000);
  const res = await fetch(`${tmBase}/api/TestSetExecutions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ TestSetId: testSetId }),
    signal: controller.signal,
  });
  clearTimeout(tid);

  const text = await res.text();
  if (!res.ok) {
    throw new OrchestratorAPIError(`Start test execution failed (${res.status})`, res.status, "TestSetExecutions", text);
  }
  return JSON.parse(text);
}

export async function getTestExecution(executionId: string): Promise<TestExecution> {
  const config = await getConfig();
  if (!config) throw new UiPathAuthError("UiPath is not configured.");
  const tmBase = getTestManagerBaseUrl(config);
  const headers = await getHeaders();

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(`${tmBase}/api/TestSetExecutions/${executionId}`, { headers, signal: controller.signal });
  clearTimeout(tid);

  const text = await res.text();
  if (!res.ok) {
    throw new OrchestratorAPIError(`Get test execution failed (${res.status})`, res.status, `TestSetExecutions/${executionId}`, text);
  }
  return JSON.parse(text);
}

export async function waitForTestExecution(
  executionId: string,
  timeoutSeconds = 300
): Promise<TestExecution> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const execution = await getTestExecution(executionId);
    if (execution.Status === "Passed" || execution.Status === "Failed" || execution.Status === "Cancelled") {
      return execution;
    }
    await sleep(10000);
  }
  throw new OrchestratorAPIError(`Test execution timed out after ${timeoutSeconds}s`, 0, `TestSetExecutions/${executionId}`);
}

export async function getTriggers(processName?: string): Promise<Trigger[]> {
  const filter = processName ? `?$filter=ReleaseName eq '${odataEscape(processName)}'` : "";
  const res = await orchRequest<ODataResponse<Trigger>>(`/odata/QueueTriggers${filter}`);
  return res?.value || [];
}

export async function createQueueTrigger(
  name: string,
  processKey: string,
  queueName: string,
  minJobsCount: number,
  maxJobsCount: number,
  jobsPerItem = 1
): Promise<Trigger> {
  const queue = await getQueueByName(queueName);
  if (!queue) throw new OrchestratorAPIError(`Queue "${queueName}" not found`, 404, "QueueTriggers");

  const process = await getProcessByName(processKey);
  if (!process) throw new OrchestratorAPIError(`Process "${processKey}" not found`, 404, "QueueTriggers");

  return orchRequest<Trigger>("/odata/QueueTriggers", {
    method: "POST",
    body: JSON.stringify({
      Name: name,
      ReleaseId: process.Id,
      QueueId: queue.Id,
      MinNumberOfItems: minJobsCount,
      MaxNumberOfItems: maxJobsCount,
      JobsCountPerItem: jobsPerItem,
      Enabled: true,
    }),
  });
}

export async function updateTrigger(triggerId: number, updates: Record<string, any>): Promise<any> {
  return orchRequest(`/odata/QueueTriggers(${triggerId})`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function disableTrigger(triggerId: number): Promise<boolean> {
  await updateTrigger(triggerId, { Enabled: false });
  return true;
}

export async function enableTrigger(triggerId: number): Promise<boolean> {
  await updateTrigger(triggerId, { Enabled: true });
  return true;
}

export async function getQueueStats(queueId: number): Promise<QueueStats> {
  const queue = await orchRequest<QueueDefinition>(`/odata/QueueDefinitions(${queueId})`);

  const [newItems, inProgress, successful, failed] = await Promise.all([
    orchRequest<ODataResponse<any>>(`/odata/QueueItems/$count?$filter=QueueDefinitionId eq ${queueId} and Status eq 'New'`).catch(() => ({ value: [] })),
    orchRequest<ODataResponse<any>>(`/odata/QueueItems/$count?$filter=QueueDefinitionId eq ${queueId} and Status eq 'InProgress'`).catch(() => ({ value: [] })),
    orchRequest<ODataResponse<any>>(`/odata/QueueItems/$count?$filter=QueueDefinitionId eq ${queueId} and Status eq 'Successful'`).catch(() => ({ value: [] })),
    orchRequest<ODataResponse<any>>(`/odata/QueueItems/$count?$filter=QueueDefinitionId eq ${queueId} and Status eq 'Failed'`).catch(() => ({ value: [] })),
  ]);

  const items = await getQueueItems(queueId, undefined, 1);

  return {
    queueId,
    queueName: queue.Name,
    totalItems: items.length,
    newItems: typeof newItems === "number" ? newItems : 0,
    inProgress: typeof inProgress === "number" ? inProgress : 0,
    successful: typeof successful === "number" ? successful : 0,
    failed: typeof failed === "number" ? failed : 0,
  };
}

export async function getFolderStats(): Promise<FolderStats> {
  const config = await getConfig();
  if (!config) throw new UiPathAuthError("UiPath is not configured.");

  const [processes, machines, robots, queues] = await Promise.all([
    getProcesses().catch(() => []),
    getMachines().catch(() => []),
    getRobots().catch(() => []),
    getQueues().catch(() => []),
  ]);

  return {
    folderId: config.folderId || "default",
    folderName: config.folderName || config.tenantName,
    processCount: processes.length,
    machineCount: machines.length,
    robotCount: robots.length,
    queueCount: queues.length,
  };
}
