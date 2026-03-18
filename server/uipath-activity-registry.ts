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

export const ACTIVITY_REGISTRY: Record<string, ActivityRegistryEntry> = {
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
  const queueKeywords = ["queue", "transaction", "orchestrator queue", "retry", "reframework"];

  const uiScore = uiKeywords.filter(k => allText.includes(k)).length;
  const apiScore = apiKeywords.filter(k => allText.includes(k)).length;
  const queueScore = queueKeywords.filter(k => allText.includes(k)).length;

  if (queueScore >= 2) return "transactional-queue";
  if (uiScore > 0 && apiScore > 0) return "hybrid";
  if (uiScore >= 2) return "ui-automation";
  if (apiScore >= 2) return "api-data-driven";

  return "simple-linear";
}

export function shouldUseReFramework(pattern: AutomationPattern): boolean {
  return pattern === "transactional-queue";
}

export function getActivityPackage(activityName: string): string | undefined {
  const entry = ACTIVITY_REGISTRY[activityName];
  return entry?.package || undefined;
}

export function isKnownActivity(activityName: string): boolean {
  return activityName in ACTIVITY_REGISTRY;
}

export { getBlockedActivities, isActivityAllowed } from "./uipath-activity-policy";

export function scanXamlForRequiredPackages(xamlContent: string): Set<string> {
  const packages = new Set<string>();
  packages.add("UiPath.System.Activities");

  const activityPattern = /<(ui:[A-Za-z]+)\s/g;
  let match;
  while ((match = activityPattern.exec(xamlContent)) !== null) {
    const entry = ACTIVITY_REGISTRY[match[1]];
    if (entry?.package) {
      packages.add(entry.package);
    }
  }

  return packages;
}
