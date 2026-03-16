export type QualityGateViolation = {
  category: "blocked-pattern" | "completeness" | "accuracy";
  severity: "error" | "warning";
  check: string;
  file: string;
  detail: string;
};

export type QualityGateResult = {
  passed: boolean;
  violations: QualityGateViolation[];
  summary: {
    blockedPatterns: number;
    completenessErrors: number;
    completenessWarnings: number;
    accuracyErrors: number;
    accuracyWarnings: number;
    totalErrors: number;
    totalWarnings: number;
  };
};

export type QualityGateInput = {
  xamlEntries: { name: string; content: string }[];
  projectJsonContent: string;
  configData?: string;
  orchestratorArtifacts?: any;
  targetFramework: "Windows" | "Portable";
};

type ActivityPropertyInfo = {
  required?: string[];
  optional?: string[];
};

const KNOWN_ACTIVITIES: Record<string, { package: string; properties: ActivityPropertyInfo }> = {
  "ui:Click": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["ClickType", "MouseButton", "KeyModifiers", "CursorPosition", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
  },
  "ui:TypeInto": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Text", "ClickBeforeTyping", "EmptyField", "DelayBetweenKeys", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
  },
  "ui:GetText": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Value", "DelayAfter", "DelayBefore", "TimeoutMS", "ContinueOnError", "InformativeScreenshot"],
    },
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
  },
  "ui:ElementExists": {
    package: "UiPath.UIAutomation.Activities",
    properties: {
      optional: ["Result", "TimeoutMS", "ContinueOnError"],
    },
  },
  "ui:ExcelApplicationScope": {
    package: "UiPath.Excel.Activities",
    properties: {
      optional: ["WorkbookPath", "AutoSave", "Visible", "CreateNewFile", "ReadOnly", "Password", "EditPassword"],
    },
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
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Server", "Port", "SecureConnection", "Email", "Password", "ContinueOnError"],
    },
  },
  "ui:SendOutlookMailMessage": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "Account", "Attachments", "ContinueOnError"],
    },
  },
  "ui:GetImapMailMessage": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Server", "Port", "Email", "Password", "SecureConnection", "Top", "MailFolder", "OnlyUnreadMessages", "ContinueOnError"],
    },
  },
  "ui:GetOutlookMailMessages": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Account", "MailFolder", "Top", "Filter", "OnlyUnreadMessages", "OrderByDate", "ContinueOnError"],
    },
  },
  "ui:SendMail": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["To", "Cc", "Bcc", "Subject", "Body", "IsBodyHtml", "ContinueOnError"],
    },
  },
  "ui:GetMail": {
    package: "UiPath.Mail.Activities",
    properties: {
      optional: ["Top", "MailFolder", "OnlyUnreadMessages", "ContinueOnError"],
    },
  },
  "ui:HttpClient": {
    package: "UiPath.Web.Activities",
    properties: {
      optional: ["EndPoint", "Endpoint", "Method", "AcceptFormat", "Body", "BodyFormat", "Headers", "ResponseContent", "ResponseStatus", "ContinueOnError", "TimeoutMS", "Url"],
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
      optional: ["ConnectionString", "ProviderName", "Sql", "DataTable", "Parameters", "ContinueOnError", "TimeoutMS"],
    },
  },
  "ui:ExecuteNonQuery": {
    package: "UiPath.Database.Activities",
    properties: {
      optional: ["ConnectionString", "ProviderName", "Sql", "AffectedRecords", "Parameters", "ContinueOnError"],
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
      optional: ["QueueName", "Reference", "Priority", "DeferDate", "DueDate", "ItemInformation", "ContinueOnError"],
    },
  },
  "ui:GetTransactionItem": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["QueueName", "TransactionItem", "ContinueOnError"],
    },
  },
  "ui:SetTransactionStatus": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["TransactionItem", "Status", "ErrorType", "Reason", "ContinueOnError"],
    },
  },
  "ui:GetCredential": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["AssetName", "Username", "Password", "ContinueOnError"],
    },
  },
  "ui:GetAsset": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["AssetName", "Value", "ContinueOnError"],
    },
  },
  "ui:ReadTextFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["FileName", "Content", "Encoding", "ContinueOnError"],
    },
  },
  "ui:WriteTextFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["FileName", "Text", "Content", "Encoding", "ContinueOnError"],
    },
  },
  "ui:PathExists": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Path", "PathType", "Result", "ContinueOnError"],
    },
  },
  "ui:LogMessage": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Level", "Message", "ContinueOnError"],
    },
  },
  "ui:InvokeWorkflowFile": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["WorkflowFileName", "Arguments", "Isolated", "ContinueOnError"],
    },
  },
  "ui:Comment": {
    package: "UiPath.System.Activities",
    properties: {
      optional: ["Text"],
    },
  },
  "ui:CreateFormTask": {
    package: "UiPath.Persistence.Activities",
    properties: {
      optional: ["TaskCatalog", "TaskTitle", "TaskPriority", "TaskObject", "TaskData", "ContinueOnError"],
    },
  },
  "ui:WaitForFormTaskAndResume": {
    package: "UiPath.Persistence.Activities",
    properties: {
      optional: ["TaskObject", "TaskAction", "TaskOutput", "ContinueOnError"],
    },
  },
  "ui:MLSkill": {
    package: "UiPath.MLActivities",
    properties: {
      optional: ["SkillName", "Input", "Output", "ContinueOnError", "TimeoutMS"],
    },
  },
  "ui:Predict": {
    package: "UiPath.MLActivities",
    properties: {
      optional: ["ModelName", "Input", "Output", "ContinueOnError"],
    },
  },
};

const VALID_XMLNS_PREFIXES = new Set([
  "x", "mc", "s", "sap", "sap2010", "scg", "scg2", "ui", "ua",
  "mca", "clr", "local", "p", "mva", "sads", "sapv",
]);

const VALID_EXCEPTION_TYPES = new Set([
  "System.Exception",
  "System.BusinessRuleException",
  "System.ApplicationException",
  "System.InvalidOperationException",
  "System.ArgumentException",
  "System.ArgumentNullException",
  "System.NullReferenceException",
  "System.TimeoutException",
  "System.IO.IOException",
  "System.IO.FileNotFoundException",
  "System.Net.WebException",
  "System.Net.Http.HttpRequestException",
  "System.Data.DataException",
  "System.FormatException",
  "System.OverflowException",
  "System.IndexOutOfRangeException",
  "System.Collections.Generic.KeyNotFoundException",
  "UiPath.Core.Activities.BusinessRuleException",
  "System.Activities.WorkflowApplicationAbortedException",
]);

const VALID_TYPE_ARGUMENTS = new Set([
  "x:String", "x:Int32", "x:Int64", "x:Boolean", "x:Double", "x:Decimal", "x:Object",
  "s:DateTime", "s:TimeSpan",
  "scg2:DataTable", "scg2:DataRow",
  "s:Security.SecureString", "s:Net.Mail.MailMessage",
  "ui:QueueItem", "ui:QueueItemData",
  "System.String", "System.Int32", "System.Int64", "System.Boolean",
  "System.Double", "System.Decimal", "System.Object",
  "System.DateTime", "System.TimeSpan",
  "System.Data.DataTable", "System.Data.DataRow",
  "System.Exception",
]);

const CREDENTIAL_PATTERNS = [
  /password\s*[:=]\s*["'][^"']{4,}["']/i,
  /apikey\s*[:=]\s*["'][^"']{8,}["']/i,
  /api_key\s*[:=]\s*["'][^"']{8,}["']/i,
  /secret\s*[:=]\s*["'][^"']{8,}["']/i,
  /Bearer\s+[A-Za-z0-9\-_.~+/]{20,}/,
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/,
  /Data Source=[^;]*;.*Password=[^;]+/i,
  /Server=[^;]*;.*Password=[^;]+/i,
];

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/,
  /\bPLACEHOLDER\b/,
  /\bCHANGEME\b/,
  /\bexample\.com\b/,
];

function scanBlockedPatterns(input: QualityGateInput): QualityGateViolation[] {
  const violations: QualityGateViolation[] = [];

  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    if (content.includes("[object Object]")) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("[object Object]")) {
          violations.push({
            category: "blocked-pattern",
            severity: "error",
            check: "object-object",
            file: shortName,
            detail: `Line ${i + 1}: contains "[object Object]" — serialization failure`,
          });
        }
      }
    }

    const pseudoXamlPattern = /\b(Then|Else|Cases|Body|Finally|Try)="([^"]*)"/g;
    let match;
    while ((match = pseudoXamlPattern.exec(content)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      const contextBefore = content.substring(Math.max(0, match.index - 80), match.index);
      const isInChildElement = /\.\s*$/.test(contextBefore.trimEnd()) ||
        contextBefore.includes(`<If.${attrName}`) ||
        contextBefore.includes(`<Switch.${attrName}`) ||
        contextBefore.includes(`<TryCatch.${attrName}`) ||
        contextBefore.includes(`<ForEach.${attrName}`) ||
        contextBefore.includes(`<Sequence.${attrName}`);
      if (isInChildElement) continue;
      const isPartOfDisplayName = /DisplayName="[^"]*$/.test(contextBefore);
      if (isPartOfDisplayName) continue;
      if (attrValue.length > 0 && attrValue !== "True" && attrValue !== "False") {
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "blocked-pattern",
          severity: "error",
          check: "pseudo-xaml",
          file: shortName,
          detail: `Line ${lineNum}: pseudo-XAML attribute ${attrName}="${attrValue.substring(0, 80)}${attrValue.length > 80 ? "..." : ""}"`,
        });
      }
    }

    const fakeTryCatchPattern = /TryCatch\s+[^>]*(?:Try|Catches|Finally)="[^"]+"/g;
    while ((match = fakeTryCatchPattern.exec(content)) !== null) {
      if (/DisplayName="[^"]*$/.test(content.substring(Math.max(0, match.index - 80), match.index))) continue;
      const lineNum = content.substring(0, match.index).split("\n").length;
      violations.push({
        category: "blocked-pattern",
        severity: "error",
        check: "fake-trycatch",
        file: shortName,
        detail: `Line ${lineNum}: TryCatch uses string attributes instead of nested elements`,
      });
    }

    if (input.targetFramework === "Portable" && content.includes("lib/net45")) {
      const lineNum = content.split("\n").findIndex(l => l.includes("lib/net45")) + 1;
      violations.push({
        category: "blocked-pattern",
        severity: "error",
        check: "net45-in-portable",
        file: shortName,
        detail: `Line ${lineNum}: references lib/net45 path in Portable/Serverless target`,
      });
    }
  }

  if (input.projectJsonContent) {
    if (input.projectJsonContent.includes("[object Object]")) {
      violations.push({
        category: "blocked-pattern",
        severity: "error",
        check: "object-object",
        file: "project.json",
        detail: `project.json contains "[object Object]"`,
      });
    }

    try {
      const pj = JSON.parse(input.projectJsonContent);
      if (pj.designOptions?.modernBehavior === false) {
        violations.push({
          category: "blocked-pattern",
          severity: "error",
          check: "legacy-modern-behavior",
          file: "project.json",
          detail: `modernBehavior is set to false — must be true for Modern projects`,
        });
      }
    } catch {}
  }

  return violations;
}

function checkCompleteness(input: QualityGateInput): QualityGateViolation[] {
  const violations: QualityGateViolation[] = [];

  let projectJson: any = null;
  try {
    projectJson = JSON.parse(input.projectJsonContent);
  } catch {
    violations.push({
      category: "completeness",
      severity: "error",
      check: "project-json-parse",
      file: "project.json",
      detail: "project.json is not valid JSON",
    });
    return violations;
  }

  if (projectJson.designOptions?.modernBehavior !== true) {
    violations.push({
      category: "completeness",
      severity: "error",
      check: "modern-project",
      file: "project.json",
      detail: "Project must have modernBehavior: true",
    });
  }

  const tf = projectJson.targetFramework;
  if (tf !== "Windows" && tf !== "Portable") {
    violations.push({
      category: "completeness",
      severity: "error",
      check: "target-framework",
      file: "project.json",
      detail: `targetFramework "${tf}" is not valid — must be "Windows" or "Portable"`,
    });
  }

  const fileBasenames = new Set(input.xamlEntries.map(e => {
    const parts = e.name.split("/");
    return parts[parts.length - 1];
  }));
  const fileFullPaths = new Set(input.xamlEntries.map(e => e.name));

  if (!fileBasenames.has("Main.xaml")) {
    violations.push({
      category: "completeness",
      severity: "error",
      check: "main-xaml",
      file: "package",
      detail: "Main.xaml is missing from the package",
    });
  }

  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    const invokePattern = /WorkflowFileName="([^"]+)"/g;
    let match;
    while ((match = invokePattern.exec(content)) !== null) {
      const invokedFile = match[1];

      const basenameExists = fileBasenames.has(invokedFile);
      let pathExists = false;
      if (invokedFile.includes("/") || invokedFile.includes("\\")) {
        const normalized = invokedFile.replace(/\\/g, "/");
        pathExists = fileFullPaths.has(normalized) ||
          Array.from(fileFullPaths).some(fp => fp.endsWith("/" + normalized));
      } else {
        pathExists = basenameExists;
      }

      if (!pathExists) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "completeness",
          severity: "error",
          check: "invoked-file",
          file: shortName,
          detail: `Line ${lineNum}: InvokeWorkflowFile references "${invokedFile}" which does not exist in the package`,
        });
      }

      if (invokedFile.includes("/") || invokedFile.includes("\\")) {
        const normalizedInvoke = invokedFile.replace(/\\/g, "/");
        const matchingEntry = Array.from(fileFullPaths).find(fp => {
          const fpBasename = fp.split("/").pop();
          return fpBasename === normalizedInvoke.split("/").pop();
        });
        if (matchingEntry && !matchingEntry.endsWith("/" + normalizedInvoke) && !matchingEntry.endsWith(normalizedInvoke)) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          violations.push({
            category: "completeness",
            severity: "error",
            check: "invoke-path-mismatch",
            file: shortName,
            detail: `Line ${lineNum}: InvokeWorkflowFile path "${invokedFile}" does not match actual archive path "${matchingEntry}"`,
          });
        }
      }
    }
  }

  const deps = projectJson.dependencies;
  if (!deps || typeof deps !== "object" || Object.keys(deps).length === 0) {
    violations.push({
      category: "completeness",
      severity: "error",
      check: "dependencies",
      file: "project.json",
      detail: "No dependencies declared in project.json",
    });
  } else {
    for (const [depName, depVer] of Object.entries(deps)) {
      if (typeof depVer !== "string" || !depVer.match(/^\[?\d+\.\d+\.\d+/)) {
        violations.push({
          category: "completeness",
          severity: "error",
          check: "dependency-version",
          file: "project.json",
          detail: `Dependency "${depName}" has invalid version: "${depVer}"`,
        });
      }
    }
  }

  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    for (const pattern of CREDENTIAL_PATTERNS) {
      if (pattern.test(content)) {
        violations.push({
          category: "completeness",
          severity: "error",
          check: "hardcoded-credential",
          file: shortName,
          detail: `Potential hardcoded credential detected (pattern: ${pattern.source.substring(0, 30)}...)`,
        });
        break;
      }
    }

    const commentPattern = /<!--[\s\S]*?-->/g;
    const contentWithoutComments = content.replace(commentPattern, "");

    for (const pattern of PLACEHOLDER_PATTERNS) {
      const matches = contentWithoutComments.match(new RegExp(pattern.source, "gi"));
      if (matches && matches.length > 0) {
        violations.push({
          category: "completeness",
          severity: "warning",
          check: "placeholder-value",
          file: shortName,
          detail: `Contains ${matches.length} placeholder value(s) matching "${pattern.source}"`,
        });
      }
    }
  }

  if (input.configData && input.xamlEntries.length > 0) {
    const allXamlContent = input.xamlEntries.map(e => e.content).join("\n");
    const configKeyPattern = /in_Config\("([^"]+)"\)/g;
    const referencedKeys = new Set<string>();
    let match;
    while ((match = configKeyPattern.exec(allXamlContent)) !== null) {
      referencedKeys.add(match[1]);
    }

    if (referencedKeys.size > 0 && input.configData) {
      for (const key of referencedKeys) {
        if (!input.configData.includes(key)) {
          violations.push({
            category: "completeness",
            severity: "warning",
            check: "config-key-missing",
            file: "Config.xlsx",
            detail: `Config key "${key}" is referenced in XAML but not found in config data`,
          });
        }
      }
    }
  }

  if (input.orchestratorArtifacts && input.xamlEntries.length > 0) {
    const allXamlContent = input.xamlEntries.map(e => e.content).join("\n");
    const assetPattern = /AssetName="([^"]+)"/g;
    const referencedAssets = new Set<string>();
    let match;
    while ((match = assetPattern.exec(allXamlContent)) !== null) {
      const name = match[1];
      if (!name.startsWith("TODO") && !name.startsWith("PLACEHOLDER")) {
        referencedAssets.add(name);
      }
    }

    if (referencedAssets.size > 0 && input.orchestratorArtifacts?.assets) {
      const declaredAssets = new Set(
        (input.orchestratorArtifacts.assets || []).map((a: any) => a.name)
      );
      for (const asset of referencedAssets) {
        if (!declaredAssets.has(asset)) {
          violations.push({
            category: "completeness",
            severity: "warning",
            check: "undeclared-asset",
            file: "orchestrator",
            detail: `Asset "${asset}" is referenced in XAML but not declared in orchestrator artifacts`,
          });
        }
      }
    }
  }

  return violations;
}

function extractDeclaredSymbols(content: string): { variables: Map<string, string>; arguments: Map<string, { type: string; direction: string }> } {
  const variables = new Map<string, string>();
  const arguments_ = new Map<string, { type: string; direction: string }>();

  const varPattern = /<Variable\s+x:TypeArguments="([^"]+)"\s+[^>]*Name="([^"]+)"/g;
  const varPattern2 = /<Variable\s+[^>]*Name="([^"]+)"[^>]*x:TypeArguments="([^"]+)"/g;
  let m;
  while ((m = varPattern.exec(content)) !== null) {
    variables.set(m[2], m[1]);
  }
  while ((m = varPattern2.exec(content)) !== null) {
    variables.set(m[1], m[2]);
  }

  const propPattern = /<x:Property\s+Name="([^"]+)"\s+Type="([^"]+)"/g;
  while ((m = propPattern.exec(content)) !== null) {
    const name = m[1];
    const typeStr = m[2];
    let direction = "InArgument";
    if (typeStr.includes("OutArgument")) direction = "OutArgument";
    else if (typeStr.includes("InOutArgument")) direction = "InOutArgument";
    const typeMatch = typeStr.match(/Argument\(([^)]+)\)/);
    const baseType = typeMatch ? typeMatch[1] : typeStr;
    arguments_.set(name, { type: baseType, direction });
  }

  const delegatePattern = /<DelegateInArgument[^>]*Name="([^"]+)"/g;
  while ((m = delegatePattern.exec(content)) !== null) {
    variables.set(m[1], "DelegateInArgument");
  }

  return { variables, arguments: arguments_ };
}

function checkActivityProperties(content: string, shortName: string, violations: QualityGateViolation[]): void {
  const activityBlockPattern = /<(ui:[A-Za-z]+)\s+([^>]*?)(\s*\/?>)/g;
  let match;
  while ((match = activityBlockPattern.exec(content)) !== null) {
    const activityName = match[1];
    const attrsStr = match[2];
    const knownActivity = KNOWN_ACTIVITIES[activityName];
    if (!knownActivity) continue;

    const allAllowed = new Set([
      ...(knownActivity.properties.required || []),
      ...(knownActivity.properties.optional || []),
      "DisplayName", "sap2010:WorkflowViewState.IdRef", "sap:VirtualizedContainerService.HintSize",
      "x:TypeArguments", "Selector", "Target",
    ]);

    const attrPattern = /\b([A-Za-z][A-Za-z0-9_.]*)\s*=/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(attrsStr)) !== null) {
      const propName = attrMatch[1];
      if (propName.startsWith("xmlns") || propName.startsWith("sap2010:") ||
          propName.startsWith("sap:") || propName === "x:Class" ||
          propName === "mc:Ignorable") continue;
      if (!allAllowed.has(propName)) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "accuracy",
          severity: "warning",
          check: "invalid-activity-property",
          file: shortName,
          detail: `Line ${lineNum}: property "${propName}" is not a known property of ${activityName}`,
        });
      }
    }
  }
}

function checkVariableArgumentDeclarations(input: QualityGateInput, violations: QualityGateViolation[]): void {
  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;
    const { variables, arguments: args } = extractDeclaredSymbols(content);
    const allDeclared = new Set([...variables.keys(), ...args.keys()]);

    const keywords = new Set([
      "True", "False", "Nothing", "null", "New", "Not", "And", "Or", "If",
      "String", "Integer", "Boolean", "DateTime", "Math", "Convert", "CType",
      "CStr", "CInt", "CDbl", "Environment", "TimeSpan", "Now", "Today",
      "System", "Console", "Exception", "Array", "Type",
    ]);

    const exprPattern = /\[([^\[\]]+)\]/g;
    let match;
    while ((match = exprPattern.exec(content)) !== null) {
      const expr = match[1];
      if (expr.startsWith("&quot;") || expr.startsWith("\"") || expr.startsWith("'")) continue;
      if (/^\d+$/.test(expr)) continue;

      const identPattern = /\b([a-zA-Z_]\w*)\b/g;
      let idMatch;
      while ((idMatch = identPattern.exec(expr)) !== null) {
        const ident = idMatch[1];
        if (keywords.has(ident)) continue;
        if (/^[A-Z][a-z]/.test(ident) && expr.includes(`${ident}.`) && !allDeclared.has(ident)) continue;
        const prefixes = ["str_", "int_", "bool_", "dt_", "qi_", "obj_", "dbl_", "sec_", "io_", "in_", "out_", "list_", "arr_", "dict_"];
        if (prefixes.some(p => ident.startsWith(p)) && !allDeclared.has(ident)) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          violations.push({
            category: "completeness",
            severity: "error",
            check: "undeclared-variable",
            file: shortName,
            detail: `Line ${lineNum}: variable "${ident}" is used in expression but not declared in this workflow`,
          });
        }
      }
    }
  }
}

function checkInvokeArgumentTypes(input: QualityGateInput, violations: QualityGateViolation[]): void {
  const workflowArgs = new Map<string, Map<string, { type: string; direction: string }>>();
  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const { arguments: args } = extractDeclaredSymbols(entry.content);
    workflowArgs.set(shortName, args);
  }

  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    const invokeBlockPattern = /<ui:InvokeWorkflowFile[^>]*WorkflowFileName="([^"]+)"[^>]*>[\s\S]*?<ui:InvokeWorkflowFile\.Arguments>([\s\S]*?)<\/ui:InvokeWorkflowFile\.Arguments>/g;
    let match;
    while ((match = invokeBlockPattern.exec(content)) !== null) {
      const targetFile = match[1];
      const argsContent = match[2];
      const targetArgs = workflowArgs.get(targetFile);
      if (!targetArgs) continue;

      const argPattern = /x:TypeArguments="([^"]+)"\s+x:Key="([^"]+)"/g;
      const argPattern2 = /x:Key="([^"]+)"[^>]*x:TypeArguments="([^"]+)"/g;
      let argMatch;
      while ((argMatch = argPattern.exec(argsContent)) !== null) {
        const passedType = argMatch[1];
        const argName = argMatch[2];
        const declaredArg = targetArgs.get(argName);
        if (declaredArg) {
          const normalizedPassed = normalizeTypeName(passedType);
          const normalizedDeclared = normalizeTypeName(declaredArg.type);
          if (normalizedPassed !== normalizedDeclared && normalizedPassed !== "x:Object") {
            const lineNum = content.substring(0, match.index).split("\n").length;
            violations.push({
              category: "accuracy",
              severity: "error",
              check: "invoke-arg-type-mismatch",
              file: shortName,
              detail: `Line ${lineNum}: argument "${argName}" passed as ${passedType} to "${targetFile}" but declared as ${declaredArg.type}`,
            });
          }
        }
      }
      while ((argMatch = argPattern2.exec(argsContent)) !== null) {
        const argName = argMatch[1];
        const passedType = argMatch[2];
        const declaredArg = targetArgs.get(argName);
        if (declaredArg) {
          const normalizedPassed = normalizeTypeName(passedType);
          const normalizedDeclared = normalizeTypeName(declaredArg.type);
          if (normalizedPassed !== normalizedDeclared && normalizedPassed !== "x:Object") {
            const lineNum = content.substring(0, match.index).split("\n").length;
            violations.push({
              category: "accuracy",
              severity: "error",
              check: "invoke-arg-type-mismatch",
              file: shortName,
              detail: `Line ${lineNum}: argument "${argName}" passed as ${passedType} to "${targetFile}" but declared as ${declaredArg.type}`,
            });
          }
        }
      }
    }
  }
}

function normalizeTypeName(t: string): string {
  const lower = t.toLowerCase().trim();
  if (lower === "x:string" || lower === "system.string" || lower === "string") return "x:String";
  if (lower === "x:int32" || lower === "system.int32" || lower === "int32" || lower === "integer") return "x:Int32";
  if (lower === "x:int64" || lower === "system.int64" || lower === "int64") return "x:Int64";
  if (lower === "x:boolean" || lower === "system.boolean" || lower === "boolean" || lower === "bool") return "x:Boolean";
  if (lower === "x:double" || lower === "system.double" || lower === "double") return "x:Double";
  if (lower === "x:decimal" || lower === "system.decimal" || lower === "decimal") return "x:Decimal";
  if (lower === "x:object" || lower === "system.object" || lower === "object") return "x:Object";
  if (lower.includes("datatable")) return "DataTable";
  if (lower.includes("datarow")) return "DataRow";
  return t;
}

function checkTryCatchStructure(content: string, shortName: string, violations: QualityGateViolation[]): void {
  const tryCatchPattern = /<TryCatch\s/g;
  let match;
  while ((match = tryCatchPattern.exec(content)) !== null) {
    const lineNum = content.substring(0, match.index).split("\n").length;
    const after = content.substring(match.index, Math.min(content.length, match.index + 5000));

    const closingIdx = after.indexOf("</TryCatch>");
    if (closingIdx === -1) continue;
    const tryCatchBlock = after.substring(0, closingIdx + 11);

    if (!tryCatchBlock.includes("<TryCatch.Try>") && !tryCatchBlock.includes("<TryCatch.Catches>")) {
      violations.push({
        category: "accuracy",
        severity: "warning",
        check: "invalid-trycatch-structure",
        file: shortName,
        detail: `Line ${lineNum}: TryCatch is missing <TryCatch.Try> and/or <TryCatch.Catches> child elements`,
      });
    }

    if (tryCatchBlock.includes("<TryCatch.Catches>")) {
      const catchesStart = tryCatchBlock.indexOf("<TryCatch.Catches>");
      const catchesEnd = tryCatchBlock.indexOf("</TryCatch.Catches>");
      if (catchesStart !== -1 && catchesEnd !== -1) {
        const catchesBlock = tryCatchBlock.substring(catchesStart, catchesEnd);
        if (!catchesBlock.includes("<Catch")) {
          violations.push({
            category: "accuracy",
            severity: "warning",
            check: "empty-catches",
            file: shortName,
            detail: `Line ${lineNum}: TryCatch has <TryCatch.Catches> but no <Catch> elements inside`,
          });
        }

        const catchExceptionPattern = /<Catch\s+x:TypeArguments="([^"]+)"/g;
        let catchMatch;
        while ((catchMatch = catchExceptionPattern.exec(catchesBlock)) !== null) {
          const exType = catchMatch[1];
          if (!VALID_EXCEPTION_TYPES.has(exType) && !exType.startsWith("System.") && !exType.includes("Exception")) {
            violations.push({
              category: "accuracy",
              severity: "warning",
              check: "invalid-catch-type",
              file: shortName,
              detail: `Line ${lineNum}: Catch uses x:TypeArguments="${exType}" which is not a valid exception type`,
            });
          }
        }
      }
    }
  }
}

function checkDefaultValueSyntax(content: string, shortName: string, targetFramework: "Windows" | "Portable", violations: QualityGateViolation[]): void {
  const varDefaultPattern = /<Variable\s+x:TypeArguments="([^"]+)"[^>]*Default="([^"]*)"[^>]*Name="([^"]+)"/g;
  const varDefaultPattern2 = /<Variable\s+[^>]*Name="([^"]+)"[^>]*x:TypeArguments="([^"]+)"[^>]*Default="([^"]*)"/g;
  let match;

  const checkDefault = (typeName: string, defaultVal: string, varName: string, idx: number) => {
    if (!defaultVal || defaultVal.startsWith("[") || defaultVal === "") return;
    const lower = typeName.toLowerCase();

    if ((lower === "x:int32" || lower === "x:int64" || lower === "int32" || lower === "int64") && !/^-?\d+$/.test(defaultVal)) {
      const lineNum = content.substring(0, idx).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "warning",
        check: "invalid-default-value",
        file: shortName,
        detail: `Line ${lineNum}: variable "${varName}" type ${typeName} has non-numeric default: "${defaultVal}"`,
      });
    }
    if ((lower === "x:boolean" || lower === "boolean") && !["True", "False", "true", "false"].includes(defaultVal)) {
      const lineNum = content.substring(0, idx).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "warning",
        check: "invalid-default-value",
        file: shortName,
        detail: `Line ${lineNum}: variable "${varName}" type ${typeName} has non-boolean default: "${defaultVal}"`,
      });
    }
    if ((lower === "x:double" || lower === "x:decimal" || lower === "double" || lower === "decimal") && !/^-?\d+\.?\d*$/.test(defaultVal)) {
      const lineNum = content.substring(0, idx).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "warning",
        check: "invalid-default-value",
        file: shortName,
        detail: `Line ${lineNum}: variable "${varName}" type ${typeName} has non-numeric default: "${defaultVal}"`,
      });
    }
  };

  while ((match = varDefaultPattern.exec(content)) !== null) {
    checkDefault(match[1], match[2], match[3] || "unknown", match.index);
  }
  while ((match = varDefaultPattern2.exec(content)) !== null) {
    checkDefault(match[2], match[3], match[1] || "unknown", match.index);
  }
}

function checkAccuracy(input: QualityGateInput): QualityGateViolation[] {
  const violations: QualityGateViolation[] = [];

  let projectJson: any = null;
  try {
    projectJson = JSON.parse(input.projectJsonContent);
  } catch {
    return violations;
  }

  const declaredDeps = new Set(Object.keys(projectJson.dependencies || {}));

  for (const entry of input.xamlEntries) {
    const shortName = entry.name.split("/").pop() || entry.name;
    const content = entry.content;

    const activityPattern = /<(ui:[A-Za-z]+)\s/g;
    let match;
    while ((match = activityPattern.exec(content)) !== null) {
      const activityName = match[1];
      const knownActivity = KNOWN_ACTIVITIES[activityName];

      if (!knownActivity) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "accuracy",
          severity: "warning",
          check: "unknown-activity",
          file: shortName,
          detail: `Line ${lineNum}: unknown activity "${activityName}" — not in known activity registry (may be hallucinated)`,
        });
        continue;
      }

      if (knownActivity.package && !declaredDeps.has(knownActivity.package)) {
        violations.push({
          category: "accuracy",
          severity: "error",
          check: "missing-package-dep",
          file: shortName,
          detail: `Activity "${activityName}" requires package "${knownActivity.package}" which is not in project.json dependencies`,
        });
      }
    }

    checkActivityProperties(content, shortName, violations);

    const xmlnsDeclared = new Set<string>();
    const xmlnsPattern = /xmlns:([a-zA-Z0-9]+)="([^"]+)"/g;
    while ((match = xmlnsPattern.exec(content)) !== null) {
      xmlnsDeclared.add(match[1]);
    }

    const prefixUsagePattern = /<([a-zA-Z0-9]+):[A-Za-z]+[\s/>]/g;
    const usedPrefixes = new Set<string>();
    while ((match = prefixUsagePattern.exec(content)) !== null) {
      usedPrefixes.add(match[1]);
    }

    for (const prefix of usedPrefixes) {
      if (prefix === "xmlns") continue;
      if (!xmlnsDeclared.has(prefix)) {
        violations.push({
          category: "accuracy",
          severity: "error",
          check: "undeclared-namespace",
          file: shortName,
          detail: `Namespace prefix "${prefix}:" is used in the XAML body but has no xmlns declaration on the root element`,
        });
      }
    }

    if (input.targetFramework === "Windows") {
      const csharpInterpolation = /\$"[^"]*\{[^}]+\}[^"]*"/g;
      while ((match = csharpInterpolation.exec(content)) !== null) {
        const contextBefore = content.substring(Math.max(0, match.index - 100), match.index);
        if (contextBefore.includes("<!--") && !contextBefore.includes("-->")) continue;
        if (/ExpressionLanguage="CSharp"/.test(content)) continue;
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "accuracy",
          severity: "error",
          check: "expression-syntax-mismatch",
          file: shortName,
          detail: `Line ${lineNum}: C# string interpolation $"..." found in Windows/VB.NET project — use String.Format or & concatenation`,
        });
      }
    }

    if (input.targetFramework === "Portable") {
      const vbConcatPattern = /"\s*&\s*[a-zA-Z_]\w*/g;
      while ((match = vbConcatPattern.exec(content)) !== null) {
        const contextBefore = content.substring(Math.max(0, match.index - 100), match.index);
        if (contextBefore.includes("<!--") && !contextBefore.includes("-->")) continue;
        if (/ExpressionLanguage="VisualBasic"/.test(content)) continue;
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "accuracy",
          severity: "error",
          check: "expression-syntax-mismatch",
          file: shortName,
          detail: `Line ${lineNum}: VB.NET & concatenation found in Portable/C# project — use + or string interpolation`,
        });
      }
    }

    const typeArgsPattern = /x:TypeArguments="([^"]+)"/g;
    while ((match = typeArgsPattern.exec(content)) !== null) {
      const typeArg = match[1];
      if (!VALID_TYPE_ARGUMENTS.has(typeArg) &&
          !typeArg.includes("List") &&
          !typeArg.includes("Dictionary") &&
          !typeArg.includes(",") &&
          !typeArg.startsWith("scg:") &&
          !typeArg.startsWith("s:") &&
          !typeArg.startsWith("ui:") &&
          !typeArg.startsWith("x:") &&
          !typeArg.startsWith("System.")) {
        const contextBefore = content.substring(Math.max(0, match.index - 100), match.index);
        if (contextBefore.includes("<Catch")) continue;
        const lineNum = content.substring(0, match.index).split("\n").length;
        violations.push({
          category: "accuracy",
          severity: "warning",
          check: "invalid-type-argument",
          file: shortName,
          detail: `Line ${lineNum}: x:TypeArguments="${typeArg}" may not be a valid .NET type`,
        });
      }
    }

    checkTryCatchStructure(content, shortName, violations);

    checkDefaultValueSyntax(content, shortName, input.targetFramework, violations);

    const emptySequencePattern = /<Sequence\s[^>]*DisplayName="([^"]*)"[^>]*>\s*<\/Sequence>/g;
    while ((match = emptySequencePattern.exec(content)) !== null) {
      const displayName = match[1];
      const lineNum = content.substring(0, match.index).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "error",
        check: "empty-container",
        file: shortName,
        detail: `Line ${lineNum}: empty <Sequence> "${displayName}" — may indicate dropped generation output`,
      });
    }

    const emptyFlowchartPattern = /<Flowchart\s[^>]*DisplayName="([^"]*)"[^>]*>\s*<\/Flowchart>/g;
    while ((match = emptyFlowchartPattern.exec(content)) !== null) {
      const displayName = match[1];
      const lineNum = content.substring(0, match.index).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "error",
        check: "empty-container",
        file: shortName,
        detail: `Line ${lineNum}: empty <Flowchart> "${displayName}" — may indicate dropped generation output`,
      });
    }

    const emptySequenceWithVarsPattern = /<Sequence\s[^>]*DisplayName="([^"]*)"[^>]*>\s*<Sequence\.Variables\s*\/>\s*<\/Sequence>/g;
    while ((match = emptySequenceWithVarsPattern.exec(content)) !== null) {
      const displayName = match[1];
      const lineNum = content.substring(0, match.index).split("\n").length;
      violations.push({
        category: "accuracy",
        severity: "error",
        check: "empty-container",
        file: shortName,
        detail: `Line ${lineNum}: <Sequence> "${displayName}" has only an empty Variables block — no actual activities`,
      });
    }
  }

  checkVariableArgumentDeclarations(input, violations);
  checkInvokeArgumentTypes(input, violations);

  return violations;
}

export function runQualityGate(input: QualityGateInput): QualityGateResult {
  const blockedViolations = scanBlockedPatterns(input);
  const completenessViolations = checkCompleteness(input);
  const accuracyViolations = checkAccuracy(input);
  const allViolations = [...blockedViolations, ...completenessViolations, ...accuracyViolations];

  const hasErrors = allViolations.some(v => v.severity === "error");
  const summary = buildSummary(allViolations);

  return {
    passed: !hasErrors,
    violations: allViolations,
    summary,
  };
}

function buildSummary(violations: QualityGateViolation[]): QualityGateResult["summary"] {
  const blockedPatterns = violations.filter(v => v.category === "blocked-pattern" && v.severity === "error").length;
  const completenessErrors = violations.filter(v => v.category === "completeness" && v.severity === "error").length;
  const completenessWarnings = violations.filter(v => v.category === "completeness" && v.severity === "warning").length;
  const accuracyErrors = violations.filter(v => v.category === "accuracy" && v.severity === "error").length;
  const accuracyWarnings = violations.filter(v => v.category === "accuracy" && v.severity === "warning").length;
  return {
    blockedPatterns,
    completenessErrors,
    completenessWarnings,
    accuracyErrors,
    accuracyWarnings,
    totalErrors: blockedPatterns + completenessErrors + accuracyErrors,
    totalWarnings: completenessWarnings + accuracyWarnings,
  };
}

export function formatQualityGateViolations(result: QualityGateResult): string {
  if (result.passed && result.violations.length === 0) {
    return "Quality gate passed — no violations found.";
  }

  const lines: string[] = [];
  if (!result.passed) {
    lines.push(`Quality gate FAILED — ${result.summary.totalErrors} error(s), ${result.summary.totalWarnings} warning(s)`);
  } else {
    lines.push(`Quality gate passed with ${result.summary.totalWarnings} warning(s)`);
  }

  const grouped: Record<string, QualityGateViolation[]> = {};
  for (const v of result.violations) {
    const key = `${v.category}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  }

  const categoryLabels: Record<string, string> = {
    "blocked-pattern": "Blocked Patterns",
    "completeness": "Completeness",
    "accuracy": "Technical Accuracy",
  };

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`\n[${categoryLabels[cat] || cat}]`);
    for (const v of items) {
      const severity = v.severity === "error" ? "ERROR" : "WARN";
      lines.push(`  ${severity} [${v.check}] ${v.file}: ${v.detail}`);
    }
  }

  return lines.join("\n");
}
