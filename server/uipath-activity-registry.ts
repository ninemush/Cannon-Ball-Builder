import { catalogService } from "./catalog/catalog-service";
import { isFrameworkAssembly } from "./uipath-shared";

export type ActivityPropertyInfo = {
  required?: string[];
  optional?: string[];
};

export type VersionedProperty = {
  name: string;
  addedInMajor?: number;
  removedInMajor?: number;
};

export type ActivityRegistryEntry = {
  package: string;
  properties: ActivityPropertyInfo;
  versionedProperties?: VersionedProperty[];
};

export const DESIGNER_PROPERTIES = new Set([
  "WorkflowViewState.IdRef",
  "sap2010:WorkflowViewState.IdRef",
  "VirtualizedContainerService.HintSize",
  "sap:VirtualizedContainerService.HintSize",
  "Annotation.AnnotationText",
  "sap2010:Annotation.AnnotationText",
]);

export const ACTIVITIES_SUPPORTING_CONTINUE_ON_ERROR = new Set([
  "ui:Click",
  "ui:TypeInto",
  "ui:GetText",
  "ui:NClick",
  "ui:NTypeInto",
  "ui:NGetText",
  "ui:NSelectItem",
  "ui:NCheckState",
  "ui:ElementExists",
  "ui:OpenBrowser",
  "ui:NavigateTo",
  "ui:AttachBrowser",
  "ui:AttachWindow",
  "ui:UseBrowser",
  "ui:UseApplicationBrowser",
  "ui:NApplicationCard",
]);

export const ACTIVITY_NAME_ALIAS_MAP: Record<string, string> = {
  "ui:GetCredentials": "ui:GetCredential",
  "ui:Click": "ui:NClick",
  "Click": "NClick",
  "ui:TypeInto": "ui:NTypeInto",
  "TypeInto": "NTypeInto",
  "ui:GetText": "ui:NGetText",
  "GetText": "NGetText",
  "ui:SelectItem": "ui:NSelectItem",
  "SelectItem": "NSelectItem",
  "ui:CheckState": "ui:NCheckState",
  "CheckState": "NCheckState",
  "ui:OpenBrowser": "ui:NApplicationCard",
  "OpenBrowser": "NApplicationCard",
  "ui:AttachBrowser": "ui:NApplicationCard",
  "AttachBrowser": "NApplicationCard",
  "ui:AttachWindow": "ui:NApplicationCard",
  "AttachWindow": "NApplicationCard",
  "ui:UseApplicationBrowser": "ui:NApplicationCard",
  "UseApplicationBrowser": "NApplicationCard",
  "ui:UseBrowser": "ui:NApplicationCard",
  "UseBrowser": "NApplicationCard",
  "ui:UseApplication": "ui:NApplicationCard",
  "UseApplication": "NApplicationCard",
};

export function normalizeActivityName(name: string): string {
  return ACTIVITY_NAME_ALIAS_MAP[name] || name;
}

function buildFallbackRegistry(): Record<string, ActivityRegistryEntry> {
  const uiAuto = "UiPath.UIAutomation.Activities";
  const uiSys = "UiPath.System.Activities";
  const excel = "UiPath.Excel.Activities";
  const mail = "UiPath.Mail.Activities";
  const webapi = "UiPath.WebAPI.Activities";
  const db = "UiPath.Database.Activities";
  const persist = "UiPath.Persistence.Activities";
  const ml = "UiPath.MLActivities";
  const ocr = "UiPath.IntelligentOCR.Activities";
  const sysAct = "System.Activities";

  const stub = (pkg: string, opt?: string[]): ActivityRegistryEntry => ({
    package: pkg,
    properties: { optional: opt || [] },
  });

  const stubReq = (pkg: string, req: string[], opt?: string[]): ActivityRegistryEntry => ({
    package: pkg,
    properties: { required: req, optional: opt || [] },
  });

  return {
    "ui:NClick": { package: uiAuto, properties: { optional: ["ClickType", "MouseButton", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError", "InUiElement"] } },
    "ui:NTypeInto": { package: uiAuto, properties: { optional: ["Text", "ClickBeforeTyping", "EmptyField", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError"] } },
    "ui:NGetText": { package: uiAuto, properties: { optional: ["Value", "TextString", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError"] } },
    "ui:NApplicationCard": { package: uiAuto, properties: { optional: ["Url", "BrowserType", "Selector", "ContinueOnError"] } },
    "ui:NSelectItem": { package: uiAuto, properties: { optional: ["Item", "TimeoutMS", "Timeout", "ContinueOnError"] } },
    "ui:NCheckState": { package: uiAuto, properties: { optional: ["Result", "TimeoutMS", "Timeout", "ContinueOnError"] } },
    "ui:Click": { package: uiAuto, properties: { optional: ["ClickType", "MouseButton", "KeyModifiers", "CursorPosition", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError", "InformativeScreenshot"] }, versionedProperties: [{ name: "InformativeScreenshot", addedInMajor: 23 }] },
    "ui:TypeInto": { package: uiAuto, properties: { optional: ["Text", "ClickBeforeTyping", "EmptyField", "DelayBetweenKeys", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError", "InformativeScreenshot"] }, versionedProperties: [{ name: "InformativeScreenshot", addedInMajor: 23 }] },
    "ui:GetText": { package: uiAuto, properties: { optional: ["Value", "TextString", "DelayAfter", "DelayBefore", "TimeoutMS", "Timeout", "ContinueOnError", "InformativeScreenshot"] }, versionedProperties: [{ name: "InformativeScreenshot", addedInMajor: 23 }] },
    "ui:OpenBrowser": stub(uiAuto, ["Url", "BrowserType", "NewSession", "Private", "Hidden", "ContinueOnError"]),
    "ui:UseBrowser": { package: uiAuto, properties: { optional: ["Url", "BrowserType", "InformativeScreenshot"] }, versionedProperties: [{ name: "InformativeScreenshot", addedInMajor: 23 }] },
    "ui:NavigateTo": stub(uiAuto, ["Url", "ContinueOnError"]),
    "ui:AttachBrowser": stub(uiAuto, ["BrowserType", "Title", "Url", "ContinueOnError"]),
    "ui:AttachWindow": stub(uiAuto, ["ContinueOnError"]),
    "ui:UseApplicationBrowser": { package: uiAuto, properties: { optional: ["Url", "BrowserType", "InformativeScreenshot"] }, versionedProperties: [{ name: "InformativeScreenshot", addedInMajor: 23 }] },
    "ui:ElementExists": stub(uiAuto, ["Result", "TimeoutMS", "Timeout", "ContinueOnError"]),
    "ui:TakeScreenshot": stub(uiAuto, ["Result", "TimeoutMS", "Timeout"]),
    "ui:UseApplication": stub(uiAuto, ["ApplicationPath", "Arguments"]),
    "ui:CloseApplication": stub(uiAuto, ["DisplayName"]),
    "ui:ExcelApplicationScope": { package: excel, properties: { optional: ["WorkbookPath", "AutoSave", "Visible", "CreateNewFile", "ReadOnly", "Password", "EditPassword", "ExistingWorkbook"] }, versionedProperties: [{ name: "EditPassword", addedInMajor: 2 }] },
    "ui:UseExcel": stub(excel, ["WorkbookPath", "CreateNewFile", "ReadOnly", "Password"]),
    "ui:ExcelReadRange": stub(excel, ["SheetName", "Range", "DataTable", "AddHeaders", "UseFilter"]),
    "ui:ExcelWriteRange": stub(excel, ["SheetName", "StartingCell", "DataTable", "AddHeaders"]),
    "ui:ExcelWriteCell": stub(excel, ["SheetName", "Cell", "Value"]),
    "ui:ReadRange": stub(excel, ["SheetName", "Range", "DataTable", "AddHeaders"]),
    "ui:WriteRange": stub(excel, ["SheetName", "StartingCell", "DataTable", "AddHeaders"]),
    "ui:SendSmtpMailMessage": stub(mail, ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Server", "Port", "SecureConnection", "Email", "Password"]),
    "ui:SendOutlookMailMessage": stub(mail, ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Account", "Attachments"]),
    "ui:GetImapMailMessage": stub(mail, ["Server", "Port", "Email", "Password", "SecureConnection", "Top", "MailFolder", "OnlyUnreadMessages"]),
    "ui:GetOutlookMailMessages": stub(mail, ["Account", "MailFolder", "Top", "Filter", "OnlyUnreadMessages", "OrderByDate"]),
    "ui:SendMail": stub(mail, ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml"]),
    "ui:GetMail": stub(mail, ["Top", "MailFolder", "OnlyUnreadMessages"]),
    "ui:HttpClient": stub(webapi, ["EndPoint", "Endpoint", "Method", "AcceptFormat", "Body", "BodyFormat", "Headers", "ResponseContent", "ResponseStatus", "TimeoutMS", "Timeout", "Url"]),
    "ui:DeserializeJson": stub(webapi, ["JsonString", "JsonObject"]),
    "ui:SerializeJson": stub(webapi, ["JsonObject", "JsonString"]),
    "ui:DeserializeJSON": stub(webapi, ["JsonString", "JsonObject"]),
    "ui:ExecuteQuery": stub(db, ["ConnectionString", "ProviderName", "Sql", "DataTable", "Parameters", "TimeoutMS", "Timeout"]),
    "ui:ExecuteNonQuery": stub(db, ["ConnectionString", "ProviderName", "Sql", "AffectedRecords", "Parameters"]),
    "ui:ConnectToDatabase": stub(db, ["ConnectionString", "ProviderName", "DatabaseConnection"]),
    "ui:AddQueueItem": stub(uiSys, ["QueueType", "QueueName", "Reference", "Priority", "DeferDate", "DueDate", "ItemInformation"]),
    "ui:GetTransactionItem": stub(uiSys, ["QueueType", "QueueName", "TransactionItem"]),
    "ui:SetTransactionStatus": stub(uiSys, ["TransactionItem", "Status", "ErrorType", "Reason"]),
    "ui:GetCredential": stubReq(uiSys, ["AssetName"], ["Username", "Password"]),
    "ui:GetAsset": stub(uiSys, ["AssetName", "Value"]),
    "ui:ReadTextFile": stub(uiSys, ["FileName", "Content", "Encoding"]),
    "ui:WriteTextFile": stub(uiSys, ["FileName", "Text", "Content", "Encoding"]),
    "ui:PathExists": stub(uiSys, ["Path", "PathType", "Result"]),
    "ui:LogMessage": stubReq(uiSys, ["Message"], ["Level"]),
    "ui:InvokeWorkflowFile": stubReq(uiSys, ["WorkflowFileName"], ["Arguments", "Isolated"]),
    "ui:Comment": stub(uiSys, ["Text"]),
    "ui:AddLogFields": stub(uiSys, ["Fields"]),
    "ui:ShouldRetry": stub(uiSys),
    "ui:RetryScope": stub(uiSys, ["NumberOfRetries", "RetryInterval"]),
    "ui:KillProcess": stubReq(uiSys, ["ProcessName"], ["DisplayName"]),
    "ui:Delay": stubReq(uiSys, ["Duration"], ["DisplayName"]),
    "ui:Rethrow": stub(uiSys),
    "ui:CreateFormTask": stub(persist, ["TaskCatalog", "TaskTitle", "TaskPriority", "TaskObject", "TaskData"]),
    "ui:WaitForFormTaskAndResume": stub(persist, ["TaskObject", "TaskAction", "TaskOutput"]),
    "ui:MLSkill": stub(ml, ["SkillName", "Input", "Output", "TimeoutMS", "Timeout"]),
    "ui:Predict": stub(ml, ["ModelName", "Input", "Output"]),
    "ui:DigitizeDocument": stub(ocr, ["DocumentPath", "DocumentObjectModel", "OcrEngine"]),
    "ui:ClassifyDocument": stub(ocr, ["DocumentObjectModel", "DocumentPath", "ClassifierResult"]),
    "ui:ExtractDocumentData": stub(ocr, ["DocumentObjectModel", "DocumentPath", "ExtractorResult"]),
    "ui:ValidateDocumentData": stub(ocr, ["DocumentObjectModel", "DocumentPath", "AutoValidated"]),
    "ui:Assign": stub("", ["To", "Value"]),
    "ui:Throw": stub("", ["Exception"]),
    "Assign": stub(sysAct, ["To", "Value", "x:TypeArguments"]),
    "Throw": stub(sysAct, ["Exception"]),
    "Rethrow": stub(sysAct),
    "TryCatch": stub(sysAct, ["Try", "Catches", "Finally"]),
    "ForEach": stub(sysAct, ["Values", "Body", "x:TypeArguments"]),
    "ParallelForEach": stub(sysAct, ["Values", "Body", "CompletionCondition", "x:TypeArguments"]),
    "If": stubReq(sysAct, ["Condition"], ["Then", "Else"]),
    "Switch": stub(sysAct, ["Expression", "Default", "x:TypeArguments"]),
    "While": stubReq(sysAct, ["Condition"], ["Body"]),
    "DoWhile": stubReq(sysAct, ["Condition"], ["Body"]),
    "Sequence": stub(sysAct),
    "Delay": stub(sysAct, ["Duration"]),
  };
}

const FALLBACK_REGISTRY = buildFallbackRegistry();

function buildRegistryFromCatalog(): Record<string, ActivityRegistryEntry> {
  if (!catalogService.isLoaded()) return {};

  const registry: Record<string, ActivityRegistryEntry> = {};
  const allActivities = catalogService.getAllActivities();

  for (const schema of allActivities) {
    const { activity, packageId } = schema;
    const needsUiPrefix = packageId !== "System.Activities" && packageId !== "";
    const tag = needsUiPrefix ? `ui:${activity.className}` : activity.className;

    const required = activity.properties.filter(p => p.required).map(p => p.name);
    const optional = activity.properties.filter(p => !p.required).map(p => p.name);

    const entry: ActivityRegistryEntry = {
      package: packageId,
      properties: {
        ...(required.length > 0 ? { required } : {}),
        optional,
      },
    };

    const versionedProps = activity.properties
      .filter(p => p.addedInVersion || p.removedInVersion)
      .map(p => {
        const vp: VersionedProperty = { name: p.name };
        if (p.addedInVersion) {
          const major = parseInt(p.addedInVersion.split(".")[0], 10);
          if (!isNaN(major)) vp.addedInMajor = major;
        }
        if (p.removedInVersion) {
          const major = parseInt(p.removedInVersion.split(".")[0], 10);
          if (!isNaN(major)) vp.removedInMajor = major;
        }
        return vp;
      });

    if (versionedProps.length > 0) {
      entry.versionedProperties = versionedProps;
    }

    registry[tag] = entry;
  }

  // Runtime override (Task #489): ExistingWorkbook was marked required in the DLL-extracted
  // catalog (activity-catalog.json) but is genuinely optional in all valid UiPath Studio usage
  // — it is only needed when reusing an existing workbook instance. The catalog metadata has
  // also been corrected (required: false), but this runtime guard ensures the registry stays
  // correct even if a future catalog refresh re-introduces the flag.
  const excelScopeEntry = registry["ui:ExcelApplicationScope"];
  if (excelScopeEntry) {
    if (excelScopeEntry.properties.required) {
      excelScopeEntry.properties.required = excelScopeEntry.properties.required.filter(
        (p: string) => p !== "ExistingWorkbook"
      );
      if (excelScopeEntry.properties.required.length === 0) {
        delete excelScopeEntry.properties.required;
      }
    }
    if (!excelScopeEntry.properties.optional.includes("ExistingWorkbook")) {
      excelScopeEntry.properties.optional.push("ExistingWorkbook");
    }
  }

  return registry;
}

let _cachedCatalogRegistry: Record<string, ActivityRegistryEntry> | null = null;
let _cachedGeneration = -1;

function getCatalogRegistry(): Record<string, ActivityRegistryEntry> {
  const currentGeneration = catalogService.getLoadGeneration();
  if (_cachedCatalogRegistry && _cachedGeneration === currentGeneration) {
    return _cachedCatalogRegistry;
  }
  _cachedCatalogRegistry = buildRegistryFromCatalog();
  _cachedGeneration = currentGeneration;
  return _cachedCatalogRegistry;
}

export const ACTIVITY_REGISTRY: Record<string, ActivityRegistryEntry> = new Proxy(FALLBACK_REGISTRY, {
  get(target, prop, receiver) {
    if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
    if (catalogService.isLoaded()) {
      const catalogRegistry = getCatalogRegistry();
      if (prop in catalogRegistry) return catalogRegistry[prop];
    }
    return target[prop];
  },
  has(target, prop) {
    if (typeof prop !== "string") return Reflect.has(target, prop);
    if (catalogService.isLoaded()) {
      const catalogRegistry = getCatalogRegistry();
      if (prop in catalogRegistry) return true;
    }
    return prop in target;
  },
  ownKeys(target) {
    if (catalogService.isLoaded()) {
      const catalogRegistry = getCatalogRegistry();
      const allKeys = Array.from(new Set(Object.keys(catalogRegistry).concat(Object.keys(target))));
      return allKeys;
    }
    return Object.keys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (typeof prop !== "string") return Object.getOwnPropertyDescriptor(target, prop);
    if (catalogService.isLoaded()) {
      const catalogRegistry = getCatalogRegistry();
      if (prop in catalogRegistry) {
        return { configurable: true, enumerable: true, value: catalogRegistry[prop], writable: true };
      }
    }
    return Object.getOwnPropertyDescriptor(target, prop);
  },
});

export function getActivityPackageFromRegistry(activityName: string): string | null {
  const prefixedKey = `ui:${activityName}`;
  const entry = ACTIVITY_REGISTRY[prefixedKey];
  if (entry && entry.package) return entry.package;

  const directEntry = ACTIVITY_REGISTRY[activityName];
  if (directEntry && directEntry.package) return directEntry.package;

  return null;
}

export type AutomationPattern = "simple-linear" | "api-data-driven" | "ui-automation" | "transactional-queue" | "hybrid";

export function classifyAutomationPattern(
  processNodes: any[],
  sddContent: string | null,
  hasQueues: boolean,
  enrichmentUseReFramework?: boolean,
): AutomationPattern {
  if (enrichmentUseReFramework || hasQueues) {
    return "transactional-queue";
  }

  const combined = (sddContent || "").toLowerCase();
  const nodeDescriptions = processNodes.map((n: any) => `${n.name || ""} ${n.description || ""}`).join(" ").toLowerCase();
  const allText = combined + " " + nodeDescriptions;

  const uiKeywords = ["click", "type into", "get text", "selector", "browser", "screen", "screenshot", "ui automation", "desktop app", "web app", "navigate to", "open browser"];
  const apiKeywords = ["api", "http", "rest", "endpoint", "json", "deserialize", "serialize", "web service", "request", "response"];
  const strongQueueKeywords = ["orchestrator queue", "reframework", "queue item"];
  const weakQueueKeywords = ["queue", "transaction", "retry"];

  const uiScore = uiKeywords.filter(k => allText.includes(k)).length;
  const apiScore = apiKeywords.filter(k => allText.includes(k)).length;
  const strongQueueScore = strongQueueKeywords.filter(k => allText.includes(k)).length;
  const weakQueueScore = weakQueueKeywords.filter(k => allText.includes(k)).length;
  const queueScore = strongQueueScore * 2 + weakQueueScore;

  if (queueScore >= 4 || strongQueueScore >= 1) return "transactional-queue";
  if (uiScore > 0 && apiScore > 0) return "hybrid";
  if (uiScore >= 2) return "ui-automation";
  if (apiScore >= 2) return "api-data-driven";

  return "simple-linear";
}

export function shouldUseReFramework(pattern: AutomationPattern): boolean {
  return pattern === "transactional-queue";
}

export function getActivityPackage(activityName: string): string | undefined {
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(activityName);
    if (schema?.packageId) return schema.packageId;

    const className = activityName.includes(":") ? activityName.split(":").pop()! : activityName;
    const schemaByClass = catalogService.getActivitySchema(className);
    if (schemaByClass?.packageId) return schemaByClass.packageId;
  }

  const entry = FALLBACK_REGISTRY[activityName];
  return entry?.package || undefined;
}

export function isKnownActivity(activityName: string): boolean {
  if (catalogService.isLoaded()) {
    const schema = catalogService.getActivitySchema(activityName);
    if (schema) return true;

    const className = activityName.includes(":") ? activityName.split(":").pop()! : activityName;
    if (catalogService.getActivitySchema(className)) return true;
  }

  return activityName in FALLBACK_REGISTRY;
}

export { getBlockedActivities, isActivityAllowed } from "./uipath-activity-policy";

const TYPE_ARGUMENT_PACKAGE_MAP: Record<string, string> = {
  "Newtonsoft.Json": "Newtonsoft.Json",
  "Newtonsoft.Json.Linq.JToken": "Newtonsoft.Json",
  "Newtonsoft.Json.Linq.JObject": "Newtonsoft.Json",
  "Newtonsoft.Json.Linq.JArray": "Newtonsoft.Json",
  "Newtonsoft.Json.Linq.JValue": "Newtonsoft.Json",
  "System.Data.DataTable": "UiPath.Database.Activities",
  "System.Data.DataRow": "UiPath.Database.Activities",
  "System.Net.Mail.MailMessage": "UiPath.Mail.Activities",
  "UiPath.Excel.Activities": "UiPath.Excel.Activities",
  "UiPath.Mail.Activities": "UiPath.Mail.Activities",
  "UiPath.WebAPI.Activities": "UiPath.WebAPI.Activities",
  "UiPath.Database.Activities": "UiPath.Database.Activities",
  "UiPath.Persistence.Activities": "UiPath.Persistence.Activities",
  "UiPath.Persistence.Activities.Models.TaskData": "UiPath.Persistence.Activities",
  "UiPath.Persistence.Activities.Models.FormTaskData": "UiPath.Persistence.Activities",
  "UiPath.Persistence.Activities.Models.ExternalTaskData": "UiPath.Persistence.Activities",
  "UiPath.Persistence.Activities.Models.TaskAction": "UiPath.Persistence.Activities",
  "UiPath.IntegrationService.Activities": "UiPath.IntegrationService.Activities",
  "UiPath.IntegrationService.Models": "UiPath.IntegrationService.Activities",
  "UiPath.GSuite.Activities": "UiPath.GSuite.Activities",
  "UiPath.GSuite": "UiPath.GSuite.Activities",
  "UiPath.Persistence.Activities.Models.FormTask": "UiPath.Persistence.Activities",
  "UiPath.Persistence.TaskObject": "UiPath.Persistence.Activities",
  "UiPath.IntegrationService.Models.ConnectorResult": "UiPath.IntegrationService.Activities",
  "UiPath.IntegrationService.Models.ConnectionInfo": "UiPath.IntegrationService.Activities",
  "UiPath.IntegrationService.Models.TriggerEventArgs": "UiPath.IntegrationService.Activities",
  "UiPath.GSuite.Models": "UiPath.GSuite.Activities",
  "UiPath.DocumentUnderstanding": "UiPath.IntelligentOCR.Activities",
  "UiPath.DocumentProcessing.Contracts.Results.ClassificationResult": "UiPath.IntelligentOCR.Activities",
  "UiPath.DocumentProcessing.Contracts.Results.ExtractionResult": "UiPath.IntelligentOCR.Activities",
  "UiPath.DocumentProcessing.DOM.Document": "UiPath.IntelligentOCR.Activities",
  "UiPath.IntelligentOCR": "UiPath.IntelligentOCR.Activities",
  "UiPath.DataService": "UiPath.DataService.Activities",
  "UiPath.DataService.Activities": "UiPath.DataService.Activities",
  "UiPath.DataService.DataServiceEntity": "UiPath.DataService.Activities",
  "UiPath.Core.QueueItem": "UiPath.System.Activities",
  "UiPath.CommunicationsMining": "UiPath.CommunicationsMining.Activities",
  "UiPath.Form.Activities": "UiPath.Form.Activities",
  "UiPath.WorkflowEvents": "UiPath.WorkflowEvents.Activities",
};

function inferPackageFromNamespace(ns: string): string | null {
  if (!ns.startsWith("UiPath.")) return null;
  const parts = ns.replace("UiPath.", "").split(".");
  if (parts.length === 0) return null;

  if (ns.includes(".Activities")) {
    const actIdx = parts.indexOf("Activities");
    if (actIdx >= 0) {
      return "UiPath." + parts.slice(0, actIdx + 1).join(".");
    }
  }

  if (parts.length >= 1) {
    const domain = parts[0];
    const candidate = `UiPath.${domain}.Activities`;
    return candidate;
  }

  return null;
}

export const NAMESPACE_PREFIX_TO_PACKAGE: Record<string, string> = {
  "uexcel": "UiPath.Excel.Activities",
  "uweb": "UiPath.WebAPI.Activities",
  "umail": "UiPath.Mail.Activities",
  "udb": "UiPath.Database.Activities",
  "uml": "UiPath.MLActivities",
  "uocr": "UiPath.IntelligentOCR.Activities",
  "upers": "UiPath.Persistence.Activities",
  "uds": "UiPath.DataService.Activities",
  "ugs": "UiPath.GSuite.Activities",
  "uis": "UiPath.IntegrationService.Activities",
  "updf": "UiPath.PDF.Activities",
  "uword": "UiPath.Word.Activities",
  "uftp": "UiPath.FTP.Activities",
  "ucrypto": "UiPath.Cryptography.Activities",
  "ucred": "UiPath.Credentials.Activities",
  "uform": "UiPath.Form.Activities",
  "utest": "UiPath.Testing.Activities",
  "upres": "UiPath.Presentations.Activities",
  "udu": "UiPath.DocumentUnderstanding.Activities",
  "ucm": "UiPath.CommunicationsMining.Activities",
  "uwebapi": "UiPath.WebAPI.Activities",
  "ucs": "UiPath.ComplexScenarios.Activities",
  "uwfe": "UiPath.WorkflowEvents.Activities",
  "uo365": "UiPath.MicrosoftOffice365.Activities",
  "uteams": "UiPath.MicrosoftTeams.Activities",
  "usfdc": "UiPath.Salesforce.Activities",
  "usnow": "UiPath.ServiceNow.Activities",
  "ujira": "UiPath.Jira.Activities",
  "uslack": "UiPath.Slack.Activities",
  "ubox": "UiPath.Box.Activities",
  "uaws": "UiPath.AmazonWebServices.Activities",
  "uazure": "UiPath.Azure.Activities",
  "ugcloud": "UiPath.GoogleCloud.Activities",
  "ucmp": "UiPath.Amazon.Comprehend.Activities",
  "urek": "UiPath.Amazon.Rekognition.Activities",
  "utxt": "UiPath.Amazon.Textract.Activities",
  "uaz": "UiPath.Azure.Activities",
  "uafr": "UiPath.AzureFormRecognizerV3.Activities",
  "ucoupa": "UiPath.Coupa.IntegrationService.Activities",
  "ucrypt": "UiPath.Cryptography.Activities",
  "ugc": "UiPath.GoogleCloud.Activities",
  "ugv": "UiPath.GoogleVision.Activities",
  "udyn": "UiPath.MicrosoftDynamics.Activities",
  "usf": "UiPath.Salesforce.Activities",
  "uwd": "UiPath.Workday.Activities",
  "uact365": "UiPath.Act365.IntegrationService.Activities",
  "uadds": "UiPath.ActiveDirectoryDomainServices.Activities",
  "uadosign": "UiPath.Adobe.AdobeSign.Activities",
  "uadobepdf": "UiPath.AdobePdfServices.IntegrationService.Activities",
  "ualteryx": "UiPath.Alteryx.Activities",
  "uamzscope": "UiPath.Amazon.Scope.Activities",
  "uamzconn": "UiPath.AmazonConnect.Activities",
  "uamzws": "UiPath.AmazonWorkSpaces.Activities",
  "uaplemail": "UiPath.AppleMail.Activities",
  "uaplnum": "UiPath.AppleNumbers.Activities",
  "uaplscript": "UiPath.AppleScripting.Activities",
  "uazad": "UiPath.AzureActiveDirectory.Activities",
  "uazwvd": "UiPath.AzureWindowsVirtualDesktop.Activities",
  "ubamboo": "UiPath.BambooHR.IntegrationService.Activities",
  "uboxis": "UiPath.Box.IntegrationService.Activities",
  "ucallout": "UiPath.Callout.Activities",
  "ucampmon": "UiPath.CampaignMonitor.IntegrationService.Activities",
  "uwebex": "UiPath.CiscoWebexTeams.IntegrationService.Activities",
  "ucitrix": "UiPath.Citrix.Activities",
  "ucognitive": "UiPath.Cognitive.Activities",
  "uconfluence": "UiPath.ConfluenceCloud.IntegrationService.Activities",
  "uduml": "UiPath.DocumentUnderstanding.ML.Activities",
  "udocusign": "UiPath.DocuSign.Activities",
  "udocuis": "UiPath.Docusign.IntegrationService.Activities",
  "udropbox": "UiPath.Dropbox.IntegrationService.Activities",
  "udropbiz": "UiPath.DropboxBusiness.IntegrationService.Activities",
  "uexchange": "UiPath.ExchangeServer.Activities",
  "uexpensify": "UiPath.Expensify.IntegrationService.Activities",
  "ufreshsvc": "UiPath.Freshservice.IntegrationService.Activities",
  "ugithub": "UiPath.GitHub.IntegrationService.Activities",
  "uvertex": "UiPath.GoogleVertex.IntegrationService.Activities",
  "ugotoweb": "UiPath.GoToWebinar.IntegrationService.Activities",
  "uhyperv": "UiPath.HyperV.Activities",
  "ujava": "UiPath.Java.Activities",
  "ujirais": "UiPath.Jira.IntegrationService.Activities",
  "umailchimp": "UiPath.Mailchimp.IntegrationService.Activities",
  "umarketo": "UiPath.Marketo.Activities",
  "umarketois": "UiPath.Marketo.IntegrationService.Activities",
  "uazoai": "UiPath.MicrosoftAzureOpenAI.IntegrationService.Activities",
  "udyncrm": "UiPath.MicrosoftDynamicsCRM.IntegrationService.Activities",
  "umstrans": "UiPath.MicrosoftTranslator.Activities",
  "umsvision": "UiPath.MicrosoftVision.Activities",
  "umlsvc": "UiPath.MLServices.Activities",
  "unetiq": "UiPath.NetIQeDirectory.Activities",
  "uopenai": "UiPath.OpenAI.IntegrationService.Activities",
  "uoic": "UiPath.Oracle.IntegrationCloud.Process.Activities",
  "ueloqua": "UiPath.OracleEloqua.IntegrationService.Activities",
  "unetsuite": "UiPath.OracleNetSuite.Activities",
  "unetsuitis": "UiPath.OracleNetSuite.IntegrationService.Activities",
  "upython": "UiPath.Python.Activities",
  "uqbo": "UiPath.QuickBooksOnline.IntegrationService.Activities",
  "usfis": "UiPath.Salesforce.IntegrationService.Activities",
  "usfmc": "UiPath.SalesforceMarketingCloud.IntegrationService.Activities",
  "usapc4c": "UiPath.SAPCloudForCustomer.IntegrationService.Activities",
  "usendgrid": "UiPath.SendGrid.IntegrationService.Activities",
  "usnowis": "UiPath.ServiceNow.IntegrationService.Activities",
  "usheet": "UiPath.Smartsheet.Activities",
  "usheetis": "UiPath.Smartsheet.IntegrationService.Activities",
  "usnowflake": "UiPath.Snowflake.IntegrationService.Activities",
  "usuccfact": "UiPath.SuccessFactors.Activities",
  "usugare": "UiPath.SugarEnterprise.IntegrationService.Activities",
  "usugarp": "UiPath.SugarProfessional.IntegrationService.Activities",
  "usugars": "UiPath.SugarSell.IntegrationService.Activities",
  "usugarv": "UiPath.SugarServe.IntegrationService.Activities",
  "usysctr": "UiPath.SystemCenter.Activities",
  "utableau": "UiPath.Tableau.Activities",
  "uterminal": "UiPath.Terminal.Activities",
  "utwilio": "UiPath.Twilio.Activities",
  "utwiliois": "UiPath.Twilio.IntegrationService.Activities",
  "utwitter": "UiPath.Twitter.IntegrationService.Activities",
  "uvmware": "UiPath.VMware.Activities",
  "uworkato": "UiPath.Workato.Activities",
  "uwdis": "UiPath.Workday.IntegrationService.Activities",
  "uzendesk": "UiPath.Zendesk.IntegrationService.Activities",
  "uzoom": "UiPath.Zoom.IntegrationService.Activities",
  "upaf": "UiPath.Persistence.Activities",
  "upaj": "UiPath.Persistence.Activities",
  "upat": "UiPath.Persistence.Activities",
  "upau": "UiPath.Persistence.Activities",
  "upad": "UiPath.Persistence.Activities",
  "upama": "UiPath.Persistence.Activities",
  "umam": "UiPath.MicrosoftOffice365.Activities",
  "umae": "UiPath.MicrosoftOffice365.Activities",
  "umafm": "UiPath.MicrosoftOffice365.Activities",
  "usau": "UiPath.MicrosoftOffice365.Activities",
  "ucas": "UiPath.System.Activities",
  "uasj": "UiPath.System.Activities",
  "uasom": "UiPath.System.Activities",
  "uda": "UiPath.DataService.Activities",
  "udam": "UiPath.DataService.Activities",
  "uaa": "UiPath.Agentic.Activities",
  "uaasm": "UiPath.Agentic.Activities",
  "upa": "UiPath.Process.Activities",
  "upas": "UiPath.Process.Activities",
  "uisad": "UiPath.IntelligentOCR.StudioWeb.Activities",
  "uisape": "UiPath.IntelligentOCR.StudioWeb.Activities",
  "upr": "UiPath.Platform",
  "uix": "UiPath.UIAutomation.Activities",
  "isactr": "UiPath.IntegrationService.Activities",
  "p": "UiPath.IntelligentOCR.Activities",
};

const UI_PREFIX_ACTIVITY_PACKAGE_MAP: Record<string, string> = {
  "ui:CreateTask": "UiPath.Persistence.Activities",
  "ui:CompleteTask": "UiPath.Persistence.Activities",
  "ui:GetTask": "UiPath.Persistence.Activities",
  "ui:GetTasks": "UiPath.Persistence.Activities",
  "ui:ResumeAfterTask": "UiPath.Persistence.Activities",
  "ui:WaitForTask": "UiPath.Persistence.Activities",
  "ui:CreateFormTask": "UiPath.Persistence.Activities",
  "ui:CreateExternalTask": "UiPath.Persistence.Activities",
  "ui:SendGmail": "UiPath.GSuite.Activities",
  "ui:ReadGmail": "UiPath.GSuite.Activities",
  "ui:GetGmailMessages": "UiPath.GSuite.Activities",
  "ui:SendGoogleSheet": "UiPath.GSuite.Activities",
  "ui:ReadGoogleSheet": "UiPath.GSuite.Activities",
  "ui:WriteGoogleSheet": "UiPath.GSuite.Activities",
  "ui:GoogleDriveUpload": "UiPath.GSuite.Activities",
  "ui:GoogleDriveDownload": "UiPath.GSuite.Activities",
  "ui:IntegrationServiceConnector": "UiPath.IntegrationService.Activities",
  "ui:Connector": "UiPath.IntegrationService.Activities",
  "ui:ConnectorAction": "UiPath.IntegrationService.Activities",
  "ui:ConnectorTrigger": "UiPath.IntegrationService.Activities",
  "ui:GenerateText": "UiPath.IntegrationService.Activities",
  "ui:PromptActivity": "UiPath.IntegrationService.Activities",
  "ui:ClassifyText": "UiPath.IntegrationService.Activities",
  "ui:ExtractData": "UiPath.IntegrationService.Activities",
  "ui:SummarizeText": "UiPath.IntegrationService.Activities",
  "ui:AnalyzeSentiment": "UiPath.IntegrationService.Activities",
  "ui:TranslateText": "UiPath.IntegrationService.Activities",
};

export function scanXamlForRequiredPackages(xamlContent: string): Set<string> {
  const packages = new Set<string>();
  packages.add("UiPath.System.Activities");

  const FRAMEWORK_PREFIXES = new Set(["x", "s", "sap", "scg", "scg2", "sco", "mc", "mva", "mca", "this", "local", "p", "sads", "sa", "sad"]);
  const activityPattern = /<([A-Za-z][A-Za-z0-9]*:[A-Za-z]+)\s/g;
  let match;
  while ((match = activityPattern.exec(xamlContent)) !== null) {
    const actTag = match[1];
    const prefix = actTag.split(":")[0];

    if (FRAMEWORK_PREFIXES.has(prefix)) continue;

    if (prefix === "ui") {
      const specializedPkg = UI_PREFIX_ACTIVITY_PACKAGE_MAP[actTag];
      if (specializedPkg) {
        packages.add(specializedPkg);
        continue;
      }
    }

    if (catalogService.isLoaded()) {
      const pkg = catalogService.getPackageForActivity(actTag);
      if (pkg && !isFrameworkAssembly(pkg)) {
        packages.add(pkg);
        continue;
      }
    }

    if (prefix !== "ui") {
      const nsPkg = NAMESPACE_PREFIX_TO_PACKAGE[prefix];
      if (nsPkg) {
        packages.add(nsPkg);
        continue;
      }
    }

    const entry = FALLBACK_REGISTRY[actTag];
    if (entry?.package && !isFrameworkAssembly(entry.package)) {
      packages.add(entry.package);
    }
  }

  for (const [prefix, pkgName] of Object.entries(NAMESPACE_PREFIX_TO_PACKAGE)) {
    const prefixPattern = new RegExp(`<${prefix}:[A-Za-z]+[\\s/>]`);
    if (prefixPattern.test(xamlContent)) {
      packages.add(pkgName);
    }
  }

  const xmlnsPattern = /xmlns:\w+="clr-namespace:(UiPath\.[^;&]+);assembly=([^"&]+)"/g;
  while ((match = xmlnsPattern.exec(xamlContent)) !== null) {
    const ns = match[1].trim();
    const assemblyName = match[2].trim();
    if (assemblyName.startsWith("UiPath.") && !isFrameworkAssembly(assemblyName)) {
      packages.add(assemblyName);
    }
    const inferred = inferPackageFromNamespace(ns);
    if (inferred && !isFrameworkAssembly(inferred)) {
      packages.add(inferred);
    }
  }

  const typeArgPattern = /x:TypeArguments="([^"]+)"/g;
  while ((match = typeArgPattern.exec(xamlContent)) !== null) {
    const typeArgs = match[1];

    if (catalogService.isLoaded()) {
      const clrTypes = typeArgs.split(",").map(t => t.trim()).filter(t => t.startsWith("UiPath.") || t.startsWith("System.Data.") || t.startsWith("Newtonsoft."));
      for (const clrType of clrTypes) {
        const catalogPkg = catalogService.resolveTypeToPackage(clrType);
        if (catalogPkg && !isFrameworkAssembly(catalogPkg)) {
          packages.add(catalogPkg);
        }
      }
    }

    for (const [typeRef, pkg] of Object.entries(TYPE_ARGUMENT_PACKAGE_MAP)) {
      if (typeArgs.includes(typeRef) && !isFrameworkAssembly(pkg)) {
        packages.add(pkg);
      }
    }
  }

  const assemblyRefPattern = /clr-namespace:([^;&]+);assembly=([^"&]+)/g;
  while ((match = assemblyRefPattern.exec(xamlContent)) !== null) {
    const ns = match[1].trim();
    const assemblyName = match[2].trim();
    if (assemblyName === "Newtonsoft.Json") {
      packages.add("Newtonsoft.Json");
    }
    if (assemblyName.startsWith("UiPath.") && !isFrameworkAssembly(assemblyName)) {
      packages.add(assemblyName);
    }
    if (ns.startsWith("UiPath.") && !assemblyName.startsWith("UiPath.")) {
      const inferred = inferPackageFromNamespace(ns);
      if (inferred && !isFrameworkAssembly(inferred)) {
        packages.add(inferred);
      }
    }
  }

  const newtonsoftPatterns = [
    /Newtonsoft\.Json/,
    /JToken/,
    /JObject/,
    /JArray/,
    /JsonConvert/,
  ];
  for (const pattern of newtonsoftPatterns) {
    if (pattern.test(xamlContent)) {
      packages.add("Newtonsoft.Json");
      break;
    }
  }

  return packages;
}
