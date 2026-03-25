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
  "ui:ElementExists",
  "ui:OpenBrowser",
  "ui:NavigateTo",
  "ui:AttachBrowser",
  "ui:AttachWindow",
  "ui:UseBrowser",
  "ui:UseApplicationBrowser",
]);

export const ACTIVITY_NAME_ALIAS_MAP: Record<string, string> = {
  "ui:GetCredentials": "ui:GetCredential",
};

export function normalizeActivityName(name: string): string {
  return ACTIVITY_NAME_ALIAS_MAP[name] || name;
}

const FALLBACK_REGISTRY: Record<string, ActivityRegistryEntry> = {
  "ui:Click": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["ClickType", "MouseButton", "KeyModifiers", "CursorPosition", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
    versionedProperties: [
      { name: "InformativeScreenshot", addedInMajor: 23 },
    ],
  },
  "ui:TypeInto": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Text", "ClickBeforeTyping", "EmptyField", "DelayBetweenKeys", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
    versionedProperties: [
      { name: "InformativeScreenshot", addedInMajor: 23 },
    ],
  },
  "ui:GetText": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Value", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
    versionedProperties: [
      { name: "InformativeScreenshot", addedInMajor: 23 },
    ],
  },
  "ui:OpenBrowser": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Url", "BrowserType", "NewSession", "Private", "Hidden", "ContinueOnError"],
    },
  },
  "ui:UseBrowser": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Url", "BrowserType", "InformativeScreenshot"],
    },
    versionedProperties: [
      { name: "InformativeScreenshot", addedInMajor: 23 },
    ],
  },
  "ui:NavigateTo": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Url", "ContinueOnError"],
    },
  },
  "ui:AttachBrowser": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["BrowserType", "Title", "Url", "ContinueOnError"],
    },
  },
  "ui:AttachWindow": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["ContinueOnError"],
    },
  },
  "ui:UseApplicationBrowser": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Url", "BrowserType", "InformativeScreenshot"],
    },
    versionedProperties: [
      { name: "InformativeScreenshot", addedInMajor: 23 },
    ],
  },
  "ui:ElementExists": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Result", "TimeoutMS", "ContinueOnError"],
    },
  },
  "ui:TakeScreenshot": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Result", "TimeoutMS"],
    },
  },
  "ui:UseApplication": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["ApplicationPath", "Arguments"],
    },
  },
  "ui:ExcelApplicationScope": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["WorkbookPath", "AutoSave", "Visible", "CreateNewFile", "ReadOnly", "Password", "EditPassword"],
    },
    versionedProperties: [
      { name: "EditPassword", addedInMajor: 2 },
    ],
  },
  "ui:UseExcel": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["WorkbookPath", "CreateNewFile", "ReadOnly", "Password"],
    },
  },
  "ui:ExcelReadRange": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["SheetName", "Range", "DataTable", "AddHeaders", "UseFilter"],
    },
  },
  "ui:ExcelWriteRange": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["SheetName", "StartingCell", "DataTable", "AddHeaders"],
    },
  },
  "ui:ExcelWriteCell": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["SheetName", "Cell", "Value"],
    },
  },
  "ui:ReadRange": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["SheetName", "Range", "DataTable", "AddHeaders"],
    },
  },
  "ui:WriteRange": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["SheetName", "StartingCell", "DataTable", "AddHeaders"],
    },
  },
  "ui:SendSmtpMailMessage": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Server", "Port", "SecureConnection", "Email", "Password"],
    },
  },
  "ui:SendOutlookMailMessage": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Account", "Attachments"],
    },
  },
  "ui:GetImapMailMessage": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Server", "Port", "Email", "Password", "SecureConnection", "Top", "MailFolder", "OnlyUnreadMessages"],
    },
  },
  "ui:GetOutlookMailMessages": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Account", "MailFolder", "Top", "Filter", "OnlyUnreadMessages", "OrderByDate"],
    },
  },
  "ui:SendMail": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml"],
    },
  },
  "ui:GetMail": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Top", "MailFolder", "OnlyUnreadMessages"],
    },
  },
  "ui:HttpClient": {
    package: "UiPath.Web.Activities",
    properties: {
      optional: ["EndPoint", "Endpoint", "Method", "AcceptFormat", "Body", "BodyFormat", "Headers", "ResponseContent", "ResponseStatus", "TimeoutMS", "Url"],
    },
  },
  "ui:DeserializeJson": {
    package: "UiPath.Web.Activities",
    properties: {
      optional: ["JsonString", "JsonObject"],
    },
  },
  "ui:SerializeJson": {
    package: "UiPath.Web.Activities",
    properties: {
      optional: ["JsonObject", "JsonString"],
    },
  },
  "ui:ExecuteQuery": {
    package: "UiPath.Database.Activities",
    properties: {
      optional: ["ConnectionString", "ProviderName", "Sql", "DataTable", "Parameters", "TimeoutMS"],
    },
  },
  "ui:ExecuteNonQuery": {
    package: "UiPath.Database.Activities",
    properties: {
      optional: ["ConnectionString", "ProviderName", "Sql", "AffectedRecords", "Parameters"],
    },
  },
  "ui:ConnectToDatabase": {
    package: "UiPath.Database.Activities",
    properties: {
      optional: ["ConnectionString", "ProviderName", "DatabaseConnection"],
    },
  },
  "ui:AddQueueItem": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["QueueName", "Reference", "Priority", "DeferDate", "DueDate", "ItemInformation"],
    },
  },
  "ui:GetTransactionItem": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["QueueName", "TransactionItem"],
    },
  },
  "ui:SetTransactionStatus": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["TransactionItem", "Status", "ErrorType", "Reason"],
    },
  },
  "ui:GetCredential": {
    package: "UiPath.System.Activities",
    properties: {
      required: ["AssetName"],
      optional: ["Username", "Password"],
    },
  },
  "ui:GetAsset": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["AssetName", "Value"],
    },
  },
  "ui:ReadTextFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["FileName", "Content", "Encoding"],
    },
  },
  "ui:WriteTextFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["FileName", "Text", "Content", "Encoding"],
    },
  },
  "ui:PathExists": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Path", "PathType", "Result"],
    },
  },
  "ui:LogMessage": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Level", "Message"],
    },
  },
  "ui:InvokeWorkflowFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["WorkflowFileName", "Arguments", "Isolated"],
    },
  },
  "ui:Comment": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Text"],
    },
  },
  "ui:AddLogFields": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Fields"],
    },
  },
  "ui:ShouldRetry": {
    package: "UiPath.System.Activities",
    properties: {
      optional: [],
    },
  },
  "ui:RetryScope": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["NumberOfRetries", "RetryInterval"],
    },
  },
  "ui:CreateFormTask": {
    package: "UiPath.Persistence.Activities",
    properties: {
      optional: ["TaskCatalog", "TaskTitle", "TaskPriority", "TaskObject", "TaskData"],
    },
  },
  "ui:WaitForFormTaskAndResume": {
    package: "UiPath.Persistence.Activities",
    properties: {
      optional: ["TaskObject", "TaskAction", "TaskOutput"],
    },
  },
  "ui:MLSkill": {
    package: "UiPath.MLActivities",
    properties: {
      optional: ["SkillName", "Input", "Output", "TimeoutMS"],
    },
  },
  "ui:Predict": {
    package: "UiPath.MLActivities",
    properties: {
      optional: ["ModelName", "Input", "Output"],
    },
  },
  "ui:DigitizeDocument": {
    package: "UiPath.IntelligentOCR.Activities",
    properties: {
      optional: ["DocumentPath", "DocumentObjectModel", "OcrEngine"],
    },
  },
  "ui:ClassifyDocument": {
    package: "UiPath.IntelligentOCR.Activities",
    properties: {
      optional: ["DocumentObjectModel", "DocumentPath", "ClassifierResult"],
    },
  },
  "ui:ExtractDocumentData": {
    package: "UiPath.IntelligentOCR.Activities",
    properties: {
      optional: ["DocumentObjectModel", "DocumentPath", "ExtractorResult"],
    },
  },
  "ui:ValidateDocumentData": {
    package: "UiPath.IntelligentOCR.Activities",
    properties: {
      optional: ["DocumentObjectModel", "DocumentPath", "AutoValidated"],
    },
  },
  "ui:CloseApplication": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["DisplayName"],
    },
  },
  "ui:KillProcess": {
    package: "UiPath.System.Activities",
    properties: {
      required: ["ProcessName"],
      optional: ["DisplayName"],
    },
  },
  "Assign": {
    package: "",
    properties: {
      optional: ["To", "Value"],
    },
  },
  "ui:Assign": {
    package: "",
    properties: {
      optional: ["To", "Value"],
    },
  },
  "Throw": {
    package: "",
    properties: {
      optional: ["Exception"],
    },
  },
  "ui:Throw": {
    package: "",
    properties: {
      optional: ["Exception"],
    },
  },
  "ui:DeserializeJSON": {
    package: "UiPath.Web.Activities",
    properties: {
      optional: ["JsonString", "JsonObject"],
    },
  },
  "ui:Delay": {
    package: "UiPath.System.Activities",
    properties: {
      required: ["Duration"],
      optional: ["DisplayName"],
    },
  },
  "Rethrow": {
    package: "",
    properties: {
      optional: [],
    },
  },
  "ui:Rethrow": {
    package: "UiPath.System.Activities",
    properties: {
      optional: [],
    },
  },
};

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
  "UiPath.Web.Activities": "UiPath.Web.Activities",
  "UiPath.Database.Activities": "UiPath.Database.Activities",
};

const NAMESPACE_PREFIX_TO_PACKAGE: Record<string, string> = {
  "uexcel": "UiPath.Excel.Activities",
  "uweb": "UiPath.Web.Activities",
  "umail": "UiPath.Mail.Activities",
  "udb": "UiPath.Database.Activities",
  "uml": "UiPath.MLActivities",
  "uocr": "UiPath.IntelligentOCR.Activities",
  "upers": "UiPath.Persistence.Activities",
  "uds": "UiPath.DataService.Activities",
};

export function scanXamlForRequiredPackages(xamlContent: string): Set<string> {
  const packages = new Set<string>();
  packages.add("UiPath.System.Activities");

  const activityPattern = /<(ui:[A-Za-z]+)\s/g;
  let match;
  while ((match = activityPattern.exec(xamlContent)) !== null) {
    const actTag = match[1];

    if (catalogService.isLoaded()) {
      const pkg = catalogService.getPackageForActivity(actTag);
      if (pkg && !isFrameworkAssembly(pkg)) {
        packages.add(pkg);
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

  const typeArgPattern = /x:TypeArguments="([^"]+)"/g;
  while ((match = typeArgPattern.exec(xamlContent)) !== null) {
    const typeArgs = match[1];
    for (const [typeRef, pkg] of Object.entries(TYPE_ARGUMENT_PACKAGE_MAP)) {
      if (typeArgs.includes(typeRef) && !isFrameworkAssembly(pkg)) {
        packages.add(pkg);
      }
    }
  }

  const assemblyRefPattern = /clr-namespace:([^;]+);assembly=([^"]+)/g;
  while ((match = assemblyRefPattern.exec(xamlContent)) !== null) {
    const assemblyName = match[2].trim();
    if (assemblyName === "Newtonsoft.Json") {
      packages.add("Newtonsoft.Json");
    }
    for (const [, pkgName] of Object.entries(NAMESPACE_PREFIX_TO_PACKAGE)) {
      if (assemblyName === pkgName) {
        packages.add(pkgName);
      }
    }
  }

  const newtonsoftPatterns = [
    /Newtonsoft\.Json/,
    /JToken/,
    /JObject\.Parse/,
    /JArray\.Parse/,
  ];
  for (const pattern of newtonsoftPatterns) {
    if (pattern.test(xamlContent)) {
      packages.add("Newtonsoft.Json");
      break;
    }
  }

  return packages;
}
